import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Plot from "react-plotly.js";
import api from "../api";
import stringifyError from "../utils/stringifyError";

function ResultsPage() {
  const { projectId, jobId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedParam, setSelectedParam] = useState("");

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/results-detailed`);
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setData(res.data);
        if (Array.isArray(res.data.priorSamples)) {
          setSelectedParam(Object.keys(res.data.priorSamples[0] || {})[0]);
        } else if (res.data.priorSamples) {
          setSelectedParam(Object.keys(res.data.priorSamples)[0]);
        }
      }
    } catch (e) {
      setError("Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!data || !data.evaluatedDesigns || data.evaluatedDesigns.length === 0) return;
    const keys = Object.keys(data.evaluatedDesigns[0].design);
    let csv = keys.join(",") + ",utility\n";
    data.evaluatedDesigns.forEach((r) => {
      csv += keys.map((k) => r.design[k]).join(",") + "," + r.utility + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evaluated_designs.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{stringifyError(error)}</p>;
  if (!data) return null;
  if (!data.evaluatedDesigns || data.evaluatedDesigns.length === 0)
    return <p>No candidate designs were evaluated. Please check your model/prior.</p>;

  const designNames = Object.keys(data.optimalDesign);
  const contVars = designNames.filter((n) => typeof data.optimalDesign[n] === "number");
  const discVars = designNames.filter((n) => typeof data.optimalDesign[n] !== "number");

  const renderUtilityPlot = () => {
    if (contVars.length === 1 && discVars.length === 1) {
      const c = contVars[0];
      const d = discVars[0];
      const groups = {};
      data.evaluatedDesigns.forEach((r) => {
        const level = r.design[d];
        if (!groups[level]) groups[level] = [];
        groups[level].push({ x: r.design[c], u: r.utility });
      });
      const traces = Object.entries(groups).map(([level, arr]) => {
        const xs = arr.sort((a, b) => a.x - b.x);
        return {
          x: xs.map((v) => v.x),
          y: xs.map((v) => v.u),
          mode: "lines+markers",
          type: "scatter",
          name: `${d}=${level}`,
        };
      });
      return <Plot data={traces} layout={{ title: "Utility by Design", xaxis: { title: c }, yaxis: { title: "EIG" } }} />;
    }
    if (contVars.length >= 2) {
      const x = contVars[0];
      const y = contVars[1];
      const z = data.evaluatedDesigns.map((r) => ({ x: r.design[x], y: r.design[y], u: r.utility }));
      return (
        <Plot
          data={[{
            x: z.map((p) => p.x),
            y: z.map((p) => p.y),
            z: z.map((p) => p.u),
            type: "heatmap",
            colorscale: "Viridis",
          }]}
          layout={{ title: "Utility Heatmap", xaxis: { title: x }, yaxis: { title: y } }}
        />
      );
    }
    return (
      <Plot
        data={[
          {
            x: data.evaluatedDesigns.map((r) => r.design[contVars[0]]),
            y: data.evaluatedDesigns.map((r) => r.utility),
            mode: "markers",
            type: "scatter",
          },
        ]}
        layout={{ title: "Utilities", xaxis: { title: contVars[0] }, yaxis: { title: "EIG" } }}
      />
    );
  };

  const renderHistograms = () => {
    if (!data.priorSamples) return <p>No prior/posterior samples available.</p>;
    const names = Array.isArray(data.priorSamples)
      ? Object.keys(data.priorSamples[0] || {})
      : Object.keys(data.priorSamples);
    if (!selectedParam) setSelectedParam(names[0]);
    const dropdown = names.length > 6 ? (
      <select value={selectedParam} onChange={(e) => setSelectedParam(e.target.value)}>
        {names.map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
    ) : null;
    const paramsToShow = names.length > 6 ? [selectedParam] : names;
    return (
      <div>
        {dropdown}
        {paramsToShow.map((p) => {
          let bins, priorDens, postDens;
          if (Array.isArray(data.priorSamples)) {
            const priorVals = data.priorSamples.map((s) => s[p]);
            const postVals = data.posteriorSamples.map((s) => s[p]);
            const minVal = Math.min(...priorVals, ...postVals);
            const maxVal = Math.max(...priorVals, ...postVals);
            bins = Array.from({ length: 200 }, (_, i) => minVal + (i * (maxVal - minVal)) / 199);
            const hist = (vals) => {
              const step = (maxVal - minVal) / 199;
              return bins.map((b, idx) => {
                const start = b - step / 2;
                const end = b + step / 2;
                const count = vals.filter((v) => v >= start && v < end).length;
                return count / vals.length / step;
              });
            };
            priorDens = hist(priorVals);
            postDens = hist(postVals);
          } else {
            bins = data.priorSamples[p].bins;
            priorDens = data.priorSamples[p].density;
            postDens = data.posteriorSamples[p].density;
          }
          return (
            <Plot
              key={p}
              data={[
                { x: bins, y: priorDens, type: "scatter", mode: "lines", name: "prior", line: { color: "grey" } },
                { x: bins, y: postDens, type: "scatter", mode: "lines", name: "posterior", line: { color: "blue" } },
              ]}
              layout={{ title: p, height: 200, margin: { t: 30 } }}
            />
          );
        })}
      </div>
    );
  };

  const renderLearningCurve = () => {
    if (!data.learningCurve) return null;
    const T = data.learningCurve.sessions.length;
    const skip = T > 50 ? 5 : 1;
    const sess = data.learningCurve.sessions.filter((_, i) => i % skip === 0);
    const mean = data.learningCurve.meanPerformance.filter((_, i) => i % skip === 0);
    const lower = data.learningCurve.ciLower.filter((_, i) => i % skip === 0);
    const upper = data.learningCurve.ciUpper.filter((_, i) => i % skip === 0);
    return (
      <Plot
        data={[
          { x: sess, y: mean, type: "scatter", mode: "lines", line: { color: "green" } },
          { x: sess.concat(sess.slice().reverse()), y: upper.concat(lower.slice().reverse()), fill: "toself", fillcolor: "rgba(0,128,0,0.2)", line: { color: "transparent" }, type: "scatter", showlegend: false },
        ]}
        layout={{ title: "Predicted Learning Curve", xaxis: { title: "session" }, yaxis: { title: "performance" } }}
      />
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3>
          Optimal Design (EIG = {data.utilityValue.toFixed(3)})
        </h3>
        <Link to={`/projects/${projectId}/jobs`}>Back to Jobs</Link>
      </div>
      <ul>
        {designNames.map((n) => (
          <li key={n}>{n}: {String(data.optimalDesign[n])}</li>
        ))}
      </ul>
      {renderUtilityPlot()}
      <button onClick={downloadCSV}>Download CSV</button>
      <h4>Top Designs</h4>
      <div style={{ maxHeight: "200px", overflowY: "scroll" }}>
        <table border="1" cellPadding="5">
          <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
            <tr>
              {designNames.map((n) => <th key={n}>{n}</th>)}
              <th>Utility</th>
            </tr>
          </thead>
          <tbody>
            {data.topDesigns.map((r, idx) => (
              <tr key={idx}>
                {designNames.map((n) => <td key={n}>{r.design[n]}</td>)}
                <td>{r.utility.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4>Prior vs Posterior</h4>
      {renderHistograms()}
      {renderLearningCurve()}
    </div>
  );
}

export default ResultsPage;
