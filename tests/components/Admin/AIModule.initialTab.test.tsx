/**
 * @vitest-environment jsdom
 *
 * Admin komplet 55, Fala 1 — AdminSettingsModule re-passes `initialTab` when
 * the user navigates between WIRE_ONLY AI screens (models-providers,
 * ai-limits-budgets, data-privacy, ai-operations, ai-audit) without
 * unmounting AIModule. Verifies the sync effect actually switches the
 * visible tab on prop change, and that manual in-module clicks are not
 * reverted by an unchanged prop.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AIModule } from '@/views/admin/AIModule';

vi.mock('@/views/admin/AdminLLMView', () => ({
  AdminLLMView: () => <div data-testid="tab-llm-config">llm-config</div>,
}));
vi.mock('@/components/Admin/AI', () => ({
  AccessLimitsTab: () => <div data-testid="tab-access-limits">access-limits</div>,
  AuditComplianceTab: () => <div data-testid="tab-audit-compliance">audit-compliance</div>,
  FeaturesPrivacyTab: () => <div data-testid="tab-features-privacy">features-privacy</div>,
  ModelsProvidersTab: () => <div data-testid="tab-models-providers">models-providers</div>,
  PolicyGovernanceTab: () => <div data-testid="tab-policy-governance">policy-governance</div>,
}));
vi.mock('@/components/Admin/AIMissionControl', () => ({
  AIMissionControl: () => <div data-testid="tab-ai-health">ai-health</div>,
}));
vi.mock('@/views/admin/HelpAnalyticsDashboard', () => ({
  HelpAnalyticsDashboard: () => <div data-testid="tab-help-analytics">help-analytics</div>,
}));
vi.mock('@/views/admin/TokenBillingManagementView', () => ({
  TokenBillingManagementView: () => <div data-testid="tab-token-management">token-management</div>,
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => '',
}));

describe('AIModule initialTab sync', () => {
  it('opens on the requested tab', () => {
    render(<AIModule initialTab="models-providers" />);
    expect(screen.getByTestId('tab-models-providers')).toBeInTheDocument();
  });

  it('switches tab when the caller passes a new initialTab (re-navigation, no remount)', () => {
    const { rerender } = render(<AIModule initialTab="models-providers" />);
    expect(screen.getByTestId('tab-models-providers')).toBeInTheDocument();

    rerender(<AIModule initialTab="ai-health" />);
    expect(screen.getByTestId('tab-ai-health')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-models-providers')).not.toBeInTheDocument();
  });

  it('does not revert a manual in-module tab click on an unrelated re-render', () => {
    const { rerender } = render(<AIModule initialTab="models-providers" />);
    expect(screen.getByTestId('tab-models-providers')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tokens/i }));
    expect(screen.getByTestId('tab-token-management')).toBeInTheDocument();

    // Same initialTab prop value passed again (e.g. parent re-rendered for an
    // unrelated reason) must not snap the user back to models-providers.
    rerender(<AIModule initialTab="models-providers" />);
    expect(screen.getByTestId('tab-token-management')).toBeInTheDocument();
  });
});
