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
 * List UI follows the canonical StandardTable + StandardPreview pair. Every
 * catalog row is readable even when its execution engine is unavailable;
 * only the Start action is gated. This keeps Library a knowledge surface
 * instead of making unavailable methodologies inert dead rows.
 *
 * MVP compromise (ASM-001 audit, explicitly sanctioned): the backend does
 * NOT expose a "published only" filter endpoint yet — only
 * `GET /definitions/:methodologyId`, which returns draft+published+
 * deprecated rows. This component fetches that list and filters to
 * `status === 'published'` client-side, picking the newest version. Do not
 * ask the backend for a new endpoint here — one already exists.
 */
import { AlertTriangle, BookOpen, Clock3, Library as LibraryIcon, PlayCircle, RefreshCw } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { StandardPreview, type StandardRowMenu, StandardTable, type TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives/chips';
import { FRAMEWORK_CONFIGS } from '@/services/frameworkRegistry';
import {
  createSession as createMethodCoreSession,
  getSession as getMethodCoreSession,
  MethodCoreApiError,
  newIdempotencyKey,
} from '@/method-core/api/methodCoreApi';
import {
  DRD_METHOD_PACK_ID,
  DRD_METHOD_PACK_VERSION,
} from '@/method-core/methods/drd/compileDrdPack';

type MethodologyId = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface MethodologyRow {
  id: MethodologyId;
  name: string;
  description: string;
  supported: boolean;
  area: string;
  accessCondition: string;
  whatYouGet: string[];
  legalNotice: string | null;
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
    area: 'Digital transformation',
    accessCondition: 'Method Core available',
    whatYouGet: ['Current and target maturity by area', 'Evidence-backed findings', 'Report and initiative inputs'],
    legalNotice: FRAMEWORK_CONFIGS.DRD.legalNotice ?? null,
  },
  {
    id: 'SIRI',
    name: 'Smart Industry Readiness Index',
    description: 'Singapore SIRI Industry 4.0 maturity framework.',
    supported: false,
    area: 'Smart manufacturing',
    accessCondition: 'Knowledge available; execution coming soon',
    whatYouGet: ['Process, technology and organization view', 'Industry 4.0 maturity scale', 'Educational framework context'],
    legalNotice: FRAMEWORK_CONFIGS.SIRI.legalNotice ?? null,
  },
  {
    id: 'ADMA',
    name: 'Advanced Digital Maturity Assessment',
    description: 'Extended digital maturity model across process dimensions.',
    supported: false,
    area: 'Digital manufacturing',
    accessCondition: 'Knowledge available; execution coming soon',
    whatYouGet: ['Five-pillar maturity view', 'Dimension-level assessment structure', 'Educational framework context'],
    legalNotice: FRAMEWORK_CONFIGS.ADMA.legalNotice ?? null,
  },
  {
    id: 'CMMI',
    name: 'Capability Maturity Model Integration',
    description: 'Process capability and maturity model.',
    supported: false,
    area: 'Process capability',
    accessCondition: 'Knowledge available; execution coming soon',
    whatYouGet: ['Five maturity levels', 'Practice-area structure', 'Educational framework context'],
    legalNotice: FRAMEWORK_CONFIGS.CMMI.legalNotice ?? null,
  },
  {
    id: 'LEAN',
    name: 'Lean 4.0',
    description: 'Lean manufacturing maturity assessment.',
    supported: false,
    area: 'Lean and automation',
    accessCondition: 'Knowledge available; execution coming soon',
    whatYouGet: ['Measure → Optimize → Automate path', 'Lean maturity perspective', 'Automation and AI opportunity context'],
    legalNotice: FRAMEWORK_CONFIGS.LEAN.legalNotice ?? null,
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

export const AssessmentLibraryTab: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [startingId, setStartingId] = useState<MethodologyId | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<MethodologyId | null>(null);

  // ASM-BVP-001 production cutover: the mounted DRD Library row has exactly
  // one writer. It always creates a method-core session and the editor always
  // resumes that session over HTTP. Feature flags remain available to dev
  // harnesses, but are no longer allowed to route a production Start click to
  // the legacy assessments table (or to the localStorage demo runtime).
  const drdMethodCoreActive = true;

  // Double-click guards for the method-core create path — refs, not state,
  // see `shouldDispatchMethodCoreStart`'s header comment for why.
  const startInFlightRef = useRef<Set<MethodologyId>>(new Set());
  const startIdempotencyKeysRef = useRef<Map<MethodologyId, string>>(new Map());
  const failedStartRowRef = useRef<MethodologyRow | null>(null);

  // The DRD pack is bootstrapped and governed server-side. Non-DRD rows are
  // intentionally visible but disabled in this MVP.
  const canStartRow = useCallback(
    (row: MethodologyRow): boolean => {
      return row.id === 'DRD' && row.supported && drdMethodCoreActive;
    },
    [drdMethodCoreActive]
  );

  const handleStart = useCallback(
    async (row: MethodologyRow) => {
      if (!canStartRow(row)) return;
      // Synchronous re-entrancy guard — see `shouldDispatchMethodCoreStart`'s
      // header comment. Applied uniformly (not just the method-core branch)
      // so a double-click can never dispatch two legacy creates either.
      if (!shouldDispatchMethodCoreStart(startInFlightRef.current, row.id)) return;

      setStartingId(row.id);
      setStartError(null);
      failedStartRowRef.current = row;
      const toastId = toast.loading(`Starting ${row.name}…`);
      try {
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
        const readback = await getMethodCoreSession(res.session.id);
        if (
          readback.session.id !== res.session.id ||
          readback.session.module !== 'assessment' ||
          readback.session.methodPackId !== DRD_METHOD_PACK_ID ||
          readback.session.methodPackVersion !== DRD_METHOD_PACK_VERSION
        ) {
          throw new MethodCoreApiError(
            isPolish
              ? 'Serwer zwrócił sesję o innej tożsamości lub wersji metody.'
              : 'The server returned a session with a different identity or method version.',
            409,
            { error: 'session_readback_mismatch' }
          );
        }
        startIdempotencyKeysRef.current.delete(row.id);
        failedStartRowRef.current = null;
        toast.success(`${row.name} started`, { id: toastId });
        navigate(`/assessment/drd/${readback.session.id}`);
      } catch (e: any) {
        if (e instanceof MethodCoreApiError) {
          const reason =
            e.body?.error === 'pack_not_released'
              ? 'The DRD method pack is not yet registered for production sessions.'
              : e.status === 403
                ? isPolish
                  ? 'Nie masz uprawnień do uruchomienia lub odczytu tej sesji DRD.'
                  : 'You do not have permission to start or read this DRD session.'
                : e.status === 404
                  ? isPolish
                    ? 'Utworzona sesja DRD nie została znaleziona podczas odczytu kontrolnego.'
                    : 'The created DRD session was not found during canonical readback.'
                  : e.status === 409
                    ? isPolish
                      ? 'Sesja DRD jest w konflikcie wersji lub tożsamości. Ponów bez tworzenia kolejnej sesji.'
                      : 'The DRD session has a version or identity conflict. Retry without creating another session.'
                    : e.isNetworkError
                      ? isPolish
                        ? 'Brak połączenia. Ponówienie użyje tego samego klucza i nie utworzy drugiej sesji.'
                        : 'Offline. Retry will reuse the same key and cannot create a second session.'
                      : e.message || `Failed to start ${row.name}`;
          toast.error(reason, { id: toastId });
          setStartError(reason);
          // Every refusal/readback failure is ambiguous after POST dispatch.
          // Preserve the exact key until an exact canonical readback succeeds.
        } else {
          const reason = e?.message || `Failed to start ${row.name}`;
          toast.error(reason, { id: toastId });
          setStartError(reason);
        }
      } finally {
        setStartingId(null);
        startInFlightRef.current.delete(row.id);
      }
    },
    [canStartRow, isPolish, navigate]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: isPolish ? 'Metodyka' : 'Framework',
        render: (row: any) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-c-text">{row.name}</span>
            <span className="font-mono text-[11px] font-bold text-c-text-muted">{row.id}</span>
          </div>
        ),
      },
      {
        id: 'area',
        label: isPolish ? 'Obszar' : 'Area',
        width: '220px',
        render: (row: MethodologyRow) => row.area,
      },
      {
        id: 'status',
        label: 'Status',
        width: '220px',
        render: (row: MethodologyRow) => {
          if (row.id !== 'DRD') {
            return <StatusChip label={isPolish ? 'Wkrótce' : 'Coming soon'} tone="neutral" />;
          }
          return <StatusChip label={isPolish ? 'Rdzeń metody' : 'Method Core'} tone="success" />;
        },
      },
      {
        id: 'action',
        label: isPolish ? 'Działania' : 'Actions',
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
                  ? isPolish
                    ? `Uruchom nową ocenę ${row.name}`
                    : `Start a new ${row.name} assessment`
                  : isPolish
                    ? 'Niedostępne w tym MVP'
                    : 'Not available in this MVP'
              }
            >
              {startingId === row.id ? (
                <Clock3 size={14} className="animate-spin" />
              ) : (
                <PlayCircle size={14} />
              )}
              {isPolish ? 'Uruchom' : 'Start'}
            </button>
          );
        },
      },
    ],
    [canStartRow, startingId, handleStart, isPolish]
  );

  const data = useMemo(() => METHODOLOGY_CATALOG.map((row) => ({ ...row })), []);

  const rowMenu = useCallback(
    (row: any): StandardRowMenu => {
      const methodology = row as MethodologyRow;
      return {
        primary: [
          {
            id: 'read',
            label: isPolish ? 'Przeczytaj o metodzie' : 'Read about methodology',
            icon: BookOpen,
            onClick: () => setSelectedId(methodology.id),
          },
          ...(canStartRow(methodology)
            ? [
              {
                id: 'start',
                label: isPolish ? 'Uruchom' : 'Start',
                icon: PlayCircle,
                onClick: () => void handleStart(methodology),
              },
            ]
            : []),
        ],
        universalHandlers: { preview: () => setSelectedId(methodology.id) },
      };
    },
    [canStartRow, handleStart, isPolish]
  );

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
      {startError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <span>{startError}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              failedStartRowRef.current ? void handleStart(failedStartRowRef.current) : undefined
            }
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
          >
            <RefreshCw size={13} />
            {isPolish ? 'Ponów' : 'Retry'}
          </button>
        </div>
      )}
      <StandardTable
        columns={columns}
        data={data}
        loading={false}
        rowMenu={rowMenu}
        selectedRowId={selectedId}
        onRowClick={(row: any) => setSelectedId((row as MethodologyRow).id)}
        rowDescription={(row: any) => (row as MethodologyRow).description}
        persistKey="assessment.hub.library"
        empty={{
          icon: LibraryIcon,
          title: 'No assessment frameworks available',
          description: 'The methodology catalog could not be loaded.',
        }}
      />
      </div>
      {selectedId ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 p-3 dark:bg-navy-950">
          {(() => {
            const item = METHODOLOGY_CATALOG.find((row) => row.id === selectedId);
            if (!item) return null;
            return (
              <StandardPreview
                title={item.name}
                onClose={() => setSelectedId(null)}
                meta={{
                  pills: [
                    { label: item.id, tone: 'neutral' },
                    {
                      label: item.supported
                        ? isPolish ? 'Dostępna' : 'Available'
                        : isPolish ? 'Wkrótce' : 'Coming soon',
                      tone: item.supported ? 'success' : 'neutral',
                    },
                  ],
                }}
                details={{
                  text: `${item.description}\n\n${item.whatYouGet.map((value) => `• ${value}`).join('\n')}${item.legalNotice ? `\n\n${item.legalNotice}` : ''}`,
                  showWordCount: false,
                  properties: [
                    { id: 'area', label: isPolish ? 'Obszar' : 'Area', value: item.area },
                    { id: 'access', label: isPolish ? 'Dostęp' : 'Access', value: item.accessCondition },
                    {
                      id: 'commercial',
                      label: isPolish ? 'Warunki komercyjne' : 'Commercial terms',
                      value: isPolish ? 'Nie skonfigurowano w katalogu' : 'Not configured in catalog',
                    },
                  ],
                  propertyLabel: isPolish ? 'Właściwość' : 'Property',
                  valueLabel: isPolish ? 'Wartość' : 'Value',
                }}
                actions={item.supported ? {
                  informational: [{
                    id: 'start',
                    variant: 'neutral',
                    label: isPolish ? 'Uruchom assessment' : 'Start assessment',
                    icon: PlayCircle,
                    onClick: () => void handleStart(item),
                  }],
                } : undefined}
              />
            );
          })()}
        </aside>
      ) : null}
    </div>
  );
};

export default AssessmentLibraryTab;
