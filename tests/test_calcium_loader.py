import os, sys
import numpy as np
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
from data.calcium_loader import load_calcium_data


def test_load_calcium_data_tiff(tmp_path):
    stack = (np.random.rand(3, 4, 4) * 100).astype(np.float32)
    from tifffile import imwrite
    tiff_path = tmp_path / "stack.tif"
    imwrite(tiff_path, stack)
    result = load_calcium_data(str(tiff_path), "TIFF")
    assert result["traces"].shape == stack.shape
    assert result["timestamps"].shape[0] == stack.shape[0]


def test_load_calcium_data_nwb(tmp_path):
    from pynwb import NWBFile, TimeSeries
    from pynwb import NWBHDF5IO

    data = np.random.rand(5, 2)
    nwb = NWBFile("desc", "id", datetime.now())
    ts = TimeSeries(name="Fluorescence", data=data, unit="a.u.", rate=1.0)
    nwb.add_acquisition(ts)
    path = tmp_path / "file.nwb"
    with NWBHDF5IO(str(path), "w") as io:
        io.write(nwb)
    loaded = load_calcium_data(str(path), "NWB")
    assert loaded["traces"].shape == data.shape
