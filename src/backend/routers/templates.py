from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import List
import os
import importlib.util

from template_models.templates import list_templates, get_template_schema

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("/", response_model=List[str])
def get_template_list():
    return list_templates()


@router.get("/{template_name}/schema")
def get_template_schema_endpoint(template_name: str):
    schema = get_template_schema(template_name)
    if schema is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return schema


@router.post("/upload", status_code=201)
async def upload_custom_model(project_id: str, file: UploadFile = File(...)):
    upload_dir = os.path.join("uploads", "models", project_id)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    try:
        spec = importlib.util.spec_from_file_location("custom_model", file_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error importing model: {e}")
    if not hasattr(module, "parameter_schema") or not callable(module.parameter_schema):
        raise HTTPException(status_code=400, detail="Model file must define a callable parameter_schema()")
    try:
        schema = module.parameter_schema()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"parameter_schema() raised error: {e}")
    if not isinstance(schema, dict) or "parameters" not in schema or not isinstance(schema["parameters"], list):
        raise HTTPException(status_code=400, detail="parameter_schema() must return a dict with a 'parameters' list")
    return {"schema": schema}
