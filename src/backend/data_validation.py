import csv
import json
import io
from fastapi import HTTPException


def validate_pilot_data(data: bytes, design_vars):
    """Validate uploaded pilot data against expected design variables.

    Supports CSV and JSON list formats. Each record must include all design
    variable names and a "y" column containing the observed response.
    """
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Data file must be UTF-8 text")

    expected = {dv["name"] for dv in design_vars}
    expected.add("y")

    stripped = text.lstrip()
    if stripped.startswith("[") or stripped.startswith("{"):
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format")
        rows = obj if isinstance(obj, list) else [obj]
        if not rows:
            raise HTTPException(status_code=400, detail="No data rows found")
        keys = set(rows[0].keys())
        missing = expected - keys
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(sorted(missing))}")
        return

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV must have header row")
    keys = set(reader.fieldnames)
    missing = expected - keys
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(sorted(missing))}")
    if not any(True for _ in reader):
        raise HTTPException(status_code=400, detail="No data rows found")
