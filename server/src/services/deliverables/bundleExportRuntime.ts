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
import { resolveTheme } from './themeRegistry.js';
import type { BrandThemeOverride } from './brandIngestion.js';
import { deckPlansToPptxBuffer, type DeckPlanSlide } from './bundlePptxRuntime.js';
import { buildAudienceVariant } from './deckAudienceVariants.js';
import { spineToUnifiedReport } from './spineToUnifiedReport.js';
import { PptxPipelineService } from '../report/pptx/PptxPipelineService.js';

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

/** ContentSection[] (z SPINE-driven content-gen) → DocumentSchema gotowy do DOCX.
 *  `themeId` (F3.1): fonty z themeRegistry → DOCX renderer (resolveDocxFonts) honoruje. */
export function contentToDocumentSchema(
  content: GenContentLike,
  spine: BusinessPlanSpine,
  themeId?: string,
  brandOverride?: BrandThemeOverride
): DocumentSchema {
  const now = new Date().toISOString();
  const theme = resolveTheme(themeId, brandOverride);
  const formattingSchema = {
    ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
    fonts: {
      ...DEFAULT_CONSULTING_FORMATTING_SCHEMA.fonts,
      body: theme.fontPair.body,
      heading: theme.fontPair.heading,
    },
  };
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
    formattingSchema,
    sections,
    sourceRefs: [],
    createdAt: now,
    updatedAt: now,
  };
}

export interface BundleFiles {
  docx: Buffer | null;
  xlsx: Buffer | null;
  pptx: Buffer | null;
  /** Board cut (≤7 slajdów) — wariant zarządczy (F10.3 materializowany). */
  pptxBoard: Buffer | null;
}

/** Wyłuskaj plany decka z bundle.deck (DeckLayoutDirectorResult). */
function extractDeckPlans(deck: unknown): DeckPlanSlide[] {
  const d = deck as { plans?: unknown } | null;
  if (!d || !Array.isArray(d.plans)) return [];
  return (d.plans as DeckPlanSlide[]).filter((p) => p && typeof p.slideIndex === 'number');
}

/**
 * W7.6 — deck PPTX przez DOJRZAŁY M19 PptxPipelineService (17 intencji, BCG layouty,
 * master slides, branding). Most: SPINE → UnifiedReportJSON → bufor .pptx.
 * Fail-soft: zwraca null gdy pipeline padnie (caller spada na minimalny renderer).
 */
async function spinePptxViaPipeline(
  bundle: GeneratedBundle,
  themeId: string | undefined,
  brandColor: string,
): Promise<Buffer | null> {
  try {
    const report = spineToUnifiedReport(bundle.spine, {
      themeId,
      brandColor,
      date: new Date().toISOString().slice(0, 10),
    });
    if (!report.slides.length) return null;
    const pipeline = new PptxPipelineService();
    const result = await pipeline.generateFromUnifiedJson(report, {
      language: bundle.spine.meta.language === 'EN' ? 'en' : 'pl',
      brandColor,
      confidentiality: 'confidential',
      skipValidation: true, // bundle ma własne bramki; per-slajd render i tak fail-soft
    });
    return result.buffer ?? null;
  } catch (err) {
    // P0.3 — bundle nie ma deckId/generationId (klucz = spine.meta.company); logujemy
    // najlepszy dostępny identyfikator + pełny stack, żeby dało się debugować na produkcji
    // zamiast tylko `.message` (fail-soft zachowany: caller spada na minimalny renderer).
    logger.warn(`${LOG} M19 pptx pipeline failed (fallback to minimal)`, {
      company: bundle.spine?.meta?.company,
      themeId,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    });
    return null;
  }
}

/** Wiązka → bufory plików (fail-soft per format): DOCX + XLSX + PPTX.
 *  `themeId` (F3.1) steruje fontami/paletą na 3 powierzchniach.
 *  `brandOverride` (F8.1) nadpisuje fonty/kolory motywy klientem (brand > motyw > default). */
export async function exportBundleFiles(
  bundle: GeneratedBundle,
  themeId?: string,
  brandOverride?: BrandThemeOverride,
): Promise<BundleFiles> {
  const theme = resolveTheme(themeId, brandOverride);
  let docx: Buffer | null = null;
  try {
    if (bundle.doc && (bundle.doc as GenContentLike).sections?.length) {
      const schema = contentToDocumentSchema(bundle.doc as GenContentLike, bundle.spine, themeId, brandOverride);
      docx = await renderDocumentSchemaToDocxBuffer(schema);
    }
  } catch (err) {
    logger.warn(`${LOG} docx render failed`, {
      company: bundle.spine?.meta?.company,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    });
  }

  let xlsx: Buffer | null = null;
  try {
    const table = bundle.table as { fields?: unknown[] } | null;
    if (table?.fields?.length) {
      const wb = tableSchemaToWorkbook(table as never, {
        title: `${bundle.spine.meta.company} — model finansowy`,
        headerColor: theme.palette.dominant,
      });
      // Surface provenance on the Info sheet (company/source/date) so the bundle
      // workbook carries the same branded metadata band as the standalone one.
      xlsx = await buildWorkbookBuffer(wb, {
        meta: {
          organizationName: bundle.spine.meta.company,
          source: 'Consultify — wiązka biznesplanu',
          generatedAt: new Date().toISOString().slice(0, 10),
        },
      });
    }
  } catch (err) {
    logger.warn(`${LOG} xlsx render failed`, {
      company: bundle.spine?.meta?.company,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    });
  }

  let pptx: Buffer | null = null;
  let pptxBoard: Buffer | null = null;
  try {
    const lang = bundle.spine.meta.language === 'EN' ? 'en' : 'pl';
    // W7.6 — najpierw DOJRZAŁY M19 pipeline (17 intencji, BCG layouty, branding).
    pptx = await spinePptxViaPipeline(bundle, themeId, theme.palette.dominant);

    // Fallback: minimalny renderer z planów decka (gdy M19 pipeline zwrócił null).
    const plans = extractDeckPlans(bundle.deck);
    if (!pptx && plans.length > 0) {
      pptx = await deckPlansToPptxBuffer(plans, {
        themeId, brandOverride,
        title: `${bundle.spine.meta.company} — Biznesplan inwestorski`,
        company: bundle.spine.meta.company,
        language: lang,
      });
    }

    // F10.3 materializowane: board cut (≤7) jako osobny plik — minimalny renderer z planów.
    if (plans.length > 0) {
      const board = buildAudienceVariant(plans as never, 'board');
      if (board.droppedSlideIndices.length > 0) {
        pptxBoard = await deckPlansToPptxBuffer(board.plans as never, {
          themeId, brandOverride,
          title: `${bundle.spine.meta.company} — Wersja dla zarządu`,
          company: bundle.spine.meta.company,
          language: lang,
        });
      }
    }
  } catch (err) {
    logger.warn(`${LOG} pptx render failed`, {
      company: bundle.spine?.meta?.company,
      themeId,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    });
  }

  return { docx, xlsx, pptx, pptxBoard };
}

/** Bezpieczna nazwa-baza pliku z nazwy firmy (litera/cyfra/_/-, max 60). */
export function safeBundleBaseName(company?: string): string {
  return (company || 'material').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'material';
}

/**
 * F4.2 — „Pobierz komplet": 3 bufory (docx/xlsx/pptx) → jedna TECZKA .zip.
 * Pomija formaty których nie ma. Zwraca Buffer zip (lub null gdy 0 plików).
 */
export async function bundleFilesToZip(files: BundleFiles, baseName: string): Promise<Buffer | null> {
  if (!files.docx && !files.xlsx && !files.pptx && !files.pptxBoard) return null;
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  if (files.docx) zip.file(`${baseName}-raport.docx`, files.docx);
  if (files.xlsx) zip.file(`${baseName}-model.xlsx`, files.xlsx);
  if (files.pptx) zip.file(`${baseName}-prezentacja.pptx`, files.pptx);
  if (files.pptxBoard) zip.file(`${baseName}-prezentacja-zarzad.pptx`, files.pptxBoard);
  return zip.generateAsync({ type: 'nodebuffer' });
}
