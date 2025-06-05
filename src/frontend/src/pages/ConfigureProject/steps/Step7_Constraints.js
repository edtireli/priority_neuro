import React from "react";
import { TextField, Button, Grid, Box } from "@mui/material";

function Step7_Constraints({ config, setConfig, setStep }) {
  const [constraints, setConstraints] = React.useState(
    config.constraints || {
      sampleSize: null,
      trialLimit: null,
      costWeights: { subject: 1, trial: 1, session: 1 },
    }
  );

  const updateField = (field, value) => {
    setConstraints((prev) => ({ ...prev, [field]: value }));
  };

  const onNext = () => {
    setConfig((prev) => ({ ...prev, constraints }));
    setStep(8);
  };

  return (
    <div>
      <h3>Define Constraints & Budget</h3>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Maximum Sample Size"
            type="number"
            fullWidth
            value={constraints.sampleSize || ""}
            onChange={(e) => updateField("sampleSize", Number(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Maximum Trials Total"
            type="number"
            fullWidth
            value={constraints.trialLimit || ""}
            onChange={(e) => updateField("trialLimit", Number(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Cost Weight per Subject"
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
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Cost Weight per Trial"
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
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Cost Weight per Session"
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
