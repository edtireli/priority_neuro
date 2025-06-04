import React from "react";

function Step6_Constraints({ config, setConfig, setStep }) {
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
    setStep(7);
  };

  return (
    <div>
      <h3>Define Constraints & Budget</h3>
      <div>
        <label>Maximum Sample Size:</label>
        <input
          type="number"
          value={constraints.sampleSize || ""}
          onChange={(e) => updateField("sampleSize", Number(e.target.value))}
        />
      </div>
      <div>
        <label>Maximum Trials Total:</label>
        <input
          type="number"
          value={constraints.trialLimit || ""}
          onChange={(e) => updateField("trialLimit", Number(e.target.value))}
        />
      </div>
      <div>
        <label>Cost Weight per Subject:</label>
        <input
          type="number"
          step="0.1"
          value={constraints.costWeights.subject}
          onChange={(e) =>
            setConstraints((prev) => ({
              ...prev,
              costWeights: { ...prev.costWeights, subject: Number(e.target.value) },
            }))
          }
        />
      </div>
      <div>
        <label>Cost Weight per Trial:</label>
        <input
          type="number"
          step="0.1"
          value={constraints.costWeights.trial}
          onChange={(e) =>
            setConstraints((prev) => ({
              ...prev,
              costWeights: { ...prev.costWeights, trial: Number(e.target.value) },
            }))
          }
        />
      </div>
      <div>
        <label>Cost Weight per Session:</label>
        <input
          type="number"
          step="0.1"
          value={constraints.costWeights.session}
          onChange={(e) =>
            setConstraints((prev) => ({
              ...prev,
              costWeights: { ...prev.costWeights, session: Number(e.target.value) },
            }))
          }
        />
      </div>
      <button type="button" onClick={() => setStep((s) => s - 1)}>
        Back
      </button>
      <button type="button" onClick={onNext}>
        Next
      </button>
    </div>
  );
}

export default Step6_Constraints;
