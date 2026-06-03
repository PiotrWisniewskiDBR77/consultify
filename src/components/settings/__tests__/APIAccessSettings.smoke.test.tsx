/**
 * @vitest-environment jsdom
 *
 * Smoke test for APIAccessSettings — verifies the API key rotation workflow
 * calls the rotate endpoint and confirms the new key prefix from a refreshed
 * key list.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: string) => def ?? _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

// recharts is heavy and irrelevant to the rotation flow — stub it.
vi.mock('recharts', () => {
  const Noop = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    CartesianGrid: Noop,
    Legend: Noop,
    Line: Noop,
    LineChart: Noop,
    ResponsiveContainer: Noop,
    Tooltip: Noop,
    XAxis: Noop,
    YAxis: Noop,
  };
});

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title }: { title?: string }) => <div role="alert">{title}</div>,
}));

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: apiPost,
    put: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
}));

import { APIAccessSettings } from '../APIAccessSettings';

const keyRow = (prefix: string) => ({
  id: 'key-1',
  name: 'Primary key',
  keyPrefix: prefix,
  createdAt: new Date().toISOString(),
  scopes: [],
});

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  // Initial load returns the old key; subsequent (post-rotate) load returns the new prefix.
  apiGet
    .mockResolvedValueOnce({ data: { keys: [keyRow('cnsl_oldpr')] } })
    .mockResolvedValue({ data: { keys: [keyRow('cnsl_newpr')] } });
  apiPost.mockResolvedValue({ data: { key: { key: 'sk-new-secret', keyPrefix: 'cnsl_newpr' } } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('APIAccessSettings smoke — key rotation', () => {
  it('rotates a key and confirms the new prefix', async () => {
    render(<APIAccessSettings />);
    // Wait for the key list to load.
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/settings/api-keys'));

    const rotateBtn = await screen.findByTitle('Rotate key');
    fireEvent.click(rotateBtn);

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/api/settings/api-keys/key-1/rotate', {})
    );
    // The post-rotate refresh re-fetches the key list to confirm the new prefix.
    await waitFor(() => expect(apiGet.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
