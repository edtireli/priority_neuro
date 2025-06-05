import React from "react";
import { Radio, RadioGroup, FormControlLabel, Button, Box } from "@mui/material";

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
      <RadioGroup value={type} onChange={(e) => setType(e.target.value)}>
        <FormControlLabel
          value="group_separation"
          control={<Radio />}
          label="Maximize Group Separation"
        />
        <FormControlLabel
          value="information_gain"
          control={<Radio />}
          label="Maximize Information Gain"
        />
        <FormControlLabel
          value="training_efficiency"
          control={<Radio />}
          label="Minimize Training Time"
        />
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
