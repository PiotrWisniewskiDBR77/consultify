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
vi.mock('../../../components/Admin/AdminTeamsPanel', () => ({
  AdminTeamsPanel: () => <div data-testid="panel-teams">teams</div>,
}));
vi.mock('../../../components/Admin/AdminPlanHistoryPanel', () => ({
  AdminPlanHistoryPanel: () => <div data-testid="panel-plan-history">plan history</div>,
}));
vi.mock('../../../components/Admin/AdminSeatsLicencesPanel', () => ({
  AdminSeatsLicencesPanel: () => <div data-testid="panel-seats">seats</div>,
}));
vi.mock('../../../components/Admin/AdminJobsPanel', () => ({
  AdminJobsPanel: () => <div data-testid="panel-jobs">jobs</div>,
}));
vi.mock('../../../components/Admin/AdminSlaSloPanel', () => ({
  AdminSlaSloPanel: () => <div data-testid="panel-sla">sla</div>,
}));
vi.mock('../../../components/Admin/AdminServiceAccountsPanel', () => ({
  AdminServiceAccountsPanel: () => <div data-testid="panel-service-accounts">service accounts</div>,
}));
vi.mock('../../../components/Admin/AdminDomainsPanel', () => ({
  AdminDomainsPanel: () => <div data-testid="panel-domains">domains</div>,
}));
vi.mock('../../../components/Admin/AdminSecurityAlertsPanel', () => ({
  AdminSecurityAlertsPanel: () => <div data-testid="panel-security-alerts">alerts</div>,
}));
vi.mock('../../../components/Admin/AdminSessionsPanel', () => ({
  AdminSessionsPanel: () => <div data-testid="panel-sessions">sessions</div>,
}));
vi.mock('../../../components/Admin/AdminBreakGlassPanel', () => ({
  AdminBreakGlassPanel: () => <div data-testid="panel-break-glass">break glass</div>,
}));
vi.mock('../../../components/Admin/AdminGuestsPanel', () => ({
  AdminGuestsPanel: () => <div data-testid="panel-guests">guests</div>,
}));
vi.mock('../../../components/Admin/AdminAccessReviewsPanel', () => ({
  AdminAccessReviewsPanel: () => <div data-testid="panel-access-reviews">reviews</div>,
}));
vi.mock('../../../components/Admin/AdminAccessRequestsPanel', () => ({
  AdminAccessRequestsPanel: () => <div data-testid="panel-access-requests">access requests</div>,
}));
vi.mock('../../../components/Admin/AdminRolesPermissionsPanel', () => ({
  AdminRolesPermissionsPanel: () => <div data-testid="panel-roles">roles</div>,
}));
vi.mock('../../../components/Admin/AdminLegalHoldPanel', () => ({
  AdminLegalHoldPanel: () => <div data-testid="panel-legal-hold">legal hold</div>,
}));
vi.mock('../../../components/Admin/AdminAuditExportHistoryPanel', () => ({
  AdminAuditExportHistoryPanel: () => <div data-testid="panel-export-history">exports</div>,
}));
vi.mock('../../../components/Admin/AdminAuditIntegrityPanel', () => ({
  AdminAuditIntegrityPanel: () => <div data-testid="panel-integrity">integrity</div>,
}));
vi.mock('../../../components/Admin/AI/PersonasPanel', () => ({
  PersonasPanel: () => <div data-testid="panel-personas">personas</div>,
}));
vi.mock('../../../components/Admin/AdminAiIncidentsPanel', () => ({
  AdminAiIncidentsPanel: () => <div data-testid="panel-ai-incidents">incidents</div>,
}));
vi.mock('../../../components/Admin/AdminConfigurationVersionsPanel', () => ({
  AdminConfigurationVersionsPanel: () => (
    <div data-testid="panel-configuration-versions">versions</div>
  ),
}));
vi.mock('../../../components/Admin/AdminOrganizationDefaultsPanel', () => ({
  AdminOrganizationDefaultsPanel: () => (
    <div data-testid="panel-organization-defaults">defaults</div>
  ),
}));
vi.mock('../../../components/Admin/AdminBillingFinOpsPanel', () => ({
  AdminBillingFinOpsPanel: ({ screen }: { screen?: string }) => (
    <div data-testid="panel-billing" data-screen={screen}>
      billing
    </div>
  ),
}));
vi.mock('../../../components/Admin/AdminAIControlCenterPanel', () => ({
  AdminAIControlCenterPanel: ({ initialAiModuleTab }: { initialAiModuleTab?: string }) => (
    <div data-testid="panel-ai" data-initial-ai-module-tab={initialAiModuleTab}>
      ai
    </div>
  ),
}));
vi.mock('../../../components/Admin/AdminAiQualityPanel', () => ({
  AdminAiQualityPanel: () => <div data-testid="panel-ai-quality">ai quality</div>,
}));
vi.mock('../../../components/Admin/AdminSecurityIdentityPanel', () => ({
  AdminSecurityIdentityPanel: ({ initialTab }: { initialTab?: string }) => (
    <div data-testid="panel-security" data-initial-tab={initialTab}>
      security
    </div>
  ),
}));
vi.mock('../../../components/Admin/AdminAuditLogPanel', () => ({
  AdminAuditLogPanel: () => <div data-testid="panel-audit">audit</div>,
}));
vi.mock('../../../components/Admin/AdminComplianceEvidencePanel', () => ({
  AdminComplianceEvidencePanel: () => <div data-testid="panel-compliance-evidence">evidence</div>,
}));
vi.mock('../../../components/Admin/AdminHealthPanel', () => ({
  AdminHealthPanel: () => <div data-testid="panel-health">health</div>,
}));
vi.mock('../../../components/Admin/AdminDependenciesPanel', () => ({
  AdminDependenciesPanel: () => <div data-testid="panel-dependencies">dependencies</div>,
}));
vi.mock('../../../components/Admin/AdminIncidentHistoryPanel', () => ({
  AdminIncidentHistoryPanel: () => <div data-testid="panel-incident-history">incident history</div>,
}));
vi.mock('../../../components/Admin/AdminCommandCenterPanel', () => ({
  AdminCommandCenterPanel: ({
    aggregationOnly,
    screen: commandScreen,
  }: {
    aggregationOnly?: boolean;
    screen?: string;
  }) => (
    <div
      data-testid="panel-command"
      data-aggregation-only={String(Boolean(aggregationOnly))}
      data-screen={commandScreen}
    >
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
  it('wires team/teams to the teams management panel', () => {
    renderAt('/admin/team/teams');
    expect(screen.getByTestId('panel-teams')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-people')).not.toBeInTheDocument();
  });
  it('wires team/guests-external safely', () => {
    renderAt('/admin/team/guests-external');
    expect(screen.getByTestId('panel-guests')).toBeInTheDocument();
  });
  it('wires team/access-reviews read-only', () => {
    renderAt('/admin/team/access-reviews');
    expect(screen.getByTestId('panel-access-reviews')).toBeInTheDocument();
  });
  it('wires team/access-requests to the honest tenant skeleton', () => {
    renderAt('/admin/team/access-requests');
    expect(screen.getByTestId('panel-access-requests')).toBeInTheDocument();
  });
  it('wires team/roles-permissions', () => {
    renderAt('/admin/team/roles-permissions');
    expect(screen.getByTestId('panel-roles')).toBeInTheDocument();
  });

  it('wires billing/plan-history to the read-only history panel', () => {
    renderAt('/admin/billing/plan-history');
    expect(screen.getByTestId('panel-plan-history')).toBeInTheDocument();
  });
  it('wires billing/seats-licences to seat management', () => {
    renderAt('/admin/billing/seats-licences');
    expect(screen.getByTestId('panel-seats')).toBeInTheDocument();
  });
  it('wires health/queues-jobs to tenant jobs', () => {
    renderAt('/admin/health/queues-jobs');
    expect(screen.getByTestId('panel-jobs')).toBeInTheDocument();
  });
  it('wires health/sla-slo to tenant SLOs', () => {
    renderAt('/admin/health/sla-slo');
    expect(screen.getByTestId('panel-sla')).toBeInTheDocument();
  });
  it('wires health/dependencies to the cached dependency map', () => {
    renderAt('/admin/health/dependencies');
    expect(screen.getByTestId('panel-dependencies')).toBeInTheDocument();
  });
  it('wires health/incident-history to the honest tenant skeleton', () => {
    renderAt('/admin/health/incident-history');
    expect(screen.getByTestId('panel-incident-history')).toBeInTheDocument();
  });
  it('wires security/domains to real DNS management', () => {
    renderAt('/admin/security/domains');
    expect(screen.getByTestId('panel-domains')).toBeInTheDocument();
  });
  it('wires security/service-accounts to the service accounts panel', () => {
    renderAt('/admin/security/service-accounts');
    expect(screen.getByTestId('panel-service-accounts')).toBeInTheDocument();
  });
  it('wires security/security-alerts safely', () => {
    renderAt('/admin/security/security-alerts');
    expect(screen.getByTestId('panel-security-alerts')).toBeInTheDocument();
  });
  it('wires security/sessions safely', () => {
    renderAt('/admin/security/sessions');
    expect(screen.getByTestId('panel-sessions')).toBeInTheDocument();
  });
  it('wires security/break-glass safely', () => {
    renderAt('/admin/security/break-glass');
    expect(screen.getByTestId('panel-break-glass')).toBeInTheDocument();
  });
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
  it('wires audit/compliance-evidence to the evidence panel', () => {
    renderAt('/admin/audit/compliance-evidence');
    expect(screen.getByTestId('panel-compliance-evidence')).toBeInTheDocument();
  });
  it('wires audit/legal-hold read-only', () => {
    renderAt('/admin/audit/legal-hold');
    expect(screen.getByTestId('panel-legal-hold')).toBeInTheDocument();
  });
  it('wires audit/export-history', () => {
    renderAt('/admin/audit/export-history');
    expect(screen.getByTestId('panel-export-history')).toBeInTheDocument();
  });
  it('wires audit/integrity honestly', () => {
    renderAt('/admin/audit/integrity');
    expect(screen.getByTestId('panel-integrity')).toBeInTheDocument();
  });
  it('wires ai/personas to the shared personas implementation', () => {
    renderAt('/admin/ai/personas');
    expect(screen.getByTestId('panel-personas')).toBeInTheDocument();
  });
  it('wires ai/ai-incidents', () => {
    renderAt('/admin/ai/ai-incidents');
    expect(screen.getByTestId('panel-ai-incidents')).toBeInTheDocument();
  });
  it('wires ai/configuration-versions', () => {
    renderAt('/admin/ai/configuration-versions');
    expect(screen.getByTestId('panel-configuration-versions')).toBeInTheDocument();
  });
  it('wires ai/quality-evaluations after tenant-safe FIX-11', () => {
    renderAt('/admin/ai/quality-evaluations');
    expect(screen.getByTestId('panel-ai-quality')).toBeInTheDocument();
  });
  it('wires command/organization-defaults', () => {
    renderAt('/admin/command/organization-defaults');
    expect(screen.getByTestId('panel-organization-defaults')).toBeInTheDocument();
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

    it('wires Attention Queue and Cost & Capacity', () => {
      const attention = renderAt('/admin/command/attention-queue');
      expect(screen.getByTestId('panel-command')).toHaveAttribute('data-screen', 'attention-queue');
      attention.unmount();

      renderAt('/admin/command/cost-capacity');
      expect(screen.getByTestId('panel-command')).toHaveAttribute('data-screen', 'cost-capacity');
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

    it.each([
      ['sso', 'policy'],
      ['scim-lifecycle', 'scim'],
      ['api-access', 'api-access'],
      ['risk-summary', 'risk'],
    ])('wires security/%s to the %s tab of AdminSecurityIdentityPanel', (screenId, tabId) => {
      renderAt(`/admin/security/${screenId}`);
      const panel = screen.getByTestId('panel-security');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveAttribute('data-initial-tab', tabId);
    });

    it.each([
      ['models-providers', 'models-providers'],
      ['ai-limits-budgets', 'access-limits'],
      ['data-privacy', 'features-privacy'],
      ['ai-operations', 'ai-health'],
      ['ai-audit', 'audit-compliance'],
    ])(
      'wires ai/%s to the %s tab of AdminAIControlCenterPanel/AIModule',
      (screenId, aiModuleTabId) => {
        renderAt(`/admin/ai/${screenId}`);
        const panel = screen.getByTestId('panel-ai');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveAttribute('data-initial-ai-module-tab', aiModuleTabId);
      }
    );
  });
});
