"""Configuration helpers for the batch processing scripts."""

from __future__ import annotations

import os
from functools import lru_cache


def _parse_bool(value: str | None) -> bool:
    if value is None:
        return False
    value = value.strip().lower()
    return value in {"1", "true", "yes", "y", "on"}


@lru_cache()
def _environment_default(name: str, *, fallback: str = "0") -> bool:
    return _parse_bool(os.getenv(name, fallback))


#: Whether control datasets should be treated as the default mode of
#: operation.  The flag mirrors the environment variable used by the main
#: pipeline so that ``enumerator.py`` behaves consistently when launched
#: from automation.
CONTROLS: bool = _environment_default("PBRAIN_CONTROLS")
