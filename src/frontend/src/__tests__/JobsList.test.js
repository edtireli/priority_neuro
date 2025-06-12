import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({ get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } }),
  },
}), { virtual: true });

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } },
}));

const api = require('../api').default;
const JobsPage = require('../pages/JobsPage').default;

function setup() {
  api.get.mockImplementation((url) => {
    if (url === '/projects') return Promise.resolve({ data: [{ id: 1, name: 'P1' }] });
    if (url === '/jobs') return Promise.resolve({ data: [{ id: 'j1', project_id: 1, status: 'succeeded', config: { objective: { type: 'information_gain' } } }] });
    if (url === '/projects/1/jobs/j1/metrics')
      return Promise.resolve({ data: [{ iteration: 1, information_gain: 0.5 }, { iteration: 2, information_gain: 0.7 }] });
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <JobsPage />
    </MemoryRouter>
  );
}

test('sparkline uses outcome specific metric', async () => {
  setup();
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  const svg = await screen.findByLabelText('Information Gain sparkline');
  expect(svg).toBeInTheDocument();
  const title = svg.querySelector('title');
  expect(title.textContent).toContain('0.5');
  expect(title.textContent).toContain('bits');
});
