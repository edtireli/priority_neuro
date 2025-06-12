import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Plot from "react-plotly.js";
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Slider,
} from "@mui/material";
import api from "../api";
import stringifyError from "../utils/stringifyError";

function gamma(z) {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function priorPdf(prior, xs) {
  if (!prior) return xs.map(() => 0);
  const dist = prior.dist;
  if (dist === "Normal") {
    const mean = prior.mean || 0;
    const sd = prior.sd || 1;
    return xs.map(
      (x) => (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sd, 2))
    );
  }
  if (dist === "Uniform") {
    const low = prior.low;
    const high = prior.high;
    return xs.map((x) => (x >= low && x <= high ? 1 / (high - low) : 0));
  }
  if (dist === "Gamma") {
    const shape = prior.shape;
    const scale = prior.scale;
    const coeff = 1 / (Math.pow(scale, shape) * gamma(shape));
    return xs.map((x) => (x > 0 ? coeff * Math.pow(x, shape - 1) * Math.exp(-x / scale) : 0));
  }
  return xs.map(() => 0);
}

export default function ResultsPage() {
  const { projectId, jobId } = useParams();
  const [metrics, setMetrics] = useState(null);
  const [result, setResult] = useState(null);
  const [flowLog, setFlowLog] = useState(null);
  const [initialPosterior, setInitialPosterior] = useState([]);
  const [simulationHistory, setSimulationHistory] = useState([]);
  const [simIter, setSimIter] = useState(0);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mRes, rRes, fRes, cRes] = await Promise.all([
          api.get(`/projects/${projectId}/jobs/${jobId}/metrics`),
          api.get(`/projects/${projectId}/jobs/${jobId}/results`),
          api.get(`/projects/${projectId}/jobs/${jobId}/flow_log`),
          api.get(`/projects/${projectId}/config`),
        ]);
        setMetrics(mRes.data || []);
        setResult(rRes.data || null);
        setInitialPosterior(rRes.data.initialPosterior || []);
        setSimulationHistory(rRes.data.simulationHistory || []);
        setSimIter((rRes.data.simulationHistory || []).length);
        let log = fRes.data;
        if (typeof log === "string") {
          const rows = log.trim().split(/\n/).slice(1);
          log = rows.map((r) => {
            const [e, tr, vl] = r.split(/,\s*/);
            return { epoch: Number(e), train_loss: Number(tr), val_loss: Number(vl) };
          });
        }
        setFlowLog(log || []);
        setConfig(cRes.data.config);
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId, jobId]);

  if (loading)
    return (
      <Box display="flex" justifyContent="center" my={4}>
        {error ? <Alert severity="error">{stringifyError(error)}</Alert> : <CircularProgress />}
      </Box>
    );

  if (error)
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {stringifyError(error)}
        </Alert>
      </Container>
    );

  const sortedMetrics = [...(metrics || [])].sort((a, b) => a.iteration - b.iteration);
  const utilX = sortedMetrics.map((m) => m.iteration);
  const utilY = sortedMetrics.map((m) => m.utility);
  const utilErr = sortedMetrics.map((m) => m.se);

  const flowEpochs = flowLog ? flowLog.map((r) => r.epoch) : [];
  const trainLoss = flowLog ? flowLog.map((r) => r.train_loss) : [];
  const valLoss = flowLog ? flowLog.map((r) => r.val_loss) : [];

  const slopePrior = config?.priors?.slope;
  const slopePosterior = result?.summary?.posterior?.slope ||
    sortedMetrics[sortedMetrics.length - 1]?.posterior_summary?.slope;
  const slopeSamples = Array.isArray(slopePosterior)
    ? slopePosterior
    : slopePosterior?.samples;

  const bestDesign = result?.summary?.best_design;
  const bestUtility = result?.summary?.utility;
  const bestUtilitySE = result?.summary?.utilitySE;
  const bestUtilityCiLower = result?.summary?.ci_lower;
  const bestUtilityCiUpper = result?.summary?.ci_upper;
  const bestIter =
    bestDesign &&
    sortedMetrics.find(
      (m) => JSON.stringify(m.design_point) === JSON.stringify(bestDesign)
    )?.iteration;

  const renderSlopePosterior = () => {
    if (!slopePrior) return null;
    const samples = slopeSamples || [];
    const minX = samples.length ? Math.min(...samples) : slopePrior.low ?? slopePrior.mean - 4 * (slopePrior.sd || 1);
    const maxX = samples.length ? Math.max(...samples) : slopePrior.high ?? slopePrior.mean + 4 * (slopePrior.sd || 1);
    const xs = [];
    for (let i = 0; i < 100; i++) xs.push(minX + (i / 99) * (maxX - minX));
    const priorYs = priorPdf(slopePrior, xs);
    const data = [
      { x: xs, y: priorYs, type: "scatter", mode: "lines", name: "Prior" },
    ];
    if (samples.length) {
      data.unshift({
        x: samples,
        type: "histogram",
        histnorm: "probability density",
        opacity: 0.6,
        name: "Posterior",
      });
    }
    return (
      <Plot
        data={data}
        layout={{
          barmode: "overlay",
          xaxis: { title: "slope" },
          yaxis: { title: "Density" },
          margin: { t: 30 },
        }}
        useResizeHandler
        style={{ width: "100%", height: "400px" }}
        config={{ responsive: true }}
      />
    );
  };

  const renderDesignSpace = () => {
    if (!metrics || !metrics.length) return null;
    const vars = Object.keys(metrics[0].design_point || {});
    if (vars.length === 2) {
      const [xName, yName] = vars;
      return (
        <Plot
          data={[
            {
              x: metrics.map((m) => m.design_point[xName]),
              y: metrics.map((m) => m.design_point[yName]),
              mode: "markers",
              marker: {
                color: metrics.map((m) => m.utility),
                colorscale: "Viridis",
                colorbar: { title: "Utility" },
              },
            },
          ]}
          layout={{
            hovermode: "closest",
            xaxis: { title: xName },
            yaxis: { title: yName },
            margin: { t: 30 },
          }}
          useResizeHandler
          style={{ width: "100%", height: "400px" }}
          config={{ responsive: true }}
        />
      );
    }
    if (vars.length === 1) {
      const [name] = vars;
      return (
        <Plot
          data={[
            {
              x: utilX,
              y: metrics.map((m) => m.design_point[name]),
              mode: "markers",
              marker: { color: utilY, colorscale: "Viridis", colorbar: { title: "Utility" } },
            },
          ]}
          layout={{
            hovermode: "closest",
            xaxis: { title: "Iteration" },
            yaxis: { title: name },
            margin: { t: 30 },
          }}
          useResizeHandler
          style={{ width: "100%", height: "400px" }}
          config={{ responsive: true }}
        />
      );
    }
    return null;
  };

  const renderSimulation = () => {
    if (!simulationHistory.length && !initialPosterior.length) return null;
    const vars = Object.keys(simulationHistory[0]?.design_point || {});
    const xVar = vars[0];
    const scatterData = [
      {
        x: simulationHistory.map((h) => h.design_point[xVar]),
        y: simulationHistory.map((h) => h.simulated_perf),
        mode: "markers",
        marker: {
          color: simulationHistory.map((h) => h.iteration),
          colorscale: "Viridis",
          size: simulationHistory.map((h) =>
            h.iteration === simIter ? 12 : 8
          ),
          colorbar: { title: "Iter" },
        },
      },
    ];
    const eig = metrics?.find((m) => m.iteration === simIter)?.utility;

    const params = Object.keys(config?.priors || {});
    return (
      <Box>
        <Plot
          data={scatterData}
          layout={{
            hovermode: "closest",
            xaxis: { title: xVar },
            yaxis: { title: "Simulated Perf" },
            margin: { t: 30 },
          }}
          useResizeHandler
          style={{ width: "100%", height: "400px" }}
          config={{ responsive: true }}
        />
        {eig !== undefined && (
          <Typography variant="subtitle2" sx={{ my: 1 }}>
            EIG: {eig.toFixed(2)}
          </Typography>
        )}
        {params.map((p) => {
          const samples =
            simIter === 0
              ? initialPosterior.map((s) => s[p])
              : simulationHistory[simIter - 1]?.posterior_samples.map((s) => s[p]) || [];
          const prior = config.priors[p];
          const minX = samples.length
            ? Math.min(...samples)
            : prior.low ?? prior.mean - 4 * (prior.sd || 1);
          const maxX = samples.length
            ? Math.max(...samples)
            : prior.high ?? prior.mean + 4 * (prior.sd || 1);
          const xs = [];
          for (let i = 0; i < 100; i++) xs.push(minX + (i / 99) * (maxX - minX));
          const priorYs = priorPdf(prior, xs);
          const data = [
            { x: xs, y: priorYs, type: "scatter", mode: "lines", name: "Prior" },
          ];
          if (samples.length) {
            data.unshift({
              x: samples,
              type: "histogram",
              histnorm: "probability density",
              opacity: 0.6,
              name: "Posterior",
            });
          }
          return (
            <Plot
              key={p}
              data={data}
              layout={{
                barmode: "overlay",
                xaxis: { title: p },
                yaxis: { title: "Density" },
                margin: { t: 30 },
              }}
              useResizeHandler
              style={{ width: "100%", height: "400px" }}
              config={{ responsive: true }}
            />
          );
        })}
        <Box sx={{ my: 2 }}>
          <Slider
            value={simIter}
            min={0}
            max={simulationHistory.length}
            step={1}
            marks
            onChange={(_, v) => setSimIter(v)}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Container sx={{ py: 4 }}>
      {config?.objective && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Objective: {config.objective.type}
          </Typography>
          {config.objective.options && (
            <Typography variant="body2">
              {Object.entries(config.objective.options)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </Typography>
          )}
        </Box>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab label="Utility Trajectory" />
        <Tab label="Flow Loss" />
        <Tab label="Posterior Distributions" />
        <Tab label="Design Space" />
        <Tab label="Simulation & Posteriors" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Plot
            data={[{
              x: utilX,
              y: utilY,
              error_y: { type: "data", array: utilErr },
              mode: "lines+markers",
              name: "Utility",
            }]}
            layout={{
              hovermode: "closest",
              xaxis: { title: "Iteration" },
              yaxis: { title: "Utility" },
              margin: { t: 30 },
            }}
            useResizeHandler
            style={{ width: "100%", height: "400px" }}
            config={{ responsive: true }}
          />
          {bestDesign && (
            <Typography sx={{ mt: 2 }}>
              Best design at iteration {bestIter ?? "-"}: {JSON.stringify(bestDesign)} →
              utility = {bestUtility?.toFixed?.(2)}
              {bestUtilitySE ? ` ± ${bestUtilitySE.toFixed(2)} (${bestUtilityCiLower?.toFixed?.(2)}–${bestUtilityCiUpper?.toFixed?.(2)})` : ""}
            </Typography>
          )}
        </Box>
      )}

      {tab === 1 && flowLog && (
        <Plot
          data={[
            { x: flowEpochs, y: trainLoss, mode: "lines", name: "Train" },
            { x: flowEpochs, y: valLoss, mode: "lines", name: "Validation" },
          ]}
          layout={{
            hovermode: "closest",
            xaxis: { title: "Epoch" },
            yaxis: { title: "Loss" },
            margin: { t: 30 },
          }}
          useResizeHandler
          style={{ width: "100%", height: "400px" }}
          config={{ responsive: true }}
        />
      )}

      {tab === 2 && renderSlopePosterior()}

      {tab === 3 && renderDesignSpace()}

      {tab === 4 && renderSimulation()}
    </Container>
  );
}
