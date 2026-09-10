import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  ListChecks,
  UserCog,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { CanonicalWorkHardeningPanel } from '@/components/shared/CanonicalWorkHardeningPanel';
import { ErrorState, SkeletonState } from '@/components/shared/states';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { TaskMilestoneBlastRadius } from '@/components/shared/TaskMilestoneBlastRadius';
import { StandardPreview } from '@/components/standard/StandardPreview';
import {
  StandardTable,
  type StandardTableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { useDeferredLoading } from '@/hooks/useDeferredLoading';
import {
  memberNameOrUnknown,
  type MemberNameResolver,
  readMemberId,
  readMemberLabel,
  useOrganizationMemberNames,
} from '@/hooks/useOrganizationMemberNames';
import { Api } from '@/services/api';
import { OrganizationApi } from '@/services/api/organizations.api';
import { persistentCommandId } from '@/services/initiatives-execution/persistentCommandId';
import {
  completeExecutionTask,
  createExecutionDecision,
  createExecutionMilestone,
  createExecutionTask,
  decideExecutionDecision,
  listExecutionCases,
  readExecutionCase,
  readExecutionMilestones,
  readExecutionWork,
  requestExecutionDecision,
  updateExecutionTask,
} from '@/services/initiatives-execution/runtimeApi';
import { useAppStore } from '@/store/useAppStore';
import { getArtifactPath } from '@/utils/artifactLinks';
import { liczebnik } from '@/utils/liczebnik';
import { formatListDate, formatListDateTime, PUSTA_DATA } from '@/utils/listDateFormat';

import { Banner } from '@/components/shared/Banner';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { ConfirmModal } from '@/components/ui/primitives/Modal';
import {
  MENU_2_FILTER_SELECT,
  MENU_2_FILTERS_ROW,
} from '@/components/shared/ModuleMenu3';

import {
  countExecutionPresets,
  type ExecutionMenu3Contract,
  type ExecutionSurfacePrimaryCta,
} from './canonicalMenu3';
import { fanOutExecutionCases } from './executionCaseFanOut';
import {
  executionLocalReviewEnabled,
  executionReviewCases,
  executionReviewPeople,
  executionReviewRoleLabel,
  getExecutionReviewCase,
  getExecutionReviewMilestones,
  getExecutionReviewWork,
} from './executionLocalReviewData';
import { isTaskBlocked, isTaskOverdue, taskSlipDays } from './executionRealData';
type WorkKind = 'TASK' | 'DECISION';
interface Row extends TableRow {
  id: string;
  title: string;
  kind: WorkKind;
  status: string;
  owner: string;
  dueAt: string;
  rawDueAt: string | null;
  version: number;
  executionCaseId: string;
  initiativeId: string;
  /**
   * 1.12-R1 (B): skąd wiersz pochodzi.
   *   · `runtime` — kanoniczny rejestr `runtime-v1` (0 rekordów na DBR77),
   *   · `tasks`   — tabela zastana `/api/tasks` (84 realne zadania).
   * Rozróżnienie jest potrzebne, bo tylko wiersz `runtime` ma warsztat
   * (kontrola wersji, dowody), a wiersz `tasks` otwiera się jako karta
   * zadania w Mojej Pracy.
   */
  origin: 'runtime' | 'tasks';
  initiativeName: string;
  /** Dni po terminie (dodatnie) albo `null` — patrz executionRealData.taskSlipDays. */
  slipDays: number | null;
  source: any;
}
export interface ExecutionWorkDocumentRef {
  id: string;
  title: string;
  kind: WorkKind;
  status: string;
  executionCaseId: string;
}
interface Milestone {
  milestoneId: string;
  version: number;
  executionCaseId: string;
  initiativeId: string;
  baselineRef: { ref: string; version: number };
  title: string;
  ownerId: string;
  targetAt: string | null;
  forecastAt: string | null;
  status: string;
  readiness: string;
  forecastVarianceDays: number | null;
  evidenceRefs: string[];
  sourceVersions: { executionCaseVersion: number; baselineVersion: number };
}
/**
 * J7b: słowniki module-scope trzymają ANGIELSKI (zasada §2.3 PLANU językowego —
 * `defaultValue` w kodzie jest zawsze angielski, polski żyje wyłącznie
 * w `public/locales/pl/translation.json`). Do 08.09 były polskie, więc
 * użytkownik EN widział „Wykonane" i „Oczekuje na decyzję" w kolumnie Status.
 */
const workKindLabel: Record<WorkKind, string> = { TASK: 'Task', DECISION: 'Decision' };
const workStatusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Awaiting decision',
  OPEN: 'Open',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
  CANCELED: 'Cancelled',
  APPROVED: 'Approved',
  CONDITIONALLY_APPROVED: 'Conditionally approved',
  REJECTED: 'Rejected',
  RETURNED: 'Returned',
  READY: 'Ready',
  AT_RISK: 'At risk',
  ACHIEVED: 'Achieved',
  UNKNOWN: 'No data',
  // Zmierzone na zrzucie PO (05.09, execution-tab-work): realne zadania ze
  // stagingu przychodzą ze statusem IN_PROGRESS, którego ta mapa nie znała —
  // kolumna Status mieszała polskie „Otwarte"/„Oczekuje na decyzję" z surowym
  // IN_PROGRESS w sąsiednich wierszach tej samej tabeli.
  IN_PROGRESS: 'In progress',
  // 1.12-R1 (B), zmierzone na zrzucie /execution?tab=work: realne zadania
  // z `/api/tasks` niosą słownik `TaskStatus` (TODO/IN_PROGRESS/BLOCKED/DONE)
  // plus `REVIEW` — kolumna Status pisała surowe „TODO", „REVIEW", „DONE"
  // obok polskich „W toku"/„Zablokowane" w sąsiednich wierszach.
  TODO: 'To do',
  REVIEW: 'In review',
  IN_REVIEW: 'In review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

/** Rodzaj elementu pracy w języku interfejsu (klucz `execution.work.kind.*`). */
const etykietaRodzaju = (kind: string, t: (key: string, fallback: string) => string): string =>
  t(`execution.work.kind.${String(kind ?? '').toLowerCase()}`, workKindLabel[kind as WorkKind] ?? String(kind ?? ''));
/**
 * Nazwisko osoby — z KATALOGU OSÓB, nie z zamiany myślnika na spację.
 *
 * Do 2026-09-02 ta funkcja robiła `value.replaceAll('-', ' ')`, więc kolumna
 * „Właściciel / Osoba decyzyjna" pisała `anna kowalska` z małej litery, a panel
 * podglądu OBOK, na tym samym ekranie, pisał `Anna Kowalska` (bo używa
 * `businessLabel`, który podnosi pierwsze litery). Ten sam człowiek, dwa zapisy,
 * jeden kadr. Diakrytyków (`Wiśniewski`, `Wójcik`) żadna zamiana znaków nie
 * odtworzy — dlatego źródłem jest katalog w danych, a zamiana została wyłącznie
 * jako ostatnia deska ratunku dla identyfikatora spoza katalogu.
 *
 * Wzorzec przejęty z `ExecutionResourcesSurface.businessLabel` (naprawiony
 * 01.09 dokładnie na tym defekcie) — granica po Unicode `\p{L}`, bez
 * `toLowerCase`, żeby „Wójcik" i „McKenzie" zostały, jak są.
 */
/**
 * Identyfikator UUID nie jest nazwiskiem i nie wolno go w nazwisko przerabiać.
 *
 * Zmierzone na zrzucie PO (05.09, execution-tab-work): realne zadania stagingu
 * niosą w `assigneeId` czyste UUID-y, a zamiana myślników na spacje z dużymi
 * literami robiła z nich „D2b6a316 08c5 47cf 9bf7 4ba50311d5a2" — coś, co
 * WYGLĄDA jak imię i nazwisko, a nim nie jest. Fałszywa nazwa jest gorsza niż
 * uczciwy identyfikator, więc UUID zostaje UUID-em.
 *
 * ZGŁASZAM (nie naprawiam — to decyzja produktowa, nie etykieta): ta
 * powierzchnia nie ma ŻADNEGO źródła nazwisk poza katalogiem demo
 * `executionReviewPeople`. Dopóki API pracy nie poda `assigneeName` albo nie
 * będzie tu odpytania katalogu osób, kolumna „Właściciel / osoba decyzyjna"
 * dla realnych danych pokaże identyfikator.
 */
const isOpaqueIdentifier = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

/**
 * 2026-09-05 (runda 3 odbioru, `execution-tab-work`): ŹRÓDŁO NAZWISK JUŻ JEST.
 *
 * Komentarz powyżej zgłaszał („nie naprawiam — to decyzja produktowa"), że ta
 * powierzchnia nie ma żadnego katalogu osób poza demo-słownikiem
 * `executionReviewPeople`, więc realne dane muszą pokazać identyfikator.
 * Katalog jest: `GET /api/organizations/:id/members` (ta sama lista, z której
 * korzystają Wyniki). Kolejność: katalog organizacji → słownik demo →
 * prettifier dla identyfikatorów czytelnych → „Nieznany użytkownik" dla UUID.
 * UUID nigdy nie trafia na ekran jako nazwisko (obraz zatwierdzony ma tu
 * „Anna Kowalska", „Marek Nowak", „Katarzyna Wójcik").
 */
const actorLabel = (
  value: string,
  t: (key: string, fallback: string) => string,
  resolveMemberName?: MemberNameResolver,
  isPolish = true
) => {
  const fromDirectory = value ? resolveMemberName?.(value) : null;
  if (fromDirectory) return fromDirectory;
  const fromDemo = executionReviewRoleLabel(value, t) ?? executionReviewPeople[value];
  if (fromDemo) return fromDemo;
  if (isOpaqueIdentifier(value)) return memberNameOrUnknown(resolveMemberName, value, isPolish);
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/(^|[\s/])(\p{L})/gu, (_m, separator, letter) => separator + letter.toUpperCase());
};
// i18n-reszta 20260903: kolumny przeniesione do funkcji wywoływanej z `t`
// wewnątrz komponentu (patrz `useMemo` w ciele `ExecutionWorkSurface`) —
// poprzednio literały PL na module-scope nie reagowały na `?lang=` (pomiar
// nadzorcy 03.09, execution-tab-work).
/**
 * 1.12-R1 (B): kolumny wg planu C2 (wiersz 3) —
 * Zadanie · Inicjatywa · Osoba · Termin · Status · Poślizg (dni).
 *
 * USUNIĘTA kolumna „Termin / SLA". POMIAR (plan B2/B5): tabela `tasks` nie ma
 * pola `slaAt`, więc kolumna pisała „· SLA brak" w KAŻDYM wierszu — pusta
 * kolumna zajmowała szerokość i udawała informację. W jej miejsce wchodzi
 * „Poślizg (dni)", który dla tych samych danych ma realną wartość.
 */
/** Słownik statusów zadania z serwera (`GET /api/tasks/workflow-config`). */
export interface SlownikStatusowZadania {
  statuses: string[];
  transitions: Record<string, string[]>;
}

/** Pola edytowalne w wierszu — dokładnie te trzy, które PMO zmienia na stand-upie. */
export type PoleEdycjiZadania = 'assigneeId' | 'dueDate' | 'status';

/** ISO → `RRRR-MM-DD` dla `input[type=date]`; puste, gdy terminu nie ma. */
const naWartoscDaty = (value: string | null | undefined): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

/**
 * Etykieta statusu zadania w języku interfejsu. Słownik `workStatusLabel` jest
 * polski i module-scope (nie reaguje na `?lang=`), więc angielska wersja idzie
 * przez `t` z kluczem `execution.work.status.<wartość serwera>`.
 */
const etykietaStatusu = (status: string, t: (key: string, fallback: string) => string): string => {
  const serwerowy = String(status ?? '').toLowerCase();
  const angielski = workStatusLabel[String(status ?? '').toUpperCase()] ?? String(status ?? '');
  return t(`execution.work.status.${serwerowy}`, angielski);
};

/**
 * ZADANIA BEZ INICJATYWY NA KONIEC (D5, plan P16 §4).
 *
 * POMIAR 07.09: 20 z 84 zadań demo nie ma `initiative_id`, a że przychodzą z
 * `/api/tasks` w kolejności utworzenia, zajmowały CAŁY pierwszy ekran kolumną
 * „—". Menedżer otwierał zakładkę i widział wyłącznie wiersze bez kontekstu.
 * Sortowanie jest STABILNE (zachowuje kolejność serwera wewnątrz obu grup), bo
 * kolejność w grupie z inicjatywą niesie sens (data utworzenia), a przetasowanie
 * jej „przy okazji" byłoby zmianą, o którą nikt nie prosił.
 */
export function sortujBezInicjatywyNaKoniec<T extends { initiativeId?: string }>(
  rows: readonly T[]
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aBez = a.row.initiativeId ? 0 : 1;
      const bBez = b.row.initiativeId ? 0 : 1;
      if (aBez !== bBez) return aBez - bBez;
      return a.index - b.index;
    })
    .map((wpis) => wpis.row);
}

interface KontekstKolumn {
  t: (key: string, fallback: string) => string;
  resolveMemberName?: MemberNameResolver;
  isPolish: boolean;
  osoby: Array<{ id: string; label: string }>;
  slownikStatusow: SlownikStatusowZadania | null;
  /** Wiersz edytowalny w tabeli — tylko rekord z `/api/tasks` (patrz `Row.origin`). */
  edytowalny: (row: TableRow) => boolean;
  zapisz: (row: TableRow, pole: PoleEdycjiZadania, wartosc: string | null) => void;
}

const buildCols = ({
  t,
  resolveMemberName,
  isPolish,
  osoby,
  slownikStatusow,
  edytowalny,
  zapisz,
}: KontekstKolumn): StandardTableColumn[] => {
  const podpowiedz = t('execution.work.edit.hint', 'Double-click to change');
  const podpowiedzBrak = t('execution.work.edit.notEditable', 'This row comes from the canonical execution register — open the work item to change it.'
  );
  const brakOsoby = t('execution.work.edit.unassigned', 'Unassigned');

  return [
    {
      id: 'title',
      label: t('execution.work.columns.title', 'Task'),
      sortable: true,
      width: '260px',
    },
    {
      id: 'initiativeName',
      label: t('execution.work.columns.initiative', 'Initiative'),
      sortable: true,
      width: '200px',
      // „—" nie mówi, czy danych brakuje, czy zadanie naprawdę nie należy do
      // żadnej inicjatywy. Tu wiadomo, że to drugie (pole jest puste w bazie).
      render: (row) =>
        (row.initiativeName as string) || (
          <span className="text-c-text-muted">
            {t('execution.work.withoutInitiative', 'No initiative')}
          </span>
        ),
    },
    {
      id: 'owner',
      label: t('execution.work.columns.person', 'Person'),
      sortable: true,
      width: '170px',
      render: (row) => actorLabel(row.owner as string, t, resolveMemberName, isPolish),
      editable: {
        kind: 'select',
        ariaLabel: t('execution.work.edit.person', 'Change assignee'),
        hint: podpowiedz,
        disabledHint: podpowiedzBrak,
        isEditable: edytowalny,
        value: (row) => String(row.owner ?? ''),
        options: () => [
          { value: '', label: brakOsoby },
          ...osoby.map((osoba) => ({ value: osoba.id, label: osoba.label })),
        ],
        onCommit: (row, wartosc) => zapisz(row, 'assigneeId', wartosc || null),
      },
    },
    {
      id: 'dueAt',
      label: t('execution.work.columns.due', 'Deadline'),
      sortable: true,
      width: '150px',
      editable: {
        kind: 'date',
        ariaLabel: t('execution.work.edit.due', 'Change due date'),
        hint: podpowiedz,
        disabledHint: podpowiedzBrak,
        isEditable: edytowalny,
        value: (row) => naWartoscDaty(row.rawDueAt as string | null),
        onCommit: (row, wartosc) => zapisz(row, 'dueDate', wartosc || null),
      },
    },
    {
      id: 'status',
      label: t('execution.work.columns.status', 'Status'),
      sortable: true,
      width: '150px',
      render: (row) => <span role="status">{etykietaStatusu(row.status as string, t)}</span>,
      editable: {
        kind: 'select',
        ariaLabel: t('execution.work.edit.status', 'Change status'),
        hint: podpowiedz,
        disabledHint: podpowiedzBrak,
        isEditable: edytowalny,
        value: (row) => String(row.status ?? '').toLowerCase(),
        /**
         * Lista = status bieżący + przejścia DOPUSZCZONE PRZEZ SERWER
         * (`GET /api/tasks/workflow-config` → `validateTaskStatusTransition`).
         * Nie wymyślamy własnego słownika: gdyby lista była szersza, użytkownik
         * dostawałby 400 za wybór, który mu sami pokazaliśmy.
         */
        options: (row) => {
          const biezacy = String(row.status ?? '').toLowerCase();
          const dozwolone = slownikStatusow?.transitions?.[biezacy] ?? [];
          return [biezacy, ...dozwolone]
            .filter((wartosc, index, lista) => wartosc && lista.indexOf(wartosc) === index)
            .map((wartosc) => ({ value: wartosc, label: etykietaStatusu(wartosc, t) }));
        },
        onCommit: (row, wartosc) => zapisz(row, 'status', wartosc),
      },
    },
    {
      id: 'slipDays',
      // „Poślizg" to odchylenie wobec planu bazowego (wraca z R3, gdy będą
      // kamienie i baseline). To, co ta kolumna liczy naprawdę, to
      // `dziś − termin` dla zadań niezakończonych — czyli DNI PO TERMINIE.
      // Mylenie tych dwóch liczb jest najczęstszym błędem rynku
      // (`AUDYT_RYNKU_PMO_20260907.md` §4.1).
      label: t('execution.work.columns.daysOverdue', 'Days overdue'),
      sortable: true,
      width: '130px',
      render: (row) => {
        const dni = row.slipDays as number | null;
        if (dni == null) return <span className="text-c-text-muted">—</span>;
        return <span className="font-semibold tabular-nums text-c-danger">+{dni}</span>;
      },
    },
  ];
};
/**
 * 1.12-R1 (B): TRZY chipy zamiast jedenastu.
 *
 * Kanon list (`docs/ui-standards/TRIADA_KANON.md`) dopuszcza w Menu 3 do
 * trzech pozycji; ta powierzchnia miała ich 11 („Tasks", „Decisions",
 * „Due soon", „Missing owner", „Missing DoD/evidence", „Waiting dependency",
 * „Mine", „By team" — osiem skasowanych). Zostaje to, co menedżer realizacji
 * naprawdę filtruje na stand-upie: wszystko · po terminie · zablokowane.
 */
const workPresets = ['all', 'overdue', 'blocked'] as const;
/**
 * J7b: daty przez SSOT list (`src/utils/listDateFormat.ts`). Do 08.09 stało tu
 * `Intl.DateTimeFormat('pl-PL', { month: 'short' })`, więc konto angielskie
 * dostawało „05 lut 2026" w KAŻDYM wierszu kolumny „Due".
 */
const formatDateTime = (value: string | null | undefined) =>
  formatListDateTime(value, PUSTA_DATA);
/** Sam termin, bez godziny — kolumna „Termin" ma być czytelna, nie precyzyjna do minuty. */
const formatDate = (value: string | null | undefined) => formatListDate(value);

/**
 * 1.12-R1 (B): wiersze z KANONICZNEGO rejestru `runtime-v1`.
 * Wydzielone z czterech identycznych kopii w `loadCases`/`load(id)` — cztery
 * kopie znaczyły cztery miejsca, w których trzeba pamiętać o nowym polu.
 */
const mapRuntimeWorkRows = (
  work: { tasks?: any[]; decisions?: any[] } | null | undefined,
  executionCaseId: string,
  initiativeId: string,
  initiativeName: string
): Row[] => [
  ...((work?.tasks ?? []) as any[]).map((item) => ({
    id: item.taskId,
    title: item.title,
    kind: 'TASK' as const,
    status: item.status,
    owner: item.assigneeId,
    dueAt: formatDate(item.dueAt),
    rawDueAt: item.dueAt ?? null,
    version: item.version,
    executionCaseId,
    initiativeId,
    origin: 'runtime' as const,
    initiativeName,
    slipDays: taskSlipDays({ status: item.status, dueDate: item.dueAt }),
    source: item,
  })),
  ...((work?.decisions ?? []) as any[]).map((item) => ({
    id: item.decisionId,
    title: item.title,
    kind: 'DECISION' as const,
    status: item.status,
    owner: item.authorityId,
    dueAt: formatDate(item.dueAt),
    rawDueAt: item.dueAt ?? null,
    version: item.version,
    executionCaseId,
    initiativeId,
    origin: 'runtime' as const,
    initiativeName,
    slipDays: taskSlipDays({ status: item.status, dueDate: item.dueAt }),
    source: item,
  })),
];

/**
 * 1.12-R1 (B): wiersze z TABELI ZASTANEJ `/api/tasks`.
 *
 * POMIAR 06.09 (DBR77): `runtime-v1/.../work` zwraca 0 zadań, a `/api/tasks`
 * — 84 (82 z terminem, 81 z osobą, 64 z inicjatywą, 20 po terminie). Zakładka
 * „Praca" czytała wyłącznie tę pierwszą listę i dlatego była pusta. Oba
 * źródła są rozłączne (osobne tabele), więc łączymy je, a nie zastępujemy:
 * gdy handoff zacznie tworzyć realizacje, ich zadania po prostu dojdą.
 */
export const mapRealTaskRows = (
  tasks: any[],
  /**
   * 1.12-R1 (B): KATALOG INICJATYW. Zmierzone na zrzucie 06.09 — kolumna
   * INICJATYWA pokazywała „—" w KAŻDYM z 84 wierszy, mimo że 64 zadania mają
   * `initiativeId`: `GET /api/tasks` zwraca sam identyfikator, bez nazwy.
   * Nazwa przychodzi z `GET /api/initiatives`, tej samej listy, którą czyta
   * zakładka „Realizacje".
   */
  initiativeNameById: Map<string, string> = new Map()
): Row[] =>
  (tasks ?? []).map((task) => ({
    id: String(task.id),
    title: task.title ?? '—',
    kind: 'TASK' as const,
    status: String(task.status ?? '').toUpperCase(),
    owner: String(task.assigneeId ?? task.ownerId ?? ''),
    dueAt: formatDate(task.dueDate),
    rawDueAt: task.dueDate ?? null,
    version: 0,
    executionCaseId: '',
    initiativeId: String(task.initiativeId ?? task.roadmapInitiativeId ?? ''),
    origin: 'tasks' as const,
    initiativeName: String(
      task.initiativeName ??
        initiativeNameById.get(String(task.initiativeId ?? task.roadmapInitiativeId ?? '')) ??
        ''
    ),
    slipDays: taskSlipDays(task),
    source: task,
  }));

const businessLabel = (
  value: string | null | undefined,
  fallback: string,
  t: (key: string, fallback: string) => string,
  resolveMemberName?: MemberNameResolver,
  isPolish = true
) => {
  if (!value) return fallback;
  // Katalog organizacji ma pierwszeństwo — panel podglądu i tabela obok muszą
  // pisać o tej samej osobie tak samo (2026-09-05).
  const fromDirectory = resolveMemberName?.(value);
  if (fromDirectory) return fromDirectory;
  // Osoba ma nazwisko w katalogu; `\b\w` nie podnosi liter spoza ASCII, więc
  // granica liczona po Unicode (ten sam kontrakt co `actorLabel` wyżej).
  const fromDemo = executionReviewRoleLabel(value, t) ?? executionReviewPeople[value];
  if (fromDemo) return fromDemo;
  if (isOpaqueIdentifier(value)) return memberNameOrUnknown(resolveMemberName, value, isPolish);
  return value
    .replace(/^(task|decision|case|initiative)[-_:]/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/(^|[\s/])(\p{L})/gu, (_m, separator, letter) => separator + letter.toUpperCase());
};
export const ExecutionWorkSurface = ({
  activePreset,
  onCountsChange,
  onOpenDocument,
  documentId,
  onRegisterFilterControl,
  onRegisterPrimaryCta,
  onRegisterMenu3Control,
}: ExecutionMenu3Contract & {
  onOpenDocument?: (row: ExecutionWorkDocumentRef) => void;
  documentId?: string | null;
  /**
   * Rejestruje JEDEN primary CTA zakładki do prawego skraju Menu 2 gospodarza
   * (kanon TRIADA §A2: „od PRAWEJ do środka: primary CTA → segment → filtry",
   * §C4: ciemny wypełniony, w dark jasny inwers).
   *
   * POWÓD (uwaga właściciela 08.09.2026): „Nowe zadanie" jechało dotąd przez
   * `onRegisterFilterControl` jako `btn-secondary` — czyli akcja tworzenia
   * siedziała w slocie FILTRÓW i miała wygląd przycisku pomocniczego, podczas
   * gdy bliźniacze „Nowa inicjatywa" w Inicjatywach było ciemnym CTA. Ta sama
   * rola, dwa wyglądy w sąsiadujących modułach.
   */
  onRegisterPrimaryCta?: (cta: ExecutionSurfacePrimaryCta | null) => void;
  /**
   * Prawy slot Menu 3 — kebab z RZADKIMI akcjami tworzenia, które nie mogą
   * być drugim CTA (kanon: JEDEN primary CTA na zakładkę). Ten sam kanał
   * i ten sam kebab (`RowActionsMenu`) co w `ExecutionReportsSurface`
   * (P16-R6/D6) — nie budujemy nowego prymitywu.
   */
  onRegisterMenu3Control?: (node: React.ReactNode) => void;
  /**
   * Rejestruje węzeł kontrolki (filtr realizacji + akcje "Nowe…") do
   * prawej strony Menu 2 gospodarza (ExecutionHub). Ten sam wzorzec co
   * `RolloutTab.onRegisterCommandRowContent` — właściciel (odbiór grafiki
   * 165-menu3-pasek, execution-tab-work) zgłosił, że blok tytuł+opis+filtr
   * NIE powinien rozpychać pionu między Menu 3 a tabelą: "on może spokojnie
   * być z prawej strony menu 2. W całej aplikacji mamy standard że tabela
   * zaczyna się pod menu 3."
   */
  onRegisterFilterControl?: (node: React.ReactNode) => void;
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const resolveMemberName = useOrganizationMemberNames();
  const navigate = useNavigate();
  const currentOrganizationId = useAppStore((store) => store.currentOrganization?.id ?? null);
  const actorId = useAppStore((store) => store.currentUser?.id ?? null);
  const [cases, setCases] = useState<Array<any>>([]),
    [caseId, setCaseId] = useState(''),
    [caseVersion, setCaseVersion] = useState(1),
    [initiativeId, setInitiativeId] = useState(''),
    [baselineRef, setBaselineRef] = useState({ ref: '', version: 0 }),
    [milestones, setMilestones] = useState<Milestone[]>([]),
    [milestoneForm, setMilestoneForm] = useState({
      id: '',
      title: '',
      ownerId: '',
      targetAt: '',
      forecastAt: '',
      evidenceRefs: '',
    }),
    [rows, setRows] = useState<Row[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [showWorkspace, setShowWorkspace] = useState(false),
    [toolMode, setToolMode] = useState<'NONE' | 'MILESTONE' | 'TASK' | 'DECISION'>('NONE'),
    [form, setForm] = useState({
      id: '',
      title: '',
      description: '',
      assigneeId: '',
      ownerId: '',
      authorityId: '',
      dueAt: '',
      slaAt: '',
      evidenceRefs: '',
      blockers: '',
      dependencies: '',
      milestoneIds: '',
      rationale: '',
      conditions: '',
    }),
    [state, setState] = useState<'READY' | 'LOADING' | 'ERROR'>('LOADING'),
    // Realizacje, których backend nie zwrócił (błąd albo brak odpowiedzi w czasie).
    // Stan jawny, bo cicha luka w liście to gorsze kłamstwo niż wisząca zakładka.
    [unreachableCaseIds, setUnreachableCaseIds] = useState<string[]>([]);

  // ── D5: edycja w wierszu i tworzenie zadania (P16-R2) ────────────────────
  /** Katalog osób do selecta „Osoba" — ta sama lista, z której idą nazwiska. */
  const [osoby, setOsoby] = useState<Array<{ id: string; label: string }>>([]);
  /** Słownik statusów + dozwolone przejścia — Z SERWERA, nie z kopii w kodzie. */
  const [slownikStatusow, setSlownikStatusow] = useState<SlownikStatusowZadania | null>(null);
  /** Inicjatywy do selecta „Inicjatywa" w formularzu „Nowe zadanie". */
  const [inicjatywy, setInicjatywy] = useState<Array<{ id: string; name: string }>>([]);
  /** Błąd zapisu PRZY WIERSZU — cisza po nieudanym zapisie jest zakazana. */
  const [bladWiersza, setBladWiersza] = useState<{ rowId: string; message: string } | null>(null);
  const [zapisywanyWiersz, setZapisywanyWiersz] = useState<string | null>(null);
  /**
   * Otwarta akcja podglądu (Zmień osobę / Zmień termin / Zmień status) —
   * edytor w podglądzie.
   *
   * E3/P2 (10.09): dołożony `status`. Odbiór W1B zmierzył, że „Zamknij zadanie"
   * jest wyłączone z podpisem „ustaw najpierw W toku albo W przeglądzie" —
   * A NIE MA CZYM USTAWIĆ: kontrolki statusu nie było ani w kebabie wiersza,
   * ani w stopce podglądu. Edytor statusu istniał wyłącznie w komórce tabeli
   * (dwuklik), a dwuklik na wierszu otwiera przestrzeń roboczą — więc dla
   * użytkownika droga do zmiany statusu nie istniała.
   */
  const [edycjaPodgladu, setEdycjaPodgladu] = useState<'owner' | 'due' | 'status' | null>(null);
  /** Zadanie wskazane do usunięcia — potwierdzenie przez `ConfirmModal`. */
  const [zadanieDoUsuniecia, setZadanieDoUsuniecia] = useState<Row | null>(null);
  const [usuwanieWToku, setUsuwanieWToku] = useState(false);
  /** Formularz „Nowe zadanie" (Menu 2). */
  const [formularzNowego, setFormularzNowego] = useState<{
    otwarty: boolean;
    title: string;
    initiativeId: string;
    assigneeId: string;
    dueDate: string;
    status: string;
    blad: string | null;
    zapisywanie: boolean;
  }>({
    otwarty: false,
    title: '',
    initiativeId: '',
    assigneeId: '',
    dueDate: '',
    status: 'todo',
    blad: null,
    zapisywanie: false,
  });

  const loadingPhase = useDeferredLoading(state === 'LOADING');
  /**
   * Uczciwy stan częściowy — CICHY PASEK INFORMACYJNY POD MENU 3, nie w Menu 2.
   *
   * Historia tego jednego komunikatu jest historią całego zlecenia:
   *  · do 2026-09-05 — akapit tuż nad tabelą, rozpychał pion tam, gdzie kanon
   *    każe zaczynać tabelę („tabela zaczyna się pod menu 3", uwaga 02.09);
   *  · 2026-09-05 → 08 — PLAKIETKA W MENU 2 (`onRegisterFilterControl`), i to
   *    właśnie ona złamała pasek na zrzucie właściciela 08.09.2026: baner
   *    w linii 1, select „Wszystkie realizacje" w linii 2, „Nowe zadanie"
   *    w linii 3. Kanon §A2 mówi wprost: Menu 2 bez banerów, jedna linia;
   *  · teraz — `Banner variant="degraded"` (SSOT `shared/Banner`, ten sam
   *    komponent co Finanse/Ustawienia) NAD tabelą, wewnątrz treści zakładki.
   *    Pion rośnie o jeden pasek TYLKO w stanie zdegradowanym, a pasek modułu
   *    zostaje jednolinijkowy zawsze.
   *
   * Pokazuje się WYŁĄCZNIE gdy dane naprawdę są zdegradowane: stan READY i
   * co najmniej jedna realizacja, której nie udało się pobrać.
   */
  const degradedBanner = useMemo(() => {
    if (state !== 'READY' || unreachableCaseIds.length === 0) return null;
    const count = unreachableCaseIds.length;
    return (
      <div data-testid="execution-work-degraded-banner">
        <Banner
        variant="degraded"
        icon={<AlertTriangle size={16} aria-hidden="true" />}
        className="mb-3"
        title={t('execution.work.degraded', {
          count,
          unit: isPolish
            ? liczebnik(count, ['realizacja', 'realizacje', 'realizacji'])
            : count === 1
              ? 'delivery'
              : 'deliveries',
          defaultValue: 'Incomplete data: {{count}} {{unit}} not responding',
        })}
        message={unreachableCaseIds.join(', ')}
        />
      </div>
    );
  }, [state, unreachableCaseIds, t, isPolish]);
  const loadCases = useCallback(async () => {
    setState('LOADING');
    // 1.12-R1 (B): REALNE ZADANIA ORGANIZACJI, niezależnie od realizacji.
    // Pobrane osobno i przed wachlarzem, żeby jedna wisząca realizacja
    // `runtime-v1` (defekt zmierzony 05.09) nie zabrała ze sobą 84 zadań,
    // które z nią nic wspólnego nie mają. Błąd tego wołania NIE wywraca
    // zakładki — po prostu nie ma tych wierszy (uczciwie, bez wyjątku).
    let realTaskRows: Row[] = [];
    try {
      const [zadania, inicjatywy] = await Promise.all([
        Api.getTasks(),
        // Nazwa inicjatywy do kolumny „Inicjatywa" — brak tej listy zamieniał
        // 64 z 84 wierszy w „—" (zmierzone na zrzucie 06.09).
        Api.getInitiatives().catch(() => [] as any[]),
      ]);
      const nazwyInicjatyw = new Map<string, string>(
        (inicjatywy ?? [])
          .filter((i: any) => i?.id && i?.name)
          .map((i: any) => [String(i.id), String(i.name)])
      );
      // Ta sama lista zasila select „Inicjatywa" w formularzu „Nowe zadanie" —
      // jedno pobranie, jedno źródło nazw (kolumna i formularz nie mogą się
      // rozjechać).
      setInicjatywy(
        (inicjatywy ?? [])
          .filter((i: any) => i?.id && i?.name)
          .map((i: any) => ({ id: String(i.id), name: String(i.name) }))
      );
      realTaskRows = mapRealTaskRows(zadania, nazwyInicjatyw);
    } catch (error) {
      console.error('[ExecutionWorkSurface] /api/tasks nieosiągalne:', error);
    }
    try {
      const body = (await listExecutionCases()) as any;
      const nextCases =
        (body.cases ?? []).length > 0
          ? body.cases
          : executionLocalReviewEnabled
            ? executionReviewCases
            : [];
      setCases(nextCases);
      // Wachlarz odporny na JEDNĄ wiszącą realizację — patrz executionCaseFanOut.ts.
      // Do 2026-09-05 stało tu `Promise.all`, więc realizacja, której endpoint
      // /work nie odpowiada (zmierzone na stagingu), zamrażała całą zakładkę na
      // „Loading canonical work" z licznikami na zerach.
      const fanOut = await fanOutExecutionCases<Row>(
        nextCases,
        async (executionCase: any, signal) => {
          const reviewWork = getExecutionReviewWork(executionCase.executionCaseId);
          const work = executionReviewCases.some(
            (item) => item.executionCaseId === executionCase.executionCaseId
          )
            ? reviewWork
            : ((await readExecutionWork(executionCase.executionCaseId, signal)) as any);
          return mapRuntimeWorkRows(
            work,
            executionCase.executionCaseId,
            executionCase.initiativeId,
            executionCase.initiativeTitle || executionCase.title || ''
          );
        }
      );
      // Kolejność: realne zadania organizacji NAJPIERW (to jest treść, którą
      // menedżer przyszedł zobaczyć), kanoniczny rejestr realizacji po nich.
      setRows([...realTaskRows, ...fanOut.items]);
      setUnreachableCaseIds(fanOut.failedCaseIds);
      setState('READY');
    } catch {
      if (!executionLocalReviewEnabled) {
        // 1.12-R1 (B): padnięty `runtime-v1` NIE kasuje realnych zadań.
        // Do 06.09 każdy błąd tej gałęzi kończył się ekranem błędu, także
        // wtedy, gdy `/api/tasks` odpowiedziało poprawnie 84 wierszami.
        if (realTaskRows.length > 0) {
          setRows(realTaskRows);
          setUnreachableCaseIds([]);
          setState('READY');
          return;
        }
        setState('ERROR');
        return;
      }
      setCases(executionReviewCases);
      setUnreachableCaseIds([]);
      setRows([
        ...realTaskRows,
        ...executionReviewCases.flatMap((executionCase) =>
          mapRuntimeWorkRows(
            getExecutionReviewWork(executionCase.executionCaseId),
            executionCase.executionCaseId,
            executionCase.initiativeId,
            (executionCase as any).initiativeTitle || (executionCase as any).title || ''
          )
        ),
      ]);
      setState('READY');
    }
  }, []);
  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  // ── Katalog osób do selecta „Osoba" ──────────────────────────────────────
  // Ta sama trasa, z której `useOrganizationMemberNames` bierze nazwiska —
  // tam potrzebny jest resolver `id → nazwa`, tu LISTA do wyboru. Brak listy
  // (403 na katalogu dla zwykłego użytkownika) nie wywraca zakładki: select
  // pokazuje wtedy samo „Nieprzypisany" i bieżącą osobę.
  useEffect(() => {
    if (!currentOrganizationId) return;
    let anulowane = false;
    OrganizationApi.getOrganizationMembers(currentOrganizationId)
      .then((czlonkowie) => {
        if (anulowane) return;
        const lista = (czlonkowie ?? [])
          .map((czlonek) => ({
            id: readMemberId(czlonek as unknown as Record<string, unknown>),
            label: readMemberLabel(czlonek as unknown as Record<string, unknown>) ?? '',
          }))
          .filter((osoba) => osoba.id && osoba.label);
        setOsoby(lista);
      })
      .catch((error) => {
        console.error('[ExecutionWorkSurface] katalog osób nieosiągalny:', error);
        if (!anulowane) setOsoby([]);
      });
    return () => {
      anulowane = true;
    };
  }, [currentOrganizationId]);

  // ── Słownik statusów zadania — Z SERWERA ─────────────────────────────────
  // `GET /api/tasks/workflow-config` zwraca ten sam zbiór, który waliduje
  // `validateTaskStatusTransition` przy zapisie. Kopia w kodzie klienta
  // rozjechałaby się przy pierwszej zmianie reguł, a użytkownik dostałby 400
  // za wybór, który sami mu pokazaliśmy.
  useEffect(() => {
    let anulowane = false;
    Api.get('/tasks/workflow-config')
      .then((odpowiedz: any) => {
        if (anulowane) return;
        // `Api.get` zwraca kopertę „axios-like" — słownik siedzi w `.data`.
        const dane = odpowiedz?.data ?? odpowiedz;
        if (Array.isArray(dane?.statuses) && dane?.transitions) {
          setSlownikStatusow({
            statuses: dane.statuses.map((s: unknown) => String(s)),
            transitions: dane.transitions,
          });
        }
      })
      .catch((error) => {
        console.error('[ExecutionWorkSurface] słownik statusów nieosiągalny:', error);
      });
    return () => {
      anulowane = true;
    };
  }, []);

  /**
   * Komunikat błędu PO POLSKU. Serwer odpowiada po angielsku
   * („Cannot transition from todo to done. Allowed: …"), a właściciel czyta
   * polski ekran. Tłumaczymy to, co umiemy rozpoznać, a resztę DOPISUJEMY
   * (nie chowamy) — cichy błąd jest gorszy niż obcy język.
   */
  const komunikatBledu = useCallback(
    (error: unknown): string => {
      const surowy = error instanceof Error ? error.message : String(error ?? '');
      const przejscie = /Cannot transition from ([a-z_]+) to ([a-z_]+)/i.exec(surowy);
      if (przejscie) {
        return t('execution.work.edit.transitionBlocked', {
          z: etykietaStatusu(przejscie[1], t),
          na: etykietaStatusu(przejscie[2], t),
          defaultValue: 'The status cannot change from "{{z}}" to "{{na}}".',
        }) as unknown as string;
      }
      if (/Blocking decisions/i.test(surowy)) {
        return t('execution.work.edit.blockedByDecision', 'The task can\'t be closed: it is waiting on a decision to be resolved.'
        );
      }
      if (/Blocked reason is required/i.test(surowy)) {
        return t(
          'execution.work.edit.blockedReasonRequired',
          'Status "Blocked" requires a blocking reason.'
        );
      }
      // E3/P2: odmowa usunięcia (`TaskController.deleteTask` → 403) niesie
      // angielskie zdanie serwera; użytkownik ma zobaczyć regułę po swojemu.
      if (/You can only delete tasks you created/i.test(surowy)) {
        return t(
          'execution.work.edit.deleteForbidden',
          'You can only delete tasks that you created yourself.'
        );
      }
      return t('execution.work.edit.failed', {
        powod: surowy || t('execution.work.edit.unknownReason', 'no response from server'),
        defaultValue: 'The change could not be saved: {{powod}}',
      }) as unknown as string;
    },
    [t]
  );

  /**
   * Czy „Zamknij zadanie" wolno w ogóle kliknąć — wg SŁOWNIKA SERWERA.
   * `validateTaskStatusTransition` nie pozwala na `todo → done` (trzeba przejść
   * przez „W toku"/„W przeglądzie"), więc przycisk, który zawsze wygląda na
   * czynny, byłby obietnicą 400-tki. Powód jest widoczny w podglądzie.
   */
  const mozliwoscZamkniecia = useCallback(
    (row: Row): { mozna: boolean; powod: string } => {
      const biezacy = String(row.status ?? '').toLowerCase();
      if (biezacy === 'done')
        return {
          mozna: false,
          powod: t('execution.work.edit.alreadyClosed', 'The task is already closed.'),
        };
      if (!slownikStatusow)
        return {
          mozna: false,
          powod: t('execution.work.edit.dictionaryMissing', 'The status dictionary hasn\'t loaded yet.'
          ),
        };
      if (!(slownikStatusow.transitions?.[biezacy] ?? []).includes('done'))
        return {
          mozna: false,
          powod: t('execution.work.edit.closeBlocked', {
            z: etykietaStatusu(biezacy, t),
            defaultValue:
              'A task in status "{{z}}" cannot be closed — set it to "In progress" or "In review" first.',
          }) as unknown as string,
        };
      return { mozna: true, powod: '' };
    },
    [slownikStatusow, t]
  );

  /**
   * ZAPIS JEDNEGO POLA ZADANIA — `PUT /api/tasks/:id`.
   *
   * POMIAR 07.09 (własne API 4155): `PUT` z ciałem `{status}` / `{assigneeId}`
   * / `{dueDate}` → 200; `PATCH` → 404 (router ma wyłącznie `PUT /:id`).
   * Wysyłamy DOKŁADNIE jedno pole — zapis pełnego obiektu nadpisywałby wartości,
   * których użytkownik nie dotknął (i tak właśnie psuł się serwer przed
   * naprawą `UpdateTaskSchema`, patrz server/src/validators/task.validators.ts).
   *
   * Po sukcesie odświeżamy JEDEN WIERSZ z odpowiedzi serwera (kontroler
   * odpowiada ponownie odczytanym rekordem, snake_case) — bez przeładowania
   * całej listy, żeby nie tracić przewinięcia i zaznaczenia.
   */
  const zapiszPoleZadania = useCallback(
    async (row: TableRow, pole: PoleEdycjiZadania, wartosc: string | null) => {
      const id = String(row.id);
      setBladWiersza(null);
      setZapisywanyWiersz(id);
      // `tasks.due_date` to `timestamp with time zone` — `input[type=date]` daje
      // samo `RRRR-MM-DD`, więc doprowadzamy do ISO w JEDNYM miejscu (edytor
      // w wierszu i edytor w podglądzie wołają tę samą funkcję).
      const doWyslania =
        pole === 'dueDate' && wartosc && /^\d{4}-\d{2}-\d{2}$/.test(wartosc)
          ? new Date(`${wartosc}T00:00:00.000Z`).toISOString()
          : wartosc;
      try {
        const odpowiedz = (await Api.updateTask(id, { [pole]: doWyslania })) as any;
        const potwierdzonyStatus = String(
          odpowiedz?.status ?? (pole === 'status' ? wartosc : row.status)
        ).toUpperCase();
        const potwierdzonyTermin =
          odpowiedz?.due_date ?? odpowiedz?.dueDate ?? (pole === 'dueDate' ? doWyslania : null);
        const potwierdzonaOsoba = String(
          odpowiedz?.assignee_id ??
            odpowiedz?.assigneeId ??
            (pole === 'assigneeId' ? wartosc : '') ??
            ''
        );
        setRows((current) =>
          current.map((wiersz) =>
            wiersz.id === id
              ? {
                  ...wiersz,
                  status: potwierdzonyStatus,
                  owner: pole === 'assigneeId' ? potwierdzonaOsoba : wiersz.owner,
                  rawDueAt: pole === 'dueDate' ? (potwierdzonyTermin ?? null) : wiersz.rawDueAt,
                  dueAt: pole === 'dueDate' ? formatDate(potwierdzonyTermin ?? null) : wiersz.dueAt,
                  slipDays: taskSlipDays({
                    status: potwierdzonyStatus,
                    dueDate:
                      pole === 'dueDate'
                        ? (potwierdzonyTermin ?? undefined)
                        : (wiersz.rawDueAt ?? undefined),
                  }),
                  source: { ...(wiersz.source ?? {}), ...(odpowiedz ?? {}) },
                }
              : wiersz
          )
        );
        toast.success(t('execution.work.edit.saved', 'Task change saved'));
      } catch (error) {
        const komunikat = komunikatBledu(error);
        setBladWiersza({ rowId: id, message: komunikat });
        toast.error(komunikat);
        console.error('[ExecutionWorkSurface] zapis zadania nieudany:', error);
      } finally {
        setZapisywanyWiersz(null);
      }
    },
    [komunikatBledu, t]
  );

  /**
   * Przejścia DOPUSZCZONE PRZEZ SERWER z bieżącego statusu wiersza.
   *
   * Źródłem jest wyłącznie `GET /api/tasks/workflow-config`
   * (`server/src/services/taskWorkflowService.ts` → `ALLOWED_TRANSITIONS`),
   * czyli ten sam słownik, którym `PUT /api/tasks/:id` odrzuca zapis
   * (400 `INVALID_TRANSITION`). Własnej listy nie budujemy: szersza lista =
   * obietnica 400-tki za wybór, który sami pokazaliśmy.
   */
  const dozwolonePrzejscia = useCallback(
    (row: Row): string[] => {
      const biezacy = String(row.status ?? '').toLowerCase();
      return (slownikStatusow?.transitions?.[biezacy] ?? []).filter(
        (docelowy) => docelowy && docelowy !== biezacy
      );
    },
    [slownikStatusow]
  );

  /**
   * USUNIĘCIE ZADANIA — `DELETE /api/tasks/:id`.
   *
   * Trasa istnieje i sprawdza uprawnienie po swojej stronie
   * (`TaskController.deleteTask`: `team_member` usuwa wyłącznie zadanie, które
   * sam zgłosił — inaczej 403). Odmowy NIE połykamy: 403 dojdzie do człowieka
   * przy wierszu, tak samo jak każda inna odmowa zapisu.
   */
  const usunZadanie = useCallback(
    async (row: Row) => {
      const id = String(row.id);
      setUsuwanieWToku(true);
      setBladWiersza(null);
      try {
        await Api.deleteTask(id);
        setRows((current) => current.filter((wiersz) => wiersz.id !== id));
        setSelectedId((biezacy) => (biezacy === id ? null : biezacy));
        setZadanieDoUsuniecia(null);
        toast.success(t('execution.work.edit.deleted', 'Task deleted'));
      } catch (error) {
        const komunikat = komunikatBledu(error);
        setBladWiersza({ rowId: id, message: komunikat });
        toast.error(komunikat);
        console.error('[ExecutionWorkSurface] usunięcie zadania nieudane:', error);
      } finally {
        setUsuwanieWToku(false);
      }
    },
    [komunikatBledu, t]
  );

  const cols = useMemo(
    () =>
      buildCols({
        t,
        resolveMemberName,
        isPolish,
        osoby,
        slownikStatusow,
        // Edytowalny jest WYŁĄCZNIE wiersz z tabeli `tasks`. Rekord kanonicznego
        // rejestru `runtime-v1` ma własny protokół (wersja + `clientRequestId`),
        // więc `PUT /api/tasks/:id` go nie dotyczy.
        edytowalny: (row) => (row as Row).origin === 'tasks',
        zapisz: (row, pole, wartosc) => void zapiszPoleZadania(row, pole, wartosc),
      }),
    [t, resolveMemberName, isPolish, osoby, slownikStatusow, zapiszPoleZadania]
  );

  /**
   * NOWE ZADANIE — `POST /api/tasks` (D5).
   *
   * Do 07.09 przycisk tworzenia pojawiał się WYŁĄCZNIE po wybraniu realizacji
   * `runtime-v1`, a tych na DBR77 jest ZERO — czyli zakładka „Praca" nie miała
   * jak utworzyć zadania w ogóle. Tu tworzymy w tabeli `tasks`, tej samej,
   * z której lista czyta 84 wiersze; inicjatywa jest polem formularza
   * (domyślnie ta z filtra realizacji), a nie warunkiem istnienia przycisku.
   */
  const utworzZadanie = useCallback(async () => {
    const tytul = formularzNowego.title.trim();
    if (!tytul) {
      setFormularzNowego((biezacy) => ({
        ...biezacy,
        blad: t('execution.work.create.titleRequired', 'Enter a task title.'),
      }));
      return;
    }
    setFormularzNowego((biezacy) => ({ ...biezacy, zapisywanie: true, blad: null }));
    try {
      const odpowiedz = (await Api.post('/tasks', {
        title: tytul,
        initiativeId: formularzNowego.initiativeId || null,
        assigneeId: formularzNowego.assigneeId || null,
        dueDate: formularzNowego.dueDate
          ? new Date(`${formularzNowego.dueDate}T00:00:00.000Z`).toISOString()
          : null,
        status: formularzNowego.status || 'todo',
      })) as any;
      const utworzone = odpowiedz?.data ?? odpowiedz;
      const nazwaInicjatywy =
        inicjatywy.find((i) => i.id === formularzNowego.initiativeId)?.name ?? '';
      const [nowyWiersz] = mapRealTaskRows(
        [
          {
            id: utworzone?.id,
            title: utworzone?.title ?? tytul,
            status: utworzone?.status ?? formularzNowego.status,
            assigneeId: utworzone?.assignee_id ?? utworzone?.assigneeId ?? '',
            dueDate: utworzone?.due_date ?? utworzone?.dueDate ?? null,
            initiativeId: utworzone?.initiative_id ?? formularzNowego.initiativeId ?? '',
          },
        ],
        new Map(nazwaInicjatywy ? [[formularzNowego.initiativeId, nazwaInicjatywy]] : [])
      );
      setRows((current) => [nowyWiersz, ...current]);
      setSelectedId(nowyWiersz.id);
      setFormularzNowego({
        otwarty: false,
        title: '',
        initiativeId: '',
        assigneeId: '',
        dueDate: '',
        status: 'todo',
        blad: null,
        zapisywanie: false,
      });
      toast.success(t('execution.work.create.created', 'Task created'));
    } catch (error) {
      const komunikat = komunikatBledu(error);
      setFormularzNowego((biezacy) => ({ ...biezacy, zapisywanie: false, blad: komunikat }));
      toast.error(komunikat);
      console.error('[ExecutionWorkSurface] tworzenie zadania nieudane:', error);
    }
  }, [formularzNowego, inicjatywy, komunikatBledu, t]);
  const load = async (id: string) => {
    setCaseId(id);
    setUnreachableCaseIds([]);
    setState('LOADING');
    try {
      const reviewCase = getExecutionReviewCase(id);
      const [c, w, m] = reviewCase
        ? [reviewCase, getExecutionReviewWork(id), getExecutionReviewMilestones(id)]
        : ((await Promise.all([
            readExecutionCase(id),
            readExecutionWork(id),
            readExecutionMilestones(id),
          ])) as any[]);
      setCaseVersion(c.version);
      setInitiativeId(c.detail.initiativeId);
      setBaselineRef({
        ref: c.detail.handoffPackageId ?? '',
        version: Number(c.detail.handoffPackageVersion ?? 0),
      });
      setMilestones(m.items ?? []);
      setRows(
        mapRuntimeWorkRows(
          w,
          id,
          c.detail.initiativeId,
          cases.find((candidate) => candidate.executionCaseId === id)?.initiativeTitle ?? ''
        )
      );
      setState('READY');
    } catch {
      setState('ERROR');
    }
  };
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const caseLabel = useCallback(
    (id: string) => {
      const executionCase = cases.find((candidate) => candidate.executionCaseId === id);
      return (
        executionCase?.initiativeTitle ||
        executionCase?.title ||
        t('execution.work.linkedCase', 'Linked delivery')
      );
    },
    [cases, t]
  );
  const formFromRow = (row: Row) => {
    const source = row.source ?? {};
    return {
      id: row.id,
      title: source.title ?? row.title ?? '',
      description: source.description ?? '',
      assigneeId: source.assigneeId ?? '',
      ownerId: source.ownerId ?? '',
      authorityId: source.authorityId ?? '',
      dueAt: source.dueAt ?? '',
      slaAt: source.slaAt ?? '',
      evidenceRefs: (source.evidenceRefs ?? []).join('\n'),
      blockers: (source.blockerDecisionIds ?? source.blockers ?? []).join('\n'),
      dependencies: (source.dependencyTaskIds ?? source.dependencies ?? []).join('\n'),
      milestoneIds: (source.milestoneIds ?? []).join('\n'),
      rationale: source.rationale ?? '',
      conditions: (source.conditions ?? []).join('\n'),
    };
  };
  const openWorkspace = async (row: Row) => {
    // 1.12-R1 (B): wiersz z tabeli zastanej NIE MA warsztatu `runtime-v1`
    // (ani wersji, ani realizacji), więc „Otwórz" prowadzi do karty zadania
    // w Mojej Pracy — trasa zmierzona: `getArtifactPath('task', id)` →
    // `/my-work?artifact=task:<id>&code=TASK-…` (src/utils/artifactLinks.ts).
    if (row.origin === 'tasks') {
      navigate(getArtifactPath('task', row.id));
      return;
    }
    if (onOpenDocument && !documentId) {
      onOpenDocument(row);
      return;
    }
    if (caseId !== row.executionCaseId) await load(row.executionCaseId);
    setSelectedId(row.id);
    setShowWorkspace(true);
    setToolMode(row.kind);
    setForm(formFromRow(row));
  };
  useEffect(() => {
    if (!documentId || rows.length === 0) return;
    const row = rows.find((candidate) => candidate.id === documentId);
    if (row && (!showWorkspace || selectedId !== row.id)) void openWorkspace(row);
  }, [documentId, rows, selectedId, showWorkspace]);
  useEffect(() => {
    if (!showWorkspace || !selected) return;
    setToolMode(selected.kind);
    setForm(formFromRow(selected));
  }, [selected?.id, selected?.version, showWorkspace]);
  // 1.12-R1 (B): trzy presety, liczone tą samą regułą co kolumna „Poślizg"
  // (executionRealData) — chip „Po terminie" i czerwona liczba w wierszu nie
  // mogą się rozjechać, bo pochodzą z jednej funkcji.
  const matches = useCallback((row: Row, preset: string) => {
    if (preset === 'all') return true;
    if (preset === 'blocked')
      return isTaskBlocked({ status: row.status }) || (row.source?.blockers?.length ?? 0) > 0;
    if (preset === 'overdue')
      return isTaskOverdue({ status: row.status, dueDate: row.rawDueAt ?? undefined });
    return false;
  }, []);
  // D5: domyślna kolejność listy — zadania BEZ inicjatywy na końcu.
  const visibleRows = useMemo(
    () => sortujBezInicjatywyNaKoniec(rows.filter((row) => matches(row, activePreset ?? 'all'))),
    [activePreset, matches, rows]
  );
  useEffect(
    () => onCountsChange?.(countExecutionPresets(rows, workPresets, matches)),
    [matches, onCountsChange, rows]
  );
  const lines = (v: string) =>
    v
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  const base = (expectedVersion: number, action: string, fingerprint = '') => ({
    expectedVersion,
    expectedCaseVersion: caseVersion,
    clientRequestId: persistentCommandId(
      'execution-work',
      `${caseId}:${caseVersion}:${expectedVersion}:${action}:${fingerprint}`
    ),
  });
  const createTask = async () => {
    const fingerprint = JSON.stringify(form);
    const taskId =
      form.id ||
      `task-${persistentCommandId('execution-work-entity', `${caseId}:task:${fingerprint}`)}`;
    await createExecutionTask(caseId, taskId, {
      ...base(0, 'create-task', fingerprint),
      executionCaseId: caseId,
      initiativeId,
      title: form.title,
      description: form.description,
      assigneeId: form.assigneeId,
      ownerId: form.ownerId,
      dueAt: new Date(form.dueAt).toISOString(),
      slaAt: new Date(form.slaAt).toISOString(),
      evidenceRefs: lines(form.evidenceRefs),
      blockerDecisionIds: lines(form.blockers),
      dependencyTaskIds: lines(form.dependencies),
      milestoneIds: lines(form.milestoneIds),
    });
    await load(caseId);
  };
  const createDecision = async () => {
    const fingerprint = JSON.stringify(form);
    const decisionId =
      form.id ||
      `decision-${persistentCommandId('execution-work-entity', `${caseId}:decision:${fingerprint}`)}`;
    await createExecutionDecision(caseId, decisionId, {
      ...base(0, 'create-decision', fingerprint),
      executionCaseId: caseId,
      initiativeId,
      title: form.title,
      options: [
        { optionId: 'approve', label: 'Approve' },
        { optionId: 'return', label: 'Return' },
      ],
      authorityId: form.authorityId,
      dueAt: new Date(form.dueAt).toISOString(),
    });
    await load(caseId);
  };
  const act = async (action: string) => {
    if (!selected) return;
    if (selected.kind === 'TASK') {
      if (action === 'update')
        await updateExecutionTask(caseId, selected.id, {
          ...base(selected.version, 'update-task', JSON.stringify(form)),
          patch: {
            title: form.title || selected.title,
            evidenceRefs: lines(form.evidenceRefs),
            blockerDecisionIds: lines(form.blockers),
            dependencyTaskIds: lines(form.dependencies),
            milestoneIds: lines(form.milestoneIds),
          },
        });
      else
        await completeExecutionTask(caseId, selected.id, {
          ...base(selected.version, 'complete-task', form.evidenceRefs),
          evidenceRefs: lines(form.evidenceRefs),
        });
    } else {
      if (action === 'request')
        await requestExecutionDecision(caseId, selected.id, {
          ...base(selected.version, 'request-decision'),
        });
      else
        await decideExecutionDecision(caseId, selected.id, {
          ...base(selected.version, `decide:${action}`, JSON.stringify(form)),
          outcome: action,
          rationale: form.rationale,
          conditions: lines(form.conditions),
          followUpTask:
            action === 'CONDITIONALLY_APPROVED'
              ? {
                  taskId: `follow-up:${selected.id}`,
                  title: 'Conditional follow-up',
                  description: form.description,
                  assigneeId: form.assigneeId,
                  ownerId: form.ownerId,
                  dueAt: new Date(form.dueAt).toISOString(),
                  slaAt: new Date(form.slaAt).toISOString(),
                  evidenceRefs: lines(form.evidenceRefs),
                  dependencyTaskIds: [selected.id],
                }
              : null,
        });
    }
    await load(caseId);
  };
  const createMilestone = async () => {
    if (!caseId || !baselineRef.ref || baselineRef.version < 1) return;
    await createExecutionMilestone(caseId, milestoneForm.id, {
      ...base(0, 'create-milestone', JSON.stringify(milestoneForm)),
      executionCaseId: caseId,
      initiativeId,
      baselineRef,
      title: milestoneForm.title,
      ownerId: milestoneForm.ownerId,
      targetAt: milestoneForm.targetAt ? new Date(milestoneForm.targetAt).toISOString() : null,
      forecastAt: milestoneForm.forecastAt
        ? new Date(milestoneForm.forecastAt).toISOString()
        : null,
      evidenceRefs: lines(milestoneForm.evidenceRefs),
      sourceVersions: {
        executionCaseVersion: caseVersion,
        baselineVersion: baselineRef.version,
      },
    });
    await load(caseId);
  };
  // ── MENU 2 · slot filtrów ────────────────────────────────────────────────
  // WYŁĄCZNIE filtr realizacji. Jedna linia, bez `flex-wrap` (kanon §A2).
  // Co STĄD WYSZŁO (uwaga właściciela 08.09.2026 — pasek łamał się na trzy
  // linie: baner · select · przycisk):
  //   · baner „Niepełne dane…"  → nad tabelę, `Banner variant="degraded"`;
  //   · „Nowe zadanie"          → `onRegisterPrimaryCta` (prawy skraj Menu 2);
  //   · „New Decision"          → USUNIĘTY (dublował CTA zakładki
  //                               „Decyzje i ryzyka", która tworzy decyzje
  //                               w tym samym rejestrze — JEDNA AKCJA = JEDEN DOM);
  //   · „New milestone"         → kebab Menu 3 (`onRegisterMenu3Control`),
  //                               ten sam kanał i kebab co w Raportach (P16-R6/D6).
  useEffect(() => {
    if (!onRegisterFilterControl) return;
    if (documentId) {
      onRegisterFilterControl(null);
      return;
    }
    onRegisterFilterControl(
      <div className={MENU_2_FILTERS_ROW}>
        <select
          aria-label="Execution Case for work"
          value={caseId}
          className={MENU_2_FILTER_SELECT}
          onChange={(e) => {
            const nextCaseId = e.target.value;
            if (nextCaseId) void load(nextCaseId);
            else {
              setCaseId('');
              setSelectedId(null);
              setShowWorkspace(false);
              void loadCases();
            }
          }}
        >
          <option value="">{t('execution.filters.allCases', 'All deliveries')}</option>
          {cases.map((c) => (
            <option key={c.executionCaseId} value={c.executionCaseId}>
              {c.initiativeTitle ||
                c.title ||
                `Realizacja · ${String(c.executionCaseId).slice(-8)}`}
            </option>
          ))}
        </select>
      </div>
    );
    return () => onRegisterFilterControl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterFilterControl, documentId, caseId, cases, t]);

  // ── MENU 2 · JEDEN primary CTA ───────────────────────────────────────────
  // „Nowe zadanie" — ZAWSZE widoczne (D5), niezależne od wybranej realizacji.
  useEffect(() => {
    if (!onRegisterPrimaryCta) return;
    if (documentId) {
      onRegisterPrimaryCta(null);
      return;
    }
    onRegisterPrimaryCta({
      label: t('execution.actions.newTask', 'New task'),
      testId: 'execution-work-new-task',
      onClick: () =>
        setFormularzNowego((biezacy) => ({
          ...biezacy,
          otwarty: true,
          blad: null,
          initiativeId: biezacy.initiativeId || initiativeId || '',
        })),
    });
    return () => onRegisterPrimaryCta(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterPrimaryCta, documentId, initiativeId, t]);

  // ── MENU 3 · prawy kebab (rzadkie akcje tworzenia) ───────────────────────
  // Kamień milowy powstaje tylko przy WYBRANEJ realizacji i jest akcją rzadką,
  // więc nie zajmuje slotu primary CTA (kanon: JEDEN CTA na zakładkę).
  useEffect(() => {
    if (!onRegisterMenu3Control) return;
    if (documentId || !caseId) {
      onRegisterMenu3Control(null);
      return;
    }
    onRegisterMenu3Control(
      <RowActionsMenu
        size="md"
        iconVariant="horizontal"
        actions={[
          {
            id: 'execution-work-new-milestone',
            label: t('execution.actions.newMilestone', 'New milestone'),
            onClick: () => setToolMode('MILESTONE'),
          },
        ]}
      />
    );
    return () => onRegisterMenu3Control(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterMenu3Control, documentId, caseId, t]);

  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>{t('execution.work.loadFailed', 'Could not load the canonical work register.')}</p>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => (caseId ? void load(caseId) : void loadCases())}
        >
          {t('common.retry', 'Try again')}
        </button>
      </div>
    );
  const fieldLabels: Record<string, string> = {
    title: t('execution.work.field.title', 'Title'),
    description: t('execution.work.field.description', 'Description and expected outcome'),
    assigneeId: t('execution.work.field.assignee', 'Assignee'),
    ownerId: t('execution.work.field.owner', 'Owner'),
    authorityId: t('execution.work.field.authority', 'Decision maker'),
    dueAt: t('execution.work.field.due', 'Due date'),
    slaAt: t('execution.work.field.sla', 'Response deadline (SLA)'),
    evidenceRefs: t('execution.work.field.evidence', 'Evidence / attachments'),
    blockers: t('execution.work.field.blockers', 'Blocking decisions'),
    dependencies: t('execution.work.field.dependencies', 'Dependencies'),
    milestoneIds: t('execution.work.field.milestones', 'Linked milestones'),
    rationale: t('execution.work.field.rationale', 'Rationale'),
    conditions: t('execution.work.field.conditions', 'Decision conditions'),
  };
  const visibleFields =
    toolMode === 'TASK'
      ? [
          'title',
          'description',
          'assigneeId',
          'ownerId',
          'dueAt',
          'slaAt',
          'evidenceRefs',
          'blockers',
          'dependencies',
          'milestoneIds',
        ]
      : [
          'title',
          'description',
          'authorityId',
          'dueAt',
          'rationale',
          'conditions',
          ...(selected?.kind === 'DECISION' && selected.status === 'PENDING'
            ? (['assigneeId', 'ownerId', 'slaAt', 'evidenceRefs'] as const)
            : []),
        ];
  // Menu 2 (prawa strona) — filtr realizacji + akcje "Nowe…". Patrz komentarz
  // propa `onRegisterFilterControl` powyżej. Rejestruje `null` w widoku
  // dokumentu (documentId) — tam nie ma listy do filtrowania.
  return (
    <section aria-label="Execution Work" className="flex h-full min-h-0 flex-col p-4">
      {/* Cichy pasek informacyjny — JEDNO miejsce na komunikaty o stanie
          danych w tej zakładce, tuż pod Menu 3 i nad tabelą (nigdy w Menu 2). */}
      {degradedBanner}
      {/*
       * Formularz „Nowe zadanie" jako WARSTWA, nie panel nad tabelą — kanon
       * triady: tabela zaczyna się pod Menu 3 i nic jej stamtąd nie spycha.
       */}
      {formularzNowego.otwarty && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('execution.work.create.title', 'New task')}
          data-testid="execution-work-create-dialog"
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4"
          onClick={() => setFormularzNowego((biezacy) => ({ ...biezacy, otwarty: false }))}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-c-border bg-c-surface-raised p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-c-text">
              {t('execution.work.create.title', 'New task')}
            </h3>
            <div className="mt-4 grid gap-3">
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.create.fieldTitle', 'Title')}
                <input
                  autoFocus
                  type="text"
                  aria-label={t('execution.work.create.fieldTitle', 'Title')}
                  value={formularzNowego.title}
                  onChange={(event) =>
                    setFormularzNowego((biezacy) => ({ ...biezacy, title: event.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                />
              </label>
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.columns.initiative', 'Initiative')}
                <select
                  aria-label={t('execution.work.columns.initiative', 'Initiative')}
                  value={formularzNowego.initiativeId}
                  onChange={(event) =>
                    setFormularzNowego((biezacy) => ({
                      ...biezacy,
                      initiativeId: event.target.value,
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <option value="">
                    {t('execution.work.withoutInitiative', 'No initiative')}
                  </option>
                  {inicjatywy.map((inicjatywa) => (
                    <option key={inicjatywa.id} value={inicjatywa.id}>
                      {inicjatywa.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.columns.person', 'Person')}
                <select
                  aria-label={t('execution.work.columns.person', 'Person')}
                  value={formularzNowego.assigneeId}
                  onChange={(event) =>
                    setFormularzNowego((biezacy) => ({
                      ...biezacy,
                      assigneeId: event.target.value,
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <option value="">{t('execution.work.edit.unassigned', 'Unassigned')}</option>
                  {osoby.map((osoba) => (
                    <option key={osoba.id} value={osoba.id}>
                      {osoba.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.columns.due', 'Deadline')}
                <input
                  type="date"
                  aria-label={t('execution.work.columns.due', 'Deadline')}
                  value={formularzNowego.dueDate}
                  onChange={(event) =>
                    setFormularzNowego((biezacy) => ({ ...biezacy, dueDate: event.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                />
              </label>
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.columns.status', 'Status')}
                <select
                  aria-label={t('execution.work.columns.status', 'Status')}
                  value={formularzNowego.status}
                  onChange={(event) =>
                    setFormularzNowego((biezacy) => ({ ...biezacy, status: event.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {(slownikStatusow?.statuses ?? ['todo']).map((wartosc) => (
                    <option key={wartosc} value={wartosc}>
                      {etykietaStatusu(wartosc, t)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {formularzNowego.blad && (
              <p role="alert" className="mt-3 text-xs text-c-danger">
                {formularzNowego.blad}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFormularzNowego((biezacy) => ({ ...biezacy, otwarty: false }))}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                data-testid="execution-work-create-submit"
                disabled={formularzNowego.zapisywanie}
                onClick={() => void utworzZadanie()}
              >
                {t('execution.work.create.submit', 'Create task')}
              </button>
            </div>
          </div>
        </div>
      )}
      {documentId && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              {selected?.title || t('execution.work.item', 'Work item')}
            </h2>
            <p className="text-sm text-c-text-muted">
              {t(
                'execution.work.documentLead',
                'Canonical task or decision document with its controls, evidence and dependencies.'
              )}
            </p>
          </div>
        </div>
      )}
      {state === 'LOADING' && loadingPhase === 'timeout' && (
        <ErrorState
          variant="timeout"
          compact
          onRetry={() => (caseId ? void load(caseId) : void loadCases())}
        />
      )}
      {state === 'LOADING' && (loadingPhase === 'pending' || loadingPhase === 'slow') && (
        <div data-testid="execution-work-loading" className="flex min-h-0 flex-1 flex-col gap-3">
          {loadingPhase === 'slow' && (
            <p role="status" className="text-sm text-c-text-muted">
              {t('common.loadingSlow', 'This is taking longer than usual…')}
            </p>
          )}
          <SkeletonState
            variant="table"
            rows={6}
            label={t('execution.work.loading', 'Loading the canonical work register')}
          />
        </div>
      )}
      {!caseId && state === 'READY' && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-c-border p-8 text-center text-sm text-c-text-muted">
          {t(
            'execution.work.emptyRegister',
            'No canonical tasks or decisions in the available deliveries.'
          )}
        </div>
      )}
      {!documentId && state === 'READY' && rows.length > 0 && (
        /*
         * Lancuch wysokosci - patrz komentarz w ExecutionResourcesSurface.tsx.
         * `TableWithPreviewLayout` ma root `h-full`; `height:100%` rozwiazuje sie
         * tylko wzgledem rodzica o definitywnej wysokosci. Pudelka `p-4`/`mt-4`
         * o wysokosci `auto` przerywaly ten lancuch i panel podgladu konczyl sie
         * na wlasnej tresci. Zmierzone narzedziem
         * `scripts/dev/measure-preview-canon.mjs --wysokosc`.
         */
        <div className="flex min-h-0 flex-1 flex-col">
          <TableWithPreviewLayout<Row>
            selectedId={selectedId}
            selectedItem={selected}
            onSelect={(id) => {
              if (showWorkspace) return;
              setSelectedId(id);
            }}
            onOpenFull={(id) => {
              const row = rows.find((candidate) => candidate.id === id);
              if (row) void openWorkspace(row);
            }}
            itemIds={rows.map((r) => r.id)}
            getItemById={(id) => rows.find((r) => r.id === id) ?? null}
            previewOpen={!showWorkspace && Boolean(selectedId)}
            renderPreview={(r) => (
              <StandardPreview
                embedded
                title={r.title}
                onClose={() => setSelectedId(null)}
                onOpenFull={() => void openWorkspace(r)}
                openLabel={t('execution.work.preview.open', 'Open work item')}
                meta={{
                  pills: [
                    { label: etykietaRodzaju(r.kind, t), tone: 'neutral' },
                    {
                      label: etykietaStatusu(r.status, t),
                      tone: r.status === 'COMPLETED' ? 'success' : 'info',
                    },
                  ],
                  trailing: <span className="text-xs">v{r.version}</span>,
                  recommendation:
                    r.source.nextAction ??
                    t('execution.work.preview.nextStep', 'Check completeness and the next step.'),
                }}
                details={{
                  label: t('execution.work.preview.details', 'Work details'),
                  text:
                    r.source.description ||
                    t('execution.work.preview.noDescription', 'No additional description.'),
                  properties: [
                    {
                      id: 'owner',
                      label: t('execution.work.field.owner', 'Owner'),
                      value: businessLabel(
                        r.owner,
                        t('execution.work.unassigned', 'Unassigned'),
                        t,
                        resolveMemberName,
                        isPolish
                      ),
                    },
                    // 1.12-R1 (B): „Termin / SLA" rozdzielone — SLA było puste
                    // w każdym wierszu realnych danych (tabela `tasks` nie ma
                    // `slaAt`), więc podgląd pisał „· SLA brak" jako fakt.
                    {
                      id: 'due',
                      label: t('execution.work.field.due', 'Due date'),
                      value: r.dueAt || t('execution.work.noDue', 'No due date'),
                    },
                    {
                      id: 'slip',
                      // Ta sama nazwa co kolumna w tabeli — podgląd i wiersz
                      // nie mogą nazywać tej samej liczby dwoma słowami.
                      label: t('execution.work.columns.daysOverdue', 'Days overdue'),
                      value:
                        r.slipDays == null
                          ? '—'
                          : `${r.slipDays} ${
                              isPolish
                                ? liczebnik(r.slipDays, ['dzień', 'dni', 'dni'])
                                : r.slipDays === 1
                                  ? 'day'
                                  : 'days'
                            }`,
                    },
                    {
                      id: 'case',
                      label:
                        r.origin === 'tasks'
                          ? t('execution.work.field.initiative', 'Initiative')
                          : t('execution.work.field.case', 'Delivery'),
                      value:
                        r.origin === 'tasks'
                          ? r.initiativeName ||
                            t('execution.work.noInitiative', 'Without initiative')
                          : caseLabel(r.executionCaseId),
                    },
                    {
                      id: 'evidence',
                      label: t('execution.work.field.evidenceShort', 'Evidence'),
                      value: r.source.evidenceRefs?.length
                        ? `${r.source.evidenceRefs.length} ${
                            isPolish
                              ? liczebnik(r.source.evidenceRefs.length, [
                                  'powiązany dowód',
                                  'powiązane dowody',
                                  'powiązanych dowodów',
                                ])
                              : r.source.evidenceRefs.length === 1
                                ? 'linked evidence item'
                                : 'linked evidence items'
                          }`
                        : t('execution.work.noEvidence', 'No evidence required'),
                    },
                  ],
                  onCopy: () => void navigator.clipboard?.writeText(r.title),
                }}
                relations={
                  r.origin === 'tasks'
                    ? r.initiativeName
                      ? [{ label: r.initiativeName, onClick: () => undefined }]
                      : []
                    : [
                        { label: caseLabel(r.executionCaseId), onClick: () => undefined },
                        {
                          label: t('execution.work.linkedInitiative', 'Linked initiative'),
                          onClick: () => undefined,
                        },
                      ]
                }
                relationsEmptyLabel={t('execution.work.noRelations', 'No relations')}
                /*
                 * D5 — te same trzy akcje co w wierszu, w bloku akcji podglądu.
                 * „Otwórz" ZNIKA z paska: nagłówek podglądu ma już swój
                 * przycisk otwarcia (`onOpenFull`), a kanon podglądu zabrania
                 * dublowania go w stopce.
                 */
                actions={
                  r.origin === 'tasks'
                    ? {
                        informational: [
                          {
                            id: 'change-person',
                            label: t('execution.work.edit.person', 'Change assignee'),
                            variant: 'neutral',
                            icon: UserCog,
                            onClick: () => setEdycjaPodgladu('owner'),
                          },
                          {
                            id: 'change-due',
                            label: t('execution.work.edit.due', 'Change due date'),
                            variant: 'neutral',
                            icon: CalendarClock,
                            onClick: () => setEdycjaPodgladu('due'),
                          },
                          /*
                           * E3/P2 — „Zmień status". Wyłączona, gdy słownik
                           * serwera nie daje z bieżącego statusu ANI JEDNEGO
                           * przejścia: pusta lista do wyboru jest gorsza niż
                           * uczciwie wyłączona akcja z powodem pod spodem.
                           */
                          {
                            id: 'change-status',
                            label: t('execution.work.edit.status', 'Change status'),
                            variant: 'neutral',
                            icon: ListChecks,
                            disabled: dozwolonePrzejscia(r).length === 0,
                            onClick: () => setEdycjaPodgladu('status'),
                          },
                          {
                            id: 'close-task',
                            label: t('execution.work.edit.close', 'Close task'),
                            variant: 'positive',
                            icon: CheckCircle2,
                            disabled: !mozliwoscZamkniecia(r).mozna,
                            onClick: () => void zapiszPoleZadania(r, 'status', 'done'),
                          },
                        ],
                      }
                    : {
                        informational: [
                          {
                            id: 'open',
                            label: t('execution.work.preview.open', 'Open work item'),
                            variant: 'positive',
                            icon: Eye,
                            shortcut: 'O',
                            onClick: () => void openWorkspace(r),
                          },
                        ],
                      }
                }
              >
                {r.origin === 'tasks' && (
                  <div className="mt-3 space-y-2" data-testid="execution-work-preview-edit">
                    {edycjaPodgladu === 'owner' && (
                      <label className="block text-xs text-c-text-secondary">
                        {t('execution.work.edit.person', 'Change assignee')}
                        <select
                          autoFocus
                          aria-label={t('execution.work.edit.person', 'Change assignee')}
                          defaultValue={String(r.owner ?? '')}
                          className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          onChange={(event) => {
                            setEdycjaPodgladu(null);
                            if (event.target.value !== String(r.owner ?? ''))
                              void zapiszPoleZadania(r, 'assigneeId', event.target.value || null);
                          }}
                        >
                          <option value="">
                            {t('execution.work.edit.unassigned', 'Unassigned')}
                          </option>
                          {osoby.map((osoba) => (
                            <option key={osoba.id} value={osoba.id}>
                              {osoba.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {edycjaPodgladu === 'due' && (
                      <label className="block text-xs text-c-text-secondary">
                        {t('execution.work.edit.due', 'Change due date')}
                        <input
                          autoFocus
                          type="date"
                          aria-label={t('execution.work.edit.due', 'Change due date')}
                          defaultValue={naWartoscDaty(r.rawDueAt)}
                          className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          onChange={(event) => {
                            setEdycjaPodgladu(null);
                            if (event.target.value !== naWartoscDaty(r.rawDueAt))
                              void zapiszPoleZadania(r, 'dueDate', event.target.value || null);
                          }}
                        />
                      </label>
                    )}
                    {/*
                     * E3/P2 — edytor statusu w stopce podglądu. Lista zawiera
                     * WYŁĄCZNIE przejścia dopuszczone przez serwer dla statusu
                     * bieżącego (`GET /api/tasks/workflow-config`), plus sam
                     * status bieżący jako wartość wyjściowa selecta.
                     */}
                    {edycjaPodgladu === 'status' && (
                      <label className="block text-xs text-c-text-secondary">
                        {t('execution.work.edit.status', 'Change status')}
                        <select
                          autoFocus
                          aria-label={t('execution.work.edit.status', 'Change status')}
                          data-testid="execution-work-preview-status"
                          defaultValue={String(r.status ?? '').toLowerCase()}
                          className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          onChange={(event) => {
                            setEdycjaPodgladu(null);
                            if (event.target.value !== String(r.status ?? '').toLowerCase())
                              void zapiszPoleZadania(r, 'status', event.target.value);
                          }}
                        >
                          <option value={String(r.status ?? '').toLowerCase()}>
                            {etykietaStatusu(String(r.status ?? ''), t)}
                          </option>
                          {dozwolonePrzejscia(r).map((docelowy) => (
                            <option key={docelowy} value={docelowy}>
                              {etykietaStatusu(docelowy, t)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {!mozliwoscZamkniecia(r).mozna && (
                      <p role="note" className="text-xs text-c-text-muted">
                        {mozliwoscZamkniecia(r).powod}
                      </p>
                    )}
                    {bladWiersza?.rowId === r.id && (
                      <p role="alert" className="text-xs text-c-danger">
                        {bladWiersza.message}
                      </p>
                    )}
                  </div>
                )}
              </StandardPreview>
            )}
          >
            <StandardTable
              columns={cols}
              data={visibleRows}
              selectedRowId={selectedId}
              onRowClick={(r) => {
                if (showWorkspace) return;
                setSelectedId(r.id);
              }}
              onRowDoubleClick={(r) => {
                void openWorkspace(r as Row);
              }}
              rowMenu={(row) => {
                const work = row as Row;
                const openWorkspaceForAction = () => {
                  setSelectedId(work.id);
                  setToolMode(work.kind);
                  void openWorkspace(work);
                };
                /*
                 * WIERSZ Z `/api/tasks`.
                 *
                 * E3/P2 (10.09) — dwie pozycje to było ZA MAŁO. Odbiór W1B
                 * zmierzył, że statusu zadania nie dało się zmienić NIGDZIE:
                 * edytor w komórce wymaga dwukliku, a dwuklik na wierszu
                 * otwiera przestrzeń roboczą, więc jedyna droga była
                 * nieosiągalna. Dokładamy:
                 *   · blok `statusTransitions` — kanoniczne miejsce przejść
                 *     stanu w kebabie (`StandardTable` §blok 2), lista
                 *     WYŁĄCZNIE ze słownika serwera; zapis idzie tą samą
                 *     funkcją co edytor w wierszu i w podglądzie,
                 *   · „Przypisz osobę" — otwiera JEDEN istniejący edytor osoby
                 *     w podglądzie (nie druga implementacja tej samej akcji),
                 *   · „Usuń" — `DELETE /api/tasks/:id` za `ConfirmModal`.
                 *
                 * BEZ „Edytuj": dla zadania z `tasks` byłaby to ta sama akcja
                 * co „Otwórz zadanie", a dwie nazwy jednej akcji uczą
                 * użytkownika nieprawdy. BEZ „Archiwizuj": nota o archiwizacji
                 * należy do rejestru `runtime-v1`, nie do tej tabeli.
                 */
                if (work.origin === 'tasks') {
                  const otworzPodglad = (edytor: 'owner' | 'status' | null) => {
                    setSelectedId(String(row.id));
                    setShowWorkspace(false);
                    setEdycjaPodgladu(edytor);
                  };
                  const przejscia = dozwolonePrzejscia(work);
                  return {
                    primary: [
                      {
                        id: 'open',
                        label: t('execution.work.menu.openTask', 'Open task'),
                        icon: ArrowRight,
                        onClick: openWorkspaceForAction,
                      },
                      {
                        id: 'assign-person',
                        label: t('execution.work.menu.assignPerson', 'Assign person'),
                        icon: UserCog,
                        onClick: () => otworzPodglad('owner'),
                      },
                    ],
                    statusTransitions: przejscia.length
                      ? przejscia.map((docelowy) => ({
                          id: `status-${docelowy}`,
                          label: t('execution.work.menu.setStatus', {
                            status: etykietaStatusu(docelowy, t),
                            defaultValue: 'Set status: {{status}}',
                          }) as unknown as string,
                          icon: ListChecks,
                          onClick: () => void zapiszPoleZadania(work, 'status', docelowy),
                        }))
                      : [
                          {
                            id: 'status-none',
                            label: t('execution.work.edit.status', 'Change status'),
                            icon: ListChecks,
                            disabled: true,
                            note: slownikStatusow
                              ? (t('execution.work.menu.noTransitions', {
                                  z: etykietaStatusu(String(work.status ?? ''), t),
                                  defaultValue:
                                    'Status "{{z}}" has no further transitions available.',
                                }) as unknown as string)
                              : t(
                                  'execution.work.edit.dictionaryMissing',
                                  "The status dictionary hasn't loaded yet."
                                ),
                          },
                        ],
                    universalHandlers: {
                      preview: () => otworzPodglad(null),
                    },
                    destructive: {
                      label: t('common.delete', 'Delete'),
                      onClick: () => setZadanieDoUsuniecia(work),
                    },
                  };
                }
                return {
                  primary: [
                    {
                      id: 'open',
                      label:
                        work.kind === 'TASK'
                          ? t('execution.work.openTask', 'Open task')
                          : t('execution.work.openDecision', 'Open decision'),
                      icon: ArrowRight,
                      onClick: openWorkspaceForAction,
                    },
                    ...(work.kind === 'TASK' && work.status !== 'COMPLETED'
                      ? [
                          {
                            id: 'update-task',
                            label: 'Zaktualizuj zadanie',
                            onClick: openWorkspaceForAction,
                          },
                        ]
                      : []),
                    ...(work.kind === 'DECISION' && work.status === 'DRAFT'
                      ? [
                          {
                            id: 'request-decision',
                            label: t('execution.work.requestDecision', 'Send for decision'),
                            onClick: openWorkspaceForAction,
                          },
                        ]
                      : []),
                    ...(work.kind === 'DECISION' && work.status === 'PENDING'
                      ? [
                          {
                            id: 'decide',
                            label: t('execution.work.resolveDecision', 'Resolve decision'),
                            onClick: openWorkspaceForAction,
                          },
                        ]
                      : []),
                  ],
                  universalHandlers: {
                    preview: () => {
                      setSelectedId(String(row.id));
                      setShowWorkspace(false);
                    },
                    archiveNote: t(
                      'execution.work.archiveNote',
                      'Work items follow the Execution Case retention policy.'
                    ),
                  },
                  destructive: {
                    label: t('common.delete', 'Delete'),
                    note: t(
                      'execution.work.deleteNote',
                      'A canonical work item cannot be deleted.'
                    ),
                  },
                };
              }}
              persistKey="execution.work.canonical-register.v2"
            />
          </TableWithPreviewLayout>
        </div>
      )}
      {showWorkspace && selected && (
        <section
          aria-label="Execution Work item workspace"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selected.title}</h3>
            {!documentId && (
              <button className="btn-secondary" onClick={() => setShowWorkspace(false)}>
                {t('execution.work.closeWorkspace', 'Close workspace')}
              </button>
            )}
          </div>
          <CanonicalWorkHardeningPanel
            item={selected.source}
            actorId={actorId}
            onReadback={(next, version) =>
              setRows((current) =>
                current.map((item) =>
                  item.id === selected.id
                    ? { ...item, status: next.status, version, source: { ...next, version } }
                    : item
                )
              )
            }
          />
          {selected.kind === 'TASK' && <TaskMilestoneBlastRadius task={selected.source} />}
        </section>
      )}
      {!documentId && caseId && (
        <section
          aria-label="Execution Milestones"
          className="mt-4 rounded border border-c-border p-4"
        >
          <h3 className="font-semibold">{t('execution.work.milestones', 'Milestones')}</h3>
          <p className="text-xs text-c-text-muted">
            {t('execution.work.caseVersion', 'Delivery')} v
            {caseVersion || t('common.noData', 'No data')} ·{' '}
            {t('execution.work.baselineVersion', 'accepted baseline')} v
            {baselineRef.version || t('common.noData', 'No data')}
          </p>
          {milestones.length === 0 ? (
            <p role="status" className="mt-2 text-sm text-c-text-muted">
              {t('execution.work.noMilestones', 'No canonical milestones.')}
            </p>
          ) : (
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {milestones.map((m) => (
                <li key={m.milestoneId} className="rounded border border-c-border p-3 text-sm">
                  <strong>{m.title}</strong> · {m.milestoneId} v{m.version}
                  <div>
                    {etykietaStatusu(m.status, t)} ·{' '}
                    {t('execution.work.readiness', 'readiness')}{' '}
                    {etykietaStatusu(m.readiness, t)}
                  </div>
                  <div>
                    {t('execution.work.field.owner', 'Owner')}:{' '}
                    {actorLabel(m.ownerId, t, resolveMemberName, isPolish)}
                  </div>
                  <div>
                    {t('execution.work.field.due', 'Due date')} {formatDateTime(m.targetAt)} ·{' '}
                    {t('execution.work.forecast', 'forecast')} {formatDateTime(m.forecastAt)}
                  </div>
                  <div>
                    {t('execution.work.variance', 'Variance')}{' '}
                    {m.forecastVarianceDays === null
                      ? t('common.noData', 'No data')
                      : `${m.forecastVarianceDays} ${t('execution.work.days', 'days')}`}
                  </div>
                  <div>
                    {t('execution.work.field.evidenceShort', 'Evidence')}:{' '}
                    {m.evidenceRefs.length
                      ? m.evidenceRefs.join(', ')
                      : t('common.noData', 'No data')}
                  </div>
                  <div className="text-xs text-c-text-muted">
                    Case v{m.sourceVersions.executionCaseVersion} · baseline {m.baselineRef.ref} v
                    {m.sourceVersions.baselineVersion}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {toolMode === 'MILESTONE' && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Object.keys(milestoneForm).map((key) => (
                <label key={key} className="text-xs">
                  {key}
                  <input
                    aria-label={`Milestone ${key}`}
                    type={key === 'targetAt' || key === 'forecastAt' ? 'datetime-local' : 'text'}
                    value={milestoneForm[key as keyof typeof milestoneForm]}
                    onChange={(event) =>
                      setMilestoneForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  />
                </label>
              ))}
            </div>
          )}
          {toolMode === 'MILESTONE' && (
            <button
              type="button"
              className="btn-secondary mt-3"
              disabled={!caseId || !baselineRef.ref || baselineRef.version < 1}
              onClick={() => void createMilestone()}
            >
              {t('execution.actions.newMilestone', 'New milestone')}
            </button>
          )}
        </section>
      )}
      {caseId && (toolMode === 'TASK' || toolMode === 'DECISION') && (
        <section
          aria-label="Execution Workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {toolMode === 'TASK'
                  ? t('execution.work.taskEditor', 'Task editor')
                  : t('execution.work.decisionEditor', 'Decision editor')}
              </h3>
              <p className="text-xs text-c-text-muted">
                {t(
                  'execution.work.editorLead',
                  'Fill in the business data; technical identifiers are assigned by the system.'
                )}
              </p>
            </div>
            <button className="btn-secondary" onClick={() => setToolMode('NONE')}>
              {t('common.close', 'Close')}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleFields.map((k) => (
              <label key={k} className="text-xs">
                {fieldLabels[k]}
                <textarea
                  aria-label={`Work ${k}`}
                  value={(form as any)[k]}
                  onChange={(e) => setForm((v) => ({ ...v, [k]: e.target.value }))}
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {toolMode === 'TASK' && (
              <>
                <button className="btn-secondary" onClick={() => void createTask()}>
                  {t('execution.work.create.submit', 'Create task')}
                </button>
                {selected?.kind === 'TASK' && (
                  <>
                    <button className="btn-secondary" onClick={() => void act('update')}>
                      {t('common.saveChanges', 'Save changes')}
                    </button>
                    <button className="btn-secondary" onClick={() => void act('complete')}>
                      {t('execution.work.markDone', 'Mark as done')}
                    </button>
                  </>
                )}
              </>
            )}
            {toolMode === 'DECISION' && (
              <>
                <button className="btn-secondary" onClick={() => void createDecision()}>
                  {t('execution.work.createDecision', 'Create decision')}
                </button>
                {selected?.kind === 'DECISION' && (
                  <>
                    {selected.status === 'DRAFT' && (
                      <button className="btn-secondary" onClick={() => void act('request')}>
                        {t('execution.work.requestDecision', 'Send for decision')}
                      </button>
                    )}
                    {selected.status === 'PENDING' && (
                      <>
                        <button className="btn-secondary" onClick={() => void act('APPROVED')}>
                          APPROVED
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => void act('CONDITIONALLY_APPROVED')}
                        >
                          CONDITIONALLY_APPROVED
                        </button>
                        <button className="btn-secondary" onClick={() => void act('RETURNED')}>
                          RETURNED
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}
      {/*
       * E3/P2 — nazwane potwierdzenie przed nieodwracalnym usunięciem zadania
       * (kanoniczny `ConfirmModal`, wzór `RaidCanvas`), nigdy natychmiastowe
       * usunięcie spod kebaba.
       */}
      <ConfirmModal
        open={zadanieDoUsuniecia != null}
        onClose={() => setZadanieDoUsuniecia(null)}
        onConfirm={() => {
          if (zadanieDoUsuniecia) void usunZadanie(zadanieDoUsuniecia);
        }}
        loading={usuwanieWToku}
        title={t('execution.work.delete.title', 'Delete task')}
        message={
          t('execution.work.delete.message', {
            title: zadanieDoUsuniecia?.title ?? '',
            defaultValue: 'Delete "{{title}}"? This action cannot be undone.',
          }) as unknown as string
        }
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
      />
    </section>
  );
};
