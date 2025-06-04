import numpy as np
from scipy.special import gammaln

class PsychometricModel:
    """Bernoulli psychometric with logistic((x - threshold)/slope)."""

    def __init__(self, parameter_specs, design_name="x"):
        self.parameter_specs = parameter_specs
        self.design_name = design_name

    def simulate(self, theta: dict, design: dict):
        x = design[self.design_name]
        thr = theta["threshold"]
        slope = theta["slope"]
        p = 1 / (1 + np.exp(-(x - thr) / slope))
        return np.random.binomial(1, p)

    def log_likelihood(self, data, theta: dict, design: dict) -> float:
        x = design[self.design_name]
        thr = theta["threshold"]
        slope = theta["slope"]
        p = 1 / (1 + np.exp(-(x - thr) / slope))
        if data == 1:
            return np.log(p + 1e-12)
        else:
            return np.log(1 - p + 1e-12)

class PoissonRateModel:
    """Poisson rate model with control vs experimental condition."""

    def __init__(self, parameter_specs, design_name="condition"):
        self.parameter_specs = parameter_specs
        self.design_name = design_name

    def simulate(self, theta: dict, design: dict):
        cond = design[self.design_name]
        if cond == "control" or cond == 0:
            rate = theta["rate_control"]
        else:
            rate = theta["rate_experimental"]
        return np.random.poisson(rate)

    def log_likelihood(self, data, theta: dict, design: dict) -> float:
        cond = design[self.design_name]
        if cond == "control" or cond == 0:
            rate = theta["rate_control"]
        else:
            rate = theta["rate_experimental"]
        return data * np.log(rate + 1e-12) - rate - gammaln(data + 1)


class BernoulliModel:
    """Simple Bernoulli model with success prob theta['p']."""

    def __init__(self, parameter_specs):
        self.parameter_specs = parameter_specs

    def simulate(self, theta: dict, design: dict):
        p = theta["p"]
        return np.random.binomial(1, p)

    def log_likelihood(self, data, theta: dict, design: dict) -> float:
        p = theta["p"]
        if data == 1:
            return np.log(p + 1e-12)
        else:
            return np.log(1 - p + 1e-12)
