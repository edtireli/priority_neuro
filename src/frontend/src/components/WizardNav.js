import React from "react";

function WizardNav({ step, setStep }) {
  const labels = [
    "1. Metadata",
    "2. Model Selection",
    "3. Groups",
    "4. Priors",
    "5. Design Vars",
    "6. Objective",
    "7. Constraints",
    "8. Misc",
    "9. Review",
    "10. Submit",
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
