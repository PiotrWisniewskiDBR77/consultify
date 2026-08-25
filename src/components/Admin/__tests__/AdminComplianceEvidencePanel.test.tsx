import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { Api } from '../../../services/api';
import {
  getAiPolicy,
  getDataResidency,
  getRetentionSchedules,
} from '../../../services/enterpriseComplianceApi';
import { AdminComplianceEvidencePanel } from '../AdminComplianceEvidencePanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/api', () => ({
  Api: {
    getTenantAdminAuditLogs: vi.fn(),
    getTenantAdminAuditStats: vi.fn(),
    getAdminComplianceSummary: vi.fn(),
    exportTenantAdminAuditLogs: vi.fn(),
  },
}));
vi.mock('../../../services/enterpriseComplianceApi', () => ({
  getDataResidency: vi.fn(),
  getRetentionSchedules: vi.fn(),
  getAiPolicy: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = vi.mocked(Api);
const residency = vi.mocked(getDataResidency);
const retention = vi.mocked(getRetentionSchedules);
const ai = vi.mocked(getAiPolicy);
describe('AdminComplianceEvidencePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getTenantAdminAuditLogs.mockResolvedValue({
      logs: [{ id: 'l1', action: 'LOGIN', actor: 'u1', risk: 'low', createdAt: 'now' }],
    });
    api.getTenantAdminAuditStats.mockResolvedValue({
      totalLogs: 1,
      unresolvedCount: 0,
      highRiskCount: 0,
    });
    api.getAdminComplianceSummary.mockResolvedValue({ summary: {} });
    residency.mockResolvedValue({ dataResidencyRegion: 'EU' } as any);
    retention.mockResolvedValue([]);
    ai.mockResolvedValue({ requiredCitationMode: 'required' } as any);
  });
  it('loads audit evidence and canonical policy sources', async () => {
    render(
      <MemoryRouter>
        <AdminComplianceEvidencePanel />
      </MemoryRouter>
    );
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
    expect(screen.getByText('EU')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rezydencja danych/ })).toHaveAttribute(
      'href',
      '/admin/command/compliance-posture?tab=residency'
    );
  });
  it('shows the backend error honestly', async () => {
    api.getTenantAdminAuditLogs.mockRejectedValue(new Error('evidence down'));
    render(
      <MemoryRouter>
        <AdminComplianceEvidencePanel />
      </MemoryRouter>
    );
    expect(
      (await screen.findAllByRole('alert')).some((node) =>
        node.textContent?.includes('evidence down')
      )
    ).toBe(true);
  });
});
