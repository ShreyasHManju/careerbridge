import React, { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react';
import { getSkills } from '@/api/skills';
import { Skill } from '@/types/skill';

export interface SkillTagInputProps {
  id?: string;
  label?: string;
  value?: string | string[];
  onChange: (value: string) => void;
  onTagsChange?: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  maxTags?: number;
  className?: string;
}

export const SkillTagInput: React.FC<SkillTagInputProps> = ({
  id: explicitId,
  label,
  value = '',
  onChange,
  onTagsChange,
  placeholder = 'e.g. React, TypeScript, Python (press comma or Enter to add)',
  disabled = false,
  error,
  helperText,
  maxTags = 30,
  className = '',
}) => {
  const generatedId = useId();
  const inputId = explicitId || `skill-input-${generatedId}`;
  const listboxId = `skill-listbox-${generatedId}`;

  // Parse tags helper
  const parseTags = useCallback((val: string | string[]): string[] => {
    if (Array.isArray(val)) {
      return val.map((s) => s.trim()).filter(Boolean);
    }
    if (!val || typeof val !== 'string') {
      return [];
    }
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, []);

  const stringValue = typeof value === 'string' ? value : value.join(', ');
  const tags = useMemo(() => parseTags(value), [value, parseTags]);

  const [suggestions, setSuggestions] = useState<Skill[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [activeQuery, setActiveQuery] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch suggestions based on active query
  useEffect(() => {
    const query = activeQuery.trim();
    if (!query || query.length < 1) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setIsOpen(false);
      return;
    }

    let isMounted = true;
    setIsLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const results = await getSkills({ q: query, limit: 8 }).catch(() => []);
        if (isMounted) {
          const existingLower = new Set(tags.map((t) => t.toLowerCase()));
          const filtered = results.filter(
            (s) => !existingLower.has(s.name.toLowerCase())
          );
          setSuggestions(filtered);
          setIsOpen(filtered.length > 0);
          setHighlightedIndex(-1);
        }
      } catch {
        if (isMounted) {
          setSuggestions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeQuery, tags]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifyChange = (newTags: string[]) => {
    const serialized = newTags.join(', ');
    onChange(serialized);
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  const addTag = (tagName: string) => {
    const clean = tagName.trim();
    if (!clean || tags.length >= maxTags) return;

    const lower = clean.toLowerCase();
    const existing = tags.filter((t) => t.toLowerCase() !== lower);
    const updated = [...existing, clean];
    notifyChange(updated);
    setActiveQuery('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const removeTag = (indexToRemove: number) => {
    if (disabled) return;
    const updated = tags.filter((_, idx) => idx !== indexToRemove);
    notifyChange(updated);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    // Determine current token being typed for autocomplete suggestions
    const lastToken = val.split(',').pop()?.trim() || '';
    setActiveQuery(lastToken);

    if (onTagsChange) {
      onTagsChange(parseTags(val));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        e.preventDefault();
        const chosen = suggestions[highlightedIndex].name;
        // Replace last token with chosen skill
        const tokens = stringValue.split(',').map((t) => t.trim()).filter(Boolean);
        if (tokens.length > 0) {
          tokens[tokens.length - 1] = chosen;
        } else {
          tokens.push(chosen);
        }
        notifyChange(Array.from(new Set(tokens)));
        setIsOpen(false);
        setActiveQuery('');
      }
    } else if (e.key === 'ArrowDown') {
      if (isOpen && suggestions.length > 0) {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      if (isOpen && suggestions.length > 0) {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`cb-skill-tag-input-container ${className}`}
      style={{ position: 'relative', width: '100%' }}
    >
      {label && (
        <label
          htmlFor={inputId}
          className="cb-filter-label"
          style={{
            display: 'block',
            marginBottom: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--cb-text)',
          }}
        >
          {label}
        </label>
      )}

      {/* Render selected skill chips if any */}
      {tags.length > 0 && (
        <div
          className="cb-skill-chips-bar"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.375rem',
            marginBottom: '0.5rem',
          }}
        >
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="cb-skill-tag"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#eff6ff',
                color: 'var(--cb-primary)',
                border: '1px solid #bfdbfe',
                borderRadius: '9999px',
                padding: '0.125rem 0.625rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(index);
                  }}
                  aria-label={`Remove skill ${tag}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '0.375rem',
                    padding: 0,
                    width: '16px',
                    height: '16px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--cb-primary)',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    fontSize: '0.75rem',
                    lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Controlled text input for backward-compatible typing/values */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={inputId}
          name="skills"
          type="text"
          value={stringValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (activeQuery.trim() && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 ? `skill-opt-${highlightedIndex}` : undefined
          }
          className={`cb-input ${error ? 'cb-input-error' : ''}`}
        />
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Skill suggestions"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: '0.25rem',
            backgroundColor: 'var(--cb-surface)',
            border: '1px solid var(--cb-border)',
            borderRadius: 'var(--cb-radius)',
            boxShadow: 'var(--cb-shadow-lg)',
            maxHeight: '220px',
            overflowY: 'auto',
            listStyle: 'none',
            padding: '0.25rem 0',
          }}
        >
          {isLoadingSuggestions && (
            <li
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.8125rem',
                color: 'var(--cb-text-muted)',
              }}
            >
              Searching canonical skills...
            </li>
          )}

          {!isLoadingSuggestions &&
            suggestions.map((skill, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <li
                  key={skill.id}
                  id={`skill-opt-${index}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(skill.name);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    backgroundColor: isHighlighted ? '#eff6ff' : 'transparent',
                    color: isHighlighted ? 'var(--cb-primary)' : 'var(--cb-text)',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{skill.name}</span>
                  {skill.category && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--cb-text-muted)',
                        backgroundColor: '#f1f5f9',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                      }}
                    >
                      {skill.category}
                    </span>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      {/* Error & Helper text */}
      {error && (
        <span
          className="cb-field-error"
          style={{ color: 'var(--cb-danger)', display: 'block', marginTop: '0.25rem' }}
          role="alert"
        >
          {error}
        </span>
      )}
      {!error && helperText && (
        <small
          className="cb-input-hint"
          style={{ color: 'var(--cb-text-muted)', display: 'block', marginTop: '0.25rem' }}
        >
          {helperText}
        </small>
      )}
    </div>
  );
};
