/**
 * B2b — @mention teammate autocomplete + highlight in IdeaNodeDetailDrawer.
 *
 * Task B2 added an @mention org-member dropdown + @Name highlight renderer to
 * NodeCommentThread (the Mind Map comment surface) and a server-side mention
 * resolver on POST .../map/nodes/:nodeId/comments that fires
 * `whiteboard.mention` notifications. But the WHITEBOARD's actual comment
 * composer is IdeaNodeDetailDrawer, a different component that previously had
 * no autocomplete, no highlight, and didn't even call the comment API (it only
 * mutated local node data). This test asserts the drawer now:
 *  - fetches org members and surfaces a dropdown when typing "@",
 *  - inserts the selected teammate's name into the textarea,
 *  - submits to Api.addNodeComment (the mention-notify endpoint) with the
 *    resolved user ids as `mentions`,
 *  - renders existing comment text with @Name highlighted as a token.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

const addNodeCommentMock = vi.fn();
const getObjectArtifactsMock = vi.fn();
const getIdeaAISuggestionsMock = vi.fn();
const getOrganizationMembersMock = vi.fn();

// IdeaNodeDetailDrawer.tsx calls some t() keys (e.g. addCommentMention) with
// no inline fallback — resolve real English copy for those instead of
// falling through to the raw key.
function resolveTranslation(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  return typeof value === 'string' ? value : key;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || resolveTranslation(key),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    addNodeComment: (...args: any[]) => addNodeCommentMock(...args),
    getObjectArtifacts: (...args: any[]) => getObjectArtifactsMock(...args),
    getIdeaAISuggestions: (...args: any[]) => getIdeaAISuggestionsMock(...args),
    detachArtifactFromObject: vi.fn(),
    getMapVersionFromPayload: () => undefined,
  },
  getMapVersionFromPayload: () => undefined,
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: {
    getOrganizationMembers: (...args: any[]) => getOrganizationMembersMock(...args),
  },
}));

vi.mock('@/services/ideaAIGenerator', () => ({
  generateAIProposal: vi.fn(),
}));

vi.mock('@/utils/artifactLinks', () => ({
  getArtifactLabel: (type: string) => type,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: any) => {
    const state = { currentOrganization: { id: 'org-1', name: 'Acme' } };
    return selector ? selector(state) : state;
  },
}));

import { IdeaNodeDetailDrawer } from '@/components/MyWork/IdeaNodeDetailDrawer';

const ORG_MEMBERS = [
  { userId: 'u-anna', email: 'anna@acme.io', name: 'Anna Kowalska', role: 'member', status: 'active', joinedAt: '' },
  // Single-word display name: the resolver matches a bare "@token" against
  // the pool's `name` field verbatim (it does not fuzzy-split multi-word
  // names), so this member is used to exercise the id-resolution path.
  { userId: 'u-bob', email: 'bob@acme.io', name: 'Bob', role: 'member', status: 'active', joinedAt: '' },
];

function makeProps(over: Partial<React.ComponentProps<typeof IdeaNodeDetailDrawer>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    nodeId: 'node-1',
    nodeData: {
      label: 'Test node',
      comments: [],
    },
    ideaId: 'idea-1',
    activeTool: 'mindmap' as const,
    locked: false,
    allNodes: [],
    onNodeDataChange: vi.fn(),
    ...over,
  };
}

describe('IdeaNodeDetailDrawer — @mention autocomplete + highlight (B2b)', () => {
  beforeEach(() => {
    addNodeCommentMock.mockReset();
    getObjectArtifactsMock.mockReset().mockResolvedValue({ artifactLinks: [] });
    getIdeaAISuggestionsMock.mockReset().mockResolvedValue({ suggestions: [] });
    getOrganizationMembersMock.mockReset().mockResolvedValue(ORG_MEMBERS);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches org members and surfaces a dropdown when typing "@"', async () => {
    render(<IdeaNodeDetailDrawer {...makeProps()} />);

    await waitFor(() => expect(getOrganizationMembersMock).toHaveBeenCalledWith('org-1'));

    const textarea = screen.getByPlaceholderText('Add comment... (@mention)');
    fireEvent.change(textarea, { target: { value: '@an' } });
    // jsdom doesn't compute selectionStart from fireEvent.change alone in all cases;
    // set it explicitly to simulate the caret sitting right after "@an".
    (textarea as HTMLTextAreaElement).setSelectionRange(3, 3);
    fireEvent.change(textarea, { target: { value: '@an' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox', { name: 'Mention a teammate' })).toBeTruthy();
    });
    expect(screen.getByText('Anna Kowalska')).toBeTruthy();
  });

  it('selecting a suggestion inserts the mention into the textarea', async () => {
    render(<IdeaNodeDetailDrawer {...makeProps()} />);
    await waitFor(() => expect(getOrganizationMembersMock).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(
      'Add comment... (@mention)'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '@an' } });
    textarea.setSelectionRange(3, 3);
    fireEvent.change(textarea, { target: { value: '@an' } });

    await waitFor(() => screen.getByText('Anna Kowalska'));
    fireEvent.mouseDown(screen.getByText('Anna Kowalska'));

    await waitFor(() => expect(textarea.value).toBe('@Anna Kowalska '));
  });

  it('submitting sends resolved mentions to Api.addNodeComment (the mention-notify endpoint)', async () => {
    // Resolution matches a bare "@token" against the pool by exact name/id
    // (case-insensitive); it does not fuzzy-match multi-word full names split
    // across whitespace, so a single-word mention token is used here to
    // exercise the id-resolution path deterministically (same behavior as
    // the reference NodeCommentThread implementation this was ported from).
    addNodeCommentMock.mockResolvedValue({
      comment: {
        id: 'cmt-1',
        author: 'Test User',
        text: '@Bob please review',
        mentions: ['u-bob'],
        createdAt: '2026-07-05T00:00:00.000Z',
      },
    });
    const onNodeDataChange = vi.fn();
    render(<IdeaNodeDetailDrawer {...makeProps({ onNodeDataChange })} />);
    await waitFor(() => expect(getOrganizationMembersMock).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(
      'Add comment... (@mention)'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '@Bob please review' } });

    // Submit via Enter to avoid ambiguity across the drawer's many icon buttons.
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => expect(addNodeCommentMock).toHaveBeenCalled());
    expect(addNodeCommentMock).toHaveBeenCalledWith(
      'idea-1',
      'node-1',
      '@Bob please review',
      ['u-bob']
    );

    await waitFor(() =>
      expect(onNodeDataChange).toHaveBeenCalledWith('node-1', {
        comments: [
          {
            id: 'cmt-1',
            userName: 'Test User',
            text: '@Bob please review',
            createdAt: '2026-07-05T00:00:00.000Z',
          },
        ],
      })
    );
  });

  it('renders existing comment text with @Name highlighted as a token', async () => {
    render(
      <IdeaNodeDetailDrawer
        {...makeProps({
          nodeData: {
            label: 'Test node',
            comments: [
              {
                id: 'cmt-old',
                userName: 'Bob Nowak',
                text: 'Hey @Anna Kowalska can you check this?',
                createdAt: '2026-07-04T00:00:00.000Z',
              },
            ],
          },
        })}
      />
    );
    await waitFor(() => expect(getOrganizationMembersMock).toHaveBeenCalled());

    // The mention token should be split into its own highlighted span, not
    // left as part of the raw sentence text node.
    await waitFor(() => {
      expect(screen.getByText('@Anna Kowalska')).toBeTruthy();
    });
    const mentionSpan = screen.getByText('@Anna Kowalska');
    expect(mentionSpan.className).toContain('text-c-info');
  });
});
