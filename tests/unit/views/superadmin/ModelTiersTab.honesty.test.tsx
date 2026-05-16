import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelTiersTab } from '@/views/superadmin/AIPlatformModule/Configuration/ModelTiersTab';
import { toast } from 'react-hot-toast';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => <div {...props}>{children}</div>,
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

const provider = {
  id: 'provider-1',
  name: 'OpenAI GPT-4o',
  provider: 'openai',
  model_id: 'openai/gpt-4o',
  is_active: true,
  health_status: 'healthy',
};

const assignment = {
  id: 'assignment-1',
  tier: 'STANDARD',
  priority: 0,
  is_active: true,
  provider_id: 'provider-1',
  name: 'OpenAI GPT-4o',
  provider: 'openai',
  model_id: 'openai/gpt-4o',
  health_status: 'healthy',
};

const assignmentsPayload = {
  assignments: {
    STANDARD: [assignment],
  },
};

const okJson = (body: unknown) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);

describe('ModelTiersTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(okJson(assignmentsPayload)).mockResolvedValueOnce(okJson([provider]))
    );
  });

  it('accepts deep wrapped assignment and provider payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(okJson({ data: { data: assignmentsPayload } }))
        .mockResolvedValueOnce(okJson({ data: { data: { providers: [provider] } } }))
    );

    render(<ModelTiersTab />);

    expect(await screen.findByText('Model Tier Assignments')).toBeInTheDocument();
    expect(screen.getAllByText('OpenAI GPT-4o').length).toBeGreaterThan(0);
    expect(screen.queryByText('Model tier assignments unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed tier assignment payloads as empty healthy tiers', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(okJson({ data: { data: { unexpected: true } } }))
        .mockResolvedValueOnce(okJson([provider]))
    );

    render(<ModelTiersTab />);

    await waitFor(() => {
      expect(screen.getByText('Model tier assignments unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Tier assignments response was not an object')).toBeInTheDocument();
    expect(screen.queryByText('No models assigned to this tier')).not.toBeInTheDocument();
  });

  it('does not claim removal success when read-back remains stale', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(okJson(assignmentsPayload))
        .mockResolvedValueOnce(okJson([provider]))
        .mockResolvedValueOnce(okJson({ success: true }))
        .mockResolvedValueOnce(okJson(assignmentsPayload))
        .mockResolvedValueOnce(okJson([provider]))
    );

    render(<ModelTiersTab />);

    await screen.findByText('Model Tier Assignments');
    fireEvent.click(screen.getByTitle('Remove model from tier'));

    await waitFor(() => {
      expect(
        screen.getByText('Tier assignment removal was not confirmed by the server')
      ).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Removed OpenAI GPT-4o from STANDARD');
  });
});
