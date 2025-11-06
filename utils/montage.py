"""Montage rendering utilities with automatic colour scaling."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterator, Mapping, Optional, Sequence, Tuple

import numpy as np

try:  # pragma: no cover - matplotlib is optional in CI environments
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception:  # pragma: no cover - fallback when matplotlib is missing
    plt = None

try:  # pragma: no cover - nibabel is an optional dependency
    import nibabel as nib
except Exception:  # pragma: no cover
    nib = None


@dataclass
class MapJob:
    """Describe a montage to be rendered from an analysis artefact."""

    analysis_key: str
    output_prefix: str
    vmin: Optional[float] = None
    vmax: Optional[float] = None
    mask_zero: bool = False
    output_ext: str = ".png"


MAP_JOBS: Sequence[MapJob] = (
    MapJob("CBF_per_voxel_tikhonov", "cbf_montage"),
    MapJob("CBF_tikhonov_map_atlas", "cbf_parcel_montage"),
    MapJob("mtt_map", "mtt_montage"),
    MapJob("MTT_tikhonov_map_atlas", "mtt_parcel_montage"),
    MapJob("cth_map", "cth_montage"),
    MapJob("CTH_tikhonov_map_atlas", "cth_parcel_montage"),
    MapJob("Ki_per_voxel", "ki_voxel_montage", mask_zero=True),
    MapJob("Ki_map_atlas", "ki_atlas_montage", mask_zero=True),
    MapJob("vp_map_atlas", "vp_atlas_montage"),
    MapJob("vp_per_voxel", "vp_per_voxel", mask_zero=True, output_ext=".png"),
)


def _resolve_analysis_file(analysis_directory: str, job: MapJob) -> Optional[Path]:
    base = Path(analysis_directory)
    if not base.exists():
        return None
    explicit_extensions = [".npy", ".npz", ".nii", ".nii.gz"]
    for extension in explicit_extensions:
        candidate = base / f"{job.analysis_key}{extension}"
        if candidate.exists():
            return candidate
    matches = sorted(base.glob(f"{job.analysis_key}*"))
    if matches:
        return matches[0]
    return None


def _load_volume(path: Path) -> np.ndarray:
    suffix = path.suffix.lower()
    if suffix == ".gz" and path.name.endswith(".nii.gz"):
        suffix = ".nii.gz"

    if suffix in {".npy", ".npz"}:
        data = np.load(path)
        if isinstance(data, np.lib.npyio.NpzFile):
            first_key = next(iter(data.keys()))
            return np.asarray(data[first_key])
        return np.asarray(data)

    if suffix in {".nii", ".nii.gz"}:
        if nib is None:
            raise RuntimeError(
                "nibabel is required to load NIfTI files but is not available in this environment"
            )
        image = nib.load(str(path))
        return np.asarray(image.get_fdata())

    raise RuntimeError(f"Unsupported analysis file format: {path.suffix}")


def _collapse_to_2d(volume: np.ndarray) -> np.ndarray:
    data = np.asarray(volume)
    if data.ndim == 0:
        return data.reshape(1, 1)
    while data.ndim > 2:
        index = data.shape[0] // 2
        data = data[index]
    if data.ndim == 1:
        data = data.reshape(1, -1)
    return data


def _normalise(data: np.ndarray, *, vmin: float, vmax: float) -> np.ndarray:
    if math.isclose(vmin, vmax):
        span = abs(vmax) or 1.0
        vmin -= span * 0.05
        vmax += span * 0.05
    clipped = np.clip(data, vmin, vmax)
    normalised = (clipped - vmin) / (vmax - vmin)
    return (normalised * 255).astype(np.uint8)


def _mask_invalid_values(data: np.ndarray, *, mask_zero: bool) -> np.ndarray:
    mask = np.isfinite(data)
    if mask_zero:
        mask &= data != 0
    return data[mask]


def _auto_range(data: np.ndarray, *, mask_zero: bool) -> Tuple[float, float]:
    filtered = _mask_invalid_values(data, mask_zero=mask_zero)
    if filtered.size == 0:
        return 0.0, 1.0
    return float(np.min(filtered)), float(np.max(filtered))


def _render_colourmap(
    data: np.ndarray,
    output_path: Path,
    *,
    vmin: float,
    vmax: float,
) -> None:
    data2d = _collapse_to_2d(data)
    if plt is None:  # pragma: no cover - fallback path for headless environments
        normalised = _normalise(data2d, vmin=vmin, vmax=vmax)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        np.save(output_path.with_suffix(".npy"), normalised)
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(5, 5))
    im = ax.imshow(data2d, cmap="viridis", vmin=vmin, vmax=vmax)
    ax.axis("off")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def generate_parametric_montages(
    analysis_directory: str,
    image_directory: str,
    dce_path: str,
) -> None:
    del dce_path  # The current implementation does not require the DCE volume.

    for job in MAP_JOBS:
        analysis_file = _resolve_analysis_file(analysis_directory, job)
        if analysis_file is None:
            print(f"[montage] Analysis artefact missing for {job.analysis_key}")
            continue

        try:
            data = _load_volume(analysis_file)
        except Exception as exc:  # noqa: BLE001
            print(f"[montage] Failed to load {analysis_file}: {exc}")
            continue

        vmin = job.vmin
        vmax = job.vmax
        if vmin is None or vmax is None:
            vmin, vmax = _auto_range(data, mask_zero=job.mask_zero)
        if math.isclose(vmin, vmax):
            span = abs(vmax) or 1.0
            vmin -= span * 0.05
            vmax += span * 0.05

        output_name = f"{job.output_prefix}{job.output_ext}"
        output_path = Path(image_directory) / output_name
        try:
            _render_colourmap(data, output_path, vmin=vmin, vmax=vmax)
        except Exception as exc:  # noqa: BLE001
            print(f"[montage] Failed to render {output_name}: {exc}")


def generate_projection_montages(
    analysis_directory: str,
    image_directory: str,
    nifti_directory: str,
    dce_path: str,
    *,
    population_stats: Optional[Mapping[str, Tuple[float, float]]] = None,
) -> bool:
    del analysis_directory, nifti_directory, dce_path
    if population_stats:
        Path(image_directory).mkdir(parents=True, exist_ok=True)
        stats_file = Path(image_directory) / "projection_stats.txt"
        lines = [f"{key}: {value[0]:.4f}, {value[1]:.4f}" for key, value in sorted(population_stats.items())]
        stats_file.write_text("\n".join(lines))
    return True


def build_population_projection_stats(
    data_directory: str,
    *,
    include_controls: bool = False,
) -> Mapping[str, Tuple[float, float]]:
    stats: Dict[str, Tuple[float, float]] = {}
    root = Path(data_directory)
    if not root.exists():
        return stats

    def dataset_directories() -> Iterator[Path]:
        for entry in root.iterdir():
            if not entry.is_dir():
                continue
            if entry.name == "controls":
                if include_controls:
                    for control in entry.iterdir():
                        if control.is_dir():
                            yield control
                continue
            yield entry

    for dataset_dir in dataset_directories():
        analysis_dir = dataset_dir / "Analysis"
        if not analysis_dir.exists():
            continue
        for job in MAP_JOBS:
            analysis_file = _resolve_analysis_file(str(analysis_dir), job)
            if analysis_file is None:
                continue
            try:
                data = _load_volume(analysis_file)
            except Exception:  # noqa: BLE001
                continue
            vmin, vmax = _auto_range(data, mask_zero=job.mask_zero)
            existing = stats.get(job.analysis_key)
            if existing is None:
                stats[job.analysis_key] = (vmin, vmax)
            else:
                stats[job.analysis_key] = (
                    min(existing[0], vmin),
                    max(existing[1], vmax),
                )

    return stats
