import React, { useState, useEffect } from "react";
import { Typography, TextField, Button, Grid, Box } from "@mui/material";

function Step3_Groups({ config, setConfig }) {
  const [groups, setGroups] = useState(config.groups || [
    { name: "", N: 10 },
    { name: "", N: 10 },
  ]);

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
