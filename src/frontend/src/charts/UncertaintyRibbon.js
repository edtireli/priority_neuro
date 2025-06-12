import React from "react";
import Plot from "react-plotly.js";

export default function UncertaintyRibbon({ data = [], dataKey, seKey, alphaBands = [] }) {
  const xs = data.map((d) => d.x ?? d.iteration ?? 0);
  const ys = data.map((d) => d[dataKey]);
  let upper = [];
  let lower = [];
  let label = "CI";
  if (alphaBands.length) {
    const band = alphaBands[0];
    upper = data.map((d) => d[band.upperKey]);
    lower = data.map((d) => d[band.lowerKey]);
    label = band.label || "CI";
  } else if (seKey) {
    const errs = data.map((d) => d[seKey]);
    if (errs.some((e) => e !== undefined)) {
      upper = ys.map((y, i) => y + (errs[i] ?? 0));
      lower = ys.map((y, i) => y - (errs[i] ?? 0));
      label = "SE";
    }
  }
  const traces = [
    { x: xs, y: ys, mode: "lines", name: dataKey },
  ];
  if (upper.length) {
    traces.push({
      x: [...xs, ...xs.slice().reverse()],
      y: [...upper, ...lower.slice().reverse()],
      fill: "toself",
      line: { color: "rgba(0,0,0,0)" },
      name: label,
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
