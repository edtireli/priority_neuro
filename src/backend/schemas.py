from pydantic import BaseModel, EmailStr, Field, validator, RootModel
from uuid import UUID
from datetime import datetime
from typing import Literal, List, Dict, Any


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    institution: str | None = None
    password: str


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    institution: str | None
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    sub: UUID | None = None


class VerificationToken(BaseModel):
    token: str = Field(..., example="uuid4-token-here")


class MessageOut(BaseModel):
    message: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: str | None
    config_json: dict | None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ModelConfig(BaseModel):
    type: Literal["built-in", "custom"]
    templateName: str | None = None
    customFileName: str | None = None
    parameters: List[Dict[str, Any]]

    @validator("templateName", always=True)
    def require_template_name_if_built_in(cls, v, values):
        if values.get("type") == "built-in" and not v:
            raise ValueError("templateName is required for built-in models")
        return v

    @validator("customFileName", always=True)
    def require_custom_file_if_custom(cls, v, values):
        if values.get("type") == "custom" and not v:
            raise ValueError("customFileName is required for custom models")
        return v


from pydantic import RootModel


class PriorMap(RootModel[Dict[str, Dict[str, Any]]]):
    pass


class DesignVariable(BaseModel):
    name: str
    type: Literal["continuous", "discrete"]
    range: List[float] | None = None
    values: List[str] | None = None
    units: str | None = None

    @validator("range", always=True)
    def check_range_for_continuous(cls, v, values):
        if values.get("type") == "continuous":
            if not v or len(v) != 2:
                raise ValueError("range [min, max] required for continuous variables")
            if v[0] >= v[1]:
                raise ValueError("range min must be less than max")
        return v

    @validator("values", always=True)
    def check_values_for_discrete(cls, v, values):
        if values.get("type") == "discrete" and (not v or len(v) < 1):
            raise ValueError("at least one value required for discrete variables")
        return v


class ObjectiveConfig(BaseModel):
    type: Literal["group_separation", "information_gain", "training_efficiency"]
    options: Dict[str, Any] | None = None


class ConstraintsConfig(BaseModel):
    sampleSize: int | None = None
    trialLimit: int | None = None
    costWeights: Dict[Literal["subject", "trial", "session"], float]

    @validator("sampleSize", "trialLimit")
    def non_negative_int(cls, v):
        if v is not None and v < 0:
            raise ValueError("must be non-negative")
        return v


class ProjectConfig(BaseModel):
    metadata: Dict[Literal["name", "description"], str | None]
    model: ModelConfig
    priors: PriorMap
    designVariables: List[DesignVariable]
    objective: ObjectiveConfig
    constraints: ConstraintsConfig


class JobCreate(BaseModel):
    job_name: str
    mode: Literal["single_shot", "sequential"]
    compute_type: Literal["cpu", "gpu"]
    advanced_options: Dict[str, Any] | None = None


class JobOut(BaseModel):
    id: UUID
    project_id: UUID
    job_name: str
    mode: Literal["single_shot", "sequential"]
    compute_type: Literal["cpu", "gpu"]
    status: Literal["queued", "running", "succeeded", "failed"]
    submitted_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    class Config:
        orm_mode = True


class JobStatusOut(BaseModel):
    id: UUID
    status: Literal["queued", "running", "succeeded", "failed"]
    submitted_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    log: str
