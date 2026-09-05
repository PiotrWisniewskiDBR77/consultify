/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GovernanceRules } from '../../../src/components/governance/GovernanceRules';

vi.mock('lucide-react', () => ({
  Gavel: () => <div data-testid="icon-gavel" />,
  Plus: () => <div data-testid="icon-plus" />,
  Search: () => <div data-testid="icon-search" />,
  MoreVertical: () => <div data-testid="icon-more" />,
}));

describe('GovernanceRules Component', () => {
  it('renders the rule management header', () => {
    render(<GovernanceRules />);
    expect(screen.getByText('Governance Rules')).toBeInTheDocument();
    expect(screen.getByText('Define and manage automated system policies.')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    render(<GovernanceRules />);
    expect(screen.getByPlaceholderText('Search rules...')).toBeInTheDocument();
  });

  it('renders the rules table with headers', () => {
    render(<GovernanceRules />);
    expect(screen.getByText('Rule Name')).toBeInTheDocument();
    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('displays the list of predefined rules', () => {
    render(<GovernanceRules />);
    expect(screen.getByText('Auto-Reject High Risk')).toBeInTheDocument();
    expect(screen.getByText('Audit Force Log level')).toBeInTheDocument();
    expect(screen.getByText('Consultant Access Bypass')).toBeInTheDocument();
  });

  it('shows correct status for enabled/disabled rules', () => {
    render(<GovernanceRules />);
    const enabledBadges = screen.getAllByText('Enabled');
    const disabledBadges = screen.getAllByText('Disabled');

    expect(enabledBadges).toHaveLength(2);
    expect(disabledBadges).toHaveLength(1);
  });

  it('renders the action button for rules', () => {
    render(<GovernanceRules />);
    expect(screen.getAllByRole('button')).toHaveLength(4); // Search is input, Plus + 3 MoreVertical
  });
});
