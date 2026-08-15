import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MappingDriftPanel from '@/components/settings/integrations/MappingDriftPanel';
import { V8SyncApi } from '@/services/api/v8/sync';

const { tMock } = vi.hoisted(() => ({
  tMock: (_key: string, fallback?: string | { defaultValue?: string }) =>
    typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
}));

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
}));

vi.mock('@/services/api/v8/sync', () => ({
  V8SyncApi: {
    getMappings: vi.fn(),
    saveMappings: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: tMock,
  }),
}));

const mappingData = (fieldMappings: unknown[]) => ({
  fieldMappings,
  entityMappings: [],
  driftEvents: [],
  syncStates: [],
});

describe('MappingDriftPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed detail loads as no mapping data', async () => {
    vi.mocked(V8SyncApi.getMappings).mockRejectedValue(new Error('Mappings API down'));

    render(<MappingDriftPanel integrationId="slack" />);

    await waitFor(() => {
      expect(screen.getByText('Mapping data unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Mappings API down')).toBeInTheDocument();
    expect(
      screen.queryByText('No mapping data available for this integration.')
    ).not.toBeInTheDocument();
  });

  it('does not claim mapping save success when read-back returns stale field mappings', async () => {
    vi.mocked(V8SyncApi.getMappings)
      .mockResolvedValueOnce(mappingData([{ source: 'old', target: 'oldTarget' }]))
      .mockResolvedValueOnce(mappingData([{ source: 'old', target: 'oldTarget' }]));
    vi.mocked(V8SyncApi.saveMappings).mockResolvedValue({ success: true });

    render(<MappingDriftPanel integrationId="slack" />);

    const editor = await screen.findByRole('textbox');
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify([{ source: 'new', target: 'newTarget' }], null, 2),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByText('Field mappings save was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
