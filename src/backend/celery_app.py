import multiprocessing as mp
mp.set_start_method("spawn", force=True)
import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Determine the correct tasks module path based on how this file is imported.
# When ``celery_app`` is imported as ``src.backend.celery_app`` the tasks live in
# ``src.backend.tasks``.  If the module is imported as ``celery_app`` (e.g. when
# executed from ``src/backend``) the tasks module is simply ``tasks``.
package = __package__ or ""
include_modules = [f"{package}.tasks" if package else "tasks"]

celery = Celery(
    "bmbr",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=include_modules,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
