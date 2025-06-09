import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Plot from "react-plotly.js";
import {
  Container,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  Tabs,
  Tab,
} from "@mui/material";
import api from "../api";

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
  const dist = prior.dist;
  if (dist === "Normal") {
    const mean = prior.mean || 0;
    const sd = prior.sd || 1;
    return xs.map((x) =>
      (1 / (sd * Math.sqrt(2 * Math.PI))) *
      Math.exp(-0.5 * Math.pow((x - mean) / sd, 2))
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
    return xs.map((x) =>
      x > 0 ? coeff * Math.pow(x, shape - 1) * Math.exp(-x / scale) : 0
    );
  }
  return xs.map(() => 0);
}

export default function JobDetailsPage() {
  const { projectId, jobId } = useParams();
  const [job, setJob] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [result, setResult] = useState(null);
  const [priors, setPriors] = useState(null);
  const [designVars, setDesignVars] = useState([]);
  const [config, setConfig] = useState(null);
  const [flowLog, setFlowLog] = useState(null);
  const [tab, setTab] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJob();
  }, [projectId, jobId]);

  useEffect(() => {
    if (!job) return;
    if (["queued", "running", "paused_awaiting_data"].includes(job.status)) {
      const id = setInterval(fetchJob, 4000);
      return () => clearInterval(id);
    }
  }, [job]);

  useEffect(() => {
    if (!job) return;
    if (["succeeded", "failed"].includes(job.status)) {
      fetchMetrics();
      fetchResult();
      fetchFlowLog();
      fetchConfig();
    }
  }, [job?.status]);

  const fetchJob = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/status`);
      setJob(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/metrics`);
      setMetrics(res.data || []);
    } catch {}
  };

  const fetchResult = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/results-detailed`);
      setResult(res.data);
    } catch {}
  };

  const fetchConfig = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/config`);
      setPriors(res.data.config.priors || {});
      setDesignVars(res.data.config.designVariables || []);
      setConfig(res.data.config);
    } catch {}
  };

  const fetchFlowLog = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/flow_log`);
      let data = res.data;
      if (typeof data === "string") {
        const rows = data.trim().split(/\n/).slice(1);
        const logs = rows.map((r) => {
          const [e, tr, vl] = r.split(/,\s*/);
          return { epoch: Number(e), train_loss: Number(tr), val_loss: Number(vl) };
        });
        setFlowLog(logs);
      } else {
        setFlowLog(data);
      }
    } catch {}
  };

  const uploadPilot = async (file) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("pilot_data", file);
    try {
      const res = await api.post(`/projects/${projectId}/jobs/${jobId}/data`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setJob(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async () => {
    try {
      await api.post(`/projects/${projectId}/jobs/${jobId}/retry`);
      fetchJob();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  if (!job)
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );

  const sortedMetrics = [...metrics].sort((a, b) => a.iteration - b.iteration);
  const utilX = sortedMetrics.map((m) => m.iteration);
  const utilY = sortedMetrics.map((m) => m.utility);

  const flowEpochs = flowLog ? flowLog.map((r) => r.epoch) : [];
  const trainLoss = flowLog ? flowLog.map((r) => r.train_loss) : [];
  const valLoss = flowLog ? flowLog.map((r) => r.val_loss) : [];

  const posteriorSamples = result?.posteriorSamples || result?.summary?.posteriorSamples;

  const renderPosteriorPlots = () => {
    if (!priors) return null;
    const names = Object.keys(priors);
    return names.map((name) => {
      const prior = priors[name];
      let samples = [];
      if (posteriorSamples) {
        samples = posteriorSamples.map((s) => s[name]);
      }
      const minX = samples.length ? Math.min(...samples) : prior.low ?? prior.mean - 4 * (prior.sd || 1);
      const maxX = samples.length ? Math.max(...samples) : prior.high ?? prior.mean + 4 * (prior.sd || 1);
      const xs = [];
      for (let i = 0; i < 100; i++) {
        xs.push(minX + (i / 99) * (maxX - minX));
      }
      const priorYs = priorPdf(prior, xs);
      const data = [];
      if (samples.length) {
        data.push({
          x: samples,
          type: "histogram",
          histnorm: "probability density",
          opacity: 0.6,
          name: "Posterior",
        });
      }
      data.push({ x: xs, y: priorYs, type: "scatter", mode: "lines", name: "Prior" });
      return (
        <Box key={name} sx={{ my: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {name}
          </Typography>
          <Plot
            data={data}
            layout={{
              barmode: "overlay",
              hovermode: "closest",
              xaxis: { title: name },
              yaxis: { title: "Density" },
              margin: { t: 30 },
            }}
            useResizeHandler
            style={{ width: "100%", height: "400px" }}
            config={{ responsive: true }}
          />
        </Box>
      );
    });
  };

  const renderDesignSpaceScatter = () => {
    if (!metrics.length) return null;
    const vars = Object.keys(metrics[0].design_point || {});
    if (vars.length < 2) return null;
    const [xName, yName] = vars;
    const x = metrics.map((m) => m.design_point[xName]);
    const y = metrics.map((m) => m.design_point[yName]);
    const util = metrics.map((m) => m.utility);
    const text = metrics.map((m) =>
      `${vars.map((v) => `${v}: ${m.design_point[v]}`).join(', ')}<br>Utility: ${m.utility}`
    );
    return (
      <Plot
        data={[
          {
            x,
            y,
            mode: 'markers',
            marker: { color: util, colorscale: 'Viridis', colorbar: { title: 'Utility' } },
            text,
            hoverinfo: 'text',
          },
        ]}
        layout={{
          hovermode: 'closest',
          xaxis: { title: xName },
          yaxis: { title: yName },
          margin: { t: 30 },
        }}
        useResizeHandler
        style={{ width: '100%', height: '400px' }}
        config={{ responsive: true }}
      />
    );
  };

  const renderEIGSurface = () => {
    if (designVars.length !== 1) return null;
    const dv = designVars[0];
    if (dv.type !== 'continuous') return null;
    const preds = result?.evaluatedDesigns || [];
    if (!preds.length) return null;
    const sorted = [...preds].sort(
      (a, b) => a.design[dv.name] - b.design[dv.name]
    );
    const xs = sorted.map((p) => p.design[dv.name]);
    const ys = sorted.map((p) => p.utility);
    const evalX = metrics.map((m) => m.design_point[dv.name]);
    const evalY = metrics.map((m) => m.utility);
    return (
      <Plot
        data={[
          { x: xs, y: ys, mode: 'lines', name: 'Predicted EIG' },
          { x: evalX, y: evalY, mode: 'markers', name: 'Evaluated', marker: { color: 'red' } },
        ]}
        layout={{
          hovermode: 'closest',
          xaxis: { title: dv.name },
          yaxis: { title: 'Expected Information Gain' },
          margin: { t: 30 },
        }}
        useResizeHandler
        style={{ width: '100%', height: '400px' }}
        config={{ responsive: true }}
      />
    );
  };

  const renderGroupSeparation = () => {
    if (config?.objective?.type !== 'group_separation') return null;
    const series = result?.summary?.separationSeries;
    if (!series) return null;
    const xs = series.iterations || series.x || series.map((_, i) => i + 1);
    const ys = series.values || series.y || series;
    return (
      <Plot
        data={[{ x: xs, y: ys, mode: 'lines+markers', name: 'Separation' }]}
        layout={{
          hovermode: 'closest',
          xaxis: { title: 'Iteration' },
          yaxis: { title: 'Separation' },
          margin: { t: 30 },
        }}
        useResizeHandler
        style={{ width: '100%', height: '400px' }}
        config={{ responsive: true }}
      />
    );
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Job {job.id}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Typography>Status: {job.status}</Typography>

      {job.status === "running" && job.maxIterations && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress variant="determinate" value={(job.iteration / job.maxIterations) * 100} />
          <Typography sx={{ mt: 1 }}>{Math.round((job.iteration / job.maxIterations) * 100)}%</Typography>
        </Box>
      )}

      {job.status === "paused_awaiting_data" && (
        <Box sx={{ mt: 2 }}>
          <Typography>Awaiting pilot data upload</Typography>
          <Button component="label" variant="contained" sx={{ mt: 1 }} disabled={uploading}>
            Upload File
            <input type="file" accept=".csv" hidden onChange={(e) => uploadPilot(e.target.files[0])} />
          </Button>
        </Box>
      )}

      {["succeeded", "failed"].includes(job.status) && (
        <Box sx={{ mt: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="metrics tabs" sx={{ mb: 2 }}>
            <Tab label="Utility Trajectory" />
            <Tab label="Flow Loss" />
            <Tab label="Posterior vs Prior" />
            <Tab label="Design Space" />
            <Tab label="Objective" />
          </Tabs>
          {tab === 0 && (
            <Plot
              data={[{ x: utilX, y: utilY, mode: "lines+markers", name: "Utility" }]}
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
          {tab === 2 && renderPosteriorPlots()}
          {tab === 3 && (
            <Box>
              {renderDesignSpaceScatter()}
              <Box sx={{ mt: 3 }}>{renderEIGSurface()}</Box>
            </Box>
          )}
          {tab === 4 && renderGroupSeparation()}
        </Box>
      )}

      {job.status === "failed" && (
        <Button sx={{ mt: 2 }} variant="contained" onClick={handleRetry}>
          Retry
        </Button>
      )}
    </Container>
  );
}
