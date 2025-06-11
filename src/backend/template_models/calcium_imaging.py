import numpy as np


class CalciumImagingModel:
    """Simple calcium imaging model producing ΔF/F traces."""

    @staticmethod
    def parameter_schema():
        return {
            "description": "Exponential calcium transient model",
            "parameters": [
                {
                    "name": "tau",
                    "type": "float",
                    "default_prior": {"dist": "Normal", "mean": 1.0, "sd": 0.5},
                },
                {
                    "name": "amplitude",
                    "type": "float",
                    "default_prior": {"dist": "HalfNormal", "scale": 1.0},
                },
                {
                    "name": "sigma",
                    "type": "float",
                    "default_prior": {"dist": "HalfNormal", "scale": 0.1},
                },
            ],
        }

    @staticmethod
    def default_priors():
        return {
            p["name"]: p["default_prior"]
            for p in CalciumImagingModel.parameter_schema()["parameters"]
        }

    def _signal(self, parameters: dict, design_point: dict) -> np.ndarray:
        tau = parameters.get("tau")
        amplitude = parameters.get("amplitude")
        t = np.asarray(design_point.get("t"))
        return amplitude * np.exp(-t / tau)

    def simulate(self, parameters: dict, design_point: dict) -> np.ndarray:
        t = np.asarray(design_point.get("t"))
        sigma = parameters.get("sigma")
        signal = self._signal(parameters, design_point)
        noise = np.random.normal(scale=sigma, size=t.shape)
        return signal + noise

    def log_likelihood(
        self, observation: np.ndarray, parameters: dict, design_point: dict
    ) -> float:
        sigma = parameters.get("sigma")
        pred = self._signal(parameters, design_point)
        resid = observation - pred
        n = resid.size
        return float(-0.5 * n * np.log(2 * np.pi * sigma**2) - (resid**2).sum() / (2 * sigma**2))
