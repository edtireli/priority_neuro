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


def get_token(client):
    client.post(
        "/api/auth/register",
        json={"email": "seq@example.com", "full_name": "Seq", "institution": "I", "password": "pass"},
    )
    login = client.post("/api/auth/login", json={"email": "seq@example.com", "password": "pass"})
    return login.json()["access_token"]


def test_sequential_flow(client, tmp_path):
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    proj = client.post("/api/projects", json={"name": "P", "description": ""}, headers=headers).json()
    pid = proj["id"]

    config = {
        "metadata": {"name": "P", "description": ""},
        "model": {"type": "built-in", "templateName": "psychometric", "parameters": []},
        "priors": {},
        "designVariables": [
            {"name": "x", "type": "continuous", "range": [0.0, 1.0]}
        ],
        "advanced_options": {"batch_size": 1, "maxIterations": 2}
    }
    client.put(f"/api/projects/{pid}/config", json=config, headers=headers)

    job = client.post(f"/api/projects/{pid}/jobs", json={"job_name":"J", "mode":"sequential", "compute_type":"cpu"}, headers=headers).json()
    jid = job["id"]

    # iteration 0
    run_optimisation_task.run(jid)
    results_dir = tmp_path / "results" / pid / jid
    assert (results_dir / "iteration_0" / "designs.json").exists()
    status = client.get(f"/api/projects/{pid}/jobs/{jid}/status", headers=headers)
    assert status.json()["status"] == "running"

    # upload data for iteration 0
    dfile = tmp_path / "d0.json"
    dfile.write_text("{}")
    with dfile.open("rb") as f:
        client.post(f"/api/projects/{pid}/jobs/{jid}/data/iteration/0", files={"file": ("d0.json", f, "application/json")}, headers=headers)

    # iteration 1
    run_optimisation_task.run(jid)
    assert (results_dir / "iteration_1" / "designs.json").exists()

    dfile2 = tmp_path / "d1.json"
    dfile2.write_text("{}")
    with dfile2.open("rb") as f:
        client.post(f"/api/projects/{pid}/jobs/{jid}/data/iteration/1", files={"file": ("d1.json", f, "application/json")}, headers=headers)

    # final iteration triggers completion
    run_optimisation_task.run(jid)
    status = client.get(f"/api/projects/{pid}/jobs/{jid}/status", headers=headers)
    assert status.json()["status"] == "succeeded"
    assert (results_dir / "optimal.json").exists()
