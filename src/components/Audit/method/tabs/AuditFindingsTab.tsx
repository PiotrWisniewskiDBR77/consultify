/**
 * AuditFindingsTab — U4 „Ustalenia": rejestr niezgodności i CAPA (Corrective
 * and Preventive Actions) na poziomie programu audytowego.
 *
 * NAPRAWA 1 (panel ekspercki 2026-08-26, moduł Audyty 6,0/10): audytor wiodący
 * nie miał ŻADNEGO ekranu pokazującego „wszystkie otwarte niezgodności" —
 * `AuditsMethodHub` miał pięć zakładek (Library/Processes/Outputs/Reports/
 * Initiatives) i żadnej z ustaleniami, mimo że backend jest kompletny i
 * gotowy od dawna. Zakładka woła DOKŁADNIE te endpointy (żadnego innego):
 *   - `GET /audits/findings` (`findings.routes.ts:58`, `findingService.listFindings`,
 *     paginowane — `limit`/`offset` przekazywane z tego ekranu, patrz R2 niżej)
 *   - `POST /audits/findings/:id/review` (confirm/send_back/reject)
 *   - `POST /audits/findings/:id/accept-risk` (`findingService.acceptResidualRisk`)
 *   - `POST /audits/findings/:id/close` (`findingService.closeFinding`)
 *   - `GET /audits/actions` (`actions.routes.ts:95`, kolumna „Termin" — data z
 *     najbliższego OTWARTEGO działania korygującego danego ustalenia; ustalenie
 *     samo nie niesie terminu, to działanie ma `dueDate`; pobierane W CAŁOŚCI
 *     dla programu przez `listAllActions()`, patrz R2(a) niżej)
 *   - `GET /audits/evidence` (`evidence.routes.ts:84`, rozwiązywanie ID dowodów
 *     w `objectiveEvidence`/`contradictingEvidence` na tytuły w podglądzie —
 *     zero surowych ID na twarzy)
 *
 * `GET /audits/findings*` WYMAGA `programId` (backend `requireProgramId`) —
 * nie istnieje globalny rejestr „wszystkie ustalenia wszystkich programów"
 * (w przeciwieństwie do Reports/Outputs/Initiatives, gdzie `programId` jest
 * opcjonalny). Dlatego ta zakładka niesie WŁASNY selektor programu zamiast
 * dzielić search-box Huba (który i tak zasila tylko `listPacks`/`listPrograms`,
 * żadna z pozostałych czterech zakładek go nie używa).
 *
 * Kanon: `StandardModuleBar`-owy pasek NIE jest tu duplikowany (Hub go już
 * renderuje) — ekran wewnątrz zakładki to WYŁĄCZNIE `StandardTable` +
 * `StandardPreview` (CLAUDE.md #9 — zakaz własnych tabel). Filtry: status i
 * klasyfikacja jako kolumny `filterable` (dokładnie wzorzec `AuditReportsTab`'s
 * `status`, i wzorzec Library's `sourceType` — druga oś danych bez drugiego
 * toru chipów) — DZIAŁAJĄ na bieżącej stronie (patrz nota przy `columns`
 * niżej: podniesienie ich do zapytania serwera to osobny pakiet pracy, `GET
 * /audits/findings` już przyjmuje `status`/`classification`, gdyby był potrzebny).
 *
 * ODEBRANE 2026-08-26 (uwaga właściciela na zrzucie tej zakładki): pasek nad
 * tabelą niósł WYŁĄCZNIE selektor programu (konieczność techniczna — patrz
 * wyżej), a nie miał obok siebie doklejonych statystyk „Razem N ustaleń…”
 * (`GET /audits/findings/statistics`) ani pigułki „N możliwych tematów
 * systemowych” (`GET /audits/findings/systemic`) — to wniosek analityczny,
 * nie filtr listy, i właściciel nie widział powodu, żeby żył tutaj. Nadzorca
 * zdecydował: usunąć z tego paska, docelowo pokazać w zakładce Wyniki
 * (`AuditOutputsTab.tsx`) — NIE przeniesiono jeszcze, bo `AuditOutputsTab` nie
 * ma dziś ani selektora programu (jego `listOutputs()` jest globalne, nie
 * `programId`-scoped, w przeciwieństwie do tych dwóch statystycznych
 * endpointów), ani żadnej sekcji kafli/kart metryk do którego można by to
 * doczepić bez wymyślania nowego układu — to osobny pakiet pracy po
 * prototypie, nie ten merge. `getFindingStatistics`/`getSystemicFindings`
 * zostały odtąd USUNIĘTE z `auditsMethodApi.ts` (martwy kod, R3(a) panelu
 * powtórnego) — zero wołających po tym odjęciu.
 *
 * R2(a) (panel powtórny DEC-117): `GET /audits/findings` domyślnie ucina do
 * 50 wierszy (`context.ts parsePaging`) — ta zakładka ładowała TYLKO pierwszą
 * stronę i NIGDY nie pokazywała `total`, więc program z 51+ ustaleniami cicho
 * gubił resztę bez śladu. Naprawione: `limit`/`offset` jawnie z paginatora
 * niżej, licznik „N z M" zawsze widoczny, Poprzednia/Następna disabled na
 * granicach.
 */
import { CheckCircle2, ExternalLink, Lock, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState, ErrorState } from '@/components/shared/states';
import {
  StandardPreview,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { StatusChip } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

import {
  acceptResidualRisk,
  AUDIT_FINDING_STATUSES,
  type AuditActionStatus,
  type AuditActionSummary,
  type AuditCriterionSummary,
  type AuditEvidenceSummary,
  type AuditFindingSummary,
  type AuditProgramSummary,
  closeFinding,
  listAllActions,
  listEvidence,
  listFindings,
  listProgramCriteria,
  reviewFinding,
} from '../auditsMethodApi';
import {
  findingClassificationLabel,
  findingClassificationTone,
  findingSeverityLabel,
  findingSeverityTone,
  findingStatusLabel,
  findingStatusTone,
} from '../auditStatusTones';
import { NoteEntryModal } from '../NoteEntryModal';

/** Rozmiar strony rejestru — dopasowany do domyślnego `limit` backendu (`context.ts parsePaging`). */
const PAGE_SIZE = 50;

export interface AuditFindingsTabProps {
  isPolish: boolean;
  /** Lista programów (Hub już ją wczytał dla Processes) — zasila selektor programu. */
  programs: AuditProgramSummary[];
  userNameById?: Map<string, string>;
}

const EMPTY_MAP = new Map<string, string>();

/** Statusy działania korygującego, które NIE liczą się jako „otwarte" dla kolumny „Termin". */
const ACTION_CLOSED_STATUSES = new Set<AuditActionStatus>([
  'implemented',
  'verified',
  'rejected',
  'cancelled',
]);

/** Statusy ustalenia, po których dalsze przejścia stanu z tego rejestru nie mają sensu. */
const FINDING_TERMINAL_STATUSES = new Set(['closed', 'risk_accepted', 'rejected']);

function permissionAwareMessage(e: any, isPolish: boolean, fallback: string): string {
  if (e?.status === 403) {
    return isPolish
      ? 'Brak uprawnień do tej czynności w tym programie audytowym.'
      : 'You do not have permission for this action in this audit program.';
  }
  return e?.message || fallback;
}

export const AuditFindingsTab: React.FC<AuditFindingsTabProps> = ({
  isPolish,
  programs,
  userNameById = EMPTY_MAP,
}) => {
  const navigate = useNavigate();

  const [programId, setProgramId] = useState<string>(() => programs[0]?.id ?? '');
  useEffect(() => {
    if (!programId && programs.length > 0) setProgramId(programs[0].id);
  }, [programs, programId]);

  const [items, setItems] = useState<AuditFindingSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<AuditCriterionSummary[]>([]);
  const [actions, setActions] = useState<AuditActionSummary[]>([]);
  const [evidence, setEvidence] = useState<AuditEvidenceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  /** R3(c): kanoniczny modal zastępujący `window.prompt` dla notatek zamknięcia/akceptacji ryzyka. */
  const [noteModal, setNoteModal] = useState<{
    kind: 'accept-risk' | 'close';
    findingId: string;
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Dane programu poza rejestrem ustaleń (kryteria/działania/dowody) — niezależne od strony, ładowane tylko przy zmianie programu. */
  const loadProgramData = useCallback(() => {
    if (!programId) {
      setCriteria([]);
      setActions([]);
      setEvidence([]);
      return;
    }
    Promise.all([
      listProgramCriteria(programId),
      listAllActions(programId),
      listEvidence(programId),
    ])
      .then(([criteriaResult, actionsResult, evidenceResult]) => {
        setCriteria(criteriaResult);
        setActions(actionsResult);
        setEvidence(evidenceResult);
      })
      .catch((e: any) =>
        setError(
          permissionAwareMessage(
            e,
            isPolish,
            isPolish ? 'Nie udało się wczytać ustaleń' : 'Failed to load findings'
          )
        )
      );
  }, [programId, isPolish]);

  /** Sama strona rejestru ustaleń — jedyna część zależna od paginatora. */
  const loadFindings = useCallback(() => {
    if (!programId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    listFindings({ programId, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((e: any) =>
        setError(
          permissionAwareMessage(
            e,
            isPolish,
            isPolish ? 'Nie udało się wczytać ustaleń' : 'Failed to load findings'
          )
        )
      )
      .finally(() => setLoading(false));
  }, [programId, page, isPolish]);

  /** Pełny odśwież (program + strona) — po przejściu stanu, kiedy odpowiedź serwera nie zwróciła zaktualizowanego wiersza. */
  const load = useCallback(() => {
    loadProgramData();
    loadFindings();
  }, [loadProgramData, loadFindings]);

  useEffect(() => {
    loadProgramData();
  }, [loadProgramData]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  // Program ze strony >1 nie ma tylu ustaleń po przełączeniu (lub po
  // przejściu stanu, które nie zmieniło liczności) — cofnij na ostatnią
  // istniejącą stronę zamiast pokazywać pustą tabelę z paginatorem
  // wskazującym stronę, która już nie istnieje.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const criterionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (list: AuditCriterionSummary[]) => {
      for (const c of list) {
        map.set(c.id, c.refCode ? `${c.refCode} — ${c.title}` : c.title);
        if (c.children?.length) walk(c.children);
      }
    };
    walk(criteria);
    return map;
  }, [criteria]);

  const evidenceTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of evidence) map.set(e.id, e.title);
    return map;
  }, [evidence]);

  /** Najbliższy termin OTWARTEGO działania korygującego danego ustalenia — ustalenie samo nie niesie terminu. */
  const nextDueDateByFindingId = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of actions) {
      if (!a.dueDate || ACTION_CLOSED_STATUSES.has(a.status)) continue;
      const current = map.get(a.findingId);
      if (!current || a.dueDate < current) map.set(a.findingId, a.dueDate);
    }
    return map;
  }, [actions]);

  const openActionsCountByFindingId = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actions) {
      if (ACTION_CLOSED_STATUSES.has(a.status)) continue;
      map.set(a.findingId, (map.get(a.findingId) ?? 0) + 1);
    }
    return map;
  }, [actions]);

  const classificationOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const f of items) {
      if (seen.has(f.classification)) continue;
      seen.add(f.classification);
      options.push({
        value: f.classification,
        label: findingClassificationLabel(f.classification, isPolish),
      });
    }
    return options;
  }, [items, isPolish]);

  const runTransition = useCallback(
    async (id: string, run: () => Promise<AuditFindingSummary | null>, key: string) => {
      setTransitioning(key);
      setTransitionError(null);
      try {
        const updated = await run();
        if (updated) {
          setItems((prev) => prev.map((f) => (f.id === id ? updated : f)));
        } else {
          load();
        }
      } catch (e: any) {
        setTransitionError(
          permissionAwareMessage(
            e,
            isPolish,
            isPolish
              ? 'Nie udało się zmienić statusu ustalenia'
              : 'Failed to change the finding status'
          )
        );
      } finally {
        setTransitioning(null);
      }
    },
    [isPolish, load]
  );

  const columns: TableColumn[] = [
    {
      id: 'referenceCode',
      label: isPolish ? 'Numer ustalenia' : 'Finding no.',
      width: '120px',
      render: (row: AuditFindingSummary) => (
        <span className="text-xs font-mono text-c-text-secondary">
          {row.referenceCode || row.id}
        </span>
      ),
    },
    {
      id: 'statement',
      label: isPolish ? 'Treść' : 'Statement',
      render: (row: AuditFindingSummary) => (
        <span className="text-sm text-c-text line-clamp-2">{row.statement}</span>
      ),
    },
    {
      id: 'classification',
      label: isPolish ? 'Klasyfikacja' : 'Classification',
      width: '160px',
      filterable: true,
      filterOptions: classificationOptions,
      render: (row: AuditFindingSummary) => (
        <StatusChip
          label={findingClassificationLabel(row.classification, isPolish)}
          tone={findingClassificationTone(row.classification)}
        />
      ),
    },
    {
      id: 'criterionId',
      label: isPolish ? 'Kryterium / proces' : 'Criterion / process',
      width: '200px',
      render: (row: AuditFindingSummary) => (
        <span className="text-xs text-c-text-secondary truncate block max-w-[190px]">
          {(row.criterionId && criterionTitleById.get(row.criterionId)) ||
            (isPolish ? 'Bez przypisanego kryterium' : 'No criterion assigned')}
        </span>
      ),
    },
    {
      id: 'ownerUserId',
      label: isPolish ? 'Właściciel' : 'Owner',
      width: '150px',
      render: (row: AuditFindingSummary) => (
        <span className="text-xs text-c-text-secondary">
          {(row.ownerUserId && userNameById.get(row.ownerUserId)) ||
            (isPolish ? 'Nieprzypisany' : 'Unassigned')}
        </span>
      ),
    },
    {
      id: 'dueDate',
      label: isPolish ? 'Termin' : 'Due date',
      width: '130px',
      sortable: true,
      sortAccessor: (row: AuditFindingSummary) => nextDueDateByFindingId.get(row.id) ?? '',
      render: (row: AuditFindingSummary) => {
        const due = nextDueDateByFindingId.get(row.id);
        return (
          <span className="text-xs text-c-text-secondary tabular-nums">
            {due ? formatListDate(due) : '—'}
          </span>
        );
      },
    },
    {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
      width: '170px',
      filterable: true,
      filterOptions: AUDIT_FINDING_STATUSES.map((value) => ({
        value,
        label: findingStatusLabel(value, isPolish),
      })),
      render: (row: AuditFindingSummary) => (
        <StatusChip
          label={findingStatusLabel(row.status, isPolish)}
          tone={findingStatusTone(row.status)}
        />
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Ostatnia zmiana' : 'Last updated',
      width: '150px',
      sortable: true,
      render: (row: AuditFindingSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {formatListDate(row.updatedAt)}
        </span>
      ),
    },
  ];

  const rowMenu = (rawRow: TableRow): StandardRowMenu => {
    const row = rawRow as unknown as AuditFindingSummary;
    const isTerminal = FINDING_TERMINAL_STATUSES.has(row.status);
    const canConfirm = row.status === 'draft' || row.status === 'in_review';
    const canClose = !isTerminal;
    const canAcceptRisk = !isTerminal;

    return {
      primary: [
        {
          id: 'open-workspace',
          label: isPolish ? 'Otwórz w warsztacie kryterium' : 'Open in criterion workspace',
          icon: ExternalLink,
          onClick: row.criterionId
            ? () => navigate(`/audit-programs/method/${row.programId}/criteria/${row.criterionId}`)
            : undefined,
          disabled: !row.criterionId,
          note: row.criterionId
            ? undefined
            : isPolish
              ? 'Ustalenie nie ma przypisanego kryterium.'
              : 'The finding has no assigned criterion.',
        },
      ],
      statusTransitions: [
        {
          id: 'confirm',
          label: isPolish ? 'Potwierdź' : 'Confirm',
          icon: CheckCircle2,
          onClick: canConfirm
            ? () =>
                void runTransition(
                  row.id,
                  () => reviewFinding(row.id, 'confirm'),
                  `${row.id}:confirm`
                )
            : undefined,
          disabled: !canConfirm || transitioning === `${row.id}:confirm`,
          note: canConfirm
            ? undefined
            : isPolish
              ? `Wymagany status „szkic” lub „w przeglądzie” (obecny: ${findingStatusLabel(row.status, true)})`
              : `Requires draft or in-review status (current: ${findingStatusLabel(row.status, false)})`,
        },
        {
          id: 'accept-risk',
          label: isPolish ? 'Zaakceptuj ryzyko rezydualne' : 'Accept residual risk',
          icon: ShieldCheck,
          onClick: canAcceptRisk
            ? () => setNoteModal({ kind: 'accept-risk', findingId: row.id })
            : undefined,
          disabled: !canAcceptRisk || transitioning === `${row.id}:accept-risk`,
          note: canAcceptRisk
            ? undefined
            : isPolish
              ? `Ustalenie w statusie „${findingStatusLabel(row.status, true)}” nie przyjmuje już akceptacji ryzyka.`
              : `A finding in status "${findingStatusLabel(row.status, false)}" no longer accepts risk acceptance.`,
        },
        {
          id: 'close',
          label: isPolish ? 'Zamknij ustalenie' : 'Close finding',
          icon: Lock,
          onClick: canClose ? () => setNoteModal({ kind: 'close', findingId: row.id }) : undefined,
          disabled: !canClose || transitioning === `${row.id}:close`,
          note: canClose
            ? isPolish
              ? 'Zablokowane, dopóki działania korygujące/prewencyjne nie mają weryfikacji skuteczności, a korekty/działania doraźne — dowodu wdrożenia.'
              : 'Blocked until corrective/preventive actions have effectiveness verification and corrections/containments have implementation evidence.'
            : isPolish
              ? `Ustalenie w statusie „${findingStatusLabel(row.status, true)}” jest już zamknięte.`
              : `A finding in status "${findingStatusLabel(row.status, false)}" is already closed.`,
        },
      ],
      universalHandlers: {
        preview: () => setSelectedId(row.id),
        editNote: isPolish
          ? 'Treść ustalenia edytujesz w warsztacie kryterium — ten rejestr jest tylko do przeglądu i przejść stanu.'
          : 'Edit the finding statement in the criterion workspace — this register is review and state-transitions only.',
        archiveNote: isPolish
          ? 'Ustalenia nie są archiwizowane — cykl życia kończy zamknięcie lub akceptacja ryzyka.'
          : 'Findings are not archived — the lifecycle ends with closure or risk acceptance.',
      },
      destructive: {
        note: isPolish
          ? 'Ustalenia są nieusuwalne — ślad audytu.'
          : 'Findings cannot be deleted — immutable audit trail.',
      },
    };
  };

  const selected = items.find((f) => f.id === selectedId) || null;
  const selectedProperties: ArtifactPropertyRow[] | undefined = selected
    ? [
        {
          id: 'criterion',
          label: isPolish ? 'Kryterium / proces' : 'Criterion / process',
          value:
            (selected.criterionId && criterionTitleById.get(selected.criterionId)) ||
            (isPolish ? 'Bez przypisanego kryterium' : 'No criterion assigned'),
        },
        {
          id: 'owner',
          label: isPolish ? 'Właściciel' : 'Owner',
          value:
            (selected.ownerUserId && userNameById.get(selected.ownerUserId)) ||
            (isPolish ? 'Nieprzypisany' : 'Unassigned'),
        },
        {
          id: 'severity',
          label: isPolish ? 'Istotność' : 'Severity',
          value: (
            <StatusChip
              label={findingSeverityLabel(selected.severity, isPolish)}
              tone={findingSeverityTone(selected.severity)}
            />
          ),
        },
        {
          id: 'requirement',
          label: isPolish ? 'Wymaganie' : 'Requirement',
          value: selected.requirementText || '—',
        },
        {
          id: 'condition',
          label: isPolish ? 'Stan faktyczny' : 'Condition',
          value: selected.conditionText || '—',
        },
        { id: 'gap', label: isPolish ? 'Luka' : 'Gap', value: selected.gapText || '—' },
        {
          id: 'objectiveEvidence',
          label: isPolish ? 'Dowody obiektywne' : 'Objective evidence',
          value: selected.objectiveEvidence.length
            ? selected.objectiveEvidence.map((id) => evidenceTitleById.get(id) || id).join('; ')
            : '—',
        },
        {
          id: 'contradictingEvidence',
          label: isPolish ? 'Dowody przeczące' : 'Contradicting evidence',
          value: selected.contradictingEvidence.length
            ? selected.contradictingEvidence.map((id) => evidenceTitleById.get(id) || id).join('; ')
            : '—',
        },
        {
          id: 'recommendation',
          label: isPolish ? 'Rekomendacja' : 'Recommendation',
          value: selected.recommendation || '—',
        },
        {
          id: 'rootCause',
          label: isPolish ? 'Przyczyna źródłowa' : 'Root cause',
          value: selected.rootCause || '—',
        },
        {
          id: 'openActions',
          label: isPolish ? 'Otwarte działania' : 'Open actions',
          value: String(openActionsCountByFindingId.get(selected.id) ?? 0),
          mono: true,
        },
        {
          id: 'residualRisk',
          label: isPolish ? 'Ryzyko rezydualne' : 'Residual risk',
          value: selected.residualRiskNote || selected.residualRisk || '—',
        },
        {
          id: 'closureNote',
          label: isPolish ? 'Notatka zamknięcia' : 'Closure note',
          value: selected.closureNote || '—',
        },
        {
          id: 'createdAt',
          label: isPolish ? 'Utworzono' : 'Created',
          value: formatListDate(selected.createdAt),
          mono: true,
        },
        {
          id: 'updatedAt',
          label: isPolish ? 'Zaktualizowano' : 'Updated',
          value: formatListDate(selected.updatedAt),
          mono: true,
        },
      ]
    : undefined;

  /** R3(c): submit handler wspólny dla obu przejść wymagających notatki — modal woła to z przyciętą, niepustą treścią. */
  const handleNoteSubmit = useCallback(
    (note: string) => {
      if (!noteModal) return;
      const { kind, findingId } = noteModal;
      const key = `${findingId}:${kind}`;
      setNoteModal(null);
      void runTransition(
        findingId,
        () =>
          kind === 'accept-risk'
            ? acceptResidualRisk(findingId, note)
            : closeFinding(findingId, note),
        key
      );
    },
    [noteModal, runTransition]
  );

  const programOptions = programs;

  if (!loading && programOptions.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          variant="new"
          icon={ShieldCheck}
          title={isPolish ? 'Brak programów audytowych' : 'No audit programs yet'}
          description={
            isPolish
              ? 'Rejestr ustaleń jest zawsze przypisany do konkretnego programu. Rozpocznij program w zakładce Biblioteka, żeby zobaczyć tu ustalenia.'
              : 'The findings register is always scoped to a single program. Start a program from the Library tab to see findings here.'
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać ustaleń' : 'Could not load findings'}
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-c-border-subtle px-4 py-3">
        <label className="flex items-center gap-2 text-xs text-c-text-secondary">
          <span>{isPolish ? 'Program audytowy' : 'Audit program'}</span>
          <select
            className="rounded-md border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus"
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setSelectedId(null);
              setPage(1);
            }}
            data-testid="audit-findings-program-select"
          >
            {programOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {/* R2(a): licznik zawsze widoczny — `total` z serwera, nie `items.length` (strona ucina do PAGE_SIZE). */}
        <span className="text-xs text-c-text-muted" data-testid="audit-findings-total">
          {total > 0
            ? isPolish
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} z ${total} ustaleń`
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} findings`
            : isPolish
              ? '0 ustaleń'
              : '0 findings'}
        </span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-auto p-4">
          {transitionError ? (
            <div className="mb-2 rounded-lg border border-c-danger/30 bg-c-danger/5 px-3 py-2 text-xs text-c-danger">
              {transitionError}
            </div>
          ) : null}
          <StandardTable
            columns={columns}
            data={items}
            loading={loading}
            rowMenu={rowMenu}
            onRowClick={(row) => setSelectedId(String(row.id))}
            selectedRowId={selectedId}
            persistKey="audits.method.findings"
            empty={{
              icon: ShieldCheck,
              title: isPolish ? 'Brak ustaleń' : 'No findings yet',
              description: isPolish
                ? 'Ustalenia powstają w warsztacie kryterium, gdy audytor wyciągnie wniosek o niezgodności.'
                : 'Findings are created in the criterion workspace when an auditor draws a nonconformity conclusion.',
            }}
          />
          {totalPages > 1 ? (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-c-border-subtle pt-2.5">
              <span className="text-xs text-c-text-muted">
                {isPolish ? 'Strona' : 'Page'} {page} {isPolish ? 'z' : 'of'} {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="audit-findings-prev-page"
                  className="inline-flex h-8 items-center rounded-full border border-c-border-subtle bg-c-surface px-3 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {isPolish ? 'Poprzednia' : 'Previous'}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  data-testid="audit-findings-next-page"
                  className="inline-flex h-8 items-center rounded-full border border-c-border-subtle bg-c-surface px-3 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {isPolish ? 'Następna' : 'Next'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {selected ? (
          <div
            className="w-[380px] shrink-0 border-l border-c-border-subtle"
            data-testid="audit-finding-preview"
          >
            <StandardPreview
              title={`${selected.referenceCode || selected.id} — ${selected.statement}`}
              onClose={() => setSelectedId(null)}
              meta={{
                pills: [
                  {
                    label: isPolish ? 'Status' : 'Status',
                    value: findingStatusLabel(selected.status, isPolish),
                    tone: findingStatusTone(selected.status),
                  },
                  {
                    label: isPolish ? 'Klasyfikacja' : 'Classification',
                    value: findingClassificationLabel(selected.classification, isPolish),
                    tone: findingClassificationTone(selected.classification),
                  },
                ],
              }}
              details={{
                properties: selectedProperties,
                label: isPolish ? 'Szczegóły' : 'Details',
                propertyLabel: isPolish ? 'Właściwość' : 'Property',
                valueLabel: isPolish ? 'Wartość' : 'Value',
              }}
            />
          </div>
        ) : null}
      </div>
      <NoteEntryModal
        open={noteModal !== null}
        onClose={() => setNoteModal(null)}
        isPolish={isPolish}
        title={
          noteModal?.kind === 'accept-risk'
            ? isPolish
              ? 'Zaakceptuj ryzyko rezydualne'
              : 'Accept residual risk'
            : isPolish
              ? 'Zamknij ustalenie'
              : 'Close finding'
        }
        description={
          noteModal?.kind === 'accept-risk'
            ? isPolish
              ? 'Notatka uzasadniająca akceptację ryzyka rezydualnego jest wymagana i trafia do niezmiennego śladu audytu.'
              : 'A note justifying the residual risk acceptance is required and is written to the immutable audit trail.'
            : isPolish
              ? 'Notatka zamknięcia ustalenia jest wymagana i trafia do niezmiennego śladu audytu.'
              : 'A finding closure note is required and is written to the immutable audit trail.'
        }
        fieldLabel={isPolish ? 'Notatka' : 'Note'}
        submitLabel={
          noteModal?.kind === 'accept-risk'
            ? isPolish
              ? 'Zaakceptuj ryzyko'
              : 'Accept risk'
            : isPolish
              ? 'Zamknij ustalenie'
              : 'Close finding'
        }
        onSubmit={handleNoteSubmit}
      />
    </div>
  );
};

export default AuditFindingsTab;
