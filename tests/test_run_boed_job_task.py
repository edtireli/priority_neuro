import os, sys, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Project, Job, User, RunMode, ComputeType, JobStatus
import tasks

engine = create_engine(os.environ['DATABASE_URL'], connect_args={'check_same_thread': False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_run_boed_job_updates_status(monkeypatch):
    monkeypatch.setattr(tasks, 'SessionLocal', TestingSessionLocal)
    tasks.celery.conf.task_always_eager = True

    db = TestingSessionLocal()
    user = User(email='a@b.com', full_name='A', institution='I', password_hash='x')
    db.add(user)
    db.commit()
    db.refresh(user)
    project = Project(user_id=user.id, name='P', description='', config_json={})
    db.add(project)
    db.commit()
    db.refresh(project)
    job = Job(project_id=project.id, job_name='J', mode=RunMode.single_shot, compute_type=ComputeType.cpu, status=JobStatus.queued)
    db.add(job)
    db.commit()
    db.refresh(job)
    jid = str(job.id)
    db.close()

    tasks.run_boed_job.apply_async(args=[jid], task_id=jid).get()

    db = TestingSessionLocal()
    updated = db.query(Job).filter(Job.id == job.id).first()
    assert updated.status == JobStatus.running
    assert updated.started_at is not None
    db.close()


def test_run_boed_job_records_metrics(monkeypatch):
    monkeypatch.setattr(tasks, 'SessionLocal', TestingSessionLocal)
    tasks.celery.conf.task_always_eager = True

    db = TestingSessionLocal()
    user = User(email='b@c.com', full_name='B', institution='I', password_hash='x')
    db.add(user)
    db.commit()
    db.refresh(user)
    config = {
        'model': {'type': 'built-in', 'templateName': 'psychometric', 'parameters': []},
        'priors': {'threshold': {'dist': 'Normal', 'mean': 0.0, 'sd': 1.0}},
        'designVariables': [{'name': 'x', 'type': 'continuous', 'range': [0.0, 1.0]}],
        'trialBudget': 2
    }
    project = Project(user_id=user.id, name='P2', description='', config_json=config)
    db.add(project)
    db.commit()
    db.refresh(project)
    job = Job(project_id=project.id, job_name='J2', mode=RunMode.single_shot, compute_type=ComputeType.cpu, status=JobStatus.queued)
    db.add(job)
    db.commit()
    db.refresh(job)
    jid = str(job.id)
    db.close()

    tasks.run_boed_job.apply_async(args=[jid], task_id=jid).get()

    db = TestingSessionLocal()
    metrics = db.query(tasks.JobMetric).filter(tasks.JobMetric.job_id == job.id).order_by(tasks.JobMetric.iteration).all()
    assert len(metrics) == 2
    assert metrics[0].iteration == 1
    assert metrics[0].utility == 0.0
    assert 'threshold' in metrics[0].posterior_summary
    db.close()
