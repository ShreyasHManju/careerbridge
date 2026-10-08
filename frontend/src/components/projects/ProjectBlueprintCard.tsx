import React from 'react';
import {
  BlueprintRecommendationItem,
  ProjectBlueprintSummary,
} from '@/types/projectBlueprint';

export interface ProjectBlueprintCardProps {
  blueprint: ProjectBlueprintSummary;
  recommendation?: BlueprintRecommendationItem | null;
  onViewDetail: (blueprintId: number) => void;
  onInstantiate?: (blueprintId: number) => void;
  isInstantiating?: boolean;
  className?: string;
}

const formatDifficulty = (diff: string): string => {
  const d = diff.toLowerCase();
  switch (d) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
    default:
      return diff;
  }
};

const getDifficultyBadgeClass = (diff: string): string => {
  const d = diff.toLowerCase();
  switch (d) {
    case 'beginner':
      return 'cb-badge-success';
    case 'intermediate':
      return 'cb-badge-warning';
    case 'advanced':
      return 'cb-badge-danger';
    default:
      return 'cb-badge-secondary';
  }
};

export const ProjectBlueprintCard: React.FC<ProjectBlueprintCardProps> = ({
  blueprint,
  recommendation,
  onViewDetail,
  onInstantiate,
  isInstantiating = false,
  className = '',
}) => {
  const primarySkills = blueprint.skills.filter((s) => s.is_primary);
  const supportingSkills = blueprint.skills.filter((s) => !s.is_primary);

  return (
    <article
      className={`cb-card cb-blueprint-card ${className}`}
      data-testid={`blueprint-card-${blueprint.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: recommendation ? '1px solid #93c5fd' : '1px solid var(--cb-border, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.25rem',
        background: recommendation ? '#f8faff' : '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <span className={`cb-badge ${getDifficultyBadgeClass(blueprint.difficulty_level)}`} data-testid="blueprint-difficulty">
                {formatDifficulty(blueprint.difficulty_level)}
              </span>
              <span className="cb-badge cb-badge-secondary" data-testid="blueprint-hours">
                ⏱ {blueprint.estimated_hours} hrs
              </span>
              {recommendation && (
                <span
                  className="cb-badge cb-badge-primary"
                  data-testid="blueprint-score"
                  style={{ fontWeight: 700 }}
                  title="Relevance score based on missing primary & supporting skill coverage"
                >
                  ⚡ {recommendation.relevance_score} Match Points
                </span>
              )}
            </div>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--cb-text, #0f172a)',
                margin: '0.25rem 0 0.35rem 0',
                lineHeight: 1.3,
              }}
              data-testid="blueprint-title"
            >
              {blueprint.title}
            </h3>
          </div>
        </div>

        {/* Summary */}
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--cb-text-muted, #475569)',
            lineHeight: 1.5,
            margin: '0 0 0.875rem 0',
          }}
          data-testid="blueprint-summary"
        >
          {blueprint.summary}
        </p>

        {/* Recommendation Reason Callout */}
        {recommendation && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '0.625rem 0.75rem',
              marginBottom: '0.875rem',
              fontSize: '0.8125rem',
              color: '#1e40af',
            }}
            data-testid="blueprint-recommendation-reason"
          >
            <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>
              🎯 Target Skill Gap Coverage:
            </div>
            <div>{recommendation.recommendation_reason}</div>
          </div>
        )}

        {/* Primary Skills */}
        {primarySkills.length > 0 && (
          <div style={{ marginBottom: '0.625rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.25rem' }}>
              Primary Competencies Proven:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }} data-testid="blueprint-primary-skills">
              {primarySkills.map((s) => (
                <span
                  key={s.id}
                  className="cb-skill-tag"
                  style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 600, fontSize: '0.75rem' }}
                >
                  ★ {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Supporting Skills */}
        {supportingSkills.length > 0 && (
          <div style={{ marginBottom: '0.875rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.25rem' }}>
              Supporting Tools &amp; Stack:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }} data-testid="blueprint-supporting-skills">
              {supportingSkills.map((s) => (
                <span
                  key={s.id}
                  className="cb-skill-tag"
                  style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer CTAs */}
      <div
        style={{
          borderTop: '1px solid #f1f5f9',
          paddingTop: '0.75rem',
          marginTop: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => onViewDetail(blueprint.id)}
          className="cb-btn cb-btn-outline cb-btn-sm"
          data-testid={`view-blueprint-btn-${blueprint.id}`}
        >
          View Roadmap ({blueprint.milestones_count || 0} Milestones)
        </button>

        {onInstantiate && (
          <button
            type="button"
            onClick={() => onInstantiate(blueprint.id)}
            disabled={isInstantiating}
            className="cb-btn cb-btn-primary cb-btn-sm"
            data-testid={`instantiate-blueprint-btn-${blueprint.id}`}
          >
            {isInstantiating ? 'Creating Project...' : '🚀 Start Project'}
          </button>
        )}
      </div>
    </article>
  );
};
