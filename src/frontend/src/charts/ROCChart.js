import React from "react";
import Plot from "react-plotly.js";

export default function ROCChart({ data = [], xKey = "fpr", yKey = "tpr" }) {
  const xs = data.map((d) => d[xKey]);
  const ys = data.map((d) => d[yKey]);
  return (
    <Plot
      data={[{ x: xs, y: ys, mode: "lines" }]}
      layout={{
        xaxis: { title: "False Positive Rate" },
        yaxis: { title: "True Positive Rate" },
        margin: { t: 30 },
      }}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
