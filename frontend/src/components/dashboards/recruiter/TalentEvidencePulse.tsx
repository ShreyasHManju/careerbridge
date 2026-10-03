import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheckIcon,
  AwardIcon,
  FileTextIcon,
  ArrowRightIcon,
  SparklesIcon,
} from './RecruiterDashboardIcons';

export const TalentEvidencePulse: React.FC = () => {
  return (
    <section className="cb-talent-evidence-pulse" aria-labelledby="talent-evidence-pulse-heading">
      <div className="cb-evidence-pulse-card">
        <div className="cb-evidence-pulse-header">
          <div className="cb-evidence-pulse-title-group">
            <div className="cb-evidence-badge-row">
              <span className="cb-evidence-os-badge">
                <SparklesIcon size={13} aria-hidden={true} />
                <span>Career Operating System</span>
              </span>
            </div>
            <h2 id="talent-evidence-pulse-heading" className="cb-evidence-pulse-title">
              Verified Talent Evidence & Identity
            </h2>
            <p className="cb-evidence-pulse-subtitle">
              CareerBridge evaluates real, verified engineering artifacts, experience records, and project rubrics—moving beyond static resumes.
            </p>
          </div>
        </div>

        <div className="cb-evidence-features-grid">
          {/* Feature 1: Experience Passport Discovery */}
          <div className="cb-evidence-feature-card">
            <div className="cb-evidence-feature-icon cb-icon-bg-primary">
              <ShieldCheckIcon size={20} aria-hidden={true} />
            </div>
            <div className="cb-evidence-feature-content">
              <h3 className="cb-evidence-feature-title">Verified Experience Passports</h3>
              <p className="cb-evidence-feature-desc">
                Review cryptographically signed, institutionally verified student milestone records, GPAs, and validated academic completions.
              </p>
            </div>
            <Link to="/app/recruiter/candidates" className="cb-evidence-feature-link">
              <span>Source Talent</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>

          {/* Feature 2: Project Rubrics & Code Artifacts */}
          <div className="cb-evidence-feature-card">
            <div className="cb-evidence-feature-icon cb-icon-bg-success">
              <FileTextIcon size={20} aria-hidden={true} />
            </div>
            <div className="cb-evidence-feature-content">
              <h3 className="cb-evidence-feature-title">Project Rubric Evaluations</h3>
              <p className="cb-evidence-feature-desc">
                Evaluate live GitHub repositories, architectural complexity, and evidence scores directly during candidate triage.
              </p>
            </div>
            <Link to="/app/recruiter/applications" className="cb-evidence-feature-link">
              <span>Evaluate Candidates</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>

          {/* Feature 3: Institutional Experience Verifications */}
          <div className="cb-evidence-feature-card">
            <div className="cb-evidence-feature-icon cb-icon-bg-warning">
              <AwardIcon size={20} aria-hidden={true} />
            </div>
            <div className="cb-evidence-feature-content">
              <h3 className="cb-evidence-feature-title">Experience Verifications</h3>
              <p className="cb-evidence-feature-desc">
                Validate and sign past internship, research, or work experience requests submitted by student alumni.
              </p>
            </div>
            <Link to="/app/recruiter/experience-verification" className="cb-evidence-feature-link">
              <span>Verify Records</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
