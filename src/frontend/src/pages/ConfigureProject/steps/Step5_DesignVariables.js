import React, { useState } from "react";
import {
  TextField,
  Button,
  Grid,
  Box,
  Select,
  MenuItem,
} from "@mui/material";

function Step5_DesignVariables({ config, setConfig, setStep }) {
  const [vars, setVars] = useState(config.designVariables || []);
  const [trialBudget, setTrialBudget] = useState(config.trialBudget || 100);

  const addVariable = () => {
    setVars((prev) => [
      ...prev,
      { name: "", type: "continuous", range: [0, 1], units: "" },
    ]);
  };

  const updateVar = (idx, field, value) => {
    const newVars = [...vars];
    if (field === "values") {
      const arr = value.split(",").map((val) => {
        const trimmed = val.trim();
        return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
      });
      newVars[idx][field] = arr;
    } else {
      newVars[idx][field] = value;
    }
    setVars(newVars);
  };

  const removeVar = (idx) => {
    setVars((prev) => prev.filter((_, i) => i !== idx));
  };

  const onNext = () => {
    for (const v of vars) {
      if (v.name.trim() === "") {
        alert("Variable name required");
        return;
      }
    }
    if (trialBudget < 1) {
      alert("Trial budget must be >=1");
      return;
    }
    setConfig((prev) => ({ ...prev, designVariables: vars, trialBudget }));
    setStep(6);
  };

  return (
    <div>
      <h3>Define Design Variables</h3>
      {vars.map((v, idx) => (
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
              </Select>
            </Grid>
            {v.type === "continuous" ? (
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
            ) : (
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Values"
                  value={v.values?.join(",") || ""}
                  onChange={(e) => updateVar(idx, "values", e.target.value.split(","))}
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

export default Step5_DesignVariables;
