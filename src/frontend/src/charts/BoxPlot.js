import React from "react";
import Plot from "react-plotly.js";

export default function BoxPlot({ replicateMetrics = [] }) {
  return (
    <Plot
      data={[{ y: replicateMetrics, type: "box" }]}
      layout={{ margin: { t: 30 }, yaxis: { title: "Metric" } }}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
