/**
 * Migawka raportu Realizacji — model i generator (zlecenie 1.12-R4, DEC-427).
 *
 * Zasada: raport = **zamrożony zrzut** realnych danych organizacji na dzień `asOf`
 * (metodyka 1.12, A2 „Migawka raportu"). Generator jest CZYSTĄ funkcją
 * (`buildExecutionReportSnapshot`) — wejściem są odpowiedzi tych samych API, które czyta
 * reszta modułu, więc da się go przetestować bez sieci.
 *
 * Uczciwość zamiast fałszywej zieleni (A1 pkt 8): sekcja bez danych dostaje jawną etykietę
 * „brak danych" z powodem, a RAG ma czwarty kolor SZARY = luka danych.
 */

import { getHeaders } from '@/services/api';
import { decodeHtmlEntities } from '@/utils/decodeHtmlEntities';

import type {
  ExecutionReportRag,
  ExecutionReportSection,
  ExecutionReportSnapshot,
} from '@/services/executionReports/executionReportsApi';

export type Translator = (key: string, fallback: string, options?: Record<string, unknown>) => string;

export interface ExecutionReportInputs {
  initiatives: any[];
  tasks: any[];
  decisions: any[];
  raid: any[];
  signals: any[];
  /** Źródła, których nie udało się odczytać — sekcja powie to wprost zamiast udawać pustkę. */
  unavailable: string[];
}

export interface ExecutionReportPeriod {
  start: string;
  end: string;
}

const DONE_STATUSES = new Set(['done', 'completed', 'closed', 'cancelled']);
const OPEN_DECISION_STATUSES = new Set(['PENDING', 'ESCALATED', 'OPEN', 'IN_REVIEW']);
/**
 * Statusy „w realizacji". POMIAR 06.09 na org DBR77 (`GET /api/initiatives?limit=200`):
 * IN_EXECUTION 23 · APPROVED 12 · PENDING_APPROVAL 16 · DRAFT 9 · CLOSED 9 · REJECTED 3.
 * Plan 1.12 (B1) wymieniał `EXECUTING/BLOCKED/TRACKING/SCHEDULED` — tych wartości w danych
 * NIE MA; zostają w zbiorze jako zgodność wsteczna, ale liczbę robi `IN_EXECUTION`.
 */
const DELIVERY_STATUSES = new Set([
  'IN_EXECUTION',
  'EXECUTING',
  'IN_PROGRESS',
  'BLOCKED',
  'TRACKING',
  'SCHEDULED',
]);

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const dayDiff = (from: string | null | undefined, to: string): number | null => {
  if (!from) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / 86400000);
};

const formatDate = (value: string | null | undefined, locale = 'pl-PL'): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

/**
 * Etykiety surowych stanów. Bez nich dokument pisze `IN_EXECUTION`, `in_progress`
 * i `LATE_START` — czyli angielski identyfikator zamiast zdania po polsku
 * (kształt „klucz istnieje ≠ przetłumaczony").
 */
const labelFor = (t: Translator, group: string, value: unknown, fallback: string): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const key = raw.toUpperCase().replace(/[\s-]+/g, '_');
  return t(`executionReports.${group}.${key}`, raw);
};

/**
 * Tytuły z API przychodzą ZAKODOWANE HTML-owo (`Compliance &amp; GDPR Audit`).
 * Bez dekodowania encja trafia dosłownie do DOCX/PDF — zmierzone na pierwszym eksporcie.
 */
const text = (value: unknown, fallback = '—'): string => {
  const decoded = decodeHtmlEntities(value ?? '').trim();
  return decoded || fallback;
};

/** Osoba bywa obiektem (`{firstName,lastName}`) albo już złożonym napisem. */
const nameOf = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return decodeHtmlEntities(value).trim();
  const person = value as any;
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
};

const personName = (entity: any): string => {
  const composed = nameOf(entity?.assignee) || nameOf(entity?.owner);
  return composed || nameOf(entity?.ownerName) || nameOf(entity?.assigneeName) || '';
};

/** Pobranie realnych danych organizacji. Każde źródło osobno — jedno 500 nie kasuje raportu. */
export async function fetchExecutionReportInputs(
  signal?: AbortSignal
): Promise<ExecutionReportInputs> {
  const unavailable: string[] = [];
  const read = async (url: string, pick: (payload: any) => any[], label: string) => {
    try {
      const response = await fetch(url, { headers: getHeaders(), credentials: 'include', signal });
      if (!response.ok) {
        unavailable.push(label);
        return [];
      }
      return pick(await response.json());
    } catch {
      unavailable.push(label);
      return [];
    }
  };
  const [initiatives, tasks, decisions, raid, signals] = await Promise.all([
    read('/api/initiatives?limit=200', (p) => asArray(p), 'initiatives'),
    read('/api/tasks', (p) => asArray(p?.tasks ?? p), 'tasks'),
    read('/api/decisions', (p) => asArray(p?.decisions ?? p), 'decisions'),
    read('/api/raid', (p) => asArray(p?.items ?? p), 'raid'),
    read('/api/execution-control/delay-signals', (p) => asArray(p?.signals ?? p), 'delaySignals'),
  ]);
  return { initiatives, tasks, decisions, raid, signals, unavailable };
}

interface Derived {
  deliveryInitiatives: any[];
  overdueTasks: any[];
  blockedTasks: any[];
  doneInPeriod: any[];
  openDecisions: any[];
  overdueDecisions: any[];
  escalatedDecisions: any[];
  openRisks: any[];
  criticalSignals: any[];
  upcomingMilestones: any[];
  onTimeRatio: number | null;
}

function derive(
  inputs: ExecutionReportInputs,
  asOf: string,
  period: ExecutionReportPeriod
): Derived {
  const asOfTime = new Date(asOf).getTime();
  const periodStart = new Date(period.start).getTime();
  const periodEnd = new Date(period.end).getTime();

  const deliveryInitiatives = inputs.initiatives.filter((item) =>
    DELIVERY_STATUSES.has(String(item?.status ?? '').toUpperCase())
  );
  const openTasks = inputs.tasks.filter(
    (task) => !DONE_STATUSES.has(String(task?.status ?? '').toLowerCase())
  );
  const overdueTasks = openTasks
    .filter((task) => {
      const due = task?.dueDate ? new Date(task.dueDate).getTime() : NaN;
      return Number.isFinite(due) && due < asOfTime;
    })
    .sort(
      (a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()
    );
  const blockedTasks = openTasks.filter(
    (task) => String(task?.status ?? '').toLowerCase() === 'blocked'
  );
  const doneInPeriod = inputs.tasks.filter((task) => {
    if (!DONE_STATUSES.has(String(task?.status ?? '').toLowerCase())) return false;
    const stamp = new Date(task?.updatedAt ?? task?.completedAt ?? task?.createdAt ?? 0).getTime();
    return Number.isFinite(stamp) && stamp >= periodStart && stamp <= periodEnd;
  });
  const openDecisions = inputs.decisions.filter((decision) =>
    OPEN_DECISION_STATUSES.has(String(decision?.status ?? '').toUpperCase())
  );
  const overdueDecisions = openDecisions
    .filter((decision) => {
      if (decision?.isOverdue === true) return true;
      const due = decision?.dueDate ? new Date(decision.dueDate).getTime() : NaN;
      return Number.isFinite(due) && due < asOfTime;
    })
    .sort((a, b) => Number(b?.daysOverdue ?? 0) - Number(a?.daysOverdue ?? 0));
  const escalatedDecisions = openDecisions.filter(
    (decision) =>
      String(decision?.status ?? '').toUpperCase() === 'ESCALATED' ||
      Number(decision?.escalationLevel ?? 0) > 0
  );
  const openRisks = inputs.raid
    .filter((item) => String(item?.status ?? 'OPEN').toUpperCase() === 'OPEN')
    .sort((a, b) => Number(b?.riskScore ?? 0) - Number(a?.riskScore ?? 0));
  const criticalSignals = inputs.signals
    .filter((item) => String(item?.severity ?? '').toUpperCase() === 'CRITICAL')
    .sort((a, b) => Number(b?.daysDeviation ?? 0) - Number(a?.daysDeviation ?? 0));
  const upcomingMilestones = deliveryInitiatives
    .filter((item) => {
      const end = item?.plannedEndDate ? new Date(item.plannedEndDate).getTime() : NaN;
      return Number.isFinite(end) && end >= asOfTime && end <= asOfTime + 45 * 86400000;
    })
    .sort(
      (a, b) =>
        new Date(a.plannedEndDate ?? 0).getTime() - new Date(b.plannedEndDate ?? 0).getTime()
    );
  const datedTasks = openTasks.filter((task) => Boolean(task?.dueDate));
  const onTimeRatio = datedTasks.length
    ? Math.round(((datedTasks.length - overdueTasks.length) / datedTasks.length) * 100)
    : null;

  return {
    deliveryInitiatives,
    overdueTasks,
    blockedTasks,
    doneInPeriod,
    openDecisions,
    overdueDecisions,
    escalatedDecisions,
    openRisks,
    criticalSignals,
    upcomingMilestones,
    onTimeRatio,
  };
}

/** RAG inicjatywy: czerwony = zablokowana albo krytyczny sygnał; szary = brak dat i postępu. */
function initiativeRag(
  initiative: any,
  signalsByEntity: Map<string, any[]>
): { rag: ExecutionReportRag; deviation: number | null } {
  const signals = signalsByEntity.get(String(initiative?.id)) ?? [];
  const deviation = signals.length
    ? Math.max(...signals.map((signal) => Number(signal?.daysDeviation ?? 0)))
    : null;
  const status = String(initiative?.status ?? '').toUpperCase();
  const hasCritical = signals.some(
    (signal) => String(signal?.severity ?? '').toUpperCase() === 'CRITICAL'
  );
  if (!initiative?.plannedEndDate && initiative?.progress == null) {
    return { rag: 'GREY', deviation };
  }
  if (status === 'BLOCKED' || hasCritical) return { rag: 'RED', deviation };
  if (signals.length) return { rag: 'AMBER', deviation };
  return { rag: 'GREEN', deviation };
}

function emptyOr(section: ExecutionReportSection, reason: string): ExecutionReportSection {
  const hasContent =
    Boolean(section.narrative) ||
    Boolean(section.bullets?.length) ||
    Boolean(section.table?.rows.length);
  return hasContent ? section : { ...section, empty: reason };
}

/**
 * Zamrożona migawka dla wybranej definicji. `t` przekazujemy z zewnątrz, żeby model
 * nie zależał od Reacta i dał się przetestować w izolacji (i żeby dokument powstał
 * w języku interfejsu, a nie po angielsku „na sztywno").
 */
export function buildExecutionReportSnapshot(args: {
  definitionKey: string;
  definitionName: string;
  period: ExecutionReportPeriod;
  asOf: string;
  inputs: ExecutionReportInputs;
  t: Translator;
  locale?: string;
}): ExecutionReportSnapshot {
  const { definitionKey, definitionName, period, asOf, inputs, t } = args;
  const locale = args.locale ?? 'pl-PL';
  const d = derive(inputs, asOf, period);
  const date = (value: string | null | undefined) => formatDate(value, locale);
  const signalsByEntity = new Map<string, any[]>();
  for (const signal of inputs.signals) {
    const key = String(signal?.entityId ?? '');
    if (!key) continue;
    signalsByEntity.set(key, [...(signalsByEntity.get(key) ?? []), signal]);
  }

  const noData = (source: string) =>
    inputs.unavailable.includes(source)
      ? t('executionReports.empty.unavailable', 'Brak danych — źródło nie odpowiedziało.')
      : t('executionReports.empty.none', 'Brak danych w tym okresie.');

  const taskRow = (task: any) => ({
    title: text(task?.title),
    owner: personName(task) || t('executionReports.value.unassigned', 'Nieprzypisane'),
    due: date(task?.dueDate),
    slip: (() => {
      const days = dayDiff(task?.dueDate, asOf);
      return days != null && days > 0
        ? t('executionReports.value.days', '{{count}} dni', { count: days })
        : '—';
    })(),
    status: labelFor(t, 'taskStatus', task?.status, '—'),
  });

  const decisionRow = (decision: any) => ({
    title: text(decision?.title),
    owner: nameOf(decision?.ownerName) || t('executionReports.value.unassigned', 'Nieprzypisane'),
    due: date(decision?.dueDate),
    overdue:
      Number(decision?.daysOverdue ?? 0) > 0
        ? t('executionReports.value.days', '{{count}} dni', {
            count: Number(decision.daysOverdue),
          })
        : '—',
    escalation: labelFor(
      t,
      'escalation',
      decision?.escalationLevelName ?? decision?.status,
      '—'
    ),
  });

  const taskColumns = [
    { id: 'title', label: t('executionReports.col.task', 'Zadanie') },
    { id: 'owner', label: t('executionReports.col.owner', 'Osoba') },
    { id: 'due', label: t('executionReports.col.due', 'Termin') },
    { id: 'slip', label: t('executionReports.col.slip', 'Po terminie') },
    { id: 'status', label: t('executionReports.col.status', 'Status') },
  ];
  const decisionColumns = [
    { id: 'title', label: t('executionReports.col.decision', 'Decyzja') },
    { id: 'owner', label: t('executionReports.col.owner', 'Osoba') },
    { id: 'due', label: t('executionReports.col.due', 'Termin') },
    { id: 'overdue', label: t('executionReports.col.overdue', 'Po terminie') },
    { id: 'escalation', label: t('executionReports.col.escalation', 'Eskalacja') },
  ];
  const milestoneColumns = [
    { id: 'title', label: t('executionReports.col.initiative', 'Inicjatywa') },
    { id: 'planned', label: t('executionReports.col.plannedEnd', 'Koniec wg planu') },
    { id: 'owner', label: t('executionReports.col.owner', 'Osoba') },
    { id: 'deviation', label: t('executionReports.col.deviation', 'Odchylenie') },
  ];

  const milestoneRows = d.upcomingMilestones.slice(0, 12).map((initiative) => {
    const { deviation } = initiativeRag(initiative, signalsByEntity);
    return {
      title: text(initiative?.name),
      planned: date(initiative?.plannedEndDate),
      owner:
        nameOf(initiative?.ownerExecution) ||
        nameOf(initiative?.ownerBusiness) ||
        t('executionReports.value.unassigned', 'Nieprzypisane'),
      deviation:
        deviation != null
          ? t('executionReports.value.days', '{{count}} dni', { count: deviation })
          : '—',
    };
  });

  const metrics = [
    {
      id: 'initiatives',
      label: t('executionReports.metric.initiatives', 'Inicjatywy w realizacji'),
      value: String(d.deliveryInitiatives.length),
      tone: 'NEUTRAL' as const,
    },
    {
      id: 'overdueTasks',
      label: t('executionReports.metric.overdueTasks', 'Zadania po terminie'),
      value: String(d.overdueTasks.length),
      tone: d.overdueTasks.length ? ('CRIT' as const) : ('OK' as const),
    },
    {
      id: 'blocked',
      label: t('executionReports.metric.blocked', 'Zadania zablokowane'),
      value: String(d.blockedTasks.length),
      tone: d.blockedTasks.length ? ('WARN' as const) : ('OK' as const),
    },
    {
      id: 'decisions',
      label: t('executionReports.metric.openDecisions', 'Decyzje do rozstrzygnięcia'),
      value: String(d.openDecisions.length),
      hint: t('executionReports.metric.overdueDecisions', '{{count}} po terminie', {
        count: d.overdueDecisions.length,
      }),
      tone: d.overdueDecisions.length ? ('CRIT' as const) : ('NEUTRAL' as const),
    },
    {
      id: 'onTime',
      label: t('executionReports.metric.onTime', 'Na czas'),
      value:
        d.onTimeRatio == null
          ? t('executionReports.value.noData', 'brak danych')
          : `${d.onTimeRatio}%`,
      tone: d.onTimeRatio == null ? ('GREY' as const) : ('NEUTRAL' as const),
    },
    {
      id: 'risks',
      label: t('executionReports.metric.risks', 'Otwarte pozycje RAID'),
      value: String(d.openRisks.length),
      tone: d.openRisks.length ? ('WARN' as const) : ('OK' as const),
    },
  ];

  let rag: ExecutionReportRag = 'GREEN';
  let ragReason = t('executionReports.rag.green', 'Brak blokad i pozycji po terminie.');
  if (!inputs.tasks.length && !inputs.decisions.length) {
    rag = 'GREY';
    ragReason = t(
      'executionReports.rag.grey',
      'Nie da się ocenić — brak danych źródłowych dla tego okresu.'
    );
  } else if (d.blockedTasks.length || d.criticalSignals.length) {
    rag = 'RED';
    ragReason = t('executionReports.rag.red', '{{blocked}} blokad, {{signals}} sygnałów krytycznych.', {
      blocked: d.blockedTasks.length,
      signals: d.criticalSignals.length,
    });
  } else if (d.overdueTasks.length || d.overdueDecisions.length) {
    rag = 'AMBER';
    ragReason = t(
      'executionReports.rag.amber',
      '{{tasks}} zadań i {{decisions}} decyzji po terminie.',
      { tasks: d.overdueTasks.length, decisions: d.overdueDecisions.length }
    );
  }

  const sections: ExecutionReportSection[] = [];
  const sectionTitle = (index: number, fallback: string) =>
    t(`executionReports.definitions.${definitionKey}.sections.${index}`, fallback);

  if (definitionKey === 'initiative-card') {
    sections.push(
      emptyOr(
        {
          id: 'progress',
          title: sectionTitle(0, 'Postęp i harmonogram'),
          narrative: t(
            'executionReports.narrative.ownerProgress',
            'W realizacji jest {{initiatives}} inicjatyw. Otwartych zadań: {{open}}, z tego {{overdue}} po terminie. Wskaźnik „na czas": {{onTime}}.',
            {
              initiatives: d.deliveryInitiatives.length,
              open: inputs.tasks.length - d.doneInPeriod.length,
              overdue: d.overdueTasks.length,
              onTime:
                d.onTimeRatio == null
                  ? t('executionReports.value.noData', 'brak danych')
                  : `${d.onTimeRatio}%`,
            }
          ),
        },
        noData('tasks')
      ),
      emptyOr(
        {
          id: 'milestones',
          title: sectionTitle(1, 'Kamienie milowe'),
          table: { columns: milestoneColumns, rows: milestoneRows },
        },
        t(
          'executionReports.empty.milestones',
          'Brak danych — kamienie milowe nie istnieją jeszcze jako osobny obiekt (pakiet R3); pokazujemy daty końcowe inicjatyw.'
        )
      ),
      emptyOr(
        {
          id: 'overdue',
          title: sectionTitle(2, 'Zadania po terminie'),
          table: { columns: taskColumns, rows: d.overdueTasks.slice(0, 20).map(taskRow) },
        },
        noData('tasks')
      ),
      emptyOr(
        {
          id: 'blockers',
          title: sectionTitle(3, 'Blokady'),
          table: { columns: taskColumns, rows: d.blockedTasks.slice(0, 20).map(taskRow) },
        },
        noData('tasks')
      ),
      emptyOr(
        {
          id: 'decisions',
          title: sectionTitle(4, 'Decyzje ode mnie'),
          table: { columns: decisionColumns, rows: d.openDecisions.slice(0, 20).map(decisionRow) },
        },
        noData('decisions')
      )
    );
  } else if (definitionKey === 'weekly-exec') {
    sections.push(
      emptyOr(
        {
          id: 'progress',
          title: sectionTitle(0, 'Podsumowanie postępu'),
          narrative: t(
            'executionReports.narrative.weeklyProgress',
            'Okres {{start}} – {{end}}. Domknięte zadania: {{done}}. Otwarte po terminie: {{overdue}}. Zablokowane: {{blocked}}. Decyzje czekające na rozstrzygnięcie: {{decisions}}.',
            {
              start: date(period.start),
              end: date(period.end),
              done: d.doneInPeriod.length,
              overdue: d.overdueTasks.length,
              blocked: d.blockedTasks.length,
              decisions: d.openDecisions.length,
            }
          ),
        },
        noData('tasks')
      ),
      emptyOr(
        {
          id: 'blockers',
          title: sectionTitle(1, 'Blokady i eskalacje'),
          table: { columns: taskColumns, rows: d.blockedTasks.slice(0, 20).map(taskRow) },
          bullets: d.escalatedDecisions
            .slice(0, 8)
            .map((decision) =>
              t('executionReports.bullet.escalated', 'Eskalacja: {{title}} ({{owner}})', {
                title: text(decision?.title),
                owner: nameOf(decision?.ownerName) || '—',
              })
            ),
        },
        noData('tasks')
      ),
      emptyOr(
        {
          id: 'overdue',
          title: sectionTitle(2, 'Pozycje po terminie'),
          table: { columns: taskColumns, rows: d.overdueTasks.slice(0, 25).map(taskRow) },
        },
        noData('tasks')
      ),
      emptyOr(
        {
          id: 'milestones',
          title: sectionTitle(3, 'Najbliższe kamienie'),
          table: { columns: milestoneColumns, rows: milestoneRows },
        },
        t(
          'executionReports.empty.milestones',
          'Brak danych — kamienie milowe nie istnieją jeszcze jako osobny obiekt (pakiet R3); pokazujemy daty końcowe inicjatyw.'
        )
      ),
      emptyOr(
        {
          id: 'decisions',
          title: sectionTitle(4, 'Potrzebne decyzje'),
          table: {
            columns: decisionColumns,
            rows: d.overdueDecisions
              .concat(d.openDecisions.filter((item) => !d.overdueDecisions.includes(item)))
              .slice(0, 25)
              .map(decisionRow),
          },
        },
        noData('decisions')
      )
    );
  } else if (definitionKey === 'program-health') {
    const healthColumns = [
      { id: 'title', label: t('executionReports.col.initiative', 'Inicjatywa') },
      { id: 'status', label: t('executionReports.col.status', 'Status') },
      { id: 'progress', label: t('executionReports.col.progress', 'Postęp') },
      { id: 'deviation', label: t('executionReports.col.deviation', 'Odchylenie') },
      { id: 'rag', label: t('executionReports.col.rag', 'RAG') },
    ];
    const ragLabel: Record<ExecutionReportRag, string> = {
      GREEN: t('executionReports.ragLabel.GREEN', 'Zielony'),
      AMBER: t('executionReports.ragLabel.AMBER', 'Żółty'),
      RED: t('executionReports.ragLabel.RED', 'Czerwony'),
      GREY: t('executionReports.ragLabel.GREY', 'Szary (luka danych)'),
    };
    const healthRows = d.deliveryInitiatives.slice(0, 30).map((initiative) => {
      const { rag: itemRag, deviation } = initiativeRag(initiative, signalsByEntity);
      return {
        title: text(initiative?.name),
        status: labelFor(t, 'initiativeStatus', initiative?.status, '—'),
        progress: initiative?.progress == null ? '—' : `${Number(initiative.progress)}%`,
        deviation:
          deviation != null
            ? t('executionReports.value.days', '{{count}} dni', { count: deviation })
            : '—',
        rag: ragLabel[itemRag],
      };
    });
    sections.push(
      emptyOr(
        {
          id: 'rag',
          title: sectionTitle(0, 'RAG per inicjatywa'),
          table: { columns: healthColumns, rows: healthRows },
        },
        noData('initiatives')
      ),
      emptyOr(
        {
          id: 'alerts',
          title: sectionTitle(1, 'Alerty okresu'),
          bullets: d.criticalSignals
            .slice(0, 12)
            .map((signal) =>
              t(
                'executionReports.bullet.signal',
                '{{name}} — {{type}}, {{days}} dni odchylenia ({{reason}})',
                {
                  name: text(signal?.entityName),
                  type: labelFor(t, 'deviation', signal?.deviationType, '—'),
                  days: Number(signal?.daysDeviation ?? 0),
                  // `detail` z API jest po angielsku („1 high/critical risk(s) active"),
                  // więc etykietę bierzemy z KODU powodu, a nie z gotowego zdania.
                  reason:
                    asArray(signal?.whySlipReasons)
                      .map((item: any) => labelFor(t, 'slipReason', item?.reason, ''))
                      .filter(Boolean)
                      .join('; ') || t('executionReports.value.noReason', 'bez uzasadnienia'),
                }
              )
            ),
        },
        noData('delaySignals')
      ),
      emptyOr(
        {
          id: 'confidence',
          title: sectionTitle(2, 'Pewność dowiezienia'),
          narrative: t(
            'executionReports.narrative.confidence',
            'Na czas: {{onTime}}. Inicjatyw z sygnałem opóźnienia: {{withSignals}} z {{total}}. Otwartych pozycji RAID: {{risks}}, w tym o wysokim wyniku ryzyka: {{highRisks}}.',
            {
              onTime:
                d.onTimeRatio == null
                  ? t('executionReports.value.noData', 'brak danych')
                  : `${d.onTimeRatio}%`,
              // Sygnały dotyczą też zadań i kamieni; licznik ma zliczać TYLKO inicjatywy
              // z tabeli obok, inaczej wychodzi absurd „32 z 23" (zmierzone na eksporcie).
              withSignals: d.deliveryInitiatives.filter((initiative) =>
                signalsByEntity.has(String(initiative?.id))
              ).length,
              total: d.deliveryInitiatives.length,
              risks: d.openRisks.length,
              highRisks: d.openRisks.filter((item) => Number(item?.riskScore ?? 0) >= 12).length,
            }
          ),
        },
        noData('initiatives')
      ),
      emptyOr(
        {
          id: 'narrative',
          title: sectionTitle(3, 'Narracja'),
          narrative: t(
            'executionReports.narrative.program',
            'Ocena okresu: {{rag}} — {{reason}} Największe odchylenie: {{worst}}. Rekomendacja: zdjąć blokady z {{blocked}} zadań i domknąć {{overdueDecisions}} decyzji po terminie przed kolejnym przeglądem.',
            {
              rag: ragLabel[rag],
              reason: ragReason,
              worst: d.criticalSignals.length
                ? `${text(d.criticalSignals[0]?.entityName)} (${Number(
                    d.criticalSignals[0]?.daysDeviation ?? 0
                  )} dni)`
                : t('executionReports.value.none', 'brak'),
              blocked: d.blockedTasks.length,
              overdueDecisions: d.overdueDecisions.length,
            }
          ),
        },
        noData('initiatives')
      ),
      emptyOr(
        {
          id: 'decisions',
          title: sectionTitle(4, 'Decyzje do podjęcia'),
          table: {
            columns: decisionColumns,
            rows: d.escalatedDecisions.slice(0, 20).map(decisionRow),
          },
        },
        noData('decisions')
      )
    );
  } else if (definitionKey === 'sponsor-onepager') {
    const riskColumns = [
      { id: 'title', label: t('executionReports.col.risk', 'Ryzyko / problem') },
      { id: 'type', label: t('executionReports.col.type', 'Typ') },
      { id: 'severity', label: t('executionReports.col.severity', 'Waga') },
      { id: 'score', label: t('executionReports.col.score', 'Wynik') },
    ];
    sections.push(
      emptyOr(
        {
          id: 'progress',
          title: sectionTitle(0, 'Postęp'),
          narrative: t(
            'executionReports.narrative.sponsorProgress',
            'W realizacji {{initiatives}} inicjatyw. Domknięte w okresie: {{done}} zadań. Po terminie: {{overdue}}. Ocena okresu: {{rag}}.',
            {
              initiatives: d.deliveryInitiatives.length,
              done: d.doneInPeriod.length,
              overdue: d.overdueTasks.length,
              rag: t(`executionReports.ragLabel.${rag}`, rag),
            }
          ),
        },
        noData('initiatives')
      ),
      emptyOr(
        {
          id: 'risks',
          title: sectionTitle(1, 'TOP 3 ryzyka'),
          table: {
            columns: riskColumns,
            rows: d.openRisks.slice(0, 3).map((item) => ({
              title: text(item?.title),
              type: labelFor(t, 'raidType', item?.type, '—'),
              severity: labelFor(t, 'severity', item?.severity ?? item?.impact, '—'),
              score: String(item?.riskScore ?? '—'),
            })),
          },
        },
        noData('raid')
      ),
      emptyOr(
        {
          id: 'milestones',
          title: sectionTitle(2, 'Najbliższe kamienie'),
          table: { columns: milestoneColumns, rows: milestoneRows.slice(0, 5) },
        },
        t(
          'executionReports.empty.milestones',
          'Brak danych — kamienie milowe nie istnieją jeszcze jako osobny obiekt (pakiet R3); pokazujemy daty końcowe inicjatyw.'
        )
      ),
      emptyOr(
        {
          id: 'decisions',
          title: sectionTitle(3, 'Decyzje od sponsora'),
          table: {
            columns: decisionColumns,
            rows: d.escalatedDecisions.slice(0, 6).map(decisionRow),
          },
        },
        noData('decisions')
      ),
      emptyOr(
        {
          id: 'wins',
          title: sectionTitle(4, 'Osiągnięcia okresu'),
          bullets: d.doneInPeriod.slice(0, 5).map((task) => text(task?.title)),
        },
        noData('tasks')
      )
    );
  } else {
    // Fala 2 — definicja jest w katalogu, ale nie generuje migawki.
    sections.push({
      id: 'wave2',
      title: t('executionReports.wave2.title', 'Dostępne w Fali 2'),
      empty: t(
        'executionReports.wave2.body',
        'Ta definicja jest widoczna w katalogu, ale nie generuje jeszcze migawki.'
      ),
    });
  }

  return {
    definitionKey,
    title: `${definitionName} · ${date(asOf)}`,
    subtitle: t('executionReports.subtitle', 'Zamrożona migawka danych realizacji'),
    rag,
    ragReason,
    period,
    asOf,
    metrics,
    sections,
  };
}
