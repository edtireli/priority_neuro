import React from "react";
import Plot from "react-plotly.js";

export default function DistributionPlot({ samples = [], dataKey }) {
  return (
    <Plot
      data={[
        {
          x: samples,
          type: "histogram",
          marker: { color: "#1976d2" },
        },
      ]}
      layout={{
        xaxis: { title: dataKey },
        yaxis: { title: "Count" },
        margin: { t: 30 },
      }}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
