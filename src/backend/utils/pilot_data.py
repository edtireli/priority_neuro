import os
import json
import csv
import io
import uuid
from typing import Any


def persist_pilot_json(data: bytes, job_id: uuid.UUID, uploads_root: str) -> str:
    """Parse CSV or JSON pilot data bytes and save iteration_0.json."""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("Pilot data is not valid UTF-8") from exc
    stripped = text.lstrip()
    if stripped.startswith("[") or stripped.startswith("{"):
        obj = json.loads(text)
        rows = obj if isinstance(obj, list) else [obj]
    else:
        try:
            reader = csv.DictReader(io.StringIO(text))
            rows = [row for row in reader]
        except csv.Error as exc:
            raise ValueError(f"Invalid pilot CSV: {exc}") from exc
    data_dir = os.path.join(uploads_root, "data", str(job_id))
    os.makedirs(data_dir, exist_ok=True)
    json_path = os.path.join(data_dir, "iteration_0.json")
    with open(json_path, "w") as f:
        json.dump(rows, f, indent=2)
    return json_path
