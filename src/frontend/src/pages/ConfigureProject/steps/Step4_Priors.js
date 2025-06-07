import React, { useState } from "react";
import {
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from "@mui/material";

function Step4_Priors({ config, setConfig, setStep }) {
  const parameters = config.model.parameters || [];
  const [priors, setPriors] = useState(() => {
    const obj = {};
    parameters.forEach((p) => {
      obj[p.name] = { ...(config.priors[p.name] || p.default_prior) };
    });
    return obj;
  });
  const [errors, setErrors] = useState({});

  const formatPrior = (prior) => {
    if (!prior) return "";
    if (prior.dist === "Normal") {
      return `Normal(μ=${prior.mean},σ=${prior.sd})`;
    }
    if (prior.dist === "Gamma") {
      return `Gamma(shape=${prior.shape},scale=${prior.scale})`;
    }
    if (prior.dist === "Beta") {
      return `Beta(α=${prior.alpha},β=${prior.beta})`;
    }
    return prior.dist;
  };

  const updateField = (name, field, value) => {
    setPriors((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  };

  const handleDistChange = (param, dist) => {
    const defaults = param.default_prior || {};
    const base = { dist };
    if (dist === "Normal") {
      base.mean = priors[param.name].mean ?? defaults.mean ?? 0;
      base.sd = priors[param.name].sd ?? defaults.sd ?? 1;
    } else if (dist === "Gamma") {
      base.shape = priors[param.name].shape ?? defaults.shape ?? 1;
      base.scale = priors[param.name].scale ?? defaults.scale ?? 1;
    } else if (dist === "Beta") {
      base.alpha = priors[param.name].alpha ?? defaults.alpha ?? 1;
      base.beta = priors[param.name].beta ?? defaults.beta ?? 1;
    }
    setPriors((prev) => ({ ...prev, [param.name]: base }));
  };

  const validate = () => {
    const errs = {};
    parameters.forEach((p) => {
      const pr = priors[p.name] || {};
      if (pr.dist === "Normal") {
        if (pr.sd <= 0) {
          errs[p.name] = { sd: "SD must be > 0" };
        }
      } else if (pr.dist === "Gamma") {
        if (pr.shape <= 0) {
          errs[p.name] = { ...(errs[p.name] || {}), shape: "Shape > 0" };
        }
        if (pr.scale <= 0) {
          errs[p.name] = { ...(errs[p.name] || {}), scale: "Scale > 0" };
        }
      } else if (pr.dist === "Beta") {
        if (pr.alpha <= 0) {
          errs[p.name] = { ...(errs[p.name] || {}), alpha: "Alpha > 0" };
        }
        if (pr.beta <= 0) {
          errs[p.name] = { ...(errs[p.name] || {}), beta: "Beta > 0" };
        }
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onNext = () => {
    if (!validate()) return;
    setConfig((prev) => ({ ...prev, priors }));
    setStep(5);
  };

  return (
    <div>
      <Typography sx={{ mb: 2 }}>
        Step 4: Specify prior distributions for each model parameter. Priors
        reflect your existing beliefs and guide the optimizer.
      </Typography>
      {parameters.map((param) => {
        const pr = priors[param.name] || {};
        const err = errors[param.name] || {};
        return (
          <Box key={param.name} sx={{ mb: 3 }}>
            <Typography>{`${param.name} (${param.type})`}</Typography>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Distribution</InputLabel>
              <Select
                label="Distribution"
                value={pr.dist}
                onChange={(e) => handleDistChange(param, e.target.value)}
              >
                <MenuItem value="Normal">Normal</MenuItem>
                <MenuItem value="Gamma">Gamma</MenuItem>
                <MenuItem value="Beta">Beta</MenuItem>
              </Select>
            </FormControl>
            {pr.dist === "Normal" && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <TextField
                    label="Mean"
                    type="number"
                    value={pr.mean}
                    onChange={(e) =>
                      updateField(param.name, "mean", Number(e.target.value))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="SD"
                    type="number"
                    value={pr.sd}
                    onChange={(e) =>
                      updateField(param.name, "sd", Number(e.target.value))
                    }
                    error={!!err.sd}
                    helperText={err.sd}
                    fullWidth
                  />
                </Grid>
              </Grid>
            )}
            {pr.dist === "Gamma" && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <TextField
                    label="Shape"
                    type="number"
                    value={pr.shape}
                    onChange={(e) =>
                      updateField(param.name, "shape", Number(e.target.value))
                    }
                    error={!!err.shape}
                    helperText={err.shape}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Scale"
                    type="number"
                    value={pr.scale}
                    onChange={(e) =>
                      updateField(param.name, "scale", Number(e.target.value))
                    }
                    error={!!err.scale}
                    helperText={err.scale}
                    fullWidth
                  />
                </Grid>
              </Grid>
            )}
            {pr.dist === "Beta" && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <TextField
                    label="Alpha"
                    type="number"
                    value={pr.alpha}
                    onChange={(e) =>
                      updateField(param.name, "alpha", Number(e.target.value))
                    }
                    error={!!err.alpha}
                    helperText={err.alpha}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Beta"
                    type="number"
                    value={pr.beta}
                    onChange={(e) =>
                      updateField(param.name, "beta", Number(e.target.value))
                    }
                    error={!!err.beta}
                    helperText={err.beta}
                    fullWidth
                  />
                </Grid>
              </Grid>
            )}
            <FormHelperText sx={{ mt: 1 }}>
              Default: {formatPrior(param.default_prior)}
            </FormHelperText>
          </Box>
        );
      })}
      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button variant="contained" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <Button variant="contained" color="primary" onClick={onNext}>
          Next
        </Button>
      </Box>
    </div>
  );
}

export default Step4_Priors;
