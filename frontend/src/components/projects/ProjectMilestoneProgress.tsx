import React from 'react';

interface ProjectMilestoneProgressProps {
  total: number;
  completed: number;
  progressPercentage?: number;
  className?: string;
}

export const ProjectMilestoneProgress: React.FC<ProjectMilestoneProgressProps> = ({
  total,
  completed,
  progressPercentage,
  className = '',
}) => {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.max(0, completed);
  const percentage =
    typeof progressPercentage === 'number'
      ? Math.min(100, Math.max(0, progressPercentage))
      : safeTotal > 0
      ? Math.min(100, Math.round((safeCompleted / safeTotal) * 100))
      : 0;

  return (
    <div
      className={`cb-milestone-progress-container ${className}`}
      data-testid="project-milestone-progress"
    >
      <div className="cb-progress-header">
        <span className="cb-progress-label">Execution Progress</span>
        <span className="cb-progress-stats">
          <strong className="cb-progress-percentage">{percentage}%</strong>
          <span className="cb-progress-ratio">
            ({safeCompleted} of {safeTotal} completed)
          </span>
        </span>
      </div>

      <div
        className="cb-progress-track"
        role="progressbar"
        aria-label="Project execution progress"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`cb-progress-fill ${percentage === 100 ? 'cb-progress-complete' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
