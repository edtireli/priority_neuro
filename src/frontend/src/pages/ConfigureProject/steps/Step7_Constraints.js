import React, { useState, useEffect } from "react";
import { Typography, Grid, Slider } from "@mui/material";

function Step7_Constraints({ config, setConfig }) {
  const [constraints, setConstraints] = useState(
    config.constraints || {
      sampleSize: "",
      trialLimit: "",
      costWeights: { subject: "", trial: "", session: "" },
    },
  );
  const groupTotal = Array.isArray(config.groups)
    ? config.groups.reduce((s, g) => s + (g.N || 0), 0)
    : 0;

  useEffect(() => {
    setConfig((prev) => ({ ...prev, constraints }));
  }, [constraints, setConfig]);

  const updateField = (field, value) => {
    setConstraints((prev) => ({ ...prev, [field]: value }));
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
          <Typography gutterBottom>Maximum Sample Size</Typography>
          <Slider
            value={constraints.sampleSize || groupTotal}
            min={0}
            max={groupTotal * 2 || 100}
            valueLabelDisplay="on"
            onChange={(_, val) => updateField("sampleSize", val)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Maximum Trial Limit</Typography>
          <Slider
            value={constraints.trialLimit || groupTotal}
            min={0}
            max={groupTotal * 2 || 100}
            valueLabelDisplay="on"
            onChange={(_, val) => updateField("trialLimit", val)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography gutterBottom>Cost per subject</Typography>
          <Slider
            value={constraints.costWeights.subject || 1}
            min={0}
            max={10}
            step={0.1}
            valueLabelDisplay="on"
            onChange={(_, val) =>
              setConstraints((prev) => ({
                ...prev,
                costWeights: { ...prev.costWeights, subject: val },
              }))
            }
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography gutterBottom>Cost per trial</Typography>
          <Slider
            value={constraints.costWeights.trial || 1}
            min={0}
            max={10}
            step={0.1}
            valueLabelDisplay="on"
            onChange={(_, val) =>
              setConstraints((prev) => ({
                ...prev,
                costWeights: { ...prev.costWeights, trial: val },
              }))
            }
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography gutterBottom>Cost per session</Typography>
          <Slider
            value={constraints.costWeights.session || 1}
            min={0}
            max={10}
            step={0.1}
            valueLabelDisplay="on"
            onChange={(_, val) =>
              setConstraints((prev) => ({
                ...prev,
                costWeights: { ...prev.costWeights, session: val },
              }))
            }
          />
        </Grid>
      </Grid>
      {/* Navigation handled by WizardNav */}
    </div>
  );
}

export default Step7_Constraints;
