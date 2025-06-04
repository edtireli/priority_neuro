import React, { useState } from "react";

function Step4_DesignVariables({ config, setConfig, setStep }) {
  const [vars, setVars] = useState(config.designVariables || []);

  const addVariable = () => {
    setVars((prev) => [
      ...prev,
      { name: "", type: "continuous", range: [0, 1], units: "" },
    ]);
  };

  const updateVar = (idx, field, value) => {
    const newVars = [...vars];
    newVars[idx][field] = value;
    setVars(newVars);
  };

  const removeVar = (idx) => {
    setVars((prev) => prev.filter((_, i) => i !== idx));
  };

  const onNext = () => {
    setConfig((prev) => ({ ...prev, designVariables: vars }));
    setStep(5);
  };

  return (
    <div>
      <h3>Define Design Variables</h3>
      {vars.map((v, idx) => (
        <div key={idx} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
          <label>Name:</label>
          <input value={v.name} onChange={(e) => updateVar(idx, "name", e.target.value)} />
          <label>Type:</label>
          <select value={v.type} onChange={(e) => updateVar(idx, "type", e.target.value)}>
            <option value="continuous">Continuous</option>
            <option value="discrete">Discrete</option>
          </select>
          {v.type === "continuous" ? (
            <>
              <label>Range (min,max):</label>
              <input
                type="text"
                value={v.range.join(",")}
                onChange={(e) => {
                  const [min, max] = e.target.value.split(",").map(Number);
                  updateVar(idx, "range", [min, max]);
                }}
              />
            </>
          ) : (
            <>
              <label>Values (comma-separated):</label>
              <input
                type="text"
                value={v.values?.join(",") || ""}
                onChange={(e) => updateVar(idx, "values", e.target.value.split(","))}
              />
            </>
          )}
          <label>Units:</label>
          <input value={v.units} onChange={(e) => updateVar(idx, "units", e.target.value)} />
          <button type="button" onClick={() => removeVar(idx)}>
            Remove Variable
          </button>
        </div>
      ))}
      <button type="button" onClick={addVariable}>
        Add Variable
      </button>
      <br />
      <button type="button" onClick={() => setStep((s) => s - 1)}>
        Back
      </button>
      <button type="button" onClick={onNext}>
        Next
      </button>
    </div>
  );
}

export default Step4_DesignVariables;
