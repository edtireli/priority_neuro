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

function Step5_DesignVariables({ config, setConfig }) {
  const [vars, setVars] = useState(config.designVariables || []);
  const [trialBudget, setTrialBudget] = useState(config.trialBudget || 100);
  const [mode, setMode] = useState(config.experimentalMode || "batch");
  const [seq, setSeq] = useState(
    config.sequentialSettings || { pilotFile: null, batchSize: 10, maxIter: "" }
  );

  useEffect(() => {
    const nextCfg = {
      designVariables: vars,
      trialBudget,
      experimentalMode: mode,
    };
    if (mode === "sequential") nextCfg.sequentialSettings = seq;
    setConfig((prev) => ({ ...prev, ...nextCfg }));
  }, [vars, trialBudget, mode, seq, setConfig]);

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


  return (
    <div>
      <h3>Define Design Variables</h3>
      <Typography sx={{ mb: 2 }}>
        Step 5: Define design variables to optimize, e.g. stimulusIntensity
        range 0–1.
      </Typography>
      {Array.isArray(vars) &&
        vars.map((v, idx) => (
        <Box
          key={idx}
          sx={{ border: "1px solid #ccc", p: 2, mb: 2 }}
        >
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
      {mode === "sequential" && (
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                type="number"
                label="Batch Size"
                value={seq.batchSize}
                onChange={(e) => setSeq((p) => ({ ...p, batchSize: Number(e.target.value) }))}
                inputProps={{ min: 1 }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                type="number"
                label="Max Iterations"
                value={seq.maxIter}
                onChange={(e) => setSeq((p) => ({ ...p, maxIter: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Tooltip
                title={
                  mode !== "sequential"
                    ? "Switch to sequential mode to enable pilot data upload"
                    : ""
                }
              >
                <span>
                  <Button
                    variant="outlined"
                    component="label"
                    disabled={mode !== "sequential"}
                  >
                    Upload Pilot Data
                    <input
                      type="file"
                      accept=".csv"
                      hidden
                      disabled={mode !== "sequential"}
                      onChange={(e) =>
                        setSeq((p) => ({ ...p, pilotFile: e.target.files[0] }))
                      }
                    />
                  </Button>
                </span>
              </Tooltip>
              {mode === "sequential" && seq.pilotFile && (
                <span style={{ marginLeft: 8 }}>{seq.pilotFile.name}</span>
              )}
            </Grid>
          </Grid>
        </Box>
      )}
      {/* Navigation handled by WizardNav */}
    </div>
  );
}

export default Step5_DesignVariables;
