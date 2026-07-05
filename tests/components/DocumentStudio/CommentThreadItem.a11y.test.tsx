/**
 * D3 — a11y smoke coverage for CommentThreadItem (B5, Epic E6 UI).
 *
 * DocumentCommentsPanel.test.tsx already covers the thread lifecycle through
 * the parent panel, but does not isolate CommentThreadItem's own a11y
 * contract. This backfills:
 *   - the icon-only delete buttons expose `aria-label` (not just a visual
 *     trash icon);
 *   - the anchor pill is a real `<button>` (keyboard-reachable) and is
 *     `disabled` — not just visually inert — when not navigable;
 *   - the status chip communicates state via TEXT ("Open"/"Resolved"), not
 *     color alone;
 *   - all actions are disabled while `busy` (prevents double-submit via
 *     keyboard/Enter repeat).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CommentThreadItem } from '../../../src/components/DocumentStudio/CommentThreadItem';
import type { DocumentCommentThread } from '../../../src/components/DocumentStudio/types';

function makeThread(overrides: Partial<DocumentCommentThread> = {}): DocumentCommentThread {
  return {
    threadId: 'thread-1',
    artifactId: 'art-1',
    organizationId: 'org-1',
    anchor: { kind: 'document' },
    status: 'open',
    root: {
      commentId: 'comment-1',
      threadId: 'thread-1',
      artifactId: 'art-1',
      organizationId: 'org-1',
      anchor: { kind: 'document' },
      authorId: 'user-1',
      body: 'Please double-check the revenue figure.',
      status: 'open',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    replies: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as DocumentCommentThread;
}

function baseProps(overrides: Partial<React.ComponentProps<typeof CommentThreadItem>> = {}) {
  return {
    thread: makeThread(),
    currentUserId: 'user-1',
    anchorLabel: 'Entire document',
    anchorNavigable: false,
    busy: false,
    onReply: vi.fn().mockResolvedValue(true),
    onResolve: vi.fn().mockResolvedValue(true),
    onReopen: vi.fn().mockResolvedValue(true),
    onDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('CommentThreadItem (D3 a11y smoke)', () => {
  it('gives the icon-only delete button an accessible name', () => {
    render(<CommentThreadItem {...baseProps()} />);
    const deleteBtn = screen.getByTestId('comment-delete-comment-1');
    expect(deleteBtn).toHaveAttribute('aria-label', 'Delete');
    // No un-labeled icon-only affordance: aria-label must be non-empty.
    expect(deleteBtn.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);
  });

  it('does not offer delete when the current user is not the author', () => {
    render(<CommentThreadItem {...baseProps({ currentUserId: 'someone-else' })} />);
    expect(screen.queryByTestId('comment-delete-comment-1')).not.toBeInTheDocument();
  });

  it('renders the anchor pill as a real, keyboard-focusable button that is disabled when not navigable', () => {
    render(<CommentThreadItem {...baseProps({ anchorNavigable: false })} />);
    const anchor = screen.getByTestId('comment-anchor-thread-1');
    expect(anchor.tagName).toBe('BUTTON');
    expect(anchor).toBeDisabled();
  });

  it('enables the anchor pill and fires onAnchorClick when navigable', () => {
    const onAnchorClick = vi.fn();
    render(
      <CommentThreadItem {...baseProps({ anchorNavigable: true, onAnchorClick })} />
    );
    const anchor = screen.getByTestId('comment-anchor-thread-1');
    expect(anchor).not.toBeDisabled();
    fireEvent.click(anchor);
    expect(onAnchorClick).toHaveBeenCalledTimes(1);
  });

  it('communicates thread status via visible text, not color alone', () => {
    const { rerender } = render(<CommentThreadItem {...baseProps()} />);
    expect(screen.getByText('Open')).toBeInTheDocument();

    rerender(
      <CommentThreadItem
        {...baseProps({
          thread: makeThread({
            status: 'resolved',
            root: { ...makeThread().root, status: 'resolved', resolvedBy: 'user-1' },
          }),
        })}
      />
    );
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('disables reply/resolve/reopen actions while busy', () => {
    render(<CommentThreadItem {...baseProps({ busy: true })} />);
    expect(screen.getByTestId('comment-reply-open-thread-1')).toBeDisabled();
    expect(screen.getByTestId('comment-resolve-open-thread-1')).toBeDisabled();
  });

  it('disables the reopen action while busy on a resolved thread', () => {
    render(
      <CommentThreadItem
        {...baseProps({
          busy: true,
          thread: makeThread({
            status: 'resolved',
            root: { ...makeThread().root, status: 'resolved', resolvedBy: 'user-1' },
          }),
        })}
      />
    );
    expect(screen.getByTestId('comment-reopen-thread-1')).toBeDisabled();
  });
});
