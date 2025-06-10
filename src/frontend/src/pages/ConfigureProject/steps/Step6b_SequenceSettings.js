import React, { useState, useEffect } from "react";
import { Typography, Select, MenuItem, TextField, Box } from "@mui/material";

function Step6b_SequenceSettings({ config, setConfig }) {
  const init =
    config.objective?.options?.sequenceSettings?.terminationCriterion || {
      type: "posterior_variance",
      threshold: 0.1,
    };
  const [term, setTerm] = useState(init);

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      objective: {
        ...prev.objective,
        options: {
          ...prev.objective.options,
          sequenceSettings: {
            ...(prev.objective.options?.sequenceSettings || {}),
            terminationCriterion: term,
          },
        },
      },
    }));
  }, [term, setConfig]);

  return (
    <div>
      <h3>Sequence Settings</h3>
      <Typography sx={{ mb: 2 }}>
        Configure when the optimiser should stop running.
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Select
          fullWidth
          value={term.type}
          onChange={(e) => setTerm((p) => ({ ...p, type: e.target.value }))}
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
        value={term.threshold}
        onChange={(e) =>
          setTerm((p) => ({ ...p, threshold: Number(e.target.value) }))
        }
      />
    </div>
  );
}

export default Step6b_SequenceSettings;
