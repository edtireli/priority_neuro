import React from "react";

function Step5_Objective({ config, setConfig, setStep }) {
  const [type, setType] = React.useState(config.objective.type || "");
  const [options, setOptions] = React.useState(config.objective.options || {});

  const onNext = () => {
    setConfig((prev) => ({ ...prev, objective: { type, options } }));
    setStep(6);
  };

  return (
    <div>
      <h3>Select Objective</h3>
      <label>
        <input
          type="radio"
          value="group_separation"
          checked={type === "group_separation"}
          onChange={() => setType("group_separation")}
        />
        Maximize Group Separation
      </label>
      <label>
        <input
          type="radio"
          value="information_gain"
          checked={type === "information_gain"}
          onChange={() => setType("information_gain")}
        />
        Maximize Information Gain
      </label>
      <label>
        <input
          type="radio"
          value="training_efficiency"
          checked={type === "training_efficiency"}
          onChange={() => setType("training_efficiency")}
        />
        Minimize Training Time
      </label>
      <button type="button" onClick={() => setStep((s) => s - 1)}>
        Back
      </button>
      <button type="button" onClick={onNext} disabled={!type}>
        Next
      </button>
    </div>
  );
}

export default Step5_Objective;
