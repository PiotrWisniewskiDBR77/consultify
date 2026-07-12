/**
 * InterviewLightShell — lightweight, dense redesign of the Interview module
 * surface (companion to `DRDLightShell` / `FinanceLightShell` — same
 * doctrine, same shell shape, see `docs/ui-standards/DOKTRYNA_GESTOSCI.md`).
 * NEW component; `InterviewHub.tsx` is untouched. Gated OFF by default
 * behind `interviewLightFlag.ts` (`?ff_interviewLight=1`) — real wiring
 * into InterviewHub is a later step, only after Piotr signs off on the
 * harness screenshot (CLAUDE.md rule #7: no flag-flip as a first look).
 *
 * Composition mirrors DRDLightShell / FinanceLightShell:
 *   1. Compact header strip (breadcrumb · cycle name · counts chip · CTA).
 *   2. Left rail: 3 sections — Sesje · Przypisane · Insighty (owner notes
 *      #50/#50a: the hub's 7 tabs collapse to the 3 that matter for a
 *      working consultant; "Aktualne/Zarchiwizowane" becomes a segmented
 *      VIEW SWITCH inside Sesje, not a 4th tab — doktryna gęstości §4:
 *      "redundantne widoki tych samych danych → jeden widok + przełącznik").
 *   3. Center: real engine OUTPUT SHAPES rendered densely, no empty panels:
 *      - Sesje: the REAL `<StandardTable>` facade (import, not
 *        reimplementation — TRIADA kanon, see `scripts/check-list-canon.sh`
 *        which blocks bespoke list-tables after the 2026-07-12 regression
 *        where this exact file shipped a hand-rolled grid). Columns: Sesja /
 *        Respondent / Wynik AI (0-20, Oxford rubric —
 *        `INTERVIEW_RUBRIC_CRITERIA` in
 *        `server/src/controllers/InterviewController.ts` #48a) / Werdykt /
 *        Status — Werdykt+Status use `<StatusChip>`/`<EntityStatusChip>`
 *        (leading status dot, canon §4.1). The row-description toggle (MUST
 *        #3) reveals the full per-criterion rubric breakdown (owner note
 *        #48: odbiór menedżerski needs the rubric visible, not a black-box
 *        score) — the canonical replacement for the old per-row expand.
 *      - Przypisane: assignment inbox — assignee, due date, status,
 *        one primary action per row (Kontynuuj/Otwórz).
 *      - Insighty: dense insight cards — category, confidence, evidence
 *        count, source session.
 *   4. Right rail: "Rubryka oceny" (the 5 real criteria, reused verbatim
 *      from the engine — concreteness/evidence/depth/measurability/
 *      coherence) + Teresa assist + Aktywność — mirrors DRDLightShell's
 *      "Źródła i założenia" / "Aktywność" pattern.
 *
 * COLOR DOCTRINE (hard, identical to DRDLightShell/FinanceLightShell):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. Active tab / primary numbers = the blue focus token
 *     (`--c-focus-solid`). AI verdict: ready_for_approval = `c-success`,
 *     needs_improvement = `c-warning`, insufficient/empty = `c-danger`/muted.
 *     Primary CTA is neutral (`bg-c-text text-c-surface`).
 *   - All colors via c-* tokens (Tailwind classes or `var(--c-*)` /
 *     `rgb(var(--c-*-rgb) / a)`), never raw hex — both themes adapt.
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context — exactly like `EvBasketFootballField`. Mock data
 * for the dev-render harness lives in `dev-render/screens/interview-light.tsx`,
 * not here (same split as `finance-light.tsx` vs `FinanceLightShell.tsx`).
 */
import {
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  Lightbulb,
  MessageSquare,
  UserCheck,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import StandardTable, {
  type StandardRowMenu,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';
import { EntityStatusChip, StatusChip, type StatusTone } from '../ui/primitives/chips';

// ---------------------------------------------------------------------------
// Types — lightweight mirrors of the server engine output shapes
// (InterviewController.ts #48a rubric / assignment / insight rows). Kept
// local to the frontend bundle (src/ never imports server/ directly in this
// codebase). Rubric criteria keys/labels are reused VERBATIM from
// `INTERVIEW_RUBRIC_CRITERIA` so the light shell never invents its own
// scoring vocabulary.
// ---------------------------------------------------------------------------

export type InterviewRubricCriterionKey =
  | 'concreteness'
  | 'evidence'
  | 'depth'
  | 'measurability'
  | 'coherence';

export interface InterviewRubricCriterionLite {
  criterion: InterviewRubricCriterionKey;
  score: number; // 0..4
  justification?: string;
}

export type InterviewOverallVerdict =
  | 'ready_for_approval'
  | 'needs_improvement'
  | 'insufficient'
  | 'empty';

export type InterviewSessionStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'sent_back'
  | 'approved'
  | 'completed';

export interface InterviewSessionLite {
  id: string;
  title: string;
  respondent: string;
  status: InterviewSessionStatus;
  archived?: boolean;
  updatedAtLabel: string;
  questionsAnswered: number;
  questionsTotal: number;
  rubric: InterviewRubricCriterionLite[];
  overallVerdict: InterviewOverallVerdict | null;
}

export type InterviewAssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'sent_back';

export interface InterviewAssignmentLite {
  id: string;
  title: string;
  assignee: string;
  dueLabel: string;
  overdue?: boolean;
  status: InterviewAssignmentStatus;
}

export interface InterviewInsightLite {
  id: string;
  title: string;
  category: string;
  summary: string;
  confidencePct: number;
  evidenceCount: number;
  sourceSessionTitle: string;
}

export interface InterviewLineageSourceLite {
  label: string;
  detail: string;
}

interface InterviewLightShellProps {
  cycleName?: string;
  sessions?: InterviewSessionLite[];
  assignments?: InterviewAssignmentLite[];
  insights?: InterviewInsightLite[];
  lineageSources?: InterviewLineageSourceLite[];
  lastUpdatedLabel?: string;
  onNewSession?: () => void;
  onOpenChat?: () => void;
}

type LightTab = 'sessions' | 'assigned' | 'insights';
type SessionView = 'active' | 'archived';

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const TAB_ICON: Record<LightTab, React.ReactNode> = {
  sessions: <ClipboardList className="h-[13px] w-[13px]" />,
  assigned: <UserCheck className="h-[13px] w-[13px]" />,
  insights: <Lightbulb className="h-[13px] w-[13px]" />,
};

// Reused verbatim from `INTERVIEW_RUBRIC_CRITERIA` in InterviewController.ts
// (#48a — Oxford-style objective rubric). Keep in the same declared order so
// the heat bar / breakdown always reads left-to-right identically to the
// engine's canonical order.
const RUBRIC_CRITERIA: Array<{
  key: InterviewRubricCriterionKey;
  labelPl: string;
  descriptionPl: string;
}> = [
  {
    key: 'concreteness',
    labelPl: 'Konkretność',
    descriptionPl:
      'Konkretne fakty, nazwy, liczby lub przykłady zamiast ogólników ("trochę", "sporo", "staramy się").',
  },
  {
    key: 'evidence',
    labelPl: 'Dowody',
    descriptionPl:
      'Podaje coś sprawdzalnego — dane, nazwany system/proces, dokument lub zaobserwowane zdarzenie.',
  },
  {
    key: 'depth',
    labelPl: 'Głębia',
    descriptionPl:
      'Wykracza poza powtórzenie pytania — wyjaśnia mechanizm, przyczynę źródłową lub kompromis.',
  },
  {
    key: 'measurability',
    labelPl: 'Mierzalność',
    descriptionPl:
      'Zawiera mierzalne, weryfikowalne stwierdzenie (liczbę, datę, procent, próg, nazwane porównanie).',
  },
  {
    key: 'coherence',
    labelPl: 'Spójność',
    descriptionPl:
      'Bezpośrednio i spójnie odpowiada na zadane pytanie, bez sprzeczności i bez odchodzenia od tematu.',
  },
];
const RUBRIC_MAX_PER_CRITERION = 4;
const RUBRIC_MAX_TOTAL = RUBRIC_CRITERIA.length * RUBRIC_MAX_PER_CRITERION; // 20

function rubricTotal(rubric: InterviewRubricCriterionLite[]): number {
  return rubric.reduce((sum, r) => sum + r.score, 0);
}

// Werdykt tone/label — feeds <StatusChip> (canon §4.1, leading status dot).
// Same semantic mapping as before (ready_for_approval=success/needs_improvement
// =warning/insufficient=danger/empty=neutral), just carried by the dot now
// instead of a bespoke icon.
const VERDICT_LABEL_PL: Record<InterviewOverallVerdict, string> = {
  ready_for_approval: 'gotowe do akceptacji',
  needs_improvement: 'do poprawy',
  insufficient: 'niewystarczające',
  empty: 'brak odpowiedzi',
};
const VERDICT_TONE: Record<InterviewOverallVerdict, StatusTone> = {
  ready_for_approval: 'success',
  needs_improvement: 'warning',
  insufficient: 'danger',
  empty: 'neutral',
};

const SESSION_STATUS_LABEL_PL: Record<InterviewSessionStatus, string> = {
  assigned: 'Przypisano',
  in_progress: 'W toku',
  submitted: 'Złożono',
  sent_back: 'Odesłano',
  approved: 'Zatwierdzono',
  completed: 'Zakończono',
};

const ASSIGNMENT_STATUS_LABEL_PL: Record<InterviewAssignmentStatus, string> = {
  assigned: 'Przypisano',
  in_progress: 'W toku',
  submitted: 'Złożono',
  sent_back: 'Odesłano',
};

export const InterviewLightShell: React.FC<InterviewLightShellProps> = ({
  cycleName,
  sessions = [],
  assignments = [],
  insights = [],
  lineageSources = [],
  lastUpdatedLabel,
  onNewSession,
  onOpenChat,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [activeTab, setActiveTab] = useState<LightTab>('sessions');
  const [sessionView, setSessionView] = useState<SessionView>('active');
  // Row highlight for the StandardTable session list (canon selectedRowId —
  // replaces the old bespoke per-row expand state).
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const activeSessions = useMemo(() => sessions.filter((s) => !s.archived), [sessions]);
  const archivedSessions = useMemo(() => sessions.filter((s) => s.archived), [sessions]);
  const visibleSessions = sessionView === 'active' ? activeSessions : archivedSessions;

  const TAB_LABEL: Record<LightTab, string> = {
    sessions: t('Sesje', 'Sessions'),
    assigned: t('Przypisane', 'Assigned'),
    insights: t('Insighty', 'Insights'),
  };
  const TAB_META: Record<LightTab, string> = {
    sessions: `${activeSessions.length} ${t('aktualnych', 'active')} · ${archivedSessions.length} ${t(
      'archiw.',
      'archived'
    )}`,
    assigned: `${assignments.length} ${t('w toku', 'open')}`,
    insights: `${insights.length} ${t('wniosków', 'items')}`,
  };

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact header strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          {t('Wywiad', 'Interview')} <span className="mx-1 text-c-text-secondary">›</span> {TAB_LABEL[activeTab]}
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {cycleName || t('Cykl wywiadów DBR77 · FY2026', 'DBR77 interview cycle · FY2026')}
        </h1>
        <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
          {sessions.length} {t('sesji', 'sessions')}
        </span>

        <span className="flex-1" />

        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <MessageSquare className="h-4 w-4" />
            {t('Zapytaj Teresę', 'Ask Teresa')}
          </button>
        )}
        <button
          type="button"
          onClick={onNewSession}
          disabled={!onNewSession}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3.5 py-1.5 text-[13px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          {t('Nowa sesja', 'New session')}
        </button>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[212px_1fr] lg:grid-cols-[212px_1fr_300px]">
        {/* NAV RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Wywiady', 'Interview')}
          </p>
          <div className="flex flex-col gap-0.5">
            {(['sessions', 'assigned', 'insights'] as LightTab[]).map((tab) => {
              const on = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    on ? '' : 'hover:bg-c-surface-raised'
                  }`}
                  style={on ? { backgroundColor: BLUE_SOFT } : undefined}
                >
                  <span
                    className="grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: 'var(--c-surface)', border: `1px solid ${on ? BLUE : 'var(--c-border)'}` }}
                  >
                    <span className="text-c-text-secondary" style={on ? { color: BLUE } : undefined}>
                      {TAB_ICON[tab]}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] leading-tight tracking-tight ${
                        on ? 'font-semibold' : 'text-c-text'
                      }`}
                      style={on ? { color: BLUE } : undefined}
                    >
                      {TAB_LABEL[tab]}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-c-text-muted tabular-nums">
                      {TAB_META[tab]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* CENTER */}
        <main className="min-w-0 overflow-y-auto px-6 py-5">
          {activeTab === 'sessions' && (
            <SessionsTab
              sessionView={sessionView}
              setSessionView={setSessionView}
              sessions={visibleSessions}
              selectedSessionId={selectedSessionId}
              setSelectedSessionId={setSelectedSessionId}
              t={t}
            />
          )}
          {activeTab === 'assigned' && <AssignedTab assignments={assignments} t={t} />}
          {activeTab === 'insights' && <InsightsTab insights={insights} t={t} />}
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Wsparcie', 'Support')}
          </p>

          {/* Rubryka oceny — reused verbatim from the engine (#48a) */}
          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Rubryka oceny', 'Scoring rubric')}
              <span
                className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
              >
                {RUBRIC_CRITERIA.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
              {RUBRIC_CRITERIA.map((c) => (
                <div key={c.key} className="text-[12.5px] leading-snug">
                  <span className="font-semibold text-c-text">{c.labelPl}</span>{' '}
                  <span className="text-c-text-secondary">{c.descriptionPl}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <Clock className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Aktywność', 'Activity')}
            </div>
            <div className="px-3.5 pb-3.5 text-[12.5px] leading-snug text-c-text-secondary">
              {lastUpdatedLabel || t('Zaktualizowano dziś.', 'Updated today.')}
            </div>
          </div>

          <div className="mt-2.5 border-t border-c-border pt-2.5 text-[11.5px] text-c-text-muted">
            {t(
              'Ocenę liczy silnik deterministycznie (0-4 na kryterium, suma 0-20) — czat tylko pomaga dociągnąć odpowiedź, nigdy nie zmienia wyniku.',
              'The engine computes the score deterministically (0-4 per criterion, 0-20 total) — chat only helps sharpen an answer, never changes the score.'
            )}
          </div>

          {lineageSources.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-c-border">
              <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
                {t('Źródła', 'Sources')}
              </div>
              <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
                {lineageSources.map((src) => (
                  <div key={src.label} className="text-[12.5px] leading-snug">
                    <span className="font-semibold text-c-text">{src.label}</span>{' '}
                    <span className="text-c-text-secondary">{src.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-sections (kept in-file — presentational only, not reused elsewhere yet)
// ---------------------------------------------------------------------------

function SessionsTab({
  sessionView,
  setSessionView,
  sessions,
  selectedSessionId,
  setSelectedSessionId,
  t,
}: {
  sessionView: SessionView;
  setSessionView: (v: SessionView) => void;
  sessions: InterviewSessionLite[];
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  // Selection (StandardTable MUST #7) is scoped to this tab — reset happens
  // implicitly since the component remounts with fresh state per activeTab
  // switch at the parent (same pattern as Materials/Tools LightShells).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Columns — real <StandardTable> facade (TRIADA kanon), not a bespoke
  // grid. Sesja / Respondent / Wynik AI (0-20) / Werdykt / Status — Werdykt
  // + Status carry the leading status dot via <StatusChip>/<EntityStatusChip>
  // (canon §4.1), numbers are right-aligned.
  const sessionColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('Sesja', 'Session'),
        sortable: true,
        filterable: true,
        render: (row: InterviewSessionLite) => (
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-c-text">{row.title}</span>
            <span className="block truncate text-[11px] text-c-text-muted tabular-nums">
              {row.questionsAnswered}/{row.questionsTotal} {t('odpowiedzi', 'answers')}
            </span>
          </span>
        ),
      },
      {
        id: 'respondent',
        label: t('Respondent', 'Respondent'),
        sortable: true,
        filterable: true,
      },
      {
        id: 'score',
        label: t('Wynik AI (0-20)', 'AI score (0-20)'),
        align: 'right',
        sortable: true,
        sortAccessor: (row: InterviewSessionLite) => rubricTotal(row.rubric),
        render: (row: InterviewSessionLite) => (
          <span className="whitespace-nowrap tabular-nums">
            <span className="font-semibold text-c-text">{rubricTotal(row.rubric)}</span>
            <span className="text-c-text-muted">/{RUBRIC_MAX_TOTAL}</span>
          </span>
        ),
      },
      {
        id: 'overallVerdict',
        label: t('Werdykt', 'Verdict'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(VERDICT_LABEL_PL) as InterviewOverallVerdict[]).map((v) => ({
          value: v,
          label: VERDICT_LABEL_PL[v],
        })),
        render: (row: InterviewSessionLite) =>
          row.overallVerdict ? (
            <StatusChip tone={VERDICT_TONE[row.overallVerdict]} label={VERDICT_LABEL_PL[row.overallVerdict]} />
          ) : (
            <span className="text-c-text-muted">—</span>
          ),
      },
      {
        id: 'status',
        label: t('Status', 'Status'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(SESSION_STATUS_LABEL_PL) as InterviewSessionStatus[]).map((s) => ({
          value: s,
          label: SESSION_STATUS_LABEL_PL[s],
        })),
        render: (row: InterviewSessionLite) => (
          <EntityStatusChip status={row.status} label={SESSION_STATUS_LABEL_PL[row.status]} />
        ),
      },
    ],
    [t]
  );

  // Kebab (MUST #6): no real open/edit/archive handlers wired at this layer
  // yet — StandardTable always renders the full 5-block kebab regardless,
  // with blocks 4/5 disabled + "Coming soon (backend)" note (ANEKS #4).
  const sessionRowMenu = (_row: TableRow): StandardRowMenu => ({});

  // MUST #3 — row-description toggle reveals the full 5-criterion rubric
  // breakdown (owner note #48: odbiór menedżerski needs the rubric visible).
  // This is the canonical replacement for the old per-row expand button.
  const sessionRowDescription = (row: TableRow): React.ReactNode => {
    const session = row as unknown as InterviewSessionLite;
    if (!session.rubric || session.rubric.length === 0) return null;
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-c-text-muted">
            {t('Rozbicie oceny AI (odbiór menedżerski)', 'AI score breakdown (manager review)')}
          </span>
          <span className="text-[11px] text-c-text-muted">{session.updatedAtLabel}</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-5">
          {session.rubric.map((c) => {
            const meta = RUBRIC_CRITERIA.find((r) => r.key === c.criterion);
            return (
              <div key={c.criterion} className="rounded-lg border border-c-border-strong bg-c-surface px-2.5 py-2.5">
                <span className="block text-[11px] font-semibold text-c-text">{meta?.labelPl || c.criterion}</span>
                <span className="mt-1 block text-[16px] font-bold tabular-nums" style={{ color: BLUE }}>
                  {c.score}
                  <span className="text-[11px] font-normal text-c-text-muted">/{RUBRIC_MAX_PER_CRITERION}</span>
                </span>
                {c.justification && (
                  <span className="mt-1 block text-[11px] leading-snug text-c-text-secondary">
                    {c.justification}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Sesje wywiadów', 'Interview sessions')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t(
              'Ocena AI wg rubryki 5 kryteriów (0-20) — włącz opis wiersza po rozbicie',
              'AI score per the 5-criterion rubric (0-20) — enable row description for the breakdown'
            )}
          </div>
        </div>

        {/* segmented view switch — owner note #50a: Aktualne/Zarchiwizowane is a
            filter on the SAME dataset, not a separate tab (doktryna gęstości §4) */}
        <div className="flex overflow-hidden rounded-lg border border-c-border text-[12px] font-semibold">
          {(['active', 'archived'] as SessionView[]).map((v) => {
            const on = v === sessionView;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setSessionView(v)}
                className={`px-3 py-1.5 transition-colors ${on ? '' : 'text-c-text-secondary hover:bg-c-surface-raised'}`}
                style={on ? { backgroundColor: BLUE_SOFT, color: BLUE } : undefined}
              >
                {v === 'active' ? t('Aktualne', 'Active') : t('Zarchiwizowane', 'Archived')}
              </button>
            );
          })}
        </div>
      </div>

      <StandardTable
        columns={sessionColumns}
        data={sessions}
        selectedRowId={selectedSessionId}
        onRowClick={(row) => setSelectedSessionId(String(row.id))}
        rowMenu={sessionRowMenu}
        rowDescription={sessionRowDescription}
        selection={{ selectedIds, onChange: setSelectedIds }}
        persistKey={`interview-light.sessions.${sessionView}`}
        defaultSort={{ columnId: 'score', direction: 'desc' }}
        canvasClassName="mt-4 p-0"
        empty={{
          icon: ClipboardList,
          title: t('Brak sesji w tym widoku.', 'No sessions in this view.'),
        }}
      />
    </>
  );
}

function AssignedTab({
  assignments,
  t,
}: {
  assignments: InterviewAssignmentLite[];
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Przypisane wywiady', 'Assigned interviews')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('Skrzynka odbiorcza — jedno kliknięcie do kontynuacji', 'Inbox — one click to continue')}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-c-border">
        {assignments.map((a, idx) => (
          <div
            key={a.id}
            className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3.5 px-4 py-3 ${
              idx > 0 ? 'border-t border-c-border' : ''
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium text-c-text">{a.title}</span>
              <span className="block truncate text-[11.5px] text-c-text-muted">{a.assignee}</span>
            </span>
            <span className={`whitespace-nowrap text-[12px] ${a.overdue ? 'font-semibold text-c-danger' : 'text-c-text-secondary'}`}>
              {a.dueLabel}
            </span>
            <span className="rounded-full border border-c-border bg-c-surface px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-c-text-secondary">
              {ASSIGNMENT_STATUS_LABEL_PL[a.status]}
            </span>
            <button
              type="button"
              className="whitespace-nowrap rounded-lg border border-c-border px-2.5 py-1 text-[12px] font-semibold text-c-text-secondary transition-colors hover:bg-c-surface-raised"
              style={{ color: BLUE, borderColor: BLUE }}
            >
              {a.status === 'assigned' ? t('Rozpocznij', 'Start') : t('Kontynuuj', 'Continue')}
            </button>
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="px-4 py-6 text-center text-[12.5px] text-c-text-muted">
            {t('Brak przypisanych wywiadów.', 'No assigned interviews.')}
          </div>
        )}
      </div>
    </>
  );
}

function InsightsTab({
  insights,
  t,
}: {
  insights: InterviewInsightLite[];
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Wnioski z wywiadów', 'Interview insights')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('Zebrane z sesji — z dowodami i pewnością', 'Distilled from sessions — with evidence and confidence')}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {insights.map((insight) => (
          <div key={insight.id} className="rounded-xl border border-c-border bg-c-surface px-4 py-3.5">
            <div className="flex items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: BLUE }}>
                  {insight.category}
                </span>
                <span className="block text-[14px] font-semibold text-c-text">{insight.title}</span>
              </span>
              <span className="flex flex-shrink-0 items-center gap-3 whitespace-nowrap text-[11.5px] text-c-text-muted">
                <span>
                  {insight.evidenceCount} {t('dowodów', 'evidence')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-[5px] w-[50px] overflow-hidden rounded-full bg-c-surface-raised">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.round(insight.confidencePct)}%`, backgroundColor: BLUE }}
                    />
                  </span>
                  <span className="font-semibold tabular-nums text-c-text-secondary">
                    {Math.round(insight.confidencePct)}%
                  </span>
                </span>
              </span>
            </div>
            <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-c-text-secondary">{insight.summary}</p>
            <div className="mt-2 text-[11px] text-c-text-muted">
              {t('Źródło', 'Source')}: {insight.sourceSessionTitle}
            </div>
          </div>
        ))}
        {insights.length === 0 && (
          <div className="rounded-xl border border-dashed border-c-border px-4 py-6 text-center text-[12.5px] text-c-text-muted">
            {t('Brak wniosków dla tego cyklu.', 'No insights for this cycle.')}
          </div>
        )}
      </div>
    </>
  );
}

export default InterviewLightShell;
