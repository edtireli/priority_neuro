import importlib.util
from pathlib import Path
import sys

# Load models.py from parent directory only once to avoid re-defining ORM tables
module_name = "_models"
if module_name in sys.modules:
    _models = sys.modules[module_name]
else:
    _spec = importlib.util.spec_from_file_location(
        module_name, Path(__file__).resolve().parent.parent / "models.py"
    )
    _models = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_models)
    sys.modules[module_name] = _models

User = _models.User
Project = _models.Project
JobStatus = _models.JobStatus
ComputeType = _models.ComputeType
RunMode = _models.RunMode
Job = _models.Job
JobMetric = _models.JobMetric
JobResult = _models.JobResult

from .expressions import PsychometricModel, PoissonRateModel, BernoulliModel

__all__ = [
    "User",
    "Project",
    "JobStatus",
    "ComputeType",
    "RunMode",
    "Job",
    "JobMetric",
    "JobResult",
    "PsychometricModel",
    "PoissonRateModel",
    "BernoulliModel",
]
