import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalSettingsTab } from '@/views/superadmin/AIPlatformModule/Configuration/GlobalSettingsTab';
import { toast } from 'react-hot-toast';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  Reorder: {
    Group: ({
      children,
      onReorder: _onReorder,
      values: _values,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { onReorder?: unknown; values?: unknown }) => (
      <div {...props}>{children}</div>
    ),
    Item: ({
      children,
      value: _value,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { value?: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const settings = {
  id: 'settings-1',
  defaultProvider: null,
  fallbackChain: ['provider-1'],
  circuitBreakerConfig: {
    failureThreshold: 5,
    cooldownSeconds: 60,
  },
  globalTokenLimit: 10000000,
  globalRateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
  },
  maxContextWindowSize: 128000,
  maxTokensPerRequest: 8192,
  piiDetectionSensitivity: 'medium',
  requireEncryption: true,
  dataResidency: null,
  updatedAt: '2026-04-26T10:00:00.000Z',
  updatedBy: 'admin',
};

const provider = {
  id: 'provider-1',
  name: 'OpenAI GPT-4o',
  provider: 'openai',
  is_active: true,
};

const providerTwo = {
  id: 'provider-2',
  name: 'Anthropic Claude',
  provider: 'anthropic',
  is_active: true,
};

const okJson = (body: unknown) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);

describe('GlobalSettingsTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(okJson(settings))
        .mockResolvedValueOnce(okJson([provider, providerTwo]))
    );
  });

  it('accepts deep wrapped settings and providers payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(okJson({ data: { data: settings } }))
        .mockResolvedValueOnce(okJson({ data: { data: { providers: [provider] } } }))
    );

    render(<GlobalSettingsTab />);

    expect(await screen.findByText('Global AI Settings')).toBeInTheDocument();
    expect(screen.getByText('OpenAI GPT-4o')).toBeInTheDocument();
    expect(screen.queryByText('AI settings unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed settings as editable defaults', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(okJson({ data: { data: { unexpected: true } } }))
        .mockResolvedValueOnce(okJson([provider]))
    );

    render(<GlobalSettingsTab />);

    await waitFor(() => {
      expect(screen.getByText('AI settings unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('AI settings response was incomplete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back is stale', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(okJson(settings))
        .mockResolvedValueOnce(okJson([provider, providerTwo]))
        .mockResolvedValueOnce(okJson({ ...settings, defaultProvider: 'provider-2' }))
        .mockResolvedValueOnce(okJson(settings))
        .mockResolvedValueOnce(okJson([provider, providerTwo]))
    );

    render(<GlobalSettingsTab />);

    await screen.findByText('Global AI Settings');
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'provider-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText('AI settings save was not confirmed by the server')).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Settings saved successfully');
  });
});
