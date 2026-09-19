import React, { useState, useEffect, useRef } from 'react';
import {
  JobFilters,
  OpportunityType,
  EmploymentType,
  JobSortBy,
  SortOrder,
} from '@/types/job';

interface JobFilterBarProps {
  filters: JobFilters;
  onFilterChange: (newFilters: JobFilters) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export const JobFilterBar: React.FC<JobFilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  isLoading = false,
}) => {
  const [searchInput, setSearchInput] = useState<string>(filters.q || '');
  const [oppType, setOppType] = useState<string>(filters.opportunity_type || '');
  const [empType, setEmpType] = useState<string>(filters.employment_type || '');
  const [remoteOption, setRemoteOption] = useState<string>(
    filters.is_remote === true ? 'true' : filters.is_remote === false ? 'false' : ''
  );
  const [locationInput, setLocationInput] = useState<string>(filters.location || '');
  const [skillsInput, setSkillsInput] = useState<string>(filters.skills || '');
  const [salaryMinInput, setSalaryMinInput] = useState<string>(
    filters.salary_min != null ? String(filters.salary_min) : ''
  );
  const [salaryMaxInput, setSalaryMaxInput] = useState<string>(
    filters.salary_max != null ? String(filters.salary_max) : ''
  );
  const [sortBy, setSortBy] = useState<JobSortBy>(filters.sort_by || 'created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>(filters.sort_order || 'desc');

  // Ref to alert DOM node — allows synchronous direct DOM update during submit handler
  // without relying on React batched re-renders. This ensures role="alert" is always
  // present and findable, and error text is written synchronously for test assertions.
  const alertRef = useRef<HTMLDivElement>(null);

  const showValidationError = (msg: string) => {
    const el = alertRef.current;
    if (!el) return;
    el.textContent = msg;
    el.className = 'cb-alert cb-alert-danger';
    el.removeAttribute('style');
  };

  const clearValidationError = () => {
    const el = alertRef.current;
    if (!el) return;
    el.textContent = '';
    el.className = '';
    el.setAttribute('style', 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap');
  };

  // Sync internal form state if filters prop changes externally (e.g. on reset)
  useEffect(() => {
    setSearchInput(filters.q || '');
    setOppType(filters.opportunity_type || '');
    setEmpType(filters.employment_type || '');
    setRemoteOption(
      filters.is_remote === true ? 'true' : filters.is_remote === false ? 'false' : ''
    );
    setLocationInput(filters.location || '');
    setSkillsInput(filters.skills || '');
    setSalaryMinInput(filters.salary_min != null ? String(filters.salary_min) : '');
    setSalaryMaxInput(filters.salary_max != null ? String(filters.salary_max) : '');
    setSortBy(filters.sort_by || 'created_at');
    setSortOrder(filters.sort_order || 'desc');
    clearValidationError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Direct DOM refs for salary inputs — lets handleSubmit read the committed DOM value
  // rather than React's possibly-stale batched state, fixing the fireEvent.change + click pattern.
  const salaryMinRef = useRef<HTMLInputElement>(null);
  const salaryMaxRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearValidationError();

    // Read from DOM directly to avoid React 18 batching skew between onChange and onSubmit
    const rawMin = salaryMinRef.current?.value ?? salaryMinInput;
    const rawMax = salaryMaxRef.current?.value ?? salaryMaxInput;

    const minNum = rawMin.trim() ? parseInt(rawMin.trim(), 10) : undefined;
    const maxNum = rawMax.trim() ? parseInt(rawMax.trim(), 10) : undefined;

    if (minNum !== undefined && (isNaN(minNum) || minNum < 0)) {
      showValidationError('Minimum salary must be a positive integer.');
      return;
    }
    if (maxNum !== undefined && (isNaN(maxNum) || maxNum < 0)) {
      showValidationError('Maximum salary must be a positive integer.');
      return;
    }

    if (minNum !== undefined && maxNum !== undefined && minNum > maxNum) {
      showValidationError('salary_min cannot be greater than salary_max');
      return;
    }

    const newFilters: JobFilters = {
      ...filters,
      page: 1, // reset to page 1 on filter submission
      q: searchInput.trim() || undefined,
      opportunity_type: (oppType as OpportunityType) || undefined,
      employment_type: (empType as EmploymentType) || undefined,
      is_remote: remoteOption === 'true' ? true : remoteOption === 'false' ? false : undefined,
      location: locationInput.trim() || undefined,
      skills: skillsInput.trim() || undefined,
      salary_min: minNum,
      salary_max: maxNum,
      sort_by: sortBy,
      sort_order: sortOrder,
    };

    onFilterChange(newFilters);
  };

  const handleClear = () => {
    setSearchInput('');
    setOppType('');
    setEmpType('');
    setRemoteOption('');
    setLocationInput('');
    setSkillsInput('');
    setSalaryMinInput('');
    setSalaryMaxInput('');
    setSortBy('created_at');
    setSortOrder('desc');
    clearValidationError();
    onReset();
  };

  return (
    <form
      className="cb-job-filter-bar cb-card"
      onSubmit={handleSubmit}
      data-testid="job-filter-bar"
    >
      {/* Always-present live region — populated imperatively via alertRef.current.textContent
          so that error messages appear synchronously in the DOM without React batching delay.
          Starts visually hidden; showValidationError() removes the hidden style imperatively. */}
      <div
        ref={alertRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      />

      {/* Main Search Row */}
      <div className="cb-filter-search-row">
        <div className="cb-search-input-group">
          <label htmlFor="search-q" className="cb-filter-label">
            Keyword Search
          </label>
          <input
            id="search-q"
            type="text"
            className="cb-input"
            placeholder="Search by title, description, company, location, skills..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="cb-filter-sort-group">
          <div>
            <label htmlFor="sort-by" className="cb-filter-label">
              Sort By
            </label>
            <select
              id="sort-by"
              className="cb-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as JobSortBy)}
              disabled={isLoading}
            >
              <option value="created_at">Date Posted</option>
              <option value="application_deadline">Application Deadline</option>
              <option value="salary_min">Minimum Salary</option>
            </select>
          </div>

          <div>
            <label htmlFor="sort-order" className="cb-filter-label">
              Order
            </label>
            <select
              id="sort-order"
              className="cb-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              disabled={isLoading}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Secondary Filter Controls Grid */}
      <div className="cb-filter-grid">
        <div className="cb-filter-item">
          <label htmlFor="opp-type" className="cb-filter-label">
            Opportunity Type
          </label>
          <select
            id="opp-type"
            className="cb-select"
            value={oppType}
            onChange={(e) => setOppType(e.target.value)}
            disabled={isLoading}
          >
            <option value="">All Opportunities</option>
            <option value="internship">Internship</option>
            <option value="job">Job</option>
          </select>
        </div>

        <div className="cb-filter-item">
          <label htmlFor="emp-type" className="cb-filter-label">
            Employment Type
          </label>
          <select
            id="emp-type"
            className="cb-select"
            value={empType}
            onChange={(e) => setEmpType(e.target.value)}
            disabled={isLoading}
          >
            <option value="">All Employment Types</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
          </select>
        </div>

        <div className="cb-filter-item">
          <label htmlFor="remote-select" className="cb-filter-label">
            Workplace
          </label>
          <select
            id="remote-select"
            className="cb-select"
            value={remoteOption}
            onChange={(e) => setRemoteOption(e.target.value)}
            disabled={isLoading}
          >
            <option value="">All Workplace Types</option>
            <option value="true">Remote Only</option>
            <option value="false">On-site / In-person</option>
          </select>
        </div>

        <div className="cb-filter-item">
          <label htmlFor="location-filter" className="cb-filter-label">
            Location
          </label>
          <input
            id="location-filter"
            type="text"
            className="cb-input"
            placeholder="e.g. San Francisco or Bengaluru"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="cb-filter-item">
          <label htmlFor="skills-filter" className="cb-filter-label">
            Skills
          </label>
          <input
            id="skills-filter"
            type="text"
            className="cb-input"
            placeholder="e.g. Python, React"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="cb-filter-item cb-salary-filter-group">
          <div className="cb-salary-inputs">
            <div>
              <label htmlFor="salary-min" className="cb-filter-label">
                Min Salary ($)
              </label>
              <input
                ref={salaryMinRef}
                id="salary-min"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="cb-input"
                placeholder="Min"
                value={salaryMinInput}
                onChange={(e) => setSalaryMinInput(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="salary-max" className="cb-filter-label">
                Max Salary ($)
              </label>
              <input
                ref={salaryMaxRef}
                id="salary-max"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="cb-input"
                placeholder="Max"
                value={salaryMaxInput}
                onChange={(e) => setSalaryMaxInput(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="cb-filter-actions">
        <button
          type="submit"
          className="cb-btn cb-btn-primary"
          disabled={isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? 'Filtering...' : 'Apply Filters'}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="cb-btn cb-btn-secondary"
          disabled={isLoading}
        >
          Clear Filters
        </button>
      </div>
    </form>
  );
};
