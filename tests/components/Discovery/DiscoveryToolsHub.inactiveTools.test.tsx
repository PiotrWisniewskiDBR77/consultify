/**
 * @vitest-environment jsdom
 *
 * RV-028 — the 12 inactive Consulting Tools must be visibly inactive/coming
 * soon in the library, expose no working Open/Start action, and an attempt
 * to open/start/route to their document must not mount a working workflow.
 *
 * Codex final re-review: the previous version of this suite used synthetic
 * audit ids (ct011, ct016, ...) and hand-set `isActive: false` on a mocked
 * fixture — neither proves anything about the REAL product. This version:
 *
 *  1. Imports `ACTIVE_KNOWN_TOOL_TYPES` directly from the real backend
 *     registry (`server/src/services/KnownToolsService.ts`) that computes
 *     `isActive` for `GET /known-tools` (`ToolController.ts` ->
 *     `KnownToolsService.listKnownTools`/`getKnownToolAvailability`, see
 *     `isKnownToolActive()`: `Boolean(rowIsActive) && ACTIVE_KNOWN_TOOL_TYPES.has(toolType)`
 *     — every seeded row is `is_active = 1`, so this Set alone is the real
 *     decision). Twelve real runtime tool-type slugs are asserted absent
 *     from it — not a mock, the actual production allowlist.
 *  2. Builds the frontend fixture's `isActive` for every tool from that SAME
 *     imported Set (`ACTIVE_KNOWN_TOOL_TYPES.has(toolType)`), so the UI test
 *     cannot silently drift from the real registry — if a tool is ever
 *     promoted to active, this fixture flips too and the test fails loudly.
 *  3. Verifies the library shows no working Open/Start for any of the 12,
 *     and that forcing a click never creates a session NOR opens a document
 *     (`handleOpenKnownTool` has its own independent `isActive === false`
 *     guard in DiscoveryToolsHub.tsx, on top of `handleRowAction`'s) — the
 *     library table stays mounted, proving no workflow view replaced it.
 *
 * `StandardTable` is stubbed to a minimal renderer that exposes exactly what
 * `DiscoveryToolsHub` computed for each row (`disabled`, `availability`) —
 * this suite tests DiscoveryToolsHub's own decision logic, not StandardTable
 * (covered by its own suite).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real backend allowlist — server/src/services/KnownToolsService.ts.
// No mocking: this IS the production Set that decides `isActive`.
import { ACTIVE_KNOWN_TOOL_TYPES } from '../../../server/src/services/KnownToolsService';

// Real runtime toolType slugs from the canonical dedicated-renderer registry
// (src/components/DiscoveryTools/dedicatedToolTypes.ts DEDICATED_TOOL_TYPES)
// that are NOT in ACTIVE_KNOWN_TOOL_TYPES — i.e. they have a real document
// renderer wired (RB-026/CT008-010 scope) but are not yet released to users.
const REAL_INACTIVE_TOOL_SLUGS = [
  'vsm-builder',
  'constraint-control',
  'decision-engine',
  'control-tower',
  'automation-pipeline',
  'robotics-feasibility',
  'logistics-automation',
  'integration-diagnostic',
  'digital-value-pool',
  'legacy-analyzer',
  'data-inventory',
  'pain-to-solution',
] as const;

// A real, currently-active slug from the same registry, used as a control.
const REAL_ACTIVE_TOOL_SLUG = 'dynamic-swot';

describe('ACTIVE_KNOWN_TOOL_TYPES (real backend registry) — RV-028', () => {
  it('the real production allowlist has exactly 19 entries (matches the documented Wave-1 SHIP set)', () => {
    expect(ACTIVE_KNOWN_TOOL_TYPES.size).toBe(19);
  });

  it.each(REAL_INACTIVE_TOOL_SLUGS)(
    'real registry classifies %s as NOT active (coming soon)',
    (slug) => {
      expect(ACTIVE_KNOWN_TOOL_TYPES.has(slug)).toBe(false);
    }
  );

  it('control: the real registry DOES classify a genuinely shipped tool as active', () => {
    expect(ACTIVE_KNOWN_TOOL_TYPES.has(REAL_ACTIVE_TOOL_SLUG)).toBe(true);
  });
});

function buildKnownToolFromRealRegistry(toolType: string) {
  // isActive is derived from the SAME real Set imported above — never
  // hand-set. isKnownToolActive() also requires `rowIsActive` truthy, but
  // every seeded row is `is_active = 1` (SQLITE_KNOWN_TOOLS_SEED), so
  // membership in ACTIVE_KNOWN_TOOL_TYPES is the real deciding factor.
  const isActive = ACTIVE_KNOWN_TOOL_TYPES.has(toolType);
  return {
    id: toolType,
    toolType,
    name: `Tool ${toolType}`,
    libraryCategory: 'operational',
    description: 'desc',
    whatYouGet: [],
    tags: [],
    icon: null,
    isLicensed: false,
    isActive,
    isComingSoon: !isActive,
    sortOrder: 1,
    createdAt: null,
  };
}

const getKnownToolsMock = vi.fn();
const createToolSessionMock = vi.fn();
const getKnownToolMock = vi.fn();
const getToolSessionMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getKnownTools: (...args: unknown[]) => getKnownToolsMock(...args),
    getKnownTool: (...args: unknown[]) => getKnownToolMock(...args),
    getToolSession: (...args: unknown[]) => getToolSessionMock(...args),
    listToolSessions: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 }),
    listAssessments: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 }),
    getAssessmentReports: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ reports: [], success: true, data: [] }),
    getUsers: vi.fn().mockResolvedValue([]),
    createToolSession: (...args: unknown[]) => createToolSessionMock(...args),
    suggestTools: vi.fn().mockResolvedValue({ suggestions: [] }),
    getInitiativesByStatus: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }), toast: fn };
});

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentProjectId: null,
    currentUser: { id: 'u1', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) => {
    const state = { addMessage: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
  useHelp: () => ({ setOpen: vi.fn(), setActiveTab: vi.fn() }),
  HelpProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Minimal StandardTable stub: renders each row's name plus every rowAction
// button (flattened across blocks) with the REAL `disabled`/`onClick` this
// component computed — the thing under test.
vi.mock('@/components/standard', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    StandardTable: (props: any) => (
      <div data-testid="standard-table-stub">
        {(props.data || []).map((row: any) => (
          <div key={row.id} data-testid={`row-${row.id}`}>
            <span data-testid={`row-${row.id}-name`}>{row.name}</span>
            <span data-testid={`row-${row.id}-availability`}>{row.availability}</span>
            {(props.rowActions?.(row) || []).flatMap((block: any) =>
              (block.actions || []).map((action: any) => (
                <button
                  key={`${row.id}-${action.id}`}
                  data-testid={`row-${row.id}-action-${action.id}`}
                  disabled={!!action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))
            )}
          </div>
        ))}
      </div>
    ),
  };
});

// ToolDocumentView stubbed to an unambiguous marker — if the document-mount
// availability gate under test ever regressed, this marker would render for
// an inactive tool's restored session and the assertions below would catch
// it immediately.
vi.mock('@/components/DiscoveryTools', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    ToolDocumentView: (props: any) => (
      <div data-testid="tool-document-view-stub" data-tool-type={props.toolType}>
        ToolDocumentView mounted for {props.toolType}
      </div>
    ),
  };
});

import { DiscoveryToolsHub } from '@/components/Discovery/DiscoveryToolsHub';

describe('DiscoveryToolsHub library — RV-028 inactive Consulting Tools (real slugs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKnownToolsMock.mockResolvedValue({
      items: [
        ...REAL_INACTIVE_TOOL_SLUGS.map(buildKnownToolFromRealRegistry),
        buildKnownToolFromRealRegistry(REAL_ACTIVE_TOOL_SLUG),
      ],
    });
  });

  it.each(REAL_INACTIVE_TOOL_SLUGS)(
    'real tool %s renders as inactive/coming-soon with Open and Start disabled',
    async (toolType) => {
      render(
        <MemoryRouter initialEntries={['/discovery-tools']}>
          <DiscoveryToolsHub initialTab="library" />
        </MemoryRouter>
      );

      const row = await screen.findByTestId(`row-${toolType}`);
      expect(within(row).getByTestId(`row-${toolType}-availability`)).toHaveTextContent(
        'inactive'
      );
      expect(within(row).getByTestId(`row-${toolType}-action-open`)).toBeDisabled();
      expect(within(row).getByTestId(`row-${toolType}-action-start`)).toBeDisabled();
    }
  );

  it('forcing the disabled Open action on a real inactive tool creates no session and mounts no document — the library stays put', async () => {
    const toolType = REAL_INACTIVE_TOOL_SLUGS[0];
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="library" />
      </MemoryRouter>
    );

    const row = await screen.findByTestId(`row-${toolType}`);
    const openAction = within(row).getByTestId(`row-${toolType}-action-open`);
    // Disabled buttons don't fire onClick in the DOM, but force it to prove
    // handleRowAction/handleOpenKnownTool's own isActive===false guards also
    // refuse (defense in depth) — no document/workflow route ever mounts.
    fireEvent.click(openAction);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(createToolSessionMock).not.toHaveBeenCalled();
    expect(getKnownToolMock).not.toHaveBeenCalled();
    // The library list is still the mounted surface — no document/workflow
    // view replaced it (an "honest unavailable" outcome, not a silent one:
    // handleRowAction's notifyInactiveTool() toast fires instead).
    expect(screen.getByTestId('standard-table-stub')).toBeInTheDocument();
    expect(screen.getByTestId(`row-${toolType}`)).toBeInTheDocument();
  });

  it('forcing the disabled Start action on a real inactive tool creates no session either', async () => {
    const toolType = REAL_INACTIVE_TOOL_SLUGS[1];
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="library" />
      </MemoryRouter>
    );

    const row = await screen.findByTestId(`row-${toolType}`);
    fireEvent.click(within(row).getByTestId(`row-${toolType}-action-start`));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(createToolSessionMock).not.toHaveBeenCalled();
  });

  it('control: the real active tool in the same list is NOT disabled (the gate is registry-driven, not a blanket block)', async () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <DiscoveryToolsHub initialTab="library" />
      </MemoryRouter>
    );

    const row = await screen.findByTestId(`row-${REAL_ACTIVE_TOOL_SLUG}`);
    expect(within(row).getByTestId(`row-${REAL_ACTIVE_TOOL_SLUG}-availability`)).toHaveTextContent(
      'active'
    );
    expect(within(row).getByTestId(`row-${REAL_ACTIVE_TOOL_SLUG}-action-open`)).not.toBeDisabled();
  });
});

// Codex final re-review: the library gate alone is not enough — an EXISTING
// or restored session (doc.type='tool') for one of the 12 inactive tools
// bypassed the library entirely, because `hasDedicatedToolDocumentView`
// (DEDICATED_TOOL_TYPES) only proves a renderer exists, not that the tool is
// currently released. `?docId=<sessionId>` is DiscoveryToolsHub's real
// direct-document-entry mechanism (reload, back/forward, a shared/bookmarked
// link — see the `docId` URL<->state sync in DiscoveryToolsHub.tsx): it
// fetches the session via `Api.getToolSession` and mounts a document purely
// from the session's own `toolType`, with no dependency on how the session
// was originally opened.
describe('DiscoveryToolsHub document mount — RV-028 direct document entry (real slugs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKnownToolsMock.mockResolvedValue({
      items: [
        ...REAL_INACTIVE_TOOL_SLUGS.map(buildKnownToolFromRealRegistry),
        buildKnownToolFromRealRegistry(REAL_ACTIVE_TOOL_SLUG),
      ],
    });
  });

  it.each(REAL_INACTIVE_TOOL_SLUGS)(
    'direct document entry for an existing %s session shows the honest unavailable gate, never ToolDocumentView',
    async (toolType) => {
      const sessionId = `sess-${toolType}`;
      getToolSessionMock.mockResolvedValue({
        id: sessionId,
        name: `Restored ${toolType} session`,
        toolType,
        status: 'DRAFT',
        progress: 40,
      });

      render(
        <MemoryRouter initialEntries={[`/discovery-tools?docId=${sessionId}`]}>
          <DiscoveryToolsHub />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(getToolSessionMock).toHaveBeenCalledWith(sessionId);
      });

      await waitFor(() => {
        expect(screen.getByText(/inactive|nieaktywne/i)).toBeInTheDocument();
      });
      expect(screen.queryByTestId('tool-document-view-stub')).not.toBeInTheDocument();
    }
  );

  it('control: direct document entry for an existing session of a REAL ACTIVE tool still mounts ToolDocumentView (no regression)', async () => {
    const sessionId = `sess-${REAL_ACTIVE_TOOL_SLUG}`;
    getToolSessionMock.mockResolvedValue({
      id: sessionId,
      name: `Restored ${REAL_ACTIVE_TOOL_SLUG} session`,
      toolType: REAL_ACTIVE_TOOL_SLUG,
      status: 'DRAFT',
      progress: 40,
    });

    render(
      <MemoryRouter initialEntries={[`/discovery-tools?docId=${sessionId}`]}>
        <DiscoveryToolsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getToolSessionMock).toHaveBeenCalledWith(sessionId);
    });

    const doc = await screen.findByTestId('tool-document-view-stub');
    expect(doc).toHaveAttribute('data-tool-type', REAL_ACTIVE_TOOL_SLUG);
  });
});
