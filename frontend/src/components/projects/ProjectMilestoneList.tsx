import React from 'react';
import { MilestoneStatus, ProjectMilestone } from '@/types/innovationProject';
import { MilestoneStatusBadge } from './MilestoneStatusBadge';

interface ProjectMilestoneListProps {
  milestones: ProjectMilestone[];
  isOwner: boolean;
  onAddMilestone?: () => void;
  onEditMilestone?: (milestone: ProjectMilestone) => void;
  onDeleteMilestone?: (milestone: ProjectMilestone) => void;
  onToggleStatus?: (milestone: ProjectMilestone, newStatus: MilestoneStatus) => void;
}

const formatDate = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

export const ProjectMilestoneList: React.FC<ProjectMilestoneListProps> = ({
  milestones,
  isOwner,
  onAddMilestone,
  onEditMilestone,
  onDeleteMilestone,
  onToggleStatus,
}) => {
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.id - b.id;
  });

  if (sortedMilestones.length === 0) {
    return (
      <div className="cb-milestones-empty" data-testid="milestones-empty">
        <div className="cb-empty-icon">🎯</div>
        <h4>No Milestones Yet</h4>
        <p className="cb-text-muted">
          {isOwner
            ? 'Define measurable execution steps to track your project progress.'
            : 'No execution milestones have been published for this project yet.'}
        </p>
        {isOwner && onAddMilestone && (
          <button
            type="button"
            onClick={onAddMilestone}
            className="cb-btn cb-btn-primary cb-btn-sm"
            aria-label="Add first milestone"
          >
            + Add First Milestone
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="cb-milestones-list" data-testid="milestones-list">
      {sortedMilestones.map((m, index) => {
        const dueDateFormatted = formatDate(m.due_date);
        const completedDateFormatted = formatDate(m.completed_at);
        const isCompleted = m.status === 'completed';

        return (
          <div
            key={m.id}
            className={`cb-milestone-item ${isCompleted ? 'cb-milestone-item-completed' : ''}`}
            data-testid={`milestone-item-${m.id}`}
          >
            <div className="cb-milestone-header">
              <div className="cb-milestone-title-row">
                <span className="cb-milestone-order-badge">#{index + 1}</span>
                <h4 className="cb-milestone-title">{m.title}</h4>
              </div>

              <div className="cb-milestone-badges">
                <MilestoneStatusBadge status={m.status} />
              </div>
            </div>

            {m.description && (
              <p className="cb-milestone-desc">{m.description}</p>
            )}

            <div className="cb-milestone-meta-row">
              <div className="cb-milestone-dates">
                {dueDateFormatted && (
                  <span className="cb-milestone-date cb-milestone-due">
                    📅 Due: {dueDateFormatted}
                  </span>
                )}
                {completedDateFormatted && (
                  <span className="cb-milestone-date cb-milestone-completed-at">
                    ✨ Completed: {completedDateFormatted}
                  </span>
                )}
              </div>

              {isOwner && (
                <div className="cb-milestone-actions">
                  {onToggleStatus && (
                    <button
                      type="button"
                      className={`cb-btn cb-btn-sm ${
                        isCompleted ? 'cb-btn-secondary' : 'cb-btn-outline'
                      }`}
                      onClick={() =>
                        onToggleStatus(
                          m,
                          isCompleted ? 'in_progress' : 'completed'
                        )
                      }
                      aria-label={
                        isCompleted
                          ? `Mark ${m.title} as in progress`
                          : `Mark ${m.title} as completed`
                      }
                    >
                      {isCompleted ? '↺ Reopen' : '✓ Complete'}
                    </button>
                  )}

                  {onEditMilestone && (
                    <button
                      type="button"
                      className="cb-btn cb-btn-secondary cb-btn-sm"
                      onClick={() => onEditMilestone(m)}
                      aria-label={`Edit ${m.title}`}
                    >
                      Edit
                    </button>
                  )}

                  {onDeleteMilestone && (
                    <button
                      type="button"
                      className="cb-btn cb-btn-danger cb-btn-sm"
                      onClick={() => onDeleteMilestone(m)}
                      aria-label={`Delete ${m.title}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
