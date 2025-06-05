import uuid
from sqlalchemy import Column, String, Boolean, DateTime, func, Text, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from database import Base
import enum

class User(Base):
    __tablename__ = "users"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    institution = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Project(Base):
    __tablename__ = "projects"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    config_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    jobs = relationship("Job", back_populates="project", cascade="all, delete-orphan")


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class ComputeType(str, enum.Enum):
    cpu = "cpu"
    gpu = "gpu"


class RunMode(str, enum.Enum):
    single_shot = "single_shot"
    sequential = "sequential"


class Job(Base):
    __tablename__ = "jobs"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    job_name = Column(String, nullable=False)
    mode = Column(Enum(RunMode), nullable=False, default=RunMode.single_shot)
    compute_type = Column(Enum(ComputeType), nullable=False, default=ComputeType.cpu)
    status = Column(Enum(JobStatus), nullable=False, default=JobStatus.queued)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    result_location = Column(String, nullable=True)
    log = Column(String, nullable=True, default="")

    project = relationship("Project", back_populates="jobs")
