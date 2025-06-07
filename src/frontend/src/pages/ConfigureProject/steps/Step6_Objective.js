import React from "react";
import { Typography, Radio, RadioGroup, FormControlLabel, Button, Box } from "@mui/material";

function Step6_Objective({ config, setConfig, setStep }) {
  const [type, setType] = React.useState(config.objective.type || "");
  const [options, setOptions] = React.useState(config.objective.options || {});

  const onNext = () => {
    setConfig((prev) => ({ ...prev, objective: { type, options } }));
    setStep(7);
  };

  return (
    <div>
      <h3>Select Objective</h3>
      <Typography sx={{ mb: 2 }}>
        Step 6: Select the optimization objective.
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Choose the optimization objective that best fits your experimental goal.
        Below are plain-language descriptions of each option:
      </Typography>
      <RadioGroup value={type} onChange={(e) => setType(e.target.value)}>
        <Box sx={{ mb: 1 }}>
          <FormControlLabel
            value="group_separation"
            control={<Radio />}
            label="Maximize Group Separation"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Optimizes your design to produce the clearest statistical separation
            between experimental groups (e.g. maximizes difference in means).
            Best when you need to detect group differences with highest
            confidence.
          </Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <FormControlLabel
            value="information_gain"
            control={<Radio />}
            label="Maximize Information Gain"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Selects trials that are expected to reduce the most uncertainty about
            your model parameters. Best when you want to learn parameter values
            as quickly as possible.
          </Typography>
        </Box>
        <Box>
          <FormControlLabel
            value="training_efficiency"
            control={<Radio />}
            label="Minimize Training Time"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Chooses settings that minimize computation time or resource usage per
            trial. Best when you need rapid feedback or have limited compute
            resources.
          </Typography>
        </Box>
      </RadioGroup>
      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button variant="contained" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <Button variant="contained" color="primary" onClick={onNext} disabled={!type}>
          Next
        </Button>
      </Box>
    </div>
  );
}

export default Step6_Objective;
