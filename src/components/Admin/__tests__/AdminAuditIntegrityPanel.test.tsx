import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../../../services/api';
import { AdminAuditIntegrityPanel } from '../AdminAuditIntegrityPanel';
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
});
