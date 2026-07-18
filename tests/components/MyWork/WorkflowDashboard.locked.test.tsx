import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  listAutomations: vi.fn(async () => []),
  listTableSyncs: vi.fn(async () => []),
  listDistributions: vi.fn(async () => []),
  listBases: vi.fn(async () => [{ id: 'base-1' }]),
  listWebhookRelays: vi.fn(async () => ({ relays: [] })),
}));

vi.mock('@/components/MyWork/table/automations/AutomationsManager', () => ({
  AutomationsManager: () => <div>Automations manager</div>,
}));

vi.mock('@/components/MyWork/table/sync/SyncManager', () => ({
  SyncManager: () => <div>Sync manager</div>,
}));

vi.mock('@/components/MyWork/table/connectors/WebhookRelayPanel', () => ({
  WebhookRelayPanel: () => <div>Webhook manager</div>,
}));

vi.mock('@/components/MyWork/table/sharing/SharingManager', () => ({
  SharingManager: () => <div>Sharing manager</div>,
}));

vi.mock('@/components/MyWork/table/DistributionBuilder', () => ({
  DistributionBuilder: () => <div>Distribution manager</div>,
}));

import { WorkflowDashboard } from '@/components/MyWork/table/WorkflowDashboard';

describe('WorkflowDashboard locked mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    tableId: 'tbl-1',
    baseId: 'base-1',
    workspaceId: 'ws-1',
    tables: [],
    views: [],
    fields: [],
  };

  it('blocks opening workflow panels when locked', async () => {
    render(<WorkflowDashboard {...baseProps} locked />);

    const automationsCard = await screen.findByRole('button', { name: /Automations/i });
    expect(automationsCard).toBeDisabled();

    fireEvent.click(automationsCard);

    await waitFor(() => {
      expect(screen.queryByText('Automations manager')).not.toBeInTheDocument();
    });
  });

  it('opens workflow panel when unlocked', async () => {
    render(<WorkflowDashboard {...baseProps} locked={false} />);

    const automationsCard = await screen.findByRole('button', { name: /Automations/i });
    expect(automationsCard).not.toBeDisabled();

    fireEvent.click(automationsCard);

    await waitFor(() => {
      expect(screen.getByText('Automations manager')).toBeInTheDocument();
    });
  });
});
