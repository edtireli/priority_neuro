import React from "react";
import Plot from "react-plotly.js";

export default function Heatmap({ dataGrid = [], xKey, yKey, valueKey }) {
  const xVals = Array.from(new Set(dataGrid.map((d) => d[xKey])));
  const yVals = Array.from(new Set(dataGrid.map((d) => d[yKey])));
  const z = yVals.map((y) =>
    xVals.map((x) => {
      const entry = dataGrid.find((d) => d[xKey] === x && d[yKey] === y);
      return entry ? entry[valueKey] : null;
    })
  );
  return (
    <Plot
      data={[{ x: xVals, y: yVals, z, type: "heatmap", colorscale: "Viridis" }]}
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
