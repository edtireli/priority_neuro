import api from '../api';

export async function fetchModelTemplates() {
  const res = await api.get('/api/models/templates');
  return res.data;
}

export async function validateCustomModel(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/api/models/custom/validate', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function uploadPilotData(projectId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/api/projects/${projectId}/pilot-data/validate`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function submitJob(projectId, payload) {
  const res = await api.post(`/api/projects/${projectId}/jobs`, payload);
  return res.data;
}

