import React from "react";
import Plot from "react-plotly.js";

export default function SensitivityMatrix({ multiParamData = [] }) {
  if (!multiParamData.length) return null;
  const params = Object.keys(multiParamData[0]).filter((k) => k !== "metric");
  const z = params.map((p1) =>
    params.map((p2) => {
      const entry = multiParamData.find((d) => d.p1 === p1 && d.p2 === p2);
      return entry ? entry.metric : 0;
    })
  );
  return (
    <Plot
      data={[{ z, x: params, y: params, type: "heatmap", colorscale: "Viridis" }]}
      layout={{ margin: { t: 30 } }}
      useResizeHandler
      style={{ width: "100%", height: "400px" }}
      config={{ responsive: true }}
    />
  );
}
