/**
 * @vitest-environment jsdom
 *
 * KnownToolDetailView — M3/M4/M5 header action labels (FALA 1, 2026-08-25).
 *
 * Owner review (tools-uwagi-komplet.md, TLS-NOTE-HDR-001/002/004): the Tool
 * Detail header actions carried a redundant "How to / " prefix on the
 * knowledge-base button and a redundant "with AI" suffix on the analyze
 * button, and the Start button's label ("Start") did not say what it starts.
 * A prior reconciliation doc claimed these were "already" short — they were
 * not; this test locks the actual fix in place.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The global `tests/setup.ts` react-i18next mock returns a memory-bounded
// Proxy for `t(key, { returnObjects: true })` that is not actually iterable
// (no real array), which breaks the unrelated "session quality items"
// `.map()` this component also renders for toolType='dynamic-swot'. Override
// locally with a real (empty) array for that case — everything else keeps
// the same key/defaultValue passthrough behavior as the global mock.
const mockT = (key: string, options?: any) => {
  if (options?.returnObjects) return [];
  if (typeof options === 'string') return options;
  if (options && typeof options === 'object') return options.defaultValue ?? key;
  return key;
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { language: 'en', changeLanguage: vi.fn(), getFixedT: () => mockT },
    ready: true,
  }),
  Trans: ({ children, i18nKey }: any) => children || i18nKey,
  I18nextProvider: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const getKnownToolMock = vi.fn();
const listToolSessionsMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getKnownTool: (...args: unknown[]) => getKnownToolMock(...args),
    listToolSessions: (...args: unknown[]) => listToolSessionsMock(...args),
    createToolSession: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }), toast: fn };
});

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentProjectId: null }),
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import { KnownToolDetailView } from '@/components/DiscoveryTools/KnownToolDetailView';

function buildKnownTool(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'dynamic-swot',
    toolType: 'dynamic-swot',
    name: 'Dynamic SWOT',
    libraryCategory: 'strategic',
    description: 'desc',
    whatYouGet: [],
    tags: [],
    icon: null,
    isLicensed: false,
    isActive: true,
    isComingSoon: false,
    sortOrder: 1,
    createdAt: null,
    whenToUse: 'when',
    inputs: [],
    steps: [],
    outputs: [],
    commonMistakes: [],
    example: 'example',
    nextSteps: [],
    kbArticleSlug: 'dynamic-swot',
    ...overrides,
  };
}

describe('KnownToolDetailView — header action labels (M3/M4/M5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKnownToolMock.mockResolvedValue({ tool: buildKnownTool() });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
  });

  it('renders the short EN labels: "Knowledge base", "Analyze", "Start session"', async () => {
    render(
      <KnownToolDetailView toolType="dynamic-swot" onClose={vi.fn()} onSessionCreated={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tool-single-header-actions')).toBeInTheDocument();
    });
    const actions = screen.getByTestId('tool-single-header-actions');

    // M3: no more "How to / " prefix on the knowledge-base button.
    expect(actions).toHaveTextContent('Knowledge base');
    expect(actions).not.toHaveTextContent('How to / Knowledge base');

    // M4: no more "with AI" suffix on the analyze button (Sparkles icon kept).
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument();
    expect(screen.queryByText('Analyze with AI')).not.toBeInTheDocument();

    // M5: "Start" alone did not say what it starts.
    expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Start$/ })).not.toBeInTheDocument();
  });
});

// PL copy is covered by the sibling file
// `KnownToolDetailView.headerLabels.pl.fala1.test.tsx` — split out because
// `vi.mock('react-i18next', ...)` is hoisted per-file, so it cannot be
// re-registered mid-file to give two describe blocks different languages.
