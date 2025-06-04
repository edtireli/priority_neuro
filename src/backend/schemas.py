from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime


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
