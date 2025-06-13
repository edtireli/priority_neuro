import os
import json
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import app
from database import Base
from dependencies import get_db
from models import User
import tasks
from tasks import run_boed_job

engine = create_engine(
    os.environ["DATABASE_URL"],
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def client(tmp_path, monkeypatch):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    monkeypatch.setenv("RESULTS_ROOT", str(tmp_path / "results"))
    monkeypatch.setenv("UPLOADS_ROOT", str(tmp_path / "uploads"))
    monkeypatch.setattr("tasks.SessionLocal", TestingSessionLocal)
    tasks.celery.conf.task_always_eager = True
    tasks.celery.conf.broker_url = 'memory://'
    tasks.celery.conf.result_backend = 'cache+memory://'
    from tasks import send_verification_email
    send_verification_email.apply_async = lambda *a, **k: None
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def get_auth_token(client):
    client.post(
        "/api/auth/register",
        json={"email": "test2@example.com", "full_name": "Test", "institution": "Inst", "password": "Pass1234"},
    )
    db = TestingSessionLocal()
    token_val = db.query(User).filter(User.email == "test2@example.com").first().verification_token
    db.close()
    client.post("/api/auth/verify", json={"token": token_val})
    login = client.post("/api/auth/login", json={"email": "test2@example.com", "password": "Pass1234"})
    return login.json()["access_token"]


def test_job_lifecycle(client, tmp_path):
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    proj = client.post("/api/projects", json={"name": "P", "description": ""}, headers=headers).json()
    project_id = proj["id"]
    valid_config = {
        "metadata": {"name": "P", "description": ""},
        "model": {
            "type": "built-in",
            "templateName": "psychometric",
            "parameters": [
                {"name": "threshold", "type": "float", "default_prior": {"dist": "Normal", "mean": 0.5, "sd": 0.2}},
                {"name": "slope", "type": "float", "default_prior": {"dist": "Gamma", "shape": 2.0, "scale": 1.0}},
            ],
            "dependentVariables": ["y"],
        },
        "priors": {
            "threshold": {"dist": "Normal", "mean": 0.5, "sd": 0.2},
            "slope": {"dist": "Gamma", "shape": 2.0, "scale": 1.0},
        },
        "designVariables": [
            {"name": "x1", "type": "continuous", "range": [0.0, 1.0], "units": "a.u."}
        ],
        "objective": {"type": "information_gain", "options": {}},
        "constraints": {"sampleSize": 10, "trialLimit": 2, "costWeights": {"subject": 1, "trial": 1, "session": 1}},
        "experimentalMode": "batch",
    }
    client.put(f"/api/projects/{project_id}/config", json=valid_config, headers=headers)

    job_res = client.post(
        f"/api/projects/{project_id}/jobs",
        data={"config": json.dumps(valid_config)},
        headers=headers,
    )
    assert job_res.status_code == 201
    job = job_res.json()
    job_id = job["id"]
    assert job["status"] == "queued"

    run_boed_job.apply_async(args=[job_id], task_id=job_id).get()

    status_res = client.get(f"/api/projects/{project_id}/jobs/{job_id}/status", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "succeeded"

    results_res = client.get(f"/api/projects/{project_id}/jobs/{job_id}/results", headers=headers)
    assert results_res.status_code == 200
    data = results_res.json()
    assert "best_design" in data["summary"] and "utility" in data["summary"]

    metrics = client.get(
        f"/api/projects/{project_id}/jobs/{job_id}/metrics",
        headers=headers,
    ).json()
    assert len(metrics) == 1

    cfg_res = client.get(
        f"/api/projects/{project_id}/jobs/{job_id}/config",
        headers=headers,
    )
    assert cfg_res.status_code == 200
    assert cfg_res.json()["config"]["objective"]["type"] == "information_gain"


def test_sequential_paused_flow(client, tmp_path):
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    proj = client.post("/api/projects", json={"name": "P2", "description": ""}, headers=headers).json()
    pid = proj["id"]
    cfg = {
        "metadata": {"name": "P2", "description": ""},
        "model": {"type": "built-in", "templateName": "psychometric", "parameters": [], "dependentVariables": ["y"]},
        "priors": {},
        "designVariables": [{"name": "x", "type": "continuous", "range": [0,1]}],
        "objective": {"type": "information_gain"},
        "constraints": {"sampleSize": 1, "trialLimit": 2, "costWeights": {"subject":1,"trial":1,"session":1}},
        "experimentalMode": "sequential",
    }

    res = client.post(
        f"/api/projects/{pid}/jobs",
        data={"config": json.dumps(cfg)},
        headers=headers,
    )
    assert res.status_code == 201
    job = res.json()
    assert job["status"] == "paused_awaiting_data"
    jid = job["id"]

    pilot_file = tmp_path / "pilot.csv"
    pilot_file.write_text("x,y\n0,1")
    with open(pilot_file, "rb") as f:
        res2 = client.post(
            f"/api/projects/{pid}/jobs/{jid}/data",
            files={"pilot_data": ("pilot.csv", f, "text/csv")},
            headers=headers,
        )
    assert res2.status_code == 200
    assert res2.json()["status"] == "queued"

def test_invalid_pilot_data_on_create(client, tmp_path):
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    proj = client.post("/api/projects", json={"name": "P3", "description": ""}, headers=headers).json()
    pid = proj["id"]
    cfg = {
        "metadata": {"name": "P3", "description": ""},
        "model": {"type": "built-in", "templateName": "psychometric", "parameters": [], "dependentVariables": ["y"]},
        "priors": {},
        "designVariables": [{"name": "x", "type": "continuous", "range": [0,1]}],
        "objective": {"type": "information_gain"},
        "constraints": {"sampleSize": 1, "trialLimit": 2, "costWeights": {"subject":1,"trial":1,"session":1}},
        "experimentalMode": "sequential",
    }
    invalid = tmp_path / "bad.csv"
    invalid.write_text("x,z\n0,1")
    with open(invalid, "rb") as f:
        res = client.post(
            f"/api/projects/{pid}/jobs",
            data={"config": json.dumps(cfg)},
            files={"pilot_data": ("bad.csv", f, "text/csv")},
            headers=headers,
        )
    assert res.status_code == 400


def test_invalid_pilot_data_on_upload(client, tmp_path):
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    proj = client.post("/api/projects", json={"name": "P4", "description": ""}, headers=headers).json()
    pid = proj["id"]
    cfg = {
        "metadata": {"name": "P4", "description": ""},
        "model": {"type": "built-in", "templateName": "psychometric", "parameters": [], "dependentVariables": ["y"]},
        "priors": {},
        "designVariables": [{"name": "x", "type": "continuous", "range": [0,1]}],
        "objective": {"type": "information_gain"},
        "constraints": {"sampleSize": 1, "trialLimit": 2, "costWeights": {"subject":1,"trial":1,"session":1}},
        "experimentalMode": "sequential",
    }
    res = client.post(
        f"/api/projects/{pid}/jobs",
        data={"config": json.dumps(cfg)},
        headers=headers,
    )
    job = res.json()
    jid = job["id"]
    bad = tmp_path / "bad.csv"
    bad.write_text("x,z\n0,1")
    with open(bad, "rb") as f:
        res2 = client.post(
            f"/api/projects/{pid}/jobs/{jid}/data",
            files={"pilot_data": ("bad.csv", f, "text/csv")},
            headers=headers,
        )
    assert res2.status_code == 400
