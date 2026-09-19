/**
 * @vitest-environment jsdom
 *
 * Wpis 159 pkt 1 (DEC-655) — PIN trzech baz systemowych na górze biblioteki
 * wzorców. Test spina REALNY hook `useTemplates` (fetch → mapper → pin) z
 * REALNYM `ReportsAndPresentationsHub` → `TemplatesTabContent`: kolejność
 * wierszy/kart widoczna w DOM musi zaczynać się od trzech baz (DOC-BASE,
 * SHEET-BASE, DECK-BASE po updatedAt DESC), dopiero potem nowsze wzorce org.
 *
 * Fixture'y naśladują kształt indeksu artefaktów po migracji
 * 20262271_template_base_family: baza niesie `originSummary.template.family`
 * + `system: true` BEZ pola `scope`, wzorce org niosą `scope: 'org'` i ŚWIEŻSZE
 * daty — bez pina to one sortowałyby się pierwsze.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../public/locales/en/translation.json';
import { isPinnedBaseTemplate } from '@/components/ReportsAndPresentations/useRapData';

const resolveEnKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as any)[part] : undefined), enTranslation);
  return typeof value === 'string' ? value : undefined;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const raw = resolveEnKey(key);
      if (typeof raw !== 'string') return typeof options === 'string' ? options : key;
      if (!options || typeof options !== 'object') return raw;
      return Object.keys(options).reduce(
        (acc, k) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(options[k])),
        raw
      );
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: any) => children || null,
  I18nextProvider: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: (state: any) => unknown) => {
    const state = { setWorkspaceContext: vi.fn(), updateWorkspaceFromView: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

// Ciężkie sąsiedztwo huba nie jest przedmiotem testu — liczy się kolejność
// biblioteki wzorców.
vi.mock('@/components/TemplateBuilder', () => ({
  TemplateBuilderFlow: () => null,
  GovernedTemplateBuilderFlow: () => null,
}));
vi.mock('@/components/AIChat/KimiWorkspace/ExceleParametricTemplates', () => ({
  ExceleParametricTemplates: () => null,
}));
vi.mock('@/components/Presentations/PresentationTemplateArchitectView', () => ({
  PresentationTemplateArchitectView: () => null,
}));
vi.mock('@/components/shared/CreateFormatModeLauncher', () => ({
  CreateFormatModeLauncher: () => null,
}));
vi.mock('../src/components/ReportsAndPresentations/BundleHistoryPanel', () => ({
  BundleHistoryPanel: () => null,
}));
vi.mock('@/components/ReportsAndPresentations/BundleHistoryPanel', () => ({
  BundleHistoryPanel: () => null,
}));
vi.mock('@/components/ReportsAndPresentations/TemplateProvenanceApprovalDialog', () => ({
  TemplateProvenanceApprovalDialog: () => null,
}));

const baseRow = (family: string, artifactId: string, title: string, updatedAt: string) => ({
  artifactId,
  outputType: family === 'DECK-BASE' ? 'presentation' : family === 'SHEET-BASE' ? 'sheet' : 'report',
  titleSnapshot: title,
  lastTransitionAt: updatedAt,
  createdAt: updatedAt,
  originSummary: {
    template: {
      family,
      system: true,
      readOnly: true,
      status: 'approved',
      language: 'en',
      metadata: { updatedAt },
    },
  },
});

const orgRow = (artifactId: string, title: string, updatedAt: string, outputType: string) => ({
  artifactId,
  outputType,
  titleSnapshot: title,
  lastTransitionAt: updatedAt,
  createdAt: updatedAt,
  originSummary: {
    template: {
      scope: 'org',
      status: 'approved',
      metadata: { updatedAt },
    },
  },
});

const TEMPLATE_ROWS: Record<string, unknown[]> = {
  report: [
    baseRow('DOC-BASE', 'art-doc-base', 'Base client final report', '2026-03-01T10:00:00.000Z'),
    orgRow('art-org-weekly', 'Org weekly report', '2026-09-10T10:00:00.000Z', 'report'),
  ],
  presentation: [
    baseRow('DECK-BASE', 'art-deck-base', 'Base board deck', '2026-01-05T10:00:00.000Z'),
    orgRow('art-org-quarter', 'Org quarterly deck', '2026-08-01T10:00:00.000Z', 'presentation'),
  ],
  sheet: [baseRow('SHEET-BASE', 'art-sheet-base', 'Base supplier scorecard', '2026-02-01T10:00:00.000Z')],
};

const json = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ data }),
});

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: any) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    if (url.includes('artifactFamily=template')) {
      const outputType = url.includes('outputType=report')
        ? 'report'
        : url.includes('outputType=presentation')
          ? 'presentation'
          : 'sheet';
      return json(TEMPLATE_ROWS[outputType]);
    }
    if (url.includes('/artifacts')) return json([]);
    if (url.includes('/flags') || url.includes('/admin')) return json({});
    return json([]);
  }) as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const EXPECTED_ORDER = [
  'Base client final report',
  'Base supplier scorecard',
  'Base board deck',
  'Org weekly report',
  'Org quarterly deck',
];

const renderHub = async () => {
  const { ReportsAndPresentationsHub } = await import(
    '@/components/ReportsAndPresentations/ReportsAndPresentationsHub'
  );
  render(
    <MemoryRouter initialEntries={['/materials?tab=templates']}>
      <ReportsAndPresentationsHub />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText('Org weekly report')).toBeTruthy());
};

const domOrder = (): string[] => {
  const nodes = EXPECTED_ORDER.map((title) => screen.getByText(title));
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) =>
      a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )
    .map(({ index }) => EXPECTED_ORDER[index]);
};

describe('Wpis 159 pkt 1 — pin trzech baz systemowych na górze biblioteki wzorców', () => {
  it('T1 (wpięcie): realny hub pokazuje bazy pierwsze, mimo nowszych dat wzorców org', async () => {
    await renderHub();
    expect(domOrder()).toEqual(EXPECTED_ORDER);
  });

  it('T2 (logika): predykat pina wymaga OBU połów — scope system I rodziny bazy', () => {
    const base = { scope: 'system', templateFamily: 'DOC-BASE' } as any;
    const familyOnly = { scope: 'organization', templateFamily: 'DOC-BASE' } as any;
    const scopeOnly = { scope: 'system', templateFamily: 'custom-deck' } as any;
    expect(isPinnedBaseTemplate(base)).toBe(true);
    expect(isPinnedBaseTemplate(familyOnly)).toBe(false);
    expect(isPinnedBaseTemplate(scopeOnly)).toBe(false);
  });
});
