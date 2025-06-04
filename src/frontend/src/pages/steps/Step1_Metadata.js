import React from "react";
import { useForm } from "react-hook-form";

function Step1_Metadata({ config, setConfig, setStep }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: config.metadata.name || "",
      description: config.metadata.description || "",
    },
  });

  const onSubmit = (data) => {
    setConfig((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, name: data.name, description: data.description },
    }));
    setStep(2);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Project Name *</label>
        <input {...register("name", { required: true })} />
      </div>
      <div>
        <label>Description</label>
        <textarea {...register("description")} />
      </div>
      <button type="button" onClick={() => setStep((s) => s - 1)}>Back</button>
      <button type="submit">Next</button>
    </form>
  );
}

export default Step1_Metadata;
