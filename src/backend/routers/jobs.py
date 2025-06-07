from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID
import os
import json

from dependencies import get_current_user, get_db
from models import Job, Project, JobStatus, RunMode, ComputeType
from schemas import JobOut, JobStatusOut
from celery_app import celery
from tasks import run_optimisation_task

router = APIRouter(prefix="/api/projects/{project_id}/jobs", tags=["jobs"])

@router.post("/", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    project_id: UUID,
    config: str = Form(...),
    pilot_data: UploadFile | None = File(None),
    custom_model: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        cfg = json.loads(config)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid config JSON")

    project.config_json = cfg
    db.commit()

    mode_val = cfg.get("experimentalMode", "batch")
    run_mode = RunMode.sequential if mode_val == "sequential" else RunMode.single_shot
    compute = ComputeType(cfg.get("computeType", "cpu"))
    job_name = cfg.get("metadata", {}).get("name", "Job")

    status_val = JobStatus.queued
    if run_mode == RunMode.sequential and pilot_data is None:
        status_val = JobStatus.paused_awaiting_data

    job = Job(
        project_id=project_id,
        job_name=job_name,
        mode=run_mode,
        compute_type=compute,
        status=status_val,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    uploads_root = os.getenv("UPLOADS_ROOT", "uploads")
    if custom_model:
        model_dir = os.path.join(uploads_root, "custom_models", str(job.id))
        os.makedirs(model_dir, exist_ok=True)
        file_path = os.path.join(model_dir, custom_model.filename)
        with open(file_path, "wb") as f:
            f.write(await custom_model.read())

    if pilot_data:
        data_dir = os.path.join(uploads_root, "pilot_data")
        os.makedirs(data_dir, exist_ok=True)
        file_path = os.path.join(data_dir, f"{job.id}.csv")
        with open(file_path, "wb") as f:
            f.write(await pilot_data.read())

    if status_val == JobStatus.queued:
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


@router.post("/{job_id}/data", response_model=JobOut)
async def upload_pilot_data(
    project_id: UUID,
    job_id: UUID,
    pilot_data: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job or job.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.paused_awaiting_data:
        raise HTTPException(status_code=400, detail="Job is not awaiting data")

    uploads_root = os.getenv("UPLOADS_ROOT", "uploads")
    data_dir = os.path.join(uploads_root, "pilot_data")
    os.makedirs(data_dir, exist_ok=True)
    file_path = os.path.join(data_dir, f"{job.id}.csv")
    with open(file_path, "wb") as f:
        f.write(await pilot_data.read())

    job.status = JobStatus.queued
    db.commit()
    run_optimisation_task.apply_async(args=[str(job.id)], task_id=str(job.id))
    db.refresh(job)
    return job

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
    result_path = os.path.join(job.results_folder or "", "result.json")
    if not job.results_folder or not os.path.exists(result_path):
        raise HTTPException(status_code=500, detail="Result file missing")
    with open(result_path, "r") as f:
        data = f.read()
    return data


@router.get("/{job_id}/results-detailed")
def get_job_results_detailed(
    project_id: UUID,
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job or job.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.succeeded:
        raise HTTPException(status_code=400, detail="Results not available until job succeeds")
    if not job.results_folder:
        raise HTTPException(status_code=500, detail="Result file missing")
    detailed_path = os.path.join(job.results_folder, "result_detailed.json")
    if not os.path.exists(detailed_path):
        raise HTTPException(status_code=500, detail="Detailed result file missing")
    with open(detailed_path, "r") as f:
        return json.load(f)

@router.get("/{job_id}/log")
def get_job_log(
    project_id: UUID,
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job or job.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"log": job.log or ""}

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
    job.log = (job.log or "") + "\nJob was cancelled by user."
    db.commit()
    return
