import React from 'react';
import { PassportExperienceItem } from '@/types/passport';

export interface PassportExperiencesProps {
  experiences: PassportExperienceItem[];
}

export const formatPassportDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parts.length > 2 ? parseInt(parts[2], 10) : 1;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const formatVerificationSourceText = (source: string): string => {
  switch (source) {
    case 'recruiter_confirmed':
      return 'Recruiter Verified';
    case 'admin_confirmed':
      return 'Admin Verified';
    case 'faculty_endorsed':
      return 'Faculty Endorsed';
    case 'system_validated':
      return 'System Validated';
    default:
      return 'Verified';
  }
};

export const formatExpType = (type: string): string => {
  switch (type) {
    case 'internship':
      return 'Internship';
    case 'work':
      return 'Work Experience';
    case 'project':
      return 'Project';
    case 'research':
      return 'Research';
    case 'leadership':
      return 'Leadership';
    case 'certification':
      return 'Certification';
    default:
      return type;
  }
};

export const PassportExperiences: React.FC<PassportExperiencesProps> = ({ experiences }) => {
  if (!experiences || experiences.length === 0) {
    return (
      <section className="cb-card cb-passport-section" data-testid="passport-experiences-section">
        <h2 className="cb-passport-section-title">Verified Experience Timeline</h2>
        <div className="cb-empty-state" data-testid="passport-experiences-empty">
          <p className="cb-empty-text">No verified experience records available.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="cb-card cb-passport-section" data-testid="passport-experiences-section">
      <div className="cb-passport-section-header">
        <h2 className="cb-passport-section-title">Verified Experience Timeline</h2>
        <span className="cb-badge cb-badge-success">{experiences.length} Verified</span>
      </div>

      <div className="cb-passport-timeline" data-testid="passport-experiences-list">
        {experiences.map((exp) => {
          const startDate = formatPassportDate(exp.start_date);
          const endDate = exp.is_current ? 'Present' : formatPassportDate(exp.end_date);
          const dateRange = `${startDate} – ${endDate}`;

          return (
            <div
              key={exp.id}
              className="cb-passport-timeline-item"
              data-testid={`passport-experience-${exp.id}`}
            >
              <div className="cb-passport-timeline-marker" />
              <div className="cb-passport-timeline-content">
                <div className="cb-passport-exp-header">
                  <div>
                    <h3 className="cb-passport-exp-title" data-testid={`exp-title-${exp.id}`}>
                      {exp.title}
                    </h3>
                    <div className="cb-passport-exp-sub">
                      {exp.organization_name && (
                        <span className="cb-passport-exp-org" data-testid={`exp-org-${exp.id}`}>
                          {exp.organization_name}
                        </span>
                      )}
                      <span className="cb-passport-exp-type">
                        • {formatExpType(exp.experience_type)}
                      </span>
                    </div>
                  </div>

                  <div className="cb-passport-exp-badges">
                    <span
                      className="cb-badge cb-badge-success"
                      data-testid={`exp-badge-${exp.id}`}
                    >
                      ✓ {formatVerificationSourceText(exp.verification_source)}
                    </span>
                  </div>
                </div>

                <p className="cb-passport-exp-dates" data-testid={`exp-dates-${exp.id}`}>
                  {dateRange}
                </p>

                <p className="cb-passport-exp-desc" data-testid={`exp-desc-${exp.id}`}>
                  {exp.description}
                </p>

                {exp.innovation_project_title && (
                  <div className="cb-passport-linked-project">
                    <span className="cb-passport-linked-label">Associated Project:</span>
                    <span
                      className="cb-badge cb-badge-info"
                      data-testid={`exp-project-${exp.id}`}
                    >
                      🚀 {exp.innovation_project_title}
                    </span>
                  </div>
                )}

                {exp.structured_skills && exp.structured_skills.length > 0 && (
                  <div
                    className="cb-passport-exp-skills"
                    data-testid={`exp-skills-${exp.id}`}
                  >
                    {exp.structured_skills.map((s) => (
                      <span key={s.id} className="cb-badge cb-badge-secondary cb-badge-sm">
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
