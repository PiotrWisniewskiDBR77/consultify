/**
 * @vitest-environment jsdom
 *
 * DOC-0 / U-44 — higiena listy Materiały → Dokumenty (S, front-only).
 *
 * Dwa zmierzone defekty z U-44 („TERAZ CZAS NA DOKUMENTY"):
 *  (1) nagłówek kolumny tytułu na liście DOKUMENTÓW brzmiał „PRESENTATION",
 *      bo współdzielony klucz `rap.columns.title` miał w EN wartość
 *      „Presentation" (PL był poprawny: „Tytuł"). Klucz jest czytany jako
 *      etykieta kolumny w trzech listach (OutputsAggregateTabContent:439,
 *      PresentationsTabContent:138, ReportsTabContent:103) ORAZ — osobno —
 *      jako zamienny tytuł pustej prezentacji (PresentationsTabContent:514),
 *      więc tamten dostał WŁASNY klucz `rap.preview.untitledPresentation`.
 *  (2) kolumna SOURCE pokazywała „—" dla KAŻDEGO dokumentu: gałąź dokumentowa
 *      `mapRegistryItemToUnified` (useRapData.ts) nie przenosiła `sourceType`,
 *      który `mapArtifactReport` już wyliczał (`= raw.originRuntime`) — gałąź
 *      prezentacji przenosiła go od zawsze. Po przeniesieniu surowe kody
 *      silnika (`report` / `native_artifact` / `assessment_report`) są
 *      tłumaczone na nazwy produktowe przez `SOURCE_RUNTIME_LABEL_KEYS`
 *      (ten sam wzór co `VISIBILITY_LABEL_KEYS` / `REVIEW_STATE_LABEL_KEYS`),
 *      więc w kolumnie nie ląduje ani „—", ani wyciek techniczny „Native
 *      Artifact".
 *
 * Test renderuje REALNY `OutputsAggregateTabContent` (ten sam komponent, który
 * rysuje zakładkę Dokumenty — ReportsAndPresentationsHub.tsx:1445 filtruje
 * `kind === 'document'`) i czyta z niego definicje kolumn. `t()` NIE jest
 * atrapa „zwracam fallback" — rozwiązuje klucz względem PRAWDZIWYCH plików
 * `public/locales/{en,pl}/translation.json`, więc test mierzy wartość, którą
 * zobaczy użytkownik, a nie domyślny string z kodu (defekt (1) siedzi w JSON-ie,
 * fallback w kodzie już wtedy brzmiał „Title").
 *
 * MUTACJE (zmierzone, `evidence/qoder-doc0-u44-list-hygiene-20260918/mutacje.log`):
 *  M1 `rap.columns.title` EN z powrotem „Presentation" → RED (etykieta kolumny),
 *  M2 usunięty lookup `SOURCE_RUNTIME_LABEL_KEYS` w `formatSourceSummary` → RED
 *     (komórka SOURCE wraca do „Native Artifact"),
 *  M3 usunięte `sourceType: r.sourceType` w gałęzi dokumentowej `useRapData.ts`
 *     → RED (mapper nie niesie źródła → kolumna znowu „—"),
 *  M4 usunięty PL klucz `rap.outputs.source.runtime.native_artifact` → RED
 *     (parytet EN/PL),
 *  M5 `PresentationsTabContent.tsx:514` z powrotem na `rap.columns.title` → RED
 *     (zamienny tytuł prezentacji brzmiałby „Title").
 */
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KORZEN = path.resolve(__dirname, '../../../..');
const EN = JSON.parse(
  fs.readFileSync(path.join(KORZEN, 'public/locales/en/translation.json'), 'utf8')
);
const PL = JSON.parse(
  fs.readFileSync(path.join(KORZEN, 'public/locales/pl/translation.json'), 'utf8')
);

function resolvePath(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, seg) => {
    if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[seg];
    }
    return undefined;
  }, obj);
}

/** `t()` na REALNYM zasobie — dokładnie odwzorowuje kontrakt i18next (default
 *  jako drugi argument LUB `options.defaultValue`, interpolacja `{{x}}`). */
function makeT(resource: unknown, language: string) {
  return {
    t: (key: string, arg2?: any, arg3?: any) => {
      const opts = typeof arg2 === 'string' ? { ...(arg3 ?? {}), defaultValue: arg2 } : arg2;
      const resolved = resolvePath(resource, key);
      if (opts?.returnObjects) return resolved ?? {};
      const tekst = typeof resolved === 'string' ? resolved : (opts?.defaultValue ?? key);
      if (!opts || typeof tekst !== 'string') return tekst;
      return Object.keys(opts).reduce(
        (acc, k) =>
          k === 'defaultValue' || k === 'returnObjects'
            ? acc
            : acc.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(opts[k])),
        tekst
      );
    },
    i18n: { language },
  };
}

const jezyk = vi.hoisted(() => ({ current: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () =>
    makeT(jezyk.current === 'pl' ? PL : EN, jezyk.current),
}));

const navigateSpy = vi.hoisted(() => vi.fn());
const tableProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useLocation: () => ({ search: '', pathname: '/presentations' }),
}));

vi.mock('react-hot-toast', () => ({
  default: { loading: vi.fn(() => 'toast-1'), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('@/components/shared/states', () => ({ LoadingState: () => null }));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
}));

vi.mock('@/components/ui/primitives', () => ({
  Button: ({ children }: any) => <button>{children}</button>,
  ErrorState: () => null,
}));

vi.mock('@/components/ui/primitives/chips', () => ({
  EntityStatusChip: () => null,
  statusChipTone: () => 'neutral',
}));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('@/utils/sheetArtifactOpen', () => ({
  downloadSheetArtifactXlsx: vi.fn(),
  resolveTablePlatformWorkspaceIdForTable: vi.fn(async () => null),
}));

vi.mock('../../../services/api', () => ({ API_URL: 'http://test', getHeaders: () => ({}) }));

vi.mock('../../shared/ModuleHub', () => ({ GridView: () => null }));

vi.mock('../../standard', () => ({
  StandardTable: (props: any) => {
    tableProps.current = props;
    return <div data-testid="std-table" />;
  },
  StandardPreview: () => <div data-testid="std-preview" />,
  standardPreviewShortcuts: () => ({}),
}));

vi.mock('../../documents/DocumentViewer', () => ({ DocumentViewer: () => null }));
vi.mock('../duplicateArtifactToDraft', () => ({ duplicateArtifactToCanvasDraft: vi.fn() }));
vi.mock('../SaveAsTemplateModal', () => ({ SaveAsTemplateModal: () => null }));
vi.mock('../TrustStatePreviewSection', () => ({ TrustStatePreviewSection: () => null }));
vi.mock('../useTrustState', () => ({ useTrustState: () => null }));

import { OutputsAggregateTabContent } from '../OutputsAggregateTabContent';
import type { UnifiedOutputRow } from '../types';
import { mapRegistryItemToUnified } from '../useRapData';

function dokument(overrides: Partial<UnifiedOutputRow> = {}): UnifiedOutputRow {
  return {
    kind: 'document',
    originRecordId: 'u44-doc-1',
    artifactId: 'u44-art-1',
    title: 'Digital Roadmap 2026',
    statusKey: 'ready',
    owner: 'Piotr W',
    updatedAt: '2026-09-15T10:00:00.000Z',
    exportFormats: [],
    fileFormat: 'DOCX',
    ...overrides,
  } as UnifiedOutputRow;
}

function renderTab(rows: UnifiedOutputRow[]) {
  render(
    <OutputsAggregateTabContent
      viewMode="table"
      searchQuery=""
      activeFilters={[]}
      onFilterChange={vi.fn()}
      rows={rows}
      loading={false}
      onRefresh={vi.fn()}
      actions={{} as any}
    />
  );
  return tableProps.current;
}

function column(props: any, id: string) {
  const col = (props.columns as any[]).find((c) => c.id === id);
  expect(col, `kolumna "${id}" istnieje`).toBeTruthy();
  return col;
}

function cellText(col: any, row: UnifiedOutputRow): string {
  const { container } = render(<>{col.render({ ...row, id: row.originRecordId })}</>);
  return (container.textContent || '').trim();
}

beforeEach(() => {
  vi.clearAllMocks();
  tableProps.current = null;
  jezyk.current = 'en';
});

afterEach(() => {
  jezyk.current = 'en';
});

describe('U-44 (1) — nagłówek kolumny tytułu na liście Dokumenty', () => {
  it('EN: kolumna tytułu nazywa się „Title", nie „Presentation"', () => {
    const props = renderTab([dokument()]);
    expect(column(props, 'title').label).toBe('Title');
  });

  it('PL: kolumna tytułu nazywa się „Tytuł" (parytet, bez regresji)', () => {
    jezyk.current = 'pl';
    const props = renderTab([dokument()]);
    expect(column(props, 'title').label).toBe('Tytuł');
  });

  it('klucz `rap.columns.title` ma w EN „Title", a zamienny tytuł prezentacji ma WŁASNY klucz w obu językach', () => {
    expect(resolvePath(EN, 'rap.columns.title')).toBe('Title');
    expect(resolvePath(PL, 'rap.columns.title')).toBe('Tytuł');
    expect(resolvePath(EN, 'rap.preview.untitledPresentation')).toBe('Presentation');
    expect(resolvePath(PL, 'rap.preview.untitledPresentation')).toBe('Prezentacja');
    // M5: PresentationsTabContent nie może już pożyczać klucza kolumny jako
    // zamiennego tytułu prezentacji (po naprawie (1) brzmiałby „Title").
    const prez = fs.readFileSync(
      path.join(KORZEN, 'src/components/ReportsAndPresentations/PresentationsTabContent.tsx'),
      'utf8'
    );
    expect(prez).toContain("t('rap.preview.untitledPresentation', 'Presentation')");
    expect(prez).not.toContain("previewItem.title || t('rap.columns.title'");
  });
});

describe('U-44 (2) — kolumna SOURCE dla dokumentu', () => {
  const PRZYPADKI: Array<[string, string, string]> = [
    ['report', 'Report Builder', 'Kreator raportów'],
    ['native_artifact', 'Document Studio', 'Studio Dokumentów'],
    ['assessment_report', 'Assessment', 'Ocena'],
  ];

  it.each(PRZYPADKI)(
    'runtime „%s" renderuje nazwę produktową (EN „%s") zamiast kodu silnika',
    (runtime, enLabel) => {
      const props = renderTab([dokument({ sourceType: runtime })]);
      expect(cellText(column(props, 'source'), dokument({ sourceType: runtime }))).toBe(enLabel);
    }
  );

  it('te same trzy runtime’y mają polskie etykiety (parytet EN/PL)', () => {
    jezyk.current = 'pl';
    for (const [runtime, , plLabel] of PRZYPADKI) {
      const props = renderTab([dokument({ sourceType: runtime })]);
      expect(cellText(column(props, 'source'), dokument({ sourceType: runtime }))).toBe(plLabel);
    }
  });

  it('dokument bez runtime’u nadal pokazuje „—", a źródło prezentacji się nie zmieniło', () => {
    const props = renderTab([dokument(), dokument({ sourceType: 'tool', kind: 'presentation' })]);
    const source = column(props, 'source');
    expect(cellText(source, dokument())).toBe('—');
    // Wartość spoza mapy dokumentowej spada na formatLabel — jak przed naprawą.
    expect(cellText(source, dokument({ sourceType: 'tool', kind: 'presentation' }))).toBe('Tool');
  });

  it('dokument z powiązaną inicjatywą łączy źródło i inicjatywę (bez regresji)', () => {
    const props = renderTab([dokument({ sourceType: 'native_artifact' })]);
    expect(
      cellText(
        column(props, 'source'),
        dokument({ sourceType: 'native_artifact', sourceInitiativeId: 'ini-1' })
      )
    ).toBe('Document Studio · Initiative linked');
  });
});

describe('U-44 (2) — warstwa danych: mapper niesie źródło dokumentu', () => {
  const REJESTR = {
    artifactId: 'u44-art-1',
    originRecordId: 'u44-doc-1',
    resolvedTitle: 'Digital Roadmap 2026',
    deliveryState: 'ready',
    visibilityScope: 'organization',
    createdAt: '2026-09-15T10:00:00.000Z',
  };

  it.each(['report', 'native_artifact', 'assessment_report'])(
    'originRuntime „%s" trafia do `sourceType` wiersza dokumentu',
    (runtime) => {
      const row = mapRegistryItemToUnified({ ...REJESTR, originRuntime: runtime });
      expect(row).not.toBeNull();
      expect(row!.kind).toBe('document');
      expect(row!.sourceType).toBe(runtime);
    }
  );

  it('parytet kluczy `rap.outputs.source.runtime.*` EN = PL (te same trzy runtime’y, niepuste)', () => {
    const en = resolvePath(EN, 'rap.outputs.source.runtime') as Record<string, string>;
    const pl = resolvePath(PL, 'rap.outputs.source.runtime') as Record<string, string>;
    expect(Object.keys(en).sort()).toEqual(['assessment_report', 'native_artifact', 'report']);
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      expect(String(en[key]).trim().length).toBeGreaterThan(0);
      expect(String(pl[key]).trim().length).toBeGreaterThan(0);
    }
  });
});
