import React from "react";
import Plot from "react-plotly.js";

export default function HistogramChart({ data = [], dataKey }) {
  return (
    <Plot
      data={[{ x: data.map((d) => d[dataKey]), type: "histogram" }]}
      layout={{ xaxis: { title: dataKey }, margin: { t: 30 } }}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
