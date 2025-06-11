import numpy as np


class LearningCurveModel:
    """Logistic learning curve model."""

    @staticmethod
    def parameter_schema():
        return {
            "description": "Logistic learning curve: A/(1+exp(-(t-t0)/k)) + noise",
            "parameters": [
                {
                    "name": "A",
                    "type": "float",
                    "default_prior": {"dist": "Normal", "mean": 1.0, "sd": 0.2},
                },
                {
                    "name": "k",
                    "type": "float",
                    "default_prior": {"dist": "Normal", "mean": 1.0, "sd": 0.5},
                },
                {
                    "name": "t0",
                    "type": "float",
                    "default_prior": {"dist": "Normal", "mean": 5.0, "sd": 1.0},
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
            for p in LearningCurveModel.parameter_schema()["parameters"]
        }

    def simulate(self, parameters: dict, sessions: int):
        A = parameters.get("A")
        k = parameters.get("k")
        t0 = parameters.get("t0")
        sigma = parameters.get("sigma")
        t = np.arange(1, sessions + 1)
        perf = A / (1 + np.exp(-(t - t0) / k))
        noise = np.random.normal(scale=sigma, size=sessions)
        return perf + noise
