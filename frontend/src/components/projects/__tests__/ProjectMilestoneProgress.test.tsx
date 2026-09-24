import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectMilestoneProgress } from '../ProjectMilestoneProgress';

describe('ProjectMilestoneProgress Component', () => {
  it('handles 0 / 0 milestones gracefully without NaN', () => {
    render(<ProjectMilestoneProgress total={0} completed={0} />);
    const container = screen.getByTestId('project-milestone-progress');
    expect(container).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('(0 of 0 completed)')).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar', { name: /project execution progress/i });
    expect(progressbar).toHaveAttribute('aria-valuenow', '0');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders partial progress correctly', () => {
    render(<ProjectMilestoneProgress total={4} completed={1} />);
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('(1 of 4 completed)')).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '25');
  });

  it('renders 100% completed progress', () => {
    render(<ProjectMilestoneProgress total={3} completed={3} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('(3 of 3 completed)')).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
  });

  it('uses explicitly provided progressPercentage when available', () => {
    render(
      <ProjectMilestoneProgress
        total={10}
        completed={5}
        progressPercentage={50.0}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('(5 of 10 completed)')).toBeInTheDocument();
  });
});
