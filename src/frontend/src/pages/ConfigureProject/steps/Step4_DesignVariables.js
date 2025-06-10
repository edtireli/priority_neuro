import React, { useState, useEffect } from "react";
import {
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  Select,
  MenuItem,
  Tooltip,
} from "@mui/material";

function Step4_DesignVariables({ config, setConfig }) {
  const [vars, setVars] = useState(config.designVariables || []);
  const [dvs, setDvs] = useState(config.model.dependentVariables || []);
  const [trialBudget, setTrialBudget] = useState(config.trialBudget || 100);
  const [mode, setMode] = useState(config.experimentalMode || "sequential");
  const [seq, setSeq] = useState(
    config.sequentialSettings || { batchSize: 10, maxIter: "" }
  );

  // If design variables are empty but uploaded data has additional columns,
  // suggest variables based on those column ranges.
  useEffect(() => {
    if (vars.length === 0 && config.metadata?.dataHeaders) {
      const headers = config.metadata.dataHeaders;
      const samples = config.metadata.dataSamples || {};
      if (headers.length > 1) {
        const suggested = headers.slice(1).map((h) => {
          const arr = (samples[h] || []).filter((v) => typeof v === "number");
          const min = arr.length ? Math.min(...arr) : 0;
          const max = arr.length ? Math.max(...arr) : 1;
          return { name: h, type: "continuous", range: [min, max], step: 1, values: [], units: "" };
        });
        if (suggested.length > 0) setVars(suggested);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.metadata?.dataHeaders]);

  useEffect(() => {
    const nextCfg = {
      designVariables: vars,
      model: { ...config.model, dependentVariables: dvs },
      trialBudget,
      experimentalMode: mode,
    };
    if (mode === "sequential") nextCfg.sequentialSettings = seq;
    setConfig((prev) => ({ ...prev, ...nextCfg }));
  }, [vars, trialBudget, mode, seq, dvs, setConfig]);

  const addVariable = () => {
    setVars((prev) => [
      ...prev,
      { name: "", type: "continuous", range: [0, 1], step: 1, values: [], units: "" },
    ]);
  };

  const updateVar = (idx, field, value) => {
    const newVars = [...vars];
    if (field === "values") {
      if (typeof value === "string") {
        newVars[idx][field] = value.split(",").map((v) => v.trim());
      } else {
        newVars[idx][field] = value;
      }
    } else {
      newVars[idx][field] = value;
    }
    setVars(newVars);
  };

  const removeVar = (idx) => {
    setVars((prev) => prev.filter((_, i) => i !== idx));
  };

  const addDv = () => setDvs((p) => [...p, ""]);
  const updateDv = (idx, val) => {
    setDvs((p) => p.map((d, i) => (i === idx ? val : d)));
  };
  const removeDv = (idx) => {
    setDvs((p) => p.filter((_, i) => i !== idx));
  };


  return (
    <div>
      <h3>Design Variables</h3>
      <Typography sx={{ mb: 2 }}>
        Step 4: Define your dependent and independent variables. Dependent
        variables are measured outcomes, while independent variables are the
        factors the optimiser can manipulate.
      </Typography>
      <Typography sx={{ mb: 2 }}>
        In <strong>sequential</strong> mode the optimiser runs a small batch of
        trials, updates the model with the new data and then proposes the next
        batch. In <strong>batch</strong> mode all trials are planned at once with
        no intermediate updates.
      </Typography>
      <Box sx={{ border: "1px solid #ccc", p: 2, mb: 3, borderRadius: 1 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Dependent Variables
        </Typography>
        {dvs.map((dv, idx) => (
          <Grid container spacing={1} alignItems="center" key={idx} sx={{ mb: 1 }}>
            <Grid item xs={10}>
              <TextField
                fullWidth
                value={dv}
                label="Dependent Variable"
                onChange={(e) => updateDv(idx, e.target.value)}
              />
            </Grid>
            <Grid item xs={2}>
              <Button onClick={() => removeDv(idx)}>Remove</Button>
            </Grid>
          </Grid>
        ))}
        <Button variant="outlined" onClick={addDv} sx={{ mt: 1 }}>
          Add Dependent Variable
        </Button>
      </Box>
      {Array.isArray(vars) && (
        <Box sx={{ border: "1px solid #ccc", p: 2, mb: 3, borderRadius: 1 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Independent Variables
          </Typography>
          {vars.map((v, idx) => (
            <Box key={idx} sx={{ border: "1px solid #ccc", p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Name"
                value={v.name}
                onChange={(e) => updateVar(idx, "name", e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Select
                value={v.type}
                fullWidth
                onChange={(e) => updateVar(idx, "type", e.target.value)}
              >
                <MenuItem value="continuous">Continuous</MenuItem>
                <MenuItem value="discrete">Discrete</MenuItem>
                <MenuItem value="categorical">Categorical</MenuItem>
              </Select>
            </Grid>
            {v.type === "continuous" && (
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Range (min,max)"
                  value={v.range.join(",")}
                  onChange={(e) => {
                    const [min, max] = e.target.value.split(",").map(Number);
                    updateVar(idx, "range", [min, max]);
                  }}
                  fullWidth
                />
              </Grid>
            )}
            {v.type === "discrete" && (
              <>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Min"
                    type="number"
                    value={v.range[0]}
                    onChange={(e) => updateVar(idx, "range", [Number(e.target.value), v.range[1]])}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Max"
                    type="number"
                    value={v.range[1]}
                    onChange={(e) => updateVar(idx, "range", [v.range[0], Number(e.target.value)])}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Step"
                    type="number"
                    value={v.step}
                    onChange={(e) => updateVar(idx, "step", Number(e.target.value))}
                    fullWidth
                  />
                </Grid>
              </>
            )}
            {v.type === "categorical" && (
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Levels"
                  value={v.values.join(",")}
                  onChange={(e) => updateVar(idx, "values", e.target.value)}
                  fullWidth
                />
              </Grid>
            )}
            <Grid item xs={12} sm={2}>
              <TextField
                label="Units"
                value={v.units}
                onChange={(e) => updateVar(idx, "units", e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={1}>
              <Button variant="outlined" onClick={() => removeVar(idx)}>
                Remove
              </Button>
            </Grid>
          </Grid>
            </Box>
          ))}
          <Button variant="outlined" onClick={addVariable} sx={{ mb: 2 }}>
            Add Variable
          </Button>
        </Box>
      )}
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Total Trial Budget"
          type="number"
          value={trialBudget}
          onChange={(e) => setTrialBudget(Number(e.target.value))}
          inputProps={{ min: 1 }}
        />
      </Box>
      <Box sx={{ mb: 2 }}>
        <label style={{ marginRight: "1rem" }}>Experimental Mode:</label>
        <Select value={mode} onChange={(e) => setMode(e.target.value)}>
          <MenuItem value="batch">Batch</MenuItem>
          <MenuItem value="sequential">Sequential</MenuItem>
        </Select>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2}>
          {mode === "sequential" && (
            <>
              <Grid item xs={12} sm={4}>
                <TextField
                  type="number"
                  label="Batch Size"
                  value={seq.batchSize}
                  onChange={(e) =>
                    setSeq((p) => ({ ...p, batchSize: Number(e.target.value) }))
                  }
                  inputProps={{ min: 1 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  type="number"
                  label="Max Iterations"
                  value={seq.maxIter}
                  onChange={(e) =>
                    setSeq((p) => ({ ...p, maxIter: e.target.value }))
                  }
                  fullWidth
                />
              </Grid>
            </>
          )}
        </Grid>
      </Box>
      {/* Navigation handled by WizardNav */}
    </div>
  );
}

export default Step4_DesignVariables;
