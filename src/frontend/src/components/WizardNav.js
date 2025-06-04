import React from "react";

function WizardNav({ step, setStep }) {
  const labels = [
    "1. Metadata",
    "2. Model Selection",
    "3. Priors",
    "4. Design Variables",
    "5. Objective",
    "6. Constraints",
    "7. Review & Submit",
  ];
  return (
    <nav style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
      {labels.map((label, idx) => (
        <button key={idx} onClick={() => setStep(idx + 1)} disabled={idx + 1 > step}>
          {label}
        </button>
      ))}
    </nav>
  );
}

export default WizardNav;
