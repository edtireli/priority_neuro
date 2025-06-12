import React, { useEffect, useState } from "react";
import api from "../../../api";
import {
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  Button,
  Box,
  Checkbox,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";

function Step6_Objective({ config, setConfig }) {
  const [type, setType] = useState(config.objective.type || "");
  const [options, setOptions] = useState(config.objective.options || {});
  const [template, setTemplate] = useState(config.objective.template || "");
  const [simulateOnly, setSimulateOnly] = useState(
    config.objective.simulateOnly || false
  );
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    api
      .get("/templates")
      .then((res) => setTemplates(res.data))
      .catch(() => setTemplates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      objective: { type, options, template, simulateOnly },
    }));
  }, [type, options, template, simulateOnly, setConfig]);

  return (
    <div>
      <h3>Select Objective</h3>
      <Typography sx={{ mb: 2 }}>
        Step 6: Select the optimization objective.
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Choose the optimization objective that best fits your experimental goal.
        Below are plain-language descriptions of each option:
      </Typography>
      <RadioGroup value={type} onChange={(e) => setType(e.target.value)}>
        <Box sx={{ mb: 1 }}>
          <FormControlLabel
            value="group_separation"
            control={<Radio />}
            label="Maximize Group Separation"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Optimizes your design to produce the clearest statistical separation
            between experimental groups (e.g. maximizes difference in means).
            Best when you need to detect group differences with highest
            confidence.
          </Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <FormControlLabel
            value="information_gain"
            control={<Radio />}
            label="Maximize Information Gain"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Selects trials that are expected to reduce the most uncertainty about
            your model parameters. Best when you want to learn parameter values
            as quickly as possible.
          </Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <FormControlLabel
            value="sequence_optimization"
            control={<Radio />}
            label="Sequence Optimisation"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Searches for an optimal sequence of actions using a bandit-style
            algorithm. Best when you need an explicit action sequence rather
            than a single design.
          </Typography>
        </Box>
        <Box>
          <FormControlLabel
            value="training_efficiency"
            control={<Radio />}
            label="Minimize Training Time"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Chooses settings that minimize computation time or resource usage per
            trial. Best when you need rapid feedback or have limited compute
            resources.
          </Typography>
        </Box>
      </RadioGroup>
      {[
        "sequence_optimization",
        "group_separation",
        "information_gain",
        "training_efficiency",
      ].includes(type) && (
        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={simulateOnly}
                onChange={(e) => setSimulateOnly(e.target.checked)}
              />
            }
            label="Run on synthetic data"
          />
          <Box sx={{ mt: 2, width: 300 }}>
            <Select
              fullWidth
              value={template}
              displayEmpty
              onChange={(e) => setTemplate(e.target.value)}
            >
              <MenuItem value="">
                <em>-- Select template --</em>
              </MenuItem>
              {templates.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Template</FormHelperText>
          </Box>
        </Box>
      )}
      {/* Navigation handled by WizardNav */}
    </div>
  );
}

export default Step6_Objective;
