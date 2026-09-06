/**
 * Audit report → Conclusion bridge (DEC-417e, 1.1-A4).
 *
 * POMIAR 06.09: `ConclusionService.syncAllSources()` znało DOKŁADNIE trzy
 * źródła — wywiad, ocenę i narzędzia (`ConclusionService.ts:745`). Moduł
 * Audyty produkował raporty (`audit_reports`, sekcje „Streszczenie zarządcze",
 * „Wniosek ogólny", „Ograniczenia", „Wnioski systemowe" —
 * `services/audits/reportRenderer.ts:435`), ale warstwa Wniosków nigdy ich nie
 * widziała: żaden wniosek audytu nie mógł powstać, więc zakładka „Wnioski"
 * Audytów byłaby pusta z definicji, a nie z braku pracy.
 *
 * Ten moduł jest ODPOWIEDNIKIEM `reportConclusionBridge` (ocena), nie nowym
 * silnikiem:
 *   - `buildAuditReportConclusion` — CZYSTE mapowanie dokumentu raportu audytu
 *     na kandydata wniosku (żadnego promptu, żadnego modelu treści — bierzemy
 *     to, co renderer raportu już policzył),
 *   - `safePersistAuditReportConclusion` — zapis przez
 *     `conclusionService.createConclusion` (ten sam upsert po rodowodzie).
 *
 * RODOWÓD jest twardym warunkiem: wniosek MUSI nieść `sourceRefs` typu
 * `audit_report` wskazujące dokładnie raport, z którego powstał. Bez tego
 * odczyt po `source_artifact_refs_json` nie trafia i trasa woli 500 niż
 * udawany sukces (test mutacyjny celuje w ten warunek).
 */

import type { ArtifactRef, CreateConclusionParams, EvidenceRef } from './ConclusionService.js';
import { conclusionService } from './ConclusionService.js';

/** Kształt dokumentu raportu audytu w minimum, jakiego potrzebuje most —
 * celowo strukturalny (a nie import z `services/audits`), żeby warstwa
 * Wniosków nie zależała od modułu Audytów. */
export interface AuditReportDocumentLike {
  reportKind?: string | null;
  sections?: Array<{ id?: string; title?: string; kind?: string; content?: unknown }> | null;
}

export interface AuditReportConclusionSource {
  reportId: string;
  reportTitle?: string | null;
  reportStatus?: string | null;
  reportVersion?: number | null;
  programId?: string | null;
  programName?: string | null;
  projectId?: string | null;
}

/** `audit` — nowa przestrzeń źródła w warstwie Wniosków (obok
 * `interview`/`assessment*`/`tool*`). Filtr listy Audytów opiera się na niej,
 * a nie na zgadywaniu po tytule. */
export const AUDIT_CONCLUSION_SOURCE_MODULE = 'audit';
/** Typ rodowodu w `sourceRefs` — pojedyncze źródło prawdy dla mostu, sync-u i UI. */
export const AUDIT_REPORT_REF_TYPE = 'audit_report';

export interface AuditReportConclusionCandidate {
  title: string;
  statement: string;
  sourceModule: typeof AUDIT_CONCLUSION_SOURCE_MODULE;
  sourceRefs: ArtifactRef[];
  confidenceLevel: string;
  limits: string;
  evidenceRefs: EvidenceRef[];
  recommendedNextAction: string | null;
  status: 'candidate';
  contextSummary: string;
}

function findSection(
  document: AuditReportDocumentLike,
  id: string
): { content?: unknown } | undefined {
  const sections = Array.isArray(document?.sections) ? document.sections : [];
  return sections.find((section) => section && section.id === id);
}

function sectionText(document: AuditReportDocumentLike, id: string): string {
  const content = findSection(document, id)?.content;
  return typeof content === 'string' ? content.trim() : '';
}

function sectionArray(document: AuditReportDocumentLike, id: string): unknown[] {
  const content = findSection(document, id)?.content;
  return Array.isArray(content) ? content : [];
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['description', 'title', 'theme', 'text', 'summary', 'name']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
  }
  return '';
}

/**
 * CZYSTE mapowanie dokumentu raportu audytu na kandydata wniosku.
 * `null`, gdy raport nie ma ani wniosku ogólnego, ani streszczenia zarządczego
 * — nie ma wtedy z czego zbudować werdyktu i udawanie go byłoby kłamstwem.
 */
export function buildAuditReportConclusion(
  document: AuditReportDocumentLike,
  source: AuditReportConclusionSource
): AuditReportConclusionCandidate | null {
  const overall = sectionText(document, 'overall_conclusion');
  const executive = sectionText(document, 'executive_summary');
  const statementRaw = overall || executive;
  if (!statementRaw) return null;

  const systemic = sectionArray(document, 'systemic_conclusions')
    .map(asText)
    .filter((entry) => entry.length > 0)
    .slice(0, 5);
  const statement = [statementRaw, ...systemic].join('\n\n').slice(0, 4000);

  const limitationEntries = sectionArray(document, 'limitations')
    .map(asText)
    .filter((entry) => entry.length > 0);
  const limits = limitationEntries.length
    ? limitationEntries.join('\n').slice(0, 2000)
    : 'Wniosek z raportu audytu — sprawdź dowody obiektywne przed decyzją wykonawczą.';

  // Dowody: wpisy „Odniesienia do obiektywnych dowodów" raportu, plus zawsze
  // sam raport (żeby wniosek dało się cofnąć do dokumentu, nawet gdy tabela
  // dowodów jest pusta).
  const evidenceRows = sectionArray(document, 'objective_evidence_references').slice(0, 20);
  const evidenceRefs: EvidenceRef[] = evidenceRows.map((row, index) => {
    const record = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const ref =
      (typeof record.evidenceId === 'string' && record.evidenceId) ||
      (typeof record.id === 'string' && record.id) ||
      `${source.reportId}#${index + 1}`;
    const excerpt = asText(row);
    return { type: 'audit_evidence', ref: String(ref), excerpt: excerpt || null };
  });
  evidenceRefs.push({
    type: AUDIT_REPORT_REF_TYPE,
    ref: String(source.reportId),
    excerpt: statementRaw.slice(0, 500),
  });

  const firstAction = sectionArray(document, 'corrective_action_plan')
    .map(asText)
    .find((entry) => entry.length > 0);

  const title = (source.reportTitle || `Wniosek z audytu — ${source.reportId}`).slice(0, 180);
  const status = String(source.reportStatus || '').toLowerCase();

  return {
    title,
    statement,
    sourceModule: AUDIT_CONCLUSION_SOURCE_MODULE,
    sourceRefs: [
      {
        type: AUDIT_REPORT_REF_TYPE,
        id: String(source.reportId),
        title: source.reportTitle || null,
        url: `/audit-programs/reports/${encodeURIComponent(String(source.reportId))}`,
      },
    ],
    confidenceLevel: status === 'published' || status === 'approved' ? 'medium' : 'low',
    limits,
    evidenceRefs,
    recommendedNextAction: firstAction ? firstAction.slice(0, 500) : null,
    status: 'candidate',
    contextSummary:
      `${source.programName || 'Program audytowy'} — raport ${document?.reportKind || 'audit_report'}` +
      `${source.reportVersion != null ? ` v${source.reportVersion}` : ''}: ${statementRaw}`.slice(
        0,
        2000
      ),
  };
}

interface ConclusionWriter {
  createConclusion(params: CreateConclusionParams): Promise<void>;
}

/**
 * Zapis wniosku z raportu audytu. Nigdy nie rzuca — awaria warstwy Wniosków nie
 * może wywrócić generowania/oglądania raportu (ta sama reguła co w moście
 * oceny). Zwraca `false`, gdy nie było czego zapisać albo zapis się nie udał.
 */
export async function safePersistAuditReportConclusion(
  params: {
    organizationId: string;
    actorUserId: string;
    document: AuditReportDocumentLike;
    source: AuditReportConclusionSource;
  },
  options?: {
    writer?: ConclusionWriter;
    logger?: { warn: (msg: string, meta?: unknown) => void };
  }
): Promise<boolean> {
  try {
    const candidate = buildAuditReportConclusion(params.document, params.source);
    if (!candidate) return false;
    const writer = options?.writer ?? conclusionService;
    await writer.createConclusion({
      organizationId: params.organizationId,
      projectId: params.source.projectId ?? null,
      title: candidate.title,
      statement: candidate.statement,
      sourceModule: candidate.sourceModule,
      sourceRefs: candidate.sourceRefs,
      confidenceLevel: candidate.confidenceLevel,
      limits: candidate.limits,
      evidenceRefs: candidate.evidenceRefs,
      recommendedNextAction: candidate.recommendedNextAction,
      status: candidate.status,
      createdBy: params.actorUserId,
      contextSummary: candidate.contextSummary,
    });
    return true;
  } catch (error) {
    try {
      options?.logger?.warn('[AuditReportConclusionBridge] Nie udało się zapisać wniosku', {
        reportId: params.source.reportId,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      /* nawet logowanie nie może rzucić */
    }
    return false;
  }
}
