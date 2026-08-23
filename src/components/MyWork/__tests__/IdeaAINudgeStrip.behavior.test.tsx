import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeaAINudgeStrip } from '../IdeaAINudgeStrip';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({ Api: { getIdeaAISuggestions: vi.fn() } }));

const props = {
  ideaId: 'idea-1',
  userId: 'user-1',
  organizationId: 'org-1',
  activeTool: 'mindmap' as const,
  title: 'Growth idea',
  seedText: 'A sufficiently detailed seed for the idea',
  isAccepted: true,
  graphNodes: [{ id: 'node-1', data: { label: 'Root' } }],
  graphEdges: [],
  onActionExpand: vi.fn(),
  onActionConvert: vi.fn(),
};

describe('IdeaAINudgeStrip behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('labels a canvas-derived suggestion and persists dismissal for the idea', () => {
    const first = render(<IdeaAINudgeStrip {...props} />);
    expect(screen.getByText('Canvas analysis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'myWorkIdeas.aiNudgeStrip.dismissNudge' }));
    expect(screen.queryByText('Canvas analysis')).not.toBeInTheDocument();
    first.unmount();

    render(<IdeaAINudgeStrip {...props} />);
    expect(screen.queryByText('Canvas analysis')).not.toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem('consultify:idea-nudges:dismissed:org-1:user-1:idea-1') || '[]'
      )
    ).toContain('few_nodes');
  });

  it('dismisses only after Apply resolves successfully', async () => {
    const onActionExpand = vi
      .fn()
      .mockResolvedValue({ status: 'applied', receiptId: 'r-1', targetId: 'node-2' });
    render(<IdeaAINudgeStrip {...props} onActionExpand={onActionExpand} />);

    fireEvent.click(screen.getByRole('button', { name: 'myWorkIdeas.aiNudgeStrip.apply' }));

    expect(onActionExpand).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Canvas analysis')).not.toBeInTheDocument());
    expect(
      JSON.parse(
        window.localStorage.getItem('consultify:idea-nudges:dismissed:org-1:user-1:idea-1') || '[]'
      )
    ).toContain('few_nodes');
  });

  it('keeps a failed suggestion visible with an alert and Retry', async () => {
    const onActionExpand = vi.fn().mockRejectedValue(new Error('Canvas mutation failed'));
    render(<IdeaAINudgeStrip {...props} onActionExpand={onActionExpand} />);

    fireEvent.click(screen.getByRole('button', { name: 'myWorkIdeas.aiNudgeStrip.apply' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'myWorkIdeas.aiNudgeStrip.applyFailed'
    );
    expect(screen.getByText('Canvas analysis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'myWorkIdeas.aiNudgeStrip.retry' })).toBeEnabled();
    expect(
      window.localStorage.getItem('consultify:idea-nudges:dismissed:org-1:user-1:idea-1')
    ).toBeNull();
  });

  it('keeps a handed-off action visible until a receipt exists', async () => {
    const onActionExpand = vi.fn().mockResolvedValue({ status: 'handed_off' });
    render(<IdeaAINudgeStrip {...props} onActionExpand={onActionExpand} />);

    fireEvent.click(screen.getByRole('button', { name: 'myWorkIdeas.aiNudgeStrip.apply' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'myWorkIdeas.aiNudgeStrip.handedOff'
    );
    expect(screen.getByText('Canvas analysis')).toBeInTheDocument();
    expect(
      window.localStorage.getItem('consultify:idea-nudges:dismissed:org-1:user-1:idea-1')
    ).toBeNull();
  });

  it('treats explicit false as failure and allows a successful Retry receipt', async () => {
    const onActionExpand = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce({ status: 'applied', receiptId: 'r-2', targetId: 'node-2' });
    render(<IdeaAINudgeStrip {...props} onActionExpand={onActionExpand} />);

    fireEvent.click(screen.getByRole('button', { name: 'myWorkIdeas.aiNudgeStrip.apply' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'myWorkIdeas.aiNudgeStrip.retry' }));
    await waitFor(() => expect(screen.queryByText('Canvas analysis')).not.toBeInTheDocument());
    expect(onActionExpand).toHaveBeenCalledTimes(2);
  });

  it('does not invoke the handler twice while Apply is in flight', async () => {
    let resolveAction:
      | ((value: { status: 'applied'; receiptId: string; targetId: string }) => void)
      | undefined;
    const onActionExpand = vi.fn(
      () =>
        new Promise<{ status: 'applied'; receiptId: string; targetId: string }>((resolve) => {
          resolveAction = resolve;
        })
    );
    render(<IdeaAINudgeStrip {...props} onActionExpand={onActionExpand} />);

    const apply = screen.getByRole('button', { name: 'myWorkIdeas.aiNudgeStrip.apply' });
    fireEvent.click(apply);
    fireEvent.click(apply);
    expect(onActionExpand).toHaveBeenCalledTimes(1);

    resolveAction?.({ status: 'applied', receiptId: 'r-3', targetId: 'node-3' });
    await waitFor(() => expect(screen.queryByText('Canvas analysis')).not.toBeInTheDocument());
  });
});
