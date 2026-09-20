import React from 'react';
import { ApplicationFilterStatus } from '@/types/application';

interface ApplicationFilterBarProps {
  statusFilter: ApplicationFilterStatus;
  searchQuery: string;
  onStatusChange: (status: ApplicationFilterStatus) => void;
  onSearchChange: (query: string) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
  searchPlaceholder?: string;
}

const STATUS_OPTIONS: { value: ApplicationFilterStatus; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'applied', label: 'Applied' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'accepted', label: 'Accepted' },
];

export const ApplicationFilterBar: React.FC<ApplicationFilterBarProps> = ({
  statusFilter,
  searchQuery,
  onStatusChange,
  onSearchChange,
  onReset,
  totalCount,
  filteredCount,
  searchPlaceholder = 'Search applications by title, company, or keyword...',
}) => {
  const hasActiveFilters = statusFilter !== 'all' || searchQuery.trim() !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form
      className="cb-app-filter-bar cb-card"
      onSubmit={handleSubmit}
      role="search"
      aria-label="Filter applications"
      data-testid="application-filter-bar"
    >
      <div className="cb-app-filter-row">
        {/* Keyword Search Input */}
        <div className="cb-app-filter-search-group">
          <label htmlFor="app-search-input" className="cb-filter-label">
            Search
          </label>
          <input
            id="app-search-input"
            type="text"
            className="cb-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search applications"
          />
        </div>

        {/* Status Dropdown */}
        <div className="cb-app-filter-status-group">
          <label htmlFor="app-status-select" className="cb-filter-label">
            Status
          </label>
          <select
            id="app-status-select"
            className="cb-select"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as ApplicationFilterStatus)}
            aria-label="Filter by application status"
          >
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions & Clear */}
        <div className="cb-app-filter-actions">
          {hasActiveFilters && (
            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-sm"
              onClick={onReset}
              aria-label="Reset all filters"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count Banner */}
      <div className="cb-app-filter-count-bar" aria-live="polite">
        <span className="cb-app-filter-count-text">
          Showing {filteredCount} of {totalCount}{' '}
          {totalCount === 1 ? 'application' : 'applications'}
          {hasActiveFilters ? ' (filtered)' : ''}
        </span>
      </div>
    </form>
  );
};
