import React, { useEffect, useState } from "react";
import api from "../../api";

function Step2_ModelSelection({ config, setConfig, setStep }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(config.model.templateName || "");
  const [customFile, setCustomFile] = useState(null);
  const [schema, setSchema] = useState(config.model.parameters || null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/templates")
      .then((res) => setTemplates(res.data))
      .catch(() => setError("Could not load templates"));
  }, []);

  const chooseBuiltIn = (e) => {
    const name = e.target.value;
    setSelectedTemplate(name);
    setCustomFile(null);
    setError("");
    api
      .get(`/templates/${name}/schema`)
      .then((res) => {
        setSchema(res.data);
        setConfig((prev) => ({
          ...prev,
          model: { type: "built-in", templateName: name, parameters: res.data.parameters },
        }));
      })
      .catch(() => setError("Could not fetch template schema"));
  };

  const uploadCustom = (e) => {
    setCustomFile(e.target.files[0]);
    setSelectedTemplate("");
    setSchema(null);
    setError("");
  };

  const submitCustom = async () => {
    if (!customFile) return setError("Please select a Python file");
    const form = new FormData();
    form.append("file", customFile);
    form.append("project_id", config.metadata.id || config.id);
    try {
      const res = await api.post("/templates/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSchema(res.data.schema);
      setConfig((prev) => ({
        ...prev,
        model: { type: "custom", customFileName: customFile.name, parameters: res.data.schema.parameters },
      }));
    } catch {
      setError("Upload failed or invalid model file");
    }
  };

  const onNext = () => {
    if (schema) setStep(3);
    else setError("Please select a template or upload a valid custom model");
  };

  return (
    <div>
      <h3>Choose Model</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div>
        <label>Built-in Templates:</label>
        <select value={selectedTemplate} onChange={chooseBuiltIn}>
          <option value="">-- Select a template --</option>
          {templates.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {schema && selectedTemplate && (
        <div>
          <h4>Template Schema:</h4>
          <pre>{JSON.stringify(schema, null, 2)}</pre>
        </div>
      )}
      <hr />
      <div>
        <label>Or Upload Custom Model (Python file):</label>
        <input type="file" accept=".py" onChange={uploadCustom} />
        <button type="button" onClick={submitCustom}>
          Upload & Validate
        </button>
      </div>
      {schema && config.model.type === "custom" && (
        <div>
          <h4>Custom Schema:</h4>
          <pre>{JSON.stringify(schema, null, 2)}</pre>
        </div>
      )}
      <button type="button" onClick={() => setStep((s) => s - 1)}>
        Back
      </button>
      <button type="button" onClick={onNext}>
        Next
      </button>
    </div>
  );
}

export default Step2_ModelSelection;
