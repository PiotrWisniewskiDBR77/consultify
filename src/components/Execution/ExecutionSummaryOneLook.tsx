/**
 * ExecutionSummaryOneLook — kokpit menedżera „pełna wizja McKinsey" (#77 / Z94).
 *
 * JEDNO SPOJRZENIE odpowiada na kluczowe pytania zarządcze:
 *   1. Czy jesteśmy na czas?            → on-time % + on-track / at-risk / delayed
 *   2. Czy dowozimy wartość?            → wartość zrealizowana vs plan (ROI netto)
 *   3. Czy zespół ma przepustowość?     → obłożenie (utilization) + luki/przeciążenia
 *   4. Co nam grozi?                    → TOP-3 ryzyka (score = P × I)
 *   5. Co muszę rozstrzygnąć DZIŚ?      → decyzje-do-podjęcia (pending/overdue/blokery)
 *   + Najbliższe kamienie milowe.
 *
 * KANON (reguła #1 + #9 + pułapka nr 1): to NIE light-shell. Listy renderuje
 * StandardTable (fasada src/components/standard/) 1:1 — zero surowych elementów tabeli.
 * Karty-odpowiedzi u góry to podsumowania (jak strip w KpiOverviewView), nie tabele. Kolory = tokeny c-* (semantyka:
 * c-success / c-warning / c-danger). CTA/stany aktywne = neutralne, focus =
 * c-focus (NIGDY crimson `primary-*`). Widok jest BEZSTANOWY — dane i handlery
 * wstrzykuje rodzic (ExecutionHub) lub host dev-render.
 *
 * INTEGRALNOŚĆ (reguła złota #1): gdy danych brak → empty-state/„—" z jasną
 * etykietą. ZERO zmyślonych liczb.
 *
 * Props mapują się 1:1 na istniejący ExecutiveAggregateSnapshot (overview /
 * workstreams / roi.summary / risks.topRisks / nextMilestones) + action-center
 * (blocked / overdueDecisions / pendingDecisions) z ExecutionHub — dlatego
 * wpięcie nie wymaga nowego backendu.
 */
import React, { useMemo } from 'react';

import type { TableColumn } from '../standard/StandardTable';
import StandardTable from '../standard/StandardTable';
import { liczebnik } from '../../utils/liczebnik';

// ── Modele danych (kształty 1:1 z ExecutiveAggregateSnapshot + actionCenter) ──
export interface OneLookHealth {
  /** 0..100; ogólny health portfela (portfolioMetrics.healthScore). */
  healthScore: number | null;
  /** 0..100; overview.progressPercent. */
  progressPercent: number | null;
  phaseLabel?: string | null;
}

export interface OneLookOnTime {
  /** 0..100; % inicjatyw na czas (on-track / total). null = brak danych. */
  onTimePercent: number | null;
  onTrackCount: number;
  atRiskCount: number;
  delayedCount: number;
  totalInitiatives: number;
}

export interface OneLookValue {
  /** Wartość oczekiwana (ROI netto projected), waluta bazowa. */
  totalProjected: number;
  /** Wartość zrealizowana (ROI netto realized). */
  totalRealized: number;
  /** realized − projected. */
  totalVariance: number;
  /** 0..100; % inicjatyw z policzonym ROI. */
  coveragePercent: number;
  initiativeCount: number;
}

export interface OneLookPeople {
  /** 0..100; średnie obłożenie zespołu. null = brak danych. */
  utilizationPercent: number | null;
  /** Osoby przeciążone (>100%). */
  overallocatedCount: number;
  /** Osoby niedociążone. */
  underutilizedCount: number;
  /** Inicjatywy bez właściciela (workstreams.unassignedInitiatives). */
  unassignedInitiatives: number;
  headcount: number;
}

export interface OneLookRisk {
  id: string;
  title: string;
  probability?: string | null;
  impact?: string | null;
  /** 0..25 (P × I) lub inna skala silnika. */
  score: number;
  ownerName?: string | null;
  dueDate?: string | null;
  mitigationStatus?: string | null;
}

export type OneLookDecisionKind = 'decision' | 'overdue' | 'blocker';

export interface OneLookDecision {
  id: string;
  title: string;
  kind: OneLookDecisionKind;
  ownerName?: string | null;
  /** Wiek pozycji w dniach (dla RAG). */
  ageDays?: number | null;
  /** Czego blokuje / kontekst. */
  context?: string | null;
}

export interface OneLookMilestone {
  id: string;
  initiativeName: string;
  name: string;
  targetDate?: string | null;
  status?: string | null;
}

export interface ExecutionSummaryOneLookProps {
  health: OneLookHealth;
  onTime: OneLookOnTime;
  value: OneLookValue | null;
  people: OneLookPeople;
  topRisks: OneLookRisk[];
  decisions: OneLookDecision[];
  milestones: OneLookMilestone[];
  currency?: string;
  isPolish?: boolean;
  generatedAt?: string | null;
  /** Klik encji (ryzyko/decyzja/kamień) → panel/preview w hoście. */
  onOpenEntity?: (entityType: string, entityId: string) => void;
}

// ── Helpery ─────────────────────────────────────────────────────────────────
const clampPct = (n: number | null | undefined): number | null =>
  n == null || Number.isNaN(n) ? null : Math.max(0, Math.min(100, Math.round(n)));

/** RAG dla „im wyżej tym lepiej" (on-time, health, coverage). */
const ragUp = (pct: number | null): string => {
  if (pct == null) return 'text-c-text-muted';
  if (pct >= 80) return 'text-c-success';
  if (pct >= 60) return 'text-c-warning';
  return 'text-c-danger';
};
const ragUpBar = (pct: number | null): string => {
  if (pct == null) return 'bg-c-text-muted';
  if (pct >= 80) return 'bg-c-success';
  if (pct >= 60) return 'bg-c-warning';
  return 'bg-c-danger';
};

const riskBand = (score: number): { dot: string; text: string; pl: string; en: string } => {
  if (score >= 15)
    return { dot: 'bg-c-danger', text: 'text-c-danger', pl: 'Krytyczne', en: 'Critical' };
  if (score >= 8) return { dot: 'bg-c-warning', text: 'text-c-warning', pl: 'Wysokie', en: 'High' };
  return { dot: 'bg-c-success', text: 'text-c-success', pl: 'Umiarkowane', en: 'Moderate' };
};

const decisionBand = (
  kind: OneLookDecisionKind,
  ageDays?: number | null
): { dot: string; text: string } => {
  if (kind === 'blocker') return { dot: 'bg-c-danger', text: 'text-c-danger' };
  if (kind === 'overdue') return { dot: 'bg-c-danger', text: 'text-c-danger' };
  if (ageDays != null && ageDays >= 5) return { dot: 'bg-c-warning', text: 'text-c-warning' };
  return { dot: 'bg-c-warning', text: 'text-c-warning' };
};

const Bar: React.FC<{ pct: number | null; barClass?: string }> = ({ pct, barClass }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-c-surface-raised">
    <div
      className={`h-full rounded-full ${barClass ?? ragUpBar(pct)}`}
      style={{ width: `${pct ?? 0}%` }}
    />
  </div>
);

// ── Karta-odpowiedź (one-look tile) ──────────────────────────────────────────
const AnswerCard: React.FC<{
  question: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ question, children, footer }) => (
  <div className="flex flex-col rounded-xl border border-c-border-subtle bg-c-surface p-4">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
      {question}
    </div>
    <div className="mt-2 flex-1">{children}</div>
    {footer && <div className="mt-3">{footer}</div>}
  </div>
);

const fmtMoney = (n: number, currency: string): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000)
    return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)} mln ${currency}`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} tys. ${currency}`;
  return `${sign}${Math.round(abs)} ${currency}`;
};

const fmtDate = (iso?: string | null, isPolish = true): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '—';
  }
};

export const ExecutionSummaryOneLook: React.FC<ExecutionSummaryOneLookProps> = ({
  health,
  onTime,
  value,
  people,
  topRisks,
  decisions,
  milestones,
  currency = 'PLN',
  isPolish = true,
  generatedAt,
  onOpenEntity,
}) => {
  const tr = (pl: string, en: string) => (isPolish ? pl : en);

  const onTimePct = clampPct(onTime.onTimePercent);
  const healthPct = clampPct(health.healthScore);
  const progressPct = clampPct(health.progressPercent);
  const utilPct = clampPct(people.utilizationPercent);
  const coveragePct = value ? clampPct(value.coveragePercent) : null;

  // ── TOP-3 ryzyka (StandardTable) ──
  const riskColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: tr('Ryzyko', 'Risk'),
        width: '300px',
        render: (row: any) => {
          const band = riskBand(row.score);
          return (
            <div className="flex items-center gap-2 min-w-0">
              <span className={`h-2 w-2 shrink-0 rounded-full ${band.dot}`} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-c-text">{row.title}</div>
                {row.ownerName && (
                  <div className="truncate text-xs text-c-text-muted">{row.ownerName}</div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'band',
        label: tr('Poziom', 'Level'),
        width: '120px',
        render: (row: any) => {
          const band = riskBand(row.score);
          return (
            <span className={`text-sm font-medium ${band.text}`}>
              {isPolish ? band.pl : band.en}
            </span>
          );
        },
      },
      {
        id: 'score',
        label: tr('Wynik', 'Score'),
        width: '80px',
        align: 'right',
        render: (row: any) => (
          <span className="text-sm font-semibold tabular-nums text-c-text">{row.score}</span>
        ),
      },
      {
        id: 'due',
        label: tr('Termin', 'Due'),
        width: '90px',
        align: 'right',
        render: (row: any) => (
          <span className="text-sm text-c-text-secondary">{fmtDate(row.dueDate, isPolish)}</span>
        ),
      },
      {
        id: 'mitigation',
        label: tr('Mitygacja', 'Mitigation'),
        width: '140px',
        render: (row: any) => (
          <span className="text-sm text-c-text-secondary">
            {row.mitigationStatus || tr('brak planu', 'no plan')}
          </span>
        ),
      },
    ],
    [isPolish]
  );

  // ── Decyzje-do-podjęcia (StandardTable) ──
  const decisionKindLabel = (kind: OneLookDecisionKind): string => {
    if (kind === 'blocker') return tr('Bloker', 'Blocker');
    if (kind === 'overdue') return tr('Przeterminowana', 'Overdue');
    return tr('Do decyzji', 'Pending');
  };

  const decisionColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: tr('Pozycja', 'Item'),
        width: '130px',
        render: (row: any) => {
          const band = decisionBand(row.kind, row.ageDays);
          return (
            <div className="flex items-center gap-2 min-w-0">
              <span className={`h-2 w-2 shrink-0 rounded-full ${band.dot}`} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-c-text">{row.title}</div>
                {row.context && (
                  <div className="truncate text-xs text-c-text-muted">{row.context}</div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'kind',
        label: tr('Typ', 'Type'),
        width: '210px',
        render: (row: any) => {
          const band = decisionBand(row.kind, row.ageDays);
          const label = decisionKindLabel(row.kind);
          // Defekt „ucinany tekst" (2026-08-31, domknięcie): karta jest wąska
          // (grid lg:grid-cols-2, kontener tabeli ~506px), a najdłuższa
          // etykieta „Przeterminowana" (115px tekstu) nie mieściła się
          // jednowierszowo — ani przycięta (`truncate`+`title`), ani przy
          // umiarkowanym poszerzeniu (kolumna i tak lądowała na PODŁODZE
          // dopasowania `FIT_MIN_COLUMN_WIDTH`=112px niezależnie od
          // deklarowanej szerokości, bo `FilterableTable`/`columnFit`
          // rozdaje budżet iteracyjnie: kolumny „Pozycja"/„Właściciel"/„Wiek"
          // miały deklarowane szerokości POWYŻEJ własnej podłogi, więc same
          // przyklamrowywały się do niej najpierw i to ONE zjadały budżet
          // kosztem „Typ"). Naprawa: „Pozycja"/„Właściciel"/„Wiek" dostały
          // deklaracje NA SWOJEJ podłodze (130/120/70 — „Właściciel" dostał
          // 120, nie mniej, bo nazwisko „Wiśniewski"/nagłówek „Właściciel"
          // same potrzebują ~75px i przy węższej kolumnie łamały się w
          // POŁOWIE nazwiska, ten sam defekt piętro niżej) — więc
          // przyklamrowują się do dokładnie tego, i CAŁA reszta budżetu
          // kontenera trafia do „Typ" (deklaracja 210px, faktycznie renderuje
          // ~186px — z zapasem nad potrzebnymi ~147px). `line-clamp-2`
          // zostaje jako siatka bezpieczeństwa (nigdy „…", najwyżej 2 pełne
          // linie przy jeszcze węższym viewport/dark-mode reflow), nie jako
          // główny mechanizm.
          return (
            <span
              className={`block line-clamp-2 leading-tight text-sm font-medium ${band.text}`}
            >
              {label}
            </span>
          );
        },
      },
      {
        id: 'owner',
        label: tr('Właściciel', 'Owner'),
        width: '120px',
        render: (row: any) => (
          <span className="text-sm text-c-text-secondary">{row.ownerName || '—'}</span>
        ),
      },
      {
        id: 'age',
        label: tr('Wiek', 'Age'),
        width: '70px',
        align: 'right',
        render: (row: any) => (
          <span className="text-sm tabular-nums text-c-text-secondary">
            {row.ageDays != null
              ? `${row.ageDays} ${tr(liczebnik(row.ageDays, ['dzień', 'dni', 'dni']), 'd')}`
              : '—'}
          </span>
        ),
      },
    ],
    [isPolish]
  );

  return (
    <div className="h-full overflow-auto p-4 sm:p-5">
      <div className="mx-auto max-w-[1180px] space-y-5">
        {/* Nagłówek */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-c-text">
              {tr('Kokpit menedżera', 'Manager cockpit')}
            </h1>
            <p className="mt-1 text-sm text-c-text-secondary">
              {tr(
                'Pięć pytań zarządczych, jedna odpowiedź na spojrzenie.',
                'Five management questions, one answer at a glance.'
              )}
              {health.phaseLabel ? ` · ${health.phaseLabel}` : ''}
            </p>
          </div>
          {generatedAt && (
            <div className="shrink-0 text-xs text-c-text-muted">
              {tr('Stan na', 'As of')} {fmtDate(generatedAt, isPolish)}
            </div>
          )}
        </div>

        {/* ── RZĄD ODPOWIEDZI (one-look) ── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* 1. Kondycja / postęp */}
          <AnswerCard question={tr('Kondycja', 'Health')} footer={<Bar pct={healthPct} />}>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold tabular-nums ${ragUp(healthPct)}`}>
                {healthPct != null ? healthPct : '—'}
              </span>
              {healthPct != null && <span className="text-sm text-c-text-muted">/100</span>}
            </div>
            <div className="mt-1 text-xs text-c-text-muted">
              {progressPct != null
                ? `${tr('postęp', 'progress')} ${progressPct}%`
                : tr('brak danych', 'no data')}
            </div>
          </AnswerCard>

          {/* 2. On-time */}
          <AnswerCard question={tr('Na czas', 'On-time')} footer={<Bar pct={onTimePct} />}>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold tabular-nums ${ragUp(onTimePct)}`}>
                {onTimePct != null ? `${onTimePct}%` : '—'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-c-text-muted">
              <span className="text-c-success">
                {onTime.onTrackCount} {tr('na tor', 'on-track')}
              </span>
              <span className="text-c-warning">
                {onTime.atRiskCount}{' '}
                {tr(liczebnik(onTime.atRiskCount, ['ryzyko', 'ryzyka', 'ryzyk']), 'at-risk')}
              </span>
              <span className="text-c-danger">
                {onTime.delayedCount} {tr('opóźn.', 'delayed')}
              </span>
            </div>
          </AnswerCard>

          {/* 3. Wartość vs plan */}
          <AnswerCard
            question={tr('Wartość vs plan', 'Value vs plan')}
            footer={value ? <Bar pct={coveragePct} barClass="bg-c-info" /> : undefined}
          >
            {value ? (
              <>
                <div className="text-lg font-bold tabular-nums text-c-text">
                  {fmtMoney(value.totalRealized, currency)}
                </div>
                <div className="mt-0.5 text-xs text-c-text-muted">
                  {tr('plan', 'plan')} {fmtMoney(value.totalProjected, currency)}
                </div>
                <div
                  className={`mt-1 text-xs font-medium ${
                    value.totalVariance >= 0 ? 'text-c-success' : 'text-c-danger'
                  }`}
                >
                  {value.totalVariance >= 0 ? '▲' : '▼'} {fmtMoney(value.totalVariance, currency)}
                </div>
              </>
            ) : (
              <div className="text-sm text-c-text-muted">
                {tr('Brak policzonego ROI', 'No ROI computed')}
              </div>
            )}
          </AnswerCard>

          {/* 4. Obłożenie zespołu */}
          <AnswerCard
            question={tr('Obłożenie', 'Utilization')}
            footer={
              utilPct != null ? (
                <Bar
                  pct={utilPct}
                  barClass={
                    utilPct > 100 ? 'bg-c-danger' : utilPct >= 60 ? 'bg-c-success' : 'bg-c-warning'
                  }
                />
              ) : undefined
            }
          >
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-c-text">
                {utilPct != null ? `${utilPct}%` : '—'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-c-text-muted">
              {people.overallocatedCount > 0 && (
                <span className="text-c-danger">
                  {people.overallocatedCount} {tr('przeciąż.', 'over')}
                </span>
              )}
              {people.underutilizedCount > 0 && (
                <span>
                  {people.underutilizedCount}{' '}
                  {tr(
                    liczebnik(people.underutilizedCount, ['wolna', 'wolne', 'wolnych']),
                    'free'
                  )}
                </span>
              )}
              <span>
                {people.headcount} {tr(liczebnik(people.headcount, ['osoba', 'osoby', 'osób']), 'ppl')}
              </span>
            </div>
          </AnswerCard>

          {/* 5. Decyzje do podjęcia */}
          <AnswerCard question={tr('Do rozstrzygnięcia', 'To resolve')}>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-2xl font-bold tabular-nums ${
                  decisions.length > 0 ? 'text-c-warning' : 'text-c-success'
                }`}
              >
                {decisions.length}
              </span>
              <span className="text-sm text-c-text-muted">
                {tr(liczebnik(decisions.length, ['pozycja', 'pozycje', 'pozycji']), 'items')}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-c-text-muted">
              <span className="text-c-danger">
                {decisions.filter((d) => d.kind === 'blocker').length}{' '}
                {tr(
                  liczebnik(decisions.filter((d) => d.kind === 'blocker').length, [
                    'bloker',
                    'blokery',
                    'blokerów',
                  ]),
                  'blockers'
                )}
              </span>
              <span className="text-c-danger">
                {decisions.filter((d) => d.kind === 'overdue').length}{' '}
                {tr('przetermin.', 'overdue')}
              </span>
            </div>
          </AnswerCard>
        </div>

        {/* ── DÓŁ: TOP-3 ryzyka · Decyzje ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* TOP-3 ryzyka */}
          <section className="rounded-2xl border border-c-border-subtle bg-c-surface/60 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-c-text">
                  {tr('Co nam grozi — TOP ryzyka', 'What threatens us — top risks')}
                </h2>
                <p className="mt-0.5 text-sm text-c-text-secondary">
                  {tr('Ryzyka o najwyższym wyniku (P × I).', 'Highest-scoring risks (P × I).')}
                </p>
              </div>
            </div>
            <StandardTable
              columns={riskColumns}
              data={topRisks as unknown as Array<Record<string, unknown> & { id: string }>}
              onRowClick={
                onOpenEntity ? (row) => onOpenEntity('risk', String((row as any).id)) : undefined
              }
              empty={{
                title: tr('Brak ryzyk krytycznych', 'No critical risks'),
                description: tr(
                  'Nic nie przekracza progu uwagi menedżera.',
                  'Nothing crosses the manager attention threshold.'
                ),
              }}
            />
          </section>

          {/* Decyzje-do-podjęcia */}
          <section className="rounded-2xl border border-c-border-subtle bg-c-surface/60 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-c-text">
                  {tr('Co muszę rozstrzygnąć', 'What I must resolve')}
                </h2>
                <p className="mt-0.5 text-sm text-c-text-secondary">
                  {tr(
                    'Decyzje, przeterminowania i blokery czekające na Ciebie.',
                    'Decisions, overdue items and blockers waiting on you.'
                  )}
                </p>
              </div>
            </div>
            <StandardTable
              columns={decisionColumns}
              data={decisions as unknown as Array<Record<string, unknown> & { id: string }>}
              onRowClick={
                onOpenEntity
                  ? (row) => onOpenEntity('decision', String((row as any).id))
                  : undefined
              }
              empty={{
                title: tr('Skrzynka pusta', 'Inbox zero'),
                description: tr(
                  'Brak decyzji, przeterminowań i blokerów wymagających Ciebie.',
                  'No decisions, overdue items or blockers require you.'
                ),
              }}
              // Defekt „ucinany tekst" (2026-08-31): ta karta żyje w wąskim
              // `lg:grid-cols-2` (~500px na tabelę), a `FilterableTable`
              // domyślnie wymusza `min-width: 980px` na elemencie `table`
              // (`DEFAULT_MIN_TABLE_WIDTH`). Sama kolumna renderowała się na
              // pełnej (a nawet proporcjonalnie POWIĘKSZONEJ) szerokości, ale
              // fizycznie POZA widocznym skrawkiem karty — `overflow-x-auto`
              // ucinał tekst na krawędzi bez wielokropka, nie w komórce.
              // `minTableWidth="auto"` (prop istnieje dokładnie po to, patrz
              // `FilterableTable.tsx`) zdejmuje ten sztywny floor i włącza
              // realne dopasowanie kolumn do kontenera (`columnFit`) — tabela
              // mieści się w karcie bez ukrytego przewijania.
              minTableWidth="auto"
            />
          </section>
        </div>

        {/* ── Najbliższe kamienie milowe ── */}
        <section className="rounded-2xl border border-c-border-subtle bg-c-surface/60 p-4 sm:p-5">
          <h2 className="mb-3 text-base font-semibold text-c-text">
            {tr('Najbliższe kamienie milowe', 'Next milestones')}
          </h2>
          {milestones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-c-border-subtle px-4 py-6 text-center text-sm text-c-text-muted">
              {tr('Brak zaplanowanych kamieni milowych.', 'No milestones scheduled.')}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {milestones.slice(0, 6).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={onOpenEntity ? () => onOpenEntity('milestone', m.id) : undefined}
                  className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-left transition-colors hover:border-c-border-strong focus:outline-none focus:ring-2 focus:ring-c-focus"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                      {fmtDate(m.targetDate, isPolish)}
                    </span>
                    {m.status && <span className="text-[11px] text-c-text-muted">{m.status}</span>}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-c-text">{m.name}</div>
                  <div className="truncate text-xs text-c-text-muted">{m.initiativeName}</div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ExecutionSummaryOneLook;
