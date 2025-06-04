#!/usr/bin/env bash
# Start Celery worker
cd "$(dirname "$0")"
celery -A celery_app.celery worker --loglevel=info
