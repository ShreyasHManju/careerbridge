import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InnovationProjectForm } from '../InnovationProjectForm';
import { InnovationProject } from '@/types/innovationProject';

const mockProject: InnovationProject = {
  id: 1,
  student_id: 10,
  title: 'Quantum Circuit Simulator',
  slug: 'quantum-circuit-simulator',
  short_description: 'Fast Qubit statevector simulator',
  description: 'A high-performance quantum circuit simulator written in Rust and WebAssembly.',
  project_type: 'software',
  status: 'active',
  visibility: 'public',
  skills: 'Rust, WebAssembly, Quantum Computing',
  repository_url: 'https://github.com/student/quantum-sim',
  live_demo_url: 'https://quantum-sim.demo.app',
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
};

describe('InnovationProjectForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form input fields with accessible labels', () => {
    render(<InnovationProjectForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/Project Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Short Summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Detailed Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Project Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Visibility/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Repository URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Live Demo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('validates title and description length constraints', async () => {
    const handleSubmit = vi.fn();
    render(<InnovationProjectForm onSubmit={handleSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Project Title/i), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText(/Detailed Description/i), { target: { value: 'Too short' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Project/i }));

    expect(await screen.findByText(/Title must be at least 2 characters long/i)).toBeInTheDocument();
    expect(await screen.findByText(/Description must be at least 10 characters long/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates invalid URL formats', async () => {
    const handleSubmit = vi.fn();
    render(<InnovationProjectForm onSubmit={handleSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Project Title/i), { target: { value: 'Valid Project Title' } });
    fireEvent.change(screen.getByLabelText(/Detailed Description/i), {
      target: { value: 'Valid long enough project description.' },
    });
    fireEvent.change(screen.getByLabelText(/Repository URL/i), { target: { value: 'ftp://invalid-url.com' } });

    fireEvent.click(screen.getByRole('button', { name: /Publish Project/i }));

    expect(await screen.findByText(/Repository URL must start with http:\/\/ or https:\/\//i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('submits valid payload in create mode', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InnovationProjectForm onSubmit={handleSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Project Title/i), { target: { value: 'Autonomous Drone Swarm' } });
    fireEvent.change(screen.getByLabelText(/Short Summary/i), { target: { value: 'Decentralized drone swarm' } });
    fireEvent.change(screen.getByLabelText(/Detailed Description/i), {
      target: { value: 'A robust ROS2 decentralized swarm navigation system.' },
    });
    fireEvent.change(screen.getByLabelText(/Project Category/i), { target: { value: 'software' } });
    fireEvent.change(screen.getByLabelText(/Visibility/i), { target: { value: 'public' } });
    fireEvent.change(screen.getByLabelText(/Repository URL/i), {
      target: { value: 'https://github.com/student/drone' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Publish Project/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Autonomous Drone Swarm',
          short_description: 'Decentralized drone swarm',
          description: 'A robust ROS2 decentralized swarm navigation system.',
          project_type: 'software',
          visibility: 'public',
          repository_url: 'https://github.com/student/drone',
        })
      );
    });
  });

  it('populates initialData in edit mode and submits updated payload', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InnovationProjectForm initialData={mockProject} onSubmit={handleSubmit} onCancel={vi.fn()} />);

    expect(screen.getByDisplayValue('Quantum Circuit Simulator')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fast Qubit statevector simulator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Project/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Project Title/i), { target: { value: 'Quantum Circuit Simulator v2' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Project/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Quantum Circuit Simulator v2',
        })
      );
    });
  });

  it('displays backend structured error when submission fails', async () => {
    const handleSubmit = vi.fn().mockRejectedValue({
      response: { data: { detail: 'Project with this title already exists' } },
    });
    render(<InnovationProjectForm initialData={mockProject} onSubmit={handleSubmit} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Update Project/i }));

    expect(await screen.findByText(/Project with this title already exists/i)).toBeInTheDocument();
  });

  it('triggers onCancel when Cancel button is clicked', () => {
    const handleCancel = vi.fn();
    render(<InnovationProjectForm onSubmit={vi.fn()} onCancel={handleCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
