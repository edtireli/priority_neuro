export function validateMetadata(data) {
  const errors = {};
  if (!data.name || data.name.trim() === '') {
    errors.name = 'Name is required';
  } else if (data.name.length > 100) {
    errors.name = 'Name too long';
  }
  if (data.contact_email && !/.+@.+\..+/.test(data.contact_email)) {
    errors.contact_email = 'Invalid email';
  }
  if (!data.data_modality) {
    errors.data_modality = 'Select a modality';
  }
  return errors;
}

