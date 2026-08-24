/**
 * AdminSettingsModule — section routing tests (Module 17).
 *
 * Verifies the admin shell renders the correct panel per route segment and
 * resolves aliases, instead of aliasing every section back to the people panel
 * (the historical bug documented in the module-17 audit).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { User } from '../../../types';
import AdminSettingsModule from '../AdminSettingsModule';

vi.mock('../../../components/Admin/AdminMembersRolesPanel', () => ({
  AdminMembersRolesPanel: () => <div data-testid="panel-people">people</div>,
}));
vi.mock('../../../components/Admin/AdminBillingFinOpsPanel', () => ({
  AdminBillingFinOpsPanel: ({ screen }: { screen?: string }) => (
    <div data-testid="panel-billing" data-screen={screen}>
      billing
    </div>
  ),
}));
vi.mock('../../../components/Admin/AdminAIControlCenterPanel', () => ({
  AdminAIControlCenterPanel: () => <div data-testid="panel-ai">ai</div>,
}));
vi.mock('../../../components/Admin/AdminSecurityIdentityPanel', () => ({
  AdminSecurityIdentityPanel: () => <div data-testid="panel-security">security</div>,
}));
vi.mock('../../../components/Admin/AdminAuditLogPanel', () => ({
  AdminAuditLogPanel: () => <div data-testid="panel-audit">audit</div>,
}));
vi.mock('../../../components/Admin/AdminHealthPanel', () => ({
  AdminHealthPanel: () => <div data-testid="panel-health">health</div>,
}));
vi.mock('../../../components/Admin/AdminCommandCenterPanel', () => ({
  AdminCommandCenterPanel: ({ aggregationOnly }: { aggregationOnly?: boolean }) => (
    <div data-testid="panel-command" data-aggregation-only={String(Boolean(aggregationOnly))}>
      command
    </div>
  ),
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => ({ setCurrentView: vi.fn() }),
}));

vi.mock('../../../components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const currentUser = { id: 'u1', role: 'ADMIN' } as unknown as User;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminSettingsModule currentUser={currentUser} />
    </MemoryRouter>
  );

describe('AdminSettingsModule section routing', () => {
  it('renders the people panel at /admin/people', () => {
    renderAt('/admin/people');
    expect(screen.getByTestId('panel-people')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-billing')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Użytkownicy|Members/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: /Zaproszenia|Invitations/i })).toBeInTheDocument();
  });

  it('renders the billing panel at /admin/billing', () => {
    renderAt('/admin/billing');
    expect(screen.getByTestId('panel-billing')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-people')).not.toBeInTheDocument();
  });

  it('renders the AI panel at /admin/ai', () => {
    renderAt('/admin/ai');
    expect(screen.getByTestId('panel-ai')).toBeInTheDocument();
  });

  it('renders the security panel at /admin/security', () => {
    renderAt('/admin/security');
    expect(screen.getByTestId('panel-security')).toBeInTheDocument();
  });

  it('renders the audit panel at /admin/audit', () => {
    renderAt('/admin/audit');
    expect(screen.getByTestId('panel-audit')).toBeInTheDocument();
  });

  it('resolves the iam alias to the security panel', () => {
    renderAt('/admin/iam');
    expect(screen.getByTestId('panel-security')).toBeInTheDocument();
  });

  it('resolves the compliance alias to the audit panel', () => {
    renderAt('/admin/compliance');
    expect(screen.getByTestId('panel-audit')).toBeInTheDocument();
  });

  it('falls back to the people panel for unknown segments', () => {
    renderAt('/admin/unknown-section');
    expect(screen.getByTestId('panel-people')).toBeInTheDocument();
  });

  it('exposes mobile navigation state and restores focus after Escape', () => {
    renderAt('/admin/people');
    const toggle = screen.getByRole('button', { name: /Toggle admin navigation/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Close admin navigation/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the real seven-domain navigation keyboard reachable in a scroll container', () => {
    const { container } = renderAt('/admin/people');
    const navigation = container.querySelector('nav');
    expect(navigation).toHaveClass('min-h-0', 'overflow-y-auto');

    const billing = screen.getByRole('button', { name: /Rozliczenia i plany|Billing & Plans/i });
    billing.focus();
    expect(billing).toHaveFocus();
    expect(screen.getByRole('button', { name: /Stan systemu|System Health/i })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /Operacje platformowe|Platform Operations/i })
    ).not.toBeInTheDocument();
  });

  it('fails closed for a direct Platform Operations deep link', () => {
    renderAt('/admin/health/platform-operations');
    expect(screen.getByRole('heading', { name: 'UNAUTHORIZED' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Operacje platformowe|Platform Operations/i })
    ).not.toBeInTheDocument();
  });

  describe('Command Center aggregationOnly (Fala 0, Admin komplet 55)', () => {
    it('keeps aggregationOnly on for the Overview screen', () => {
      renderAt('/admin/command/overview');
      const panel = screen.getByTestId('panel-command');
      expect(panel).toHaveAttribute('data-aggregation-only', 'true');
    });

    it('unlocks the full tabbed experience for Compliance Posture', () => {
      renderAt('/admin/command/compliance-posture');
      const panel = screen.getByTestId('panel-command');
      expect(panel).toHaveAttribute('data-aggregation-only', 'false');
    });

    it('still blocks Attention Queue and Cost & Capacity (FRONT_MISSING, not in scope)', () => {
      renderAt('/admin/command/attention-queue');
      expect(screen.queryByTestId('panel-command')).not.toBeInTheDocument();

      renderAt('/admin/command/cost-capacity');
      expect(screen.queryByTestId('panel-command')).not.toBeInTheDocument();
    });
  });

  describe('WIRE_ONLY screens (Admin komplet 55, Fala 1)', () => {
    it('wires Billing Details to the Budgets & tax (controls) tab', () => {
      renderAt('/admin/billing/billing-details');
      const panel = screen.getByTestId('panel-billing');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveAttribute('data-screen', 'controls');
    });

    it('wires High-risk Changes to the existing audit panel', () => {
      renderAt('/admin/audit/high-risk-changes');
      expect(screen.getByTestId('panel-audit')).toBeInTheDocument();
    });

    it('wires Retention & Export to the existing audit panel', () => {
      renderAt('/admin/audit/retention-export');
      expect(screen.getByTestId('panel-audit')).toBeInTheDocument();
    });

    it('wires Diagnostics to the existing health panel', () => {
      renderAt('/admin/health/diagnostics');
      expect(screen.getByTestId('panel-health')).toBeInTheDocument();
    });
  });
});
