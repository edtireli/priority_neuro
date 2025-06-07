import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({
      post: jest.fn(),
      get: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    }),
  },
}), { virtual: true });
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));
const api = require('../api').default;
const Step10_Submit = require('../pages/ConfigureProject/steps/Step10_Submit').default;

test('submits config payload', async () => {
  const cfg = {
    metadata: {},
    model: {},
    groups: [],
    priors: {},
    designVariables: [],
    objective: {},
    constraints: {},
    misc: { jobName: 'Test Job' },
    trialBudget: 1,
    experimentalMode: 'batch',
  };
  api.post.mockResolvedValue({ data: { job_id: 'j1' } });
  render(
    <MemoryRouter initialEntries={['/projects/1/submit']}>
      <Routes>
        <Route path="/projects/:projectId/submit" element={<Step10_Submit config={cfg} />} />
      </Routes>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /run optimization/i }));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  const payload = api.post.mock.calls[0][1];
  expect(payload).toHaveProperty('config');
  expect(payload).not.toHaveProperty('advanced_options');
});
