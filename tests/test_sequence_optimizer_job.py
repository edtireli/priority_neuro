import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Project, Job, User, JobStatus, RunMode, ComputeType, JobMetric, JobResult
import sequence_optimizer as so

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


class DummyBernoulli(so.BernoulliModel):
    pass


def create_entities(cfg):
    db = TestingSessionLocal()
    user = User(email=f"{uuid.uuid4()}@x.com", full_name="U", institution="I", password_hash="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    project = Project(user_id=user.id, name="P", description="", config_json=cfg)
    db.add(project)
    db.commit()
    db.refresh(project)
    job = Job(project_id=project.id, job_name="J", mode=RunMode.single_shot, compute_type=ComputeType.cpu, status=JobStatus.queued)
    db.add(job)
    db.commit()
    db.refresh(job)
    return db, job, project


def test_run_sequence_optimizer_job(monkeypatch):
    cfg = {
        "model": {},
        "priors": {"p": {"dist": "Uniform", "low": 0.2, "high": 0.8}},
        "designVariables": [],
        "objective": {"type": "sequence_optimization", "options": {"sequenceSettings": {}}},
    }
    seq_opts = {
        "agentType": "thompson",
        "explorationRate": 0.0,
        "enableGPSurrogate": False,
        "trialBudget": 10,
        "stateWindow": 1,
        "terminationCriterion": {"type": "trials_to_threshold", "threshold": 1},
    }

    monkeypatch.setattr(so, "load_model", lambda cfg, jid: DummyBernoulli([]))
    monkeypatch.setattr(so, "sample_from_prior", lambda p: {"p": 0.5})

    db, job, project = create_entities(cfg)
    so.run_sequence_optimization_job(job, project, cfg, seq_opts, db)

    metrics = db.query(JobMetric).filter(JobMetric.job_id == job.id).all()
    assert len(metrics) <= seq_opts["trialBudget"]
    result = db.query(JobResult).filter(JobResult.job_id == job.id).first()
    assert result is not None
    assert "best_sequence" in result.summary and "best_reward" in result.summary
    db.close()
