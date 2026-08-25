/**
 * @vitest-environment jsdom
 *
 * KnownToolDetailView — M3/M4/M5 header action labels, POLISH copy (FALA 1,
 * 2026-08-25). Split into its own file from
 * `KnownToolDetailView.headerLabels.fala1.test.tsx` because `vi.mock` calls
 * are hoisted to the top of a file — a second `vi.mock('react-i18next', ...)`
 * later in the same file would not give two independently-scoped languages,
 * it would just replace the first registration for the whole file. This file
 * overrides the global `tests/setup.ts` react-i18next mock (hardcoded to
 * `language: 'en'`) with `language: 'pl'` so the `isPolish` branch of the
 * header labels is exercised for real, not just asserted by reading source.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockT = (key: string, options?: any) => {
  if (options?.returnObjects) return [];
  if (typeof options === 'string') return options;
  if (options && typeof options === 'object') return options.defaultValue ?? key;
  return key;
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { language: 'pl', changeLanguage: vi.fn(), getFixedT: () => mockT },
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

describe('KnownToolDetailView — header action labels, PL (M3/M4/M5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKnownToolMock.mockResolvedValue({ tool: buildKnownTool() });
    listToolSessionsMock.mockResolvedValue({ items: [], total: 0, limit: 0, offset: 0 });
  });

  it('renders the short PL labels: "Baza wiedzy", "Analizuj", "Rozpocznij sesję"', async () => {
    render(
      <KnownToolDetailView toolType="dynamic-swot" onClose={vi.fn()} onSessionCreated={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tool-single-header-actions')).toBeInTheDocument();
    });
    const actions = screen.getByTestId('tool-single-header-actions');

    // M3: no more "How to / " prefix.
    expect(actions).toHaveTextContent('Baza wiedzy');
    expect(actions).not.toHaveTextContent('How to / Baza wiedzy');

    // M4: no more "z AI" suffix (Sparkles icon kept).
    expect(screen.getByRole('button', { name: 'Analizuj' })).toBeInTheDocument();
    expect(screen.queryByText('Analizuj z AI')).not.toBeInTheDocument();

    // M5: "Start" alone did not say what it starts.
    expect(screen.getByRole('button', { name: 'Rozpocznij sesję' })).toBeInTheDocument();
  });
});
