import { Api } from '@/services/api';

export type AssessmentOutputsLanguage = 'pl' | 'en';

const ASSESSMENT_REPORT_ORIGIN_RUNTIME = 'assessment_report';

// Server hard-caps at 200 regardless of what's requested
// (server/src/services/v8/artifactRegistryService.ts listArtifactsForUser:
// `deduped.slice(0, Math.max(1, Math.min(filters.limit || 100, 200)))`) —
// pass the max to give assessment-origin rows (a minority of any org's
// Outputs Library, sorted most-recently-updated first) the best chance of
// surviving that cap. KNOWN, DISCLOSED LIMITATION: there is no server-side
// filter by originRuntime on this endpoint yet, so a very active org could
// still have assessment outputs pushed past the cap by newer non-assessment
// artifacts. Not fixable from this isolated, frontend-only package — would
// require a backend change outside T22-TABLE-PREVIEW-COMPONENT's file scope.
const ARTIFACTS_FETCH_LIMIT = 200;

/**
 * T22-TABLE-PREVIEW-COMPONENT: one row = one artifact registered in the
 * canonical Outputs Library (`GET /api/artifacts`) whose primary origin is
 * an assessment's P28 "promote to Outputs Library" handoff
 * (`originRuntime === 'assessment_report'`, T22-DATA-PREREQ). Field set is a
 * strict whitelist of what `/api/artifacts` genuinely returns for this
 * origin runtime — see server/src/routes/artifacts.routes.ts
 * (buildActionTargetPayload's 'assessment_report' branch, which supplies
 * openPath/exportPath/deletePath/authority) and
 * server/src/services/v8/artifactRegistryService.ts
 * (mapArtifactRegistryListRow). No field here is invented; fields that
 * runtime doesn't populate (reportType, presentationMode, slideCount, …)
 * are deliberately excluded rather than carried through as always-null.
 */
export interface AssessmentOutputArtifact {
  id: string;
  artifactId: string;
  /**
   * QA-CORRECTION-1 (2026-08-07): these five fields are `string | null`, NOT
   * defaulted, on purpose — normalizeArtifactRow() below must never invent a
   * value ('Untitled output', 'report', 'document', 'draft', 'organization')
   * when the registry didn't persist one. `null` here means "genuinely not
   * on the source row"; any placeholder text for it belongs at RENDER time
   * (AssessmentOutputsTab.tsx table cells / preview title), never baked into
   * this data, and the Details prose (below) must say so explicitly rather
   * than presenting a fabricated default as a persisted fact.
   */
  resolvedTitle: string | null;
  outputType: string | null;
  artifactFamily: string | null;
  deliveryState: string | null;
  visibilityScope: string | null;
  isDraft: boolean;
  ownerName: string | null;
  createdBy: string;
  createdAt: string | null;
  lastTransitionAt: string | null;
  originRuntime: string;
  originRecordId: string;
  /**
   * Registry-provided navigation/action targets (buildActionTargetPayload).
   * Null when the registry has none for this row — never invented
   * client-side. For 'assessment_report' rows today: openPath routes back to
   * the assessment run; exportPath and deletePath are always null (no such
   * routes exist for this origin yet).
   */
  openPath: string | null;
  exportPath: string | null;
  deletePath: string | null;
  authority: string | null;
  // Index signature: StandardTable's TableRow requires one. Every real field
  // above is still explicitly typed; this only satisfies that structural
  // requirement, it does not loosen the whitelist below.
  [key: string]: unknown;
}

function unwrapArtifactsListResponse(res: unknown): unknown[] {
  const payload = (res as { data?: unknown } | null | undefined)?.data ?? res;
  if (Array.isArray(payload)) return payload;
  const nested = (payload as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(nested) ? nested : [];
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeArtifactRow(row: Record<string, unknown>): AssessmentOutputArtifact | null {
  const artifactId = toNullableString(row.artifactId);
  if (!artifactId) return null;
  return {
    id: artifactId,
    artifactId,
    // QA-CORRECTION-1: no `|| 'literal default'` on any of these five — a
    // missing source field stays `null`, never a fabricated fact.
    resolvedTitle: toNullableString(row.resolvedTitle) || toNullableString(row.titleSnapshot),
    outputType: toNullableString(row.outputType),
    artifactFamily: toNullableString(row.artifactFamily),
    deliveryState: toNullableString(row.deliveryState),
    visibilityScope: toNullableString(row.visibilityScope),
    isDraft: Boolean(row.isDraft),
    ownerName: toNullableString(row.ownerName),
    createdBy: toNullableString(row.createdBy) || '',
    createdAt: toNullableString(row.createdAt),
    lastTransitionAt: toNullableString(row.lastTransitionAt),
    originRuntime: toNullableString(row.originRuntime) || '',
    originRecordId: toNullableString(row.originRecordId) || '',
    openPath: toNullableString(row.openPath),
    exportPath: toNullableString(row.exportPath),
    deletePath: toNullableString(row.deletePath),
    authority: toNullableString(row.authority),
  };
}

/**
 * Fetches the org-scoped Outputs Library (`GET /api/artifacts`, the same
 * endpoint/client pattern already used by InitiativeDocumentView.tsx,
 * SourceStep.tsx and PresentationWizard.tsx) and filters strictly to rows
 * whose primary origin is an assessment promotion
 * (`originRuntime === 'assessment_report'`). No mocks, fixtures, demo rows or
 * fabricated fallback rows — an empty result means the org genuinely has
 * none. Throws on network/HTTP failure; callers must distinguish that
 * (honest error state) from a genuinely empty, successful result.
 */
export async function fetchAssessmentOutputArtifacts(): Promise<AssessmentOutputArtifact[]> {
  const res = await Api.get(`/artifacts?limit=${ARTIFACTS_FETCH_LIMIT}`);
  const rows = unwrapArtifactsListResponse(res);
  const results: AssessmentOutputArtifact[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    if (record.originRuntime !== ASSESSMENT_REPORT_ORIGIN_RUNTIME) continue;
    const normalized = normalizeArtifactRow(record);
    if (normalized) results.push(normalized);
  }
  return results;
}

// ── Details prose ───────────────────────────────────────────────────────
// Mirrors the whitelist/redaction/140-word-cap pattern of
// src/components/assessment/assessmentPreviewDetails.ts (T21/T23/T24) —
// deliberately reimplemented here rather than imported, to keep this
// package isolated per T22-TABLE-PREVIEW-COMPONENT: it must not depend on
// T20-T24's AssessmentHub work, which isn't integrated with this tab yet.

const MAX_WORDS = 140;
const CREDENTIAL_VALUE =
  /\b(?:bearer\s+\S+|eyJ[a-z\d_-]*\.[a-z\d_-]+\.[a-z\d_-]+|(?:(?:api|private|access|session)[\s_-]*key|auth[\s_-]*header|authentication|authorization|client[\s_-]*secret|password|secret|token|cookie|credential)\s*[:=]\s*\S+)/i;

const normalizeFact = (value: unknown, maxChars = 500): string => {
  if (value == null) return '';
  const source = value instanceof Date ? value.toISOString() : String(value);
  const trimmed = source.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return '';
  const text = trimmed
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || CREDENTIAL_VALUE.test(text)) return '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
};

const capWords = (text: string): string => {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= MAX_WORDS ? text : `${words.slice(0, MAX_WORDS).join(' ')}…`;
};

type PersistedFact = {
  value: string;
  present: (value: string) => string;
  missing: string;
};

/** Builds factual Outputs-preview prose from a strict persisted-field whitelist. */
export const buildAssessmentOutputPreviewDetails = (
  artifact: AssessmentOutputArtifact | null | undefined,
  language: AssessmentOutputsLanguage
): string => {
  if (!artifact) return '';
  const isPolish = language === 'pl';
  const facts: PersistedFact[] = isPolish
    ? [
        {
          value: normalizeFact(artifact.resolvedTitle, 160),
          present: (value) => `Artefakt: ${value}.`,
          missing: 'Tytuł artefaktu nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(artifact.outputType, 80),
          present: (value) => `Typ: ${value}.`,
          missing: 'Typ artefaktu nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(artifact.deliveryState, 80),
          present: (value) => `Status: ${value}.`,
          missing: 'Status artefaktu nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(artifact.visibilityScope, 80),
          present: (value) => `Widoczność: ${value}.`,
          missing: 'Widoczność artefaktu nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(artifact.ownerName, 160),
          present: (value) => `Właściciel: ${value}.`,
          missing: 'Właściciel artefaktu nie został zapisany w wybranym rekordzie.',
        },
        {
          value: normalizeFact(artifact.createdAt, 160),
          present: (value) => `Utworzono: ${value}.`,
          missing: 'Data utworzenia nie została zapisana w wybranym rekordzie.',
        },
        {
          value: normalizeFact(artifact.lastTransitionAt, 160),
          present: (value) => `Zaktualizowano: ${value}.`,
          missing: 'Data aktualizacji nie została zapisana w wybranym rekordzie.',
        },
      ]
    : [
        {
          value: normalizeFact(artifact.resolvedTitle, 160),
          present: (value) => `Output: ${value}.`,
          missing: 'The output title was not persisted in the selected record.',
        },
        {
          value: normalizeFact(artifact.outputType, 80),
          present: (value) => `Type: ${value}.`,
          missing: 'The output type was not persisted in the selected record.',
        },
        {
          value: normalizeFact(artifact.deliveryState, 80),
          present: (value) => `Status: ${value}.`,
          missing: 'The output status was not persisted in the selected record.',
        },
        {
          value: normalizeFact(artifact.visibilityScope, 80),
          present: (value) => `Visibility: ${value}.`,
          missing: 'The output visibility was not persisted in the selected record.',
        },
        {
          value: normalizeFact(artifact.ownerName, 160),
          present: (value) => `Owner: ${value}.`,
          missing: 'The output owner was not persisted in the selected record.',
        },
        {
          value: normalizeFact(artifact.createdAt, 160),
          present: (value) => `Created: ${value}.`,
          missing: 'The creation date was not persisted in the selected record.',
        },
        {
          value: normalizeFact(artifact.lastTransitionAt, 160),
          present: (value) => `Updated: ${value}.`,
          missing: 'The update date was not persisted in the selected record.',
        },
      ];

  if (!facts.some((fact) => fact.value)) return '';
  const fieldSentences = facts.map((fact) =>
    fact.value ? fact.present(fact.value) : fact.missing
  );
  const scopeNote = isPolish
    ? 'Ta sekcja Szczegóły zawiera wyłącznie fakty zapisane dla wybranego artefaktu. Pola bez zapisanych wartości pozostają jawnie niedostępne w interfejsie i nie są uzupełniane na podstawie innych rekordów. Zakres tekstu odpowiada dostępnemu rekordowi.'
    : 'This Details section contains only facts persisted for the selected output artifact. Fields without stored values remain explicitly unavailable in the interface and are not inferred from other records. The displayed scope therefore matches the available source row.';
  return capWords([...fieldSentences, scopeNote].join(' '));
};
