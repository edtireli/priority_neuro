import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Slider,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
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
  const navigate = useNavigate();
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
  const [pilotData, setPilotData] = useState(null);
  const [simDesign, setSimDesign] = useState({});
  const [predUtil, setPredUtil] = useState(null);

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
      fetchPilotData();
    } else if (job.status === "running") {
      fetchMetrics();
      fetchPilotData();
      if (!config) fetchConfig();
    }
  }, [job?.status]);

  useEffect(() => {
    if (!designVars.length) return;
    if (Object.keys(simDesign).length === 0) {
      const init = {};
      designVars.forEach((dv) => {
        if (dv.type === "continuous") init[dv.name] = dv.range[0];
        else init[dv.name] = dv.values[0];
      });
      setSimDesign(init);
    }
  }, [designVars]);

  useEffect(() => {
    if (Object.keys(simDesign).length) {
      setPredUtil(computePrediction(simDesign));
    }
  }, [simDesign, metrics]);

  const fetchJob = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/status`);
      setJob(res.data);
      if (res.data.status === "running") {
        fetchMetrics();
        fetchPilotData();
        if (!config) fetchConfig();
      }
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

  const fetchPilotData = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/data`);
      setPilotData(res.data);
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

  const computePrediction = (design) => {
    if (!metrics.length) return null;
    const dvars = Object.keys(design);
    let best = null;
    metrics.forEach((m) => {
      let dist = 0;
      dvars.forEach((n) => {
        const a = m.design_point[n];
        const b = design[n];
        dist += (a - b) * (a - b);
      });
      dist = Math.sqrt(dist);
      if (!best || dist < best.dist) best = { dist, util: m.utility };
    });
    return best ? best.util : null;
  };


  const downloadHtmlReport = () => {
    const plots = document.querySelectorAll(".js-plotly-plot");
    let body = "<html><head><script src='https://cdn.plot.ly/plotly-2.26.0.min.js'></script></head><body>";
    plots.forEach((p, idx) => {
      const data = p.data || [];
      const layout = p.layout || {};
      body += `<div id="plot${idx}" style="width:600px;height:400px;"></div>`;
      body += `<script>Plotly.newPlot('plot${idx}', ${JSON.stringify(data)}, ${JSON.stringify(layout)});</script>`;
    });
    body += "</body></html>";
    const blob = new Blob([body], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${jobId}-report.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderPilotScatter = () => {
    if (!pilotData || !Array.isArray(pilotData) || pilotData.length === 0)
      return null;
    const keys = Object.keys(pilotData[0]);
    if (keys.length < 2) return null;
    const [xKey, yKey] = keys;
    const x = pilotData.map((d) => parseFloat(d[xKey]));
    const y = pilotData.map((d) => parseFloat(d[yKey]));
    return (
      <Plot
        data={[{ x, y, mode: "markers" }]}
        layout={{
          margin: { t: 30 },
          xaxis: { title: xKey },
          yaxis: { title: yKey },
        }}
        style={{ width: "100%", height: "300px" }}
        useResizeHandler
      config={{ responsive: true }}
      />
    );
  };

  const renderDataWithPrior = () => {
    if (
      !pilotData ||
      !Array.isArray(pilotData) ||
      pilotData.length === 0 ||
      !priors
    )
      return null;
    const keys = Object.keys(pilotData[0]);
    if (keys.length < 2) return null;
    const yKey = keys[1];
    const yVals = pilotData.map((d) => parseFloat(d[yKey]));
    const prior = priors[yKey];
    if (!prior) return null;
    const minX = Math.min(
      ...yVals,
      prior.low ?? prior.mean - 4 * (prior.sd || 1)
    );
    const maxX = Math.max(
      ...yVals,
      prior.high ?? prior.mean + 4 * (prior.sd || 1)
    );
    const xs = [];
    for (let i = 0; i < 100; i++) xs.push(minX + (i / 99) * (maxX - minX));
    const priorYs = priorPdf(prior, xs);
    return (
      <Plot
        data={[
          {
            x: yVals,
            type: "histogram",
            histnorm: "probability density",
            opacity: 0.6,
            name: "Data",
          },
          { x: xs, y: priorYs, type: "scatter", mode: "lines", name: "Prior" },
        ]}
        layout={{
          barmode: "overlay",
          hovermode: "closest",
          xaxis: { title: yKey },
          yaxis: { title: "Density" },
          margin: { t: 30 },
        }}
        style={{ width: "100%", height: "300px" }}
        useResizeHandler
        config={{ responsive: true }}
      />
    );
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
    <Container
      sx={{
        py: 4,
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(0,0,0,0.6)"
            : "rgba(255,255,255,0.8)",
        borderRadius: 2,
        p: 3,
      }}
    >
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
          {config?.metadata?.description && (
            <Typography sx={{ mb: 2 }}>{config.metadata.description}</Typography>
          )}
          {renderDataWithPrior()}
          <Box sx={{ mt: 3 }}>
            <Plot
              data={[{ x: utilX, y: utilY, mode: "lines+markers", name: "Utility" }]}
              layout={{
                hovermode: "closest",
                xaxis: { title: "Iteration" },
                yaxis: { title: "Utility" },
                margin: { t: 30 },
              }}
              useResizeHandler
              style={{ width: "100%", height: "300px" }}
              config={{ responsive: true }}
            />
          </Box>
          <LinearProgress
            sx={{ mt: 2 }}
            variant="determinate"
            value={(job.iteration / job.maxIterations) * 100}
          />
          <Typography sx={{ mt: 1 }}>
            {Math.round((job.iteration / job.maxIterations) * 100)}%
          </Typography>
        </Box>
      )}

      {job.status === "paused_awaiting_data" && (
        <Box sx={{ mt: 2 }}>
          <Typography>Awaiting pilot data upload</Typography>
          <Button component="label" variant="contained" sx={{ mt: 1 }} disabled={uploading}>
            Upload File
            <input type="file" accept=".csv" hidden onChange={(e) => uploadPilot(e.target.files[0])} />
          </Button>
          <Box sx={{ mt: 2 }}>{renderPilotScatter()}</Box>
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
            <Tab label="Data & Export" />
            <Tab label="Simulator" />
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
          {tab === 5 && (
            <Box>
              <DataGrid
                autoHeight
                rows={sortedMetrics.map((m, i) => ({ id: i, ...m }))}
                columns={[
                  { field: "iteration", headerName: "Iter", width: 80 },
                  {
                    field: "design_point",
                    headerName: "Design",
                    flex: 1,
                    valueGetter: (p) => JSON.stringify(p.row.design_point),
                  },
                  { field: "utility", headerName: "Utility", width: 100 },
                  {
                    field: "trend",
                    headerName: "Trend",
                    width: 100,
                    renderCell: (params) => {
                      const idx = params.row.iteration - 1;
                      const win = sortedMetrics.slice(
                        Math.max(0, idx - 4),
                        idx + 1
                      );
                      const xs = win.map((_, i) => i);
                      const min = Math.min(...win.map((w) => w.utility));
                      const max = Math.max(...win.map((w) => w.utility));
                      const range = max - min || 1;
                      const pts = win
                        .map((w, i) => `${(i / (xs.length - 1)) * 80},${
                          20 - ((w.utility - min) / range) * 20
                        }`)
                        .join(" ");
                      return (
                        <svg width={80} height={20}>
                          <polyline
                            fill="none"
                            stroke="#1976d2"
                            strokeWidth={2}
                            points={pts}
                          />
                        </svg>
                      );
                    },
                  },
                ]}
              />
              {pilotData && Array.isArray(pilotData) && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">Pilot Preview</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {Object.keys(pilotData[0] || {}).map((k) => (
                          <TableCell key={k}>{k}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pilotData.slice(0, 5).map((r, i) => (
                        <TableRow key={i}>
                          {Object.keys(pilotData[0] || {}).map((k) => (
                            <TableCell key={k}>{r[k]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {pilotData.length > 0 && (
                    <Plot
                      data={[
                        {
                          x: pilotData.map((d) =>
                            parseFloat(d.stimulusIntensity || d.x || d.X)
                          ),
                          y: pilotData.map((d) =>
                            parseFloat(d.reactionTime || d.y || d.Y)
                          ),
                          mode: "markers",
                        },
                      ]}
                      layout={{ margin: { t: 30 }, xaxis: { title: "Stim" }, yaxis: { title: "RT" } }}
                      style={{ width: "100%", height: "300px" }}
                      useResizeHandler
                      config={{ responsive: true }}
                    />
                  )}
                  <Button sx={{ mt: 2, mr: 2 }} variant="outlined" onClick={downloadHtmlReport}>
                    Download HTML Report
                  </Button>
                  <Button
                    sx={{ mt: 2 }}
                    variant="outlined"
                    onClick={() => navigate(`/projects/${projectId}/adaptive`)}
                  >
                    Adaptive Next Step
                  </Button>
                </Box>
              )}
            </Box>
          )}
          {tab === 6 && (
            <Box>
              {designVars.map((dv) => (
                <Box key={dv.name} sx={{ my: 2 }}>
                  <Typography gutterBottom>{dv.name}</Typography>
                  <Slider
                    value={simDesign[dv.name] ?? 0}
                    min={dv.range ? dv.range[0] : 0}
                    max={dv.range ? dv.range[1] : dv.values[0]}
                    step={dv.range ? (dv.range[1] - dv.range[0]) / 100 : 1}
                    onChange={(_, v) =>
                      setSimDesign((prev) => ({ ...prev, [dv.name]: v }))
                    }
                  />
                </Box>
              ))}
              {predUtil !== null && (
                <Plot
                  data={[{
                    type: "indicator",
                    mode: "gauge+number",
                    value: predUtil,
                    gauge: { axis: { range: [Math.min(...utilY), Math.max(...utilY)] } },
                  }]}
                  layout={{ margin: { t: 0, b: 0 } }}
                  style={{ width: 300, height: 200 }}
                  useResizeHandler
                  config={{ responsive: true }}
                />
              )}
            </Box>
          )}
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
