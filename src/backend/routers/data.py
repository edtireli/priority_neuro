from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from uuid import UUID
import os, json
from sqlalchemy.orm import Session

from dependencies import get_db, get_current_user
from models import Job, RunMode

router = APIRouter(prefix="/api/projects/{project_id}/jobs/{job_id}/data", tags=["data"])

@router.post("/iteration/{iter_number}", status_code=201)
async def upload_iteration_data(
    project_id: UUID,
    job_id: UUID,
    iter_number: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job or job.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.mode != RunMode.sequential:
        raise HTTPException(status_code=400, detail="Job not in sequential mode")
    if iter_number != job.iteration - 1:
        raise HTTPException(status_code=400, detail="Unexpected iteration number")
    upload_dir = os.path.join("uploads", "data", str(job_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"iteration_{iter_number}.json")
    with open(file_path, "wb") as f:
        data = await file.read()
        f.write(data)
    return {"stored": file_path}
