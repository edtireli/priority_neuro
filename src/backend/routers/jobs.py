from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
import os

from dependencies import get_current_user, get_db
from models import Job, Project, JobStatus, RunMode, ComputeType
from schemas import JobCreate, JobOut, JobStatusOut
from celery_app import celery
from tasks import run_optimisation_task

router = APIRouter(prefix="/api/projects/{project_id}/jobs", tags=["jobs"])

@router.post("/", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    project_id: UUID,
    job_in: JobCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job = Job(
        project_id=project_id,
        job_name=job_in.job_name,
        mode=RunMode(job_in.mode),
        compute_type=ComputeType(job_in.compute_type),
        status=JobStatus.queued,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    run_optimisation_task.apply_async(args=[str(job.id)], task_id=str(job.id))
    return job

@router.get("/", response_model=list[JobOut])
def list_jobs(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Job).filter(Job.project_id == project_id).order_by(Job.submitted_at.desc()).all()

@router.get("/{job_id}/status", response_model=JobStatusOut)
def get_job_status(
    project_id: UUID,
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job or job.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/{job_id}/results")
def get_job_results(
    project_id: UUID,
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job or job.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.succeeded:
        raise HTTPException(status_code=400, detail="Results not available until job succeeds")
    if not job.result_location or not os.path.exists(job.result_location):
        raise HTTPException(status_code=500, detail="Result file missing")
    with open(job.result_location, "r") as f:
        data = f.read()
    return data

@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_job(
    project_id: UUID,
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job or job.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status in (JobStatus.succeeded, JobStatus.failed):
        raise HTTPException(status_code=400, detail="Cannot cancel a completed job")
    celery.control.revoke(str(job.id), terminate=True)
    job.status = JobStatus.failed
    db.commit()
    return
