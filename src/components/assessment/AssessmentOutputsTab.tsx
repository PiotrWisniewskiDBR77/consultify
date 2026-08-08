import { ExternalLink, Package } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';
import { formatListDate } from '@/utils/listDateFormat';

import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';

// Server hard-caps at 200 regardless of what's requested
// (server/src/services/v8/artifactRegistryService.ts listArtifactsForUser:
// `deduped.slice(0, Math.max(1, Math.min(filters.limit || 100, 200)))`) —
// pass the max to give assessment-origin rows (a minority of any org's
// Outputs Library, sorted most-recently-updated first) the best chance of
// surviving that cap. KNOWN, DISCLOSED LIMITATION: there is no server-side
// filter by originRuntime on this endpoint yet, so a very active org could
// still have assessment outputs pushed past the cap by newer non-assessment
// artifacts. Not fixable from this isolated, frontend-only package — would
// require a backend change outside this package's file scope.
const ARTIFACTS_FETCH_LIMIT = 200;
const ASSESSMENT_REPORT_ORIGIN_RUNTIME = 'assessment_report';

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
interface AssessmentOutputArtifact {
  id: string;
  artifactId: string;
  /**
   * QA-CORRECTION-1 (2026-08-07): these five fields are `string | null`, NOT
   * defaulted, on purpose — normalizeArtifactRow() below must never invent a
   * value ('Untitled output', 'report', 'document', 'draft', 'organization')
   * when the registry didn't persist one. `null` here means "genuinely not
   * on the source row"; any placeholder text for it belongs at RENDER time
   * (the table cells / preview title below), never baked into this data,
   * and the Details prose must say so explicitly rather than presenting a
   * fabricated default as a persisted fact.
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
async function fetchAssessmentOutputArtifacts(): Promise<AssessmentOutputArtifact[]> {
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
// assessmentPreviewDetails.ts (T21/T23/T24) — deliberately reimplemented
// here rather than imported, to keep this package isolated: it must not
// depend on T20-T24's AssessmentHub work, which isn't integrated with this
// tab yet.

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
function buildAssessmentOutputPreviewDetails(
  artifact: AssessmentOutputArtifact | null | undefined,
  language: 'pl' | 'en'
): string {
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
}

/**
 * T22-TABLE-PREVIEW-COMPONENT (T22-TABLE-T00 / T22-PREVIEW-P01 core) —
 * isolated Outputs table + row preview, built directly against the
 * canonical Outputs Library (`GET /api/artifacts`, filtered client-side to
 * `originRuntime === 'assessment_report'`; see the module-level helpers
 * above).
 *
 * T22-KEBAB-K01 / T22-PPM-C01: `rowMenu` below is a strict, truthful
 * reflection of what the registry actually gives each row —
 * `universalHandlers.preview` (always available; opens the same docked
 * StandardPreview row click does) and a `primary` "Open full" item ONLY
 * when `row.openPath` is present (today: assessment_report rows have one,
 * pointing back to the assessment run; exportPath/deletePath are always
 * null for this origin, so no Export/Delete/Duplicate/Edit/Archive/Rename
 * item — real or disabled — is offered). Passing `rowMenu` to StandardTable
 * gives PPM (right-click) the identical action set automatically
 * (FilterableTable's PPM-mirror reads the same `getRowActionSections`
 * derivation the kebab uses) — no separate PPM implementation here.
 *
 * Still deliberately excludes selection/Menu 3 (`selection` prop omitted) —
 * a separate, not-yet-authorized atom (T22-MENU_1_2_3-M14).
 *
 * Wired into AssessmentHub.tsx as the 'outputs' tab's default view when no
 * assessment is selected yet — `AssessmentQualityReviewPanel`
 * (ASM-005/006/007, shipped to `origin/demo` independently after this
 * package branched off) still owns the per-assessment evidence/scoring
 * view once one is selected on Processes. The two are mutually exclusive
 * (never rendered together), so this is additive, not a duplicate surface.
 */
interface AssessmentOutputsTabProps {
  onCountChange?: (count: number | null) => void;
}

export const AssessmentOutputsTab: React.FC<AssessmentOutputsTabProps> = ({ onCountChange }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<AssessmentOutputArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  // QA-CORRECTION-2: a boolean flag, not the raw error text. A server/network
  // failure can carry URLs, SQL fragments, or credential-shaped strings in
  // `e.message` — that must never reach the DOM. The actual error is logged
  // for developers only (console.error below); the UI always renders one
  // fixed, localized, generic string (computed at render time, see `error`
  // below) regardless of what failed or why.
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  // Deliberately NO dependency on `t`: react-i18next's `t` is not guaranteed
  // referentially stable across renders (and isn't in this suite's mock),
  // so depending on it here would re-trigger the effect below on every
  // render — re-fetching and, worse, racing a freshly-selected row's data
  // out from under an open preview. `load` only closes over stable setState
  // functions and the latest parent callback held in a ref, so an empty
  // dependency array is correct, not a lint escape.
  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    fetchAssessmentOutputArtifacts()
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        onCountChangeRef.current?.(rows.length);
      })
      .catch(() => {
        if (cancelled) return;
        // Honest error state — no fallback to a fabricated/demo row set.
        setItems([]);
        setHasLoadError(true);
        onCountChangeRef.current?.(null);
        // Do not log the raw exception: upstream messages can contain URLs,
        // SQL fragments, authorization headers, or other sensitive values.
        // eslint-disable-next-line no-console -- fixed diagnostic only.
        console.error('[AssessmentOutputsTab] failed to load outputs registry');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const previewDetailsText = useMemo(
    () => buildAssessmentOutputPreviewDetails(selected, isPolish ? 'pl' : 'en'),
    [selected, isPolish]
  );

  // QA-CORRECTION-1: every fallback below is a `render`-time visual
  // placeholder only — it never gets written back into `items`/state, so it
  // can never be mistaken for a persisted fact (contrast with the Details
  // prose above, which says "not persisted" explicitly instead of
  // substituting a placeholder).
  const untitledLabel = t('assessment.outputs.table.untitled', 'Untitled output');
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'resolvedTitle',
        label: t('assessment.outputs.table.title', 'Title'),
        sortable: true,
        render: (row) => row.resolvedTitle || untitledLabel,
      },
      {
        id: 'outputType',
        label: t('assessment.outputs.table.type', 'Type'),
        width: '120px',
        sortable: true,
        render: (row) => row.outputType || '—',
      },
      {
        id: 'deliveryState',
        label: t('assessment.outputs.table.status', 'Status'),
        width: '120px',
        sortable: true,
        render: (row) => row.deliveryState || '—',
      },
      {
        id: 'ownerName',
        label: t('assessment.outputs.table.owner', 'Owner'),
        width: '160px',
        render: (row) => row.ownerName || '—',
      },
      {
        id: 'lastTransitionAt',
        label: t('assessment.outputs.table.updated', 'Updated'),
        width: '140px',
        sortable: true,
        render: (row) => (row.lastTransitionAt ? formatListDate(row.lastTransitionAt) : '—'),
      },
    ],
    [t, untitledLabel]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const pills: MetaPill[] = [];
    // QA-CORRECTION-1: a pill is only rendered when there is a real value to
    // show. A missing outputType/deliveryState is not "neutral" or
    // "success" — it's absent, so no pill for it at all, rather than a
    // fabricated label or a tone (warning/success) implying a status we
    // don't actually have.
    if (selected.outputType) {
      pills.push({ label: selected.outputType, tone: 'neutral' });
    }
    if (selected.deliveryState) {
      pills.push({
        label: selected.deliveryState,
        tone: selected.isDraft ? 'warning' : 'success',
      });
    }
    return pills;
  }, [selected]);

  // T22-KEBAB-K01 / T22-PPM-C01: see the module doc comment above — strictly
  // truthful, no invented actions/labels, drives both kebab and PPM.
  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const openPath = typeof row.openPath === 'string' ? row.openPath : null;
      return {
        primary: openPath
          ? [
              {
                id: 'open-full',
                label: t('assessment.outputs.rowMenu.openFull', 'Open full'),
                icon: ExternalLink,
                onClick: () => navigate(openPath),
              },
            ]
          : undefined,
        universalHandlers: {
          preview: () => setSelectedId(String(row.id)),
        },
      };
    },
    [navigate, t]
  );

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
        <StandardTable
          columns={columns}
          data={items}
          loading={loading}
          error={
            hasLoadError
              ? isPolish
                ? 'Nie udało się wczytać artefaktów. Spróbuj ponownie.'
                : 'Failed to load outputs. Please try again.'
              : null
          }
          onRetry={load}
          persistKey="assessment.outputs"
          defaultSort={{ columnId: 'lastTransitionAt', direction: 'desc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            icon: Package,
            title: t('assessment.outputs.emptyState.title', 'No outputs yet'),
            description: t(
              'assessment.outputs.emptyState.description',
              'Assessment outputs promoted to the Outputs Library will appear here.'
            ),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={selected.resolvedTitle || untitledLabel}
            onClose={() => setSelectedId(null)}
            onOpenFull={selected.openPath ? () => navigate(selected.openPath as string) : undefined}
            meta={{
              pills: metaPills,
              trailing: selected.lastTransitionAt ? (
                <span className="text-[11px] font-semibold text-c-text-secondary">
                  {formatListDate(selected.lastTransitionAt)}
                </span>
              ) : undefined,
            }}
            details={{
              text: previewDetailsText,
              onCopy: () => {
                void navigator.clipboard?.writeText(previewDetailsText);
              },
            }}
            relations={[]}
          />
        </aside>
      ) : null}
    </div>
  );
};

export default AssessmentOutputsTab;
