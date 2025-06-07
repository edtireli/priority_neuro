import React from 'react';

export default function stringifyError(err) {
  if (!err) return '';
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return (
      <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
        {detail.map((e, i) => (
          <li key={i}>{typeof e === 'string' ? e : e.msg || JSON.stringify(e)}</li>
        ))}
      </ul>
    );
  }
  if (typeof err === 'string') return err;
  if (Array.isArray(err)) {
    return (
      <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
        {err.map((e, i) => (
          <li key={i}>{e.msg || JSON.stringify(e)}</li>
        ))}
      </ul>
    );
  }
  return err.msg || JSON.stringify(err);
}
