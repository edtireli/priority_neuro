import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
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
import tasks

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
    monkeypatch.setattr("routers.jobs.run_boed_job.apply_async", lambda *a, **k: None)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def auth_token(client):
    client.post(
        "/api/auth/register",
        json={"email": "a@b.com", "full_name": "T", "institution": "I", "password": "pass"},
    )
    db = TestingSessionLocal()
    token_val = db.query(User).filter(User.email == "a@b.com").first().verification_token
    db.close()
    client.post("/api/auth/verify", json={"token": token_val})
    login = client.post("/api/auth/login", json={"email": "a@b.com", "password": "pass"})
    return login.json()["access_token"]


def test_results_detailed_endpoint(client, tmp_path):
    token = auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    proj = client.post("/api/projects", json={"name": "P", "description": ""}, headers=headers).json()
    pid = proj["id"]

    config = {
        "metadata": {"name": "P", "description": ""},
        "model": {"type": "built-in", "templateName": "psychometric", "parameters": [
            {"name": "threshold", "type": "float", "default_prior": {"dist": "Uniform", "low":0.0, "high":1.0}},
            {"name": "slope", "type": "float", "default_prior": {"dist": "Uniform", "low":0.3, "high":0.3}}
        ], "dependentVariables": ["y"]},
        "priors": {
            "threshold": {"dist": "Uniform", "low":0.0, "high":1.0},
            "slope": {"dist": "Uniform", "low":0.3, "high":0.3}
        },
        "designVariables": [
            {"name": "x", "type": "continuous", "range": [0.0, 1.0]}
        ],
        "advancedOptions": {"n_train": 200, "bo_budget": 22, "N_max": 100, "epochs": 5},
        "experimentalMode": "batch",
    }
    client.put(f"/api/projects/{pid}/config", json=config, headers=headers)

    job = client.post(
        f"/api/projects/{pid}/jobs",
        data={"config": json.dumps(config)},
        headers=headers,
    ).json()
    jid = job["id"]
    run_optimisation_task.run(jid)

    res = client.get(f"/api/projects/{pid}/jobs/{jid}/results-detailed", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "optimalDesign" in data and "utilityValue" in data
    assert len(data["evaluatedDesigns"]) >= 22
    assert len(data["topDesigns"]) == 10
    expected_n = config["advancedOptions"].get("N_max", 2000)
    if isinstance(data["priorSamples"], list):
        assert len(data["priorSamples"]) == expected_n
        assert len(data["posteriorSamples"]) == expected_n
    else:
        assert all("bins" in v and "density" in v for v in data["priorSamples"].values())
    if data.get("learningCurve"):
        lc = data["learningCurve"]
        assert len(lc["sessions"]) == len(lc["meanPerformance"])


def test_results_detailed_utility_metric(client, tmp_path):
    token = auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    proj = client.post("/api/projects", json={"name": "P2", "description": ""}, headers=headers).json()
    pid = proj["id"]

    cfg = {
        "metadata": {"name": "P2", "description": ""},
        "model": {
            "type": "built-in",
            "templateName": "psychometric",
            "parameters": [
                {"name": "threshold", "type": "float", "default_prior": {"dist": "Uniform", "low": 0.0, "high": 1.0}},
            ],
            "dependentVariables": ["y"],
        },
        "priors": {"threshold": {"dist": "Uniform", "low": 0.0, "high": 1.0}},
        "designVariables": [{"name": "x", "type": "continuous", "range": [0.0, 1.0]}],
        "advancedOptions": {"n_train": 50, "bo_budget": 1, "N_max": 20, "epochs": 1},
        "experimentalMode": "batch",
    }
    client.put(f"/api/projects/{pid}/config", json=cfg, headers=headers)

    job = client.post(
        f"/api/projects/{pid}/jobs",
        data={"config": json.dumps(cfg)},
        headers=headers,
    ).json()
    jid = job["id"]
    run_optimisation_task.run(jid)

    res = client.get(f"/api/projects/{pid}/jobs/{jid}/results", headers=headers)
    summary_data = res.json()
    assert isinstance(summary_data["metrics"], list)
    assert len(summary_data["metrics"]) > 0
    assert summary_data["summary"]["utility"] == max(m["utility"] for m in summary_data["metrics"])

    res = client.get(f"/api/projects/{pid}/jobs/{jid}/results-detailed", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["evaluatedDesigns"][0]["utility"] == summary_data["summary"]["utility"] > 0

