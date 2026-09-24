import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MilestoneStatusBadge } from '../MilestoneStatusBadge';

describe('MilestoneStatusBadge Component', () => {
  it('renders "To do" status badge correctly with accessible aria-label', () => {
    render(<MilestoneStatusBadge status="todo" />);
    const badge = screen.getByTestId('milestone-status-todo');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('To do');
    expect(badge).toHaveAttribute('aria-label', 'Milestone status: To do');
  });

  it('renders "In progress" status badge correctly with accessible aria-label', () => {
    render(<MilestoneStatusBadge status="in_progress" />);
    const badge = screen.getByTestId('milestone-status-in_progress');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('In progress');
    expect(badge).toHaveAttribute('aria-label', 'Milestone status: In progress');
  });

  it('renders "Completed" status badge correctly with accessible aria-label', () => {
    render(<MilestoneStatusBadge status="completed" />);
    const badge = screen.getByTestId('milestone-status-completed');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Completed');
    expect(badge).toHaveAttribute('aria-label', 'Milestone status: Completed');
  });

  it('applies custom className when provided', () => {
    render(<MilestoneStatusBadge status="completed" className="custom-class" />);
    const badge = screen.getByTestId('milestone-status-completed');
    expect(badge).toHaveClass('custom-class');
  });
});
