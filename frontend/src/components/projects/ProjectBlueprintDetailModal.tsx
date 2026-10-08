import React, { useEffect, useState } from 'react';
import { getBlueprintDetail } from '@/api/projectBlueprints';
import {
  BlueprintRecommendationItem,
  ProjectBlueprintDetail,
} from '@/types/projectBlueprint';
import { ApiErrorResponse } from '@/types/api';

export interface ProjectBlueprintDetailModalProps {
  blueprintId: number | null;
  recommendation?: BlueprintRecommendationItem | null;
  isOpen: boolean;
  onClose: () => void;
  onInstantiate: (blueprintId: number) => Promise<void> | void;
  isInstantiating?: boolean;
  conflictError?: string | null;
}

export const ProjectBlueprintDetailModal: React.FC<ProjectBlueprintDetailModalProps> = ({
  blueprintId,
  recommendation,
  isOpen,
  onClose,
  onInstantiate,
  isInstantiating = false,
  conflictError = null,
}) => {
  const [blueprint, setBlueprint] = useState<ProjectBlueprintDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && blueprintId) {
      setLoading(true);
      setError(null);
      getBlueprintDetail(blueprintId)
        .then((data) => {
          setBlueprint(data);
        })
        .catch((err: unknown) => {
          const apiErr = err as ApiErrorResponse;
          const detailStr = typeof apiErr?.detail === 'string' ? apiErr.detail : null;
          setError(detailStr || apiErr?.message || 'Failed to load blueprint details.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setBlueprint(null);
      setError(null);
    }
  }, [isOpen, blueprintId]);

  if (!isOpen || !blueprintId) {
    return null;
  }

  const primarySkills = blueprint?.skills.filter((s) => s.is_primary) || [];
  const supportingSkills = blueprint?.skills.filter((s) => !s.is_primary) || [];
  const sortedMilestones = [...(blueprint?.milestones || [])].sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blueprint-detail-title"
      data-testid="blueprint-detail-modal"
    >
      <div className="cb-modal cb-modal-lg" style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal Header */}
        <div className="cb-modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '1.25rem 1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="cb-badge cb-badge-primary">Curated Engineering Blueprint</span>
              {blueprint && (
                <>
                  <span className="cb-badge cb-badge-secondary" style={{ textTransform: 'capitalize' }}>
                    {blueprint.difficulty_level}
                  </span>
                  <span className="cb-badge cb-badge-outline">⏱ ~{blueprint.estimated_hours} Hours</span>
                </>
              )}
            </div>
            <h2 id="blueprint-detail-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              {blueprint?.title || 'Loading Blueprint...'}
            </h2>
          </div>
          <button
            type="button"
            className="cb-modal-close"
            onClick={onClose}
            disabled={isInstantiating}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="cb-modal-body" style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading ? (
            <div className="cb-loading-state" data-testid="blueprint-modal-loading" style={{ padding: '3rem 1rem' }}>
              <div className="cb-spinner" />
              <p>Loading curated project roadmap and milestone guidance...</p>
            </div>
          ) : error ? (
            <div className="cb-error-state" data-testid="blueprint-modal-error">
              <p className="cb-error-text">{error}</p>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={() => {
                  if (blueprintId) {
                    setLoading(true);
                    setError(null);
                    getBlueprintDetail(blueprintId)
                      .then((d) => setBlueprint(d))
                      .catch((e: unknown) => {
                        const apiErr = e as ApiErrorResponse;
                        setError(typeof apiErr?.detail === 'string' ? apiErr.detail : apiErr?.message || 'Failed to load.');
                      })
                      .finally(() => setLoading(false));
                  }
                }}
              >
                Retry
              </button>
            </div>
          ) : blueprint ? (
            <>
              {/* Conflict Error Notice */}
              {conflictError && (
                <div
                  className="cb-alert cb-alert-danger"
                  role="alert"
                  data-testid="blueprint-conflict-error"
                  style={{ marginBottom: '0.5rem' }}
                >
                  <strong>Notice:</strong> {conflictError}
                </div>
              )}

              {/* Recommendation Callout */}
              {recommendation && (
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '0.875rem 1rem',
                    color: '#1e40af',
                    fontSize: '0.875rem',
                  }}
                  data-testid="modal-recommendation-box"
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                    🎯 Why This Blueprint Matches Your Skill Gap
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>
                    {recommendation.recommendation_reason}
                  </p>
                </div>
              )}

              {/* Overview & Learning Objectives */}
              <section>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Project Overview
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                  {blueprint.description}
                </p>

                {blueprint.learning_objectives && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.875rem 1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.35rem' }}>
                      Learning &amp; Demonstration Objectives:
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {blueprint.learning_objectives}
                    </div>
                  </div>
                )}
              </section>

              {/* Skills Grid */}
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.875rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#166534', marginBottom: '0.35rem' }}>
                    ★ Primary Target Skills:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {primarySkills.map((s) => (
                      <span key={s.id} className="cb-skill-tag" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.875rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.35rem' }}>
                    Supporting Tooling &amp; Stack:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {supportingSkills.map((s) => (
                      <span key={s.id} className="cb-skill-tag" style={{ background: '#e2e8f0', color: '#334155' }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* Milestone Roadmap */}
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                    Milestone Roadmap &amp; Deliverables ({sortedMilestones.length})
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Cloned directly into your project upon start
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} data-testid="modal-milestone-list">
                  {sortedMilestones.map((m, idx) => (
                    <div
                      key={m.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1rem',
                        background: '#ffffff',
                      }}
                      data-testid={`modal-milestone-${m.id}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                          {idx + 1}. {m.title}
                        </span>
                        <span className="cb-badge cb-badge-outline" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                          {m.recommended_evidence_type} evidence
                        </span>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 0.5rem 0', lineHeight: 1.5 }}>
                        {m.description}
                      </p>

                      <div style={{ fontSize: '0.8125rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                        <strong>Expected Deliverable:</strong> {m.expected_deliverable}
                      </div>

                      {m.evidence_guidance && (
                        <div
                          style={{
                            background: '#f8fafc',
                            borderLeft: '3px solid #3b82f6',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8125rem',
                            color: '#334155',
                            marginTop: '0.35rem',
                            borderRadius: '0 4px 4px 0',
                          }}
                        >
                          <strong>Evidence Guidance:</strong> {m.evidence_guidance}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Truthful Verification Disclaimer */}
              <div
                style={{
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8125rem',
                  color: '#6b21a8',
                  lineHeight: 1.5,
                }}
              >
                ℹ️ <strong>Evidence &amp; Skill Verification Note:</strong> Starting and completing this project allows you to create authentic code repositories, demos, and milestone deliverables. Verification of skills on your Career Passport occurs when you submit milestone evidence for verification or evaluation.
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div
          className="cb-modal-footer"
          style={{
            borderTop: '1px solid #e2e8f0',
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={onClose}
            disabled={isInstantiating}
          >
            Close
          </button>

          {blueprint && (
            <button
              type="button"
              className="cb-btn cb-btn-primary"
              onClick={() => onInstantiate(blueprint.id)}
              disabled={isInstantiating}
              data-testid="modal-instantiate-btn"
            >
              {isInstantiating ? 'Creating Innovation Project...' : '🚀 Start This Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
