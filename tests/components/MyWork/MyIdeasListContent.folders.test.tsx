/**
 * @vitest-environment jsdom
 *
 * Regression tests for the two confirmed Ideas folder bugs (H2.1 / H2.2):
 *   BUG 1 — assigning an idea to a folder must persist (Api.setIdeaFolder called).
 *   BUG 2 — an empty folder must NOT show the global "Idea Garden" empty state,
 *           and must offer a clear way back to "All ideas" (no folder trap).
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── i18n: force English so assertions are stable ──
vi.mock('react-i18next', () => {
  // Stable identities: a fresh `t` per render churns useCallback deps inside
  // MyIdeasListContent (fetchIdeas → fetch effect) into a render loop.
  const t = (key: string, fallback?: unknown) => {
    if (typeof fallback === 'string') return fallback;
    if (fallback && typeof fallback === 'object' && 'defaultValue' in (fallback as any)) {
      return String((fallback as any).defaultValue);
    }
    return key;
  };
  const bundle = { t, i18n: { language: 'en' } };
  return { useTranslation: () => bundle };
});

// ── network-touching primitives / hooks stubbed to no-ops ──
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const setIdeaFolderMock = vi.fn().mockResolvedValue(undefined);
const getMyIdeaFoldersMock = vi.fn();
const getMyIdeasMock = vi.fn();
const createMyIdeaFolderMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeas: (...a: unknown[]) => getMyIdeasMock(...a),
    getMyIdeaFolders: (...a: unknown[]) => getMyIdeaFoldersMock(...a),
    getMyIdeaMapMetrics: vi.fn().mockResolvedValue({ metrics: {} }),
    setIdeaFolder: (...a: unknown[]) => setIdeaFolderMock(...a),
    createMyIdeaFolder: (...a: unknown[]) => createMyIdeaFolderMock(...a),
    deleteMyIdeaFolder: vi.fn(),
    updateMyIdea: vi.fn(),
    deleteMyIdea: vi.fn(),
    convertMyIdea: vi.fn(),
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('@/services/tokenService', () => ({
  tokenService: { getToken: () => null, decodeToken: () => null },
}));
vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

// The favorites/recents hooks hit storage/network — stub them.
vi.mock('../../../src/components/MyWork/hooks/useFavoriteIdeas', () => ({
  useFavoriteIdeas: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
    hydrateFromServer: vi.fn(),
  }),
}));
vi.mock('../../../src/components/MyWork/hooks/useRecentIdeas', () => ({
  useRecentIdeas: () => ({ recentIds: [], record: vi.fn() }),
}));
vi.mock('../../../src/components/MyWork/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({ showHelp: false, setShowHelp: vi.fn() }),
}));

// Heavy children replaced by light doubles. The table double is a faithful proxy
// of the real row-menu wiring: it invokes the same `onMoveToFolder(idea, folderId)`
// prop the production ⋮ menu calls, so BUG 1 is exercised at the container boundary.
vi.mock('../../../src/components/MyWork/IdeasTableContent', () => ({
  IdeasTableContent: ({ ideas, folders, onMoveToFolder }: any) => (
    <div data-testid="ideas-table-double">
      {(folders || []).map((f: any) => (
        <button
          key={f.id}
          type="button"
          data-testid={`assign-${f.id}`}
          onClick={() => onMoveToFolder?.(ideas[0], f.id)}
        >
          Assign to {f.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../../src/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../../../src/components/MyWork/shared/KeyboardShortcutsHelp', () => ({
  KeyboardShortcutsHelp: () => null,
}));

import { MyIdeasListContent } from '../../../src/components/MyWork/MyIdeasListContent';

const FOLDER = { id: 'fold-1', name: 'Roadmap' };

function makeIdeas(count: number, folderId: string | null = null) {
  return Array.from({ length: count }, (_, i) => ({
    id: `idea-${i}`,
    title: `Idea ${i}`,
    body: '',
    tags: [],
    stage: 'spark',
    preferredTool: 'mindmap',
    folderId,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }));
}

function renderList() {
  return render(
    <MyIdeasListContent
      viewMode="table"
      searchQuery=""
      stageFilter="all"
      onIdeaClick={vi.fn()}
      onCreateIdea={vi.fn()}
      onCountsChange={vi.fn()}
    />
  );
}

describe('MyIdeasListContent — folders (H2.1 / H2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIdeaFolderMock.mockResolvedValue(undefined);
    getMyIdeaFoldersMock.mockResolvedValue([FOLDER]);
    createMyIdeaFolderMock.mockResolvedValue({ id: 'fold-new', name: 'Q3 launches' });
  });

  it('BUG 1: assigning an idea to a folder calls Api.setIdeaFolder(id, folderId)', async () => {
    // All ideas are unfiled; the row ⋮ menu offers "move to folder".
    getMyIdeasMock.mockResolvedValue(makeIdeas(3, null));
    renderList();

    // The table double receives `folders` + `onMoveToFolder` from the container
    // only when foldersAvailable — assert both the wiring and the persisted call.
    const assignBtn = await screen.findByTestId('assign-fold-1');
    fireEvent.click(assignBtn);

    await waitFor(() =>
      expect(setIdeaFolderMock).toHaveBeenCalledWith('idea-0', 'fold-1')
    );
  });

  it('BUG 2: an empty folder shows a folder-scoped empty state + a back-to-all exit, NOT the global Idea Garden', async () => {
    // 110 ideas exist globally, but none in FOLDER → folder view is empty.
    // S1-U1: the in-content folder pill bar is gone — folder selection lives in
    // the hub's Command Row (Menu 3) and is driven via the home-shell payload.
    getMyIdeasMock.mockResolvedValue(makeIdeas(110, null));

    let shell: import('../../../src/components/MyWork/myIdeasTypes').IdeasHomeShellPayload | null =
      null;
    render(
      <MyIdeasListContent
        viewMode="table"
        searchQuery=""
        stageFilter="all"
        onIdeaClick={vi.fn()}
        onCreateIdea={vi.fn()}
        onCountsChange={vi.fn()}
        onHomeShellChange={(p) => {
          shell = p;
        }}
      />
    );

    // Home-shell publishes once folders load — then enter the folder like the
    // hub's Folder ▾ dropdown would.
    await waitFor(() => expect(shell?.foldersAvailable).toBe(true));
    act(() => shell!.selectFolder('fold-1'));

    // Folder-scoped empty state — NOT the misleading global CTA.
    const emptyPanel = await screen.findByTestId('ideas-folder-empty');
    expect(within(emptyPanel).getByText('This folder is empty')).toBeTruthy();
    expect(screen.queryByText('Your Idea Garden awaits')).toBeNull();

    // A clear way out of the folder must exist (the empty-state back button;
    // the hub Folder chip is the second exit, outside this component).
    const backBtn = screen.getByTestId('ideas-folder-empty-back');
    fireEvent.click(backBtn);
    await waitFor(() => expect(screen.queryByTestId('ideas-folder-empty')).toBeNull());
  });
});

describe('MyIdeasListContent — "New folder…" dialog (MYW-IDEA-REC-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyIdeasMock.mockResolvedValue(makeIdeas(1, null));
    getMyIdeaFoldersMock.mockResolvedValue([FOLDER]);
    createMyIdeaFolderMock.mockResolvedValue({ id: 'fold-new', name: 'Q3 launches' });
  });

  it('createFolder() opens the canon FolderCreateDialog instead of window.prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('should not be used');
    let shell: import('../../../src/components/MyWork/myIdeasTypes').IdeasHomeShellPayload | null =
      null;
    render(
      <MyIdeasListContent
        viewMode="table"
        searchQuery=""
        stageFilter="all"
        onIdeaClick={vi.fn()}
        onCreateIdea={vi.fn()}
        onCountsChange={vi.fn()}
        onHomeShellChange={(p) => {
          shell = p;
        }}
      />
    );

    await waitFor(() => expect(shell?.foldersAvailable).toBe(true));
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => shell!.createFolder());

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('submitting a name creates the folder via Api.createMyIdeaFolder and closes the dialog', async () => {
    let shell: import('../../../src/components/MyWork/myIdeasTypes').IdeasHomeShellPayload | null =
      null;
    render(
      <MyIdeasListContent
        viewMode="table"
        searchQuery=""
        stageFilter="all"
        onIdeaClick={vi.fn()}
        onCreateIdea={vi.fn()}
        onCountsChange={vi.fn()}
        onHomeShellChange={(p) => {
          shell = p;
        }}
      />
    );

    await waitFor(() => expect(shell?.foldersAvailable).toBe(true));
    act(() => shell!.createFolder());
    await screen.findByRole('dialog');

    fireEvent.change(screen.getByTestId('folder-create-name'), {
      target: { value: 'Q3 launches' },
    });
    fireEvent.click(screen.getByTestId('folder-create-submit'));

    await waitFor(() =>
      expect(createMyIdeaFolderMock).toHaveBeenCalledWith({ name: 'Q3 launches' })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('an empty name never reaches the API (dialog validation, not a silent no-op)', async () => {
    let shell: import('../../../src/components/MyWork/myIdeasTypes').IdeasHomeShellPayload | null =
      null;
    render(
      <MyIdeasListContent
        viewMode="table"
        searchQuery=""
        stageFilter="all"
        onIdeaClick={vi.fn()}
        onCreateIdea={vi.fn()}
        onCountsChange={vi.fn()}
        onHomeShellChange={(p) => {
          shell = p;
        }}
      />
    );

    await waitFor(() => expect(shell?.foldersAvailable).toBe(true));
    act(() => shell!.createFolder());
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByTestId('folder-create-submit'));

    expect(createMyIdeaFolderMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
