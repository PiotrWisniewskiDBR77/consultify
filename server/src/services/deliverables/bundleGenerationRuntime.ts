/**
 * bundleGenerationRuntime (F0.2) — jeden brief → SPINE → spójna WIĄZKA (tabela+raport+deck).
 *
 * Reużywalny produkt (nie skrypt): łączy czysty BundleOrchestrator z ciężkimi generatorami
 * B4/B3/B1. Trzyma orchestrator czysty (testowalny) — tu mieszka warstwa I/O z LLM.
 * Sekwencyjnie + fail-soft per artefakt (jeden timeout nie kładzie wiązki). Raport idzie
 * przez deterministyczny spineToDocPlan (omija flaky planDocumentStructure).
 *
 * Za flagą ENABLE_DELIVERABLES_PREMIUM (resolver tieru w generatorach). SSOT: spec §D.
 */
import logger from '../../utils/Logger.js';
import { generateDocumentContent } from '../documentStudio/documentBlockContentGenerator.js';
import { planDeckLayout } from '../presentationLayoutDirectorService.js';
import { generateTableSchema } from '../tableSchemaGeneratorService.js';
import type { BusinessPlanSpine } from './businessPlanSpine.js';
import {
  generateBusinessPlan,
  spineToDeckSlides,
  spineToDocPlan,
  spineToTableIntent,
} from './bundleOrchestrator.js';
import type { GenOpts } from './assumptionsModel.js';

export interface GeneratedBundle {
  spine: BusinessPlanSpine;
  table: unknown | null;
  doc: unknown | null;
  deck: unknown | null;
  /** Które artefakty wyszły (diagnostyka fail-soft). */
  produced: { table: boolean; doc: boolean; deck: boolean };
}

const LOG = '[bundleGenerationRuntime]';

/**
 * Z gotowego SPINE generuje 3 artefakty (sekwencyjnie, fail-soft). Hero-numbers
 * identyczne — bo wszystkie wejścia pochodzą z jednego SPINE (source of truth).
 */
export async function generateBundleFromSpine(
  spine: BusinessPlanSpine,
  opts: GenOpts = {}
): Promise<GeneratedBundle> {
  const genOpts = { orgId: opts.orgId ?? '', preferPremium: opts.preferPremium ?? true };

  let table: unknown | null = null;
  try {
    table = await generateTableSchema(spineToTableIntent(spine), genOpts);
  } catch (err) {
    logger.warn(`${LOG} table generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let doc: unknown | null = null;
  try {
    // deterministyczny plan z SPINE → omija flaky planDocumentStructure
    doc = await generateDocumentContent(spine.meta.thesis, spineToDocPlan(spine), {
      orgId: genOpts.orgId ?? '',
      preferPremium: genOpts.preferPremium,
      citationCount: 3,
    });
  } catch (err) {
    logger.warn(`${LOG} doc generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let deck: unknown | null = null;
  try {
    const slides = spineToDeckSlides(spine).map((s) => ({
      intent: s.intent,
      key_message: s.key_message,
      content: s.content,
    }));
    const meta = {
      language: spine.meta.language,
      template: 'board',
      client: spine.meta.company,
      project: 'Biznesplan inwestorski',
    };
    deck = await planDeckLayout(slides as never, meta as never, genOpts as never);
  } catch (err) {
    logger.warn(`${LOG} deck generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    spine,
    table,
    doc,
    deck,
    produced: { table: !!table, doc: !!doc, deck: !!deck },
  };
}

/** Pełny łańcuch: brief → LLM założenia → CFO-review+repair → SPINE → 3 artefakty. */
export async function generateBundle(
  brief: string,
  opts: GenOpts = {}
): Promise<GeneratedBundle | null> {
  const spine = await generateBusinessPlan(brief, opts);
  if (!spine) {
    logger.warn(`${LOG} generateBusinessPlan returned null (LLM failed)`);
    return null;
  }
  return generateBundleFromSpine(spine, opts);
}
