/**
 * Wpis 159 pkt 1 (DEC-655) — stub fetch dla ekranu `qoder-w159-template-pin`.
 *
 * UWAGA NA KOLEJNOŚĆ: niektóre moduły (loader flag `v8/admin/flags`) strzelają
 * fetch-em już w fazie IMPORTU (side effect), czyli PRZED wykonaniem ciała
 * modułu ekranu. Dlatego nadpisanie `window.fetch` musi żyć w OSOBNYM module
 * importowanym jako PIERWSZY — tylko wtedy zdąży przed side-effectami
 * AppProviders/FeatureFlags i zrzut ma czystą konsolę (rule: bledyKonsoli=0).
 */
type Row = Record<string, unknown>;

const originalFetch = window.fetch.bind(window);

const baseRow = (
  index: number,
  outputType: 'report' | 'presentation' | 'sheet',
  family: string,
  title: string,
  updatedAt: string
): Row => ({
  artifactId: `w159-base-index-${index}`,
  artifactFamily: 'template',
  outputType,
  originRuntime:
    outputType === 'report'
      ? 'report_template'
      : outputType === 'presentation'
        ? 'presentation_template'
        : 'sheet_template',
  originRecordId: `w159-base-${index}`,
  resolvedTitle: title,
  createdAt: updatedAt,
  lastTransitionAt: updatedAt,
  originSummary: {
    template: {
      canonicalTemplateId: `canonical-w159-base-${index}`,
      family,
      system: true,
      readOnly: true,
      duplicateAllowed: true,
      originRuntime:
        outputType === 'report'
          ? 'report_template'
          : outputType === 'presentation'
            ? 'presentation_template'
            : 'sheet_template',
      source: 'canonical',
      description: 'System base template — read-only, duplicate to edit a copy.',
      status: 'approved',
      language: 'en',
      metadata: { createdBy: 'System', updatedAt },
      structureBlueprint:
        outputType === 'presentation'
          ? { outline: [{ title: 'Summary' }, { title: 'Decision' }] }
          : { sections: [{ title: 'Summary' }, { title: 'Recommendations' }] },
    },
  },
});

const orgRow = (
  index: number,
  outputType: 'report' | 'presentation' | 'sheet',
  title: string,
  updatedAt: string
): Row => ({
  artifactId: `w159-org-index-${index}`,
  artifactFamily: 'template',
  outputType,
  originRuntime:
    outputType === 'report'
      ? 'report_template'
      : outputType === 'presentation'
        ? 'presentation_template'
        : 'sheet_template',
  originRecordId: `w159-org-${index}`,
  resolvedTitle: title,
  createdAt: updatedAt,
  lastTransitionAt: updatedAt,
  originSummary: {
    template: {
      canonicalTemplateId: `canonical-w159-org-${index}`,
      originRuntime:
        outputType === 'report'
          ? 'report_template'
          : outputType === 'presentation'
            ? 'presentation_template'
            : 'sheet_template',
      source: 'canonical',
      description: 'Organization template — newer than the system bases.',
      scope: 'organization',
      status: 'approved',
      metadata: { createdBy: 'Transform team', updatedAt },
      structureBlueprint:
        outputType === 'presentation'
          ? { outline: [{ title: 'Quarter' }] }
          : { sections: [{ title: 'KPI' }] },
    },
  },
});

// Bazy STARSZE (bez pina zeszłyby na dół), org NOWSZE (bez pina byłyby pierwsze).
const templateRows: Row[] = [
  baseRow(1, 'report', 'DOC-BASE', 'Base client final report', '2026-03-01T08:00:00.000Z'),
  baseRow(2, 'presentation', 'DECK-BASE', 'Base board deck', '2026-01-05T08:00:00.000Z'),
  baseRow(3, 'sheet', 'SHEET-BASE', 'Base supplier scorecard', '2026-02-01T08:00:00.000Z'),
  orgRow(1, 'report', 'Org weekly report', '2026-09-10T08:00:00.000Z'),
  orgRow(2, 'presentation', 'Org quarterly deck', '2026-09-12T08:00:00.000Z'),
];

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.includes('/api/artifacts')) {
    const query = new URL(url, window.location.origin).searchParams;
    const data =
      query.get('artifactFamily') === 'template'
        ? templateRows.filter((row) => row.outputType === query.get('outputType'))
        : [];
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Każdy inny /api/* w dev-render i tak trafiłby w 404 (brak backendu) i
  // zaśmiecił konsolę zrzutu. OrgContext i konsumenci flag tolerują `{}`.
  if (url.startsWith('/api/')) {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

export {};
