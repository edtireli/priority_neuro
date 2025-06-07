import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RunOptimisationPage from '../pages/RunOptimisationPage';
import api from '../api';

jest.mock('../api');

describe('RunOptimisationPage', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { jobs: [] } });
  });

  test('renders empty state', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/1/jobs']}>
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<RunOptimisationPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/No jobs yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start New Optimization/i })).toBeInTheDocument();
  });

  test('button disabled when starting a job', async () => {
    api.post.mockResolvedValue({ data: { id: 'j1', status: 'queued' } });
    render(
      <MemoryRouter initialEntries={['/projects/1/jobs']}>
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<RunOptimisationPage />} />
        </Routes>
      </MemoryRouter>
    );
    const button = await screen.findByRole('button', { name: /Start New Optimization/i });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
