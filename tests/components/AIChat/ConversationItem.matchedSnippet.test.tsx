import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  getConversationEntityType: () => null,
  useConversationStore: () => ({
    renameConversation: vi.fn(),
  }),
}));

vi.mock('../../../src/components/AIChat/MoveToProjectModal', () => ({
  MoveToProjectModal: () => null,
}));

import { ConversationItem } from '../../../src/components/AIChat/ConversationItem';

/**
 * M01-P02 — the search result snippet must render as inert React text
 * nodes, never as HTML. The server already strips its own highlight
 * delimiters and sends {text, mark} segments (see
 * parseConversationSnippetSegments in conversations.routes.ts and the
 * server-side proof in conversations.search.realdb.test.ts); this test
 * covers the client half — that ConversationItem renders those segments
 * as literal text, including when a segment's text looks like markup.
 */
describe('ConversationItem — matched search snippet (M01-P02)', () => {
  const baseConversation = {
    id: 'c1',
    title: 'Team conversation about rollout',
    titleSource: 'auto' as const,
    starred: false,
    archived: false,
    tags: [],
    messageCount: 3,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('renders no snippet row when matchedSnippet is absent (normal, non-search list item)', () => {
    render(<ConversationItem conversation={baseConversation as any} onSelect={vi.fn()} />);
    expect(screen.queryByTestId('conversation-matched-snippet')).toBeNull();
  });

  it('renders {text, mark} segments as text, with the matched term wrapped in <mark>', () => {
    render(
      <ConversationItem
        conversation={
          {
            ...baseConversation,
            matchedMessageId: 'm-1',
            matchedSnippet: [
              { text: 'describe our ', mark: false },
              { text: 'zebraquokka', mark: true },
              { text: ' rollout plan', mark: false },
            ],
          } as any
        }
        onSelect={vi.fn()}
      />
    );

    const snippet = screen.getByTestId('conversation-matched-snippet');
    expect(snippet.textContent).toBe('describe our zebraquokka rollout plan');
    const marked = snippet.querySelector('mark');
    expect(marked).not.toBeNull();
    expect(marked?.textContent).toBe('zebraquokka');
  });

  it('renders a segment whose text looks like markup as literal text, never as real HTML', () => {
    const dangerousText = '<img src=x onerror=alert(1)>';
    render(
      <ConversationItem
        conversation={
          {
            ...baseConversation,
            matchedMessageId: 'm-2',
            matchedSnippet: [
              { text: `before ${dangerousText} `, mark: false },
              { text: 'zebraquokka', mark: true },
              { text: ' after', mark: false },
            ],
          } as any
        }
        onSelect={vi.fn()}
      />
    );

    const snippet = screen.getByTestId('conversation-matched-snippet');
    // React text nodes render the literal characters; there must be no
    // actual <img> element in the DOM (which would mean the string was
    // interpreted as HTML rather than rendered as text).
    expect(snippet.textContent).toContain(dangerousText);
    expect(snippet.querySelector('img')).toBeNull();
  });
});
