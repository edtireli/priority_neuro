import os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
from template_models.calcium_imaging import CalciumImagingModel


def test_calcium_model_sim_and_ll():
    model = CalciumImagingModel()
    params = {"tau": 1.0, "amplitude": 1.0, "sigma": 0.1}
    design = {"t": np.linspace(0, 1, 10)}
    trace = model.simulate(params, design)
    ll = model.log_likelihood(trace, params, design)
    assert isinstance(ll, float)
