/**
 * Presentation Generator Service (T058)
 *
 * Transforms platform artifacts into sponsor-ready UnifiedReportJSON decks.
 * Pipeline: source selection → guided setup → outline → UnifiedJSON → PPTX via PptxPipelineService.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as pooledAll, get as pooledGet, run as pooledRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { createPinnedClientContext } from '../utils/pinnedTransactionClient.js';
import type { PgTransactionClient } from '../utils/queryHelpers.js';
import { exportsDir } from '../utils/storagePaths.js';
import { materializePlannedVisual } from './ai/deckVisualsService.js';
import {
  buildContextPack,
  type ContextPack,
  getContextPackSnapshot,
  saveContextPackSnapshot,
} from './contextPackBuilder.js';
import { generateDeckBriefContentPack } from './deckBriefContentPack.js';
import {
  contentLeaksTemplateInventory,
  isTemplateInventoryLeak,
} from './deliverableContentGuard.js';
import { resolveDeliverableTier } from './deliverableGenerationTier.js';
import { runBundleContentGate } from './deliverables/bundleContentGate.js';
import {
  deriveConfidence,
  type EvidenceContract,
  type EvidenceContractSource,
} from './evidence/evidenceContract.js';
import { safePersistEvidenceContract } from './evidence/evidenceContractBridge.js';
import { generateNarrative } from './narrativeEngine/index.js';
import type { NarrativeEngineInput } from './narrativeEngine/types.js';
import { recordDeckGeneration } from './organizationStyleProfileService.js';
import {
  applyApprovedTemplateToOutline,
  resolveApprovedPresentationTemplate,
  type TemplateSlotMappingResult,
} from './presentationApprovedTemplateService.js';
import {
  applyBrandLayoutSystem,
  buildBrandLayoutSystem,
} from './presentationBrandLayoutService.js';
import {
  type DeckDocument,
  deckDocumentFromUnifiedJson,
} from './presentationDeckDocumentService.js';
import { generateDeckVariants } from './presentationLayoutVariantsService.js';
import { buildPresentationNarrativePlan } from './presentationNarrativePlannerService.js';
import { preflightPresentationSourcePack } from './presentationSourcePackService.js';
import { applyIntentDensityDefaults } from './presentationStudioIntentDensityDefaultsService.js';
import { auditPresentationStudioOutlineLayout } from './presentationStudioLayoutAuditService.js';
import { decorateSlidesWithAuditFlags } from './presentationStudioSlideAuditDecoratorService.js';
import {
  applyTemplateRuntime,
  buildSystemTemplateRuntime,
  buildTemplateRuntimeFromRow,
  type PresentationTemplateRuntime,
} from './presentationTemplateRuntimeService.js';
import { qaGatedImageGeneration } from './presentationVisionQAService.js';
import { planDeckVisuals, planDeckVisualsTiered } from './presentationVisualDirectorService.js';
import { PptxPipelineService } from './report/pptx/PptxPipelineService.js';
import type {
  SlideIntent,
  UnifiedReportJSON,
  UnifiedReportMeta,
  UnifiedSlide,
} from './report/pptx/types.js';
import { planSlides } from './slidePlanningEngineService.js';
import {
  applyTransformationPackToArtifactData,
  buildTransformationReadDeckPack,
} from './transformationReadDeckPackService.js';
import * as artifactRegistryService from './v8/artifactRegistryService.js';

// ============================================================
// TYPES
// ============================================================

// ============================================================
// U02 — TRANSACTION PINNING FOR THE PRESENTATION OWNER MODULE
// ============================================================

/**
 * An orchestrator that already owns a `withPgTransaction` client donates it
 * here; every deck query below then runs on that transaction instead of the
 * pooled handle. Without a donated client the behaviour is unchanged.
 *
 * Note the `dbRun` asymmetry: the pooled `DbPromise.run` defaults to
 * `fallback: true` and resolves `{success:false}` on error instead of
 * rejecting (the documented cause of silently-lost deck writes). Inside a
 * donated transaction that would let a caller COMMIT a deck that was never
 * inserted, so the pinned path rejects instead.
 */
const presentationOwnerTransaction = createPinnedClientContext('presentation_owner');

export function withPresentationOwnerClient<T>(
  client: PgTransactionClient,
  fn: () => Promise<T>
): Promise<T> {
  return presentationOwnerTransaction.withClient(client, fn);
}

type PooledQueryOptions = { timeout?: number; fallback?: boolean };

async function dbAll<T = any>(
  sql: string,
  params: unknown[] = [],
  options?: PooledQueryOptions
): Promise<T[]> {
  const pinned = presentationOwnerTransaction.current();
  if (pinned) return (await pinned.query<T>(sql, params)).rows || [];
  return pooledAll<T>(sql, params, options);
}

async function dbGet<T = any>(
  sql: string,
  params: unknown[] = [],
  options?: PooledQueryOptions
): Promise<T | undefined> {
  const pinned = presentationOwnerTransaction.current();
  if (pinned) return (await pinned.query<T>(sql, params)).rows[0];
  return (await pooledGet<T>(sql, params, options)) ?? undefined;
}

async function dbRun(
  sql: string,
  params: unknown[] = [],
  options?: PooledQueryOptions
): Promise<{ success: boolean; changes?: number; lastID?: number; error?: string }> {
  const pinned = presentationOwnerTransaction.current();
  if (pinned) {
    const result = await pinned.query(sql, params);
    return { success: true, changes: result.rowCount ?? 0 };
  }
  return pooledRun(sql, params, options);
}

// ============================================================
// U02 — NATIVE (DETERMINISTIC) DECK CREATION
// ============================================================

export interface CreateNativeDeckParams {
  organizationId: string;
  title: string;
  /** Deterministic render model, already projected from frozen facts. */
  unifiedJson: UnifiedReportJSON;
  sourceType: string;
  sourceId: string;
  createdBy: string;
  createdAt: string;
  theme?: 'corporate' | 'minimal' | 'modern';
  language?: 'en' | 'pl';
  confidentiality?: 'confidential' | 'internal' | 'public';
  status?: 'draft' | 'ready';
  projectId?: string | null;
  contextSnapshotId?: string | null;
  executionRunId?: string | null;
  registerArtifact?: boolean;
  originSummary?: Record<string, unknown>;
}

export interface CreateNativeDeckResult {
  deckId: string;
  deck: DeckDocument;
  slideCount: number;
  registryArtifactId: string | null;
}

/**
 * U02 — create a native Presentation artifact from a caller-supplied deck model.
 *
 * Deliberately NOT `generateOutline` + `generateDeck`: those call the narrative
 * engine and the visual director, so the same approved facts would produce a
 * different deck on every run. A governed publication needs the opposite —
 * given one facts digest, exactly one deck. The caller therefore projects the
 * frozen facts into `UnifiedReportJSON` and this function only persists it.
 *
 * `deck_json` (the native, editable DeckDocument) and `unified_json` (the
 * render model) are written together so a later PPTX export reads back the
 * native model rather than re-deriving it.
 */
export async function createNativeDeck(
  params: CreateNativeDeckParams
): Promise<CreateNativeDeckResult> {
  if (!params.organizationId) throw new Error('native_deck_organization_required');
  if (!params.unifiedJson.slides.length) throw new Error('native_deck_slides_required');

  const deckId = uuidv4().replace(/-/g, '');
  const status = params.status ?? 'ready';
  const deck = deckDocumentFromUnifiedJson({
    deckId,
    organizationId: params.organizationId,
    title: params.title,
    unifiedJson: params.unifiedJson,
    status,
    createdBy: params.createdBy,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  });
  const slideCount = params.unifiedJson.slides.length;

  // Persist-honesty fix (Case Workspace V1, packet E6): the pooled `dbRun`
  // used to run with NO `{ fallback: false }` override, so `DbPromise.run`'s
  // default `fallback: true` swallowed a genuine SQL failure (e.g. this
  // table's own `status` CHECK constraint) into `{ success: false }` instead
  // of rejecting — and the return value was never inspected before this
  // function went on to register an artifact-registry row and report a
  // normal-looking success for a deck that was NEVER WRITTEN. `{fallback:
  // false}` makes the pooled path reject on error too, matching what the
  // PINNED path (see `dbRun` above) already did unconditionally — a genuine
  // single-row `INSERT ... VALUES (...)` with no WHERE/ON CONFLICT clause
  // either fully commits exactly one row or throws, so there is no
  // in-between "reported success but wrote nothing" state left for a
  // post-write readback to catch; the explicit `changes` check below is
  // therefore belt-and-suspenders (documenting the same "inspect the write's
  // return value" contract `createWave5Artifact`/`materializeDocumentArtifact`
  // already use for their own writes), not load-bearing on its own.
  const insertResult = await dbRun(
    `INSERT INTO presentation_decks (
       id, organization_id, project_id, title, template_id, deck_type, audience, goal, language,
       confidentiality, theme, source_artifacts, outline_json, status, deck_json,
       unified_json, slide_count, version, generated_by, source_type, source_id,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'default', 'custom', 'executive', 'inform', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    [
      deckId,
      params.organizationId,
      params.projectId ?? null,
      params.title,
      params.language ?? 'pl',
      params.confidentiality ?? 'confidential',
      params.theme ?? 'corporate',
      JSON.stringify([]),
      JSON.stringify([]),
      status,
      JSON.stringify(deck),
      JSON.stringify(params.unifiedJson),
      slideCount,
      params.createdBy,
      params.sourceType,
      params.sourceId,
      params.createdAt,
      params.createdAt,
    ],
    { fallback: false }
  );
  if (!insertResult.success || !insertResult.changes) {
    throw new Error('native_deck_persist_failed');
  }

  let registryArtifactId: string | null = null;
  if (params.registerArtifact !== false) {
    const artifact = await artifactRegistryService.registerArtifactOrigin({
      organizationId: params.organizationId,
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: deckId,
      titleSnapshot: params.title,
      ownerUserId: params.createdBy,
      createdBy: params.createdBy,
      deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState(status),
      visibilityScope: artifactRegistryService.deriveArtifactVisibilityScope({
        outputType: 'presentation',
        projectId: params.projectId ?? null,
        ownerUserId: params.createdBy,
      }),
      projectId: params.projectId ?? null,
      contextSnapshotId: params.contextSnapshotId ?? undefined,
      executionRunId: params.executionRunId ?? undefined,
      originSummary: {
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        nativeStatus: status,
        sourceTable: 'presentation_decks',
        ...(params.originSummary ?? {}),
      },
    });
    if (!artifact) throw new Error('native_deck_artifact_registration_failed');
    registryArtifactId = artifact.artifactId;
  }

  return { deckId, deck, slideCount, registryArtifactId };
}

export interface CreateNativeDeckVersionResult {
  versionId: string;
  version: number;
}

/**
 * U02 — write the immutable version row for a native deck.
 *
 * Unlike the autosave path in `presentations.routes.ts` this is NOT wrapped in
 * a swallowing try/catch: for a governed publication a missing version row is a
 * failure, not an optional nicety. The `(deck_id, version)` uniqueness added by
 * `20260810_t01_u02_native_final_outputs.sql` makes a duplicate fail closed.
 */
export async function createNativeDeckVersion(params: {
  deckId: string;
  organizationId: string;
  version: number;
  deck: DeckDocument;
  slideCount: number;
  createdBy: string;
  createdAt: string;
}): Promise<CreateNativeDeckVersionResult> {
  const owner = await dbGet<{ id: string }>(
    `SELECT id FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [params.deckId, params.organizationId]
  );
  if (!owner) throw new Error('native_deck_version_owner_not_found');

  const versionId = uuidv4();
  await dbRun(
    `INSERT INTO presentation_deck_versions (
       id, deck_id, version, deck_json_snapshot, slide_count, created_by, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      params.deckId,
      params.version,
      JSON.stringify(params.deck),
      params.slideCount,
      params.createdBy,
      params.createdAt,
    ]
  );
  return { versionId, version: params.version };
}

/**
 * K5 (decyzja właściciela 07-19) — poziom szczegółowości generacji artefaktu.
 * Ta sama prezentacja może powstać na trzech poziomach głębokości/ilości treści:
 *   'short'  — krótka   (mniej slajdów w blank-brief arc + lżejsza gęstość treści)
 *   'medium' — średnia  (== dzisiejsze, bazowe zachowanie)
 *   'full'   — pełna    (gęstsza treść / więcej materiału per slajd)
 * Brak wartości === 'medium' (pełna kompatybilność wsteczna: output identyczny jak dziś).
 */
export type DeckDetailLevel = 'short' | 'medium' | 'full';

export interface DeckSetup {
  title: string;
  templateId?: string;
  audience: 'sponsor' | 'executive' | 'investor' | 'internal';
  goal: 'inform' | 'decide' | 'sell' | 'align';
  language: 'en' | 'pl';
  theme: 'corporate' | 'minimal' | 'modern';
  confidentiality: 'confidential' | 'internal' | 'public';
  brandColor?: string;
  sourceArtifacts: SourceArtifact[];

  /** V3-A01: Traceability — canonical source of this deck */
  sourceType?: string;
  sourceId?: string;

  /**
   * Gamma-like visuals for PPTX.
   * - `enabled`: whether to attempt AI image generation (safe to enable even without keys; falls back).
   * - `priority`: explicit user preference: quality vs cost.
   */
  visuals?: {
    enabled?: boolean;
    priority?: 'quality' | 'cost';
    /** Controls how many images we attempt to generate per deck. */
    imageDensity?: 'low' | 'medium' | 'high';
  };
  sourcePack?: Record<string, unknown>;
  sourcePackStrict?: boolean;

  /**
   * K5 — poziom szczegółowości ('short' | 'medium' | 'full'). Opcjonalny.
   * Brak === 'medium' (dzisiejsze zachowanie). Sterowany z endpointu
   * `/generate/outline` (setup = req.body), więc `level` w body wystarczy.
   */
  level?: DeckDetailLevel;

  /**
   * Wolny tekst prośby z czatu (Teresa) — TEMAT/brief, NIE źródło faktów (audyt
   * 2026-07-22). Gdy obecny i brak „rich" sourceArtifacts (ścieżka czatu), wchodzi
   * do Narrative Engine jako `user_instruction`, żeby treść slajdów była o temacie,
   * a nie generyczna. Anty-fabrykacja (post_check) i tak odrzuci zmyślone liczby →
   * spada na deterministyczny szablon. Kreator (ze źródłami) tego nie ustawia
   * (zod w DeckSetupSchema ścina nieznane pola), więc zero regresji.
   */
  brief?: string;
}

export interface SourceArtifact {
  type:
    | 'initiative_portfolio'
    | 'execution_status'
    | 'raid'
    | 'kpi_roi'
    | 'assessment'
    | 'tool_session'
    | 'report'
    | 'valuation'
    | 'financial_analysis'
    | 'interview_study'
    | 'insight_pack'
    | 'decision_pack'
    | 'workspace'
    | 'custom';
  id?: string;
  artifactId?: string;
  label: string;
  confidence?: number;
  readiness?:
    'ready' | 'partial_ready' | 'missing_sales_data' | 'policy_blocked' | 'insufficient_evidence';
  lineage?: {
    runtime?: string;
    recordId?: string;
    family?: string;
  };
  data?: any;
}

export interface OutlineItem {
  intent: SlideIntent;
  title: string;
  keyMessage?: string;
  enabled: boolean;
  sourceRef?: string;
  sourceRefs?: string[];
  confidence?: number;
  density?: 'visual' | 'balanced' | 'document';
  /**
   * Sprint S12 — per-slot density override. When present, the layout
   * audit resolves capacity caps per-slot rather than routing the entire
   * slide through one `density`. Closes R-S10-2. Backward compatible:
   * omitted slots fall back to `density` (which itself falls back to
   * 'balanced' inside the audit).
   */
  slotDensities?: {
    title?: 'visual' | 'balanced' | 'document';
    keyMessage?: 'visual' | 'balanced' | 'document';
    blocks?: 'visual' | 'balanced' | 'document';
  };
  visualPolicy?: string;
  layoutHint?: string;
  suggestedBlocks?: string[];
  notesPolicy?: 'none' | 'light' | 'standard' | 'speaker_heavy';
  warnings?: string[];
  /**
   * FALA D (2026-07-26) — per-slide briefing drafted by the Template Architect
   * (presentationTemplateDraftService.ts `PresentationTemplateOutlineItem`).
   * `dataNeeded`/`suggestedVisual` used to be dropped by
   * `buildTemplateRuntimeFromRow` before reaching this type; now carried
   * through end-to-end so `generateDeck` can fold `dataNeeded` into the
   * Narrative Engine directive (see `buildTemplateBriefingInstruction`).
   * `keyMessage` above already served as the deterministic-template headline
   * fallback — these are additive, template-only, LLM-drafted hints, never
   * facts. `suggestedVisual` is intentionally NOT wired into layout selection
   * yet — see the comment on `buildTemplateRuntimeFromRow`'s outline mapping
   * for why (it's free text, `layoutHint`/`layoutFamily` is a closed
   * vocabulary consumed by rendering).
   */
  dataNeeded?: string[];
  suggestedVisual?: string;
}

/**
 * A4 (2026-07-23, sesja "deck-quality-surface") — kształt nie-blokujących
 * sygnałów jakości (Critic kompozycji + M19 walidacja strukturalna),
 * dotąd liczonych ale gubionych po drodze do odpowiedzi API (patrz
 * `deckQualityGates` w `generateDeck`). Wydzielone jako typ, by FE
 * (ResultStep/DeckBuilder) mogło pokazać badge/banner bez zgadywania kształtu.
 */
export interface DeckQualityGatesSummary {
  critic: { overallScore: number; regenerateSlides: number[]; passed: boolean };
  structural: { valid: boolean; errorCount: number; warningCount: number };
}

export interface GenerationResult {
  deckId: string;
  slideCount: number;
  warnings: string[];
  exportPath?: string;
  /** HP-16: realny EvidenceContract — patrz `buildDeckEvidenceContract`. */
  evidence?: EvidenceContract;
  /**
   * A4: nie-blokujące sygnały jakości (Critic + M19), gdy
   * ENABLE_DECK_QUALITY_GATES !== 'false'. Addytywne — brak pola = bramki
   * pominięte (flaga OFF lub błąd fail-open), FE traktuje jako "brak sygnału",
   * NIGDY jako błąd.
   */
  qualityGates?: DeckQualityGatesSummary;
}

/**
 * HP-16: buduje `EvidenceContract` decka — DETERMINISTYCZNIE, zero LLM, zero I/O.
 * REUŻYWA sygnały już policzone przez pipeline (nie liczy drugiego zestawu):
 *   - `sources` = `sourceRefs` (mapowanie 1:1 `setup.sourceArtifacts` → artifact_id/type/label,
 *     dokładnie to, co poszło do `buildContextPack`).
 *   - `qualityScore` = `contextPack.metadata.confidence_score` (0..1, ContextPackBuilder
 *     odejmuje 0.1 za każdy zdegradowany/brakujący input — realny licznik, nie zgadywanie).
 *   - `unresolvedGaps` = źródła ze statusem `insufficient_evidence`/`missing_sales_data`/
 *     `policy_blocked` + `sourcePackPreflight.missingInputs` (te same sygnały już blokujące
 *     `source_pack_preflight_failed` wyżej w pipeline).
 * `risks`/`toVerify` cytują te same realne braki — nie zgadywanie modelu.
 */
export function buildDeckEvidenceContract(
  sourceRefs: Array<{
    artifact_id: string;
    artifact_type: string;
    artifact_name: string;
    confidence: number | null;
    readiness: string;
    lineage: unknown;
  }>,
  contextPack: ContextPack,
  sourcePackPreflight: { missingInputs: string[]; warnings: string[] },
  narrativePlanWarnings: string[] = []
): EvidenceContract {
  const sources: EvidenceContractSource[] = sourceRefs
    .filter((r) => r.artifact_id)
    .map((r) => ({ type: r.artifact_type, ref: r.artifact_id, title: r.artifact_name }));

  const risks: string[] = [];
  const degradedReadiness = new Set([
    'insufficient_evidence',
    'missing_sales_data',
    'policy_blocked',
  ]);
  const degradedSources = sourceRefs.filter((r) => degradedReadiness.has(r.readiness));
  degradedSources.forEach((r) =>
    risks.push(`Źródło "${r.artifact_name}" ma status ${r.readiness} — dane niepełne/zablokowane.`)
  );

  const toVerify: string[] = [
    ...sourcePackPreflight.missingInputs.map((m) => `Brakujący input źródła: ${m}`),
    ...sourcePackPreflight.warnings,
    ...narrativePlanWarnings,
  ];

  const qualityScore = Math.round(
    Math.max(0, Math.min(1, contextPack?.metadata?.confidence_score ?? 1)) * 100
  );

  const confidence = deriveConfidence({
    sourceCount: sources.length,
    unresolvedGaps: degradedSources.length + sourcePackPreflight.missingInputs.length,
    qualityScore,
  });

  return { sources, assumptions: [], risks, confidence, toVerify };
}

// ============================================================
// OUTLINE GENERATORS (per deck type / template)
// ============================================================

function generateOutlineFromTemplate(
  templateOutline: OutlineItem[],
  sources: SourceArtifact[]
): OutlineItem[] {
  const outline = templateOutline.map((item) => ({ ...item, enabled: true }));

  const hasKpi = sources.some((s) => s.type === 'kpi_roi');
  const hasRaid = sources.some((s) => s.type === 'raid');
  const hasAssessment = sources.some((s) => s.type === 'assessment');

  if (!hasKpi) {
    outline.forEach((o) => {
      if (o.intent === 'performance_overview' && !o.sourceRef) o.enabled = false;
    });
  }
  if (!hasRaid) {
    outline.forEach((o) => {
      if (o.intent === 'risk_management' && !o.sourceRef) o.enabled = false;
    });
  }
  if (!hasAssessment) {
    outline.forEach((o) => {
      if (o.intent === 'assessment' && !o.sourceRef) o.enabled = false;
    });
  }

  // Sprint S14: fill in slide-level density + per-slot density defaults
  // for any item that didn't already declare them. Caller-provided
  // values are preserved verbatim. Closes the consumer side of R-S12-1.
  return outline.map(applyIntentDensityDefaults);
}

export function generateDefaultOutline(setup: DeckSetup): OutlineItem[] {
  const items: OutlineItem[] = [
    { intent: 'cover', title: setup.title, enabled: true },
    {
      intent: 'executive_summary',
      title: setup.language === 'pl' ? 'Podsumowanie' : 'Executive Summary',
      enabled: true,
    },
    {
      intent: 'key_messages',
      title: setup.language === 'pl' ? 'Kluczowe wnioski' : 'Key Messages',
      enabled: true,
    },
  ];

  // Blank-brief (no source artifacts): a 4-slide stub (cover/exec/key/next) is
  // too thin for a consulting-grade deck. Lay down the standard narrative arc
  // — problem → approach → findings → recommendations → roadmap → risks — with
  // sensible per-slide key messages so downstream content-gen has real anchors
  // (not "Key message for X" placeholders). When sources ARE present, the
  // source-driven slides below carry the analytical narrative instead.
  const pl = setup.language === 'pl';
  // "Rich" sources drive the analytical slides below. A deck whose only source is
  // the synthetic `custom` placeholder (injected by the V8 materialize path when
  // no real artifact exists) is effectively a blank-brief narrative deck — so the
  // arc must fire on "no rich source", not merely "no source at all".
  const RICH_SOURCE_TYPES = new Set([
    'initiative_portfolio',
    'execution_status',
    'kpi_roi',
    'raid',
    'assessment',
    'tool_session',
  ]);
  const hasRichSource =
    Array.isArray(setup.sourceArtifacts) &&
    setup.sourceArtifacts.some((s) => RICH_SOURCE_TYPES.has(String((s as any).type)));
  if (!hasRichSource) {
    const arc: OutlineItem[] = [
      {
        intent: 'root_cause',
        title: pl ? 'Problem i kontekst' : 'Problem & Context',
        keyMessage: pl
          ? 'Jaki problem rozwiązujemy i dlaczego teraz'
          : 'The problem we solve and why now',
        enabled: true,
      },
      {
        intent: 'single_insight',
        title: pl ? 'Podejście i metodyka' : 'Approach & Methodology',
        keyMessage: pl ? 'Jak podchodzimy do problemu' : 'How we approach the problem',
        enabled: true,
      },
      {
        intent: 'performance_overview',
        title: pl ? 'Wyniki i analiza' : 'Findings & Analysis',
        keyMessage: pl ? 'Co pokazują dane i analiza' : 'What the data and analysis show',
        enabled: true,
      },
      {
        intent: 'recommendation_portfolio',
        title: pl ? 'Rekomendacje' : 'Recommendations',
        keyMessage: pl ? 'Co rekomendujemy i dlaczego' : 'What we recommend and why',
        enabled: true,
      },
      {
        intent: 'roadmap',
        title: pl ? 'Roadmapa wdrożenia' : 'Implementation Roadmap',
        keyMessage: pl ? 'Plan realizacji w czasie' : 'Phased execution plan',
        enabled: true,
      },
      {
        intent: 'risk_management',
        title: pl ? 'Ryzyka i mitygacje' : 'Risks & Mitigations',
        keyMessage: pl
          ? 'Kluczowe ryzyka i plan ich ograniczenia'
          : 'Key risks and how we mitigate them',
        enabled: true,
      },
    ];
    // K5 — poziom 'short' skraca łuk narracyjny do rdzenia (problem → podejście →
    // wyniki → rekomendacje), pomijając roadmapę i szczegółowe ryzyka. 'medium'/'full'
    // oraz brak poziomu → pełny 6-slajdowy łuk (zachowanie dzisiejsze).
    const arcForLevel = setup.level === 'short' ? arc.slice(0, 4) : arc;
    items.push(...arcForLevel);
  }

  const sourceArtifactsForLoop = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];
  for (const source of sourceArtifactsForLoop) {
    switch (source.type) {
      case 'initiative_portfolio':
        items.push({
          intent: 'initiative_portfolio',
          title: setup.language === 'pl' ? 'Portfel inicjatyw' : 'Initiative Portfolio',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'execution_status':
        items.push({
          intent: 'roadmap',
          title: setup.language === 'pl' ? 'Plan realizacji' : 'Execution Roadmap',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'kpi_roi':
        items.push({
          intent: 'performance_overview',
          title: setup.language === 'pl' ? 'KPI i ROI' : 'KPI & ROI Overview',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'raid':
        items.push({
          intent: 'risk_management',
          title: setup.language === 'pl' ? 'Ryzyka i mitygacje' : 'Risks & Mitigations',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'assessment':
        items.push({
          intent: 'assessment',
          title: setup.language === 'pl' ? 'Wyniki oceny' : 'Assessment Results',
          enabled: true,
          sourceRef: source.id,
        });
        items.push({
          intent: 'comparison',
          title: setup.language === 'pl' ? 'Analiza luk' : 'Gap Analysis',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'tool_session':
        items.push({
          intent: 'single_insight',
          title: source.label || 'Tool Insight',
          enabled: true,
          sourceRef: source.id,
        });
        break;
    }
  }

  items.push({
    intent: 'next_steps',
    title: setup.language === 'pl' ? 'Kolejne kroki' : 'Next Steps',
    enabled: true,
  });

  if (setup.confidentiality === 'confidential' || setup.goal === 'sell') {
    items.push({
      intent: 'appendix',
      title: setup.language === 'pl' ? 'Zastrzeżenia' : 'Disclaimers & Methodology',
      enabled: true,
    });
  }

  // Sprint S14: enrich with intent-driven density defaults so the layout
  // audit can reason about per-slot capacities (e.g. comparison hero
  // titles vs dense bullet cells) without forcing every caller to set
  // the densities explicitly. See `presentationStudioIntentDensityDefaultsService`.
  return items.map(applyIntentDensityDefaults);
}

/**
 * K5 — nakłada globalną gęstość treści wynikającą z poziomu szczegółowości.
 * Działa na KAŻDEJ ścieżce outline (default, template, template-family), bo
 * wołane jest w `generateOutline` po zbudowaniu i zaplanowaniu slajdów.
 *   'short'  → 'visual'   (mniej tekstu per slajd)
 *   'full'   → 'document' (więcej tekstu per slajd)
 *   'medium' / brak → outline NIETKNIĘTY (kompatybilność wsteczna — dziś).
 * Poziom jest globalnym nadpisaniem: świadomie wygrywa z gęstością z intent-defaults.
 */
export function applyDeckDetailLevel(
  outline: OutlineItem[],
  level: DeckDetailLevel | undefined
): OutlineItem[] {
  if (level !== 'short' && level !== 'full') return outline;
  const density: OutlineItem['density'] = level === 'short' ? 'visual' : 'document';
  return outline.map((item) => ({ ...item, density }));
}

function getSourceKey(source: SourceArtifact): string {
  return String(source.artifactId || source.id || source.type);
}

function outlineSourceRefs(item: OutlineItem, setup: DeckSetup) {
  const selected = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];
  const ids = new Set<string>([
    ...(Array.isArray(item.sourceRefs) ? item.sourceRefs : []),
    ...(item.sourceRef ? [item.sourceRef] : []),
  ]);
  const matched =
    selected.find((source) => ids.has(getSourceKey(source))) ||
    selected.find((source) => item.title.toLowerCase().includes(source.type.replace(/_/g, ' '))) ||
    selected[0];
  const refs = matched ? [matched] : [];
  return refs.map((source) => ({
    artifact_id: source.artifactId || source.id || source.type,
    artifact_type: source.type,
    artifact_name: source.label || source.type,
    confidence: source.confidence ?? item.confidence ?? null,
    readiness: source.readiness || 'ready',
    freshness_days:
      typeof (source.data as any)?.freshness_days === 'number'
        ? Number((source.data as any).freshness_days)
        : typeof (source.data as any)?.freshnessDays === 'number'
          ? Number((source.data as any).freshnessDays)
          : null,
    captured_at: (source.data as any)?.captured_at || (source.data as any)?.capturedAt || null,
    lineage: source.lineage || null,
  }));
}

function attachSlideGovernance(
  slide: UnifiedSlide,
  item: OutlineItem,
  setup: DeckSetup
): UnifiedSlide {
  const sourceRefs = outlineSourceRefs(item, setup);
  return {
    ...slide,
    key_message: String(slide.key_message || item.keyMessage || item.title)
      .split(/\s+/)
      .slice(0, 14)
      .join(' '),
    ...(sourceRefs.length ? { source_refs: sourceRefs } : {}),
    ...(item.layoutHint ? { layout_hint: item.layoutHint } : {}),
    ...(item.visualPolicy ? { visual_policy: item.visualPolicy } : {}),
    ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
    ...(item.notesPolicy && item.notesPolicy !== 'none'
      ? { speaker_notes: `${item.title}: ${item.keyMessage || slide.key_message || ''}` }
      : {}),
  } as UnifiedSlide;
}

function getStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item)).filter(Boolean);
}

const ENCODING_REPAIRS: Array<[RegExp, string]> = [
  [/&amp;/g, '&'],
  [/&nbsp;/g, ' '],
  [/â€™/g, "'"],
  [/â€“/g, '-'],
  [/â€œ/g, '"'],
  [/â€\u009d/g, '"'],
  [/�/g, ''],
];

function sanitizePrimitiveText(text: string): string {
  let cleaned = String(text || '');
  for (const [pattern, replacement] of ENCODING_REPAIRS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  cleaned = cleaned.replace(/\[object Object\]/gi, '').trim();
  return cleaned;
}

/**
 * Deck-quality polish (mirrors docGenerationRuntime.polishMarkdownForCanvas):
 * slide blocks render as PLAIN text, so internal/markdown tokens emitted by the
 * LLM layers must never reach storage. Cleans:
 *  - `## `/`### ` markdown heading markers leaking into body text (marker
 *    stripped, text kept — block structure already carries the heading),
 *  - `[Fact: <label>]` provenance markers from the Narrative Engine
 *    (internal id labels are removed; if the bracket wraps real prose, the
 *    prose survives),
 *  - `**bold**` / `` `code` `` markers (noise in plain-text slide blocks),
 *  - `Data gap:` internal placeholder prefix → human phrasing in deck language.
 */
function polishDeckText(text: string, language: 'pl' | 'en' = 'en'): string {
  let out = sanitizePrimitiveText(text);
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  out = out.replace(/\s*\[Fact:\s*([^\]]*)\]/gi, (_match, inner: string) => {
    const trimmed = String(inner || '').trim();
    // Internal id labels (fact_kp_3, kp-12, …) carry no reader value — drop.
    if (!trimmed || /^[\w.-]+$/.test(trimmed)) return '';
    return ` ${trimmed}`;
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  out = out.replace(/`([^`\n]+)`/g, '$1');
  const gapLabel = language === 'pl' ? 'Do uzupełnienia' : 'To be completed';
  out = out.replace(/^(\s*)Data gap:\s*/gim, `$1${gapLabel}: `);
  if (/^data gap$/i.test(out.trim())) out = gapLabel;
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

function sanitizeSlideContentValue(value: unknown, language: 'pl' | 'en' = 'en'): unknown {
  if (typeof value === 'string') return polishDeckText(value, language);
  if (Array.isArray(value)) return value.map((entry) => sanitizeSlideContentValue(entry, language));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = sanitizeSlideContentValue(nested, language);
    }
    return output;
  }
  return value;
}

// ============================================================
// SLIDE CONTENT GENERATORS
// ============================================================

function buildSlideContentBase(
  item: OutlineItem,
  setup: DeckSetup,
  artifactData: Record<string, any>
): UnifiedSlide {
  const isPl = setup.language === 'pl';

  switch (item.intent) {
    case 'cover':
      return {
        intent: 'cover',
        key_message: item.title,
        content: {
          type: 'cover',
          title: item.title,
          subtitle: item.keyMessage || (isPl ? 'Przegląd strategiczny' : 'Strategic Review'),
          organization: artifactData._orgName || 'Organization',
          date: new Date().toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
            year: 'numeric',
            month: 'long',
          }),
          confidentiality: setup.confidentiality,
        },
      };

    case 'executive_summary':
      return {
        intent: 'executive_summary',
        key_message:
          item.keyMessage || (isPl ? 'Podsumowanie kluczowych ustaleń' : 'Summary of key findings'),
        content: {
          type: 'executive_summary',
          headline: item.keyMessage || (isPl ? 'Podsumowanie' : 'Executive Summary'),
          key_findings: artifactData._keyFindings || [
            isPl
              ? 'Dane zostaną uzupełnione na podstawie wybranych źródeł'
              : 'Data will be populated from selected sources',
          ],
          kpis: artifactData._kpis || [],
          recommendation: artifactData._recommendation,
        },
      };

    case 'key_messages':
      return {
        intent: 'key_messages',
        key_message: item.keyMessage || (isPl ? 'Kluczowe wnioski' : 'Key Messages'),
        content: {
          type: 'key_messages',
          messages: artifactData._keyMessages || [
            {
              title: isPl ? 'Wniosek 1' : 'Finding 1',
              description: isPl
                ? 'Evidence gap: brak kompletnego materiału źródłowego (owner danych: PMO).'
                : 'Evidence gap: complete source material is missing (data owner: PMO).',
            },
            {
              title: isPl ? 'Wniosek 2' : 'Finding 2',
              description: isPl
                ? 'Evidence gap: brak kompletnego materiału źródłowego (owner danych: PMO).'
                : 'Evidence gap: complete source material is missing (data owner: PMO).',
            },
            {
              title: isPl ? 'Wniosek 3' : 'Finding 3',
              description: isPl
                ? 'Evidence gap: brak kompletnego materiału źródłowego (owner danych: PMO).'
                : 'Evidence gap: complete source material is missing (data owner: PMO).',
            },
          ],
        },
      };

    case 'initiative_portfolio':
      return {
        intent: 'initiative_portfolio',
        key_message:
          item.keyMessage || (isPl ? 'Status portfela inicjatyw' : 'Initiative portfolio status'),
        content: {
          type: 'initiative_portfolio',
          initiatives: artifactData._initiatives || [],
        },
      };

    case 'performance_overview':
      return {
        intent: 'performance_overview',
        key_message:
          item.keyMessage ||
          (isPl ? 'Przegląd kluczowych wskaźników' : 'Key performance indicators overview'),
        content: {
          type: 'performance_overview',
          kpis: artifactData._performanceKpis || [],
          period: artifactData._period || 'Current',
        },
      };

    case 'roadmap':
      return {
        intent: 'roadmap',
        key_message: item.keyMessage || (isPl ? 'Plan transformacji' : 'Transformation roadmap'),
        content: {
          type: 'roadmap',
          phases: artifactData._phases || [
            {
              label: isPl ? 'Faza 1: Quick Wins' : 'Phase 1: Quick Wins',
              timeframe: '0-3m',
              items: [],
            },
            {
              label: isPl ? 'Faza 2: Optymalizacja' : 'Phase 2: Optimization',
              timeframe: '3-6m',
              items: [],
            },
            {
              label: isPl ? 'Faza 3: Skalowanie' : 'Phase 3: Scale',
              timeframe: '6-12m',
              items: [],
            },
          ],
        },
      };

    case 'risk_management':
      return {
        intent: 'risk_management',
        key_message:
          item.keyMessage || (isPl ? 'Kluczowe ryzyka i mitygacje' : 'Key risks and mitigations'),
        content: {
          type: 'risk_management',
          risks: (artifactData._risks || []).map((risk: any) => ({
            risk: risk.risk || risk.title || risk.description || 'Risk',
            likelihood: String(risk.likelihood || risk.probability || 'medium').toLowerCase(),
            impact: String(risk.impact || 'medium').toLowerCase(),
            mitigation: risk.mitigation || risk.strategy || 'Define mitigation owner',
            owner: risk.owner,
          })),
        },
      };

    case 'assessment':
      return {
        intent: 'assessment',
        key_message:
          item.keyMessage || (isPl ? 'Wyniki oceny dojrzałości' : 'Maturity assessment results'),
        content: {
          type: 'assessment',
          matrix_type: 'maturity',
          axes: [],
          scale_max: artifactData._maxScore || 5,
          overall_score: artifactData._overallScore || 0,
        },
      };

    case 'comparison':
      return {
        intent: 'comparison',
        key_message: item.keyMessage || (isPl ? 'Analiza porównawcza' : 'Comparative analysis'),
        content: {
          type: 'comparison',
          left_label: isPl ? 'Opcja A' : 'Option A',
          right_label: isPl ? 'Opcja B' : 'Option B',
          left_items: (artifactData._comparisonItems || []).map((i: any) => String(i?.left || i)),
          right_items: (artifactData._comparisonItems || []).map((i: any) => String(i?.right || i)),
        },
      };

    case 'section_intro':
      return {
        intent: 'section_intro',
        key_message: item.keyMessage || item.title,
        content: {
          type: 'section_intro',
          section_title: item.title,
          section_number: Number((item as any).orderIndex || 0) + 1,
          description:
            item.keyMessage ||
            (isPl
              ? 'Sekcja decku oparta na wybranych źródłach.'
              : 'Deck section grounded in selected sources.'),
        },
      };

    case 'single_insight':
      return {
        intent: 'single_insight',
        key_message: item.keyMessage || artifactData._toolInsight?.summary || item.title,
        content: {
          type: 'single_insight',
          chart_type: 'bar',
          chart_data: artifactData._insightChart || {
            labels: getStringList(artifactData._categories, ['Current', 'Target']).slice(0, 5),
            series: [
              {
                name: isPl ? 'Wynik' : 'Score',
                values: [
                  Number(artifactData._overallScore || 3),
                  Number(artifactData._maxScore || 5),
                ],
              },
            ],
          },
          insight_text:
            artifactData._toolInsight?.summary ||
            item.keyMessage ||
            (isPl
              ? 'Wniosek częściowo ugruntowany: wymagane dodatkowe potwierdzenie źródłowe.'
              : 'Insight is partially grounded: additional source confirmation required.'),
          source: item.sourceRef || artifactData._framework || 'Consultify evidence',
        },
      };

    case 'recommendation_portfolio':
      return {
        intent: 'recommendation_portfolio',
        key_message:
          item.keyMessage ||
          (isPl
            ? 'Rekomendacje wynikające z diagnozy'
            : 'Recommendations derived from the diagnostic'),
        content: {
          type: 'recommendation_portfolio',
          recommendations:
            artifactData._recommendations ||
            (artifactData._initiatives || []).slice(0, 6).map((initiative: any) => ({
              title: initiative.name,
              description: initiative.summary || initiative.status || '',
              impact: String(
                initiative.impact ||
                  initiative.roi ||
                  (isPl ? 'Do uzupełnienia' : 'To be confirmed')
              ),
              priority: String(initiative.priority || 'medium').toLowerCase(),
              category: initiative.axis || initiative.category,
            })) ||
            [],
        },
      };

    case 'recommendation_single':
      return {
        intent: 'recommendation_single',
        key_message: item.keyMessage || item.title,
        content: {
          type: 'recommendation_single',
          title: item.title,
          description:
            item.keyMessage ||
            (isPl
              ? 'Rekomendacja oparta na wybranym materiale.'
              : 'Recommendation grounded in selected evidence.'),
          impact: artifactData._recommendationImpact || 'High',
          effort: artifactData._recommendationEffort || 'Medium',
          priority: 'high',
          timeline: artifactData._recommendationTimeline || '30-90 days',
        },
      };

    case 'prioritization_matrix':
      return {
        intent: 'prioritization_matrix',
        key_message:
          item.keyMessage || (isPl ? 'Priorytetyzacja inicjatyw' : 'Initiative prioritization'),
        content: {
          type: 'prioritization_matrix',
          xAxisLabel: isPl ? 'Wysiłek' : 'Effort',
          yAxisLabel: isPl ? 'Wpływ' : 'Impact',
          quadrants: artifactData._prioritizationQuadrants || [
            { label: 'Quick wins', position: 'top_left', items: [] },
            { label: 'Strategic bets', position: 'top_right', items: [] },
            { label: 'Fill-ins', position: 'bottom_left', items: [] },
            { label: 'Defer', position: 'bottom_right', items: [] },
          ],
        },
      };

    case 'root_cause':
      return {
        intent: 'root_cause',
        key_message: item.keyMessage || (isPl ? 'Źródła problemu' : 'Root causes'),
        content: {
          type: 'root_cause',
          problem: item.title,
          causes: (
            artifactData._rootCauses || [
              {
                cause: isPl ? 'Niedojrzałość procesu' : 'Process maturity gap',
                impact: isPl ? 'Wolniejsze decyzje' : 'Slower decisions',
                severity: 'medium',
              },
            ]
          ).slice(0, 5),
        },
      };

    case 'next_steps':
      return {
        intent: 'next_steps',
        key_message:
          item.keyMessage ||
          (isPl ? 'Kolejne kroki i decyzje' : 'Next steps and decisions required'),
        content: {
          type: 'next_steps',
          actions: artifactData._actions || [
            {
              action: isPl ? 'Zdefiniować priorytety' : 'Define priorities',
              owner: isPl ? 'Do ustalenia przez PMO' : 'To be assigned by PMO',
              deadline: isPl
                ? 'Do potwierdzenia w planie programu'
                : 'To be confirmed in program plan',
            },
            {
              action: isPl ? 'Zatwierdzić roadmapę' : 'Approve roadmap',
              owner: isPl ? 'Do ustalenia przez Sponsor Board' : 'To be assigned by Sponsor Board',
              deadline: isPl
                ? 'Do potwierdzenia w planie programu'
                : 'To be confirmed in program plan',
            },
          ],
        },
      };

    case 'appendix':
      return {
        intent: 'appendix',
        key_message: 'Disclaimers & Methodology',
        content: {
          type: 'appendix',
          title: isPl ? 'Zastrzeżenia i metodologia' : 'Disclaimers & Methodology',
          body: isPl
            ? 'Niniejsza prezentacja została wygenerowana automatycznie na bazie danych z platformy. Wszystkie liczby oparte na zadeklarowanych założeniach.'
            : 'This presentation was auto-generated from platform data. All figures are based on stated assumptions.',
        },
      };

    default:
      return {
        intent: item.intent,
        key_message: item.keyMessage || item.title,
        content: {
          type: 'section_intro',
          section_name: item.title,
          section_number: 0,
        } as any,
      };
  }
}

function buildSlideContent(
  item: OutlineItem,
  setup: DeckSetup,
  artifactData: Record<string, any>
): UnifiedSlide {
  const hasDataGapFallback = (item.suggestedBlocks || []).includes('data_gap_notice');
  const baseSlide = hasDataGapFallback
    ? ({
        intent: item.intent,
        key_message:
          setup.language === 'pl'
            ? `Data gap: ${item.title} wymaga dodatkowych źródeł`
            : `Data gap: ${item.title} requires additional evidence`,
        content: {
          type: 'section_intro',
          section_title: item.title,
          description:
            setup.language === 'pl'
              ? 'Ten slajd został wygenerowany w trybie degradacji: brak pełnych danych źródłowych. Uzupełnij evidence i właściciela danych.'
              : 'This slide is in degradation mode: complete source evidence is missing. Add evidence and data owner.',
        },
      } as UnifiedSlide)
    : buildSlideContentBase(item, setup, artifactData);
  const governed = attachSlideGovernance(baseSlide, item, setup);
  const keyMessage = polishDeckText(
    String(governed.key_message || item.title || item.intent),
    setup.language
  );
  return {
    ...governed,
    key_message:
      keyMessage.length >= 8
        ? keyMessage
        : polishDeckText(String(item.title || item.intent), setup.language),
    content: sanitizeSlideContentValue(governed.content, setup.language) as any,
  } as UnifiedSlide;
}

// ============================================================
// ARTIFACT DATA LOADER
// ============================================================

async function loadArtifactData(
  sources: SourceArtifact[],
  orgId: string
): Promise<Record<string, any>> {
  const data: Record<string, any> = {};

  try {
    const org = await dbGet(`SELECT name FROM organizations WHERE id = ?`, [orgId]);
    data._orgName = (org as any)?.name || 'Organization';
  } catch {
    data._orgName = 'Organization';
  }

  for (const source of sources) {
    try {
      switch (source.type) {
        case 'initiative_portfolio': {
          const initiatives = await dbAll(
            `SELECT id, name, status, priority, axis, progress, expected_roi FROM initiatives WHERE organization_id = ? AND status NOT IN ('CANCELLED', 'ARCHIVED') ORDER BY priority DESC LIMIT 20`,
            [orgId]
          );
          data._initiatives = ((initiatives || []) as any[]).map((i: any) => ({
            name: i.name,
            status: i.status,
            priority: i.priority,
            progress: i.progress || 0,
            roi: i.expected_roi,
          }));
          data._portfolioSummary = `${(initiatives as any[])?.length || 0} active initiatives`;
          break;
        }
        case 'kpi_roi': {
          const kpis = await dbAll(
            `SELECT name, unit, baseline_value, target_value, current_value FROM initiative_kpis WHERE organization_id = ? LIMIT 6`,
            [orgId]
          );
          data._performanceKpis = ((kpis || []) as any[]).map((k: any) => {
            const current = Number(k.current_value ?? 0);
            const target = Number(k.target_value ?? 0);
            const onTarget = target > 0 ? current >= target : current > 0;
            return {
              label: k.name,
              value: current || target || 0,
              target: k.target_value,
              unit: k.unit,
              trend: onTarget ? 'up' : 'down',
            };
          });
          data._kpis = data._performanceKpis?.slice(0, 4);
          break;
        }
        case 'raid': {
          const raidItems = await dbAll(
            `SELECT id, type, title, description, status, probability, impact, mitigation_plan, response_strategy, owner_id FROM raid_items WHERE organization_id = ? AND status NOT IN ('CLOSED', 'RESOLVED') ORDER BY impact DESC, probability DESC LIMIT 15`,
            [orgId]
          );
          data._risks = ((raidItems || []) as any[])
            .filter((r: any) => r.type === 'RISK')
            .map((r: any) => ({
              title: r.title,
              description: r.description,
              probability: r.probability || 'MEDIUM',
              impact: r.impact || 'MEDIUM',
              status: r.status,
              mitigation: r.mitigation_plan,
              strategy: r.response_strategy,
            }));
          data._raidSummary = {
            risks: ((raidItems || []) as any[]).filter((r: any) => r.type === 'RISK').length,
            assumptions: ((raidItems || []) as any[]).filter((r: any) => r.type === 'ASSUMPTION')
              .length,
            issues: ((raidItems || []) as any[]).filter((r: any) => r.type === 'ISSUE').length,
            dependencies: ((raidItems || []) as any[]).filter((r: any) => r.type === 'DEPENDENCY')
              .length,
          };
          break;
        }
        case 'execution_status': {
          const initiatives = await dbAll(
            `SELECT name, status, progress, start_date, target_end_date FROM initiatives WHERE organization_id = ? AND status IN ('IN_PROGRESS', 'ACTIVE', 'ON_TRACK', 'AT_RISK', 'DELAYED') ORDER BY target_end_date ASC LIMIT 20`,
            [orgId]
          );
          data._phases = [
            {
              name: 'In Progress',
              timeframe: 'Current',
              items: ((initiatives || []) as any[]).map((i: any) => ({
                name: i.name,
                status: i.status,
                progress: i.progress || 0,
                deadline: i.target_end_date,
              })),
            },
          ];
          data._executionSummary = `${((initiatives || []) as any[]).length} active initiatives`;
          break;
        }
        case 'tool_session': {
          if (source.id) {
            const session = await dbGet(
              `SELECT id, tool_type, name, answers_json FROM tool_sessions WHERE id = ? AND organization_id = ?`,
              [source.id, orgId]
            );
            if (session) {
              const answers = JSON.parse((session as any).answers_json || '{}');
              data._toolInsight = {
                tool: (session as any).tool_type,
                title: (session as any).name,
                findings: answers.findings || answers.insights || [],
                summary: answers.summary || answers.conclusion || '',
              };
              if (answers.key_findings) data._keyFindings = answers.key_findings;
              if (answers.recommendations) data._recommendation = answers.recommendations[0];
              if (answers.key_messages) data._keyMessages = answers.key_messages;
            }
          }
          break;
        }
        case 'assessment': {
          if (source.data?.reportId) {
            data._framework = source.data.framework || 'DRD';
            data._overallScore = source.data.overallScore || 0;
            data._maxScore = source.data.maxScore || 5;
            data._categories = source.data.categories || [];
          }
          break;
        }
        default:
          if (source.data) {
            Object.assign(data, source.data);
          }
      }
    } catch (err) {
      logger.warn(`[PresentationGen] Failed to load artifact ${source.type}: ${err}`);
    }
  }

  return data;
}

// ============================================================
// MAIN SERVICE
// ============================================================

function validateOutline(outline: OutlineItem[], setup: DeckSetup): string[] {
  const warnings: string[] = [];
  const isPl = setup.language === 'pl';
  const enabled = outline.filter((o) => o.enabled);

  if (enabled.length < 2) {
    warnings.push(
      isPl
        ? 'Outline wymaga minimum 2 kart (cover + content).'
        : 'Outline requires at least 2 cards (cover + content).'
    );
  }
  if (enabled.length > 30) {
    warnings.push(
      isPl
        ? `Outline ma ${enabled.length} kart (zalecane maks. 30). Rozważ podział na dwie prezentacje.`
        : `Outline has ${enabled.length} cards (recommended max 30). Consider splitting into two presentations.`
    );
  }

  const hasCover = enabled.some((o) => o.intent === 'cover');
  if (!hasCover) {
    warnings.push(
      isPl
        ? 'Brak karty tytułowej (cover). Dodaj ją dla profesjonalnego wyglądu.'
        : 'Missing cover card. Add one for a professional look.'
    );
  }

  const dataIntents: SlideIntent[] = [
    'performance_overview',
    'initiative_portfolio',
    'risk_management',
    'comparison',
    'assessment',
  ];
  const hasDataCard = enabled.some((o) => dataIntents.includes(o.intent));
  const validateOutlineSourceArtifacts = Array.isArray(setup.sourceArtifacts)
    ? setup.sourceArtifacts
    : [];
  const hasDataSource = validateOutlineSourceArtifacts.some((s) =>
    ['kpi_roi', 'initiative_portfolio', 'assessment', 'raid'].includes(s.type)
  );
  if (hasDataCard && !hasDataSource) {
    warnings.push(
      isPl
        ? 'Outline zawiera karty danych, ale nie wybrano źródeł danych. Dane mogą być niepełne.'
        : 'Outline contains data cards but no data sources are selected. Data may be incomplete.'
    );
  }

  const manualOrUnreadySources = validateOutlineSourceArtifacts.filter(
    (source) => !source.id || source.id.startsWith('manual-') || source.readiness !== 'ready'
  );
  if (manualOrUnreadySources.length > 0) {
    warnings.push(
      isPl
        ? 'Część źródeł nie jest konkretnym, gotowym artefaktem. Deck zostanie oznaczony jako częściowo ugruntowany.'
        : 'Some sources are not concrete ready artifacts. The deck will be marked as partially grounded.'
    );
  }

  return warnings;
}

export async function generateOutline(
  setup: DeckSetup,
  organizationId: string
): Promise<{ outline: OutlineItem[]; deckId: string; validationWarnings: string[] }> {
  let outline: OutlineItem[];
  let templateOutlineUsed = false;
  let templateRuntime: PresentationTemplateRuntime | null = null;
  let templateWarnings: string[] = [];
  let templateSlotMapping: TemplateSlotMappingResult | null = null;
  const sourceArtifacts = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];
  const sourcePackPreflight = preflightPresentationSourcePack({
    setup,
    organizationId,
    strict: Boolean(setup.sourcePackStrict),
  });

  if (setup.templateId) {
    const template = await dbGet(
      `SELECT * FROM presentation_templates WHERE id = ? AND is_active = TRUE AND (organization_id IS NULL OR organization_id = ?)`,
      [setup.templateId, organizationId]
    );
    const approvedTemplate = resolveApprovedPresentationTemplate(template);
    templateRuntime = approvedTemplate.runtime;
    const templateOutline = templateRuntime?.outline || [];
    outline = generateOutlineFromTemplate(templateOutline, sourceArtifacts);
    const templated = applyApprovedTemplateToOutline({
      outline,
      runtime: templateRuntime,
      sources: sourceArtifacts,
    });
    outline = templated.outline;
    templateSlotMapping = templated.slotMapping;
    templateWarnings = [...approvedTemplate.warnings, ...templated.warnings];
    templateOutlineUsed = true;
  } else {
    const requestedFamily = (setup as any).templateFamily || (setup as any).deckType;
    if (requestedFamily) {
      templateRuntime = buildSystemTemplateRuntime(requestedFamily);
      outline = templateRuntime.outline;
      const templated = applyTemplateRuntime({
        outline,
        runtime: templateRuntime,
        sources: sourceArtifacts,
      });
      outline = templated.outline;
      templateWarnings = templated.warnings;
      templateOutlineUsed = true;
    } else {
      outline = generateDefaultOutline(setup);
    }
  }

  const planning = planSlides({ setup, outline, templateOutlineUsed });
  outline = planning.outline;
  // K5 — globalna gęstość treści wg poziomu ('short'/'full'); 'medium'/brak = bez zmian.
  outline = applyDeckDetailLevel(outline, setup.level);
  const narrativePlan = buildPresentationNarrativePlan({
    setup,
    outline,
    sourcePack: sourcePackPreflight.sourcePack,
  });

  const deckId = uuidv4().replace(/-/g, '');
  const resolvedSourceType =
    setup.sourceType || (sourceArtifacts[0]?.type === 'tool_session' ? 'tool' : 'manual');
  const resolvedSourceId = setup.sourceId || sourceArtifacts[0]?.id || null;
  // C7 — initiative linkage: when the deck's canonical source is an initiative
  // (sourceType 'INITIATIVE'/'initiative'), carry the id into the registry so
  // the initiative detail view can list this deck under "Artefakty".
  const resolvedSourceInitiativeId =
    resolvedSourceId && String(resolvedSourceType).toLowerCase() === 'initiative'
      ? String(resolvedSourceId)
      : null;
  await dbRun(
    `INSERT INTO presentation_decks (id, organization_id, title, template_id, deck_type, audience, goal, language, confidentiality, theme, brand_kit_id, source_artifacts, outline_json, status, generated_by, source_type, source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    [
      deckId,
      organizationId,
      setup.title,
      setup.templateId || '',
      'custom',
      setup.audience,
      setup.goal,
      setup.language,
      setup.confidentiality,
      setup.theme,
      null,
      JSON.stringify(sourceArtifacts),
      JSON.stringify({
        deckIntentSummary: planning.deckIntentSummary,
        createMode: planning.createMode,
        templateRuntime: templateRuntime
          ? {
              templateId: templateRuntime.templateId,
              templateFamily: templateRuntime.templateFamily,
              minSlides: templateRuntime.minSlides,
              maxSlides: templateRuntime.maxSlides,
              mustHaveIntents: templateRuntime.mustHaveIntents,
              recommendedVisuals: templateRuntime.recommendedVisuals,
              sourceRequirements: templateRuntime.sourceRequirements,
              headerFooter: templateRuntime.headerFooter,
              customTemplate: templateRuntime.customTemplate,
            }
          : null,
        templateSlotMapping,
        outline,
        slideRecipes: planning.slideRecipes,
        sourcePriorityMap: planning.sourcePriorityMap,
        evidenceGaps: planning.evidenceGaps,
        sourcePack: sourcePackPreflight.sourcePack,
        missingInputs: sourcePackPreflight.missingInputs,
        narrativePlan,
        warnings: [
          ...planning.warnings,
          ...templateWarnings,
          ...sourcePackPreflight.warnings,
          ...narrativePlan.warnings,
        ],
      }),
      null,
      resolvedSourceType,
      resolvedSourceId,
    ]
  );

  try {
    await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: deckId,
      titleSnapshot: setup.title,
      ownerUserId: null,
      createdBy: 'system',
      deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState('draft'),
      visibilityScope: artifactRegistryService.deriveArtifactVisibilityScope({
        outputType: 'presentation',
        ownerUserId: null,
      }),
      sourceInitiativeId: resolvedSourceInitiativeId,
      originSummary: {
        sourceType: resolvedSourceType,
        sourceId: resolvedSourceId,
        sourceArtifacts,
        nativeStatus: 'draft',
        sourceTable: 'presentation_decks',
      },
    });
  } catch (err) {
    await dbRun(`DELETE FROM presentation_decks WHERE id = ? AND organization_id = ?`, [
      deckId,
      organizationId,
    ]);
    throw err;
  }

  const validationWarnings = [
    ...validateOutline(outline, setup),
    ...planning.warnings,
    ...templateWarnings,
    ...sourcePackPreflight.warnings,
    ...narrativePlan.warnings,
  ];
  if (validationWarnings.length > 0) {
    await dbRun(
      `UPDATE presentation_decks SET validation_warnings = ? WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(validationWarnings), deckId, organizationId]
    );
    logger.info(
      `[PresentationGen] Outline validation: ${validationWarnings.length} warning(s) for deck ${deckId}`
    );
  }

  return { outline, deckId, validationWarnings };
}

export async function generateDeck(
  deckId: string,
  outline: OutlineItem[],
  setup: DeckSetup,
  organizationId: string
): Promise<GenerationResult> {
  await dbRun(
    `UPDATE presentation_decks SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  );

  await artifactRegistryService.registerArtifactOrigin({
    organizationId,
    outputType: 'presentation',
    artifactFamily: 'presentation',
    originRuntime: 'presentation',
    originRecordId: deckId,
    createdBy: 'system',
    deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState('generating'),
  });

  try {
    // `generateOutline` and `generateDeck` are separate API steps and therefore
    // do not share lexical state. Resolve the selected runtime again at the
    // materialization boundary so both approved custom templates and built-in
    // template families reach deck metadata and the PPTX pipeline.
    let templateRuntime: PresentationTemplateRuntime | null = null;
    if (setup.templateId) {
      const template = await dbGet(
        `SELECT * FROM presentation_templates WHERE id = ? AND is_active = TRUE AND (organization_id IS NULL OR organization_id = ?)`,
        [setup.templateId, organizationId]
      );
      templateRuntime = resolveApprovedPresentationTemplate(template).runtime;
    } else {
      const requestedFamily = (setup as any).templateFamily || (setup as any).deckType;
      if (requestedFamily) templateRuntime = buildSystemTemplateRuntime(requestedFamily);
    }

    // Build structured ContextPack for AI consumption
    const sourceArtifacts = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];
    const sourcePackPreflight = preflightPresentationSourcePack({
      setup,
      organizationId,
      strict: Boolean(setup.sourcePackStrict),
    });
    if (!sourcePackPreflight.ok) {
      throw new Error(
        `source_pack_preflight_failed: ${sourcePackPreflight.missingInputs.join(', ') || 'blocked sources'}`
      );
    }
    const narrativePlan = buildPresentationNarrativePlan({
      setup,
      outline,
      sourcePack: sourcePackPreflight.sourcePack,
    });
    const sourceRefs = sourceArtifacts.map((sa) => ({
      artifact_id: sa.artifactId || sa.id || '',
      artifact_type: sa.type,
      artifact_name: sa.label,
      confidence: sa.confidence ?? null,
      readiness: sa.readiness || 'ready',
      lineage: sa.lineage || null,
    }));
    const contextPack = await buildContextPack(organizationId, sourceRefs, setup.language);
    await saveContextPackSnapshot(deckId, contextPack);
    logger.info(
      `[PresentationGen] ContextPack built: ${contextPack.key_points.length} key points, ${contextPack.data_points.length} data points, confidence=${contextPack.metadata.confidence_score.toFixed(2)}`
    );

    let artifactData = await loadArtifactData(sourceArtifacts, organizationId);
    // Enrich artifact data with ContextPack extracted data.
    // BUG C guardrail: strip any layout/template-inventory strings that may have leaked into
    // key_points (from older snapshots or other paths) so template names can never become
    // slide content. Template inventory now lives in metadata.template_inventory.
    const contentKeyPoints = contextPack.key_points.filter((kp) => !isTemplateInventoryLeak(kp));
    if (contentKeyPoints.length > 0 && !artifactData._keyFindings) {
      artifactData._keyFindings = contentKeyPoints.slice(0, 5);
    }
    if (contextPack.data_points.length > 0 && !artifactData._kpis) {
      artifactData._kpis = contextPack.data_points.slice(0, 4).map((dp) => ({
        label: dp.label,
        value: dp.value,
        unit: dp.unit,
        trend: dp.trend,
      }));
    }
    const transformationPack = buildTransformationReadDeckPack({
      contextPack,
      artifactData,
      sources: sourceArtifacts,
      language: setup.language,
    });
    artifactData = applyTransformationPackToArtifactData(artifactData, transformationPack);

    // ------------------------------------------------------------
    // Fala A3 (2026-07-22 live-verify): deck Z CZATU bez źródeł DALEJ pisał
    // „Brak dostępnych danych…" mimo wzmocnionego user_instruction — silnik
    // ramuje instrukcję autora jako podrzędną wobec reguł anty-fabrykacji, więc
    // przy ZERO faktach domyślnie wybiera „insufficient data". OBEJŚCIE (wzorzec
    // Word `documentBlockProseGenerator`): dla ścieżki czatu generujemy realny
    // content-pack z TEMATU osobnym, bezpośrednim wywołaniem LLM (własny prompt
    // strojony pod brak źródeł, znaczniki „(założenie)", zero post_check) i
    // ZASILAMY nim artifactData PRZED budową slajdów — nadpisuje placeholdery
    // „evidence required" z transformationReadDeckPack. Fail-soft: pack=null →
    // dotychczasowe zachowanie (kanał autorski niżej). NIE ruszamy silnika.
    let deckBriefPackApplied = false;
    const briefForPack = resolveDeckNarrativeBrief(setup) ?? '';
    if (briefForPack.length > 0) {
      const pack = await generateDeckBriefContentPack({
        brief: briefForPack,
        language: setup.language,
        title: setup.title,
        audience: setup.audience,
        goal: setup.goal,
      });
      if (pack) {
        artifactData = { ...artifactData, ...pack };
        deckBriefPackApplied = true;
        logger.info(
          '[PresentationGen] deck brief content-pack applied — slides grounded in topic (chat path, engine bypass)'
        );
      }
    }

    const enabledSlides = outline.filter((o) => o.enabled);

    const slides: UnifiedSlide[] = enabledSlides.map((item) =>
      buildSlideContent(item, setup, artifactData)
    );

    let brandColor = setup.brandColor;
    if (!brandColor) {
      const brandKit = await dbGet(
        `SELECT primary_color FROM brand_kits WHERE organization_id = ?`,
        [organizationId]
      );
      if (brandKit) brandColor = (brandKit as any).primary_color;
    }

    const meta: UnifiedReportMeta = {
      client: artifactData._orgName || 'Organization',
      project: setup.title,
      date: new Date().toISOString().slice(0, 10),
      author: 'Consultify',
      confidentiality: setup.confidentiality,
      language: setup.language,
      brandColor,
      template: setup.theme,
      customTemplate: templateRuntime?.customTemplate,
      templateId: templateRuntime?.templateId,
      templateVersion: templateRuntime?.customTemplate?.version,
    };

    const extraWarnings: string[] = [];

    // ------------------------------------------------------------
    // G4: Narrative Engine enrichment for text-heavy slides
    // ------------------------------------------------------------
    // FALA D (2026-07-26) — the intent gate for the source-driven (Kreator)
    // default path now shares ONE list with the free-text-instruction path
    // (`shouldRunNarrativeRewrite` / `getNarrativeRewriteIntents`, both
    // exported below) instead of duplicating a 4-item literal here. See
    // `NARRATIVE_REWRITE_INTENTS_EXTENDED` for which additional intents were
    // added and why (root_cause/single_insight/performance_overview/roadmap/
    // risk_management — the same arc `generateDefaultOutline` already treats
    // as narrative-worthy for blank-brief decks).
    // Deck #2 (audyt 2026-07-22) — brief z czatu (setup.brief) grounduje TEMAT.
    // Dyskryminator w `resolveDeckNarrativeBrief` (eksportowany, testowalny):
    // aktywne TYLKO gdy jest brief i brak „rich" sourceArtifacts (ścieżka czatu);
    // Kreator (ze źródłami) nie ustawia brief (zod ścina), więc zero regresji. Gdy
    // aktywne: brief wchodzi jako user_instruction i poszerza bramkę na slajdy arc
    // (root_cause/single_insight/performance_overview/roadmap/risk_management),
    // które inaczej dostają tylko generyczny deterministyczny szablon.
    const briefText = resolveDeckNarrativeBrief(setup) ?? '';
    const useBriefRewrite = briefText.length > 0;
    // Fala A/A2 (2026-07-22): deck z czatu bez podpiętych źródeł pisał „brak danych"
    // — Narrative Engine ma regułę założeń (linguisticRealization.ts:76), ale przy
    // pustych faktach domyślnie wybierał „insufficient data". Wzmacniamy
    // user_instruction, by dla decka-z-czatu preferował konkretną, decyzyjną treść
    // z jawnymi założeniami zamiast pustki. NIE ruszamy współdzielonego silnika —
    // tylko kanał autorski. Reguły anty-fabrykacji (post_check) i tak nadrzędne.
    const briefInstruction = useBriefRewrite
      ? `${briefText}\n\n${
          setup.language === 'pl'
            ? 'To pierwszy szkic prezentacji BEZ podpiętych źródeł danych. Napisz konkretną, decyzyjną treść osadzoną w temacie (answer-first) — NIE odpowiadaj „brak danych"/„niewystarczające dane". Każdą konkretną, niepopartą liczbę/procent/datę oznacz w nawiasie „(założenie)".'
            : 'This is a first draft deck with NO attached data sources. Write concrete, decision-oriented content grounded in the topic (answer-first) — do NOT reply "insufficient data". Mark each specific unsupported number/percentage/date inline as "(assumption)".'
        }`
      : '';
    if (useBriefRewrite) {
      logger.info(
        `[PresentationGen] brief-grounded narrative ON (chat path): brief="${briefText.slice(0, 80)}"`
      );
    }
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      // Gdy content-pack z briefu został zasilony (Fala A3), slajdy mają już
      // realną treść z tematu — pomijamy Narrative Engine, który przy ZERO
      // faktach doklejałby akapit „brak danych" (patrz blok wyżej).
      const runNarrative = deckBriefPackApplied
        ? false
        : useBriefRewrite
          ? shouldRunNarrativeRewrite(slide.intent, briefText)
          : shouldRunNarrativeRewrite(slide.intent);
      if (!runNarrative) continue;
      try {
        // FALA D (2026-07-26) — Template Architect per-slide briefing
        // (keyMessage/dataNeeded, see `buildTemplateBriefingInstruction`).
        // Only used on the Kreator path (`!useBriefRewrite`) so it never
        // competes with the chat-brief instruction above — the two are
        // mutually exclusive by construction (`resolveDeckNarrativeBrief`
        // returns null whenever real sourceArtifacts are present, which is
        // exactly when a template-driven outline exists).
        const templateBriefing = useBriefRewrite
          ? null
          : buildTemplateBriefingInstruction(enabledSlides[i], setup.language);
        const engineInput: NarrativeEngineInput = {
          context_pack: contextPack,
          organizationId,
          report_config: {
            report_type_v3: 'presentation',
            goal_v3: setup.goal,
            communication_register:
              setup.audience === 'sponsor' || setup.audience === 'executive'
                ? 'executive'
                : 'professional',
            density: 'concise',
            form: 'presentation',
            data_level: 'summary',
            language: setup.language,
          },
          section_key: slide.intent,
          section_type: slide.intent,
          section_title: slide.key_message || slide.intent,
          // Temat z czatu jako dyrektywa autora — Narrative Engine trzyma się
          // faktów (post_check odrzuca zmyślone liczby), ale pisze O TEMACIE.
          ...(useBriefRewrite
            ? { user_instruction: briefInstruction }
            : templateBriefing
              ? { user_instruction: templateBriefing }
              : {}),
          aiPurpose:
            slide.intent === 'executive_summary' || slide.intent === 'key_messages'
              ? 'presentation_slide_copy'
              : 'presentation_deck_outline',
        };
        const narrativeOutput = await generateNarrative(engineInput);
        if (narrativeOutput.post_check.passed && narrativeOutput.content) {
          // Narrative Engine emits inline `[Fact: <label>]` citation markers and
          // markdown headings by contract (linguisticRealization) — internal
          // provenance, not slide copy. Polish before the text reaches the
          // deck document / unified JSON.
          (slide as any)._narrative_enrichment = {
            content: polishDeckText(narrativeOutput.content, setup.language),
            facts_used: narrativeOutput.facts_used.length,
            observations_used: narrativeOutput.observations_used.length,
          };
          logger.info(
            `[PresentationGen] Narrative Engine enriched slide ${i} (${slide.intent}): ${narrativeOutput.content.length} chars`
          );
        }
      } catch (err) {
        logger.warn(`[PresentationGen] Narrative Engine skipped for slide ${i}: ${err}`);
      }
    }

    // ------------------------------------------------------------
    // Oxford O2.5 — CONCLUSION LAYER slide (K1→K4 "Wnioski")
    // ------------------------------------------------------------
    // ADDITIVE + fail-safe: appends a grounded verdict→why→what-to-do→horizon
    // slide (CONCLUSION_LAYER_STANDARD §W5) built from the deck's OWN facts
    // (artifactData + ContextPack) and validated by the K1→K4 server twin
    // (`validateConclusion`). A management deck should end on "Co robić
    // najpierw" (K3) + "Czego oczekiwać" (K4), not a section collage.
    // ENABLE_DECK_CONCLUSION_SLIDE: default ON od 2026-07-22 — wykonuj, CHYBA
    // że env jawnie === 'false' (wyłączanie awaryjne). process.env is read at
    // CALL time so background generation reflects late env changes. Never throws.
    if (process.env.ENABLE_DECK_CONCLUSION_SLIDE !== 'false') {
      try {
        const { buildDeckConclusionSlide } = await import('./deliverables/deckConclusionSlide.js');
        let conclusionLlm: unknown = null;
        try {
          const mod = await import('./ai/llmService.js');
          conclusionLlm = (mod as any).llmService || (mod as any).default || null;
        } catch {
          conclusionLlm = null;
        }
        const conclusion = await buildDeckConclusionSlide({
          language: setup.language,
          artifactData,
          contextPack,
          llm: conclusionLlm as any,
          logger: {
            info: (m: string, meta?: unknown) => logger.info(m, meta as any),
            warn: (m: string, meta?: unknown) => logger.warn(m, meta as any),
          },
        });
        // Insert before a trailing next_steps/appendix slide so the deck still
        // closes on the recommendation arc; else append at the end.
        const tailIntents: SlideIntent[] = ['next_steps', 'appendix'];
        let insertAt = slides.length;
        for (let i = slides.length - 1; i >= 0; i--) {
          if (tailIntents.includes(slides[i].intent)) insertAt = i;
          else break;
        }
        slides.splice(insertAt, 0, conclusion.slide as unknown as UnifiedSlide);
        logger.info(
          `[PresentationGen] Conclusion slide inserted at ${insertAt} (source=${conclusion.source}, allHardPass=${conclusion.validation.allHardPass}, failures=[${conclusion.validation.failures.join(',')}])`
        );
      } catch (conclusionErr) {
        logger.warn('[PresentationGen] Conclusion slide skipped (non-fatal)', {
          err: (conclusionErr as Error)?.message,
        });
      }
    }

    // ------------------------------------------------------------
    // Gamma-like visuals (best-effort)
    // ------------------------------------------------------------
    const visualsEnabled = setup.visuals?.enabled !== false; // default ON if caller doesn't specify
    const visualPriority = setup.visuals?.priority || 'quality';
    if (visualsEnabled && slides.length > 0) {
      const density: 'low' | 'medium' | 'high' =
        setup.visuals?.imageDensity || (visualPriority === 'quality' ? 'medium' : 'low');
      const maxImages =
        visualPriority === 'cost' ? 1 : density === 'high' ? 6 : density === 'medium' ? 3 : 1;

      // 1) Plan visuals — premium B1 Layout Director when flag ON (fail-open +
      // byte-identical to deterministic v1 when OFF, default for all clients).
      const tieredVisuals = await planDeckVisualsTiered({
        slides,
        meta,
        deckTitle: setup.title,
        audience: setup.audience,
        goal: setup.goal,
        brandColor,
        settings: {
          enabled: true,
          priority: visualPriority,
          imageDensity: density,
        },
        orgId: organizationId,
        preferPremium: true,
      });
      const plannedSlides = tieredVisuals.slides;
      // Apply planned visuals back into the slides array (in-place by index)
      for (let i = 0; i < slides.length; i++) slides[i] = plannedSlides[i];

      // 2) Materialize planned visuals up to maxImages (with VisionQA gate)
      let used = 0;
      for (let i = 0; i < slides.length && used < maxImages; i++) {
        const s = slides[i];
        const planned = s.visuals || [];
        if (!planned.length) continue;

        for (let j = 0; j < planned.length && used < maxImages; j++) {
          const v = planned[j];
          if (v?.asset?.path || v?.asset?.dataUri || v?.asset?.url) continue;

          const { visual, warning } = await materializePlannedVisual({
            deckId,
            organizationId,
            meta,
            visual: v,
            brandColor,
            priority: visualPriority,
            dataClass: 'no_pii',
          });
          if (warning) extraWarnings.push(warning);
          if (visual) {
            // Apply VisionQA gate on the generated image (best-effort)
            if (visual.asset?.path && visualPriority === 'quality') {
              try {
                const brandColors = brandColor ? [brandColor] : [];
                const qaResult = await qaGatedImageGeneration(
                  async (prompt: string) => {
                    const regen = await materializePlannedVisual({
                      deckId,
                      organizationId,
                      meta,
                      visual: { ...v, prompt },
                      brandColor,
                      priority: visualPriority,
                      dataClass: 'no_pii',
                    });
                    return regen.visual?.asset?.path || visual.asset?.path || '';
                  },
                  {
                    slideTitle: s.key_message || '',
                    slideIntent: s.intent,
                    brandPalette: brandColors,
                    imageStylePreset: v.styleHint || 'corporate',
                    originalPrompt: v.prompt || '',
                  }
                );
                if (qaResult.wasRegenerated) {
                  logger.info(
                    `[PresentationGen] VisionQA improved image for slide ${i}, QA score: ${qaResult.qaScore.toFixed(2)}`
                  );
                }
              } catch (qaErr) {
                logger.warn(`[PresentationGen] VisionQA gate failed, using original image`, {
                  qaErr,
                });
              }
            }
            planned[j] = visual;
            used++;
          }
        }

        s.visuals = planned;
      }
    }

    // ------------------------------------------------------------
    // Sprint S15: layout-audit pass on the assembled outline +
    // decorate the matching UnifiedSlides with their audit flags.
    // The PPTX renderer reads these flags and adds an inline review
    // marker, closing R-S13-4 — the rendered artifact now visibly
    // carries the same warnings the Studio canvas banner shows.
    //
    // Failure-mode safety: the audit is pure and dependency-free, but
    // we still wrap the call in try/catch so a transient logic error
    // never blocks deck generation. If the audit throws, we log and
    // continue with the un-decorated slides — the deck still ships,
    // it just lacks the review marker on this run.
    // ------------------------------------------------------------
    let auditedSlides: UnifiedSlide[] = slides;
    try {
      const templateFamily =
        ((setup as any).templateFamily as string | undefined) ||
        ((setup as any).deckType as string | undefined) ||
        null;
      const layoutAudit = auditPresentationStudioOutlineLayout(outline, {
        templateFamily,
        organizationId,
      });
      const decorated = decorateSlidesWithAuditFlags({
        outline,
        slides,
        audit: layoutAudit,
      });
      auditedSlides = decorated.slides;
      if (decorated.decoratedCount > 0) {
        logger.info(
          `[PresentationGen] Layout audit decorated ${decorated.decoratedCount} slide(s) with review markers`
        );
      }
    } catch (auditErr) {
      logger.warn(`[PresentationGen] Layout audit decoration failed (non-fatal)`, {
        auditErr,
      });
    }

    const unifiedJson: UnifiedReportJSON = { meta, slides: auditedSlides };
    const warnings = [...extraWarnings];

    // ------------------------------------------------------------
    // F1.4 — per-deck CONTENT GATE (placeholder scan on final slides).
    // The bundle pipeline (bundleGenerationRuntime) already runs this for
    // the premium 3-format bundle, but a standalone L1 deck never did — so
    // a "[PLACEHOLDER]" / "TBD" / "AWAITING CONTENT" leak could ship in a
    // solo deck unnoticed. We scan the assembled slide text (key_message +
    // content + narrative enrichment) and surface any hit as a warning the
    // Studio banner + PPTX review marker already know how to display.
    // Pure + fail-open (runBundleContentGate never throws); JSON.stringify
    // the discriminated-union content so every slide variant is covered
    // without hand-mapping 17 content shapes.
    // ------------------------------------------------------------
    try {
      const deckTextForGate = auditedSlides
        .map((s) => {
          const narrative = (s as { _narrative_enrichment?: { content?: string } })
            ._narrative_enrichment?.content;
          return [s.key_message, JSON.stringify(s.content ?? ''), narrative]
            .filter(Boolean)
            .join(' ');
        })
        .filter(Boolean)
        .join('\n');
      const contentGate = runBundleContentGate({ deckText: deckTextForGate });
      if (!contentGate.passed) {
        for (const issue of contentGate.issues) warnings.push(`content-gate: ${issue}`);
        logger.warn(
          `[PresentationGen] content-gate flagged ${contentGate.placeholderHits.length} placeholder(s) in deck ${deckId}`,
          { hits: contentGate.placeholderHits.slice(0, 3).map((h) => h.pattern) }
        );
      }
    } catch (gateErr) {
      logger.warn(`[PresentationGen] content-gate skipped (non-fatal)`, { gateErr });
    }

    // ──────────────────────────────────────────────────────────────
    // A4 — BRAMKI JAKOŚCI DECKA (Critic kompozycji + M19 walidacja
    // strukturalna) jako NIE-BLOKUJĄCE wzbogacenie. Do dziś 4/5 bramek żyło
    // tylko w bundlu (bundleDeckQa/deckDesignCritic) i miało ZERO wywołań na
    // realnej ścieżce generateDeck. Wpinamy je PO zbudowaniu slajdów: wynik →
    // `warnings` (banner Studio je pokazuje) + metadane jakości na
    // deckDocument.generation.qualityGates.
    //
    // Zasady (lekcja „odrzucanie = brak danych"): NIGDY nie rzucamy, NIE
    // odrzucamy treści, NIE regenerujemy — tylko raportujemy. Deterministyczne,
    // bez LLM (tanie). Flaga ENABLE_DECK_QUALITY_GATES czytana W CZASIE
    // wywołania, default ON; awaryjne wyłączenie ='false' (wzór
    // ENABLE_DECK_CONCLUSION_SLIDE). Fail-open: dowolny błąd pomija bramki.
    // ──────────────────────────────────────────────────────────────
    let deckQualityGates: DeckQualityGatesSummary | undefined;
    if (process.env.ENABLE_DECK_QUALITY_GATES !== 'false') {
      try {
        const [{ critiqueDeck }, { validateReport }] = await Promise.all([
          import('./deliverables/deckDesignCritic.js'),
          import('./report/pptx/RulesEngine.js'),
        ]);
        // Precyzyjny (mało-szumny) ekstraktor bulletów z wielokształtnego
        // SlideContent — tylko znane pola listowe, by nie zawyżać gęstości.
        const collectBullets = (content: unknown): string[] => {
          const c = content as Record<string, unknown> | null | undefined;
          if (!c || typeof c !== 'object') return [];
          const out: string[] = [];
          const pushArr = (v: unknown): void => {
            if (!Array.isArray(v)) return;
            for (const x of v) {
              if (typeof x === 'string') {
                const t = x.trim();
                if (t) out.push(t);
              } else if (x && typeof x === 'object') {
                const o = x as Record<string, unknown>;
                const s = o.text ?? o.label ?? o.title ?? o.message ?? o.headline;
                if (typeof s === 'string' && s.trim()) out.push(s.trim());
              }
            }
          };
          for (const key of [
            'key_findings',
            'left_items',
            'right_items',
            'items',
            'bullets',
            'points',
            'takeaways',
            'messages',
            'recommendations',
            'next_steps',
            'steps',
            'findings',
          ]) {
            pushArr(c[key]);
          }
          return out.slice(0, 30);
        };

        const critiqueInput = auditedSlides.map((s, i) => ({
          slideIndex: i,
          layoutIntent: String((s as { intent?: unknown }).intent ?? ''),
          keyMessage: (s as { key_message?: string }).key_message ?? null,
          bullets: collectBullets((s as { content?: unknown }).content),
        }));
        const critique = critiqueDeck(critiqueInput);
        const structural = validateReport(unifiedJson);
        const structuralErrors = structural.violations.filter((v) => v.severity === 'error');
        const structuralWarnings = structural.violations.filter((v) => v.severity === 'warning');

        deckQualityGates = {
          critic: {
            overallScore: critique.overallScore,
            regenerateSlides: critique.regenerateSlides,
            passed: critique.passed,
          },
          structural: {
            valid: structural.valid,
            errorCount: structuralErrors.length,
            warningCount: structuralWarnings.length,
          },
        };

        if (!critique.passed) {
          warnings.push(
            `deck-quality: ${critique.regenerateSlides.length} slajd(ów) z krytycznym problemem kompozycji (score ${critique.overallScore}/100; indeksy ${critique.regenerateSlides.join(', ')})`
          );
        }
        for (const v of structuralErrors.slice(0, 5)) {
          warnings.push(`deck-quality: ${v.rule} — ${v.message}`);
        }
        logger.info(
          `[PresentationGen] quality gates: critic ${critique.overallScore}/100 passed=${critique.passed}, structural valid=${structural.valid} err=${structuralErrors.length} warn=${structuralWarnings.length} deck ${deckId}`
        );
      } catch (qgErr) {
        logger.warn('[PresentationGen] quality gates skipped (non-fatal)', {
          err: (qgErr as Error)?.message,
        });
      }
    }

    // ──────────────────────────────────────────────────────────────
    // B2 (W4): PREMIUM layout variants — 3 distinct palette+intent
    // plans stored as bonus data on deckDocument.variants. Fail-open:
    // any error silently skips variant generation and ships the deck.
    // ──────────────────────────────────────────────────────────────
    let deckVariants: unknown[] | undefined;
    try {
      const tier = resolveDeliverableTier({ orgId: organizationId, preferPremium: true });
      if (tier === 'PREMIUM') {
        const variantsResult = await generateDeckVariants(auditedSlides, meta, {
          orgId: organizationId,
          preferPremium: true,
        });
        if (variantsResult.variants.length > 0) {
          deckVariants = variantsResult.variants as unknown[];
          logger.info('[PresentationGen] B2 deck variants generated', {
            count: deckVariants.length,
            tierUsed: variantsResult.tierUsed,
            fallbackUsed: variantsResult.fallbackUsed,
          });
        }
      }
    } catch (b2Err) {
      logger.warn('[PresentationGen] B2 deck variants failed (non-fatal), skipping', {
        err: (b2Err as Error)?.message,
      });
    }

    let deckDocument = deckDocumentFromUnifiedJson({
      deckId,
      organizationId,
      title: setup.title,
      unifiedJson,
      outline,
      setup: {
        audience: setup.audience,
        goal: setup.goal,
        language: setup.language,
        confidentiality: setup.confidentiality,
        theme: setup.theme,
        presentationMode: (setup as any).presentationMode,
        communicationRegister: (setup as any).communicationRegister,
        contentDepth: (setup as any).contentDepth,
        colorSetId: (setup as any).colorSetId,
        additionalInstructions: (setup as any).additionalInstructions,
        imageSource: setup.visuals?.enabled === false ? 'none' : 'smart',
        transformationReadDeckPack: transformationPack,
        sourcePack: sourcePackPreflight.sourcePack,
        sourcePackMissingInputs: sourcePackPreflight.missingInputs,
        narrativePlan,
      },
      sourceArtifacts,
      sourceRefs,
      status: 'ready',
      warnings: [...warnings, ...sourcePackPreflight.warnings, ...narrativePlan.warnings],
      createdBy: 'system',
    });
    deckDocument.meta.customTemplate = templateRuntime?.customTemplate;
    deckDocument.meta.templateId = templateRuntime?.templateId || null;
    deckDocument.meta.templateVersion = templateRuntime?.customTemplate?.version || null;
    deckDocument = applyBrandLayoutSystem(
      deckDocument,
      buildBrandLayoutSystem({
        brandColor,
        confidentiality: setup.confidentiality,
        templateFamily:
          (setup as any).templateFamily ||
          ((setup as any).presentationMode === 'document'
            ? 'Digital Transformation Read Deck'
            : 'Board Decision Deck'),
        footerText:
          setup.confidentiality === 'public'
            ? 'Consultify'
            : setup.language === 'pl'
              ? 'Poufne · Consultify'
              : 'Confidential · Consultify',
      })
    );
    const pipeline = new PptxPipelineService();
    const result = await pipeline.generateFromUnifiedJson(unifiedJson, {
      template: setup.theme,
      language: setup.language,
      brandColor,
      confidentiality: setup.confidentiality,
      skipValidation: false,
      customTemplate: templateRuntime?.customTemplate,
    });

    const fs = await import('fs');
    const path = await import('path');
    const exportDir = exportsDir('presentations');
    const exportPath = path.default.join(exportDir, `${deckId}.pptx`);
    fs.default.writeFileSync(exportPath, result.buffer);

    deckDocument.delivery = {
      exportFormat: 'pptx',
      exportPath,
    };
    deckDocument.lifecycle.exportedAt = new Date().toISOString();
    deckDocument.generation.warnings = [
      ...(result.warnings || []),
      ...warnings,
      ...sourcePackPreflight.warnings,
      ...narrativePlan.warnings,
    ];
    // A4: metadane bramek jakości (Critic + M19) na deckDocument.generation —
    // additive, luźno typowane, by nie ruszać kontraktu typu generation.
    if (deckQualityGates) {
      (deckDocument.generation as Record<string, unknown>).qualityGates = deckQualityGates;
    }

    // B2: attach variants (additive — never replaces primary slides).
    if (deckVariants && deckVariants.length > 0) {
      deckDocument.variants = deckVariants;
    }

    let outlinePayload: unknown = outline;
    try {
      const existingDeck = (await dbGet(
        `SELECT outline_json FROM presentation_decks WHERE id = ? AND organization_id = ?`,
        [deckId, organizationId]
      )) as any;
      const parsedOutline = existingDeck?.outline_json
        ? JSON.parse(existingDeck.outline_json)
        : null;
      outlinePayload =
        parsedOutline && typeof parsedOutline === 'object' && !Array.isArray(parsedOutline)
          ? {
              ...parsedOutline,
              outline,
              generatedAt: new Date().toISOString(),
              sourcePack: sourcePackPreflight.sourcePack,
              missingInputs: sourcePackPreflight.missingInputs,
              narrativePlan,
            }
          : outline;
    } catch {
      outlinePayload = outline;
    }

    await dbRun(
      `UPDATE presentation_decks SET status = 'ready', deck_json = ?, unified_json = ?, slide_count = ?, export_path = ?, export_format = 'pptx', exported_at = CURRENT_TIMESTAMP, exported_version = version, validation_warnings = ?, outline_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [
        JSON.stringify(deckDocument),
        JSON.stringify(unifiedJson),
        result.slideCount,
        exportPath,
        JSON.stringify(deckDocument.generation.warnings),
        JSON.stringify(outlinePayload),
        deckId,
        organizationId,
      ]
    );

    await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: deckId,
      createdBy: 'system',
      deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState('ready'),
      originSummary: {
        exportPath,
        exportFormat: 'pptx',
        slideCount: result.slideCount,
        nativeStatus: 'ready',
        sourceTable: 'presentation_decks',
      },
    });

    // Record deck generation in OrganizationStyleProfile for learning
    try {
      const totalBlocks = enabledSlides.length * 3; // approximate
      await recordDeckGeneration(organizationId, {
        mode: setup.theme || 'show',
        register: 'professional',
        imageStyle: setup.visuals?.imageDensity || 'medium',
        colorSet: setup.brandColor || 'default',
        contentDepth: 'balanced',
        cardCount: result.slideCount,
        totalBlocks,
      });
      logger.info(
        `[PresentationGen] Recorded deck generation to style profile for org=${organizationId}`
      );
    } catch (profileErr) {
      logger.warn('[PresentationGen] Failed to record to style profile', { profileErr });
    }

    const deckEvidence = buildDeckEvidenceContract(
      sourceRefs,
      contextPack,
      sourcePackPreflight,
      narrativePlan.warnings
    );

    // HP-17 bridge — persist the inline EvidenceContract as an EvidenceEnvelope
    // (`artifact_evidence`) so the evidence panel (fala 9, ArtifactRightPanel)
    // has something to render for decks. Previously: contract computed (HP-16)
    // but never persisted → panel showed empty state despite the engine having
    // real data. Fire-and-forget + fail-safe (mirrors threeAxisReportService/
    // financeReportSectionService/drdReportEvidenceBridge): a write failure
    // NEVER blocks deck generation.
    void safePersistEvidenceContract(deckEvidence, {
      organizationId,
      artifactType: 'deck',
      artifactId: deckId,
      service: 'presentationGeneratorService',
    }).catch(() => {});

    return {
      deckId,
      slideCount: result.slideCount,
      // A4 fix (2026-07-23): was `...extraWarnings` — a snapshot taken BEFORE
      // the F1.4 content-gate and A4 quality-gates sections ran (`warnings`
      // is `[...extraWarnings]` at declaration, then gets content-gate +
      // deck-quality/M19 items pushed onto it). Those items were already
      // reaching deckDocument.generation.warnings (persisted, visible via
      // GET /decks/:id) but never the synchronous generate/deck response the
      // Wizard's ResultStep reads — so the existing "Quality Warnings" banner
      // there silently never showed them. Using `warnings` closes that gap
      // without touching generation logic (same computed data, now delivered).
      warnings: [
        ...(result.warnings || []),
        ...warnings,
        ...sourcePackPreflight.warnings,
        ...narrativePlan.warnings,
      ],
      exportPath,
      evidence: deckEvidence,
      // A4: non-blocking quality signal (Critic + M19), gated by
      // ENABLE_DECK_QUALITY_GATES (default ON). Additive field.
      qualityGates: deckQualityGates,
    };
  } catch (err: any) {
    logger.error(`[PresentationGen] Generation failed for ${deckId}: ${err.message}`);
    await dbRun(
      `UPDATE presentation_decks SET status = 'failed', validation_warnings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [JSON.stringify([err.message]), deckId, organizationId]
    );
    await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: deckId,
      createdBy: 'system',
      deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState('failed'),
      originSummary: {
        nativeStatus: 'failed',
        lastError: err.message,
        sourceTable: 'presentation_decks',
      },
    });
    throw err;
  }
}

/**
 * R4 — Default set of intents whose copy is produced by the Narrative Engine.
 * Without an author instruction, only these slides are AI-rewritten (legacy
 * behaviour). With a free-text instruction the user can rewrite ANY slide, so
 * the gate is widened — see {@link shouldRunNarrativeRewrite}.
 */
export const NARRATIVE_REWRITE_INTENTS: SlideIntent[] = [
  'executive_summary',
  'key_messages',
  'next_steps',
  'recommendation_portfolio',
];

/**
 * FALA D (2026-07-26, "deck-narrative-depth") — additional slide intents whose
 * L1 fact-extraction has real signal on the source-driven (Kreator) path. The
 * `context_pack` consumed by `extractFacts` (narrativeEngine/factExtraction.ts)
 * is DECK-WIDE, not per-slide — `generateDeck` builds it once from
 * `setup.sourceArtifacts` and reuses it for every slide — so it already
 * contains RAID risk items, KPI/benefit data, execution/initiative timelines
 * and tool-session findings by the time any slide asks for a narrative. These
 * 5 intents are exactly the source-driven mappings that populate that pool
 * (`generateDefaultOutline`: raid → risk_management, kpi_roi →
 * performance_overview, execution_status → roadmap, tool_session →
 * single_insight) plus `root_cause`, the deterministic problem-framing arc
 * slide — and are EXACTLY the "no-rich-source" narrative arc already unlocked
 * for the chat/brief path by `shouldRunNarrativeRewrite`'s free-text branch.
 * This only extends the SAME set to the Kreator default gate, where they
 * previously fell back to the generic deterministic template even with real
 * facts sitting in the pack.
 *
 * Deliberately NOT added: `cover`/`section_intro`/`appendix` (chrome slides,
 * no facts to narrate); `comparison`/`assessment`/`initiative_portfolio`/
 * `prioritization_matrix`/`recommendation_single` (table/matrix/scorecard
 * layouts per `presentationTemplateRuntimeService.ts` `BASE_RECIPES` — the
 * slide's value IS the table; a bolted-on narrative paragraph pads length
 * without adding an argument, so it's excluded pending a dedicated look at
 * whether THEIR deterministic content needs a different kind of depth fix).
 */
export const NARRATIVE_REWRITE_INTENTS_EXTENDED: SlideIntent[] = [
  ...NARRATIVE_REWRITE_INTENTS,
  'root_cause',
  'single_insight',
  'performance_overview',
  'roadmap',
  'risk_management',
];

/**
 * FALA D — kill-switch: `ENABLE_DECK_NARRATIVE_EXTENDED`, read at CALL time
 * (same pattern as `ENABLE_DECK_CONCLUSION_SLIDE` / `ENABLE_DECK_QUALITY_GATES`
 * above) so an env change rolls back without a deploy. Default ON: set to the
 * literal string `'false'` to fall back to the legacy 4-intent gate. Safe
 * default-ON because this only widens WHICH slides may call the Narrative
 * Engine — the L5 post-checks (no invented numbers, source-coverage floor)
 * and the deck quality gates already police WHAT the engine is allowed to
 * say, unchanged by this flag.
 */
export function getNarrativeRewriteIntents(): SlideIntent[] {
  return process.env.ENABLE_DECK_NARRATIVE_EXTENDED !== 'false'
    ? NARRATIVE_REWRITE_INTENTS_EXTENDED
    : NARRATIVE_REWRITE_INTENTS;
}

/**
 * R4 — Pure decision: should the per-slide narrative rewrite run for this
 * intent? A free-text instruction unlocks every slide; absent an instruction
 * we keep the (flag-gated) narrative-only gate. Exported for unit testing.
 */
export function shouldRunNarrativeRewrite(intent: SlideIntent, instruction?: string): boolean {
  const hasInstruction = typeof instruction === 'string' && instruction.trim().length > 0;
  if (hasInstruction) return true;
  return getNarrativeRewriteIntents().includes(intent);
}

/**
 * FALA D (2026-07-26) — folds a template-drafted per-slide briefing
 * (`OutlineItem.keyMessage` / `.dataNeeded`, drafted by
 * `presentationTemplateDraftService.ts`'s Template Architect) into a Narrative
 * Engine `user_instruction`. Mirrors the shape of the chat-brief instruction
 * built in `generateDeck` (same field, same "highest priority" prompt slot in
 * `linguisticRealization.ts` `buildSystemPrompt`), but the directive is
 * STRUCTURAL, never a fact substitute: `keyMessage` tells L4 which thesis to
 * open on and defend with the real facts already in the context pack;
 * `dataNeeded` tells it which of those facts to prioritise. Neither field is
 * itself a fact — L5 post-checks still reject any number the content can't
 * trace back to `context_pack`. Returns `null` when there is nothing to say
 * (most decks/slides have no template briefing) so callers can cleanly no-op.
 * Pure — exported for unit testing.
 */
export function buildTemplateBriefingInstruction(
  item: Pick<OutlineItem, 'keyMessage' | 'dataNeeded'> | undefined,
  language: 'en' | 'pl'
): string | null {
  if (!item) return null;
  const keyMessage = typeof item.keyMessage === 'string' ? item.keyMessage.trim() : '';
  const dataNeeded = Array.isArray(item.dataNeeded)
    ? item.dataNeeded.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    : [];
  if (!keyMessage && dataNeeded.length === 0) return null;

  const isPl = language === 'pl';
  const lines: string[] = [];
  if (keyMessage) {
    lines.push(
      isPl
        ? `Teza tego slajdu zdefiniowana w szablonie: "${keyMessage}". Otwórz akapit tą tezą i rozwiń ją dostępnymi faktami — nie zastępuj jej inną tezą.`
        : `This slide's thesis, as defined by the template: "${keyMessage}". Open on this thesis and support it with the available facts — do not substitute a different thesis.`
    );
  }
  if (dataNeeded.length > 0) {
    lines.push(
      isPl
        ? `Szablon wskazuje, że ten slajd powinien opierać się na: ${dataNeeded.join('; ')}. Jeśli te dane są obecne wśród podanych faktów, użyj ich w pierwszej kolejności; jeśli ich brakuje, NIE zmyślaj ich — pomiń lub oznacz jako założenie.`
        : `The template indicates this slide should draw on: ${dataNeeded.join('; ')}. If these are present among the provided facts, prioritise them; if they are missing, do NOT invent them — omit or mark as an assumption.`
    );
  }
  return lines.join('\n');
}

/** Rich-source typy — obecność któregokolwiek = deck sterowany danymi (Kreator). */
const DECK_RICH_SOURCE_TYPES = new Set<string>([
  'initiative_portfolio',
  'execution_status',
  'kpi_roi',
  'raid',
  'assessment',
  'tool_session',
]);

/**
 * Deck #2 (audyt 2026-07-22) — czy użyć briefu z czatu jako dyrektywy narracyjnej.
 * Zwraca przycięty brief GDY: (a) `setup.brief` niepusty ORAZ (b) brak „rich"
 * sourceArtifacts. Inaczej `null`. To DYSKRYMINATOR chat-vs-Kreator: Kreator nie
 * ustawia brief (zod ścina nieznane pola), a nawet gdyby — obecność realnego
 * źródła wyłącza brief-rewrite, żeby deck ze źródłami trzymał treść z danych.
 * Pure — eksportowany do testów. NIE czyni briefu źródłem faktów.
 */
export function resolveDeckNarrativeBrief(
  setup: Pick<DeckSetup, 'brief' | 'sourceArtifacts'>
): string | null {
  const briefText = typeof setup.brief === 'string' ? setup.brief.trim() : '';
  if (!briefText) return null;
  const hasRichSource =
    Array.isArray(setup.sourceArtifacts) &&
    setup.sourceArtifacts.some((s) =>
      DECK_RICH_SOURCE_TYPES.has(String((s as { type?: unknown }).type))
    );
  return hasRichSource ? null : briefText;
}

export async function regenerateSlide(
  deckId: string,
  slideIndex: number,
  organizationId: string,
  opts?: { instruction?: string }
): Promise<{ slide: UnifiedSlide; card?: unknown }> {
  const instruction =
    typeof opts?.instruction === 'string' && opts.instruction.trim().length > 0
      ? opts.instruction.trim()
      : undefined;

  const deck = (await dbGet(
    `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  )) as any;
  if (!deck) throw new Error('Deck not found');

  const unifiedJson: UnifiedReportJSON = JSON.parse(deck.unified_json);
  if (slideIndex < 0 || slideIndex >= unifiedJson.slides.length)
    throw new Error('Invalid slide index');

  const slide = unifiedJson.slides[slideIndex];

  // R4 — narrative path runs for the legacy text-heavy intents OR for ANY slide
  // when the author supplied a free-text rewrite instruction.
  if (shouldRunNarrativeRewrite(slide.intent, instruction)) {
    const contextPack = await getContextPackSnapshot(deckId);
    if (contextPack) {
      try {
        const language: 'en' | 'pl' = unifiedJson.meta?.language === 'pl' ? 'pl' : 'en';
        const narrativeOutput = await generateNarrative({
          context_pack: contextPack,
          organizationId,
          report_config: {
            report_type_v3: 'presentation',
            goal_v3: 'inform',
            communication_register: 'executive',
            density: 'concise',
            form: 'presentation',
            data_level: 'summary',
            language,
          },
          section_key: slide.intent,
          section_type: slide.intent,
          section_title: slide.key_message || slide.intent,
          aiPurpose: 'presentation_slide_copy',
          ...(instruction ? { user_instruction: instruction } : {}),
        });

        if (narrativeOutput.post_check.passed && narrativeOutput.content) {
          (slide as any)._narrative_enrichment = {
            content: polishDeckText(narrativeOutput.content, language),
            facts_used: narrativeOutput.facts_used.length,
            observations_used: narrativeOutput.observations_used.length,
            regenerated_at: new Date().toISOString(),
            ...(instruction ? { instruction } : {}),
          };
          unifiedJson.slides[slideIndex] = slide;
        }
      } catch (err) {
        // Fallback: AI unavailable / failed → keep the existing slide untouched
        // and let the caller persist the (surgically unchanged) deck. No throw.
        logger.warn(`[PresentationGen] Narrative Engine skipped for regenerateSlide: ${err}`);
      }
    }
  }

  // Rebuild deck_json from updated unified_json (surgical: just updates the affected card).
  const updatedDeckDocument = deckDocumentFromUnifiedJson({
    deckId,
    organizationId,
    title: unifiedJson.meta?.project || deck.title || '',
    unifiedJson,
    setup: { language: unifiedJson.meta?.language || 'en' },
  });

  await dbRun(
    `UPDATE presentation_decks SET unified_json = ?, deck_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(unifiedJson), JSON.stringify(updatedDeckDocument), deckId, organizationId]
  );

  // R4 — return the rebuilt FE-shaped card so the client can `updateCard()` in
  // place (preserves undo) instead of reloading the whole deck.
  const rebuiltCard = (updatedDeckDocument as any)?.cards?.[slideIndex];

  return { slide: unifiedJson.slides[slideIndex], card: rebuiltCard };
}
