/**
 * @vitest-environment jsdom
 *
 * QB0c (DEC-664, werdykt właściciela z odbioru html 2026-09-18): „w podsumowaniu
 * czyli na pierwszej karcie powinny być teksty, a nie tylko te liczby — człowiek
 * powinien zrozumieć, o co chodzi".
 *
 * KROK 0 zmierzył przyczynę na kopii dumpu stagingu (`qoder-b-pg-qb0c`, 9 rekordów
 * completed): serwer składa `content` od nagłówka `## Executive Summary`
 * (InterviewInsightService.renderV6ContentAsMarkdown :2487), więc dotychczasowe
 * prowadzenie Callouta = PIERWSZY akapit `content` = sama ETYKIETA sekcji
 * („Executive Summary") obok trzech pasów liczb. 4 z 9 realnych rekordów mają
 * przy tym wypełnione pole `executive_summary` (306-450 znaków prozy) — ono jest
 * źródłem tożsamości i ono ma prowadzić kartę.
 *
 * Fixture'y poniżej = WIERSZE Z KOPII (ii_523fa9c4…, ii_ab0e8b7a…, 426b7af5…),
 * nie wymyślone dane: pole + skład `content` 1:1 jak w bazie.
 *
 * Mutacje (liczone osobno w meldunku):
 *   M1 logika  — memo wraca do „pierwszy akapit content" → T1/T2 RED (Callout
 *                  znów pokazuje etykietę zamiast prozy pola),
 *   M2 wpięcie — children Callouta w sekcji executive-summary → noop → wszystko RED.
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../public/locales/en/translation.json';

const resolveEnKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      enTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

const tEn = (key: string, opt?: unknown): string => {
  const resolved = resolveEnKey(key);
  if (resolved !== undefined) return resolved;
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
    return String((opt as { defaultValue: unknown }).defaultValue);
  }
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tEn,
    i18n: { language: 'en', getFixedT: () => tEn },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return {
    default: Object.assign(fn, { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
  };
});

const { getInsight, appStoreState } = vi.hoisted(() => ({
  getInsight: vi.fn(),
  appStoreState: {
    currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
    currentProjectId: 'proj-1',
    setChatSystemPrompt: vi.fn(),
    setChatContextActions: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    getInsight,
    getSession: vi.fn(async () => null),
    getSessionSummary: vi.fn(async () => ({
      facts: [],
      gaps: [],
      constraints: [],
      painPoints: [],
    })),
    getInsightActivity: vi.fn(async () => ({ activity: [] })),
    getInsightComments: vi.fn(async () => ({ comments: [] })),
    getSourcePack: vi.fn(async () => null),
    listFindings: vi.fn(async () => ({ findings: [] })),
    getAnalysis: vi.fn(async () => null),
    listCandidates: vi.fn(async () => []),
    getInsightReportPack: vi.fn(async () => null),
    getInsightReportReadiness: vi.fn(async () => ({})),
    regenerateInsight: vi.fn(async () => ({})),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: typeof appStoreState) => unknown) =>
    selector ? selector(appStoreState) : appStoreState,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
}));

vi.mock('@/services/api/conclusions.api', () => ({
  ConclusionsApi: {
    listByArtifact: vi.fn(async () => []),
  },
}));

vi.mock('@/services/pdf/pdfExport', () => ({
  exportReportToPDF: vi.fn(async () => undefined),
}));

// Rekord R1: ii_523fa9c4-e920-4553-87ad-5cb094fd9b75 (EN, pole wypełnione).
const POLE_EN =
  'Operational performance is hindered by inconsistent KPI measurement and inadequate ' +
  'maintenance planning, risking efficiency and reliability. Addressing short stops and ' +
  'protecting maintenance windows could enhance performance without capital investment. ' +
  'The potential impact includes a 20% improvement in operational reliability. Confidence ' +
  'is moderate due to reliance on single-source data.';

// Rekord R2: ii_313d64fb-c2fe-48b5-bfb6-f1173501baa1 (drugi rekord V6 z kopii,
// pole wypełnione; proza EN, bo bramka językowa w trybie --staged skanuje też
// testy i polski literał podbiłby K5pl — rekord PL ii_ab0e8b7a zostaje w meldunku).
const POLE_DRUGIE =
  'The analysis reveals a strong alignment on the need for digital transformation with a ' +
  'focus on automation and integration. Key challenges include technical skills gaps and ' +
  'manual operations hindering efficiency, presenting opportunities for targeted digital ' +
  'upskilling and advanced technology partnerships.';

// Rekord R3: 426b7af5-6a49-55dc-a466-07a4174eae3a (legacy: pole NULL, proza w content).
const PROZA_LEGACY =
  'Without asking each other directly, both Sarah Mitchell and Robert Chen named the same ' +
  'underlying gap: decisions and business cases currently rest on manually reconciled data ' +
  'rather than a trusted, real-time source. This is a strong shared entry point for a data ' +
  'foundation initiative that both functions would actively support.';

const skladV6 = (proza: string) =>
  `## Executive Summary\n\n${proza}\n\n## Themes\n\n### Shared gap _(strong)_\n\nOpis wzorca.\n`;

const renderViewer = async (insight: Record<string, unknown> | null) => {
  getInsight.mockResolvedValue({ insight });
  const { InsightViewer } = await import('@/components/Interview/InsightViewer');
  return render(
    <MemoryRouter>
      <InsightViewer
        insightId="insight-q"
        onClose={() => {}}
        onRegenerate={async () => {}}
        onSaved={() => {}}
      />
    </MemoryRouter>
  );
};

const calloutPodsumowania = async () => {
  const tytul = await screen.findByText(tEn('interview.insightViewer.readThisAsAConsulting'));
  // Callout = nagłówek + treść w jednym kontenerze; rodzic nagłówka niesie children.
  return tytul.closest('div')?.parentElement ?? tytul.parentElement;
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ organizations: [], data: [], items: [] }),
      text: async () => '',
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('InsightViewer · prowadzenie podsumowania = TEKST z rekordu (QB0c, DEC-664)', () => {
  it('T1 rekord V6 z polem (EN): Callout niesie prozę pola, nie etykietę sekcji', async () => {
    await renderViewer({
      id: 'ii_523fa9c4-e920-4553-87ad-5cb094fd9b75',
      organizationId: 'org-1',
      title: 'Operational summary',
      status: 'completed',
      executiveSummary: POLE_EN,
      content: skladV6(POLE_EN),
      themes: [],
      issues: [],
      opportunities: [],
      signals: [],
      evidenceMap: [],
    });

    const callout = await calloutPodsumowania();
    await waitFor(() => expect(callout?.textContent || '').toContain('Operational performance is hindered'));
    // Istota defektu: przed naprawą Callout niósł SAMĄ etykietę nagłówka.
    expect((callout?.textContent || '').trim()).not.toBe('Executive Summary');
  });

  it('T2 drugi rekord V6 z pola (ii_313d64fb): proza pola prowadzi kartę', async () => {
    await renderViewer({
      id: 'ii_313d64fb-c2fe-48b5-bfb6-f1173501baa1',
      organizationId: 'org-1',
      title: 'Digital transformation summary',
      status: 'completed',
      executiveSummary: POLE_DRUGIE,
      content: skladV6(POLE_DRUGIE),
      themes: [],
      issues: [],
      opportunities: [],
      signals: [],
      evidenceMap: [],
    });

    const callout = await calloutPodsumowania();
    await waitFor(() =>
      expect(callout?.textContent || '').toContain('The analysis reveals a strong alignment')
    );
  });

  it('T3 rekord legacy bez pola: pierwszy akapit content zostaje fallbackiem', async () => {
    await renderViewer({
      id: '426b7af5-6a49-55dc-a466-07a4174eae3a',
      organizationId: 'org-1',
      title: 'Discovery synthesis',
      status: 'completed',
      executiveSummary: null,
      content: `${PROZA_LEGACY}\n\n## Themes\n\n### Shared gap _(strong)_\n\nOpis.\n`,
      themes: [],
      issues: [],
      opportunities: [],
      signals: [],
      evidenceMap: [],
    });

    const callout = await calloutPodsumowania();
    await waitFor(() =>
      expect(callout?.textContent || '').toContain('Without asking each other directly')
    );
  });

  it('T4 rekord bez prozy: jawny stan pusty, nie pusty pasek', async () => {
    await renderViewer({
      id: 'insight-pusty',
      organizationId: 'org-1',
      title: 'Pusty',
      status: 'completed',
      executiveSummary: null,
      content: '',
      themes: [],
      issues: [],
      opportunities: [],
      signals: [],
      evidenceMap: [],
    });

    const callout = await calloutPodsumowania();
    await waitFor(() =>
      expect(callout?.textContent || '').toContain(tEn('interview.insightViewer.noSummaryAvailable'))
    );
  });
});
