import React from "react";
import Plot from "react-plotly.js";

export default function ScatterPlot({ data = [], xKey, yKey, colorKey, onPointClick }) {
  const xs = data.map((d) => d[xKey]);
  const ys = data.map((d) => d[yKey]);
  const colors = colorKey ? data.map((d) => d[colorKey]) : undefined;
  return (
    <Plot
      data={[
        {
          x: xs,
          y: ys,
          mode: "markers",
          marker: {
            color: colors,
            colorscale: colors ? "Viridis" : undefined,
            colorbar: colors ? { title: colorKey } : undefined,
          },
        },
      ]}
      layout={{
        hovermode: "closest",
        xaxis: { title: xKey },
        yaxis: { title: yKey },
        margin: { t: 30 },
      }}
      onClick={(e) => onPointClick && onPointClick(e.points[0].pointIndex)}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
