/**
 * @vitest-environment jsdom
 *
 * Integration slice: real ReportsAndPresentationsHub + real useRapData +
 * real OutputsAggregateTabContent, with fetch mocked to canonical registry JSON.
 * Stronger than hub tests that stub useRapData to empty rows.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsAndPresentationsHub } from '../../../src/components/ReportsAndPresentations/ReportsAndPresentationsHub';

vi.mock('../../../src/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer test' }),
  shouldAllowDemoData: () => false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || key,
    i18n: { language: 'en' },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
}));

vi.mock('../../../src/components/standard/StandardModuleBar', () => ({
    StandardModuleBar: ({ tabs, activeTab, commandRowContent, children }: any) => (
      <div data-testid="module-hub-stub">
        <div data-testid="active-tab">{activeTab}</div>
        <div>
          {tabs.map((tab: any) => (
            <span key={tab.id}>{tab.label}</span>
          ))}
        </div>
        <div data-testid="command-row">{commandRowContent}</div>
        <div>{children}</div>
      </div>
    ),
}));

vi.mock('../../../src/components/shared/ModuleHub/useModuleOpenDocuments', () => ({
  useModuleOpenDocuments: () => ({
    openDocuments: [],
    setOpenDocuments: vi.fn(),
    activeDocumentId: null,
    setActiveDocumentId: vi.fn(),
  }),
}));

vi.mock('../../../src/components/ReportsAndPresentations/ReportsTabContent', () => ({
  ReportsTabContent: () => <div>reports-tab</div>,
}));

vi.mock('../../../src/components/ReportsAndPresentations/PresentationsTabContent', () => ({
  PresentationsTabContent: () => <div>presentations-tab</div>,
}));

vi.mock('../../../src/components/ReportsAndPresentations/SheetsTabContent', () => ({
  SheetsTabContent: () => <div>sheets-tab</div>,
}));

vi.mock('../../../src/components/ReportsAndPresentations/TemplatesTabContent', () => ({
  TemplatesTabContent: () => <div>templates-tab</div>,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const originalFetch = globalThis.fetch;

function okJson(data: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
  }) as Promise<Response>;
}

describe('ReportsAndPresentationsHub — canonical registry data path', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);

      if (url.includes('/api/artifacts?') && url.includes('view=mine')) {
        return okJson({
          data: [
            {
              originRuntime: 'presentation',
              originRecordId: 'hub-deck-1',
              artifactId: 'hub-art-1',
              resolvedTitle: 'Hub Integration Canonical Title',
              originStatus: 'ready',
              deck_type: 'initiative_portfolio',
              ownerUserId: 'hub-owner',
              sourceInitiativeId: 'init-77',
              visibilityScope: 'review_shared',
              publishState: 'in_review',
              reviewGateCount: 2,
              exportFormat: 'pdf',
              slideCount: 9,
              lastTransitionAt: '2026-03-24T10:00:00.000Z',
            },
          ],
        });
      }
      if (url.includes('/api/artifacts?') && url.includes('outputType=report')) {
        return okJson({ data: [] });
      }
      if (url.includes('/api/artifacts?') && url.includes('outputType=presentation')) {
        return okJson({ data: [] });
      }
      if (url.includes('/api/report-builder/templates')) {
        return okJson({ templates: [] });
      }
      if (url.includes('/api/presentations/templates')) {
        return okJson({ data: [] });
      }

      return okJson({ data: [] });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('Mine tab renders titles from GET /api/artifacts?view=mine (real hooks + aggregate table)', async () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=mine']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('outputs_mine');

    await waitFor(() => {
      expect(screen.getByText('Hub Integration Canonical Title')).toBeInTheDocument();
    });
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();

    const urls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
      String(c[0])
    );
    expect(urls.some((u) => u.includes('view=mine') && u.includes('/api/artifacts?'))).toBe(true);
  });
});
