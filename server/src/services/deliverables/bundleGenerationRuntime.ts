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
import { planDeckLayout, type SlideLayoutPlan } from '../presentationLayoutDirectorService.js';
import { generateTableSchema } from '../tableSchemaGeneratorService.js';
import type { BusinessPlanSpine } from './businessPlanSpine.js';
import {
  generateBusinessPlan,
  spineToDeckSlides,
  spineToDocPlan,
  spineToTableIntent,
  attachChartSpecs,
} from './bundleOrchestrator.js';
import type { GenOpts } from './assumptionsModel.js';
// W1 — wpięcie „mózgu premium" w żywy pipeline (bramki jakości realnie działają):
import { applyDeckBeautyGate, type BeautyScore } from './deckLayoutBeautyGate.js';
import { runBundleContentGate, type ContentGateReport } from './bundleContentGate.js';
import { buildFactBook, auditFactConsistency, type FactContradiction } from './factBook.js';
import { auditProvenance, type ProvenanceAudit, type Claim, type ProvenanceKind } from './provenance.js';
import { buildBothVariants, type AudienceVariantResult } from './deckAudienceVariants.js';
import { routeImage } from './imageRouter.js';
import { selectStockImageProvider } from './stockImageProvider.js';
// W1.8a — kompozycja dojrzałego silnika M18 Document Studio QA (10 kategorii):
import { runBundleDocQa, type BundleDocQaSummary } from './bundleDocQa.js';
// W1.8b — kompozycja dojrzałego gate strukturalnego M19 (validateReport) na decku:
import { runBundleDeckQa, type BundleDeckQaSummary } from './bundleDeckQa.js';
// W12.1 — deterministyczny detektor McKinsey anti-patternów w planach slajdów:
import { detectDeckAntiPatterns, type AntiPatternReport } from './deckAntiPatternDetector.js';
// W7.2 — design-rule critic (typografia/kontrast/gęstość/grid) per slajd:
import { critiqueDeck, type DeckCritique } from './deckDesignCritic.js';
// W7.3 — arsenał archetypów z realną geometrią regionów:
import { resolveArchetype } from './slideArchetypes.js';
// W10.1 — scorecard agregujący wszystkie sygnały jakości w jeden wynik:
import { buildQualityScorecard, type QualityScorecard } from './bundleQualityScorecard.js';

/** Raport jakości wiązki — wynik bramek/audytów wpiętych w generację (W1). */
export interface BundleQuality {
  beauty: BeautyScore | null;
  content: ContentGateReport | null;
  factContradictions: FactContradiction[];
  provenance: ProvenanceAudit | null;
  /** Warianty audytorium z planów decka (board ≤7 / working pełny). */
  variants: { board: AudienceVariantResult; working: AudienceVariantResult } | null;
  /** W1.8a — M18 Document Studio QA (10 kategorii) na raporcie wiązki. */
  docQa: BundleDocQaSummary | null;
  /** W1.8b — M19 strukturalny gate decka (validateReport, in-memory). */
  deckQa: BundleDeckQaSummary | null;
  /** W12.1 — deterministyczne wykrycie 8 McKinsey anti-patternów w planach slajdów. */
  antiPatterns: AntiPatternReport | null;
  /** W7.2 — design-rule critic per slajd (typografia/kontrast/gęstość/grid → regen). */
  designCritique: DeckCritique | null;
  /** W10.1 — zagregowany scorecard 0-100 + ocena + breakdown (wszystkie sygnały). */
  scorecard: QualityScorecard | null;
  /** Zbiorcze: czy wiązka przeszła twarde bramki (content+beauty). */
  passed: boolean;
}

export interface GeneratedBundle {
  spine: BusinessPlanSpine;
  table: unknown | null;
  doc: unknown | null;
  deck: unknown | null;
  /** Które artefakty wyszły (diagnostyka fail-soft). */
  produced: { table: boolean; doc: boolean; deck: boolean };
  /** Wynik bramek jakości wpiętych w generację (W1). */
  quality?: BundleQuality;
}

// ── Serializacja artefaktów do tekstu (dla content-gate + factbook audit) ──
function deckPlansOf(deck: unknown): SlideLayoutPlan[] {
  const d = deck as { plans?: unknown } | null;
  return d && Array.isArray(d.plans) ? (d.plans as SlideLayoutPlan[]) : [];
}
function deckText(deck: unknown): string {
  return deckPlansOf(deck)
    .map((p) => [p.title, p.keyMessage].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
}
function docText(doc: unknown): string {
  const sections = (doc as { sections?: Array<Record<string, unknown>> })?.sections ?? [];
  const parts: string[] = [];
  for (const s of sections) {
    if (typeof s.heading === 'string') parts.push(s.heading);
    if (typeof s.title === 'string') parts.push(s.title);
    const blocks = (s.blocks as Array<{ content?: unknown }>) ?? [];
    for (const b of blocks) {
      const c = b.content as Record<string, unknown> | string | undefined;
      if (typeof c === 'string') parts.push(c);
      else if (c && typeof c === 'object') {
        if (typeof c.text === 'string') parts.push(c.text);
        if (Array.isArray(c.items)) parts.push((c.items as unknown[]).filter((x) => typeof x === 'string').join(' '));
      }
    }
  }
  return parts.join('\n');
}
function tableText(table: unknown): string {
  const t = table as { fields?: Array<{ header?: string }>; seedRows?: Array<Record<string, unknown>> } | null;
  if (!t) return '';
  const headers = (t.fields ?? []).map((f) => f.header).filter(Boolean).join(' ');
  const rows = (t.seedRows ?? []).map((r) => Object.values(r).join(' ')).join('\n');
  return `${headers}\n${rows}`;
}

/** Zmapuj provenance z założeń SPINE na Claim[] (assumption/market mają źródło). */
function spineClaims(spine: BusinessPlanSpine): Claim[] {
  const claims: Claim[] = [];
  for (const a of spine.assumptions ?? []) {
    const prov = (a as { provenance?: { source?: string; benchmarked?: boolean } }).provenance;
    claims.push({
      key: (a as { key: string }).key,
      text: (a as { label: string }).label,
      source: prov?.source
        ? { kind: (prov.benchmarked ? 'external' : 'assumption') as ProvenanceKind, label: prov.source }
        : undefined,
    });
  }
  return claims;
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
  let beauty: BeautyScore | null = null;
  try {
    // Zachowujemy needsProductGraphic dla W1.7 image-router (przed strippingiem w map).
    const fullSlides = spineToDeckSlides(spine);
    const slides = fullSlides.map((s) => ({
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
    // W1.1 — beauty-gate WPIĘTY: planuj, oceń, regeneruj gdy brzydkie (≤2).
    const first = await planDeckLayout(slides as never, meta as never, genOpts as never);
    const gated = await applyDeckBeautyGate(first, () =>
      planDeckLayout(slides as never, meta as never, genOpts as never)
    );
    // W1.5 — chart-spec WPIĘTY: dołącz chart specs do planów slajdów (post-layout, additive).
    if (gated.plans) {
      gated.plans = attachChartSpecs(gated.plans, spine);
    }
    // W1.7 — image-router: T0 stock images dla slajdów z needsProductGraphic.
    if (gated.plans && Array.isArray(gated.plans)) {
      const provider = selectStockImageProvider();
      const imageQueries: Record<string, string> = {
        root_cause: `${spine.meta.company} business challenge`,
        single_insight: `${spine.meta.company} technology innovation`,
      };
      const imagePromises = (gated.plans as Array<{ slideIndex?: number; layoutIntent?: string; imageUrl?: string | null }>)
        .map(async (plan, idx) => {
          const src = fullSlides[idx];
          if (!src?.needsProductGraphic) return;
          const route = routeImage({ contentType: 'photo', package: 'lite' });
          if (route.isChartRoute) return;
          const query = imageQueries[plan.layoutIntent ?? ''] ?? `${spine.meta.company} business`;
          const img = await provider.fetchImage(query, { orientation: 'landscape' });
          if (img?.url) plan.imageUrl = img.url;
        });
      await Promise.allSettled(imagePromises);
    }
    deck = gated;
    beauty = gated.beautyScore ?? null;
  } catch (err) {
    logger.warn(`${LOG} deck generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── W1.2/W1.3/W1.4 — bramki jakości na ZSYNTETYZOWANYM materiale (fail-soft) ──
  let quality: BundleQuality;
  try {
    const texts = { deckText: deckText(deck), reportText: docText(doc), tableText: tableText(table) };
    // W1.2 content-gate: placeholdery + spójność hero-numbers w 3 formatach.
    const content = runBundleContentGate(texts, spine.heroNumbers);
    // W1.3 factbook: twarde liczby sprzeczne z kanonem (hero-numbers = SoT).
    const factBook = buildFactBook(spine.heroNumbers);
    const allText = [texts.deckText, texts.reportText, texts.tableText].join('\n');
    const factContradictions = auditFactConsistency(factBook, allText);
    // W1.3b provenance: pokrycie źródeł na założeniach (assumption/market mają source).
    const provenance = auditProvenance(spineClaims(spine));
    // W1.4 warianty audytorium z planów decka (board ≤7 / working).
    const plans = deckPlansOf(deck);
    const variants = plans.length > 0 ? buildBothVariants(plans) : null;
    // W1.8a — M18 Document Studio QA (10 kategorii) na raporcie (fail-soft, null gdy doc pusty).
    const docQa = runBundleDocQa(doc, spine);
    // W1.8b — M19 strukturalny gate decka (in-memory, bez DB).
    const deckQa = runBundleDeckQa(spine);
    // W12.1 — McKinsey anti-pattern detector na planach slajdów.
    const antiPatterns = plans.length > 0 ? detectDeckAntiPatterns(plans) : null;
    // W7.2 — design-rule critic per slajd (mapuje plany na wejście critica).
    // W7.3 — gdy plan wskazuje archetyp (composition.layoutVariantId), bierzemy jego
    // REALNĄ geometrię regionów z arsenału → critic DR-06 waliduje faktyczny układ.
    const designCritique = plans.length > 0
      ? critiqueDeck(plans.map((p) => {
          const pl = p as {
            slideIndex?: number; layoutIntent?: string; title?: string; keyMessage?: string;
            bullets?: string[]; composition?: { layoutVariantId?: string } | null;
          };
          const variantId = pl.composition?.layoutVariantId;
          const intent = pl.layoutIntent ?? '';
          const archetype = intent ? resolveArchetype(intent, variantId) : null;
          const regions = archetype?.regions.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
          return { slideIndex: pl.slideIndex, layoutIntent: pl.layoutIntent, title: pl.title, keyMessage: pl.keyMessage, bullets: pl.bullets, regions };
        }))
      : null;

    const passed = content.passed && factContradictions.length === 0 && (beauty?.passed ?? true);
    quality = { beauty, content, factContradictions, provenance, variants, docQa, deckQa, antiPatterns, designCritique, scorecard: null, passed };
    // W10.1 — scorecard agreguje powyższe sygnały + flagi finansowe ze spine.
    quality.scorecard = buildQualityScorecard(quality, spine);
    if (!passed) {
      logger.warn(`${LOG} quality gate flagged issues`, {
        contentIssues: content.issues.length,
        factContradictions: factContradictions.length,
        beautyPassed: beauty?.passed,
      });
    }
  } catch (err) {
    logger.warn(`${LOG} quality gate error (fail-soft): ${err instanceof Error ? err.message : String(err)}`);
    quality = { beauty, content: null, factContradictions: [], provenance: null, variants: null, docQa: null, deckQa: null, antiPatterns: null, designCritique: null, scorecard: null, passed: true };
  }

  return {
    spine,
    table,
    doc,
    deck,
    produced: { table: !!table, doc: !!doc, deck: !!deck },
    quality,
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
