import React from "react";
import Plot from "react-plotly.js";

export default function UncertaintyRibbon({ data = [], dataKey, alphaBands = [] }) {
  const xs = data.map((d) => d.x ?? d.iteration ?? 0);
  const ys = data.map((d) => d[dataKey]);
  const traces = [
    { x: xs, y: ys, mode: "lines", name: dataKey },
  ];
  if (alphaBands.length) {
    const band = alphaBands[0];
    const upper = data.map((d) => d[band.upperKey]);
    const lower = data.map((d) => d[band.lowerKey]);
    traces.push({
      x: [...xs, ...xs.slice().reverse()],
      y: [...upper, ...lower.slice().reverse()],
      fill: "toself",
      line: { color: "rgba(0,0,0,0)" },
      name: band.label || "CI",
      showlegend: false,
    });
  }
  return (
    <Plot
      data={traces}
      layout={{
        xaxis: { title: "Iteration" },
        yaxis: { title: dataKey },
        margin: { t: 30 },
      }}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
