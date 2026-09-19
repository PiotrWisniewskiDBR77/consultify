/**
 * QB0f (Wpis 234/242, DEC-691) — stub fetch dla ekranu `qoder-qb0f-pin-narrow`.
 *
 * Odtwarza REALNY defekt z stagingu (org 3935603f): biblioteka wzorców niesie
 * 20 KEEP TPL-1b (legacy report templates) z `scope:'system'` + `family:'DOC-BASE'`
 * ORAZ trzy kanoniczne bazy z migracji 20262271 (DOC/DECK/SHEET, `source:'canonical'`).
 *
 * PRZED zawężeniem predykatu PIN łapał wszystko z `scope:'system'` + rodziną bazową,
 * więc 21 kart DOC-BASE (20 KEEP + 1 kanoniczna) lądowało na górze biblioteki.
 * PO zawężeniu o `source !== 'legacy'` na górze zostaje wyłącznie kanoniczna baza.
 *
 * Wiersze KEEP są WCZYTANE z realnej fixture (kopia dumpu), nie zmyślone.
 *
 * KOLEJNOŚĆ IMPORTU: nadpisanie `window.fetch` musi żyć w osobnym module
 * importowanym PIERWSZY (loader flag strzela fetch-em już w fazie importu).
 */
import keepAndDocBaseRows from '../../evidence/qb0f-pin-narrow-20260919/pin-fixture-21-docbase.json';

import { stubApiFetch } from './apiFetchStub';

// Wspólny stub (orgs/flags/preferences/demo) PRZED nadpisaniem — daje czystą
// konsolę (rule: bledyKonsoli=0); nasz handler dokłada tylko /api/artifacts.
stubApiFetch();
const apiStubFetch = window.fetch.bind(window);

type Row = Record<string, unknown>;

// 21 realnych wierszy DOC-BASE: 20 KEEP (legacy) + 1 kanoniczna baza DOC.
const docRows = keepAndDocBaseRows as unknown as Row[];

const canonicalBase = (
  outputType: 'presentation' | 'sheet',
  family: string,
  title: string,
  runtime: string,
  sourceId: string,
  updatedAt: string
): Row => ({
  artifactId: `qb0f-base-${family}`,
  artifactFamily: 'template',
  outputType,
  titleSnapshot: title,
  createdAt: updatedAt,
  lastTransitionAt: updatedAt,
  originSummary: {
    template: {
      family,
      status: 'approved',
      language: 'en',
      system: true,
      readOnly: true,
      duplicateAllowed: true,
      sourceRuntime: runtime,
      sourceId,
      contractVersion: 'template-1-v1',
      metadata: { createdBy: 'System', updatedAt },
      structureBlueprint:
        outputType === 'presentation'
          ? { outline: [{ title: 'Summary' }, { title: 'Decision' }] }
          : { sections: [{ title: 'Summary' }] },
    },
  },
});

const orgRow = (
  outputType: 'report' | 'presentation' | 'sheet',
  title: string,
  updatedAt: string
): Row => ({
  artifactId: `qb0f-org-${title.replace(/\W+/g, '-').toLowerCase()}`,
  artifactFamily: 'template',
  outputType,
  titleSnapshot: title,
  createdAt: updatedAt,
  lastTransitionAt: updatedAt,
  originSummary: {
    template: {
      canonicalTemplateId: `canonical-qb0f-org-${title.length}`,
      originRuntime:
        outputType === 'report'
          ? 'report_template'
          : outputType === 'presentation'
            ? 'presentation_template'
            : 'sheet_template',
      source: 'canonical',
      scope: 'organization',
      status: 'approved',
      description: 'Organization template — newer than the system bases.',
      metadata: { createdBy: 'Transform team', updatedAt },
      structureBlueprint: { sections: [{ title: 'KPI' }] },
    },
  },
});

const templateRows: Row[] = [
  ...docRows,
  canonicalBase(
    'presentation',
    'DECK-BASE',
    'Board deck',
    'presentation_template',
    'dbr77-deck-board',
    '2026-01-05T08:00:00.000Z'
  ),
  canonicalBase(
    'sheet',
    'SHEET-BASE',
    'Supplier scorecard workbook',
    'sheet_template',
    '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1',
    '2026-02-01T08:00:00.000Z'
  ),
  // Org NOWSZE niż bazy — bez pina byłyby pierwsze; kanoniczna baza DOC jest
  // STARA, więc bez pina zeszłaby na dół (to PIN trzyma ją na górze).
  orgRow('report', 'Org weekly report', '2026-09-10T08:00:00.000Z'),
  orgRow('presentation', 'Org quarterly deck', '2026-09-12T08:00:00.000Z'),
];

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.includes('/api/artifacts')) {
    const query = new URL(url, window.location.origin).searchParams;
    const outputType = query.get('outputType');
    const data =
      query.get('artifactFamily') === 'template'
        ? outputType
          ? templateRows.filter((row) => row.outputType === outputType)
          : templateRows
        : [];
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return apiStubFetch(input, init);
};

export {};
