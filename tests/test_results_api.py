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
from models import User, JobStatus, RunMode, ComputeType, Project, Job
import uuid
import tasks
import sequence_optimizer as so

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


def auth_token(client):
    client.post(
        "/api/auth/register",
        json={"email": "u@x.com", "full_name": "U", "institution": "I", "password": "pass"},
    )
    db = TestingSessionLocal()
    token_val = db.query(User).filter(User.email == "u@x.com").first().verification_token
    db.close()
    client.post("/api/auth/verify", json={"token": token_val})
    login = client.post("/api/auth/login", json={"email": "u@x.com", "password": "pass"})
    return login.json()["access_token"]


class DummyModel:
    def simulate(self, *a, **k):
        return 1.0
    def log_likelihood(self, *a, **k):
        return 0.0


def test_results_api_fields(client, monkeypatch):
    token = auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    proj = client.post("/api/projects", json={"name": "P", "description": ""}, headers=headers).json()
    pid = proj["id"]
    cfg = {
        "model": {},
        "priors": {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}},
        "designVariables": [],
        "objective": {"type": "sequence_optimization", "options": {"sequenceSettings": {}}},
    }
    client.put(f"/api/projects/{pid}/config", json=cfg, headers=headers)
    job = client.post(
        f"/api/projects/{pid}/jobs",
        data={"config": json.dumps(cfg)},
        headers=headers,
    ).json()
    jid = job["id"]

    def fake_optimize(*a, **k):
        return ([{}], [{"iteration": 1, "design_point": {}, "simulated_perf": 1.0, "posterior_samples": [{"p": 0.5}]}])

    monkeypatch.setattr(so, "optimize_sequence_local", fake_optimize)
    monkeypatch.setattr(so, "load_model", lambda cfg, jid: DummyModel())
    monkeypatch.setattr(so, "sample_from_prior", lambda pri: {"p": 0.5})

    db = TestingSessionLocal()
    job_obj = db.query(Job).get(uuid.UUID(jid))
    proj_obj = db.query(Project).get(uuid.UUID(pid))
    so.run_sequence_optimization_job(job_obj, proj_obj, cfg, {"trialBudget": 1}, db)
    db.close()

    res = client.get(f"/api/projects/{pid}/jobs/{jid}/results", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "initialPosterior" in data
    assert "simulationHistory" in data
