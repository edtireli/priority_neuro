import os, sys, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['REDIS_URL'] = 'memory://'

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


def create_job(mode, cfg):
    db = TestingSessionLocal()
    unique_email = f"user_{uuid.uuid4()}@example.com"
    user = User(email=unique_email, full_name='A', institution='I', password_hash='x')
    db.add(user)
    db.commit()
    db.refresh(user)
    project = Project(user_id=user.id, name='P', description='', config_json=cfg)
    db.add(project)
    db.commit()
    db.refresh(project)
    job = Job(project_id=project.id, job_name='J', mode=mode, compute_type=ComputeType.cpu,
              status=JobStatus.queued, maxIterations=2 if mode==RunMode.sequential else None)
    db.add(job)
    db.commit()
    db.refresh(job)
    jid = str(job.id)
    db.close()
    return jid


def test_run_boed_job(monkeypatch):
    monkeypatch.setattr(tasks, 'SessionLocal', TestingSessionLocal)
    tasks.celery.conf.task_always_eager = True
    tasks.celery.conf.broker_url = 'memory://'
    tasks.celery.conf.result_backend = 'cache+memory://'

    monkeypatch.setattr(tasks, 'sample_design', lambda dv: {'x': 0.1})
    monkeypatch.setattr(tasks, 'simple_estimate_eig', lambda pri, d, m: 1.0)
    monkeypatch.setattr(tasks, 'optimize_design', lambda pri, dv, m: {'x': 0.2})

    base_cfg = {
        'metadata': {},
        'model': {},
        'groups': {},
        'priors': {},
        'designVariables': [{'name': 'x', 'type': 'continuous', 'range': [0,1]}],
        'objective': {},
        'constraints': {},
        'trialBudget': 3,
        'experimentalMode': 'batch',
    }
    single_id = create_job(RunMode.single_shot, base_cfg)
    tasks.run_boed_job.apply_async(args=[single_id], task_id=single_id).get()

    db = TestingSessionLocal()
    job = db.query(Job).get(uuid.UUID(single_id))
    assert job.status == JobStatus.succeeded
    metrics = db.query(tasks.JobMetric).filter(tasks.JobMetric.job_id==job.id).all()
    assert len(metrics) == 1
    assert metrics[0].utility == 1.0
    res = db.query(tasks.JobResult).filter(tasks.JobResult.job_id==job.id).first()
    assert res.summary['utility'] == 1.0
    db.close()

    seq_cfg = dict(base_cfg)
    seq_cfg['experimentalMode'] = 'sequential'
    seq_cfg['trialBudget'] = 2
    seq_id = create_job(RunMode.sequential, seq_cfg)
    tasks.run_boed_job.apply_async(args=[seq_id], task_id=seq_id).get()

    db = TestingSessionLocal()
    job2 = db.query(Job).get(uuid.UUID(seq_id))
    assert job2.status == JobStatus.succeeded
    metrics = db.query(tasks.JobMetric).filter(tasks.JobMetric.job_id==job2.id).order_by(tasks.JobMetric.iteration).all()
    assert len(metrics) == 2
    assert metrics[0].iteration == 1
    assert metrics[1].iteration == 2
    result = db.query(tasks.JobResult).filter(tasks.JobResult.job_id==job2.id).first()
    assert result.summary['best_design'] == {'x': 0.2}
    db.close()
