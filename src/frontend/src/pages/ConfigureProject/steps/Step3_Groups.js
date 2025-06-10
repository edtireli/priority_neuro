import React, { useState, useEffect } from "react";
import { Typography, TextField, Button, Grid, Box, Select, MenuItem } from "@mui/material";

function Step3_Groups({ config, setConfig }) {
  const [groups, setGroups] = useState(
    config.groups || [
      { name: "", N: 10 },
      { name: "", N: 10 },
    ]
  );
  const samples = config.metadata?.dataSamples || {};
  const stringColumns = Object.keys(samples).filter((c) =>
    samples[c].some((v) => typeof v === "string")
  );
  const defaultCol = (() => {
    const lower = stringColumns.map((c) => c.toLowerCase());
    let idx = lower.indexOf("group");
    if (idx === -1) idx = lower.indexOf("groups");
    return idx !== -1 ? stringColumns[idx] : "";
  })();
  const [selectedCol, setSelectedCol] = useState(defaultCol);

  // When a data column with strings is selected, derive groups from unique names
  useEffect(() => {
    if (selectedCol && samples[selectedCol]) {
      const vals = samples[selectedCol].map((v) => String(v));
      const unique = Array.from(new Set(vals));
      const guessed = unique.map((n) => ({
        name: n,
        N: vals.filter((v) => String(v) === n).length,
      }));
      setGroups(guessed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCol]);

  useEffect(() => {
    setConfig((prev) => ({ ...prev, groups }));
  }, [groups, setConfig]);

  const updateGroup = (idx, field, value) => {
    const newGroups = groups.map((g, i) =>
      i === idx ? { ...g, [field]: value } : g
    );
    setGroups(newGroups);
  };

  const addGroup = () => {
    if (groups.length >= 5) return;
    setGroups((prev) => [...prev, { name: "", N: 10 }]);
  };

  const removeGroup = (idx) => {
    setGroups((prev) => prev.filter((_, i) => i !== idx));
  };


  return (
    <div>
      <h3>Define Experimental Groups</h3>
      <Typography sx={{ mb: 2 }}>
        Step 3: Define experimental groups and sample sizes, e.g.
        Control N=20, Treatment N=20.
      </Typography>
      {stringColumns.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Select column containing group labels
          </Typography>
          <Select
            value={selectedCol}
            onChange={(e) => setSelectedCol(e.target.value)}
            fullWidth
          >
            {stringColumns.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}
      {Array.isArray(groups) &&
        groups.map((g, idx) => (
        <Box key={idx} sx={{ mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={5}>
              <TextField
                label="Group Name"
                value={g.name}
                onChange={(e) => updateGroup(idx, "name", e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Sample Size"
                type="number"
                value={g.N}
                onChange={(e) => updateGroup(idx, "N", Number(e.target.value))}
                inputProps={{ min: 1 }}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={3}>
              {groups.length > 2 && (
                <Button onClick={() => removeGroup(idx)}>Remove</Button>
              )}
            </Grid>
          </Grid>
        </Box>
        ))}
      <Button
        variant="outlined"
        onClick={addGroup}
        sx={{ mb: 2 }}
        disabled={groups.length >= 5}
      >
        Add Group
      </Button>
      {/* Navigation handled by WizardNav */}
    </div>
  );
}

export default Step3_Groups;
