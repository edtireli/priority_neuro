import React, { useState } from "react";
import { TextField, Button, Grid, Box } from "@mui/material";

function Step3_Groups({ config, setConfig, setStep }) {
  const [groups, setGroups] = useState(config.groups || [
    { name: "", N: 10 },
    { name: "", N: 10 },
  ]);

  const updateGroup = (idx, field, value) => {
    const newGroups = groups.map((g, i) =>
      i === idx ? { ...g, [field]: value } : g
    );
    setGroups(newGroups);
  };

  const addGroup = () => {
    if (groups.length >= 5) return;
    setGroups([...groups, { name: "", N: 10 }]);
  };

  const removeGroup = (idx) => {
    setGroups(groups.filter((_, i) => i !== idx));
  };

  const onNext = () => {
    for (const g of groups) {
      if (!g.name.trim()) {
        alert("Group names required");
        return;
      }
      if (g.N < 1) {
        alert("Sample size must be >=1");
        return;
      }
    }
    const names = groups.map((g) => g.name.trim());
    if (new Set(names).size !== names.length) {
      alert("Group names must be unique");
      return;
    }
    setConfig((prev) => ({ ...prev, groups }));
    setStep(4);
  };

  return (
    <div>
      <h3>Define Experimental Groups</h3>
      {groups.map((g, idx) => (
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
      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button variant="contained" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <Button variant="contained" color="primary" onClick={onNext}>
          Next
        </Button>
      </Box>
    </div>
  );
}

export default Step3_Groups;
