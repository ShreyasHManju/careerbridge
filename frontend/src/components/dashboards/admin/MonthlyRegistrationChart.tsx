import React, { useState } from 'react';
import { MonthlyRegistrationMetric } from '@/types/dashboard';

interface MonthlyRegistrationChartProps {
  monthlyRegistrations: MonthlyRegistrationMetric[];
  selectedYear: number;
  isUpdatingYear: boolean;
  onYearChange: (year: number) => void;
}

const CURRENT_YEAR = new Date().getFullYear();

// Format 'YYYY-MM' into friendly readable label like 'August 2026'
function formatMonthLabel(monthStr: string): string {
  try {
    const [yearStr, monthNumStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthNumStr, 10) - 1;
    if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return monthStr;
    }
    const date = new Date(year, monthIndex, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return monthStr;
  }
}

export const MonthlyRegistrationChart: React.FC<MonthlyRegistrationChartProps> = ({
  monthlyRegistrations,
  selectedYear,
  isUpdatingYear,
  onYearChange,
}) => {
  const [inputYear, setInputYear] = useState<string>(String(selectedYear));
  const [yearValidationError, setYearValidationError] = useState<string | null>(null);

  const handleYearSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setYearValidationError(null);

    const parsed = parseInt(inputYear, 10);
    if (isNaN(parsed) || parsed < 2000 || parsed > 2100) {
      setYearValidationError('Please enter a valid calendar year between 2000 and 2100.');
      return;
    }

    onYearChange(parsed);
  };

  const handleResetCurrentYear = () => {
    setInputYear(String(CURRENT_YEAR));
    setYearValidationError(null);
    onYearChange(CURRENT_YEAR);
  };

  const monthlyItems = monthlyRegistrations || [];
  const maxRegistrationCount = Math.max(...monthlyItems.map((m) => m.count), 1);

  return (
    <section className="cb-chart-card cb-admin-chart-card" aria-labelledby="monthly-registrations-heading">
      <div className="cb-chart-header">
        <div>
          <h2 id="monthly-registrations-heading" className="cb-chart-title">
            Monthly User Registrations ({selectedYear})
          </h2>
          <p className="cb-chart-subtitle">
            New account creations grouped by calendar month for the selected period.
          </p>
        </div>

        {/* Year Filter Form */}
        <form
          onSubmit={handleYearSubmit}
          className="cb-year-filter-form"
          noValidate
          aria-label="Filter registrations by year"
        >
          <label htmlFor="period-year-input" className="cb-year-filter-label">
            Year:
          </label>
          <input
            id="period-year-input"
            type="number"
            min={2000}
            max={2100}
            className="cb-input cb-year-input"
            value={inputYear}
            onChange={(e) => setInputYear(e.target.value)}
            disabled={isUpdatingYear}
            data-testid="period-year-input"
            aria-describedby={yearValidationError ? 'year-error-message' : undefined}
          />
          <button
            type="submit"
            className="cb-btn cb-btn-primary cb-btn-sm"
            disabled={isUpdatingYear}
            data-testid="apply-year-btn"
          >
            Apply
          </button>
          {selectedYear !== CURRENT_YEAR && (
            <button
              type="button"
              onClick={handleResetCurrentYear}
              className="cb-btn cb-btn-secondary cb-btn-sm"
              disabled={isUpdatingYear}
              data-testid="reset-year-btn"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {yearValidationError && (
        <div id="year-error-message" className="cb-alert cb-alert-danger cb-year-alert" role="alert">
          {yearValidationError}
        </div>
      )}

      {/* Proportional Bar Chart Visualizer */}
      <div className="cb-chart-body" data-testid="monthly-registrations-chart">
        {monthlyItems.length === 0 ? (
          <div className="cb-chart-empty" data-testid="chart-empty-state">
            <p>No user registration data recorded for calendar year {selectedYear}.</p>
          </div>
        ) : (
          <div
            className="cb-bar-list"
            role="list"
            aria-label={`Monthly registration breakdown for ${selectedYear}`}
          >
            {monthlyItems.map((metric: MonthlyRegistrationMetric) => {
              const widthPercent =
                metric.count === 0
                  ? 0
                  : Math.max(Math.round((metric.count / maxRegistrationCount) * 100), 5);

              const friendlyMonth = formatMonthLabel(metric.month);

              return (
                <div
                  key={metric.month}
                  className="cb-bar-row"
                  role="listitem"
                  data-testid={`bar-row-${metric.month}`}
                >
                  <div className="cb-bar-label-group">
                    <span className="cb-bar-month-text">{friendlyMonth}</span>
                    <span className="cb-bar-count-badge" data-testid={`bar-count-${metric.month}`}>
                      {metric.count} {metric.count === 1 ? 'user' : 'users'}
                    </span>
                  </div>

                  <div className="cb-bar-track" aria-hidden="true">
                    <div
                      className="cb-bar-fill"
                      style={{ width: `${widthPercent}%` }}
                      data-testid={`bar-fill-${metric.month}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
