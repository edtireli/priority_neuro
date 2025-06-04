import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import WizardNav from "../components/WizardNav";
import Step1_Metadata from "./steps/Step1_Metadata";
import Step2_ModelSelection from "./steps/Step2_ModelSelection";
import Step3_Priors from "./steps/Step3_Priors";
import Step4_DesignVariables from "./steps/Step4_DesignVariables";
import Step5_Objective from "./steps/Step5_Objective";
import Step6_Constraints from "./steps/Step6_Constraints";
import Step7_ReviewSubmit from "./steps/Step7_ReviewSubmit";

function ProjectWizard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState(1);

  useEffect(() => {
    api
      .get(`/projects/${projectId}/config`)
      .then((res) => {
        if (res.data.config) setConfig(res.data.config);
        else
          setConfig({
            metadata: {},
            model: {},
            priors: {},
            designVariables: [],
            objective: {},
            constraints: {},
          });
      })
      .catch(() => navigate("/dashboard"))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  if (loading || !config) return <p>Loading wizard…</p>;

  return (
    <div>
      <h2>Configure Project</h2>
      <WizardNav step={step} setStep={setStep} />
      {step === 1 && (
        <Step1_Metadata config={config} setConfig={setConfig} setStep={setStep} />
      )}
      {step === 2 && (
        <Step2_ModelSelection
          config={config}
          setConfig={setConfig}
          setStep={setStep}
        />
      )}
      {step === 3 && (
        <Step3_Priors config={config} setConfig={setConfig} setStep={setStep} />
      )}
      {step === 4 && (
        <Step4_DesignVariables
          config={config}
          setConfig={setConfig}
          setStep={setStep}
        />
      )}
      {step === 5 && (
        <Step5_Objective config={config} setConfig={setConfig} setStep={setStep} />
      )}
      {step === 6 && (
        <Step6_Constraints
          config={config}
          setConfig={setConfig}
          setStep={setStep}
        />
      )}
      {step === 7 && (
        <Step7_ReviewSubmit config={config} projectId={projectId} />
      )}
    </div>
  );
}

export default ProjectWizard;
