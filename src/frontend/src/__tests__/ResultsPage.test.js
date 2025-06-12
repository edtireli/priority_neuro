import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

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

const ResultsPage = require('../pages/ResultsPage').default;

function renderPage(outcome, configExtras = {}) {
  const meta = require('../meta/outcomeMeta').default[outcome];
  const summary = {};
  meta.summaryMetrics.forEach((m) => {
    summary[m.key] = 42;
  });
  api.get.mockImplementation((url) => {
    if (url.includes('metrics')) return Promise.resolve({ data: [] });
    if (url.endsWith('results')) return Promise.resolve({ data: { summary } });
    if (url.endsWith('results-detailed')) return Promise.resolve({ data: { series: [] } });
    if (url.includes('flow_log')) return Promise.resolve({ data: [] });
    if (url.includes('config'))
      return Promise.resolve({ data: { config: { objective: { type: outcome }, ...configExtras } } });
    return Promise.resolve({ data: {} });
  });
  return render(
    <MemoryRouter initialEntries={[`/projects/1/jobs/1/results`]}>
      <Routes>
        <Route path='/projects/:projectId/jobs/:jobId/results' element={<ResultsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResultsPage', () => {
  test.each([
    'group_separation',
    'information_gain',
    'training_efficiency',
    'sequence_optimization',
  ])('renders tabs for %s', async (outcome) => {
    renderPage(outcome);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const meta = require('../meta/outcomeMeta').default[outcome];
    for (const c of meta.chartComponents) {
      expect(await screen.findByRole('tab', { name: c.label })).toBeInTheDocument();
    }
    expect(screen.getByRole('tab', { name: 'Raw JSON' })).toBeInTheDocument();
  });
});

test('renders chart when tab selected and passes props', async () => {
  jest.resetModules();
  const LineChart = jest.fn(() => <div data-testid="lc" />);
  jest.doMock('../charts/LineChart', () => ({ __esModule: true, default: LineChart }));
  const Page = require('../pages/ResultsPage').default;
  render(
    <MemoryRouter initialEntries={[`/projects/1/jobs/1/results`]}>
      <Routes>
        <Route path='/projects/:projectId/jobs/:jobId/results' element={<Page />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  const meta = require('../meta/outcomeMeta').default['information_gain'];
  const tabEl = await screen.findByRole('tab', { name: meta.chartComponents[0].label });
  tabEl.click();
  await waitFor(() => expect(LineChart).toHaveBeenCalled());
  const props = LineChart.mock.calls[0][0];
  expect(props).toMatchObject({ xKey: meta.xKey, yKey: meta.yKey, dataKey: meta.dataKey, units: meta.units, seKey: meta.seKey });
});

test('raw json tab', async () => {
  renderPage('group_separation');
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  const rawTab = screen.getByRole('tab', { name: 'Raw JSON' });
  rawTab.click();
  expect(await screen.findByLabelText('Raw JSON data')).toBeInTheDocument();
});

test('filter slider updates chart props', async () => {
  jest.resetModules();
  const Scatter = jest.fn(() => <div data-testid="scatter" />);
  jest.doMock('../charts/ScatterPlot', () => ({ __esModule: true, default: Scatter }));
  const Page = require('../pages/ResultsPage').default;
  const meta = require('../meta/outcomeMeta').default['group_separation'];
  const summary = {};
  meta.summaryMetrics.forEach(m => (summary[m.key] = 1));
  api.get.mockImplementation((url) => {
    if (url.includes('metrics')) return Promise.resolve({ data: [] });
    if (url.endsWith('results')) return Promise.resolve({ data: { summary } });
    if (url.endsWith('results-detailed'))
      return Promise.resolve({ data: { series: [{ x: 0.2, iteration: 1, separation: 0.5 }, { x: 0.8, iteration: 2, separation: 0.6 }] } });
    if (url.includes('flow_log')) return Promise.resolve({ data: [] });
    if (url.includes('config'))
      return Promise.resolve({ data: { config: { objective: { type: 'group_separation' }, designVariables: [{ name: 'x', range: [0, 1] }] } } });
    return Promise.resolve({ data: {} });
  });
  render(
    <MemoryRouter initialEntries={[`/projects/1/jobs/1/results`]}>
      <Routes>
        <Route path='/projects/:projectId/jobs/:jobId/results' element={<Page />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  const slider = screen.getByRole('slider');
  slider.focus();
  await waitFor(() => {
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(Scatter).toHaveBeenCalled();
});

test('categorical filter shows select', async () => {
  renderPage('group_separation', { designVariables: [{ name: 'cat', type: 'categorical', levels: ['a', 'b'] }] });
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(screen.getByRole('combobox')).toBeInTheDocument();
});

test('matches snapshot', async () => {
  const tree = renderPage('group_separation');
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(tree.asFragment()).toMatchSnapshot();
});
