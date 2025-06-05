import React from "react";
import { Button, Box } from "@mui/material";

function Step9_Review({ config, setStep }) {
  return (
    <div>
      <h3>Review Your Configuration</h3>
      <pre style={{ background: "#f0f0f0", padding: "1rem" }}>
        {JSON.stringify(config, null, 2)}
      </pre>
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
