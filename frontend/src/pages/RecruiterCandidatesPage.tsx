import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchCandidates } from '@/api/candidates';
import {
  CandidateSearchFilters,
  CandidateSourcingResult,
} from '@/types/candidate';
import { CandidateSourcingCard } from '@/components/recruiter/CandidateSourcingCard';
import { JobInviteModal } from '@/components/recruiter/JobInviteModal';
import { ApiErrorResponse } from '@/types/api';

export const RecruiterCandidatesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL search params initialization
  const initialQuery = searchParams.get('q') || '';
  const initialSkill = searchParams.get('skill') || '';
  const initialDegree = searchParams.get('degree') || 'all';
  const initialGradYear = searchParams.get('grad_year') || 'all';
  const initialVerifiedOnly = searchParams.get('verified_only') === 'true';
  const initialSortBy = (searchParams.get('sort_by') as any) || 'verified_skills';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  // Search and filter states
  const [query, setQuery] = useState<string>(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialQuery);
  const [skillFilter, setSkillFilter] = useState<string>(initialSkill);
  const [debouncedSkillFilter, setDebouncedSkillFilter] = useState<string>(initialSkill);
  const [degreeFilter, setDegreeFilter] = useState<string>(initialDegree);
  const [gradYearFilter, setGradYearFilter] = useState<string>(initialGradYear);
  const [verifiedPassportOnly, setVerifiedPassportOnly] = useState<boolean>(initialVerifiedOnly);
  const [sortBy, setSortBy] = useState<'verified_skills' | 'top_rated_projects' | 'recent'>(
    initialSortBy
  );

  // Debounce search query and skill input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSkillFilter(skillFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [skillFilter]);

  // Pagination and data states
  const [page, setPage] = useState<number>(initialPage > 0 ? initialPage : 1);
  const [pageSize] = useState<number>(10);
  const [candidates, setCandidates] = useState<CandidateSourcingResult[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Job Invite Modal state
  const [selectedCandidateForInvite, setSelectedCandidateForInvite] = useState<CandidateSourcingResult | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);

  // Sync state to URL search params
  const updateUrlParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
    if (debouncedSkillFilter.trim()) params.skill = debouncedSkillFilter.trim();
    if (degreeFilter !== 'all') params.degree = degreeFilter;
    if (gradYearFilter !== 'all') params.grad_year = gradYearFilter;
    if (verifiedPassportOnly) params.verified_only = 'true';
    if (sortBy !== 'verified_skills') params.sort_by = sortBy;
    if (page > 1) params.page = String(page);

    setSearchParams(params, { replace: true });
  }, [debouncedQuery, debouncedSkillFilter, degreeFilter, gradYearFilter, verifiedPassportOnly, sortBy, page, setSearchParams]);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const filters: CandidateSearchFilters = {};
    if (debouncedQuery.trim()) filters.query = debouncedQuery.trim();
    if (debouncedSkillFilter.trim()) filters.skills = [debouncedSkillFilter.trim()];
    if (degreeFilter !== 'all') filters.degree = degreeFilter;
    if (gradYearFilter !== 'all') filters.graduation_year = parseInt(gradYearFilter, 10);
    if (verifiedPassportOnly) filters.has_verified_passport = true;
    filters.sort_by = sortBy;

    try {
      const resp = await searchCandidates(filters, page, pageSize);
      setCandidates(resp.items || []);
      setTotal(resp.total || 0);
      setTotalPages(resp.total_pages || 1);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        'Failed to load candidate talent directory. Please check your connection and try again.'
      );
      setCandidates([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, debouncedSkillFilter, degreeFilter, gradYearFilter, verifiedPassportOnly, sortBy, page, pageSize]);

  useEffect(() => {
    fetchCandidates();
    updateUrlParams();
  }, [fetchCandidates, updateUrlParams]);

  const handleResetFilters = () => {
    setQuery('');
    setSkillFilter('');
    setDegreeFilter('all');
    setGradYearFilter('all');
    setVerifiedPassportOnly(false);
    setSortBy('verified_skills');
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setPage(1);
  };

  return (
    <div className="cb-page-container cb-talent-discovery-page" data-testid="recruiter-candidates-page">
      {/* Page Header */}
      <header className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Talent Discovery</h1>
          <p className="cb-page-subtitle">
            Proactively discover and source eligible student candidates through verified skills, Experience Passport credentials, and public innovation projects.
          </p>
        </div>
      </header>

      {/* Filter and Search Bar Controls */}
      <section
        className="cb-candidates-filter-panel cb-card"
        aria-label="Candidate Discovery Filters"
        data-testid="candidates-filter-panel"
      >
        <div className="cb-filter-row-primary">
          {/* Keyword Search */}
          <div className="cb-search-input-group">
            <span className="cb-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              value={query}
              onChange={handleSearchChange}
              placeholder="Search by candidate name, bio, skills, or college..."
              className="cb-search-input"
              data-testid="candidate-search-input"
              aria-label="Search candidate talent pool"
            />
            {query && (
              <button
                type="button"
                className="cb-search-clear-btn"
                onClick={() => {
                  setQuery('');
                  setPage(1);
                }}
                aria-label="Clear search input"
              >
                ✕
              </button>
            )}
          </div>

          {/* Skill Filter */}
          <div className="cb-filter-input-wrap">
            <input
              type="text"
              value={skillFilter}
              onChange={(e) => {
                setSkillFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by skill (e.g. React)..."
              className="cb-filter-select"
              data-testid="candidate-skill-filter"
              aria-label="Filter by skill"
            />
          </div>
        </div>

        <div className="cb-filter-row-secondary">
          {/* Degree Filter */}
          <div className="cb-filter-group">
            <label htmlFor="candidate-degree-filter" className="cb-filter-label">Degree</label>
            <select
              id="candidate-degree-filter"
              value={degreeFilter}
              onChange={(e) => {
                setDegreeFilter(e.target.value);
                setPage(1);
              }}
              className="cb-filter-select"
              data-testid="candidate-degree-filter"
            >
              <option value="all">All Degrees</option>
              <option value="B.S.">B.S. / B.Sc</option>
              <option value="B.Tech">B.Tech / B.E.</option>
              <option value="M.S.">M.S. / M.Sc</option>
              <option value="M.Tech">M.Tech</option>
              <option value="Ph.D.">Ph.D.</option>
            </select>
          </div>

          {/* Graduation Year Filter */}
          <div className="cb-filter-group">
            <label htmlFor="candidate-gradyear-filter" className="cb-filter-label">Grad Year</label>
            <select
              id="candidate-gradyear-filter"
              value={gradYearFilter}
              onChange={(e) => {
                setGradYearFilter(e.target.value);
                setPage(1);
              }}
              className="cb-filter-select"
              data-testid="candidate-gradyear-filter"
            >
              <option value="all">All Years</option>
              <option value="2025">Class of 2025</option>
              <option value="2026">Class of 2026</option>
              <option value="2027">Class of 2027</option>
              <option value="2028">Class of 2028</option>
            </select>
          </div>

          {/* Verified Passport Toggle */}
          <div className="cb-filter-group cb-filter-checkbox-group">
            <label className="cb-checkbox-label" htmlFor="verified-passport-checkbox">
              <input
                id="verified-passport-checkbox"
                type="checkbox"
                checked={verifiedPassportOnly}
                onChange={(e) => {
                  setVerifiedPassportOnly(e.target.checked);
                  setPage(1);
                }}
                data-testid="verified-passport-filter"
              />
              <span>🛡️ Verified Passport Only</span>
            </label>
          </div>

          {/* Sort By Selector */}
          <div className="cb-filter-group cb-sort-group">
            <label htmlFor="candidate-sort-select" className="cb-filter-label">Sort By</label>
            <select
              id="candidate-sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setPage(1);
              }}
              className="cb-filter-select"
              data-testid="candidate-sort-select"
            >
              <option value="verified_skills">Most Verified Skills</option>
              <option value="top_rated_projects">Highest Project Score</option>
              <option value="recent">Recently Active</option>
            </select>
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            className="cb-btn cb-btn-secondary cb-btn-sm cb-reset-filters-btn"
            onClick={handleResetFilters}
            data-testid="reset-candidate-filters-btn"
          >
            Reset Filters
          </button>
        </div>
      </section>

      {/* Error Alert */}
      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert" data-testid="candidates-error-alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="cb-btn cb-btn-secondary cb-btn-sm cb-retry-btn"
            onClick={fetchCandidates}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="cb-loading-container" role="status" aria-label="Loading candidates">
          <div className="cb-spinner" />
          <p className="cb-loading-text">Searching verified candidate directory...</p>
        </div>
      ) : candidates.length === 0 && !errorMessage ? (
        <div className="cb-empty-state cb-card" data-testid="candidates-empty-state">
          <div className="cb-empty-state-icon">🔍</div>
          <h2 className="cb-empty-state-title">No Candidates Found</h2>
          <p className="cb-empty-state-text">
            No students match your active search and filter criteria. Try broadening your keywords, clearing skill filters, or removing the verified passport requirement.
          </p>
          <button
            type="button"
            className="cb-btn cb-btn-primary cb-btn-sm"
            onClick={handleResetFilters}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="cb-candidates-results-section">
          {/* Result Count and Summary */}
          <div className="cb-candidates-results-header">
            <span className="cb-candidates-count" data-testid="candidates-result-count">
              Showing <strong>{candidates.length}</strong> of <strong>{total}</strong> discoverable candidate{total === 1 ? '' : 's'}
            </span>
          </div>

          {/* Candidate Cards Grid */}
          <div
            className="cb-candidates-grid"
            role="feed"
            aria-label="Discoverable candidate directory"
            data-testid="candidates-grid"
          >
            {candidates.map((candidate) => (
              <CandidateSourcingCard
                key={candidate.id}
                candidate={candidate}
                onInvite={(c) => {
                  setSelectedCandidateForInvite(c);
                  setIsInviteModalOpen(true);
                }}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="cb-pagination-bar" aria-label="Candidate directory pagination">
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                data-testid="prev-page-btn"
              >
                ← Previous
              </button>

              <span className="cb-pagination-info" data-testid="pagination-info">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>

              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                data-testid="next-page-btn"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recruiter Job Invite Modal */}
      <JobInviteModal
        candidate={selectedCandidateForInvite}
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setSelectedCandidateForInvite(null);
        }}
      />
    </div>
  );
};
