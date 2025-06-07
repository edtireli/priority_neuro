import React, { useState } from "react";
import { Typography, TextField, Button, Grid, Box } from "@mui/material";

function Step7_Constraints({ config, setConfig, setStep }) {
  const [constraints, setConstraints] = useState(
    config.constraints || {
      sampleSize: "",
      trialLimit: "",
      costWeights: { subject: "", trial: "", session: "" },
    },
  );
  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    setConstraints((prev) => ({ ...prev, [field]: value }));
  };

  const validateField = (name, value) => {
    if (value === null || value === "" || Number(value) > 0) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
      return true;
    }
    setErrors((prev) => ({ ...prev, [name]: "Must be > 0" }));
    return false;
  };

  const onNext = () => {
    const ok = [
      validateField("sampleSize", constraints.sampleSize),
      validateField("trialLimit", constraints.trialLimit),
      validateField("subject", constraints.costWeights.subject),
      validateField("trial", constraints.costWeights.trial),
      validateField("session", constraints.costWeights.session),
    ].every(Boolean);
    if (!ok) return;
    setConfig((prev) => ({ ...prev, constraints }));
    setStep(8);
  };

  return (
    <div>
      <h3>Define Constraints & Budget</h3>
      <Typography sx={{ mb: 2 }}>
        Maximum Sample Size limits how many participants you plan to recruit.
        Trial Limit caps the total number of trials run across everyone. Cost
        Weights express how expensive each resource is&mdash;for example, setting
        the trial weight to 2 would make trials twice as costly as sessions.
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Maximum Sample Size"
            type="number"
            fullWidth
            value={constraints.sampleSize || ""}
            onChange={(e) => updateField("sampleSize", Number(e.target.value))}
            onBlur={(e) => validateField("sampleSize", Number(e.target.value))}
            error={!!errors.sampleSize}
            helperText={errors.sampleSize}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Maximum Trial Limit"
            type="number"
            fullWidth
            value={constraints.trialLimit || ""}
            onChange={(e) => updateField("trialLimit", Number(e.target.value))}
            onBlur={(e) => validateField("trialLimit", Number(e.target.value))}
            error={!!errors.trialLimit}
            helperText={errors.trialLimit}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Cost per subject"
            type="number"
            step="0.1"
            fullWidth
            value={constraints.costWeights.subject}
            onChange={(e) =>
              setConstraints((prev) => ({
                ...prev,
                costWeights: { ...prev.costWeights, subject: Number(e.target.value) },
              }))
            }
            onBlur={(e) => validateField("subject", Number(e.target.value))}
            error={!!errors.subject}
            helperText={errors.subject || "Default: 1"}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Cost per trial"
            type="number"
            step="0.1"
            fullWidth
            value={constraints.costWeights.trial}
            onChange={(e) =>
              setConstraints((prev) => ({
                ...prev,
                costWeights: { ...prev.costWeights, trial: Number(e.target.value) },
              }))
            }
            onBlur={(e) => validateField("trial", Number(e.target.value))}
            error={!!errors.trial}
            helperText={errors.trial || "Default: 1"}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Cost per session"
            type="number"
            step="0.1"
            fullWidth
            value={constraints.costWeights.session}
            onChange={(e) =>
              setConstraints((prev) => ({
                ...prev,
                costWeights: { ...prev.costWeights, session: Number(e.target.value) },
              }))
            }
            onBlur={(e) => validateField("session", Number(e.target.value))}
            error={!!errors.session}
            helperText={errors.session || "Default: 1"}
          />
        </Grid>
      </Grid>
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

export default Step7_Constraints;
