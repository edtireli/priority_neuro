# Getting Started

This guide covers the basic setup required to run the backend and frontend locally.

## Backend
```bash
cd src/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # set DATABASE_URL and JWT_SECRET_KEY
alembic upgrade head
./run.sh
```

Launch Celery workers in separate processes:
```bash
redis-server &
cd src/backend && ./start-celery.sh &
```

If you're running macOS and encounter crashes related to `objc` when Celery
starts a task, set the environment variable:
```bash
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
```
This disables macOS's fork safety checks and prevents `SIGABRT` errors when new worker processes are spawned. The `start-celery.sh` helper script already sets this variable for you.

If a job fails, the full stack trace is stored in the `log` field of the job record. Check it for details when troubleshooting failed runs.

## Frontend
```bash
cd src/frontend
npm install
npm start
```

Open `http://localhost:3000` with the backend API running at `http://localhost:8000/api`.

For details on configuring projects and inspecting results see [usage.md](usage.md).
