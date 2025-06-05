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


def auth_token(client):
    client.post(
        "/api/auth/register",
        json={"email": "a@b.com", "full_name": "T", "institution": "I", "password": "pass"},
    )
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
        ]},
        "priors": {
            "threshold": {"dist": "Uniform", "low":0.0, "high":1.0},
            "slope": {"dist": "Uniform", "low":0.3, "high":0.3}
        },
        "designVariables": [
            {"name": "x", "type": "continuous", "range": [0.0, 1.0]}
        ],
        "advanced_options": {"n_train": 200, "bo_budget": 22, "M_test": 100, "epochs": 5}
    }
    client.put(f"/api/projects/{pid}/config", json=config, headers=headers)

    job = client.post(f"/api/projects/{pid}/jobs", json={"job_name":"J", "mode":"single_shot", "compute_type":"cpu"}, headers=headers).json()
    jid = job["id"]
    run_optimisation_task.run(jid)

    res = client.get(f"/api/projects/{pid}/jobs/{jid}/results-detailed", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "optimalDesign" in data and "utilityValue" in data
    assert len(data["evaluatedDesigns"]) >= 22
    assert len(data["topDesigns"]) == 10
    if isinstance(data["priorSamples"], list):
        assert len(data["priorSamples"]) == 2000
        assert len(data["posteriorSamples"]) == 2000
    else:
        assert all("bins" in v and "density" in v for v in data["priorSamples"].values())
    if data.get("learningCurve"):
        lc = data["learningCurve"]
        assert len(lc["sessions"]) == len(lc["meanPerformance"])

