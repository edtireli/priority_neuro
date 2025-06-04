from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/")
async def read_root():
    """Default welcome route."""
    return {"message": "Hello World"}
