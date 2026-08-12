import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import jwt from 'jsonwebtoken';

import {
  API_BASE_URL,
  DOC_STUDIO_BASE,
  authHeaders,
  fetchArtifactSchema,
  seedDocumentArtifact,
  setupDocumentStudioSession,
} from '../documents/_document-studio-helpers';

const OUTPUT_DIR = path.resolve(
  process.env.ARTIFACT_REVIEW_OUTPUT_DIR || 'test-results/artifact-studio-strict'
);
const CASE_ID = 'BID-NORTH-2026Q3';
const TITLE = 'North Region CRM Investment Decision';

const sources = [
  {
    sourceType: 'decision_pack',
    sourceId: 'SRC-BID-MANDATE-2026Q3-v1',
    sourceTitle: 'Board decision mandate',
    sourceVersion: 'v1',
    sourceSnapshotId: 'snap-SRC-BID-MANDATE-2026Q3-v1',
    sourceExcerpt:
      'Decision: approve, defer, or reject Option B. Gate date 2026-09-15. Decision owner COO. Required evidence: validated CRM baseline, investment amount, and payback.',
  },
  {
    sourceType: 'kpi_roi',
    sourceId: 'SRC-CRM-BASELINE-2026Q2-v1',
    sourceTitle: 'CRM conversion baseline',
    sourceVersion: 'v1',
    sourceSnapshotId: 'snap-SRC-CRM-BASELINE-2026Q2-v1',
    sourceExcerpt:
      'Current conversion 2.4%; target 3.1%; sample window 2026-04-01 through 2026-06-30; owner Sales Ops. This source makes no causal uplift claim.',
  },
  {
    sourceType: 'financial_analysis',
    sourceId: 'SRC-FORECAST-2026Q3-v1',
    sourceTitle: 'Q3 financial forecast',
    sourceVersion: 'v1',
    sourceSnapshotId: 'snap-SRC-FORECAST-2026Q3-v1',
    sourceExcerpt:
      'Revenue target PLN 12.0m; base forecast PLN 10.8m. Investment amount UNKNOWN. Payback UNKNOWN. NPV UNKNOWN. Do not derive ROI until cost is supplied.',
  },
  {
    sourceType: 'raid',
    sourceId: 'SRC-RISK-REGISTER-2026Q3-v1',
    sourceTitle: 'Risk and decision register',
    sourceVersion: 'v1',
    sourceSnapshotId: 'snap-SRC-RISK-REGISTER-2026Q3-v1',
    sourceExcerpt:
      'Risks: data quality (Sales Ops), integration (CTO), adoption (COO). No-go when baseline is unvalidated, cost or payback is UNKNOWN, or approval is not current.',
  },
] as const;

const sectionSpecs = [
  [
    'Executive decision',
    'DEFER pending evidence. Do not approve Option B until investment amount and payback are validated. Decision owner: COO. Decision gate: 2026-09-15.',
  ],
  [
    'Decision context',
    'The board must approve, defer, or reject Option B. Current classification is INTERNAL. This document does not authorize public sharing.',
  ],
  [
    'Evidence baseline',
    'Current conversion is 2.4% and the target is 3.1%. The measurement window is 2026-04-01 through 2026-06-30. No causal uplift is claimed.',
  ],
  [
    'Financial evidence',
    'Revenue target is PLN 12.0m and base forecast is PLN 10.8m. The calculated gap is PLN 1.2m (12.0 minus 10.8). Investment amount: UNKNOWN. Payback: UNKNOWN. NPV: UNKNOWN.',
  ],
  [
    'Options and conditions',
    'Option A: defer and collect evidence. Option B: controlled investment, currently blocked. Option C: reject. Recommendation remains DEFER pending evidence.',
  ],
  [
    'Risks and no-go gates',
    'Data quality — owner Sales Ops. Integration — owner CTO. Adoption — owner COO. No-go if the baseline is unvalidated, cost or payback remains UNKNOWN, or approval is not current.',
  ],
  [
    'Evidence plan',
    'Sales Ops must validate the baseline. Investment amount and payback remain UNKNOWN; accountable evidence owner: UNKNOWN. Approval must be current before the COO records the decision.',
  ],
  [
    'Decision required',
    'On 2026-09-15 the COO records approve, defer, or reject. Until all gates are current, the only supported recommendation is DEFER pending evidence.',
  ],
] as const;

const sectionPurposes = [
  'State the supported board decision, accountable owner, gate date, and blockers.',
  'Define the decision scope, classification, and authorization boundary.',
  'Record the measured CRM baseline, target, period, and claim boundary.',
  'Reconcile the forecast gap and preserve missing investment metrics as UNKNOWN.',
  'Compare the available options and the conditions attached to each choice.',
  'Name material risks, owners, and conditions that stop the decision.',
  'Assign the evidence required before the decision gate.',
  'Record who decides, when they decide, and the supported position until then.',
] as const;

const sectionSources = [
  sources[0],
  sources[0],
  sources[1],
  sources[2],
  sources[0],
  sources[3],
  sources[3],
  sources[0],
] as const;

const pptSlideSpecs = [
  {
    type: 'executive_summary',
    title: 'Executive decision',
    sources: [sources[0], sources[2], sources[3]],
    content: {
      type: 'executive_summary',
      key_findings: ['Option B is not approval-ready.', 'COO records the decision on 2026-09-15.'],
      kpis: [
        { label: 'Recommendation', value: 'DEFER' },
        { label: 'Investment', value: 'UNKNOWN' },
        { label: 'Payback', value: 'UNKNOWN' },
      ],
      recommendation: 'DEFER pending evidence until every decision gate is current.',
    },
  },
  {
    type: 'key_messages',
    title: 'Decision context',
    sources: [sources[0]],
    content: {
      type: 'key_messages',
      messages: [
        { title: 'Decision required', description: 'Approve, defer, or reject Option B.' },
        { title: 'Classification', description: 'INTERNAL; public sharing is not authorized.' },
        { title: 'Case', description: CASE_ID },
      ],
    },
  },
  {
    type: 'performance_overview',
    title: 'Evidence baseline',
    sources: [sources[1]],
    content: {
      type: 'performance_overview',
      kpis: [
        { name: 'Current conversion', value: '2.4%' },
        { name: 'Target conversion', value: '3.1%' },
        { name: 'Measurement window', value: 'Q2 2026' },
      ],
      context: 'Observed baseline only. No causal uplift is claimed.',
    },
  },
  {
    type: 'performance_overview',
    title: 'Financial evidence',
    sources: [sources[2]],
    content: {
      type: 'performance_overview',
      kpis: [
        { name: 'Revenue target', value: 'PLN 12.0m' },
        { name: 'Base forecast', value: 'PLN 10.8m' },
        { name: 'Calculated gap', value: 'PLN 1.2m' },
      ],
      context: 'Investment amount, payback and NPV are UNKNOWN. Do not derive ROI.',
    },
  },
  {
    type: 'initiative_portfolio',
    title: 'Options and conditions',
    sources: [sources[0], sources[2]],
    content: {
      type: 'initiative_portfolio',
      initiatives: [
        {
          name: 'Option A — collect evidence',
          priority: 'Supported now',
          timeline: 'Before gate',
          owner: 'UNKNOWN',
        },
        {
          name: 'Option B — controlled investment',
          priority: 'Blocked',
          timeline: 'UNKNOWN',
          owner: 'COO',
        },
        {
          name: 'Option C — reject',
          priority: 'Alternative',
          timeline: '2026-09-15',
          owner: 'COO',
        },
      ],
    },
  },
  {
    type: 'risk_management',
    title: 'Risks and no-go gates',
    sources: [sources[3]],
    content: {
      type: 'risk_management',
      risks: [
        {
          risk: 'Data quality',
          likelihood: 'UNKNOWN',
          impact: 'Baseline invalid',
          mitigation: 'Sales Ops validates baseline',
        },
        {
          risk: 'Integration',
          likelihood: 'UNKNOWN',
          impact: 'Delivery blocked',
          mitigation: 'CTO confirms feasibility',
        },
        {
          risk: 'Adoption',
          likelihood: 'UNKNOWN',
          impact: 'Value not realized',
          mitigation: 'COO owns adoption gate',
        },
      ],
    },
  },
  {
    type: 'roadmap',
    title: 'Evidence plan',
    sources: [sources[1], sources[2], sources[3]],
    content: {
      type: 'roadmap',
      phases: [
        {
          label: 'Validate',
          timeframe: 'Before 2026-09-15',
          items: ['CRM baseline', 'Owner: Sales Ops'],
        },
        {
          label: 'Complete',
          timeframe: 'Before review',
          items: ['Investment amount', 'Payback', 'Owner: UNKNOWN'],
        },
        {
          label: 'Decide',
          timeframe: 'Decision gate',
          items: ['Current approval', 'COO records decision'],
        },
      ],
    },
  },
  {
    type: 'next_steps',
    title: 'Decision required',
    sources: [sources[0], sources[3]],
    content: {
      type: 'next_steps',
      actions: [
        { action: 'Validate the CRM baseline', owner: 'Sales Ops', deadline: '2026-09-15' },
        { action: 'Complete financial evidence', owner: 'UNKNOWN', deadline: '2026-09-15' },
        { action: 'Record approve, defer or reject', owner: 'COO', deadline: '2026-09-15' },
      ],
      closing_message: 'Supported position: DEFER pending evidence until every gate is current.',
    },
  },
] as const;

function paragraph(blockId: string, text: string, sourceRef = sources[0]) {
  return { blockId, type: 'paragraph', content: { text }, sourceRef };
}

async function save(name: string, bytes: Buffer): Promise<string> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const target = path.join(OUTPUT_DIR, name);
  await fs.writeFile(target, bytes);
  return target;
}

test.describe('Artifact Studio strict cross-format export [@module:artifact-studio]', () => {
  test.setTimeout(300_000);

  test('persists, cold-reopens and exports a reconciled DOCX, PPTX and XLSX', async ({ page }) => {
    const token = await setupDocumentStudioSession(page);
    const headers = authHeaders(token);
    const implementationSha = String(process.env.GIT_SHA || '').trim();
    expect(implementationSha, 'GIT_SHA must pin the exact runtime under review').toMatch(
      /^[0-9a-f]{40}$/
    );
    const testIdentity = jwt.decode(token) as {
      id?: string;
      email?: string;
      organizationId?: string;
    } | null;
    expect(testIdentity?.id, 'test token must identify the persisted user').toBeTruthy();
    expect(testIdentity?.email, 'test token must identify the persisted email').toBeTruthy();
    expect(
      testIdentity?.organizationId,
      'test token must identify the persisted tenant'
    ).toBeTruthy();

    // DOC: use the real deterministic generation lane, then make the generated
    // schema carry the restrictive board case without changing its structure.
    const seeded = await seedDocumentArtifact(page.request, token, {
      title: TITLE,
      description: `${CASE_ID}: board investment decision. Preserve UNKNOWN literally.`,
      documentType: 'business_case',
      language: 'en',
      density: 'detailed',
      goal: 'decide',
      audience: ['Board'],
    });
    const generated = seeded.schema as any;
    expect(generated.sections.length).toBeGreaterThanOrEqual(sectionSpecs.length);
    const docSections = sectionSpecs.map(([title, core], index) => {
      const section = generated.sections[index];
      const supportingBlocks: any[] = [];
      const primaryBlocks =
        title === 'Evidence plan'
          ? [
              paragraph(
                `${section.sectionId}-baseline-action`,
                `${CASE_ID}. Sales Ops must validate the baseline.`,
                sources[1]
              ),
              paragraph(
                `${section.sectionId}-financial-action`,
                'Investment amount and payback remain UNKNOWN; accountable evidence owner: UNKNOWN.',
                sources[2]
              ),
              paragraph(
                `${section.sectionId}-approval-action`,
                'Approval must be current before the COO records the decision.',
                sources[3]
              ),
            ]
          : [
              paragraph(
                `${section.sectionId}-decision`,
                `${CASE_ID}. ${core}`,
                sectionSources[index]
              ),
            ];
      if (title === 'Evidence baseline') {
        supportingBlocks.push({
          blockId: `${section.sectionId}-evidence-basis`,
          type: 'callout',
          content: {
            variant: 'info',
            text: `Evidence basis: ${sources.map((source) => source.sourceId).join('; ')}. Values not supplied by these sources remain UNKNOWN.`,
          },
          sourceRef: sources[1],
        });
      }
      if (title === 'Risks and no-go gates') {
        supportingBlocks.push({
          blockId: `${section.sectionId}-decision-controls`,
          type: 'callout',
          content: {
            variant: 'warning',
            text: 'Decision control: do not introduce an unsupported vendor, timeline, headcount, ROI, causal uplift, investment amount, payback, or NPV.',
          },
          sourceRef: sources[3],
        });
      }
      return {
        ...section,
        title,
        purpose: sectionPurposes[index],
        sourceRefs: [...sources],
        blocks: [...primaryBlocks, ...supportingBlocks],
      };
    });
    const saveDoc = await page.request.put(`${DOC_STUDIO_BASE}/${seeded.artifactId}/content`, {
      headers,
      data: {
        sections: docSections,
        expectedVersion: generated.updatedAt,
        title: TITLE,
        sourceRefs: sources,
      },
    });
    expect(saveDoc.ok(), await saveDoc.text()).toBe(true);
    const coldDoc = await fetchArtifactSchema(page.request, token, seeded.artifactId);
    expect(coldDoc.title).toBe(TITLE);
    expect(coldDoc.sourceRefs.map((source: any) => source.sourceId)).toEqual(
      sources.map((source) => source.sourceId)
    );
    const evidencePlan = coldDoc.sections.find((section: any) => section.title === 'Evidence plan');
    expect(evidencePlan.blocks.map((block: any) => block.content.text)).toEqual([
      `${CASE_ID}. Sales Ops must validate the baseline.`,
      'Investment amount and payback remain UNKNOWN; accountable evidence owner: UNKNOWN.',
      'Approval must be current before the COO records the decision.',
    ]);
    expect(evidencePlan.blocks.map((block: any) => block.sourceRef.sourceId)).toEqual([
      sources[1].sourceId,
      sources[2].sourceId,
      sources[3].sourceId,
    ]);
    const docExport = await page.request.get(
      `${DOC_STUDIO_BASE}/${seeded.artifactId}/export/docx?mode=draft`,
      { headers, timeout: 90_000 }
    );
    expect(docExport.ok(), `DOCX export must not skip: ${await docExport.text()}`).toBe(true);
    const docPayload = (await docExport.json()) as { contentBase64: string };
    const docxBytes = Buffer.from(docPayload.contentBase64, 'base64');
    await save('strict-case.docx', docxBytes);
    const docZip = await JSZip.loadAsync(docxBytes);
    const docXml = (await docZip.file('word/document.xml')?.async('string')) || '';
    for (const marker of [
      CASE_ID,
      'DEFER pending evidence',
      'Investment amount: UNKNOWN',
      ...sources.map((source) => source.sourceId),
    ]) {
      expect(docXml).toContain(marker);
    }
    expect(docXml.match(/Evidence basis:/g) || []).toHaveLength(1);
    expect(docXml.match(/Decision control:/g) || []).toHaveLength(1);
    expect(docXml.match(/Executive decision/g) || []).toHaveLength(2);
    expect(docXml).not.toContain('30/60/90 Implementation Roadmap');
    expect(docXml).not.toContain('Benefits and KPIs');
    expect(docXml).not.toContain('Guardrail:');
    expect(docXml).not.toContain('independent validation');
    expect(docXml).toContain('accountable evidence owner: UNKNOWN');

    // PPT: deterministic structured slides through the real deck persistence
    // and current-render export path. Each slide carries a decision message.
    const slides = pptSlideSpecs.map(({ title, type, content, sources: slideSources }) => ({
      type,
      sourceRefs: slideSources,
      content: {
        title,
        ...content,
      },
    }));
    const deckCreate = await page.request.post(`${API_BASE_URL}/api/presentations/decks`, {
      headers,
      data: {
        title: TITLE,
        theme: 'modern',
        source: 'artifact-strict-case',
        sourcePack: { packId: CASE_ID, name: 'Strict board evidence pack v1' },
        evidenceRefs: sources,
        slides,
      },
    });
    expect(deckCreate.ok(), await deckCreate.text()).toBe(true);
    const deckId = String(((await deckCreate.json()) as any)?.data?.id || '');
    expect(deckId).not.toBe('');
    const coldDeck = await page.request.get(`${API_BASE_URL}/api/presentations/decks/${deckId}`, {
      headers,
    });
    expect(coldDeck.ok(), await coldDeck.text()).toBe(true);
    const coldDeckPayload = (await coldDeck.json()) as any;
    const persistedDeckDocument =
      coldDeckPayload?.data?.deckDocument ||
      (typeof coldDeckPayload?.data?.deck_json === 'string'
        ? JSON.parse(coldDeckPayload.data.deck_json)
        : coldDeckPayload?.data?.deck_json) ||
      coldDeckPayload?.data;
    const persistedCards = persistedDeckDocument?.cards;
    expect(persistedCards).toHaveLength(pptSlideSpecs.length);
    expect(persistedCards[2].source_refs).toEqual(
      expect.arrayContaining([expect.objectContaining({ artifact_id: sources[1].sourceId })])
    );
    expect(persistedCards[3].source_refs).toEqual(
      expect.arrayContaining([expect.objectContaining({ artifact_id: sources[2].sourceId })])
    );
    const artifactIndex = await page.request.get(
      `${API_BASE_URL}/api/artifacts?drafts=include&outputType=presentation&dedupe=false`,
      { headers }
    );
    expect(artifactIndex.ok(), await artifactIndex.text()).toBe(true);
    const artifactIndexPayload = (await artifactIndex.json()) as any;
    const indexedDeck = artifactIndexPayload?.data?.find(
      (artifact: any) => artifact.originRecordId === deckId
    );
    expect(
      indexedDeck,
      `Created deck ${deckId} must be visible in the artifact registry: ${JSON.stringify(artifactIndexPayload?.data)}`
    ).toBeTruthy();
    const pptExport = await page.request.get(
      `${API_BASE_URL}/api/presentations/decks/${deckId}/download?mode=draft`,
      { headers, timeout: 120_000 }
    );
    expect(pptExport.ok(), await pptExport.text()).toBe(true);
    const pptxBytes = Buffer.from(await pptExport.body());
    await save('strict-case.pptx', pptxBytes);
    const pptZip = await JSZip.loadAsync(pptxBytes);
    const slideFiles = Object.keys(pptZip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name)
    );
    expect(slideFiles).toHaveLength(pptSlideSpecs.length);
    const pptXml = (
      await Promise.all(slideFiles.map((name) => pptZip.file(name)!.async('string')))
    ).join('\n');
    for (const marker of [CASE_ID, 'DEFER pending evidence', 'UNKNOWN'])
      expect(pptXml).toContain(marker);
    expect(pptXml).toContain('Owner: UNKNOWN');
    expect(pptXml).not.toContain('Owner: Finance');
    expect(pptXml).not.toContain('Independent review');
    expect(pptXml).not.toContain('2b03f58f-823a-4a35-92c8-4417fd9286f1');
    const noteFiles = Object.keys(pptZip.files).filter((name) =>
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)
    );
    expect(noteFiles).toHaveLength(pptSlideSpecs.length);
    const noteXmlBySlide = await Promise.all(
      noteFiles
        .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
        .map((name) => pptZip.file(name)!.async('string'))
    );
    pptSlideSpecs.forEach((spec, index) => {
      for (const source of spec.sources) {
        expect(noteXmlBySlide[index]).toContain(source.sourceId);
        expect(noteXmlBySlide[index]).toContain(source.sourceTitle);
        expect(noteXmlBySlide[index]).toContain(source.sourceVersion);
        expect(noteXmlBySlide[index]).toContain(source.sourceSnapshotId);
      }
    });

    // XLSX: persist the source pack/evidence refs as workbook metadata, bind
    // claim ranges to stable sheet ids, and also render the claim-to-source
    // matrix in the workbook so provenance survives both reopen and export.
    const blank = await page.request.post(`${API_BASE_URL}/api/workbook/blank`, {
      headers,
      data: {
        title: TITLE,
        sourcePack: { packId: CASE_ID, name: 'Strict board evidence pack v1' },
        evidenceRefs: sources,
      },
    });
    expect(blank.ok(), await blank.text()).toBe(true);
    const workbookId = String(((await blank.json()) as any).id || '');
    const initialRes = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, {
      headers,
    });
    expect(initialRes.ok(), await initialRes.text()).toBe(true);
    const initial = (await initialRes.json()) as {
      version: number;
      schema_json: { sheets: Array<{ id: string }> };
    };
    const summaryId = initial.schema_json.sheets[0].id;
    const sheetIds = {
      assumptions: '11111111-1111-4111-8111-111111111111',
      scenarios: '22222222-2222-4222-8222-222222222222',
      risks: '33333333-3333-4333-8333-333333333333',
      sources: '44444444-4444-4444-8444-444444444444',
      checks: '55555555-5555-4555-8555-555555555555',
    };
    const operations: any[] = [
      { type: 'renameSheet', sheetId: summaryId, name: 'Decision Summary' },
      ...Object.entries(sheetIds).map(([key, sheetId], index) => ({
        type: 'addSheet',
        name: key[0].toUpperCase() + key.slice(1),
        afterIndex: index,
        sheetId,
      })),
      // Blank/add-sheet starts with twelve generic columns. The strict case
      // uses only two (three on Sources); remove the unused canvas so widths,
      // print areas and fit-to-page are based on real content rather than ten
      // empty columns.
      { type: 'deleteColumns', sheetIndex: 0, atIndex: 2, count: 10 },
      { type: 'deleteColumns', sheetIndex: 1, atIndex: 3, count: 9 },
      { type: 'deleteColumns', sheetIndex: 2, atIndex: 2, count: 10 },
      { type: 'deleteColumns', sheetIndex: 3, atIndex: 2, count: 10 },
      { type: 'deleteColumns', sheetIndex: 4, atIndex: 3, count: 9 },
      { type: 'deleteColumns', sheetIndex: 5, atIndex: 2, count: 10 },
      // Blank workbooks start with 30 placeholder rows per sheet. Keep only
      // the meaningful business rows so print areas and zebra banding do not
      // manufacture a page of empty records.
      { type: 'deleteRows', sheetIndex: 0, atIndex: 13, count: 17 },
      { type: 'deleteRows', sheetIndex: 1, atIndex: 3, count: 27 },
      { type: 'deleteRows', sheetIndex: 2, atIndex: 3, count: 27 },
      { type: 'deleteRows', sheetIndex: 3, atIndex: 3, count: 27 },
      { type: 'deleteRows', sheetIndex: 4, atIndex: 4, count: 26 },
      { type: 'deleteRows', sheetIndex: 5, atIndex: 5, count: 25 },
      { type: 'setColumn', sheetIndex: 0, columnIndex: 0, header: 'Metric', width: 28 },
      { type: 'setColumn', sheetIndex: 0, columnIndex: 1, header: 'Value', width: 24 },
      { type: 'setColumn', sheetIndex: 1, columnIndex: 0, header: 'Assumption', width: 42 },
      { type: 'setColumn', sheetIndex: 1, columnIndex: 1, header: 'Owner', width: 18 },
      { type: 'setColumn', sheetIndex: 1, columnIndex: 2, header: 'Validation date', width: 18 },
      { type: 'setColumn', sheetIndex: 2, columnIndex: 0, header: 'Scenario', width: 42 },
      { type: 'setColumn', sheetIndex: 2, columnIndex: 1, header: 'Decision', width: 28 },
      { type: 'setColumn', sheetIndex: 3, columnIndex: 0, header: 'Risk', width: 30 },
      { type: 'setColumn', sheetIndex: 3, columnIndex: 1, header: 'Owner', width: 20 },
      { type: 'setColumn', sheetIndex: 4, columnIndex: 0, header: 'Claim', width: 28 },
      { type: 'setColumn', sheetIndex: 4, columnIndex: 1, header: 'Source ID', width: 34 },
      { type: 'setColumn', sheetIndex: 4, columnIndex: 2, header: 'Evidence excerpt', width: 70 },
      { type: 'setColumn', sheetIndex: 5, columnIndex: 0, header: 'Check', width: 30 },
      { type: 'setColumn', sheetIndex: 5, columnIndex: 1, header: 'Result', width: 22 },
    ];
    const set = (
      sheetIndex: number,
      rowIndex: number,
      columnKey: string,
      value?: unknown,
      formula?: string
    ) =>
      operations.push({
        type: 'setCell',
        sheetIndex,
        rowIndex,
        columnKey,
        ...(formula ? { formula } : { value }),
      });
    set(0, 0, 'A', 'Case');
    set(0, 0, 'B', CASE_ID);
    set(0, 1, 'A', 'Recommendation');
    set(0, 1, 'B', 'DEFER pending evidence');
    set(0, 2, 'A', 'Current conversion');
    set(0, 2, 'B', 0.024);
    set(0, 3, 'A', 'Target conversion');
    set(0, 3, 'B', 0.031);
    set(0, 4, 'A', 'Revenue target PLN m');
    set(0, 4, 'B', 12);
    set(0, 5, 'A', 'Forecast PLN m');
    set(0, 5, 'B', 10.8);
    set(0, 6, 'A', 'Gap PLN m');
    set(0, 6, 'B', undefined, '=B6-B7');
    set(0, 7, 'A', 'Investment amount');
    set(0, 7, 'B', 'UNKNOWN');
    set(0, 8, 'A', 'Payback');
    set(0, 8, 'B', 'UNKNOWN');
    set(0, 9, 'A', 'NPV');
    set(0, 9, 'B', 'UNKNOWN');
    set(0, 10, 'A', 'Decision owner');
    set(0, 10, 'B', 'COO');
    set(0, 11, 'A', 'Decision gate');
    set(0, 11, 'B', '2026-09-15');
    set(0, 12, 'A', 'Classification');
    set(0, 12, 'B', 'INTERNAL');
    set(1, 0, 'A', 'Investment and payback remain UNKNOWN');
    set(1, 0, 'B', 'UNKNOWN');
    set(1, 0, 'C', '2026-09-15');
    set(1, 1, 'A', 'CRM baseline requires validation');
    set(1, 1, 'B', 'Sales Ops');
    set(1, 1, 'C', '2026-09-15');
    set(1, 2, 'A', 'NPV remains UNKNOWN until investment is supplied');
    set(1, 2, 'B', 'UNKNOWN');
    set(1, 2, 'C', '2026-09-15');
    set(2, 0, 'A', 'Evidence incomplete');
    set(2, 0, 'B', 'DEFER');
    set(2, 1, 'A', 'Baseline validated; cost still UNKNOWN');
    set(2, 1, 'B', 'DEFER');
    set(2, 2, 'A', 'Baseline, investment and payback validated');
    set(2, 2, 'B', 'Board decision required');
    [
      ['Data quality', 'Sales Ops'],
      ['Integration', 'CTO'],
      ['Adoption', 'COO'],
    ].forEach(([risk, owner], i) => {
      set(3, i, 'A', risk);
      set(3, i, 'B', owner);
    });
    sources.forEach((source, i) => {
      set(
        4,
        i,
        'A',
        ['Decision mandate', 'Conversion baseline', 'Financial values', 'Risk / no-go gates'][i]
      );
      set(4, i, 'B', source.sourceId);
      set(
        4,
        i,
        'C',
        `${source.sourceVersion} · ${source.sourceSnapshotId} · ${source.sourceExcerpt}`
      );
    });
    set(5, 0, 'A', 'Revenue gap');
    set(5, 0, 'B', undefined, "='Decision Summary'!B6-'Decision Summary'!B7");
    set(5, 1, 'A', 'Current conversion');
    set(5, 1, 'B', undefined, "='Decision Summary'!B4");
    set(5, 2, 'A', 'Target conversion');
    set(5, 2, 'B', undefined, "='Decision Summary'!B5");
    set(5, 3, 'A', 'Investment amount');
    set(5, 3, 'B', undefined, '=IF(\'Decision Summary\'!B9="UNKNOWN","UNKNOWN","REVIEW")');
    set(5, 4, 'A', 'Payback');
    set(5, 4, 'B', undefined, '=IF(\'Decision Summary\'!B10="UNKNOWN","UNKNOWN","REVIEW")');
    operations.push({
      type: 'setCellStyle',
      sheetIndex: 0,
      startRow: 0,
      endRow: 12,
      startColumn: 0,
      endColumn: 1,
      patch: { wrapText: true },
    });
    operations.push(
      {
        type: 'setCellStyle',
        sheetIndex: 0,
        startRow: 2,
        endRow: 3,
        startColumn: 1,
        endColumn: 1,
        patch: { numberFormat: '0.0%' },
      },
      {
        type: 'setCellStyle',
        sheetIndex: 0,
        startRow: 4,
        endRow: 6,
        startColumn: 1,
        endColumn: 1,
        patch: { numberFormat: '#,##0.0" PLN m"' },
      },
      {
        type: 'setCellStyle',
        sheetIndex: 1,
        startRow: 0,
        endRow: 2,
        startColumn: 0,
        endColumn: 2,
        patch: { wrapText: true },
      },
      {
        type: 'setCellStyle',
        sheetIndex: 5,
        startRow: 0,
        endRow: 0,
        startColumn: 1,
        endColumn: 1,
        patch: { numberFormat: '#,##0.0" PLN m"' },
      },
      {
        type: 'setCellStyle',
        sheetIndex: 5,
        startRow: 1,
        endRow: 2,
        startColumn: 1,
        endColumn: 1,
        patch: { numberFormat: '0.0%' },
      },
      ...[2, 3, 4, 5].map((sheetIndex) => ({
        type: 'setCellStyle',
        sheetIndex,
        startRow: 0,
        endRow: sheetIndex === 2 ? 1 : sheetIndex === 3 ? 2 : sheetIndex === 4 ? 3 : 4,
        startColumn: 0,
        endColumn: sheetIndex === 4 ? 2 : 1,
        patch: { wrapText: true },
      }))
    );
    const command = await page.request.post(`${API_BASE_URL}/api/workbook/${workbookId}/commands`, {
      headers,
      data: {
        commandId: 'xlsx.strict.case.materialize',
        baseVersion: initial.version,
        idempotencyKey: `strict-${workbookId}`,
        operations,
      },
    });
    expect(command.ok(), await command.text()).toBe(true);
    let bindingVersion = Number(((await command.json()) as any).version);
    const nativeBindings = [
      { sheetId: summaryId, range: 'A2:B3', label: 'Decision mandate', source: sources[0] },
      {
        sheetId: summaryId,
        range: 'A12:B13',
        label: 'Decision owner and gate',
        source: sources[0],
      },
      {
        sheetId: summaryId,
        range: 'A4:B5',
        label: 'Conversion baseline claims',
        source: sources[1],
      },
      {
        sheetId: summaryId,
        range: 'A6:B11',
        label: 'Financial claims and UNKNOWNs',
        source: sources[2],
      },
      {
        sheetId: sheetIds.risks,
        range: 'A2:B4',
        label: 'Risk and no-go claims',
        source: sources[3],
      },
    ];
    for (const [index, binding] of nativeBindings.entries()) {
      const response = await page.request.post(
        `${API_BASE_URL}/api/workbook/${workbookId}/sources`,
        {
          headers,
          data: {
            sheetId: binding.sheetId,
            range: binding.range,
            label: binding.label,
            sourceRef: binding.source.sourceId,
            sourceType: binding.source.sourceType,
            baseVersion: bindingVersion,
            idempotencyKey: `strict-source-${index}-${workbookId}`,
          },
        }
      );
      expect(response.ok(), await response.text()).toBe(true);
      bindingVersion = Number(((await response.json()) as any).version);
    }
    const coldWorkbook = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, {
      headers,
    });
    expect(coldWorkbook.ok(), await coldWorkbook.text()).toBe(true);
    const coldWorkbookPayload = (await coldWorkbook.json()) as any;
    expect(coldWorkbookPayload.sourcePack).toMatchObject({ packId: CASE_ID });
    expect(coldWorkbookPayload.evidenceRefs.map((source: any) => source.sourceId)).toEqual(
      sources.map((source) => source.sourceId)
    );
    const coldSources = await page.request.get(
      `${API_BASE_URL}/api/workbook/${workbookId}/sources`,
      {
        headers,
      }
    );
    expect(coldSources.ok(), await coldSources.text()).toBe(true);
    const coldBindings = ((await coldSources.json()) as any).bindings;
    expect(coldBindings).toHaveLength(nativeBindings.length);
    expect(coldBindings.map((binding: any) => binding.sourceRef)).toEqual(
      nativeBindings.map((binding) => binding.source.sourceId)
    );
    const workbookExport = await page.request.get(
      `${API_BASE_URL}/api/workbook/${workbookId}/download?mode=draft`,
      { headers, timeout: 90_000 }
    );
    expect(workbookExport.ok(), await workbookExport.text()).toBe(true);
    const xlsxBytes = Buffer.from(await workbookExport.body());
    await save('strict-case.xlsx', xlsxBytes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxBytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Info',
      'Decision Summary',
      'Assumptions',
      'Scenarios',
      'Risks',
      'Sources',
      'Checks',
    ]);
    expect(workbook.getWorksheet('Decision Summary')!.getCell('B4').value).toBe(0.024);
    expect(workbook.getWorksheet('Decision Summary')!.getCell('B9').value).toBe('UNKNOWN');
    expect(workbook.getWorksheet('Decision Summary')!.getCell('B8').value).toEqual(
      expect.objectContaining({ formula: 'B6-B7' })
    );
    expect(workbook.getWorksheet('Checks')!.getCell('B2').value).toEqual(
      expect.objectContaining({ formula: "'Decision Summary'!B6-'Decision Summary'!B7" })
    );
    expect(workbook.getWorksheet('Checks')!.getCell('B3').value).toEqual(
      expect.objectContaining({ formula: "'Decision Summary'!B4" })
    );
    expect(workbook.getWorksheet('Checks')!.getCell('B4').value).toEqual(
      expect.objectContaining({ formula: "'Decision Summary'!B5" })
    );
    expect(workbook.getWorksheet('Checks')!.getCell('B5').value).toEqual(
      expect.objectContaining({
        formula: 'IF(\'Decision Summary\'!B9="UNKNOWN","UNKNOWN","REVIEW")',
      })
    );
    expect(workbook.getWorksheet('Checks')!.getCell('B6').value).toEqual(
      expect.objectContaining({
        formula: 'IF(\'Decision Summary\'!B10="UNKNOWN","UNKNOWN","REVIEW")',
      })
    );
    expect(workbook.getWorksheet('Info')!.getCell('A1').value).toBeTruthy();
    const firstDataRows = {
      Assumptions: ['Investment and payback remain UNKNOWN', 'UNKNOWN', '2026-09-15'],
      Scenarios: ['Evidence incomplete', 'DEFER'],
      Risks: ['Data quality', 'Sales Ops'],
      Sources: ['Decision mandate', sources[0].sourceId],
      Checks: ['Revenue gap'],
    } as const;
    for (const [sheetName, expectedValues] of Object.entries(firstDataRows)) {
      const sheet = workbook.getWorksheet(sheetName)!;
      expectedValues.forEach((expectedValue, columnIndex) => {
        expect(sheet.getRow(2).getCell(columnIndex + 1).value).toEqual(expectedValue);
      });
      expect(sheet.getRow(2).values).not.toEqual(sheet.getRow(1).values);
    }
    expect(workbook.getWorksheet('Assumptions')!.getCell('A3').value).toBe(
      'CRM baseline requires validation'
    );
    expect(workbook.getWorksheet('Assumptions')!.getCell('B4').value).toBe('UNKNOWN');
    expect(workbook.getWorksheet('Assumptions')!.getColumn('A').values).not.toContain(
      'CRM baseline requires independent validation'
    );
    for (const source of sources) {
      expect(workbook.getWorksheet('Sources')!.getColumn('B').values).toContain(source.sourceId);
      expect(workbook.getWorksheet('Sources')!.getColumn('C').values.join(' ')).toContain(
        source.sourceExcerpt
      );
    }

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'manifest.json'),
      JSON.stringify(
        {
          caseId: CASE_ID,
          title: TITLE,
          implementationSha,
          classification: 'INTERNAL',
          recommendation: 'DEFER pending evidence',
          providerEvidence: 'EVIDENCE_MISSING',
          xlsxSourcePackRelationship: 'NATIVE_METADATA_AND_RANGE_BINDINGS',
          artifactIds: { document: seeded.artifactId, presentation: deckId, workbook: workbookId },
          testIdentity: {
            userId: testIdentity!.id,
            email: testIdentity!.email,
            organizationId: testIdentity!.organizationId,
          },
          sources,
        },
        null,
        2
      )
    );
  });
});
