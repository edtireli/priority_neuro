from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from uuid import UUID

from dependencies import get_db, get_current_user
from models import Project, User
from schemas import TrialDatum, NextDesign
import boed_utils

router = APIRouter(tags=["adaptive"])


@router.post("/data", status_code=status.HTTP_204_NO_CONTENT)
def upload_trial_data(
    project_id: UUID,
    payload: list[TrialDatum] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    trial_dicts = [d.model_dump() for d in payload]
    posterior = boed_utils.update_posterior(project_id, trial_dicts)
    project.current_posterior = posterior
    db.commit()
    return


@router.get("/next-design", response_model=NextDesign)
def get_next_design(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    posterior = project.current_posterior
    cfg = project.config_json or {}
    max_iters = cfg.get("maxIterations", 5)
    design = boed_utils.optimize_design_with_posterior(
        project_id, posterior, max_iterations=max_iters
    )
    return design
