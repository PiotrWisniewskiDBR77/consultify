/**
 * bundleExportRuntime (F1) — WIĄZKA → realne pliki Office (DOCX + XLSX).
 *
 * Most: GeneratedBundle (content z generateDocumentContent + tabela z B4) → realne
 * bufory plików. Raport: ContentSection[] → DocumentSchema → renderDocumentSchemaToDocxBuffer.
 * Tabela: tableSchema → WorkbookSchema → buildWorkbookBuffer (numFmt + CF). PPTX = follow-up
 * (wymaga pipeline'u składania decka z planów B1). SSOT: spec §F5.
 */
import { randomUUID } from 'node:crypto';
import logger from '../../utils/Logger.js';
import { renderDocumentSchemaToDocxBuffer } from '../documentStudio/documentDocxRenderer.js';
import {
  DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  type DocumentBlock,
  type DocumentBlockType,
  type DocumentSchema,
} from '../documentStudio/documentStudioTypes.js';
import { buildWorkbookBuffer, tableSchemaToWorkbook } from '../workbook/WorkbookBuilder.js';
import type { BusinessPlanSpine } from './businessPlanSpine.js';
import type { GeneratedBundle } from './bundleGenerationRuntime.js';

const LOG = '[bundleExportRuntime]';

// ContentBlockType (generateDocumentContent) → DocumentBlockType (DOCX renderer).
const CONTENT_TO_DOC: Record<string, DocumentBlockType> = {
  heading: 'heading',
  text: 'paragraph',
  bulletList: 'bullet_list',
  numberedList: 'numbered_list',
  quote: 'quote',
  callout: 'callout',
  chart: 'chart',
  table: 'table',
  kpi: 'kpi_strip',
  image: 'image',
};

interface GenContentLike {
  sections: Array<{ heading?: string; title?: string; blocks: Array<{ blockId?: string; type: string; content: unknown }> }>;
}

/** ContentSection[] (z SPINE-driven content-gen) → DocumentSchema gotowy do DOCX. */
export function contentToDocumentSchema(content: GenContentLike, spine: BusinessPlanSpine): DocumentSchema {
  const now = new Date().toISOString();
  const sections = content.sections.map((s, i) => {
    const blocks: DocumentBlock[] = s.blocks
      .filter((b) => b.type !== 'heading') // tytuł sekcji niesie nagłówek
      .map((b, j) => ({
        blockId: b.blockId ?? `b-${i}-${j}`,
        type: CONTENT_TO_DOC[b.type] ?? 'paragraph',
        content: b.content,
      }));
    return {
      sectionId: randomUUID(),
      orderIndex: i,
      level: 1 as const,
      title: s.heading ?? s.title ?? `Sekcja ${i + 1}`,
      purpose: '',
      blocks,
      sourceRefs: [],
    };
  });
  return {
    documentId: randomUUID(),
    artifactId: randomUUID(),
    title: `${spine.meta.company} — Biznesplan inwestorski`,
    documentType: 'steering_committee_report',
    language: spine.meta.language === 'EN' ? 'en' : 'pl',
    audience: ['investor'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    sections,
    sourceRefs: [],
    createdAt: now,
    updatedAt: now,
  };
}

export interface BundleFiles {
  docx: Buffer | null;
  xlsx: Buffer | null;
}

/** Wiązka → bufory plików (fail-soft per format). PPTX = follow-up. */
export async function exportBundleFiles(bundle: GeneratedBundle): Promise<BundleFiles> {
  let docx: Buffer | null = null;
  try {
    if (bundle.doc && (bundle.doc as GenContentLike).sections?.length) {
      const schema = contentToDocumentSchema(bundle.doc as GenContentLike, bundle.spine);
      docx = await renderDocumentSchemaToDocxBuffer(schema);
    }
  } catch (err) {
    logger.warn(`${LOG} docx render failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let xlsx: Buffer | null = null;
  try {
    const table = bundle.table as { fields?: unknown[] } | null;
    if (table?.fields?.length) {
      const wb = tableSchemaToWorkbook(table as never, { title: `${bundle.spine.meta.company} — model finansowy` });
      xlsx = await buildWorkbookBuffer(wb);
    }
  } catch (err) {
    logger.warn(`${LOG} xlsx render failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { docx, xlsx };
}
