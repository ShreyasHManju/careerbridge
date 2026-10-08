import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getJobProjectRecommendations,
  instantiateBlueprint,
} from '@/api/projectBlueprints';
import {
  BlueprintRecommendationItem,
  JobProjectRecommendationsResponse,
} from '@/types/projectBlueprint';
import { InnovationProject } from '@/types/innovationProject';
import { ApiErrorResponse } from '@/types/api';
import { ProjectBlueprintCard } from '@/components/projects/ProjectBlueprintCard';
import { ProjectBlueprintDetailModal } from '@/components/projects/ProjectBlueprintDetailModal';

export interface SkillGapProjectRecommendationsProps {
  jobId: number;
  jobTitle?: string;
  onProjectCreated?: (project: InnovationProject) => void;
  className?: string;
}

export const SkillGapProjectRecommendations: React.FC<SkillGapProjectRecommendationsProps> = ({
  jobId,
  jobTitle,
  onProjectCreated,
  className = '',
}) => {
  const navigate = useNavigate();

  const [data, setData] = useState<JobProjectRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected blueprint modal state
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<number | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<BlueprintRecommendationItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Instantiation state
  const [instantiatingId, setInstantiatingId] = useState<number | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getJobProjectRecommendations(jobId);
      setData(response);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      const detailStr = typeof apiErr?.detail === 'string' ? apiErr.detail : null;
      setError(
        detailStr ||
        apiErr?.message ||
        'Unable to load recommended project blueprints. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleOpenDetail = (blueprintId: number) => {
    const recItem = data?.recommendations.find((r) => r.blueprint.id === blueprintId) || null;
    setSelectedBlueprintId(blueprintId);
    setSelectedRecommendation(recItem);
    setConflictError(null);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedBlueprintId(null);
    setSelectedRecommendation(null);
    setConflictError(null);
  };

  const handleInstantiate = async (blueprintId: number) => {
    setInstantiatingId(blueprintId);
    setConflictError(null);

    try {
      const newProject = await instantiateBlueprint(blueprintId);
      setSuccessToast(`Project "${newProject.title}" successfully created with milestone deliverables!`);

      if (onProjectCreated) {
        onProjectCreated(newProject);
      }

      // Close modal if open
      setIsDetailModalOpen(false);

      // Navigate to project detail page
      setTimeout(() => {
        navigate(`/app/projects/${newProject.id}`);
      }, 500);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      const detailStr = typeof apiErr?.detail === 'string' ? apiErr.detail : null;
      const msg = detailStr || apiErr?.message || 'Failed to start project blueprint.';
      setConflictError(msg);
    } finally {
      setInstantiatingId(null);
    }
  };

  if (loading) {
    return (
      <div className={`cb-card cb-recommendations-loading-card ${className}`} data-testid="blueprint-recommendations-loading" style={{ padding: '2rem 1.5rem', marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="cb-spinner" style={{ width: '24px', height: '24px', borderWidth: '2px' }} />
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--cb-text, #1e293b)' }}>
            Finding Curated Project Blueprints to Bridge Your Skill Gap...
          </h4>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--cb-text-muted, #64748b)' }}>
          Analyzing required competencies and matching verified project blueprints with milestone roadmaps.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`cb-card cb-recommendations-error-card ${className}`} data-testid="blueprint-recommendations-error" style={{ padding: '1.5rem', marginTop: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#b91c1c', fontSize: '1rem' }}>
          Unable to Load Project Recommendations
        </h4>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#4b5563' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={fetchRecommendations}
          className="cb-btn cb-btn-secondary cb-btn-sm"
        >
          Retry Blueprint Recommendations
        </button>
      </div>
    );
  }

  const recommendations = data?.recommendations || [];

  if (recommendations.length === 0) {
    return (
      <div className={`cb-card cb-recommendations-empty-card ${className}`} data-testid="blueprint-recommendations-empty" style={{ padding: '1.5rem', marginTop: '1.25rem', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🛠️</span>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
              Custom Innovation Project Option
            </h4>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
              No pre-configured platform blueprints currently target these specific skills. You can build a custom project and document deliverables to demonstrate your expertise.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Link to="/app/student/projects" className="cb-btn cb-btn-outline cb-btn-sm">
                + Create Custom Project
              </Link>
              <Link to="/app/explore-projects" className="cb-link cb-link-sm">
                Explore Student Community Projects &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      className={`cb-recommendations-section ${className}`}
      data-testid="skill-gap-project-recommendations"
      style={{ marginTop: '1.5rem' }}
    >
      {/* Toast Alert */}
      {successToast && (
        <div className="cb-alert cb-alert-success" role="status" style={{ marginBottom: '1rem' }}>
          {successToast}
        </div>
      )}

      {conflictError && (
        <div className="cb-alert cb-alert-danger" role="alert" style={{ marginBottom: '1rem' }}>
          {conflictError}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--cb-text, #0f172a)' }}>
            Recommended Project Blueprints to Bridge This Gap
          </h4>
          <span className="cb-badge cb-badge-primary" style={{ fontSize: '0.75rem' }}>
            {recommendations.length} Recommended
          </span>
        </div>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--cb-text-muted, #64748b)' }}>
          Curated engineering project specifications with milestone deliverables designed to help you build and prove required competencies for {jobTitle || 'this role'}.
        </p>
      </div>

      {/* Blueprints Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
        data-testid="blueprint-recommendations-grid"
      >
        {recommendations.map((rec) => (
          <ProjectBlueprintCard
            key={rec.blueprint.id}
            blueprint={rec.blueprint}
            recommendation={rec}
            onViewDetail={handleOpenDetail}
            onInstantiate={handleInstantiate}
            isInstantiating={instantiatingId === rec.blueprint.id}
          />
        ))}
      </div>

      {/* Detail Roadmap Modal */}
      <ProjectBlueprintDetailModal
        blueprintId={selectedBlueprintId}
        recommendation={selectedRecommendation}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        onInstantiate={handleInstantiate}
        isInstantiating={instantiatingId === selectedBlueprintId}
        conflictError={conflictError}
      />
    </section>
  );
};
