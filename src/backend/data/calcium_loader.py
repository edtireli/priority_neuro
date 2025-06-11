import numpy as np
from typing import Literal

try:
    from pynwb import NWBHDF5IO
except Exception:  # pragma: no cover - optional dependency
    NWBHDF5IO = None  # type: ignore

try:
    from tifffile import imread
except Exception:  # pragma: no cover - optional dependency
    imread = None  # type: ignore


def load_calcium_data(path: str, format: Literal["NWB", "TIFF"]) -> dict:
    """Load calcium imaging data from an NWB file or TIFF stack."""
    if format == "NWB":
        if NWBHDF5IO is None:
            raise ImportError("pynwb is required to read NWB files")
        with NWBHDF5IO(path, "r") as io:
            nwb = io.read()
            traces = None
            timestamps = None
            proc = nwb.processing.get("ophys") if nwb.processing else None
            if proc is not None and "Fluorescence" in proc.data_interfaces:
                fl = proc.data_interfaces["Fluorescence"]
                series = fl.roi_response_series[0]
                traces = np.asarray(series.data)
                timestamps = np.asarray(series.timestamps)
            else:
                series = next(iter(nwb.acquisition.values()))
                traces = np.asarray(series.data)
                timestamps = np.asarray(series.timestamps)
        return {"traces": traces, "timestamps": timestamps, "metadata": {"format": "NWB"}}
    elif format == "TIFF":
        if imread is None:
            raise ImportError("tifffile is required to read TIFF stacks")
        stack = imread(path)
        timestamps = np.arange(stack.shape[0], dtype=float)
        return {"traces": stack, "timestamps": timestamps, "metadata": {"format": "TIFF"}}
    else:
        raise ValueError("Unsupported format")


def motion_correct(raw_data):  # pragma: no cover - stub
    """Placeholder for motion correction algorithm."""
    return raw_data


def extract_rois(raw_data):  # pragma: no cover - stub
    """Placeholder for ROI extraction algorithm."""
    return raw_data


def compute_df_over_f(traces):  # pragma: no cover - stub
    """Compute ΔF/F from raw fluorescence traces."""
    baseline = traces.mean(axis=-1, keepdims=True)
    return (traces - baseline) / (baseline + 1e-8)
