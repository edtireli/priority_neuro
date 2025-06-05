import { render, screen } from '@testing-library/react';
import Step5_DesignVariables from '../pages/ConfigureProject/steps/Step5_DesignVariables';

test('default experimental mode is batch', () => {
  const config = { designVariables: [], trialBudget: 10 };
  render(<Step5_DesignVariables config={config} setConfig={() => {}} setStep={() => {}} />);
  expect(screen.getByText('Experimental Mode:')).toBeInTheDocument();
  expect(screen.getByText(/Batch/)).toBeInTheDocument();
});
