/**
 * MAT-006B / P2 — restoring a version must not trigger a write.
 *
 * A server-side restore is ALREADY persisted: the endpoint writes the snapshot
 * back onto `presentation_decks`, bumps `version`, and DeckBuilder reads the
 * canonical row back. Autosaving that read-back is pure damage:
 *   - it bumps `version` again, desynchronising the compare-and-swap token the
 *     restore had just synchronised (the user's NEXT real edit then 409s);
 *   - it appends a `presentation_deck_versions` snapshot recording no change;
 *   - it moves `updated_at`, reordering the Materials list.
 *
 * This suite renders the REAL `DeckBuilder` (real loader, real
 * `useDeckAutosave`, real `useVersionHistory`, real `handleRestoreVersion`) and
 * asserts on the network calls the browser would actually make. Only leaf UI
 * components and services are stubbed — none of the save/restore wiring is.
 *
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DECK_ID = 'deck-mat006b';

// ---------------------------------------------------------------------------
// Environment stubs. Everything below is a leaf (routing, i18n, toasts, remote
// services, presentational children) — the save/restore logic under test is
// deliberately NOT mocked.
// ---------------------------------------------------------------------------
const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ deckId: DECK_ID }),
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('react-hot-toast', () => {
  const toast: any = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
  });
  return { default: toast, toast };
});

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    put: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
    getLinkGraphBacklinks: vi.fn(async () => ({ data: { backlinks: [] } })),
  },
}));
vi.mock('@/services/api/presentationStudio.api', () => ({
  PresentationStudioApi: {
    regenerateSlide: vi.fn(async () => ({ data: {} })),
  },
}));
vi.mock('@/services/presentationExport', () => ({
  exportPresentationDeck: vi.fn(async () => undefined),
  PresentationExportError: class extends Error {},
}));
vi.mock('@/services/presentationGovernance', () => ({
  fetchPresentationGovernanceCard: vi.fn(async () => null),
}));
vi.mock('@/services/presentationRuntimeEvents', () => ({
  fetchPresentationRuntimeEvents: vi.fn(async () => ({ events: [], degraded: false })),
  deriveLastAgentActivity: vi.fn(() => null),
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) => selector({ currentUser: null }),
}));

/**
 * Leaf components are reduced to "render your children, nothing else". Defined
 * through `vi.hoisted` because `vi.mock` factories are hoisted above the module
 * body; no JSX here, so the stub needs no React binding at hoist time.
 */
const { stub } = vi.hoisted(() => ({
  stub: () => (props: { children?: unknown }) => (props?.children ?? null) as any,
}));

/**
 * Teresa's entry point, reduced to one button that fires the real
 * `handleTeresaDeckIntent` → `handleAiPrompt` chain (the only way to reach the
 * agent-edit accept banner).
 */
vi.mock('@/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: (props: any) => (
    <button
      type="button"
      data-testid="teresa-prompt"
      onClick={() => props.onModuleIntent('rewrite')}
    >
      ask
    </button>
  ),
}));
vi.mock('@/components/Initiatives/InitiativeSourceLink', () => ({
  getSourceDisplayLabel: () => 'source',
}));
vi.mock('@/components/shared/NModeBlocks', () => ({ EmbeddedView: stub() }));
vi.mock('@/components/shared/states', () => ({
  ErrorState: stub(),
  SkeletonState: stub(),
}));
vi.mock('@/components/standard/ArtifactApprovalStatusBar', () => ({
  ArtifactApprovalStatusBar: stub(),
}));
vi.mock('@/components/standard/EvidencePanelSection', () => ({
  EvidencePanelSection: stub(),
}));
vi.mock('@/components/ui/primitives', () => ({
  ErrorState: stub(),
  LoadingState: stub(),
}));
vi.mock('@/components/ui/primitives/chips/EntityStatusChip', () => ({
  EntityStatusChip: stub(),
}));

vi.mock('../AgentActivityPanel', () => ({ AgentActivityPanel: stub() }));
vi.mock('../BlockToolbar', () => ({ BlockToolbar: stub() }));
vi.mock('../CardCanvas', () => ({ CardCanvas: stub() }));
vi.mock('../CommandPalette', () => ({
  CommandPalette: stub(),
  useCommandPaletteShortcut: () => undefined,
}));
vi.mock('../ConflictBanner', () => ({ ConflictBanner: stub() }));
vi.mock('../DeckAuditLogModal', () => ({ DeckAuditLogModal: stub() }));
vi.mock('../DeckBuilderBottomBar', () => ({ DeckBuilderBottomBar: stub() }));
vi.mock('../DeckBuilderTopBar', () => ({ DeckBuilderTopBar: stub() }));
vi.mock('../DeckCommentsPanel', () => ({ DeckCommentsPanel: stub() }));
vi.mock('../DeckGovernanceCardModal', () => ({ DeckGovernanceCardModal: stub() }));
vi.mock('../DeckPresenceStack', () => ({ DeckPresenceStack: stub() }));
vi.mock('../DeckQualityGatesPanel', () => ({ DeckQualityGatesPanel: stub() }));
vi.mock('../DeckRelationsPanel', () => ({ DeckRelationsPanel: stub() }));
vi.mock('../DeckThemeContext', () => ({ DeckThemeProvider: stub() }));
vi.mock('../MediaLibraryBrowser', () => ({ MediaLibraryBrowser: stub() }));
vi.mock('../PresentMode', () => ({ PresentMode: stub() }));
vi.mock('../ShareAnalyticsPanel', () => ({ ShareAnalyticsPanel: stub() }));
vi.mock('../ShareModal', () => ({ ShareModal: stub() }));
vi.mock('../SlideSorter', () => ({ SlideSorter: stub() }));
vi.mock('../ThemeSwitcher', () => ({ ThemeSwitcher: stub() }));
vi.mock('../useCollaboration', () => ({
  useCollaboration: () => ({ connectedUsers: [], sendCursor: vi.fn(), sendEdit: vi.fn() }),
}));
vi.mock('../useDataRefresh', () => ({
  useDataRefresh: () => ({
    isCardOutdated: () => false,
    refreshCard: vi.fn(),
    refreshAllCards: vi.fn(),
    refreshBlock: vi.fn(),
  }),
}));

/**
 * The two shells that actually surface the wiring under test:
 *  - `DeckBuilderMelsView` — its `onTitleChange` IS DeckBuilder's real user-edit
 *    entry point (`handleTitleChange` → `setDeck`), and it renders the overlays
 *    slot that contains the version history panel.
 *  - `VersionHistoryPanel` — reduced to one button per version, wired to the
 *    real `onRestore` (`handleRestoreVersion`).
 */
vi.mock('../DeckBuilderMelsView', () => ({
  DeckBuilderMelsView: (props: any) => (
    <div>
      <button
        type="button"
        data-testid="user-edit"
        onClick={() => props.onTitleChange('Edited by the user')}
      >
        edit
      </button>
      {/* Ctrl+Z, in effect: puts the deck back to the title it was loaded with. */}
      <button
        type="button"
        data-testid="user-edit-undo"
        onClick={() => props.onTitleChange('Steering committee deck')}
      >
        undo
      </button>
      {props.aiEntrySlot}
      {props.bannerSlot}
      {props.overlays}
    </div>
  ),
}));
vi.mock('../VersionHistoryPanel', () => ({
  VersionHistoryPanel: ({ versions, onRestore }: any) => (
    <div data-testid="version-history">
      {(versions || []).map((v: any) => (
        <button
          type="button"
          key={v.id}
          data-testid={`restore-${v.id}`}
          onClick={() => onRestore(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  ),
}));

import { DeckBuilder } from '../DeckBuilder';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const CURRENT_DECK = {
  deck_id: DECK_ID,
  title: 'Steering committee deck',
  status: 'ready',
  color_set_id: 'midnight_navy',
  cards: [
    { card_id: 'c1', order_index: 0, title: 'Cover', blocks: [] },
    { card_id: 'c2', order_index: 1, title: 'Current state', blocks: [] },
  ],
};

const RESTORED_DECK = {
  deck_id: DECK_ID,
  title: 'Steering committee deck',
  status: 'ready',
  color_set_id: 'midnight_navy',
  cards: [{ card_id: 'c1', order_index: 0, title: 'Cover', blocks: [] }],
};

const SERVER_VERSIONS = [
  {
    id: 'ver-3',
    deck_id: DECK_ID,
    version: 3,
    slide_count: 2,
    created_at: '2026-07-31T10:10:00.000Z',
  },
  {
    id: 'ver-2',
    deck_id: DECK_ID,
    version: 2,
    slide_count: 1,
    created_at: '2026-07-31T10:00:00.000Z',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** The row `GET /presentations/decks/:id` answers with, at a given version. */
function deckRow(deck: unknown, version: number) {
  return {
    id: DECK_ID,
    title: (deck as any).title,
    status: 'ready',
    version,
    deck_json: JSON.stringify(deck),
    source_refs: [],
    updated_at: '2026-07-31T10:00:00.000Z',
  };
}

describe('DeckBuilder — a version restore must not write (MAT-006B / P2)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  /** Canonical deck the fake server currently holds, and its version. */
  let serverDeck: unknown;
  let serverVersion: number;

  const autosavePuts = () =>
    fetchMock.mock.calls.filter(
      (call: any[]) =>
        String(call[0]).endsWith('/autosave') &&
        (call[1] as RequestInit | undefined)?.method === 'PUT'
    );

  beforeEach(() => {
    serverDeck = CURRENT_DECK;
    serverVersion = 7;

    apiGet.mockImplementation(async (url: string) => {
      if (url === `/presentations/decks/${DECK_ID}`) {
        return { data: { data: deckRow(serverDeck, serverVersion) } };
      }
      return { data: { data: [] } };
    });
    apiPost.mockImplementation(async () => ({ data: { data: {} } }));

    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      if (String(url).endsWith('/versions') && method === 'GET') {
        return jsonResponse({ success: true, data: SERVER_VERSIONS });
      }
      if (/\/versions\/[^/]+\/restore$/.test(String(url)) && method === 'POST') {
        // The server restore endpoint persists the snapshot and bumps version.
        serverDeck = RESTORED_DECK;
        serverVersion += 1;
        return jsonResponse({ success: true, version: serverVersion });
      }
      if (String(url) === `/api/presentations/decks/${DECK_ID}` && method === 'GET') {
        return jsonResponse({ success: true, data: deckRow(serverDeck, serverVersion) });
      }
      if (String(url).endsWith('/autosave') && method === 'PUT') {
        serverVersion += 1;
        return jsonResponse({ success: true, version: serverVersion });
      }
      return jsonResponse({ success: true, data: [] });
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === 'token' ? 'test-token' : null),
      setItem: () => undefined,
      removeItem: () => undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function renderBuilderAndLoad() {
    const user = userEvent.setup();
    render(<DeckBuilder />);
    // Loader finished: the version timeline is on screen.
    await waitFor(() => expect(screen.getByTestId('restore-ver-2')).toBeInTheDocument());
    return user;
  }

  it('issues no autosave PUT and no version bump when a server version is restored', async () => {
    const user = await renderBuilderAndLoad();
    const versionAfterLoad = serverVersion;

    await user.click(screen.getByTestId('restore-ver-2'));

    // The restore itself happened...
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call: any[]) =>
          String(call[0]).endsWith('/versions/ver-2/restore')
        )
      ).toBe(true)
    );
    // ...and the canonical read-back landed in the editor.
    await waitFor(() => expect(serverDeck).toBe(RESTORED_DECK));

    // Well past the 800 ms autosave debounce.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(autosavePuts()).toHaveLength(0);
    // Only the restore itself moved the version — nothing wrote after it.
    expect(serverVersion).toBe(versionAfterLoad + 1);
  });

  it('still autosaves exactly once when the user edits after a restore', async () => {
    const user = await renderBuilderAndLoad();

    await user.click(screen.getByTestId('restore-ver-2'));
    await waitFor(() => expect(serverDeck).toBe(RESTORED_DECK));
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(autosavePuts()).toHaveLength(0);

    const versionBeforeEdit = serverVersion;
    await user.click(screen.getByTestId('user-edit'));

    await waitFor(() => expect(autosavePuts()).toHaveLength(1), { timeout: 3000 });
    const [, init] = autosavePuts()[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).title).toBe('Edited by the user');
    // The write carries the version the RESTORE established — not the stale
    // pre-restore token — so the compare-and-swap succeeds instead of 409-ing.
    expect((init.headers as Record<string, string>)['X-Deck-Version']).toBe(
      String(versionBeforeEdit)
    );

    // And it stays at one: no follow-up write of the state we just persisted.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(autosavePuts()).toHaveLength(1);
  });

  /**
   * Same class of bug at a different `setDeck` site: `POST
   * /agent-edit/:id/accept` UPDATEs `deck_json`, bumps `version` and writes the
   * history snapshot server-side, then answers with the persisted deck. The
   * deck DeckBuilder puts into state is therefore server truth, and the old code
   * both re-wrote it and kept the pre-accept CAS token (so the write 409-ed into
   * the conflict banner).
   */
  it('does not re-write an agent edit the accept endpoint already persisted', async () => {
    const proposed = { ...CURRENT_DECK, title: 'Agent proposal' };
    // What accept actually stores: the proposal plus its own bookkeeping.
    const persisted = {
      ...proposed,
      ai: { lastResolvedOperationId: 'op-1', reviewState: 'clean' },
      updated_at: '2026-07-31T11:00:00.000Z',
    };
    apiPost.mockImplementation(async (url: string) => {
      if (url.endsWith('/agent-edit')) {
        return {
          data: {
            data: { deck: proposed, reply: 'done', appliedActions: [], operationId: 'op-1' },
          },
        };
      }
      if (url.endsWith('/agent-edit/op-1/accept')) {
        serverDeck = persisted;
        serverVersion += 1;
        return { data: { data: { deck: persisted, version: serverVersion } } };
      }
      return { data: { data: {} } };
    });

    const user = await renderBuilderAndLoad();
    await user.click(screen.getByTestId('teresa-prompt'));
    const acceptButton = await screen.findByText('presentations.accept');
    const versionBeforeAccept = serverVersion;

    await user.click(acceptButton);
    await waitFor(() => expect(serverDeck).toBe(persisted));

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(autosavePuts()).toHaveLength(0);
    expect(serverVersion).toBe(versionBeforeAccept + 1);

    // The CAS token followed the accept, so the user's next edit saves cleanly
    // instead of 409-ing on a stale version.
    await user.click(screen.getByTestId('user-edit'));
    await waitFor(() => expect(autosavePuts()).toHaveLength(1), { timeout: 3000 });
    const [, init] = autosavePuts()[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Deck-Version']).toBe(
      String(versionBeforeAccept + 1)
    );
  });

  it('does not write when the deck is merely opened (read-only reopen stays fixed)', async () => {
    await renderBuilderAndLoad();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(autosavePuts()).toHaveLength(0);
    expect(serverVersion).toBe(7);
  });

  /**
   * ★ ONE AUTOSAVE OWNER (MAT-006B / P1) — the lost update, end to end through
   * the real builder.
   *
   * The deck loads at version 7 (so the deleted second writer, whose private
   * token started at 1, would have 409-ed here by construction). The user edits,
   * the PUT is held open, and the user undoes back to the loaded state INSIDE the
   * round trip. Before the fix the effect compared the undone deck with a
   * baseline that had not advanced yet, decided "nothing changed", armed nothing
   * — and the server was left holding the edit the user had undone, with the
   * screen showing the original and no unsaved-changes warning.
   */
  it('does not lose an undo made while a save is in flight', async () => {
    let releaseFirstPut: (() => void) | null = null;
    const originalFetch = fetchMock.getMockImplementation() as unknown as (
      url: string,
      init?: RequestInit
    ) => Promise<Response>;
    let putCount = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/autosave') && init?.method === 'PUT' && ++putCount === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstPut = resolve;
        });
      }
      return originalFetch(url, init);
    });

    const user = await renderBuilderAndLoad();

    await user.click(screen.getByTestId('user-edit'));
    await waitFor(() => expect(autosavePuts()).toHaveLength(1), { timeout: 3000 });
    expect(JSON.parse(String((autosavePuts()[0] as any[])[1].body)).title).toBe(
      'Edited by the user'
    );
    // The single token the builder owns, seeded from the canonical load — not 1.
    expect(
      ((autosavePuts()[0] as any[])[1].headers as Record<string, string>)['X-Deck-Version']
    ).toBe('7');

    // Undo while the write is still open.
    await user.click(screen.getByTestId('user-edit-undo'));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    // One writer: nothing raced the open request.
    expect(autosavePuts()).toHaveLength(1);

    releaseFirstPut!();

    // The queued undo is written after the in-flight save completes, so the
    // server ends up holding what the user is looking at.
    await waitFor(() => expect(autosavePuts()).toHaveLength(2), { timeout: 3000 });
    expect(JSON.parse(String((autosavePuts()[1] as any[])[1].body)).title).toBe(
      'Steering committee deck'
    );
    // ...carrying the version the first write established — no fabricated 409.
    expect(
      ((autosavePuts()[1] as any[])[1].headers as Record<string, string>)['X-Deck-Version']
    ).toBe('8');

    // And it settles: no third write, no ping-pong.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(autosavePuts()).toHaveLength(2);
  });
});
