import React from 'react';
import { Link } from 'react-router-dom';
import { PassportResponse } from '@/types/passport';
import { ShieldCheckIcon, CodeFolderIcon, SparklesIcon, CheckCircleIcon, ArrowRightIcon } from './StudentDashboardIcons';

interface CareerEvidencePreviewProps {
  passport?: PassportResponse | null;
}

export const CareerEvidencePreview: React.FC<CareerEvidencePreviewProps> = ({ passport }) => {
  const verifiedExperiences = passport?.summary?.verified_experiences_count ?? passport?.verified_experiences?.length ?? 0;
  const publicProjects = passport?.summary?.public_projects_count ?? passport?.projects?.length ?? 0;
  const canonicalSkills = passport?.summary?.canonical_skills_count ?? passport?.skills?.length ?? 0;
  const verifiedEvidence = passport?.summary?.verified_evidence_count ?? passport?.verified_evidence?.length ?? 0;
  const completedMilestones = passport?.summary?.completed_milestones_count ?? passport?.milestones?.filter(m => m.status === 'completed').length ?? 0;
  const evaluationsCount = passport?.summary?.total_evaluations_count ?? 0;

  return (
    <section className="cb-career-evidence-section" aria-labelledby="career-evidence-heading">
      <div className="cb-section-header">
        <div className="cb-section-title-group">
          <h2 id="career-evidence-heading" className="cb-section-title">
            Verified Career Evidence
          </h2>
          <p className="cb-section-subtitle">
            Your career is more than a static resume. Showcase authentic evidence validated by employers and faculty.
          </p>
        </div>
        <Link to="/app/passport" className="cb-btn cb-btn-secondary cb-btn-sm cb-view-all-link">
          <span>View Career Passport</span>
          <ArrowRightIcon size={14} />
        </Link>
      </div>

      <div className="cb-evidence-grid">
        {/* Verified Experiences */}
        <Link to="/app/experiences" className="cb-evidence-card">
          <div className="cb-evidence-card-icon cb-icon-success">
            <ShieldCheckIcon size={22} />
          </div>
          <div className="cb-evidence-card-body">
            <span className="cb-evidence-value">{verifiedExperiences}</span>
            <h3 className="cb-evidence-title">Verified Experiences</h3>
            <p className="cb-evidence-desc">Authentic internships & leadership roles verified by recruiters.</p>
          </div>
        </Link>

        {/* Public Projects */}
        <Link to="/app/projects" className="cb-evidence-card">
          <div className="cb-evidence-card-icon cb-icon-primary">
            <CodeFolderIcon size={22} />
          </div>
          <div className="cb-evidence-card-body">
            <span className="cb-evidence-value">{publicProjects}</span>
            <h3 className="cb-evidence-title">Innovation Projects</h3>
            <p className="cb-evidence-desc">Technical repositories, live demos, and milestone artifacts.</p>
          </div>
        </Link>

        {/* Verified Skills */}
        <Link to="/app/passport" className="cb-evidence-card">
          <div className="cb-evidence-card-icon cb-icon-info">
            <SparklesIcon size={22} />
          </div>
          <div className="cb-evidence-card-body">
            <span className="cb-evidence-value">{canonicalSkills}</span>
            <h3 className="cb-evidence-title">Documented Skills</h3>
            <p className="cb-evidence-desc">Competencies backed by projects and demonstrated work.</p>
          </div>
        </Link>

        {/* Verified Artifacts / Evidence */}
        <Link to="/app/passport" className="cb-evidence-card">
          <div className="cb-evidence-card-icon cb-icon-accent">
            <CheckCircleIcon size={22} />
          </div>
          <div className="cb-evidence-card-body">
            <span className="cb-evidence-value">{verifiedEvidence + completedMilestones}</span>
            <h3 className="cb-evidence-title">Artifacts & Milestones</h3>
            <p className="cb-evidence-desc">{completedMilestones} completed milestones & {verifiedEvidence} verified artifacts.</p>
          </div>
        </Link>
      </div>

      {evaluationsCount > 0 && (
        <div className="cb-evaluations-callout">
          <span className="cb-evaluations-pill">
            ⭐ {evaluationsCount} Recruiter Evaluation(s) Recorded
          </span>
          <span className="cb-evaluations-text">
            Recruiters have reviewed and provided rubric evaluations on your public projects.
          </span>
        </div>
      )}
    </section>
  );
};
