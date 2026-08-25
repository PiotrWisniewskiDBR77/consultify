import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getAuditExportHistory } from '../../../services/adminAuditExportHistoryApi';
import { AdminAuditExportHistoryPanel } from '../AdminAuditExportHistoryPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminAuditExportHistoryApi', () => ({ getAuditExportHistory: vi.fn() }));
describe('AdminAuditExportHistoryPanel', () => {
  it('renders real receipt', async () => {
    vi.mocked(getAuditExportHistory).mockResolvedValue([
      {
        id: 'r1',
        requested_by: 'owner-1',
        export_kind: 'audit_logs_csv',
        row_count: 12,
        output_format: 'csv',
        created_at: '2026-08-24',
      },
    ]);
    render(<AdminAuditExportHistoryPanel />);
    expect(await screen.findByText('audit_logs_csv')).toBeInTheDocument();
    expect(screen.getByText('owner-1')).toBeInTheDocument();
  });
  it('shows honest empty state', async () => {
    vi.mocked(getAuditExportHistory).mockResolvedValue([]);
    render(<AdminAuditExportHistoryPanel />);
    expect(await screen.findByText('Brak eksportów')).toBeInTheDocument();
  });
});
