from dotenv import load_dotenv
load_dotenv()
import os
DEVELOPER_MODE = os.getenv("DEVELOPER_MODE", "false").lower() in ("1", "true", "yes")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.auth import router as auth_router
from routers.projects import router as projects_router
from routers.templates import router as templates_router
from routers.jobs import router as jobs_router
from routers.data import router as data_router

app = FastAPI()

origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Simple endpoint used by deployment platforms to check service status."""
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(templates_router)
app.include_router(jobs_router)
app.include_router(data_router)
