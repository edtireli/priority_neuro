#!/usr/bin/env bash
# Start Celery worker
cd "$(dirname "$0")"
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
celery -A celery_app.celery worker --loglevel=info
