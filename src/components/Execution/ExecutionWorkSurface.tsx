import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Eye, UserCog } from 'lucide-react';
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

import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';
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
const workKindLabel: Record<WorkKind, string> = { TASK: 'Zadanie', DECISION: 'Decyzja' };
const workStatusLabel: Record<string, string> = {
  DRAFT: 'Szkic',
  PENDING: 'Oczekuje na decyzję',
  OPEN: 'Otwarte',
  BLOCKED: 'Zablokowane',
  COMPLETED: 'Wykonane',
  CANCELED: 'Anulowane',
  APPROVED: 'Zatwierdzone',
  CONDITIONALLY_APPROVED: 'Zatwierdzone warunkowo',
  REJECTED: 'Odrzucone',
  RETURNED: 'Zwrócone',
  READY: 'Gotowy',
  AT_RISK: 'Zagrożony',
  ACHIEVED: 'Osiągnięty',
  UNKNOWN: 'Brak danych',
  // Zmierzone na zrzucie PO (05.09, execution-tab-work): realne zadania ze
  // stagingu przychodzą ze statusem IN_PROGRESS, którego ta mapa nie znała —
  // kolumna Status mieszała polskie „Otwarte"/„Oczekuje na decyzję" z surowym
  // IN_PROGRESS w sąsiednich wierszach tej samej tabeli.
  IN_PROGRESS: 'W toku',
  // 1.12-R1 (B), zmierzone na zrzucie /execution?tab=work: realne zadania
  // z `/api/tasks` niosą słownik `TaskStatus` (TODO/IN_PROGRESS/BLOCKED/DONE)
  // plus `REVIEW` — kolumna Status pisała surowe „TODO", „REVIEW", „DONE"
  // obok polskich „W toku"/„Zablokowane" w sąsiednich wierszach.
  TODO: 'Do zrobienia',
  REVIEW: 'W przeglądzie',
  IN_REVIEW: 'W przeglądzie',
  DONE: 'Wykonane',
  CANCELLED: 'Anulowane',
};
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
  const polski = workStatusLabel[String(status ?? '').toUpperCase()] ?? String(status ?? '');
  return t(`execution.work.status.${serwerowy}`, polski);
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
  const podpowiedz = t('execution.work.edit.hint', 'Zmień podwójnym kliknięciem');
  const podpowiedzBrak = t(
    'execution.work.edit.notEditable',
    'Ten wiersz pochodzi z kanonicznego rejestru realizacji — otwórz element pracy, żeby go zmienić.'
  );
  const brakOsoby = t('execution.work.edit.unassigned', 'Nieprzypisany');

  return [
    {
      id: 'title',
      label: t('execution.work.columns.title', 'Zadanie'),
      sortable: true,
      width: '260px',
    },
    {
      id: 'initiativeName',
      label: t('execution.work.columns.initiative', 'Inicjatywa'),
      sortable: true,
      width: '200px',
      // „—" nie mówi, czy danych brakuje, czy zadanie naprawdę nie należy do
      // żadnej inicjatywy. Tu wiadomo, że to drugie (pole jest puste w bazie).
      render: (row) =>
        (row.initiativeName as string) || (
          <span className="text-c-text-muted">
            {t('execution.work.withoutInitiative', 'Bez inicjatywy')}
          </span>
        ),
    },
    {
      id: 'owner',
      label: t('execution.work.columns.person', 'Osoba'),
      sortable: true,
      width: '170px',
      render: (row) => actorLabel(row.owner as string, t, resolveMemberName, isPolish),
      editable: {
        kind: 'select',
        ariaLabel: t('execution.work.edit.person', 'Zmień osobę'),
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
      label: t('execution.work.columns.due', 'Termin'),
      sortable: true,
      width: '150px',
      editable: {
        kind: 'date',
        ariaLabel: t('execution.work.edit.due', 'Zmień termin'),
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
        ariaLabel: t('execution.work.edit.status', 'Zmień status'),
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
      label: t('execution.work.columns.daysOverdue', 'Dni po terminie'),
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
const formatDateTime = (value: string | null | undefined) => {
  // „UNKNOWN" po angielsku na polskim ekranie — widoczne w KAŻDYM wierszu
  // kolumny „Termin / SLA" (zrzut PO 05.09), bo realne zadania stagingu nie
  // niosą `slaAt`.
  if (!value) return 'brak';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'brak';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};
/** Sam termin, bez godziny — kolumna „Termin" ma być czytelna, nie precyzyjna do minuty. */
const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

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
}: ExecutionMenu3Contract & {
  onOpenDocument?: (row: ExecutionWorkDocumentRef) => void;
  documentId?: string | null;
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
  /** Otwarta akcja podglądu (Zmień osobę / Zmień termin) — edytor w podglądzie. */
  const [edycjaPodgladu, setEdycjaPodgladu] = useState<'owner' | 'due' | null>(null);
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
   * Uczciwy stan częściowy — ale NIE między Menu 3 a tabelą.
   *
   * Do 2026-09-05 ten komunikat był akapitem wewnątrz sekcji, tuż nad tabelą,
   * więc rozpychał pion dokładnie tam, gdzie kanon każe zaczynać tabelę
   * (uwaga właściciela z 02.09: „w całej aplikacji mamy standard że tabela
   * zaczyna się pod menu 3", obraz zatwierdzony `UW-06-01` nie ma tam nic).
   * Teraz to PLAKIETKA w Menu 2 (ta sama rejestracja co filtr realizacji),
   * czyli NAD paskiem modułu — informacja zostaje, układ się nie łamie.
   *
   * Pokazuje się WYŁĄCZNIE gdy dane naprawdę są zdegradowane: stan READY i
   * co najmniej jedna realizacja, której nie udało się pobrać.
   */
  const degradedChip = useMemo(() => {
    if (state !== 'READY' || unreachableCaseIds.length === 0) return null;
    const count = unreachableCaseIds.length;
    return (
      <span
        role="status"
        data-testid="execution-work-degraded-chip"
        title={unreachableCaseIds.join(', ')}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 text-xs text-c-text-secondary"
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {t('execution.work.degraded', {
          count,
          unit: isPolish
            ? liczebnik(count, ['realizacja', 'realizacje', 'realizacji'])
            : count === 1
              ? 'delivery'
              : 'deliveries',
          defaultValue: 'Niepełne dane: {{count}} {{unit}} bez odpowiedzi',
        })}
      </span>
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
          defaultValue: 'Nie można zmienić statusu z „{{z}}” na „{{na}}”.',
        }) as unknown as string;
      }
      if (/Blocking decisions/i.test(surowy)) {
        return t(
          'execution.work.edit.blockedByDecision',
          'Zadania nie można zamknąć: czeka na rozstrzygnięcie decyzji.'
        );
      }
      if (/Blocked reason is required/i.test(surowy)) {
        return t(
          'execution.work.edit.blockedReasonRequired',
          'Status „Zablokowane” wymaga podania powodu blokady.'
        );
      }
      return t('execution.work.edit.failed', {
        powod: surowy || t('execution.work.edit.unknownReason', 'brak odpowiedzi serwera'),
        defaultValue: 'Nie udało się zapisać zmiany: {{powod}}',
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
          powod: t('execution.work.edit.alreadyClosed', 'Zadanie jest już zamknięte.'),
        };
      if (!slownikStatusow)
        return {
          mozna: false,
          powod: t(
            'execution.work.edit.dictionaryMissing',
            'Słownik statusów jeszcze się nie wczytał.'
          ),
        };
      if (!(slownikStatusow.transitions?.[biezacy] ?? []).includes('done'))
        return {
          mozna: false,
          powod: t('execution.work.edit.closeBlocked', {
            z: etykietaStatusu(biezacy, t),
            defaultValue:
              'Ze statusu „{{z}}” nie można zamknąć zadania — ustaw najpierw „W toku” albo „W przeglądzie”.',
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
        toast.success(t('execution.work.edit.saved', 'Zapisano zmianę zadania'));
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
        blad: t('execution.work.create.titleRequired', 'Podaj tytuł zadania.'),
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
      toast.success(t('execution.work.create.created', 'Zadanie utworzone'));
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
      return executionCase?.initiativeTitle || executionCase?.title || 'Powiązana realizacja';
    },
    [cases]
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
  useEffect(() => {
    if (!onRegisterFilterControl) return;
    if (documentId) {
      onRegisterFilterControl(null);
      return;
    }
    onRegisterFilterControl(
      <div className="flex flex-wrap items-center gap-2">
        {degradedChip}
        <select
          aria-label="Execution Case for work"
          value={caseId}
          className="h-9 min-w-[200px] rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-sm text-c-text-secondary"
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
        {/*
         * JEDEN „Nowe zadanie" w Menu 2 — ZAWSZE widoczny (D5).
         * Poprzedni przycisk o tej samej nazwie pokazywał się tylko przy
         * wybranej realizacji `runtime-v1` (0 sztuk na DBR77) i pisał do innego
         * rejestru. Dwa przyciski „Nowe zadanie" obok siebie łamałyby doktrynę
         * gęstości (JEDNA AKCJA = JEDEN DOM), więc runtime'owy znika z paska;
         * edytor zadania `runtime-v1` zostaje dostępny z wiersza tego rejestru.
         */}
        <button
          type="button"
          className="btn-secondary"
          data-testid="execution-work-new-task"
          onClick={() =>
            setFormularzNowego((biezacy) => ({
              ...biezacy,
              otwarty: true,
              blad: null,
              initiativeId: biezacy.initiativeId || initiativeId || '',
            }))
          }
        >
          {t('execution.actions.newTask', 'Nowe zadanie')}
        </button>
        {caseId && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => setToolMode('DECISION')}>
              {t('execution.actions.newDecision', 'New Decision')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setToolMode('MILESTONE')}
            >
              {t('execution.actions.newMilestone', 'New milestone')}
            </button>
          </div>
        )}
      </div>
    );
    return () => onRegisterFilterControl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterFilterControl, documentId, caseId, cases, degradedChip, initiativeId, t]);

  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>Nie udało się załadować kanonicznego rejestru pracy.</p>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => (caseId ? void load(caseId) : void loadCases())}
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  const fieldLabels: Record<string, string> = {
    title: 'Tytuł',
    description: 'Opis i oczekiwany rezultat',
    assigneeId: 'Osoba realizująca',
    ownerId: 'Właściciel',
    authorityId: 'Osoba decyzyjna',
    dueAt: 'Termin',
    slaAt: 'Termin reakcji (SLA)',
    evidenceRefs: 'Dowody / załączniki',
    blockers: 'Blokujące decyzje',
    dependencies: 'Zależności',
    milestoneIds: 'Powiązane kamienie milowe',
    rationale: 'Uzasadnienie',
    conditions: 'Warunki decyzji',
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
      {/*
       * Formularz „Nowe zadanie" jako WARSTWA, nie panel nad tabelą — kanon
       * triady: tabela zaczyna się pod Menu 3 i nic jej stamtąd nie spycha.
       */}
      {formularzNowego.otwarty && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('execution.work.create.title', 'Nowe zadanie')}
          data-testid="execution-work-create-dialog"
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4"
          onClick={() => setFormularzNowego((biezacy) => ({ ...biezacy, otwarty: false }))}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-c-border bg-c-surface-raised p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-c-text">
              {t('execution.work.create.title', 'Nowe zadanie')}
            </h3>
            <div className="mt-4 grid gap-3">
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.create.fieldTitle', 'Tytuł')}
                <input
                  autoFocus
                  type="text"
                  aria-label={t('execution.work.create.fieldTitle', 'Tytuł')}
                  value={formularzNowego.title}
                  onChange={(event) =>
                    setFormularzNowego((biezacy) => ({ ...biezacy, title: event.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                />
              </label>
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.columns.initiative', 'Inicjatywa')}
                <select
                  aria-label={t('execution.work.columns.initiative', 'Inicjatywa')}
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
                    {t('execution.work.withoutInitiative', 'Bez inicjatywy')}
                  </option>
                  {inicjatywy.map((inicjatywa) => (
                    <option key={inicjatywa.id} value={inicjatywa.id}>
                      {inicjatywa.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.columns.person', 'Osoba')}
                <select
                  aria-label={t('execution.work.columns.person', 'Osoba')}
                  value={formularzNowego.assigneeId}
                  onChange={(event) =>
                    setFormularzNowego((biezacy) => ({
                      ...biezacy,
                      assigneeId: event.target.value,
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <option value="">{t('execution.work.edit.unassigned', 'Nieprzypisany')}</option>
                  {osoby.map((osoba) => (
                    <option key={osoba.id} value={osoba.id}>
                      {osoba.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-c-text-secondary">
                {t('execution.work.columns.due', 'Termin')}
                <input
                  type="date"
                  aria-label={t('execution.work.columns.due', 'Termin')}
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
                {t('common.cancel', 'Anuluj')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                data-testid="execution-work-create-submit"
                disabled={formularzNowego.zapisywanie}
                onClick={() => void utworzZadanie()}
              >
                {t('execution.work.create.submit', 'Utwórz zadanie')}
              </button>
            </div>
          </div>
        </div>
      )}
      {documentId && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">{selected?.title || 'Element pracy'}</h2>
            <p className="text-sm text-c-text-muted">
              Kanoniczny dokument zadania lub decyzji wraz z kontrolami, dowodami i zależnościami.
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
              Wczytywanie trwa dłużej niż zwykle…
            </p>
          )}
          <SkeletonState variant="table" rows={6} label="Wczytuję kanoniczny rejestr pracy" />
        </div>
      )}
      {!caseId && state === 'READY' && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-c-border p-8 text-center text-sm text-c-text-muted">
          Brak kanonicznych zadań i decyzji w dostępnych realizacjach.
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
                openLabel="Otwórz element pracy"
                meta={{
                  pills: [
                    { label: workKindLabel[r.kind], tone: 'neutral' },
                    {
                      label: workStatusLabel[r.status] ?? r.status,
                      tone: r.status === 'COMPLETED' ? 'success' : 'info',
                    },
                  ],
                  trailing: <span className="text-xs">v{r.version}</span>,
                  recommendation: r.source.nextAction ?? 'Sprawdź kompletność i następny krok.',
                }}
                details={{
                  label: 'Szczegóły pracy',
                  text: r.source.description || 'Brak dodatkowego opisu.',
                  properties: [
                    {
                      id: 'owner',
                      label: 'Odpowiedzialny',
                      value: businessLabel(
                        r.owner,
                        'Nieprzypisany',
                        t,
                        resolveMemberName,
                        isPolish
                      ),
                    },
                    // 1.12-R1 (B): „Termin / SLA" rozdzielone — SLA było puste
                    // w każdym wierszu realnych danych (tabela `tasks` nie ma
                    // `slaAt`), więc podgląd pisał „· SLA brak" jako fakt.
                    { id: 'due', label: 'Termin', value: r.dueAt || 'Brak terminu' },
                    {
                      id: 'slip',
                      // Ta sama nazwa co kolumna w tabeli — podgląd i wiersz
                      // nie mogą nazywać tej samej liczby dwoma słowami.
                      label: t('execution.work.columns.daysOverdue', 'Dni po terminie'),
                      value:
                        r.slipDays == null
                          ? '—'
                          : `${r.slipDays} ${liczebnik(r.slipDays, ['dzień', 'dni', 'dni'])}`,
                    },
                    {
                      id: 'case',
                      label: r.origin === 'tasks' ? 'Inicjatywa' : 'Realizacja',
                      value:
                        r.origin === 'tasks'
                          ? r.initiativeName || 'Bez inicjatywy'
                          : caseLabel(r.executionCaseId),
                    },
                    {
                      id: 'evidence',
                      label: 'Dowody',
                      value: r.source.evidenceRefs?.length
                        ? `${r.source.evidenceRefs.length} ${liczebnik(
                            r.source.evidenceRefs.length,
                            ['powiązany dowód', 'powiązane dowody', 'powiązanych dowodów']
                          )}`
                        : 'Brak wymaganych dowodów',
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
                        { label: 'Powiązana inicjatywa', onClick: () => undefined },
                      ]
                }
                relationsEmptyLabel="Brak powiązań"
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
                            label: t('execution.work.edit.person', 'Zmień osobę'),
                            variant: 'neutral',
                            icon: UserCog,
                            onClick: () => setEdycjaPodgladu('owner'),
                          },
                          {
                            id: 'change-due',
                            label: t('execution.work.edit.due', 'Zmień termin'),
                            variant: 'neutral',
                            icon: CalendarClock,
                            onClick: () => setEdycjaPodgladu('due'),
                          },
                          {
                            id: 'close-task',
                            label: t('execution.work.edit.close', 'Zamknij zadanie'),
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
                            label: 'Otwórz element pracy',
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
                        {t('execution.work.edit.person', 'Zmień osobę')}
                        <select
                          autoFocus
                          aria-label={t('execution.work.edit.person', 'Zmień osobę')}
                          defaultValue={String(r.owner ?? '')}
                          className="mt-1 h-9 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          onChange={(event) => {
                            setEdycjaPodgladu(null);
                            if (event.target.value !== String(r.owner ?? ''))
                              void zapiszPoleZadania(r, 'assigneeId', event.target.value || null);
                          }}
                        >
                          <option value="">
                            {t('execution.work.edit.unassigned', 'Nieprzypisany')}
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
                        {t('execution.work.edit.due', 'Zmień termin')}
                        <input
                          autoFocus
                          type="date"
                          aria-label={t('execution.work.edit.due', 'Zmień termin')}
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
                 * WIERSZ Z `/api/tasks` — kebab ma DWIE pozycje: Otwórz i
                 * Otwórz podgląd. Zmiana osoby/terminu/statusu żyje w wierszu
                 * (podwójny klik) i w podglądzie; powtórzenie jej tutaj byłoby
                 * tą samą akcją w trzech domach (doktryna gęstości §1).
                 * Świadomie BEZ „Archiwizuj"/„Usuń": to jest słownik rejestru
                 * `runtime-v1` („Kanoniczny element pracy nie może zostać
                 * usunięty"), a zadanie z tabeli `tasks` nie ma z nim nic
                 * wspólnego — atrapa z obcą notą jest gorsza niż brak pozycji.
                 */
                if (work.origin === 'tasks') {
                  return {
                    primary: [
                      {
                        id: 'open',
                        label: t('execution.work.menu.openTask', 'Otwórz zadanie'),
                        icon: ArrowRight,
                        onClick: openWorkspaceForAction,
                      },
                    ],
                    universalHandlers: {
                      preview: () => {
                        setSelectedId(String(row.id));
                        setShowWorkspace(false);
                        setEdycjaPodgladu(null);
                      },
                    },
                  };
                }
                return {
                  primary: [
                    {
                      id: 'open',
                      label: work.kind === 'TASK' ? 'Otwórz zadanie' : 'Otwórz decyzję',
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
                            label: 'Przekaż do decyzji',
                            onClick: openWorkspaceForAction,
                          },
                        ]
                      : []),
                    ...(work.kind === 'DECISION' && work.status === 'PENDING'
                      ? [
                          {
                            id: 'decide',
                            label: 'Rozstrzygnij decyzję',
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
                    archiveNote: 'Elementy pracy podlegają retencji Execution Case.',
                  },
                  destructive: {
                    label: 'Usuń',
                    note: 'Kanoniczny element pracy nie może zostać usunięty.',
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
                Zamknij workspace
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
          <h3 className="font-semibold">Kamienie milowe</h3>
          <p className="text-xs text-c-text-muted">
            Realizacja v{caseVersion || 'Brak danych'} · zaakceptowana wersja bazowa v
            {baselineRef.version || 'Brak danych'}
          </p>
          {milestones.length === 0 ? (
            <p role="status" className="mt-2 text-sm text-c-text-muted">
              Brak kanonicznych kamieni milowych.
            </p>
          ) : (
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {milestones.map((m) => (
                <li key={m.milestoneId} className="rounded border border-c-border p-3 text-sm">
                  <strong>{m.title}</strong> · {m.milestoneId} v{m.version}
                  <div>
                    {workStatusLabel[m.status] ?? m.status} · gotowość{' '}
                    {workStatusLabel[m.readiness] ?? m.readiness}
                  </div>
                  <div>Właściciel: {actorLabel(m.ownerId, t, resolveMemberName, isPolish)}</div>
                  <div>
                    Termin {formatDateTime(m.targetAt)} · prognoza {formatDateTime(m.forecastAt)}
                  </div>
                  <div>
                    Odchylenie{' '}
                    {m.forecastVarianceDays === null
                      ? 'Brak danych'
                      : `${m.forecastVarianceDays} dni`}
                  </div>
                  <div>
                    Dowody: {m.evidenceRefs.length ? m.evidenceRefs.join(', ') : 'Brak danych'}
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
              Utwórz kamień milowy
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
                {toolMode === 'TASK' ? 'Edytor zadania' : 'Edytor decyzji'}
              </h3>
              <p className="text-xs text-c-text-muted">
                Uzupełnij dane biznesowe; identyfikatory techniczne są nadawane przez system.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => setToolMode('NONE')}>
              Zamknij
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
                  Utwórz zadanie
                </button>
                {selected?.kind === 'TASK' && (
                  <>
                    <button className="btn-secondary" onClick={() => void act('update')}>
                      Zapisz zmiany
                    </button>
                    <button className="btn-secondary" onClick={() => void act('complete')}>
                      Oznacz jako wykonane
                    </button>
                  </>
                )}
              </>
            )}
            {toolMode === 'DECISION' && (
              <>
                <button className="btn-secondary" onClick={() => void createDecision()}>
                  Utwórz decyzję
                </button>
                {selected?.kind === 'DECISION' && (
                  <>
                    {selected.status === 'DRAFT' && (
                      <button className="btn-secondary" onClick={() => void act('request')}>
                        Przekaż do decyzji
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
    </section>
  );
};
