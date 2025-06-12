import React from "react";
import Plot from "react-plotly.js";

export default function ParameterScatter({ data = [], xKey, yKey }) {
  const xs = data.map((d) => d[xKey]);
  const ys = data.map((d) => d[yKey]);
  return (
    <Plot
      data={[{ x: xs, y: ys, mode: "markers" }]}
      layout={{
        xaxis: { title: xKey },
        yaxis: { title: yKey },
        margin: { t: 30 },
      }}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
