import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EvidenceTypeBadge } from '../EvidenceTypeBadge';

describe('EvidenceTypeBadge Component', () => {
  it('renders repository badge correctly with icon and aria-label', () => {
    render(<EvidenceTypeBadge type="repository" />);
    const badge = screen.getByTestId('evidence-type-repository');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Repository');
    expect(badge).toHaveAttribute('aria-label', 'Evidence type: Repository');
  });

  it('renders demo badge correctly', () => {
    render(<EvidenceTypeBadge type="demo" />);
    const badge = screen.getByTestId('evidence-type-demo');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Live Demo');
  });

  it('renders document badge correctly', () => {
    render(<EvidenceTypeBadge type="document" />);
    const badge = screen.getByTestId('evidence-type-document');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Document');
  });

  it('renders image badge correctly', () => {
    render(<EvidenceTypeBadge type="image" />);
    const badge = screen.getByTestId('evidence-type-image');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Image');
  });

  it('renders video badge correctly', () => {
    render(<EvidenceTypeBadge type="video" />);
    const badge = screen.getByTestId('evidence-type-video');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Video');
  });

  it('renders presentation badge correctly', () => {
    render(<EvidenceTypeBadge type="presentation" />);
    const badge = screen.getByTestId('evidence-type-presentation');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Presentation');
  });

  it('renders link badge correctly', () => {
    render(<EvidenceTypeBadge type="link" />);
    const badge = screen.getByTestId('evidence-type-link');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Link');
  });

  it('renders other badge correctly', () => {
    render(<EvidenceTypeBadge type="other" />);
    const badge = screen.getByTestId('evidence-type-other');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Other');
  });

  it('applies custom className when provided', () => {
    render(<EvidenceTypeBadge type="repository" className="custom-class" />);
    const badge = screen.getByTestId('evidence-type-repository');
    expect(badge).toHaveClass('custom-class');
  });
});
