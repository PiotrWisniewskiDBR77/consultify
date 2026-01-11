/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GovernanceSettings } from '../../../src/components/governance/GovernanceSettings';

vi.mock('lucide-react', () => ({
  Settings: () => <div data-testid="icon-settings" />,
  Shield: () => <div data-testid="icon-shield" />,
  Bell: () => <div data-testid="icon-bell" />,
  Key: () => <div data-testid="icon-key" />,
}));

describe('GovernanceSettings Component', () => {
  it('renders the governance configuration title', () => {
    render(<GovernanceSettings />);
    expect(screen.getByText('Governance Configuration')).toBeInTheDocument();
  });

  it('renders all settings groups', () => {
    render(<GovernanceSettings />);
    expect(screen.getByText('Audit Strategy')).toBeInTheDocument();
    expect(screen.getByText('Security Posture')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('displays individual toggle settings', () => {
    render(<GovernanceSettings />);
    expect(screen.getByText('High-Fidelity Logging')).toBeInTheDocument();
    expect(screen.getByText('Strict RBAC Enforcement')).toBeInTheDocument();
    expect(screen.getByText('Email on Critical Breach')).toBeInTheDocument();
  });

  it('renders numerical inputs for retention', () => {
    render(<GovernanceSettings />);
    expect(screen.getByLabelText(/retention period/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
  });

  it('renders the "Save Configuration" button', () => {
    render(<GovernanceSettings />);
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
  });
});
