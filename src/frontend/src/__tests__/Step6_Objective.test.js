import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

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
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));
const api = require('../api').default;
const Step6_Objective = require('../pages/ConfigureProject/steps/Step6_Objective').default;

let currentCfg;
function Wrapper({ cfg }) {
  const [config, setConfig] = React.useState(cfg);
  currentCfg = config;
  return <Step6_Objective config={config} setConfig={setConfig} />;
}

test('checkbox and dropdown persistence', async () => {
  const cfg = { objective: { type: 'sequence_optimization', options: {} } };
  api.get.mockResolvedValue({ data: ['learning_curve'] });
  const { rerender } = render(<Wrapper cfg={cfg} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/templates'));

  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: 'learning_curve' }));
  fireEvent.click(screen.getByLabelText(/Run on synthetic data/i));

  rerender(<Wrapper cfg={currentCfg} />);

  expect(screen.getByRole('combobox').textContent).toMatch(/learning_curve/i);
  expect(screen.getByLabelText(/Run on synthetic data/i)).toBeChecked();
});

test.each([
  'group_separation',
  'information_gain',
  'training_efficiency',
])('simulate controls for %s', async (objType) => {
  const cfg = { objective: { type: objType, options: {} } };
  api.get.mockResolvedValue({ data: ['learning_curve'] });
  render(<Wrapper cfg={cfg} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/templates'));
  expect(screen.getByLabelText(/Run on synthetic data/i)).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Run on synthetic data/i));
  expect(currentCfg.objective.simulateOnly).toBe(true);
});
