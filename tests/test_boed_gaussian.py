import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Project, Job, User, RunMode, ComputeType, JobStatus
import tasks

@pytest.fixture(scope="function")
def db_session(monkeypatch):
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    engine = create_engine(
        os.environ["DATABASE_URL"],
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(tasks, "SessionLocal", TestingSessionLocal)
    tasks.celery.conf.task_always_eager = True
    yield TestingSessionLocal
    Base.metadata.drop_all(bind=engine)

class GaussianModel:
    def __init__(self, parameter_specs, design_name="x"):
        pass

    def simulate(self, theta: dict, design: dict):
        import numpy as np
        return float(np.random.normal(theta["mean"], np.sqrt(theta["variance"])) )

    def log_likelihood(self, data, theta: dict, design: dict) -> float:
        import numpy as np
        var = theta["variance"]
        return -0.5 * (((data - theta["mean"]) ** 2) / var + np.log(2 * np.pi * var))

@pytest.fixture(scope="function")
def gaussian_patch(monkeypatch):
    monkeypatch.setattr(tasks, "PoissonRateModel", GaussianModel)


def test_gaussian_boed_simulation(db_session, gaussian_patch):
    db = db_session()
    user = User(email="g@e.com", full_name="G", institution="I", password_hash="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    config = {
        "model": {
            "type": "built-in",
            "templateName": "gaussian",
            "parameters": [
                {"name": "mean", "type": "float", "default_prior": {"dist": "Normal", "mean": 0.0, "sd": 1.0}},
                {"name": "variance", "type": "float", "default_prior": {"dist": "Gamma", "shape": 2.0, "scale": 1.0}},
            ],
        },
        "priors": {
            "mean": {"dist": "Normal", "mean": 0.0, "sd": 1.0},
            "variance": {"dist": "Gamma", "shape": 2.0, "scale": 1.0},
        },
        "designVariables": [{"name": "x", "type": "continuous", "range": [0.0, 1.0]}],
        "trialBudget": 3,
    }

    project = Project(user_id=user.id, name="P", description="", config_json=config)
    db.add(project)
    db.commit()
    db.refresh(project)

    job = Job(project_id=project.id, job_name="J", mode=RunMode.single_shot, compute_type=ComputeType.cpu, status=JobStatus.queued)
    db.add(job)
    db.commit()
    db.refresh(job)
    job_id = str(job.id)
    db.close()

    tasks.run_boed_job.run(job_id)

    db = db_session()
    updated_job = db.query(Job).filter(Job.id == job.id).first()
    assert updated_job.status == JobStatus.succeeded

    metrics = db.query(tasks.JobMetric).filter(tasks.JobMetric.job_id == job.id).all()
    assert len(metrics) > 1

    result = db.query(tasks.JobResult).filter(tasks.JobResult.job_id == job.id).first()
    assert "mean" in result.summary["posterior"] and "variance" in result.summary["posterior"]
    db.close()
