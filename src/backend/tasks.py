import os
import json
from datetime import datetime
import uuid
from celery_app import celery
from database import SessionLocal
from models import Job, Project, JobStatus
from sqlalchemy.orm import Session

RESULTS_ROOT = os.getenv("RESULTS_ROOT", "results")

@celery.task(bind=True)
def run_optimisation_task(self, job_id_str: str):
    db: Session = SessionLocal()
    job = None
    try:
        job_id = uuid.UUID(job_id_str)
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        job.status = JobStatus.running
        job.started_at = datetime.utcnow()
        db.commit()

        project = db.query(Project).filter(Project.id == job.project_id).first()
        config = project.config_json

        optimal_design = {}
        for dv in config["designVariables"]:
            name = dv["name"]
            if dv["type"] == "continuous":
                lo, hi = dv["range"]
                optimal_design[name] = (lo + hi) / 2
            else:
                optimal_design[name] = dv["values"][0]

        result = {
            "job_id": job_id_str,
            "project_id": str(project.id),
            "optimalDesign": optimal_design,
            "status": "succeeded",
            "timestamp": datetime.utcnow().isoformat()
        }

        results_dir = os.path.join(RESULTS_ROOT, str(project.id), str(job.id))
        os.makedirs(results_dir, exist_ok=True)
        result_path = os.path.join(results_dir, "result.json")
        with open(result_path, "w") as f:
            json.dump(result, f, indent=2)

        job.status = JobStatus.succeeded
        job.completed_at = datetime.utcnow()
        job.result_location = result_path
        db.commit()
    except Exception as e:
        if job:
            job.status = JobStatus.failed
            job.completed_at = datetime.utcnow()
            job.log = str(e)
            db.commit()
    finally:
        db.close()
