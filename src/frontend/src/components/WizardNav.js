import React from "react";
import { Stepper, Step, StepButton } from "@mui/material";

function WizardNav({ step, setStep }) {
  const labels = [
    "Metadata",
    "Model Selection",
    "Groups",
    "Design Vars",
    "Priors",
    "Objective",
    "Constraints",
    "Misc",
    "Review",
    "Submit",
  ];

  return (
    <Stepper
      nonLinear
      activeStep={step - 1}
      alternativeLabel
      sx={{ mb: 3 }}
    >
      {labels.map((label, idx) => (
        <Step key={label} completed={idx + 1 < step}>
          <StepButton
            onClick={() => setStep(idx + 1)}
            sx={{
              fontWeight: idx + 1 === step ? "bold" : "inherit",
              textDecoration: idx + 1 === step ? "underline" : "none",
            }}
          >
            {label}
          </StepButton>
        </Step>
      ))}
    </Stepper>
  );
}

export default WizardNav;
