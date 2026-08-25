import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getAuditExportHistory } from '../../../services/adminAuditExportHistoryApi';
import { AdminAuditExportHistoryPanel } from '../AdminAuditExportHistoryPanel';
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
