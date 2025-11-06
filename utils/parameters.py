"""Helpers for discovering analysis artefacts associated with a dataset."""

from __future__ import annotations

import os
from typing import Iterable, List


def _list_files(directory: str) -> List[str]:
    try:
        entries = sorted(os.listdir(directory))
    except FileNotFoundError:
        return []

    result: List[str] = []
    for name in entries:
        path = os.path.join(directory, name)
        if os.path.isfile(path):
            result.append(name)
    return result


def _prioritise_dce(filenames: Iterable[str]) -> List[str]:
    filenames = list(filenames)
    dce_files = [name for name in filenames if "dce" in name.lower()]
    non_dce_files = [name for name in filenames if name not in dce_files]
    return non_dce_files + sorted(dce_files)


def global_filenames(nifti_directory: str) -> List[str]:
    """Return filenames for general datasets ordered with DCE artefacts last."""

    return _prioritise_dce(_list_files(nifti_directory))


def control_filenames(nifti_directory: str) -> List[str]:
    """Return filenames for control datasets ordered with DCE artefacts last."""

    return _prioritise_dce(_list_files(nifti_directory))
