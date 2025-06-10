import React, { useState, useEffect } from "react";
import {
  Typography,
  Select,
  MenuItem,
  TextField,
  Box,
  FormControlLabel,
  Checkbox,
} from "@mui/material";

function Step6b_SequenceSettings({ config, setConfig }) {
  if (config.objective?.type !== "sequence_optimization") return null;

  const init =
    config.objective?.options?.sequenceSettings || {
      agentType: "thompson",
      stateWindow: 1,
      enableGPSurrogate: false,
      explorationRate: 0.0,
      trialBudget: 10,
      terminationCriterion: { type: "posterior_variance", threshold: 0.1 },
    };
  const [settings, setSettings] = useState(init);

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      objective: {
        ...prev.objective,
        options: {
          ...prev.objective.options,
          sequenceSettings: settings,
        },
      },
    }));
  }, [settings, setConfig]);

  return (
    <div>
      <h3>Sequence Settings</h3>
      <Typography sx={{ mb: 2 }}>
        Configure the parameters for the sequence optimisation algorithm.
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Select
          fullWidth
          value={settings.agentType}
          onChange={(e) =>
            setSettings((p) => ({ ...p, agentType: e.target.value }))
          }
        >
          <MenuItem value="thompson">Thompson Bandit</MenuItem>
          <MenuItem value="gp">Gaussian Process</MenuItem>
        </Select>
      </Box>
      <TextField
        fullWidth
        type="number"
        sx={{ mb: 2 }}
        label="State Window"
        value={settings.stateWindow}
        onChange={(e) =>
          setSettings((p) => ({
            ...p,
            stateWindow: Number(e.target.value),
          }))
        }
      />
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={settings.enableGPSurrogate}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  enableGPSurrogate: e.target.checked,
                }))
              }
            />
          }
          label="Enable GP Surrogate"
        />
      </Box>
      <TextField
        fullWidth
        type="number"
        sx={{ mb: 2 }}
        label="Exploration Rate"
        value={settings.explorationRate}
        onChange={(e) =>
          setSettings((p) => ({
            ...p,
            explorationRate: Number(e.target.value),
          }))
        }
      />
      <TextField
        fullWidth
        type="number"
        sx={{ mb: 2 }}
        label="Trial Budget"
        value={settings.trialBudget}
        onChange={(e) =>
          setSettings((p) => ({
            ...p,
            trialBudget: Number(e.target.value),
          }))
        }
      />
      <Typography sx={{ mb: 1 }}>Termination Criterion</Typography>
      <Box sx={{ mb: 2 }}>
        <Select
          fullWidth
          value={settings.terminationCriterion.type}
          onChange={(e) =>
            setSettings((p) => ({
              ...p,
              terminationCriterion: {
                ...p.terminationCriterion,
                type: e.target.value,
              },
            }))
          }
        >
          <MenuItem value="posterior_variance">Posterior Variance</MenuItem>
          <MenuItem value="cumulative_reward">Cumulative Reward</MenuItem>
          <MenuItem value="last_accuracy">Last Accuracy</MenuItem>
        </Select>
      </Box>
      <TextField
        fullWidth
        type="number"
        label="Threshold"
        value={settings.terminationCriterion.threshold}
        onChange={(e) =>
          setSettings((p) => ({
            ...p,
            terminationCriterion: {
              ...p.terminationCriterion,
              threshold: Number(e.target.value),
            },
          }))
        }
      />
    </div>
  );
}

export default Step6b_SequenceSettings;
