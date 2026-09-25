import React from 'react';
import { PassportSkillItem } from '@/types/passport';

export interface PassportSkillsProps {
  skills: PassportSkillItem[];
}

export const PassportSkills: React.FC<PassportSkillsProps> = ({ skills }) => {
  if (!skills || skills.length === 0) {
    return (
      <section className="cb-card cb-passport-section" data-testid="passport-skills-section">
        <h2 className="cb-passport-section-title">Verified Skills & Provenance</h2>
        <div className="cb-empty-state" data-testid="passport-skills-empty">
          <p className="cb-empty-text">No skills added yet to this passport.</p>
        </div>
      </section>
    );
  }

  const formatSource = (source: string): string => {
    switch (source) {
      case 'profile':
        return 'Profile';
      case 'experience':
        return 'Experience';
      case 'project':
        return 'Project';
      default:
        return source;
    }
  };

  return (
    <section className="cb-card cb-passport-section" data-testid="passport-skills-section">
      <div className="cb-passport-section-header">
        <h2 className="cb-passport-section-title">Verified Skills & Provenance</h2>
        <span className="cb-badge cb-badge-neutral">{skills.length} Skills</span>
      </div>

      <div className="cb-passport-skills-grid" data-testid="passport-skills-list">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="cb-passport-skill-card"
            data-testid={`passport-skill-${skill.slug}`}
          >
            <div className="cb-passport-skill-header">
              <span className="cb-passport-skill-name">{skill.name}</span>
              {skill.category && (
                <span className="cb-badge cb-badge-secondary cb-badge-sm">
                  {skill.category}
                </span>
              )}
            </div>

            {skill.sources && skill.sources.length > 0 && (
              <div className="cb-passport-skill-sources" aria-label={`Evidence sources for ${skill.name}`}>
                <span className="cb-passport-source-label">Source:</span>
                <div className="cb-passport-source-tags">
                  {skill.sources.map((src) => (
                    <span
                      key={src}
                      className={`cb-badge cb-badge-sm cb-source-badge cb-source-${src}`}
                      data-testid={`skill-source-${skill.slug}-${src}`}
                    >
                      {formatSource(src)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
