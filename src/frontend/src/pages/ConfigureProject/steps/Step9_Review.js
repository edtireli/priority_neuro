import React from "react";
import { Typography, Button, Box } from "@mui/material";

function Step9_Review({ config, setStep }) {
  const estTime = Math.ceil(
    ((config.trialBudget || 0) * (config.designVariables?.length || 1)) / 50
  );
  return (
    <div>
      <h3>Review Your Configuration</h3>
      <Typography sx={{ mb: 2 }}>
        Step 9: Review all selections before submitting. Example: verify
        estimated compute time of about {estTime} minutes.
      </Typography>
      <pre style={{ background: "#f0f0f0", padding: "1rem" }}>
        {JSON.stringify(config, null, 2)}
      </pre>
      <p>Estimated compute time: ~{estTime} minutes</p>
      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button variant="contained" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <Button variant="contained" color="primary" onClick={() => setStep(10)}>
          Submit
        </Button>
      </Box>
    </div>
  );
}

export default Step9_Review;
