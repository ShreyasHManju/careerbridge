import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { PasswordInput } from '../PasswordInput';

describe('PasswordInput Component', () => {
  it('renders with password hidden by default', () => {
    const handleChange = vi.fn();
    render(
      <PasswordInput
        id="test-pwd"
        value="Secret123!"
        onChange={handleChange}
      />
    );

    const input = screen.getByTestId('password-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('password');
    expect(input.value).toBe('Secret123!');

    const toggleBtn = screen.getByTestId('password-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('type', 'button');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');
  });

  it('toggles password visibility when toggle button is clicked', () => {
    const handleChange = vi.fn();
    render(
      <PasswordInput
        id="test-pwd"
        value="Secret123!"
        onChange={handleChange}
      />
    );

    const input = screen.getByTestId('password-input') as HTMLInputElement;
    const toggleBtn = screen.getByTestId('password-toggle-btn');

    // Initial state: hidden
    expect(input.type).toBe('password');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');

    // Click Show Password
    fireEvent.click(toggleBtn);
    expect(input.type).toBe('text');
    expect(input.value).toBe('Secret123!');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Hide password');

    // Click Hide Password again
    fireEvent.click(toggleBtn);
    expect(input.type).toBe('password');
    expect(input.value).toBe('Secret123!');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');
  });

  it('does not submit parent form when toggle button is clicked', () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    const handleChange = vi.fn();

    render(
      <form onSubmit={handleSubmit}>
        <PasswordInput
          id="test-pwd"
          value="Secret123!"
          onChange={handleChange}
        />
        <button type="submit">Submit</button>
      </form>
    );

    const toggleBtn = screen.getByTestId('password-toggle-btn');
    fireEvent.click(toggleBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('preserves user input value changes cleanly', () => {
    const ControlledHarness = () => {
      const [pwd, setPwd] = useState('');
      return (
        <PasswordInput
          id="test-pwd"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />
      );
    };

    render(<ControlledHarness />);

    const input = screen.getByTestId('password-input') as HTMLInputElement;
    const toggleBtn = screen.getByTestId('password-toggle-btn');

    fireEvent.change(input, { target: { value: 'MySecurePassword!' } });
    expect(input.value).toBe('MySecurePassword!');

    // Toggle to visible
    fireEvent.click(toggleBtn);
    expect(input.type).toBe('text');
    expect(input.value).toBe('MySecurePassword!');

    // Type while visible
    fireEvent.change(input, { target: { value: 'MySecurePassword!2026' } });
    expect(input.value).toBe('MySecurePassword!2026');

    // Toggle back to hidden
    fireEvent.click(toggleBtn);
    expect(input.type).toBe('password');
    expect(input.value).toBe('MySecurePassword!2026');
  });

  it('disables toggle button when input is disabled', () => {
    render(
      <PasswordInput
        id="test-pwd"
        value="Secret123!"
        onChange={vi.fn()}
        disabled={true}
      />
    );

    const input = screen.getByTestId('password-input') as HTMLInputElement;
    const toggleBtn = screen.getByTestId('password-toggle-btn');

    expect(input).toBeDisabled();
    expect(toggleBtn).toBeDisabled();
  });
});
