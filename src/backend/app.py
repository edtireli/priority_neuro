from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
async def health_check():
    """Simple endpoint used by deployment platforms to check service status."""
    return {"status": "ok"}


@app.get("/")
async def read_root():
    """Default welcome route."""
    return {"message": "Hello World"}
