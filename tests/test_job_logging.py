import os, json, sys
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
import tasks
from models import User

engine = create_engine(os.environ["DATABASE_URL"], connect_args={"check_same_thread": False}, poolclass=StaticPool)
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
    monkeypatch.setattr(tasks, "SessionLocal", TestingSessionLocal)
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr("routers.jobs.run_boed_job.apply_async", lambda *a, **k: None)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def get_token(client):
    client.post("/api/auth/register", json={"email":"t2@example.com","full_name":"T","institution":"I","password":"pass"})
    db = TestingSessionLocal()
    token_val = db.query(User).filter(User.email == "t2@example.com").first().verification_token
    db.close()
    client.post("/api/auth/verify", json={"token": token_val})
    login = client.post("/api/auth/login", json={"email":"t2@example.com","password":"pass"})
    return login.json()["access_token"]

def setup_project(client, headers):
    proj = client.post("/api/projects", json={"name":"P","description":""}, headers=headers).json()
    pid = proj["id"]
    config = {"metadata":{"name":"P","description":""},
              "model":{"type":"built-in","templateName":"psychometric","parameters":[{"name":"t","type":"float","default_prior":{"dist":"Normal","mean":0,"sd":1}}]},
              "priors":{"t":{"dist":"Normal","mean":0,"sd":1}},
              "designVariables":[{"name":"x","type":"continuous","range":[0,1]}],
              "objective":{"type":"information_gain"},
              "constraints":{"sampleSize":10,"trialLimit":50,"costWeights":{"subject":1,"trial":1,"session":1}},
              "experimentalMode":"batch"}
    client.put(f"/api/projects/{pid}/config", json=config, headers=headers)
    return pid, config

def test_exception_logging(client, monkeypatch):
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pid, cfg = setup_project(client, headers)

    def boom(*a, **k):
        raise ZeroDivisionError("boom")

    monkeypatch.setattr(tasks, "optimize_design", boom)
    job = client.post(
        f"/api/projects/{pid}/jobs",
        data={"config": json.dumps(cfg)},
        headers=headers,
    ).json()
    jid = job["id"]
    tasks.run_optimisation_task.run(jid)

    status = client.get(f"/api/projects/{pid}/jobs/{jid}/status", headers=headers).json()
    assert status["status"] == "failed"
    assert "ZeroDivisionError" in status["log"]

def test_memory_error_logging(client, monkeypatch):
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pid, cfg = setup_project(client, headers)

    def oom(*a, **k):
        raise MemoryError("oom")

    monkeypatch.setattr(tasks, "train_flow", oom)
    job = client.post(
        f"/api/projects/{pid}/jobs",
        data={"config": json.dumps(cfg)},
        headers=headers,
    ).json()
    jid = job["id"]
    tasks.run_optimisation_task.run(jid)

    status = client.get(f"/api/projects/{pid}/jobs/{jid}/status", headers=headers).json()
    assert status["status"] == "failed"
    assert "Out of memory" in status["log"]
