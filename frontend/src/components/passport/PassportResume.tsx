import React from 'react';
import { PassportResumeInfo } from '@/types/passport';
import { formatPassportDate } from './PassportExperiences';

export interface PassportResumeProps {
  resume: PassportResumeInfo | null;
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

export const PassportResume: React.FC<PassportResumeProps> = ({ resume }) => {
  if (!resume) {
    return (
      <section className="cb-card cb-passport-section" data-testid="passport-resume-section">
        <h2 className="cb-passport-section-title">Verified Resume</h2>
        <div className="cb-empty-state" data-testid="passport-resume-empty">
          <p className="cb-empty-text">No resume document uploaded.</p>
        </div>
      </section>
    );
  }

  const updatedDate = formatPassportDate(resume.updated_at);

  return (
    <section className="cb-card cb-passport-section" data-testid="passport-resume-section">
      <div className="cb-passport-section-header">
        <h2 className="cb-passport-section-title">Verified Resume</h2>
        <span className="cb-badge cb-badge-success">Document Verified</span>
      </div>

      <div className="cb-passport-resume-card" data-testid="passport-resume-card">
        <div className="cb-resume-icon" aria-hidden="true">
          📄
        </div>
        <div className="cb-resume-details">
          <p className="cb-resume-filename" data-testid="passport-resume-filename">
            {resume.original_filename}
          </p>
          <p className="cb-resume-meta" data-testid="passport-resume-meta">
            {formatFileSize(resume.file_size)} • {resume.content_type.toUpperCase().replace('APPLICATION/', '')} • Updated {updatedDate}
          </p>
        </div>
      </div>
    </section>
  );
};
