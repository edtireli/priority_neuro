import React from "react";
import Plot from "react-plotly.js";

export default function LineChart({ data = [], xKey = "x", yKey = "y", seKey }) {
  const xs = data.map((d) => d[xKey]);
  const ys = data.map((d) => d[yKey]);
  const errs = seKey ? data.map((d) => d[seKey]) : [];
  return (
    <Plot
      data={[{
        x: xs,
        y: ys,
        mode: "lines",
        error_y: errs.length ? { type: "data", array: errs } : undefined,
      }]}
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
