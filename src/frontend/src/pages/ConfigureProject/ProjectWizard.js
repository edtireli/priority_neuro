import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api";
import WizardNav from "../../components/WizardNav";
import Step1_Metadata from "./steps/Step1_Metadata";
import Step2_ModelSelection from "./steps/Step2_ModelSelection";
import Step3_Groups from "./steps/Step3_Groups";
import Step4_Priors from "./steps/Step4_Priors";
import Step5_DesignVariables from "./steps/Step5_DesignVariables";
import Step6_Objective from "./steps/Step6_Objective";
import Step7_Constraints from "./steps/Step7_Constraints";
import Step8_MiscSettings from "./steps/Step8_MiscSettings";
import Step9_Review from "./steps/Step9_Review";
import Step10_Submit from "./steps/Step10_Submit";

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
            groups: [],
            priors: {},
            designVariables: [],
            objective: {},
            constraints: {},
            misc: {},
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
        <Step3_Groups config={config} setConfig={setConfig} setStep={setStep} />
      )}
      {step === 4 && (
        <Step4_Priors
          config={config}
          setConfig={setConfig}
          setStep={setStep}
        />
      )}
      {step === 5 && (
        <Step5_DesignVariables
          config={config}
          setConfig={setConfig}
          setStep={setStep}
        />
      )}
      {step === 6 && (
        <Step6_Objective config={config} setConfig={setConfig} setStep={setStep} />
      )}
      {step === 7 && (
        <Step7_Constraints
          config={config}
          setConfig={setConfig}
          setStep={setStep}
        />
      )}
      {step === 8 && (
        <Step8_MiscSettings config={config} setConfig={setConfig} setStep={setStep} />
      )}
      {step === 9 && (
        <Step9_Review config={config} setStep={setStep} />
      )}
      {step === 10 && <Step10_Submit config={config} />}
    </div>
  );
}

export default ProjectWizard;
