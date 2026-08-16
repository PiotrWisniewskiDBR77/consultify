/**
 * AssessmentLibraryTab — ASM-001A Library surface.
 *
 * Thin adapter, NOT a new store: reads published DRD assessment definitions
 * from the existing V8 definitions endpoint and starts a new assessment
 * bound to the newest published version. SIRI/ADMA/CMMI/Lean are shown as
 * disabled catalog rows (no engine yet) — per ASM-001 audit, "cards not
 * supported in MVP can be disabled with an explicit status" rather than
 * hidden (TRIADA_KANON.md C3: a disabled row explains WHY, it never lies by
 * omission).
 *
 * List UI is StandardTable ONLY (docs/ui-standards/TRIADA_KANON.md — list
 * screens use StandardModuleBar/StandardTable/StandardPreview exclusively,
 * no bespoke tables/menus). This tab has no preview aside: rows either start
 * an assessment (navigates away) or are inert (disabled, nothing to preview).
 *
 * MVP compromise (ASM-001 audit, explicitly sanctioned): the backend does
 * NOT expose a "published only" filter endpoint yet — only
 * `GET /definitions/:methodologyId`, which returns draft+published+
 * deprecated rows. This component fetches that list and filters to
 * `status === 'published'` client-side, picking the newest version. Do not
 * ask the backend for a new endpoint here — one already exists.
 */
import { Clock3, Library as LibraryIcon, PlayCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ErrorState } from '@/components/shared/states';
import { type StandardRowMenu, StandardTable, type TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives/chips';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import {
  createSession as createMethodCoreSession,
  MethodCoreApiError,
  newIdempotencyKey,
} from '@/method-core/api/methodCoreApi';
import { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } from '@/method-core/methods/drd/compileDrdPack';
import { V8AssessmentApi } from '@/services/api/v8';
import type { V8AssessmentDefinitionRecord } from '@/services/api/v8/assessment';

type MethodologyId = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface MethodologyRow {
  id: MethodologyId;
  name: string;
  description: string;
  supported: boolean;
}

// Static catalog — only DRD has a real published-definition-backed engine
// today. The other four are declared (not hidden) so the Library reads as a
// complete map of what Consultify assesses, not just what's finished.
const METHODOLOGY_CATALOG: MethodologyRow[] = [
  {
    id: 'DRD',
    name: 'Digital Readiness Diagnosis',
    description: 'Assess digital maturity across 5 axes, area by area.',
    supported: true,
  },
  {
    id: 'SIRI',
    name: 'Smart Industry Readiness Index',
    description: 'Singapore SIRI Industry 4.0 maturity framework.',
    supported: false,
  },
  {
    id: 'ADMA',
    name: 'Advanced Digital Maturity Assessment',
    description: 'Extended digital maturity model across process dimensions.',
    supported: false,
  },
  {
    id: 'CMMI',
    name: 'Capability Maturity Model Integration',
    description: 'Process capability and maturity model.',
    supported: false,
  },
  {
    id: 'LEAN',
    name: 'Lean 4.0',
    description: 'Lean manufacturing maturity assessment.',
    supported: false,
  },
];

// ---------------------------------------------------------------------------
// ASM-BVP-001 — double-click guard for the method-core create-session path.
//
// Pure, ref-driven (never React state): a `useState` re-render gap means two
// rapid clicks can both read the SAME pre-update `startingId` value — state
// updates are not visible to a second synchronous event handler invocation
// until the component actually re-renders. A plain mutable ref has no such
// gap (JS is single-threaded; the first call's synchronous `.add()` is
// visible to the second call immediately), so it is the one used to decide
// whether a click may dispatch a create request at all. Exported so the
// double-click guarantee is testable without mounting the full component
// (see tests/assessmentBvp/AssessmentLibraryTab.methodCoreStart.test.ts).
// ---------------------------------------------------------------------------
export function shouldDispatchMethodCoreStart(inFlight: Set<string>, rowId: string): boolean {
  if (inFlight.has(rowId)) return false;
  inFlight.add(rowId);
  return true;
}

/**
 * Returns a stable Idempotency-Key for THIS in-flight start attempt on
 * `rowId` — generated once (via `generate`) and reused for as long as the
 * attempt is in flight (including any underlying HTTP retry inside
 * `fetchWithRetry`), never re-randomized mid-attempt. Combined with
 * `shouldDispatchMethodCoreStart`'s synchronous re-entrancy guard above, a
 * double-click can therefore never reach the network as two distinct
 * `POST /api/method/sessions` calls with two different keys.
 */
export function getOrCreateStartIdempotencyKey(
  keys: Map<string, string>,
  rowId: string,
  generate: () => string
): string {
  const existing = keys.get(rowId);
  if (existing) return existing;
  const created = generate();
  keys.set(rowId, created);
  return created;
}

function pickLatestPublished(
  versions: V8AssessmentDefinitionRecord[]
): V8AssessmentDefinitionRecord | null {
  const published = versions.filter((v) => v.status === 'published');
  if (published.length === 0) return null;
  const EPOCH = '1970-01-01T00:00:00.000Z';
  return [...published].sort((a, b) => {
    const at = new Date(a.publishedAt || a.updatedAt || a.createdAt || EPOCH).getTime();
    const bt = new Date(b.publishedAt || b.updatedAt || b.createdAt || EPOCH).getTime();
    return bt - at;
  })[0];
}

export const AssessmentLibraryTab: React.FC = () => {
  const navigate = useNavigate();
  // ASM-UI-CANON-001 (2026-08-16): was the bare `useFeatureFlags()` hook,
  // which creates its OWN independent flag-resolution state (defaults
  // `enableLocalOverrides` to false) instead of reading the app-level
  // `<FeatureFlagsProvider>` — so `VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true`
  // + a `consultify_feature_flags` localStorage override could never reach
  // `drdMethodWorkspaceSliceV1`/`drdHttpSourceOfTruthV1` here, even though
  // both flags declare `allowLocalOverride: true` and every other Assessment
  // surface (AssessmentHub.tsx) already reads flags through the context.
  // `useFeatureFlagsContext()` returns the identical `UseFeatureFlagsReturn`
  // shape, so this is a pure fix, not a behavior change to default (OFF)
  // flag values.
  const { isEnabled } = useFeatureFlagsContext();
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [drdDefinition, setDrdDefinition] = useState<V8AssessmentDefinitionRecord | null>(null);
  const [startingId, setStartingId] = useState<MethodologyId | null>(null);

  // ASM-BVP-001: the DRD method-core workspace path is active only when BOTH
  // flags are on — `drdMethodWorkspaceSliceV1` mounts DrdMethodWorkspaceScreen
  // at all, `drdHttpSourceOfTruthV1` is what makes it actually resolve the
  // route id via `GET /api/method/sessions/:id` instead of treating it as an
  // opaque localStorage key (src/method-core/methods/drd/drdHttpSessionRuntime.ts).
  // Both default OFF (src/hooks/useFeatureFlags.tsx) — with either off, this
  // branch never runs and `handleStart` is BYTE-FOR-BYTE the legacy
  // `V8AssessmentApi.createAssessment` call it always was.
  const drdMethodCoreActive =
    isEnabled('drdMethodWorkspaceSliceV1') && isEnabled('drdHttpSourceOfTruthV1');

  // Double-click guards for the method-core create path — refs, not state,
  // see `shouldDispatchMethodCoreStart`'s header comment for why.
  const startInFlightRef = useRef<Set<MethodologyId>>(new Set());
  const startIdempotencyKeysRef = useRef<Map<MethodologyId, string>>(new Map());

  const loadDrdDefinition = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const resp = await V8AssessmentApi.getDefinitions('DRD');
      const latest = pickLatestPublished(resp?.versions || []);
      setDrdDefinition(latest);
      if (!latest) {
        setFetchError(
          'No published DRD definition found yet — Start will be disabled until one is published.'
        );
      }
    } catch (e: any) {
      setFetchError(e?.message || 'Could not load the assessment definition catalog.');
      setDrdDefinition(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrdDefinition();
  }, [loadDrdDefinition]);

  // Whether Start may be clicked for this row at all — for DRD under the
  // method-core path, the legacy `drdDefinition` (a DIFFERENT, V8
  // `assessment_definitions`-backed catalog, unrelated to `method_packs`) is
  // no longer a precondition: the DRD pack is bootstrapped server-side by
  // `ensureDrdPackRegistered` (server/src/method-core/MethodPackRegistry.ts)
  // on the create-session path itself.
  const canStartRow = useCallback(
    (row: MethodologyRow): boolean => {
      if (!row.supported) return false;
      if (row.id === 'DRD' && drdMethodCoreActive) return true;
      return !!drdDefinition;
    },
    [drdDefinition, drdMethodCoreActive]
  );

  const handleStart = useCallback(
    async (row: MethodologyRow) => {
      if (!canStartRow(row)) return;
      // Synchronous re-entrancy guard — see `shouldDispatchMethodCoreStart`'s
      // header comment. Applied uniformly (not just the method-core branch)
      // so a double-click can never dispatch two legacy creates either.
      if (!shouldDispatchMethodCoreStart(startInFlightRef.current, row.id)) return;

      const methodCoreDrdStart = row.id === 'DRD' && drdMethodCoreActive;

      setStartingId(row.id);
      const toastId = toast.loading(`Starting ${row.name}…`);
      try {
        if (methodCoreDrdStart) {
          // ASM-BVP-001: real `method_sessions` row via the shared kernel —
          // NEVER also INSERTs into the legacy `assessments` table (no dual
          // write: CLAUDE.md / frozen MVP decision #1). `mode: 'guided_manual'`
          // matches what the legacy DRD editor always was — Library "Start"
          // has no UI for choosing Teresa-led mode yet.
          const idempotencyKey = getOrCreateStartIdempotencyKey(
            startIdempotencyKeysRef.current,
            row.id,
            newIdempotencyKey
          );
          const res = await createMethodCoreSession(
            {
              module: 'assessment',
              methodPackId: DRD_METHOD_PACK_ID,
              methodPackVersion: DRD_METHOD_PACK_VERSION,
              mode: 'guided_manual',
              projectId: null,
            },
            idempotencyKey
          );
          toast.success(`${row.name} started`, { id: toastId });
          // Same URL shape the legacy path below already navigates to
          // (`/assessment/<framework>/<id>`) — `shouldMountDrdMethodWorkspace`
          // (src/views/AssessmentSessionEditorView.tsx) keys off the lowercase
          // 'drd' framework segment, unchanged by this branch.
          navigate(`/assessment/drd/${res.session.id}`);
        } else {
          const created = await V8AssessmentApi.createAssessment({
            assessmentType: row.id,
            name: `${row.name} — ${new Date().toLocaleDateString()}`,
            definitionId: (drdDefinition as V8AssessmentDefinitionRecord).id,
            definitionVersion: (drdDefinition as V8AssessmentDefinitionRecord).version,
          });
          const newId = (created as any)?.id || (created as any)?.assessment?.id;
          if (!newId) throw new Error('Assessment created but no id was returned');
          toast.success(`${row.name} started`, { id: toastId });
          navigate(`/assessment/${row.id.toLowerCase()}/${newId}`);
        }
      } catch (e: any) {
        if (e instanceof MethodCoreApiError) {
          const reason =
            e.body?.error === 'pack_not_released'
              ? 'The DRD method pack is not yet registered for production sessions.'
              : e.message || `Failed to start ${row.name}`;
          toast.error(reason, { id: toastId });
        } else {
          const code = e?.data?.code;
          if (code === 'DEFINITION_NOT_PUBLISHED' || code === 'DEFINITION_NOT_FOUND') {
            toast.error(
              code === 'DEFINITION_NOT_PUBLISHED'
                ? 'This DRD definition is no longer published. Refreshing the Library…'
                : 'The selected DRD definition could not be found. Refreshing the Library…',
              { id: toastId }
            );
            void loadDrdDefinition();
          } else {
            toast.error(e?.message || `Failed to start ${row.name}`, { id: toastId });
          }
        }
      } finally {
        setStartingId(null);
        startInFlightRef.current.delete(row.id);
        startIdempotencyKeysRef.current.delete(row.id);
      }
    },
    [canStartRow, drdDefinition, drdMethodCoreActive, navigate, loadDrdDefinition]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Framework',
        render: (row: any) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-c-text">{row.name}</span>
            <span className="font-mono text-[11px] font-bold text-c-text-muted">{row.id}</span>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        width: '220px',
        render: (row: MethodologyRow) => {
          if (row.id !== 'DRD') {
            return <StatusChip label="Coming soon" tone="neutral" />;
          }
          // Method-core path: DRD is startable via the governed `method_packs`
          // bootstrap regardless of the legacy V8 definitions catalog — see
          // `drdMethodCoreActive`'s header comment. Only rendered when BOTH
          // flags are ON (default OFF), so this never paints for Piotr before
          // an explicit accepted flag flip (CLAUDE.md rule #7).
          if (drdMethodCoreActive) {
            return <StatusChip label="Method Core (pilot)" tone="success" />;
          }
          if (isLoading) {
            return <StatusChip label="Checking…" tone="neutral" />;
          }
          if (drdDefinition) {
            return <StatusChip label={`Published v${drdDefinition.version}`} tone="success" />;
          }
          return <StatusChip label="Unavailable" tone="danger" />;
        },
      },
      {
        id: 'action',
        label: 'Actions',
        width: '140px',
        render: (row: MethodologyRow) => {
          const disabled = !canStartRow(row) || startingId === row.id;
          return (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                void handleStart(row);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-sm font-medium text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] disabled:cursor-not-allowed disabled:opacity-50"
              title={
                canStartRow(row)
                  ? `Start a new ${row.name} assessment`
                  : row.supported
                    ? 'No published definition available yet'
                    : 'Not available in this MVP'
              }
            >
              {startingId === row.id ? (
                <Clock3 size={14} className="animate-spin" />
              ) : (
                <PlayCircle size={14} />
              )}
              Start
            </button>
          );
        },
      },
    ],
    [canStartRow, drdDefinition, drdMethodCoreActive, isLoading, startingId, handleStart]
  );

  const data = useMemo(() => METHODOLOGY_CATALOG.map((row) => ({ ...row })), []);

  const rowMenu = useCallback(
    (row: any): StandardRowMenu => {
      const methodology = row as MethodologyRow;
      return {
        primary: canStartRow(methodology)
          ? [
              {
                id: 'start',
                label: 'Start',
                icon: PlayCircle,
                onClick: () => void handleStart(methodology),
              },
            ]
          : [],
      };
    },
    [canStartRow, handleStart]
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      {fetchError && (
        <ErrorState
          compact
          title="DRD definition catalog"
          description={fetchError}
          onRetry={() => void loadDrdDefinition()}
        />
      )}
      <StandardTable
        columns={columns}
        data={data}
        loading={isLoading && !fetchError}
        rowMenu={rowMenu}
        rowDescription={(row: any) => (row as MethodologyRow).description}
        persistKey="assessment.hub.library"
        empty={{
          icon: LibraryIcon,
          title: 'No assessment frameworks available',
          description: 'The methodology catalog could not be loaded.',
        }}
      />
    </div>
  );
};

export default AssessmentLibraryTab;
