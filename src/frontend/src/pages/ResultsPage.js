import React, { useEffect, useState, lazy, Suspense, useMemo } from "react";
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
  Select,
  MenuItem,
} from "@mui/material";
import api from "../api";
import stringifyError from "../utils/stringifyError";
import outcomeMeta from "../meta/outcomeMeta";

const componentImports = {
  ScatterPlot: () => import("../charts/ScatterPlot"),
  Heatmap: () => import("../charts/Heatmap"),
  UncertaintyRibbon: () => import("../charts/UncertaintyRibbon"),
  DistributionPlot: () => import("../charts/DistributionPlot"),
  BoxPlot: () => import("../charts/BoxPlot"),
  SensitivityMatrix: () => import("../charts/SensitivityMatrix"),
  StepwiseBarChart: () => import("../charts/StepwiseBarChart"),
  LineChart: () => import("../charts/LineChart"),
  HistogramChart: () => import("../charts/HistogramChart"),
  ROCChart: () => import("../charts/ROCChart"),
  LearningCurveChart: () => import("../charts/LearningCurveChart"),
  ParameterScatter: () => import("../charts/ParameterScatter"),
};

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
  const [detailed, setDetailed] = useState(null);
  const [flowLog, setFlowLog] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState({});
  const [varRanges, setVarRanges] = useState({});
  const [designVars, setDesignVars] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mRes, rRes, dRes, fRes, cRes] = await Promise.all([
          api.get(`/projects/${projectId}/jobs/${jobId}/metrics`),
          api.get(`/projects/${projectId}/jobs/${jobId}/results`),
          api.get(`/projects/${projectId}/jobs/${jobId}/results-detailed`).catch(() => ({ data: null })),
          api.get(`/projects/${projectId}/jobs/${jobId}/flow_log`),
          api.get(`/projects/${projectId}/config`),
        ]);
        setMetrics(mRes.data || []);
        setResult(rRes.data || null);
        setDetailed(dRes.data || null);
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

  useEffect(() => {
    const vars = config?.designVariables || [];
    setDesignVars(vars);
    const initial = {};
    const ranges = {};
    vars.forEach((v) => {
      if (v.type === "categorical") {
        initial[v.name] = v.levels?.[0] || "";
        ranges[v.name] = v.levels || [];
      } else {
        const range = v.range || [0, 1];
        initial[v.name] = [...range];
        ranges[v.name] = [...range];
      }
    });
    setFilters(initial);
    setVarRanges(ranges);
  }, [config]);

  const outcome = config?.objective?.type;
  const meta = outcomeMeta[outcome] || {};

  const lazyComponents = useMemo(() => {
    const comps = {};
    (meta.chartComponents || []).forEach((c) => {
      comps[c.name] = lazy(componentImports[c.name]);
    });
    return comps;
  }, [outcome]);

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

  const formatValue = (v) => {
    if (v === null || v === undefined) return "\u2013";
    if (typeof v !== "number") return String(v);
    if (meta.units === "%") {
      return `${(v * 100).toFixed(1)}%`;
    }
    const abs = Math.abs(v);
    const num = abs > 1000 || abs < 0.001 ? v.toExponential(2) : v.toFixed(2);
    return meta.units ? `${num} ${meta.units}` : num;
  };

  const applyFilters = (data) => {
    if (!data || !Object.keys(filters).length) return data;
    return data.filter((d) =>
      Object.entries(filters).every(([k, val]) => {
        if (Array.isArray(val) && val.length === 2 && val.every((v) => typeof v === "number")) {
          const [min, max] = val;
          return d[k] === undefined || (d[k] >= min && d[k] <= max);
        }
        return true;
      })
    );
  };

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

      {meta.summaryMetrics && (
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          {meta.summaryMetrics.map((m) => (
            <Box key={m.key} sx={{ p: 1, border: "1px solid", borderRadius: 1 }}>
              <Typography variant="subtitle2">{m.label}</Typography>
              <Typography>{formatValue(result?.summary?.[m.key])}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {designVars.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {designVars.map((v) => (
            <Box key={v.name} sx={{ mb: 2 }}>
              <Typography id={`label-${v.name}`} gutterBottom>
                {v.name}
              </Typography>
              {v.type === "categorical" ? (
                <Select
                  labelId={`label-${v.name}`}
                  value={filters[v.name] || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, [v.name]: e.target.value }))
                  }
                >
                  {(varRanges[v.name] || []).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Slider
                  value={filters[v.name] || [0, 0]}
                  min={varRanges[v.name]?.[0]}
                  max={varRanges[v.name]?.[1]}
                  onChange={(_, val) =>
                    setFilters((prev) => ({
                      ...prev,
                      [v.name]: val,
                    }))
                  }
                  valueLabelDisplay="auto"
                  aria-labelledby={`label-${v.name}`}
                  aria-valuetext={`${filters[v.name]?.[0]} to ${filters[v.name]?.[1]}`}
                />
              )}
            </Box>
          ))}
        </Box>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Result charts"
        sx={{ mb: 2 }}
      >
        {meta.chartComponents?.map((c) => (
          <Tab key={c.name} label={c.label} aria-label={c.label} />
        ))}
        <Tab label="Raw JSON" aria-label="Raw JSON" />
      </Tabs>

      {meta.chartComponents?.map((c, i) => {
        const Comp = lazyComponents[c.name];
        return (
          tab === i && (
            <Suspense key={c.name} fallback={<div>Loading...</div>}>
              <Comp
                data={applyFilters(detailed?.series || [])}
                dataGrid={applyFilters(detailed?.grid || [])}
                xKey={meta.xKey}
                yKey={meta.yKey}
                valueKey={meta.dataKey}
                dataKey={meta.dataKey}
                units={meta.units}
                onPointClick={setSelectedIdx}
                samples={detailed?.samples || []}
                replicateMetrics={detailed?.replicates || []}
                sequenceSteps={detailed?.sequence || []}
                multiParamData={detailed?.matrix || []}
              />
            </Suspense>
          )
        );
      })}
      {tab === (meta.chartComponents?.length || 0) && (
        <Box sx={{ maxHeight: 400, overflow: "auto", fontFamily: "monospace" }}>
          <pre aria-label="Raw JSON data">{JSON.stringify(config, null, 2)}</pre>
        </Box>
      )}
    </Container>
  );
}
