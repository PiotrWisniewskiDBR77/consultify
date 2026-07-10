/**
 * DRD report → Evidence Envelope bridge (H1 Harvey-gap, §3.2 kontrakt punkt
 * "Snapshot F5" — applied here to the DRD report as the first `artifactType:
 * 'report'` wiring point; see `Harvard/wdrozenie-100/_KONCEPT_RDZEN_2026-07-10.md`
 * §3 for the full contract).
 *
 * Mirrors `reportConclusionBridge.ts`'s split: a PURE mapper (`DrdReportModel`
 * → `UpsertEnvelopeInput`) plus a fail-safe persist wrapper. A report always
 * finishes generating even when the evidence-envelope write fails — this is
 * an ADDITIVE lineage record, not a gate.
 *
 * What lands in the envelope:
 *  - `sources`: every evidence ref the report's narrator sections carried
 *    (`drd_axis`/`drd_area` engine facts + `drd_methodology_kb` book excerpts
 *    from `drdReportGrounding.ts`, deduped), so "Źródła i założenia" can render
 *    the FULL chain: assessment score → (optionally) book citation → prose.
 *  - `assumptions`: the industry-benchmark segment (explicit when the org has
 *    a profile, else flagged as a default/benchmark assumption).
 *  - `toVerify`: which sections fell back to the deterministic stub (no LLM
 *    validation passed) — a human-readable flag, not a blocker (draft-with-flag
 *    per `_KONCEPT_CONTENT_ENGINES_2026-07-10.md` §13 Q3 recommendation).
 *  - `confidence`: assessment completion ratio (0..1) — same signal already
 *    shown as `credibility.confidenceLabel` in the report itself.
 */
import type { DrdReportModel } from '../report/drdReportModel.js';
import type {
  EvidenceArtifactType,
  EvidenceAssumption,
  EvidenceSource,
  EvidenceSourceType,
  EvidenceToVerify,
  UpsertEnvelopeInput,
} from './evidenceEnvelopeService.js';

export interface DrdReportEvidenceSource {
  reportId: string;
  organizationId: string;
  createdBy?: string | null;
}

const REPORT_ARTIFACT_TYPE: EvidenceArtifactType = 'report';

function mapSourceType(refType: string): EvidenceSourceType {
  if (refType === 'drd_methodology_kb') return 'kb';
  // drd_axis / drd_area / fact_ref (factRefs the LLM cited) — all engine-exact
  // output of the DRD assessment session.
  return 'tool_session';
}

/**
 * PURE mapping of a generated DRD report model to an `UpsertEnvelopeInput`
 * (artifactType 'report'). Never throws.
 */
export function buildDrdReportEvidenceEnvelope(
  model: DrdReportModel,
  source: DrdReportEvidenceSource
): UpsertEnvelopeInput {
  const byKey = new Map<string, EvidenceSource>();
  const addRef = (ref: { type: string; ref: string; excerpt?: string | null }) => {
    if (!ref?.ref) return;
    const key = `${ref.type}:${ref.ref}`;
    if (byKey.has(key)) return;
    byKey.set(key, {
      type: mapSourceType(ref.type),
      ref: ref.ref,
      snippet: ref.excerpt ? String(ref.excerpt).slice(0, 300) : undefined,
    });
  };

  for (const e of model.executiveSummary?.evidence || []) addRef(e);
  for (const g of model.gapCards || []) for (const e of g.narrative?.evidence || []) addRef(e);
  for (const c of model.chapters || []) for (const e of c.narrative?.evidence || []) addRef(e);

  const assumptions: EvidenceAssumption[] = [];
  if (model.industryBenchmark) {
    const explicitIndustry = Boolean(model.meta?.industry);
    assumptions.push({
      key: 'industry_benchmark_segment',
      value: model.meta?.industry ?? 'default',
      source_type: explicitIndustry ? 'user' : 'benchmark',
      rationale: explicitIndustry
        ? 'Segment branżowy podany w profilu organizacji.'
        : 'Brak profilu branżowego organizacji — użyto segmentu domyślnego (DEFAULT_DRD_BENCHMARK_INDUSTRY).',
    });
  }

  const deterministicSections: string[] = [];
  if (model.executiveSummary?.narrative === 'deterministic') {
    deterministicSections.push('streszczenie zarządcze');
  }
  for (const g of model.gapCards || []) {
    if (g.narrative?.narrative === 'deterministic') deterministicSections.push(`karta luki: ${g.areaName}`);
  }
  for (const c of model.chapters || []) {
    if (c.narrative?.narrative === 'deterministic') deterministicSections.push(`rozdział: ${c.axisName}`);
  }
  const toVerify: EvidenceToVerify[] = [];
  if (deterministicSections.length > 0) {
    toVerify.push({
      claim: `${deterministicSections.length} sekcji raportu użyło szablonu deterministycznego (bez LLM): ${deterministicSections.join(', ')}.`,
      why: 'LLM narrator nie przeszedł walidacji (numbers_from_engine/evidence_link) lub był niedostępny — raport użył bezpiecznego fallbacku (CONCLUSION_LAYER_STANDARD, fail-safe).',
      suggested_check: 'Rozważ regenerację raportu po weryfikacji dostępności/tieru modelu LLM (patrz checklist §10 KONCEPT_CONTENT_ENGINES).',
    });
  }

  const completionPct = model.credibility?.completionPercent ?? 0;
  const confidence = Math.max(0, Math.min(1, completionPct / 100));

  return {
    organizationId: source.organizationId,
    artifactType: REPORT_ARTIFACT_TYPE,
    artifactId: source.reportId,
    sources: Array.from(byKey.values()),
    assumptions,
    confidence,
    toVerify,
    computedBy: {
      service: 'drdReportService.buildDrdReportHtmlServer',
      version: 'v1',
      at: new Date().toISOString(),
    },
    createdBy: source.createdBy ?? null,
  };
}

interface EnvelopeWriter {
  upsertEnvelope(input: UpsertEnvelopeInput): Promise<unknown>;
}

/**
 * Fail-safe persist of the DRD report's evidence envelope. Never throws —
 * report generation always completes even when the Evidence Layer write fails
 * (e.g. `artifact_evidence` migration not yet applied on this environment).
 */
export async function safePersistDrdReportEvidence(
  params: { model: DrdReportModel; source: DrdReportEvidenceSource },
  options?: {
    writer?: EnvelopeWriter;
    logger?: { warn: (msg: string, meta?: unknown) => void };
  }
): Promise<boolean> {
  try {
    const input = buildDrdReportEvidenceEnvelope(params.model, params.source);
    let writer = options?.writer;
    if (!writer) {
      const mod = await import('./evidenceEnvelopeService.js');
      writer = (mod.default || mod) as EnvelopeWriter;
    }
    await writer.upsertEnvelope(input);
    return true;
  } catch (error) {
    try {
      options?.logger?.warn('[DrdReportEvidenceBridge] Failed to persist evidence envelope', {
        reportId: params.source.reportId,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      /* even logging must not throw */
    }
    return false;
  }
}
