import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminRiskSummaryPanel } from '@/components/Admin/AdminRiskSummaryPanel';
import { Api } from '@/services/api';

const t = vi.hoisted(
  () => (_key: string, fallback?: string, values?: Record<string, unknown>) =>
    (fallback || _key).replace(/\{\{(\w+)\}\}/g, (_match, key) => String(values?.[key] ?? ''))
);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('i18next', () => ({ default: { t } }));

vi.mock('@/services/api', () => ({
  Api: {
    getAdminRiskSummary: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('AdminRiskSummaryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render zero risk metrics when risk summary fails to load', async () => {
    vi.mocked(Api.getAdminRiskSummary).mockRejectedValue(new Error('Risk API down'));

    render(<AdminRiskSummaryPanel />);

    await waitFor(() => {
      expect(screen.getByText('Risk summary unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('High-risk audit events')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry risk summary/i })).toBeInTheDocument();
  });

  it('renders tenant risk summary from P32 endpoint data', async () => {
    vi.mocked(Api.getAdminRiskSummary).mockResolvedValue({
      summary: {
        audit: {
          totalLogs: 12,
          unresolvedCount: 3,
          highRiskCount: 2,
        },
        incidents: [
          {
            id: 'incident-1',
            provider: 'openrouter',
            severity: 'high',
            status: 'investigating',
            started_at: '2026-04-26T10:00:00.000Z',
          },
        ],
      },
    });

    render(<AdminRiskSummaryPanel />);

    await waitFor(() => {
      expect(Api.getAdminRiskSummary).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('High-risk audit events')).toBeInTheDocument();
    expect(screen.getByText('Unresolved audit items')).toBeInTheDocument();
    expect(screen.getByText('LLM incidents')).toBeInTheDocument();
    expect(screen.getByText(/openrouter/)).toBeInTheDocument();
    expect(screen.queryByText('Risk summary unavailable')).not.toBeInTheDocument();
  });

  it('does not render invalid risk metrics or incident dates as raw NaN values', async () => {
    vi.mocked(Api.getAdminRiskSummary).mockResolvedValue({
      summary: {
        audit: {
          totalLogs: 'not-a-number',
          unresolvedCount: 'not-a-number',
          highRiskCount: 'not-a-number',
        },
        incidents: [
          {
            id: 'incident-1',
            provider: 'openrouter',
            severity: 'high',
            status: 'investigating',
            started_at: 'not-a-date',
          },
        ],
      },
    });

    render(<AdminRiskSummaryPanel />);

    expect(await screen.findByText(/openrouter/)).toBeInTheDocument();
    expect(screen.getByText(/Started: Unknown time/)).toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });
});
