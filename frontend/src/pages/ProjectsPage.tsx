import React, { useEffect, useState } from 'react';
import { getProjects } from '@/api/innovationProjects';
import {
  InnovationProject,
  ProjectType,
} from '@/types/innovationProject';
import { InnovationProjectCard } from '@/components/projects/InnovationProjectCard';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<InnovationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [projectType, setProjectType] = useState<string>('all');
  const [skill, setSkill] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPublicProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProjects({
        q: q.trim() || undefined,
        project_type: projectType !== 'all' ? (projectType as ProjectType) : undefined,
        skill: skill.trim() || undefined,
        page,
        page_size: 9,
      });
      setProjects(res.items);
      setTotalPages(res.total_pages);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicProjects();
  }, [page, projectType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPublicProjects();
  };

  return (
    <div className="cb-page cb-projects-explore-page">
      <div className="cb-page-header">
        <div>
          <h1 className="cb-page-title">Explore Innovation Projects</h1>
          <p className="cb-page-subtitle">
            Discover real-world systems, research, and applications built by students.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <form onSubmit={handleSearchSubmit} className="cb-filter-bar cb-projects-filter-bar">
        <div className="cb-filter-field cb-search-field">
          <input
            type="text"
            className="cb-input"
            placeholder="Search projects by title, description, or keyword..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="cb-filter-field">
          <select
            className="cb-input cb-select"
            value={projectType}
            onChange={(e) => {
              setProjectType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Categories</option>
            <option value="software">Software & Cloud</option>
            <option value="hardware">Hardware & IoT</option>
            <option value="research">Research & AI</option>
            <option value="academic">Academic & Capstone</option>
            <option value="entrepreneurship">Startups & Ventures</option>
            <option value="social_impact">Social Impact & Open Source</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="cb-filter-field">
          <input
            type="text"
            className="cb-input"
            placeholder="Filter by skill (e.g. PyTorch, React)..."
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          />
        </div>

        <button type="submit" className="cb-btn cb-btn-primary">
          Search
        </button>
      </form>

      {/* Content State */}
      {loading ? (
        <div className="cb-loading-state" data-testid="explore-loading">
          <div className="cb-spinner" />
          <p>Loading projects...</p>
        </div>
      ) : error ? (
        <div className="cb-error-state" data-testid="explore-error">
          <p className="cb-error-text">{error}</p>
          <button
            type="button"
            onClick={fetchPublicProjects}
            className="cb-btn cb-btn-secondary cb-btn-sm"
          >
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="cb-empty-state" data-testid="explore-empty">
          <div className="cb-empty-icon">🔍</div>
          <h2>No Projects Found</h2>
          <p>Try adjusting your search terms or category filters.</p>
        </div>
      ) : (
        <>
          <div className="cb-results-summary">
            Showing {projects.length} of {total} public innovation projects
          </div>

          <div className="cb-project-grid" data-testid="explore-grid">
            {projects.map((project) => (
              <InnovationProjectCard key={project.id} project={project} isOwner={false} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="cb-pagination" data-testid="explore-pagination">
              <button
                type="button"
                className="cb-btn cb-btn-outline cb-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                &larr; Previous
              </button>
              <span className="cb-page-info">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="cb-btn cb-btn-outline cb-btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next &rarr;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
