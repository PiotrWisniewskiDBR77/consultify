/**
 * Document Studio — shared golden-export fixture (C4).
 *
 * A single representative `DocumentSchema` exercising every structural
 * surface the export NFR cares about, so the DOCX and PDF golden tests
 * assert against the *same* logical document:
 *
 *   - cover page (title / subtitle / audience / generated date)
 *   - Table of Contents (formattingSchema.toc = true)
 *   - 3 body sections, headings at H1/H2/H3
 *   - paragraph, bullet list, numbered list
 *   - callout, quote (with citation)
 *   - table (KPI-strip-shaped + a regular data table)
 *   - chart block (bar chart — falls back to a text placeholder in the
 *     test environment because `chartjs-node-canvas` is not installed,
 *     which is itself a legitimate, deterministic contract to assert)
 *   - footnote block + inline citation (`inline_marker` style)
 *   - an appendix section (page-break-before + lettered numbering)
 *   - sources & traceability list
 *   - confidentiality footer + page numbering enabled
 *
 * Kept in one place so a renderer regression in either format is
 * caught against an identical document shape.
 */

import type { DocumentSchema, FormattingSchema } from '../../../server/src/services/documentStudio/documentStudioTypes.js';

export function makeGoldenFormattingSchema(
  overrides: Partial<FormattingSchema> = {}
): FormattingSchema {
  return {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true, content: 'Consultify · Golden Export Fixture' },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: true,
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
    ...overrides,
  };
}

/**
 * Builds the canonical golden `DocumentSchema`. Deterministic:
 * `createdAt` / `updatedAt` are fixed ISO strings so the rendered
 * "Generated: …" cover line never changes between runs.
 */
export function makeGoldenDocumentSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-golden-1',
    artifactId: 'artifact-golden-1',
    title: 'Golden Export Fixture — Q1 Performance Review',
    documentType: 'steering_committee_report',
    language: 'en',
    audience: ['Steering Committee', 'CFO'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: makeGoldenFormattingSchema(),
    sections: [
      {
        sectionId: 'sec-summary',
        orderIndex: 0,
        level: 1,
        title: 'Executive Summary',
        purpose: 'One-page recommendation for the steering committee.',
        blocks: [
          {
            blockId: 'blk-h2-context',
            type: 'heading',
            content: { text: 'Context', level: 2 } as unknown,
          },
          {
            blockId: 'blk-p1',
            type: 'paragraph',
            content: {
              text: 'Q1 revenue grew 18 percent against plan, driven by the enterprise segment.',
            } as unknown,
            sourceRef: { sourceType: 'finance_report', sourceId: 'fr-2026-q1', sourceTitle: 'Q1 Finance Report' },
          },
          {
            blockId: 'blk-h3-detail',
            type: 'heading',
            content: { text: 'Key drivers', level: 3 } as unknown,
          },
          {
            blockId: 'blk-callout',
            type: 'callout',
            content: { variant: 'key_message', text: 'Decide on Q2 budget reallocation by next Friday.' } as unknown,
          },
          {
            blockId: 'blk-quote',
            type: 'quote',
            content: {
              text: 'Without a confirmed sponsor we cannot commit engineering capacity.',
              attribution: 'CFO',
            } as unknown,
          },
          {
            blockId: 'blk-bullets',
            type: 'bullet_list',
            content: { style: 'bullet', items: ['Enterprise ARR +18%', 'Churn flat at 4%', 'Pipeline coverage 3.2x'] } as unknown,
          },
          {
            blockId: 'blk-numbered',
            type: 'numbered_list',
            content: { style: 'numbered', items: ['Confirm Q2 budget', 'Re-forecast headcount', 'Brief the board'] } as unknown,
          },
        ],
        sourceRefs: [],
      },
      {
        sectionId: 'sec-findings',
        orderIndex: 1,
        level: 1,
        title: 'Findings & Data',
        blocks: [
          {
            blockId: 'blk-kpi-strip',
            type: 'kpi_strip',
            content: {
              headers: ['KPI', 'Target', 'Actual'],
              rows: [
                ['Revenue', '$10.0M', '$11.8M'],
                ['Gross Margin', '62%', '64%'],
              ],
              caption: 'Q1 KPI Strip',
            } as unknown,
          },
          {
            blockId: 'blk-table',
            type: 'table',
            content: {
              headers: ['Region', 'Revenue', 'Growth'],
              rows: [
                ['NA', '$6.2M', '+21%'],
                ['EMEA', '$3.9M', '+12%'],
                ['APAC', '$1.7M', '+9%'],
              ],
              caption: 'Revenue by region',
            } as unknown,
          },
          {
            blockId: 'blk-chart',
            type: 'chart',
            content: {
              kind: 'bar',
              title: 'Revenue by Quarter',
              categories: ['Q1', 'Q2', 'Q3', 'Q4'],
              xAxisLabel: 'Quarter',
              yAxisLabel: 'Revenue ($M)',
              series: [{ label: 'Revenue', values: [9.1, 9.8, 10.5, 11.8] }],
              caption: 'Quarterly revenue trend, FY2026.',
            } as unknown,
          },
          {
            blockId: 'blk-footnote',
            type: 'footnote',
            content: { text: 'Revenue figures exclude one-off licensing income.' } as unknown,
          },
        ],
        sourceRefs: [],
      },
      {
        sectionId: 'sec-recommendation',
        orderIndex: 2,
        level: 1,
        title: 'Recommendation',
        blocks: [
          {
            blockId: 'blk-rec-paragraph',
            type: 'paragraph',
            content: { text: 'Approve the proposed Q2 budget reallocation as outlined above.' } as unknown,
          },
          {
            blockId: 'blk-assumption',
            type: 'paragraph',
            content: { text: 'Assumes headcount plan stays flat through Q3.' } as unknown,
            isAssumption: true,
          },
        ],
        sourceRefs: [],
      },
      {
        sectionId: 'sec-glossary',
        orderIndex: 3,
        level: 1,
        title: 'Glossary',
        kind: 'appendix',
        blocks: [
          {
            blockId: 'blk-glossary-p',
            type: 'paragraph',
            content: { text: 'ARR: Annual Recurring Revenue.' } as unknown,
          },
        ],
        sourceRefs: [],
      },
    ],
    sourceRefs: [{ sourceType: 'finance_report', sourceId: 'fr-2026-q1', sourceTitle: 'Q1 Finance Report' }],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}
