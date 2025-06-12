import React from "react";
import Plot from "react-plotly.js";

export default function StepwiseBarChart({ sequenceSteps = [], valueKey }) {
  const xs = sequenceSteps.map((_, i) => i + 1);
  const ys = sequenceSteps.map((s) => s[valueKey]);
  return (
    <Plot
      data={[{ x: xs, y: ys, type: "bar" }]}
      layout={{
        xaxis: { title: "Step" },
        yaxis: { title: valueKey },
        margin: { t: 30 },
      }}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
