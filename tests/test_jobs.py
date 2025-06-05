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
from tasks import run_optimisation_task

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
    monkeypatch.setattr("tasks.SessionLocal", TestingSessionLocal)
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr("routers.jobs.run_optimisation_task.apply_async", lambda *a, **k: None)
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
        },
        "priors": {
            "threshold": {"dist": "Normal", "mean": 0.5, "sd": 0.2},
            "slope": {"dist": "Gamma", "shape": 2.0, "scale": 1.0},
        },
        "designVariables": [
            {"name": "x1", "type": "continuous", "range": [0.0, 1.0], "units": "a.u."}
        ],
        "objective": {"type": "information_gain", "options": {}},
        "constraints": {"sampleSize": 10, "trialLimit": 50, "costWeights": {"subject": 1, "trial": 1, "session": 1}},
    }
    client.put(f"/api/projects/{project_id}/config", json=valid_config, headers=headers)

    job_req = {"job_name": "TestJob", "mode": "single_shot", "compute_type": "cpu"}
    job_res = client.post(f"/api/projects/{project_id}/jobs", json=job_req, headers=headers)
    assert job_res.status_code == 201
    job = job_res.json()
    job_id = job["id"]
    assert job["status"] == "queued"

    run_optimisation_task.run(job_id)

    status_res = client.get(f"/api/projects/{project_id}/jobs/{job_id}/status", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "succeeded"

    results_res = client.get(f"/api/projects/{project_id}/jobs/{job_id}/results", headers=headers)
    assert results_res.status_code == 200
    data = json.loads(results_res.text)
    assert "optimalDesign" in data
    assert data["optimalDesign"]["x1"] == 0.5
