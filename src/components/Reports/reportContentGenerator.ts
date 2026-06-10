/**
 * reportContentGenerator — Task #20 finish.
 *
 * Turns a report *configuration* (type id + period + scope) plus the live
 * execution data context into a structured, renderable report DOCUMENT with
 * real computed metrics. No fake numbers: every figure is derived from the
 * ReportDataContext that ExecutionHub already assembles from live initiatives,
 * tasks, decisions, risk/delay signals, capacity and budget data.
 *
 * The output (`ReportDocument`) is intentionally presentation-agnostic — a
 * tree of typed blocks — so it can be rendered (ReportDocumentView), exported
 * to markdown, or fed to an AI summarizer later.
 */

import type { ReportDataContext } from '@/components/Execution/executionReports';
import type { ReportTypeId } from '@/components/Reports/Wizard';

/* ────────────────────────────────────────────────────────────────────────────
   Document model
   ──────────────────────────────────────────────────────────────────────────── */

export type RagLevel = 'green' | 'amber' | 'red';

export interface ReportMetric {
  label: string;
  value: string | number;
  /** Optional sub-line, e.g. "of 12 initiatives". */
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'critical';
}

export interface ReportTableRow {
  cells: Array<string | number>;
  tone?: 'default' | 'good' | 'warn' | 'critical';
}

export type ReportBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'metrics'; items: ReportMetric[] }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | {
      kind: 'table';
      columns: string[];
      rows: ReportTableRow[];
      /** Message shown when there are zero rows. */
      emptyText?: string;
    }
  | { kind: 'callout'; tone: 'good' | 'warn' | 'critical' | 'info'; text: string };

export interface ReportSection {
  id: string;
  heading: string;
  /** Optional one-line intro under the heading. */
  intro?: string;
  blocks: ReportBlock[];
}

export interface ReportDocument {
  typeId: ReportTypeId | string;
  title: string;
  audience: string;
  /** Human period label, e.g. "1 Jun – 8 Jun 2026" or "Snapshot · 8 Jun 2026". */
  periodLabel: string;
  generatedAtLabel: string;
  /** Overall computed RAG for the report header. */
  rag: RagLevel;
  ragLabel: string;
  /** Executive one-liner that summarizes the whole document. */
  summary: string;
  sections: ReportSection[];
}

/** Inputs needed to generate (decoupled from React / ExecutionHub internals). */
export interface ReportGenInput {
  typeId: ReportTypeId | string;
  title: string;
  audience: string;
  periodFrom?: string;
  periodTo?: string;
  scopeNote?: string;
  ctx: ReportDataContext;
  isPolish: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
   Small helpers
   ──────────────────────────────────────────────────────────────────────────── */

const tr = (pl: boolean, en: string, plStr: string): string => (pl ? plStr : en);

function fmtDate(iso: string | undefined, pl: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(pl ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function periodLabel(input: ReportGenInput): string {
  const { periodFrom, periodTo, isPolish } = input;
  if (periodFrom && periodTo) {
    return `${fmtDate(periodFrom, isPolish)} – ${fmtDate(periodTo, isPolish)}`;
  }
  if (periodTo) return fmtDate(periodTo, isPolish);
  const snapshot = tr(isPolish, 'Snapshot', 'Migawka');
  return `${snapshot} · ${fmtDate(new Date().toISOString(), isPolish)}`;
}

function daysUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.round(ms / 86400000);
}

/** Health/status → RAG bucket. */
function healthToRag(health?: string, status?: string): RagLevel {
  const h = String(health || '').toLowerCase();
  if (h.includes('red') || h.includes('risk') || h.includes('critical')) return 'red';
  if (h.includes('amber') || h.includes('warn') || h.includes('attention')) return 'amber';
  if (h.includes('green') || h.includes('track') || h.includes('healthy')) return 'green';
  const s = String(status || '').toUpperCase();
  if (s.includes('BLOCK') || s.includes('CANCEL')) return 'red';
  if (s.includes('RISK') || s.includes('DELAY')) return 'amber';
  return 'green';
}

/** Aggregate the program RAG from live signals. */
function computeOverallRag(ctx: ReportDataContext): RagLevel {
  const blocked = ctx.blocked.length;
  const overdue = ctx.overdueDecisions.length;
  const criticalRisks = ctx.riskSignals.filter(
    (r) =>
      String(r.severity).toLowerCase().includes('crit') ||
      String(r.severity).toLowerCase().includes('high')
  ).length;
  if (blocked > 0 || criticalRisks > 0) return 'red';
  if (overdue > 0 || ctx.missingDates.length > 0 || ctx.delaySignals.length > 0) return 'amber';
  return 'green';
}

function ragLabelFor(rag: RagLevel, pl: boolean): string {
  switch (rag) {
    case 'red':
      return tr(pl, 'At Risk', 'Zagrożony');
    case 'amber':
      return tr(pl, 'Needs Attention', 'Wymaga uwagi');
    default:
      return tr(pl, 'On Track', 'Na dobrej drodze');
  }
}

const ragTone = (rag: RagLevel): 'good' | 'warn' | 'critical' =>
  rag === 'red' ? 'critical' : rag === 'amber' ? 'warn' : 'good';

/* ────────────────────────────────────────────────────────────────────────────
   Reusable section builders (shared across report templates)
   ──────────────────────────────────────────────────────────────────────────── */

function progressSummarySection(ctx: ReportDataContext, pl: boolean): ReportSection {
  const total = ctx.totalInitiatives;
  const withProgress = ctx.initiatives.filter((i) => i.progress != null);
  const avg =
    withProgress.length > 0
      ? Math.round(
          withProgress.reduce((s, i) => s + Number(i.progress || 0), 0) / withProgress.length
        )
      : null;
  const onTrack = ctx.initiatives.filter((i) => healthToRag(i.health, i.status) === 'green').length;
  return {
    id: 'progress',
    heading: tr(pl, 'Progress Summary', 'Podsumowanie postępu'),
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: tr(pl, 'Initiatives', 'Inicjatywy'), value: total },
          {
            label: tr(pl, 'Avg. progress', 'Śr. postęp'),
            value: avg !== null ? `${avg}%` : '—',
            tone: avg !== null && avg < 30 ? 'warn' : 'default',
          },
          {
            label: tr(pl, 'On track', 'Na torze'),
            value: onTrack,
            hint: `${tr(pl, 'of', 'z')} ${total}`,
            tone: onTrack === total ? 'good' : onTrack < total / 2 ? 'warn' : 'default',
          },
          {
            label: tr(pl, 'Open tasks', 'Otwarte zadania'),
            value: ctx.tasks.length,
          },
        ],
      },
      {
        kind: 'paragraph',
        text:
          avg !== null
            ? tr(
                pl,
                `Across ${total} initiative(s), average reported progress is ${avg}% and ${onTrack} are currently on track.`,
                `W ${total} inicjatywach średni raportowany postęp wynosi ${avg}%, a ${onTrack} jest obecnie na dobrej drodze.`
              )
            : tr(
                pl,
                `Progress fields are not yet populated for the ${total} initiative(s) in scope; figures below rely on status signals.`,
                `Pola postępu nie są jeszcze wypełnione dla ${total} inicjatyw w zakresie; poniższe dane opierają się na sygnałach statusu.`
              ),
      },
    ],
  };
}

function blockedItemsSection(ctx: ReportDataContext, pl: boolean): ReportSection {
  const rows: ReportTableRow[] = ctx.blocked.map((b) => ({
    cells: [b.name, b.reason || tr(pl, 'No reason recorded', 'Brak zapisanej przyczyny')],
    tone: 'critical',
  }));
  return {
    id: 'blocked',
    heading: tr(pl, 'Blocked Items', 'Zablokowane elementy'),
    intro:
      ctx.blocked.length > 0
        ? tr(
            pl,
            `${ctx.blocked.length} initiative(s) are blocked.`,
            `${ctx.blocked.length} inicjatyw jest zablokowanych.`
          )
        : undefined,
    blocks: [
      {
        kind: 'table',
        columns: [tr(pl, 'Initiative', 'Inicjatywa'), tr(pl, 'Blocker', 'Blokada')],
        rows,
        emptyText: tr(pl, 'No blocked initiatives. ✅', 'Brak zablokowanych inicjatyw. ✅'),
      },
    ],
  };
}

function dueSoonSection(ctx: ReportDataContext, pl: boolean): ReportSection {
  const rows: ReportTableRow[] = ctx.dueSoonTasks.slice(0, 12).map((t) => {
    const d = daysUntil(t.dueDate);
    return {
      cells: [
        t.title,
        t.assigneeName || '—',
        d === null
          ? '—'
          : d < 0
            ? tr(pl, `${Math.abs(d)}d overdue`, `${Math.abs(d)}d po terminie`)
            : `${d}d`,
      ],
      tone: d !== null && d < 0 ? 'critical' : d !== null && d <= 2 ? 'warn' : 'default',
    };
  });
  return {
    id: 'due-soon',
    heading: tr(pl, 'Due Soon', 'Zbliżające się terminy'),
    blocks: [
      {
        kind: 'table',
        columns: [
          tr(pl, 'Task', 'Zadanie'),
          tr(pl, 'Owner', 'Właściciel'),
          tr(pl, 'Due', 'Termin'),
        ],
        rows,
        emptyText: tr(pl, 'Nothing due in the near window.', 'Brak zadań z bliskim terminem.'),
      },
    ],
  };
}

function recentChangesSection(ctx: ReportDataContext, pl: boolean): ReportSection {
  const items: string[] = [];
  ctx.delaySignals
    .slice(0, 5)
    .forEach((d) =>
      items.push(
        tr(
          pl,
          `${d.entityName}: ${d.deviationType} by ${d.daysDeviation}d (${d.severity})`,
          `${d.entityName}: ${d.deviationType} o ${d.daysDeviation}d (${d.severity})`
        )
      )
    );
  ctx.riskSignals
    .slice(0, 5)
    .forEach((r) =>
      items.push(`${r.initiativeName ? `${r.initiativeName} — ` : ''}${r.title} (${r.severity})`)
    );
  return {
    id: 'recent',
    heading: tr(pl, 'Recent Changes & Signals', 'Ostatnie zmiany i sygnały'),
    blocks: [
      items.length > 0
        ? { kind: 'list', items }
        : {
            kind: 'callout',
            tone: 'good',
            text: tr(
              pl,
              'No new delay or risk signals this period.',
              'Brak nowych sygnałów opóźnień lub ryzyk w tym okresie.'
            ),
          },
    ],
  };
}

function decisionsNeededSection(ctx: ReportDataContext, pl: boolean): ReportSection {
  const pending = ctx.decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING');
  const rows: ReportTableRow[] = pending.slice(0, 12).map((d) => {
    const days = daysUntil(d.dueDate);
    return {
      cells: [
        d.title,
        d.ownerName || '—',
        days === null ? '—' : days < 0 ? tr(pl, 'overdue', 'po terminie') : `${days}d`,
      ],
      tone: days !== null && days < 0 ? 'critical' : 'default',
    };
  });
  return {
    id: 'decisions',
    heading: tr(pl, 'Decisions Needed', 'Wymagane decyzje'),
    blocks: [
      {
        kind: 'table',
        columns: [
          tr(pl, 'Decision', 'Decyzja'),
          tr(pl, 'Owner', 'Właściciel'),
          tr(pl, 'Due', 'Termin'),
        ],
        rows,
        emptyText: tr(pl, 'No pending decisions.', 'Brak oczekujących decyzji.'),
      },
    ],
  };
}

function ragPerInitiativeSection(ctx: ReportDataContext, pl: boolean): ReportSection {
  const counts = { green: 0, amber: 0, red: 0 };
  const rows: ReportTableRow[] = ctx.initiatives.map((i) => {
    const rag = healthToRag(i.health, i.status);
    counts[rag] += 1;
    return {
      cells: [
        i.name,
        i.owner || '—',
        i.progress != null ? `${Math.round(Number(i.progress))}%` : '—',
        ragLabelFor(rag, pl),
      ],
      tone: ragTone(rag),
    };
  });
  return {
    id: 'rag',
    heading: tr(pl, 'RAG per Initiative', 'RAG per inicjatywa'),
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: tr(pl, 'Green', 'Zielone'), value: counts.green, tone: 'good' },
          { label: tr(pl, 'Amber', 'Żółte'), value: counts.amber, tone: 'warn' },
          { label: tr(pl, 'Red', 'Czerwone'), value: counts.red, tone: 'critical' },
        ],
      },
      {
        kind: 'table',
        columns: [
          tr(pl, 'Initiative', 'Inicjatywa'),
          tr(pl, 'Owner', 'Właściciel'),
          tr(pl, 'Progress', 'Postęp'),
          'RAG',
        ],
        rows,
        emptyText: tr(pl, 'No initiatives in scope.', 'Brak inicjatyw w zakresie.'),
      },
    ],
  };
}

function risksSection(ctx: ReportDataContext, pl: boolean): ReportSection {
  const rows: ReportTableRow[] = ctx.riskSignals.slice(0, 15).map((r) => ({
    cells: [r.initiativeName || '—', r.title, r.severity, r.suggestedAction || '—'],
    tone:
      String(r.severity).toLowerCase().includes('crit') ||
      String(r.severity).toLowerCase().includes('high')
        ? 'critical'
        : 'warn',
  }));
  return {
    id: 'risks',
    heading: tr(pl, 'Top Risks', 'Najważniejsze ryzyka'),
    blocks: [
      {
        kind: 'table',
        columns: [
          tr(pl, 'Initiative', 'Inicjatywa'),
          tr(pl, 'Risk', 'Ryzyko'),
          tr(pl, 'Severity', 'Istotność'),
          tr(pl, 'Suggested action', 'Sugerowane działanie'),
        ],
        rows,
        emptyText: tr(pl, 'No active risk signals.', 'Brak aktywnych sygnałów ryzyka.'),
      },
    ],
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Per-type section assembly
   ──────────────────────────────────────────────────────────────────────────── */

function sectionsForType(typeId: string, ctx: ReportDataContext, pl: boolean): ReportSection[] {
  switch (typeId) {
    case 'weekly-exec':
      return [
        progressSummarySection(ctx, pl),
        blockedItemsSection(ctx, pl),
        dueSoonSection(ctx, pl),
        decisionsNeededSection(ctx, pl),
        recentChangesSection(ctx, pl),
      ];

    case 'program-health':
      return [
        ragPerInitiativeSection(ctx, pl),
        risksSection(ctx, pl),
        decisionsNeededSection(ctx, pl),
      ];

    case 'blockers-recovery': {
      const recovery: ReportSection = {
        id: 'recovery',
        heading: tr(pl, 'Recommended Recovery', 'Zalecana naprawa'),
        blocks: [
          ctx.blocked.length > 0
            ? {
                kind: 'list',
                items: ctx.blocked.map((b) =>
                  tr(
                    pl,
                    `${b.name}: assign an owner, agree an unblock decision, and set a recovery date.`,
                    `${b.name}: przypisz właściciela, uzgodnij decyzję odblokowującą i ustal datę naprawy.`
                  )
                ),
              }
            : {
                kind: 'callout',
                tone: 'good',
                text: tr(
                  pl,
                  'No recovery actions required — nothing is blocked.',
                  'Brak wymaganych działań naprawczych — nic nie jest zablokowane.'
                ),
              },
        ],
      };
      return [blockedItemsSection(ctx, pl), risksSection(ctx, pl), recovery];
    }

    case 'milestone-slippage': {
      const slippage: ReportSection = {
        id: 'slippage',
        heading: tr(pl, 'Slipped & Drifting', 'Poślizgi i odchylenia'),
        blocks: [
          {
            kind: 'table',
            columns: [
              tr(pl, 'Entity', 'Element'),
              tr(pl, 'Deviation', 'Odchylenie'),
              tr(pl, 'Days', 'Dni'),
              tr(pl, 'Severity', 'Istotność'),
            ],
            rows: ctx.delaySignals.slice(0, 20).map((d) => ({
              cells: [d.entityName, d.deviationType, d.daysDeviation, d.severity],
              tone: Math.abs(d.daysDeviation) > 7 ? 'critical' : 'warn',
            })),
            emptyText: tr(
              pl,
              'No milestone slippage detected.',
              'Nie wykryto poślizgów kamieni milowych.'
            ),
          },
          {
            kind: 'table',
            columns: [tr(pl, 'Initiative (missing dates)', 'Inicjatywa (brak dat)')],
            rows: ctx.missingDates.map((m) => ({ cells: [m.name], tone: 'warn' })),
            emptyText: tr(pl, 'All initiatives have dates.', 'Wszystkie inicjatywy mają daty.'),
          },
        ],
      };
      return [slippage, progressSummarySection(ctx, pl)];
    }

    case 'capacity-utilization': {
      const cap: ReportSection = {
        id: 'capacity',
        heading: tr(pl, 'Capacity & Utilization', 'Zasoby i obciążenie'),
        blocks: [
          {
            kind: 'metrics',
            items: [
              {
                label: tr(pl, 'Overload alerts', 'Alerty przeciążenia'),
                value: ctx.capacityAlerts.length,
                tone: ctx.capacityAlerts.length > 0 ? 'warn' : 'good',
              },
              { label: tr(pl, 'Open tasks', 'Otwarte zadania'), value: ctx.tasks.length },
              {
                label: tr(pl, 'Unassigned', 'Nieprzypisane'),
                value: ctx.tasks.filter((t) => !t.assigneeName).length,
                tone: 'warn',
              },
            ],
          },
          {
            kind: 'table',
            columns: [tr(pl, 'Owner', 'Właściciel'), tr(pl, 'Open tasks', 'Otwarte zadania')],
            rows: buildPerOwnerLoad(ctx, pl),
            emptyText: tr(pl, 'No task assignments to report.', 'Brak przypisań zadań do raportu.'),
          },
        ],
      };
      return [cap];
    }

    case 'budget-variance': {
      const budget: ReportSection = {
        id: 'budget',
        heading: tr(pl, 'Budget Variance', 'Odchylenia budżetowe'),
        blocks: [
          {
            kind: 'metrics',
            items: [
              {
                label: tr(pl, 'Overspend signals', 'Sygnały przekroczeń'),
                value: ctx.overspendSignals.length,
                tone: ctx.overspendSignals.length > 0 ? 'critical' : 'good',
              },
              { label: tr(pl, 'Initiatives', 'Inicjatywy'), value: ctx.totalInitiatives },
            ],
          },
          ctx.overspendSignals.length > 0
            ? {
                kind: 'table',
                columns: [tr(pl, 'Initiative', 'Inicjatywa'), tr(pl, 'Detail', 'Szczegóły')],
                rows: ctx.overspendSignals.slice(0, 15).map((s) => ({
                  cells: [
                    String(s.initiativeName || s.name || s.entityName || '—'),
                    String(s.description || s.message || s.detail || s.variance || '—'),
                  ],
                  tone: 'critical',
                })),
              }
            : {
                kind: 'callout',
                tone: 'good',
                text: tr(
                  pl,
                  'No budget overspend signals in the live data.',
                  'Brak sygnałów przekroczeń budżetu w danych na żywo.'
                ),
              },
        ],
      };
      return [budget];
    }

    case 'decision-backlog': {
      const pending = ctx.decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING');
      const aging: ReportSection = {
        id: 'aging',
        heading: tr(pl, 'Approval Aging', 'Wiek zatwierdzeń'),
        blocks: [
          {
            kind: 'metrics',
            items: [
              {
                label: tr(pl, 'Pending', 'Oczekujące'),
                value: pending.length,
                tone: pending.length > 0 ? 'warn' : 'good',
              },
              {
                label: tr(pl, 'Overdue', 'Po terminie'),
                value: ctx.overdueDecisions.length,
                tone: ctx.overdueDecisions.length > 0 ? 'critical' : 'good',
              },
            ],
          },
        ],
      };
      return [aging, decisionsNeededSection(ctx, pl)];
    }

    case 'cross-dependency': {
      const dep: ReportSection = {
        id: 'dependency',
        heading: tr(pl, 'Cross-Initiative Dependencies', 'Zależności międzyinicjatywowe'),
        blocks: [
          {
            kind: 'callout',
            tone: ctx.blocked.length > 0 ? 'warn' : 'info',
            text: tr(
              pl,
              `${ctx.blocked.length} blocked initiative(s) can cascade onto dependents; review the chain for the items below.`,
              `${ctx.blocked.length} zablokowanych inicjatyw może kaskadować na zależne; przejrzyj łańcuch dla poniższych elementów.`
            ),
          },
        ],
      };
      return [dep, blockedItemsSection(ctx, pl), risksSection(ctx, pl)];
    }

    case 'delivery-confidence': {
      const overall = computeOverallRag(ctx);
      const conf: ReportSection = {
        id: 'confidence',
        heading: tr(pl, 'Delivery Confidence', 'Pewność dostarczenia'),
        blocks: [
          {
            kind: 'metrics',
            items: [
              {
                label: tr(pl, 'Program RAG', 'RAG programu'),
                value: ragLabelFor(overall, pl),
                tone: ragTone(overall),
              },
              {
                label: tr(pl, 'Blockers', 'Blokady'),
                value: ctx.blocked.length,
                tone: ctx.blocked.length > 0 ? 'critical' : 'good',
              },
              {
                label: tr(pl, 'Critical risks', 'Ryzyka krytyczne'),
                value: ctx.riskSignals.filter(
                  (r) =>
                    String(r.severity).toLowerCase().includes('crit') ||
                    String(r.severity).toLowerCase().includes('high')
                ).length,
                tone: 'warn',
              },
            ],
          },
        ],
      };
      return [conf, ragPerInitiativeSection(ctx, pl), risksSection(ctx, pl)];
    }

    case 'monthly-pmo':
      return [
        progressSummarySection(ctx, pl),
        ragPerInitiativeSection(ctx, pl),
        risksSection(ctx, pl),
        decisionsNeededSection(ctx, pl),
      ];

    case 'sponsor-onepager': {
      const overall = computeOverallRag(ctx);
      const top3 = ctx.riskSignals
        .slice(0, 3)
        .map((r) => `${r.initiativeName ? `${r.initiativeName}: ` : ''}${r.title} (${r.severity})`);
      const onePager: ReportSection = {
        id: 'onepager',
        heading: tr(pl, 'Executive Summary', 'Streszczenie wykonawcze'),
        blocks: [
          {
            kind: 'metrics',
            items: [
              {
                label: tr(pl, 'Overall', 'Ogólnie'),
                value: ragLabelFor(overall, pl),
                tone: ragTone(overall),
              },
              { label: tr(pl, 'Initiatives', 'Inicjatywy'), value: ctx.totalInitiatives },
              {
                label: tr(pl, 'Blockers', 'Blokady'),
                value: ctx.blocked.length,
                tone: ctx.blocked.length > 0 ? 'critical' : 'good',
              },
              {
                label: tr(pl, 'Decisions for you', 'Decyzje dla Ciebie'),
                value: ctx.overdueDecisions.length,
                tone: ctx.overdueDecisions.length > 0 ? 'warn' : 'good',
              },
            ],
          },
          {
            kind: 'list',
            ordered: true,
            items:
              top3.length > 0
                ? top3
                : [
                    tr(
                      pl,
                      'No top risks flagged this period.',
                      'Brak najważniejszych ryzyk w tym okresie.'
                    ),
                  ],
          },
        ],
      };
      return [onePager, decisionsNeededSection(ctx, pl)];
    }

    default:
      // Generic fallback for any wizard-created custom report id.
      return [
        progressSummarySection(ctx, pl),
        blockedItemsSection(ctx, pl),
        risksSection(ctx, pl),
        decisionsNeededSection(ctx, pl),
      ];
  }
}

function buildPerOwnerLoad(ctx: ReportDataContext, pl: boolean): ReportTableRow[] {
  const map = new Map<string, number>();
  ctx.tasks.forEach((t) => {
    const k = t.assigneeName || tr(pl, 'Unassigned', 'Nieprzypisane');
    map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([owner, count]) => ({
      cells: [owner, count],
      tone: count >= 8 ? 'critical' : count >= 5 ? 'warn' : 'default',
    }));
}

/* ────────────────────────────────────────────────────────────────────────────
   Public entry
   ──────────────────────────────────────────────────────────────────────────── */

export function generateReportDocument(input: ReportGenInput): ReportDocument {
  const { typeId, title, audience, ctx, isPolish } = input;
  const rag = computeOverallRag(ctx);
  const sections = sectionsForType(String(typeId), ctx, isPolish);

  const summary = tr(
    isPolish,
    `${ctx.totalInitiatives} initiative(s) · ${ctx.blocked.length} blocked · ${ctx.overdueDecisions.length} overdue decision(s) · ${ctx.riskSignals.length} risk signal(s).`,
    `${ctx.totalInitiatives} inicjatyw · ${ctx.blocked.length} zablokowanych · ${ctx.overdueDecisions.length} zaległych decyzji · ${ctx.riskSignals.length} sygnałów ryzyka.`
  );

  return {
    typeId,
    title,
    audience,
    periodLabel: periodLabel(input),
    generatedAtLabel: fmtDate(new Date().toISOString(), isPolish),
    rag,
    ragLabel: ragLabelFor(rag, isPolish),
    summary,
    sections,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Markdown export of a generated document
   ──────────────────────────────────────────────────────────────────────────── */

export function reportDocumentToMarkdown(doc: ReportDocument): string {
  const out: string[] = [];
  out.push(`# ${doc.title}`);
  out.push('');
  out.push(`**${doc.ragLabel}** · ${doc.audience} · ${doc.periodLabel}`);
  out.push('');
  out.push(`_${doc.summary}_`);
  out.push('');
  for (const s of doc.sections) {
    out.push(`## ${s.heading}`);
    if (s.intro) out.push(`\n${s.intro}`);
    out.push('');
    for (const b of s.blocks) {
      if (b.kind === 'paragraph') {
        out.push(b.text, '');
      } else if (b.kind === 'callout') {
        out.push(`> ${b.text}`, '');
      } else if (b.kind === 'list') {
        b.items.forEach((it, i) => out.push(b.ordered ? `${i + 1}. ${it}` : `- ${it}`));
        out.push('');
      } else if (b.kind === 'metrics') {
        b.items.forEach((m) =>
          out.push(`- **${m.label}:** ${m.value}${m.hint ? ` (${m.hint})` : ''}`)
        );
        out.push('');
      } else if (b.kind === 'table') {
        if (b.rows.length === 0) {
          out.push(`_${b.emptyText || '—'}_`, '');
        } else {
          out.push(`| ${b.columns.join(' | ')} |`);
          out.push(`| ${b.columns.map(() => '---').join(' | ')} |`);
          b.rows.forEach((r) => out.push(`| ${r.cells.join(' | ')} |`));
          out.push('');
        }
      }
    }
  }
  return out.join('\n');
}
