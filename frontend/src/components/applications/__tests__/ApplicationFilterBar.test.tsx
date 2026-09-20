import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicationFilterBar } from '../ApplicationFilterBar';

describe('ApplicationFilterBar Component', () => {
  it('renders search input, status options, and result counts', () => {
    render(
      <ApplicationFilterBar
        statusFilter="all"
        searchQuery=""
        onStatusChange={vi.fn()}
        onSearchChange={vi.fn()}
        onReset={vi.fn()}
        totalCount={10}
        filteredCount={10}
      />
    );

    expect(screen.getByPlaceholderText(/Search applications/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Filter by application status/i })).toBeInTheDocument();
    expect(screen.getByText(/Showing 10 of 10 applications/i)).toBeInTheDocument();
  });

  it('triggers onSearchChange when typing in search input', () => {
    const onSearchChangeMock = vi.fn();

    render(
      <ApplicationFilterBar
        statusFilter="all"
        searchQuery=""
        onStatusChange={vi.fn()}
        onSearchChange={onSearchChangeMock}
        onReset={vi.fn()}
        totalCount={5}
        filteredCount={5}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search applications/i);
    fireEvent.change(searchInput, { target: { value: 'Frontend' } });

    expect(onSearchChangeMock).toHaveBeenCalledWith('Frontend');
  });

  it('triggers onStatusChange when selecting a status option', () => {
    const onStatusChangeMock = vi.fn();

    render(
      <ApplicationFilterBar
        statusFilter="all"
        searchQuery=""
        onStatusChange={onStatusChangeMock}
        onSearchChange={vi.fn()}
        onReset={vi.fn()}
        totalCount={5}
        filteredCount={5}
      />
    );

    const statusSelect = screen.getByRole('combobox', { name: /Filter by application status/i });
    fireEvent.change(statusSelect, { target: { value: 'shortlisted' } });

    expect(onStatusChangeMock).toHaveBeenCalledWith('shortlisted');
  });

  it('shows Clear Filters button when filters are active and calls onReset when clicked', () => {
    const onResetMock = vi.fn();

    const { rerender } = render(
      <ApplicationFilterBar
        statusFilter="all"
        searchQuery=""
        onStatusChange={vi.fn()}
        onSearchChange={vi.fn()}
        onReset={onResetMock}
        totalCount={5}
        filteredCount={5}
      />
    );

    expect(screen.queryByRole('button', { name: /Reset all filters/i })).not.toBeInTheDocument();

    rerender(
      <ApplicationFilterBar
        statusFilter="reviewing"
        searchQuery=""
        onStatusChange={vi.fn()}
        onSearchChange={vi.fn()}
        onReset={onResetMock}
        totalCount={5}
        filteredCount={2}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /Reset all filters/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onResetMock).toHaveBeenCalledTimes(1);
  });
});
