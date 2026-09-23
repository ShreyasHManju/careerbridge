import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SkillTagInput } from '../SkillTagInput';
import * as skillsApi from '@/api/skills';
import { Skill } from '@/types/skill';

const mockSkills: Skill[] = [
  {
    id: 1,
    name: 'React',
    slug: 'react',
    category: 'Frontend',
    is_verified: true,
    created_at: '2026-09-23T00:00:00Z',
  },
  {
    id: 2,
    name: 'React Native',
    slug: 'react-native',
    category: 'Mobile',
    is_verified: true,
    created_at: '2026-09-23T00:00:00Z',
  },
  {
    id: 3,
    name: 'TypeScript',
    slug: 'typescript',
    category: 'Language',
    is_verified: true,
    created_at: '2026-09-23T00:00:00Z',
  },
];

describe('SkillTagInput Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly with label and initial tags from string', () => {
    render(
      <SkillTagInput
        id="test-skills"
        label="Required Skills"
        value="Python, React, TypeScript"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Required Skills/i)).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('allows removing a tag via remove button', () => {
    const handleChange = vi.fn();
    render(
      <SkillTagInput
        label="Skills"
        value="Python, React, Docker"
        onChange={handleChange}
      />
    );

    const removeReactBtn = screen.getByRole('button', { name: /Remove skill React/i });
    fireEvent.click(removeReactBtn);

    expect(handleChange).toHaveBeenCalledWith('Python, Docker');
  });

  it('adds a tag via onChange event with comma string', () => {
    const handleChange = vi.fn();
    render(
      <SkillTagInput
        label="Skills"
        value="Python"
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText(/Skills/i);
    fireEvent.change(input, { target: { value: 'Python, FastAPI' } });

    expect(handleChange).toHaveBeenCalledWith('Python, FastAPI');
  });

  it('renders autocomplete suggestions and allows selecting a suggestion', async () => {
    const getSkillsSpy = vi.spyOn(skillsApi, 'getSkills').mockResolvedValue(mockSkills);
    const handleChange = vi.fn();

    render(
      <SkillTagInput
        label="Skills"
        value="Python"
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText(/Skills/i);
    fireEvent.change(input, { target: { value: 'Python, Re' } });

    await waitFor(() => {
      expect(getSkillsSpy).toHaveBeenCalledWith({ q: 'Re', limit: 8 });
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const suggestion = screen.getByText('React Native');
    fireEvent.mouseDown(suggestion);

    expect(handleChange).toHaveBeenCalledWith('Python, React Native');
  });

  it('renders error message when error prop is provided', () => {
    render(
      <SkillTagInput
        label="Skills"
        value=""
        onChange={vi.fn()}
        error="At least one skill is required."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('At least one skill is required.');
  });

  it('disables input and remove buttons when disabled prop is true', () => {
    render(
      <SkillTagInput
        label="Skills"
        value="Python, React"
        onChange={vi.fn()}
        disabled={true}
      />
    );

    expect(screen.getByLabelText(/Skills/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Remove skill/i })).not.toBeInTheDocument();
  });
});
