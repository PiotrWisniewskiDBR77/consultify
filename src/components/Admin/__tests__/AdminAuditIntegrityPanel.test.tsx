import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { Api } from '../../../services/api';
import { AdminAuditIntegrityPanel } from '../AdminAuditIntegrityPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/api', () => ({ Api: { getTenantAdminAuditStats: vi.fn() } }));
describe('AdminAuditIntegrityPanel', () => {
  it('shows real stats and explicitly denies cryptographic proof', async () => {
    vi.mocked(Api.getTenantAdminAuditStats).mockResolvedValue({
      totalLogs: 12,
      unresolvedCount: 2,
      highRiskCount: 1,
    });
    render(<AdminAuditIntegrityPanel />);
    expect(await screen.findByText('Zdarzenia: 12')).toBeInTheDocument();
    expect(screen.getByText(/Łańcuch haszy nie jest jeszcze prowadzony/)).toBeInTheDocument();
    expect(screen.queryByText(/zweryfikowano kryptograficznie/i)).not.toBeInTheDocument();
  });

  it('renders an honest empty state when no stats are available', async () => {
    vi.mocked(Api.getTenantAdminAuditStats).mockResolvedValue({});
    render(<AdminAuditIntegrityPanel />);
    expect(await screen.findByText('Zdarzenia: —')).toBeInTheDocument();
    expect(screen.getByText('Nierozwiązane: —')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(Api.getTenantAdminAuditStats).mockRejectedValue(new Error('audit stats down'));
    render(<AdminAuditIntegrityPanel />);
    expect(await screen.findByText('audit stats down')).toBeInTheDocument();
  });
});
