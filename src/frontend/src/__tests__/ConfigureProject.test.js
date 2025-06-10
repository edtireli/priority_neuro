import { render, screen } from '@testing-library/react';
import Step4_DesignVariables from '../pages/ConfigureProject/steps/Step4_DesignVariables';

test('default experimental mode is sequential', () => {
  const config = { designVariables: [], trialBudget: 10 };
  render(<Step4_DesignVariables config={config} setConfig={() => {}} setStep={() => {}} />);
  expect(screen.getByText('Experimental Mode:')).toBeInTheDocument();
  // the select should display "Sequential" by default
  const combo = screen.getByRole('combobox');
  expect(combo.textContent).toMatch(/Sequential/i);
});
