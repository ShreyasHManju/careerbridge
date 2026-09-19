import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobFilterBar } from '../JobFilterBar';
import { JobFilters } from '@/types/job';

describe('JobFilterBar Component', () => {
  const initialFilters: JobFilters = {
    page: 1,
    page_size: 10,
    sort_by: 'created_at',
    sort_order: 'desc',
  };

  it('renders all filter controls properly', () => {
    render(
      <JobFilterBar
        filters={initialFilters}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Keyword Search/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Opportunity Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Employment Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Workplace/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Skills/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Min Salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sort By/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Order/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Filters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear Filters/i })).toBeInTheDocument();
  });

  it('submits filters serialized into JobFilters matching backend contract', () => {
    const onFilterChangeMock = vi.fn();
    render(
      <JobFilterBar
        filters={initialFilters}
        onFilterChange={onFilterChangeMock}
        onReset={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Keyword Search/i), {
      target: { value: 'Frontend Developer' },
    });
    fireEvent.change(screen.getByLabelText(/Opportunity Type/i), {
      target: { value: 'internship' },
    });
    fireEvent.change(screen.getByLabelText(/Employment Type/i), {
      target: { value: 'full_time' },
    });
    fireEvent.change(screen.getByLabelText(/Workplace/i), {
      target: { value: 'true' },
    });
    fireEvent.change(screen.getByLabelText(/Location/i), {
      target: { value: 'Bengaluru' },
    });
    fireEvent.change(screen.getByLabelText(/Skills/i), {
      target: { value: 'React' },
    });
    fireEvent.change(screen.getByLabelText(/Min Salary/i), {
      target: { value: '30000' },
    });
    fireEvent.change(screen.getByLabelText(/Max Salary/i), {
      target: { value: '50000' },
    });
    fireEvent.change(screen.getByLabelText(/Sort By/i), {
      target: { value: 'salary_min' },
    });
    fireEvent.change(screen.getByLabelText(/Order/i), {
      target: { value: 'asc' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Apply Filters/i }));

    expect(onFilterChangeMock).toHaveBeenCalledTimes(1);
    expect(onFilterChangeMock).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      q: 'Frontend Developer',
      opportunity_type: 'internship',
      employment_type: 'full_time',
      is_remote: true,
      location: 'Bengaluru',
      skills: 'React',
      salary_min: 30000,
      salary_max: 50000,
      sort_by: 'salary_min',
      sort_order: 'asc',
    });
  });

  it('validates client-side that salary_min <= salary_max and prevents submission when violated', () => {
    const onFilterChangeMock = vi.fn();
    render(
      <JobFilterBar
        filters={initialFilters}
        onFilterChange={onFilterChangeMock}
        onReset={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Min Salary/i), {
      target: { value: '70000' },
    });
    fireEvent.change(screen.getByLabelText(/Max Salary/i), {
      target: { value: '50000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Apply Filters/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'salary_min cannot be greater than salary_max'
    );
    expect(onFilterChangeMock).not.toHaveBeenCalled();
  });

  it('validates client-side that negative salary values are rejected', () => {
    const onFilterChangeMock = vi.fn();
    render(
      <JobFilterBar
        filters={initialFilters}
        onFilterChange={onFilterChangeMock}
        onReset={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Min Salary/i), {
      target: { value: '-500' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Apply Filters/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Minimum salary must be a positive integer.'
    );
    expect(onFilterChangeMock).not.toHaveBeenCalled();
  });

  it('resets all form fields and triggers onReset when Clear Filters is clicked', () => {
    const onResetMock = vi.fn();
    render(
      <JobFilterBar
        filters={{ ...initialFilters, q: 'Python' }}
        onFilterChange={vi.fn()}
        onReset={onResetMock}
      />
    );

    const searchInput = screen.getByLabelText(/Keyword Search/i);
    expect(searchInput).toHaveValue('Python');

    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/i }));

    expect(searchInput).toHaveValue('');
    expect(onResetMock).toHaveBeenCalledTimes(1);
  });

  it('disables controls when isLoading is true', () => {
    render(
      <JobFilterBar
        filters={initialFilters}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByLabelText(/Keyword Search/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Filtering\.\.\./i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Clear Filters/i })).toBeDisabled();
  });
});
