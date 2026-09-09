/**
 * Zlecenia — EKRAN LISTOWY (SPEC-L).
 *
 * Kanon (CLAUDE.md reguła #1 + #9): pasek modułu to `StandardModuleBar`,
 * tabela to `StandardTable`, podgląd to `StandardPreview`. Ten plik NIE
 * renderuje własnej tabeli ani własnego menu — deklaruje kolumny i treść,
 * wygląd narzucają komponenty wspólne.
 *
 * Dane: REALNE `/api/v8/case-workspace/cases`. Zero atrap, zero danych
 * zmyślonych. Pięć stanów obsłużonych jawnie: ładowanie · pusty · błąd ·
 * brak dostępu · wynik częściowy.
 *
 * Powrót ze zlecenia: filtr i zakładka żyją w adresie (`?zakladka=&status=&q=`),
 * więc przycisk Wstecz przeglądarki przywraca dokładnie tę listę. Fokus wraca
 * na wiersz, z którego użytkownik wyszedł (`data-zlecenie-wiersz`).
 */

import type { TFunction } from 'i18next';
import { ArrowRight, Ban, FolderOpen, ListChecks, Pause, Play } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';
import {
  autonomyPolicyLabel,
  caseProfileLabel,
  caseStatusLabel,
  closureAxisStatusLabel,
  closureTypeLabel,
  governanceTierLabel,
} from '@/utils/enumLabels';

import {
  cancelCase,
  getCase,
  getCaseIntakeSummary,
  listCases,
  newIdempotencyKey,
  pauseCase,
  resumeCase,
  startCase,
  toFailure,
} from './api';
import type { CaseCommandResult, CaseApiFailure, CaseCoreView } from './types';
import {
  CaseStateBlock,
  CommandBanner,
  CommandDialog,
  formatDateTime,
  MoreTabsMenu,
  relativeDays,
  StatusTag,
  useViewportWidth,
  type CommandNotice,
} from './ui';

// Zapamiętane „skąd wyszedłem" — do przywrócenia fokusu po Wstecz. Moduł, nie
// globalny store: dotyczy wyłącznie tej listy i nie ma sensu poza sesją karty.
let lastOpenedCaseId: string | null = null;

/*
 * Adres listy, z której użytkownik wszedł na zlecenie — RAZEM z filtrem
 * (`?widok=&status=&q=`).
 *
 * ★ ZMIERZONE, nie założone: powrót opierał się na `navigate(-1)`, czyli
 * „cofnij o JEDEN wpis historii". Tymczasem wewnątrz zlecenia przełączenie
 * zakładki i projekcji planu DODAJE wpis (`setParam` z `replace: false` — i tak
 * ma być, żeby przeglądarkowe Wstecz wracało na poprzednią zakładkę). Efekt
 * zmierzony na żywym ekranie: po jednym kliknięciu „Ekspercki" przycisk „Wróć
 * do listy zleceń" NIE wracał do listy, tylko do poprzedniej projekcji TEGO
 * SAMEGO zlecenia (`onList: false`) — trzeba go było kliknąć tyle razy, ile
 * rzeczy użytkownik po drodze przełączył. Deep link do zlecenia wyprowadzał
 * `navigate(-1)` całkiem poza moduł.
 *
 * Zapamiętany adres zamienia „cofnij o N" na „idź DOKŁADNIE tam": jedno
 * kliknięcie, właściwa zakładka, właściwy filtr, niezależnie od tego, co się
 * działo w środku zlecenia.
 */
let lastListLocation = '/zlecenia';

export function rememberOpenedCase(caseId: string | null, listLocation?: string): void {
  lastOpenedCaseId = caseId;
  if (listLocation) lastListLocation = listLocation;
}

/** Adres listy do powrotu ze zlecenia (z filtrem). Fallback: goła lista. */
export function rememberedListLocation(): string {
  return lastListLocation;
}

type SavedView = 'wszystkie' | 'uwaga' | 'zakonczone';

function getSavedViews(t: TFunction): Array<{ id: SavedView; label: string; description: string }> {
  return [
    {
      id: 'wszystkie',
      label: t('caseWorkspace.list.savedViews.allLabel', 'All orders'),
      description: t('caseWorkspace.list.savedViews.allDescription', "Full list of your organization's orders."),
    },
    {
      id: 'uwaga',
      label: t('caseWorkspace.list.savedViews.attentionLabel', 'Needs attention'),
      description: t(
        'caseWorkspace.list.savedViews.attentionDescription',
        'Orders that are blocked, failed, or have an unapproved plan.',
      ),
    },
    {
      id: 'zakonczone',
      label: t('caseWorkspace.list.savedViews.closedLabel', 'Closed'),
      description: t(
        'caseWorkspace.list.savedViews.closedDescription',
        'Orders that are closed, cancelled, or partially closed.',
      ),
    },
  ];
}

/** Osie zamknięcia, które realnie dotyczą zlecenia (bez „nie dotyczy"). */
function closureProgress(item: CaseCoreView): { done: number; total: number } {
  const axes = [
    item.deliveryStatus,
    item.decisionStatus,
    item.implementationStatus,
    item.outcomeStatus,
  ];
  const applicable = axes.filter((axis) => axis !== 'NOT_APPLICABLE');
  const done = applicable.filter((axis) => axis === 'COMPLETED' || axis === 'VALIDATED').length;
  return { done, total: applicable.length };
}

/**
 * „Uwaga" wyprowadzona WYŁĄCZNIE z pól, które lista naprawdę dostaje z API.
 * Backend nie zwraca w liście zleceń ani oczekiwań, ani propozycji do
 * zatwierdzenia, więc UI nie udaje, że je zna — mówi tylko to, co wynika ze
 * statusu zlecenia i osi zamknięcia.
 */
function attentionOf(
  item: CaseCoreView,
  t: TFunction,
): {
  label: string;
  tone: 'critical' | 'warning' | 'neutral';
} {
  if (item.caseStatus === 'BLOCKED')
    return { label: t('caseWorkspace.list.attention.blocked', 'Blocked — decision needed'), tone: 'critical' };
  if (item.caseStatus === 'FAILED')
    return { label: t('caseWorkspace.list.attention.failed', 'Failed — needs a response'), tone: 'critical' };
  if (item.caseStatus === 'DRAFT')
    return { label: t('caseWorkspace.list.attention.draft', 'Plan not yet approved'), tone: 'warning' };
  return { label: t('caseWorkspace.list.attention.none', 'Nothing waiting on you'), tone: 'neutral' };
}

function nextActionOf(item: CaseCoreView, t: TFunction): string {
  switch (item.caseStatus) {
    case 'DRAFT':
      return t('caseWorkspace.list.nextAction.draft', 'Agree and approve the plan');
    case 'ACTIVE':
      return t('caseWorkspace.list.nextAction.active', 'Check progress');
    case 'BLOCKED':
      return t('caseWorkspace.list.nextAction.blocked', 'Remove the blocker');
    case 'FAILED':
      return t('caseWorkspace.list.nextAction.failed', 'Decide whether to retry');
    case 'CLOSED':
      return t('caseWorkspace.list.nextAction.closed', 'Review results');
    case 'CANCELLED':
      return t('caseWorkspace.list.nextAction.cancelled', 'None — order cancelled');
    default:
      return t('caseWorkspace.list.nextAction.default', '—');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * JAK NAZYWA SIĘ ZLECENIE
 *
 * ★ STAN SPRZED 2026-08-10 (CW-T-A), dla pamięci: `case_core` NIE MIAŁ
 * kolumny na nazwę ani cel, więc lista pokazywała każdemu wierszowi ten sam
 * napis „Zlecenie bez nazwy" i UI musiał doganiać nazwę asynchronicznie z
 * `getCaseIntakeSummary`/`getCase` PO wyrysowaniu listy (kod tego doganiania
 * niżej w tym pliku wciąż istnieje — teraz służy DRUGIEJ linii wiersza, nie
 * pierwszej, patrz `podtytulZlecenia`).
 *
 * ★ OD MIGRACJI `20260810d_case_workspace_case_identity.sql`: `case_core` ma
 * własną kolumnę `case_name` (NOT NULL, osobna od `goal`/`expectedOutcome` —
 * cel NIE jest substytutem nazwy) i backend zwraca ją w KAŻDEJ trasie listy i
 * pojedynczego zlecenia. `item.caseName` jest więc ZAWSZE obecne, ZAWSZE
 * niepuste i jest teraz PIERWSZYM źródłem nazwy — bez czekania na drugie
 * żądanie sieciowe. Kolejność źródeł, od najważniejszego:
 *  1. WŁASNA NAZWA zlecenia (`item.caseName`) — realna kolumna DB, prawdziwy
 *     tytuł tego zlecenia. To jest właśnie to, co odróżnia DWA zlecenia w
 *     JEDNYM projekcie (CW-T-A: jeden projekt może mieć wiele niezależnych
 *     zleceń) — dwa wiersze z tym samym `projectId` będą miały RÓŻNE
 *     `caseName`.
 *  2. CEL z potwierdzonego work ordera (`getCaseIntakeSummary`) — zachowany
 *     jako pierwszy fallback dla (teoretycznego) przypadku, gdy backend
 *     jeszcze nie niesie `caseName` (starsze wdrożenie bez tej migracji).
 *  3. NAZWA PROJEKTU z `getCase` — trzeci fallback.
 *  4. UCZCIWY IDENTYFIKATOR: skrót sprawy + rodzaj — gdy nie ma żadnej nazwy
 *     w ogóle (nie powinno się zdarzyć po migracji, ale kolumna NOT NULL w
 *     bazie nie chroni przed pustym stringiem z bardzo starego klienta API).
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface CaseNaming {
  goal: string | null;
  expectedOutcome: string | null;
  projectName: string | null;
  projectDescription: string | null;
}

/** Skrót sprawy do pokazania człowiekowi: `case-58d0820c-…` → `58D0820C`. */
export function skrotZlecenia(caseId: string): string {
  const dopasowanie = /^case-([0-9a-fA-F]{8})/.exec(String(caseId).trim());
  if (dopasowanie) return dopasowanie[1].toUpperCase();
  const gole = String(caseId).replace(/[^0-9a-zA-Z]/g, '');
  return (gole.slice(-8) || String(caseId)).toUpperCase();
}

function niepusty(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

/** Nazwa zlecenia wg kolejności źródeł opisanej wyżej. Nigdy pusta. */
export function nazwaZlecenia(item: CaseCoreView, naming: CaseNaming | null | undefined, t: TFunction): string {
  const wlasna = niepusty(item.caseName);
  if (wlasna) return wlasna;
  const cel = niepusty(naming?.goal);
  if (cel) return cel;
  const projekt = niepusty(naming?.projectName ?? item.projectName);
  if (projekt) return projekt;
  return t('caseWorkspace.list.fallbackName', 'Order {{shortId}} · {{profile}}', {
    shortId: skrotZlecenia(item.caseId),
    profile: caseProfileLabel(item.caseProfile, true),
  });
}

/**
 * Druga linia wiersza: projekt (od CW-T-A rozróżnia RÓWNIEŻ dwa zlecenia o
 * IDENTYCZNYM projekcie ale RÓŻNYCH nazwach — oba dostaną tę samą linię
 * „Projekt: X", co jest poprawne: to naprawdę ten sam projekt), cel (gdy
 * różni się od nazwy — po CW-T-A `caseName` i `goal` to świadomie odrębne
 * pola) i oczekiwany rezultat. Pusty string, gdy nie ma czego napisać —
 * wołający decyduje, co wtedy pokazać.
 */
export function podtytulZlecenia(item: CaseCoreView, naming: CaseNaming | null | undefined, t: TFunction): string {
  const nazwa = nazwaZlecenia(item, naming, t);
  const czesci: string[] = [];
  const projekt = niepusty(naming?.projectName ?? item.projectName);
  if (projekt && projekt !== nazwa)
    czesci.push(t('caseWorkspace.list.subtitle.project', 'Project: {{value}}', { value: projekt }));
  const cel = niepusty(naming?.goal);
  if (cel && cel !== nazwa) czesci.push(t('caseWorkspace.list.subtitle.goal', 'Goal: {{value}}', { value: cel }));
  const rezultat = niepusty(
    naming?.expectedOutcome ?? naming?.projectDescription ?? item.projectDescription
  );
  if (rezultat)
    czesci.push(t('caseWorkspace.list.subtitle.outcome', 'Expected outcome: {{value}}', { value: rezultat }));
  return czesci.join(' · ');
}

function statusTone(
  status: CaseCoreView['caseStatus']
): 'critical' | 'warning' | 'success' | 'info' | 'neutral' {
  if (status === 'BLOCKED' || status === 'FAILED') return 'critical';
  if (status === 'DRAFT') return 'warning';
  if (status === 'CLOSED') return 'success';
  if (status === 'ACTIVE') return 'info';
  return 'neutral';
}

export const CasesListScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewportWidth = useViewportWidth();
  const isNarrow = viewportWidth < 768;

  const savedView = (searchParams.get('widok') as SavedView | null) ?? 'wszystkie';
  const statusChip = searchParams.get('status');
  const query = searchParams.get('q') ?? '';

  const [items, setItems] = useState<CaseCoreView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<CaseApiFailure | null>(null);
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const focusRestoredRef = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailure(null);
    listCases()
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error) => {
        setFailure(toFailure(error));
        setItems(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * ── SKĄD LISTA BIERZE NAZWY ──────────────────────────────────────────────
   *
   * Trasa listy nie zwraca ani celu, ani nazwy projektu (dowód i kolejność
   * źródeł: komentarz przy `nazwaZlecenia` wyżej). Dociągamy je więc PO
   * wyrysowaniu listy — wiersze pojawiają się od razu z uczciwym skrótem, a
   * nazwa wskakuje, gdy dojedzie.
   *
   * Trzy decyzje, nie kosmetyka:
   *  1. RÓWNOLEGŁOŚĆ OGRANICZONA do `LIMIT_ROWNOLEGLYCH` — to N+1 na dwie
   *     trasy, więc bez limitu lista 200 zleceń wysłałaby 400 żądań naraz.
   *  2. RAZ NA ZLECENIE. `namingRef` trzyma to, co już pobrane; komenda
   *     (start/pauza/anulowanie) podmienia wiersz w `items`, efekt odpala się
   *     ponownie i BEZ tej straży pobierałby wszystko od nowa.
   *  3. BŁĄD ≠ ZMYŚLONA NAZWA. Gdy oba odczyty padną, zapisujemy same `null`
   *     i wiersz zostaje przy uczciwym identyfikatorze. Nie wpisujemy tam
   *     niczego, czego backend nie powiedział.
   */
  const [naming, setNaming] = useState<Record<string, CaseNaming>>({});
  const namingRef = useRef<Record<string, CaseNaming>>({});
  namingRef.current = naming;

  useEffect(() => {
    const brakujace = (items ?? []).filter((item) => !(item.caseId in namingRef.current));
    if (brakujace.length === 0) return undefined;

    let anulowane = false;
    const LIMIT_ROWNOLEGLYCH = 4;
    const kolejka = [...brakujace];

    const pobierzJedno = async (item: CaseCoreView): Promise<[string, CaseNaming]> => {
      const [intake, rdzen] = await Promise.all([
        getCaseIntakeSummary(item.caseId).catch(() => null),
        // `projectName` bywa w wierszu listy NIEOBECNE (nie `null`) — wtedy i
        // tylko wtedy dopytujemy trasę pojedynczego zlecenia.
        item.projectName != null
          ? Promise.resolve(item)
          : getCase(item.caseId).catch(() => null),
      ]);
      return [
        item.caseId,
        {
          goal: intake?.goal ?? null,
          expectedOutcome: intake?.expectedOutcome ?? null,
          projectName: rdzen?.projectName ?? item.projectName ?? null,
          projectDescription: rdzen?.projectDescription ?? item.projectDescription ?? null,
        },
      ];
    };

    void (async () => {
      while (kolejka.length > 0 && !anulowane) {
        const partia = kolejka.splice(0, LIMIT_ROWNOLEGLYCH);
        const wyniki = await Promise.all(partia.map(pobierzJedno));
        if (anulowane) return;
        setNaming((prev) => {
          const next = { ...prev };
          for (const [id, wartosc] of wyniki) next[id] = wartosc;
          return next;
        });
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [items]);

  /*
   * ── KOMENDY NA LIŚCIE ────────────────────────────────────────────────────
   *
   * Lista wysyła cztery realne komendy do backendu: rozpocznij · wstrzymaj ·
   * wznów · anuluj (`POST /cases/:id/status`, `POST /cases/:id/cancel`).
   *
   * Trzy decyzje, które nie są kosmetyką:
   *
   * 1. KLUCZ IDEMPOTENCJI ŻYJE DŁUŻEJ NIŻ ŻĄDANIE. Powstaje w chwili, gdy
   *    użytkownik otwiera potwierdzenie („ta intencja"), i jest reużywany przy
   *    powtórzeniu tej samej intencji. Nowy klucz per żądanie byłby atrapą
   *    idempotencji — chroniłby dokładnie przed niczym.
   * 2. STAN WIERSZA PO KOMENDZIE POCHODZI Z SERWERA. Nie „ustawiamy ACTIVE, bo
   *    wysłaliśmy ACTIVE": `api.ts` czyta zlecenie ponownie po mutacji i to ten
   *    odczyt aktualizuje wiersz. Gdy odczyt kontrolny padnie, mówimy o tym
   *    wprost zamiast malować sukces.
   * 3. KONFLIKT NIE JEST BŁĘDEM SYSTEMU. 409 na tych trasach znaczy: zlecenie
   *    jest w innym stanie, niż pokazuje ekran (np. ktoś je już anulował).
   *    Uczciwa odpowiedź to „nic nie zmieniono, odśwież", a nie „spróbuj
   *    ponownie".
   */
  type PendingCommand = { kind: 'start' | 'pause' | 'resume' | 'cancel'; item: CaseCoreView };

  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);
  const [notice, setNotice] = useState<CommandNotice | null>(null);
  // intencja („anuluj to zlecenie") → klucz idempotencji. Kasowany po sukcesie.
  const intentKeysRef = useRef<Map<string, string>>(new Map());

  const keyForIntent = useCallback((intent: string) => {
    const existing = intentKeysRef.current.get(intent);
    if (existing) return existing;
    const fresh = newIdempotencyKey();
    intentKeysRef.current.set(intent, fresh);
    return fresh;
  }, []);

  const runPendingCommand = useCallback(
    async (reason: string) => {
      if (!pending) return;
      const { kind, item } = pending;
      const intent = `${kind}:${item.caseId}`;
      const idempotencyKey = keyForIntent(intent);
      setCommandBusy(true);
      let result: CaseCommandResult<CaseCoreView>;
      try {
        if (kind === 'start') {
          result = await startCase(item.caseId, reason || undefined, { idempotencyKey });
        } else if (kind === 'pause') {
          result = await pauseCase(item.caseId, reason, { idempotencyKey });
        } else if (kind === 'resume') {
          result = await resumeCase(item.caseId, reason || undefined, { idempotencyKey });
        } else {
          result = await cancelCase(item.caseId, reason, { idempotencyKey });
        }
      } finally {
        setCommandBusy(false);
      }

      if (!result.ok) {
        // 409 / 400 / 422 → „nic nie zmieniono, odśwież". 403 / 404 / 5xx →
        // stan krytyczny. Komunikat bierzemy z `api.ts` — jest już po polsku
        // i (dla 404) NIE zdradza, czy obiekt istnieje.
        setPending(null);
        setNotice({
          tone:
            result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
              ? 'warning'
              : 'critical',
          text: result.failure.message,
          refresh: result.failure.refreshSuggested,
        });
        return;
      }

      intentKeysRef.current.delete(intent);
      setPending(null);
      // Wiersz aktualizujemy STANEM Z SERWERA (readback), nie tym, co wysłano.
      setItems((prev) =>
        prev ? prev.map((row) => (row.caseId === result.value.caseId ? result.value : row)) : prev
      );
      setNotice(
        result.readback === 'confirmed'
          ? {
              tone: 'success',
              // Nazwa albo nic — NIGDY surowy identyfikator techniczny
              // (warunek właściciela: `case_id` tylko w widoku eksperckim).
              text: (() => {
                const name = niepusty(
                  naming[result.value.caseId]?.goal ??
                    naming[result.value.caseId]?.projectName ??
                    result.value.projectName
                );
                const status = caseStatusLabel(result.value.caseStatus, true);
                return name
                  ? t('caseWorkspace.list.notice.savedNamed', 'Saved. Order “{{name}}” now has status: {{status}}.', {
                      name,
                      status,
                    })
                  : t('caseWorkspace.list.notice.savedUnnamed', 'Saved. Order now has status: {{status}}.', {
                      status,
                    });
              })(),
            }
          : {
              tone: 'warning',
              refresh: true,
              text: t(
                'caseWorkspace.list.notice.unconfirmed',
                "The operation was accepted by the server, but the follow-up check couldn't confirm the state. Refresh the data to see what's really going on.",
              ),
            }
      );
    },
    [pending, keyForIntent]
  );

  const commandDialogCopy = useMemo(() => {
    if (!pending) return null;
    // Cudzysłów TYLKO wokół prawdziwej nazwy. Gdy nazwy nie ma, zdanie mówi
    // „to zlecenie" bez cudzysłowu — inaczej wygląda, jakby zlecenie
    // NAZYWAŁO SIĘ „to zlecenie".
    const rawName = niepusty(
      naming[pending.item.caseId]?.goal ?? naming[pending.item.caseId]?.projectName ?? pending.item.projectName
    );
    const subject = rawName
      ? t('caseWorkspace.list.commandDialog.subjectNamed', 'Order “{{name}}”', { name: rawName })
      : t('caseWorkspace.list.commandDialog.subjectUnnamed', 'This order');
    if (pending.kind === 'start') {
      return {
        title: t('caseWorkspace.list.commandDialog.start.title', 'Start the order?'),
        description: t('caseWorkspace.list.commandDialog.start.description', '{{subject}} will move from draft to execution.', {
          subject,
        }),
        confirmLabel: t('caseWorkspace.list.commandDialog.start.confirm', 'Start'),
        reason: {
          label: t('caseWorkspace.list.commandDialog.start.reasonLabel', 'Reason'),
          required: false,
          placeholder: t('caseWorkspace.list.commandDialog.start.reasonPlaceholder', 'e.g. plan agreed with the client'),
        },
      };
    }
    if (pending.kind === 'pause') {
      return {
        title: t('caseWorkspace.list.commandDialog.pause.title', 'Pause the order?'),
        description: t(
          'caseWorkspace.list.commandDialog.pause.description',
          '{{subject}} will be blocked until the cause is resolved.',
          { subject },
        ),
        confirmLabel: t('caseWorkspace.list.commandDialog.pause.confirm', 'Pause'),
        reason: {
          label: t('caseWorkspace.list.commandDialog.pause.reasonLabel', 'Reason for pausing'),
          required: true,
          placeholder: t('caseWorkspace.list.commandDialog.pause.reasonPlaceholder', 'e.g. waiting for data from the client'),
        },
      };
    }
    if (pending.kind === 'resume') {
      return {
        title: t('caseWorkspace.list.commandDialog.resume.title', 'Resume the order?'),
        description: t('caseWorkspace.list.commandDialog.resume.description', '{{subject}} will return to execution.', {
          subject,
        }),
        confirmLabel: t('caseWorkspace.list.commandDialog.resume.confirm', 'Resume'),
        reason: {
          label: t('caseWorkspace.list.commandDialog.resume.reasonLabel', 'Reason'),
          required: false,
          placeholder: t('caseWorkspace.list.commandDialog.resume.reasonPlaceholder', 'e.g. blocker removed'),
        },
      };
    }
    return {
      title: t('caseWorkspace.list.commandDialog.cancel.title', 'Cancel the order?'),
      description: t(
        'caseWorkspace.list.commandDialog.cancel.description',
        "{{subject}} will be closed as cancelled. This change can't be undone — cancelled is a final status.",
        { subject },
      ),
      confirmLabel: t('caseWorkspace.list.commandDialog.cancel.confirm', 'Cancel order'),
      reason: {
        label: t('caseWorkspace.list.commandDialog.cancel.reasonLabel', 'Reason for cancelling'),
        required: true,
        placeholder: t('caseWorkspace.list.commandDialog.cancel.reasonPlaceholder', 'e.g. client withdrew the request'),
      },
    };
  }, [pending, naming, t]);

  // Powrót ze zlecenia (Wstecz): filtr wraca sam z adresu, a fokus stawiamy na
  // wierszu, z którego użytkownik wyszedł. Bez tego czytnik ekranu i klawiatura
  // lądują na początku strony i użytkownik gubi miejsce w liście.
  useEffect(() => {
    if (!items || focusRestoredRef.current || !lastOpenedCaseId) return;
    const node = document.querySelector<HTMLElement>(
      `[data-zlecenie-wiersz="${CSS.escape(lastOpenedCaseId)}"]`
    );
    if (node) {
      focusRestoredRef.current = true;
      setSelectedId(lastOpenedCaseId);
      node.focus();
      node.scrollIntoView({ block: 'center' });
    }
  }, [items]);

  /*
   * ★ PĘTLA RENDEROWANIA — wykryta na REALNYM zrzucie, nie w testach.
   *
   * `ModuleNavBar` (pod `StandardModuleBar`) woła `onSearch` z WNĘTRZA
   * `useEffect` z zależnościami `[debouncedSearchQuery, onSearch]`
   * (`src/components/shared/ModuleHub/ModuleNavBar.tsx:198`). Jeżeli `onSearch`
   * dostaje nową tożsamość przy każdym renderze, efekt odpala się przy każdym
   * renderze → `setSearchParams` → nawigacja `replace` → render → efekt…
   * = „Maximum update depth exceeded" i moduł miele w kółko.
   *
   * Dlatego OBA warunki muszą być spełnione i oba są tu wymuszone:
   *  1. `setParam` używa formy funkcyjnej `setSearchParams`, więc NIE zależy od
   *     `searchParams` i jego tożsamość się nie zmienia;
   *  2. wywołanie jest pomijane, gdy adres i tak by się nie zmienił — inaczej
   *     pierwsze (puste) wyszukiwanie samo z siebie robiłoby nawigację.
   */
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const prev = searchParamsRef.current;
      const next = new URLSearchParams(prev);
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      // Nawigacja TYLKO gdy adres realnie się zmienia — `setSearchParams`
      // nawiguje bezwarunkowo, a nawigacja „w to samo miejsce" wystarczy, żeby
      // pętla z komentarza wyżej wróciła.
      if (next.toString() === prev.toString()) return;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  // Stabilna tożsamość — patrz komentarz wyżej. Bez tego pętla wraca.
  const handleSearch = useCallback((value: string) => setParam('q', value), [setParam]);

  const bySavedView = useMemo(() => {
    const all = items ?? [];
    if (savedView === 'uwaga') {
      return all.filter((item) => ['BLOCKED', 'FAILED', 'DRAFT'].includes(item.caseStatus));
    }
    if (savedView === 'zakonczone') {
      return all.filter((item) => ['CLOSED', 'CANCELLED'].includes(item.caseStatus));
    }
    return all;
  }, [items, savedView]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { wszystkie: bySavedView.length };
    for (const item of bySavedView) {
      counts[item.caseStatus] = (counts[item.caseStatus] ?? 0) + 1;
    }
    return counts;
  }, [bySavedView]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bySavedView.filter((item) => {
      if (statusChip && statusChip !== 'wszystkie' && item.caseStatus !== statusChip) return false;
      if (!needle) return true;
      // Szukamy po tym, co użytkownik WIDZI (cel, projekt, rezultat), a nie po
      // polach, których lista nigdy nie pokazała.
      const info = naming[item.caseId];
      const haystack = [
        nazwaZlecenia(item, info, t),
        podtytulZlecenia(item, info, t),
        item.projectName,
        item.projectDescription,
        item.caseId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [bySavedView, statusChip, query, naming, t]);

  const rows = useMemo(
    () =>
      visible.map((item) => {
        const progress = closureProgress(item);
        const attention = attentionOf(item, t);
        const info = naming[item.caseId];
        return {
          id: item.caseId,
          nazwa: nazwaZlecenia(item, info, t),
          rezultat: podtytulZlecenia(item, info, t),
          rodzaj: caseProfileLabel(item.caseProfile, true),
          status: caseStatusLabel(item.caseStatus, true),
          uwaga: attention.label,
          uwagaTone: attention.tone,
          postep: progress.total
            ? t('caseWorkspace.list.columns.progressOfTotal', '{{done}} of {{total}}', {
                done: progress.done,
                total: progress.total,
              })
            : t('caseWorkspace.list.columns.progressNotApplicable', 'not applicable'),
          nastepna: nextActionOf(item, t),
          aktywnosc: item.updatedAt,
          statusTone: statusTone(item.caseStatus),
          raw: item,
        };
      }),
    [visible, naming, t]
  );

  /*
   * Aktualny adres listy trzymamy w refie, a nie w zależnościach `useCallback`.
   * Powód jest ten sam co przy `setParam` wyżej: `openCase` wędruje do
   * `StandardTable`/`rowMenu`, a niestabilna tożsamość handlera w tym module
   * już raz wywołała pętlę renderowania. Ref daje świeżą wartość bez zmiany
   * tożsamości funkcji.
   */
  const listUrlRef = useRef(`${location.pathname}${location.search}`);
  listUrlRef.current = `${location.pathname}${location.search}`;

  const openCase = useCallback(
    (caseId: string) => {
      // Zapamiętujemy JEDNOCZEŚNIE wiersz (fokus po powrocie) i adres listy
      // z filtrem (właściwa lista po powrocie). Jedno bez drugiego nie spełnia
      // warunku właściciela #4.
      rememberOpenedCase(caseId, listUrlRef.current);
      navigate(`/zlecenia/${encodeURIComponent(caseId)}?zakladka=plan&widok-planu=prosty`);
    },
    [navigate]
  );

  /**
   * Kolumny na TELEFON — jedna kolumna, w niej to, po co użytkownik tu przyszedł:
   * nazwa, status, uwaga i następna akcja.
   *
   * ★ ZE ZRZUTU 375 px: przy pełnym zestawie kolumn telefon pokazywał wyłącznie
   * nazwę zlecenia — status i „następna akcja" zostawały za poziomym
   * przewijaniem WEWNĄTRZ tabeli. Strona się nie przewijała (warunek #4 spełniony),
   * ale treść była nieosiągalna bez szukania. Kolumn nie chowa tu żaden własny
   * komponent — moduł po prostu DEKLARUJE inny zestaw kolumn, a `StandardTable`
   * dalej rządzi wyglądem (kanon: moduł deklaruje treść, komponent narzuca formę).
   */
  const mobileColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'nazwa',
        label: t('caseWorkspace.list.columns.orderMobile', 'Order'),
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-zlecenie-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <div className="text-sm font-medium leading-snug text-c-text">{String(row.nazwa)}</div>
            <div className="flex flex-wrap items-center gap-1">
              <StatusTag tone={row.statusTone as 'critical'}>{String(row.status)}</StatusTag>
              {row.uwagaTone !== 'neutral' ? (
                <StatusTag tone={row.uwagaTone as 'critical'}>{String(row.uwaga)}</StatusTag>
              ) : null}
            </div>
            <div className="text-xs text-c-text-muted">
              {t('caseWorkspace.list.columns.nextActionInline', 'Next action: {{action}} · {{when}}', {
                action: String(row.nastepna),
                when: relativeDays(String(row.aktywnosc), t),
              })}
            </div>
          </div>
        ),
      },
    ],
    [t]
  );

  const desktopColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'nazwa',
        label: t('caseWorkspace.list.columns.orderAndOutcome', 'Order and expected outcome'),
        width: '300px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            // Kotwica dla przywrócenia fokusu po „Wstecz" (warunek właściciela).
            // `tabIndex={-1}` — element nie wchodzi do kolejności Tab, ale można
            // mu programowo oddać fokus, gdy użytkownik wraca do listy.
            data-zlecenie-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded"
          >
            <div className="truncate text-sm font-medium text-c-text" title={String(row.nazwa)}>
              {String(row.nazwa)}
            </div>
            {row.rezultat ? (
              <div className="truncate text-xs text-c-text-muted" title={String(row.rezultat)}>
                {String(row.rezultat)}
              </div>
            ) : (
              <div className="text-xs text-c-text-muted">
                {t('caseWorkspace.list.columns.goalOutcomeUndescribed', 'Goal and outcome not described')}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'rodzaj',
        label: t('caseWorkspace.list.columns.type', 'Type'),
        width: '130px',
        sortable: true,
        filterable: true,
      },
      {
        id: 'status',
        label: t('caseWorkspace.list.columns.status', 'Status'),
        width: '130px',
        sortable: true,
        filterable: true,
        render: (row: Record<string, unknown>) => (
          <StatusTag tone={row.statusTone as 'critical'}>{String(row.status)}</StatusTag>
        ),
      },
      {
        id: 'uwaga',
        label: t('caseWorkspace.list.columns.attention', 'Attention'),
        width: '190px',
        render: (row: Record<string, unknown>) =>
          row.uwagaTone === 'neutral' ? (
            <span className="text-sm text-c-text-muted">{String(row.uwaga)}</span>
          ) : (
            <StatusTag tone={row.uwagaTone as 'critical'}>{String(row.uwaga)}</StatusTag>
          ),
      },
      {
        id: 'postep',
        label: t('caseWorkspace.list.columns.progress', 'Progress toward outcome'),
        width: '120px',
        align: 'right',
      },
      {
        id: 'nastepna',
        label: t('caseWorkspace.list.columns.nextAction', 'Next action'),
        width: '170px',
      },
      {
        id: 'aktywnosc',
        label: t('caseWorkspace.list.columns.lastActivity', 'Last activity'),
        width: '140px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => String(row.aktywnosc ?? ''),
        render: (row: Record<string, unknown>) => (
          <span
            className="text-sm text-c-text-secondary"
            title={formatDateTime(String(row.aktywnosc))}
          >
            {relativeDays(String(row.aktywnosc), t)}
          </span>
        ),
      },
    ],
    [t]
  );

  const columns = isNarrow ? mobileColumns : desktopColumns;

  const selected = useMemo(
    () => visible.find((item) => item.caseId === selectedId) ?? null,
    [visible, selectedId]
  );

  // WARUNEK WŁAŚCICIELA: na wąskim ekranie ukryte zakładki idą do jawnego,
  // opisanego „Więcej" obsługiwanego klawiaturą — nie do poziomego przesuwania
  // paska i nie pod nagi chevron.
  // Na wąskim ekranie w pasku zostaje AKTYWNY widok, a reszta idzie do „Więcej".
  // (Pierwsza wersja zostawiała w pasku zawsze „Wszystkie zlecenia" — test
  // klawiaturowy pokazał, że po wyborze „Zakończone" pasek nadal podświetlał
  // „Wszystkie", czyli użytkownik nie miał POTWIERDZENIA, co wybrał.)
  const savedViews = useMemo(() => getSavedViews(t), [t]);
  const visibleViews = isNarrow ? savedViews.filter((view) => view.id === savedView) : savedViews;
  const hiddenViews = isNarrow ? savedViews.filter((view) => view.id !== savedView) : [];

  const statusChips = useMemo(
    () => [
      { id: 'wszystkie', label: t('caseWorkspace.list.allChip', 'All'), count: statusCounts.wszystkie ?? 0 },
      { id: 'ACTIVE', label: caseStatusLabel('ACTIVE', true), count: statusCounts.ACTIVE ?? 0 },
      { id: 'BLOCKED', label: caseStatusLabel('BLOCKED', true), count: statusCounts.BLOCKED ?? 0 },
      { id: 'DRAFT', label: caseStatusLabel('DRAFT', true), count: statusCounts.DRAFT ?? 0 },
      { id: 'CLOSED', label: caseStatusLabel('CLOSED', true), count: statusCounts.CLOSED ?? 0 },
    ],
    [statusCounts, t]
  );

  /*
   * ★ DANE POZA JSX — świadoma decyzja, nie kosmetyka.
   *
   * Pasek modułu ma DOKŁADNIE 3 zakładki (`SAVED_VIEWS`) i 5 pigułek statusu,
   * czyli mieści się w limicie ≤6 z Doktryny Gęstości §4. Strażnik
   * `scripts/check-gestosc.sh` liczył jednak 12: jego heurystyka otwiera
   * „strefę zakładek" na pierwszej linii z propem zakładek i zamyka ją
   * dopiero na linii `]`, a potem dolicza KAŻDE `id: '…'` po drodze. Przy
   * tablicach wpisanych wprost w JSX (wiersze podglądu, akcje kebaba, „Co
   * dalej") do zakładek doliczały się elementy podglądu.
   *
   * Deklaracje danych stoją więc PRZED `return`, gdzie i tak jest ich miejsce:
   * pomiar strażnika zgadza się z rzeczywistością (3 zakładki), a JSX pokazuje
   * układ zamiast treści. To zmiana kolejności deklaracji — zero zmian
   * zachowania, żadna funkcja nie znika.
   */
  const barTabs = useMemo(
    () => visibleViews.map((view) => ({ id: view.id, label: view.label })),
    [visibleViews]
  );

  /*
   * Kebab wiersza: otwarcie + REALNE przejścia stanu + anulowanie.
   *
   * Pokazujemy WYŁĄCZNIE krawędzie, które backend dopuszcza
   * (`caseCoreService.ts:168`: DRAFT→ACTIVE, ACTIVE↔BLOCKED, wszystko →
   * CANCELLED, stany końcowe bez wyjścia). Dyndająca akcja, która zawsze
   * kończy się 409, to obietnica bez pokrycia.
   *
   * To NIE zwalnia z obsługi 409: między narysowaniem menu a kliknięciem stan
   * na serwerze mógł się zmienić. Wtedy komenda wraca konfliktem i pasek nad
   * tabelą mówi „nic nie zmieniono, odśwież".
   */
  const rowMenu = useCallback(
    (row: Record<string, unknown>) => {
      const item = row.raw as CaseCoreView;
      const terminal = ['CLOSED', 'FAILED', 'CANCELLED'].includes(item.caseStatus);
      const statusTransitions: Array<{
        id: string;
        label: string;
        icon?: React.ElementType;
        onClick: () => void;
      }> = [];
      if (item.caseStatus === 'DRAFT') {
        statusTransitions.push({
          id: 'rozpocznij',
          label: t('caseWorkspace.list.rowMenu.start', 'Start order'),
          icon: Play,
          onClick: () => setPending({ kind: 'start', item }),
        });
      }
      if (item.caseStatus === 'ACTIVE') {
        statusTransitions.push({
          id: 'wstrzymaj',
          label: t('caseWorkspace.list.rowMenu.pause', 'Pause order'),
          icon: Pause,
          onClick: () => setPending({ kind: 'pause', item }),
        });
      }
      if (item.caseStatus === 'BLOCKED') {
        statusTransitions.push({
          id: 'wznow',
          label: t('caseWorkspace.list.rowMenu.resume', 'Resume order'),
          icon: Play,
          onClick: () => setPending({ kind: 'resume', item }),
        });
      }
      return {
        primary: [
          {
            id: 'otworz',
            label: t('caseWorkspace.list.rowMenu.open', 'Open order'),
            icon: ArrowRight,
            onClick: () => openCase(String(row.id)),
          },
        ],
        statusTransitions,
        universalHandlers: {
          preview: () => {
            jedenPanel.otworz();
            setSelectedId(String(row.id));
          },
        },
        destructive: terminal
          ? undefined
          : {
              label: t('caseWorkspace.list.rowMenu.cancel', 'Cancel order'),
              icon: Ban,
              onClick: () => setPending({ kind: 'cancel', item }),
            },
      };
    },
    [openCase, t]
  );

  /** Wiersze „właściwość → wartość" w podglądzie. Wszystkie po polsku. */
  const previewProperties = useMemo(() => {
    if (!selected) return [];
    return [
      {
        id: 'zamkniecie',
        label: t('caseWorkspace.list.preview.closureType', 'Agreed closure method'),
        value: closureTypeLabel(selected.contractedClosureType, true),
      },
      {
        id: 'nadzor',
        label: t('caseWorkspace.list.preview.governance', 'Governance'),
        value: governanceTierLabel(selected.governanceTier, true),
      },
      {
        id: 'samodzielnosc',
        label: t('caseWorkspace.list.preview.autonomy', 'System autonomy'),
        value: autonomyPolicyLabel(selected.autonomyPolicy, true),
      },
      {
        id: 'dostarczenie',
        label: t('caseWorkspace.list.preview.delivery', 'Delivery'),
        value: closureAxisStatusLabel(selected.deliveryStatus, true),
      },
      {
        id: 'decyzja',
        label: t('caseWorkspace.list.preview.decision', 'Decision'),
        value: closureAxisStatusLabel(selected.decisionStatus, true),
      },
      {
        id: 'wdrozenie',
        label: t('caseWorkspace.list.preview.implementation', 'Implementation'),
        value: closureAxisStatusLabel(selected.implementationStatus, true),
      },
      {
        id: 'efekt',
        label: t('caseWorkspace.list.preview.outcome', 'Effect'),
        value: closureAxisStatusLabel(selected.outcomeStatus, true),
      },
      {
        id: 'zmiana',
        label: t('caseWorkspace.list.preview.lastChange', 'Last change'),
        value: formatDateTime(selected.updatedAt),
      },
    ];
  }, [selected, t]);

  /** „Co dalej" — wejście na wybraną zakładkę zlecenia. */
  const previewNextItems = useMemo(() => {
    if (!selected) return [];
    const go = (query: string) => () => {
      rememberOpenedCase(selected.caseId, listUrlRef.current);
      navigate(`/zlecenia/${encodeURIComponent(selected.caseId)}?${query}`);
    };
    return [
      {
        id: 'plan',
        label: t('caseWorkspace.list.preview.plan', 'Plan'),
        icon: ListChecks,
        onClick: go('zakladka=plan&widok-planu=prosty'),
      },
      {
        id: 'realizacja',
        label: t('caseWorkspace.list.preview.execution', 'Execution'),
        onClick: go('zakladka=realizacja'),
      },
      {
        id: 'rezultaty',
        label: t('caseWorkspace.list.preview.results', 'Results'),
        onClick: go('zakladka=rezultaty'),
      },
    ];
  }, [selected, navigate, t]);

  const stateBlock = (
    <CaseStateBlock
      loading={loading}
      failure={failure}
      onRetry={load}
      empty={
        items && items.length === 0
          ? {
              title: t('caseWorkspace.list.empty.noOrdersTitle', "You don't have any orders yet"),
              description: t(
                'caseWorkspace.list.empty.noOrdersDescription',
                'An order is created from a project — once the first one starts, it appears here together with its plan, execution and results.',
              ),
            }
          : items && visible.length === 0
            ? {
                title: t('caseWorkspace.list.empty.noMatchTitle', 'No order matches the filters'),
                description: t('caseWorkspace.list.empty.noMatchDescription', 'Change the tab, status, or clear the search.'),
              }
            : null
      }
    />
  );

  return (
    <div className="h-full min-w-0" data-testid="zlecenia-lista">
      <StandardModuleBar
        tabs={barTabs}
        activeTab={visibleViews.some((v) => v.id === savedView) ? savedView : visibleViews[0]?.id}
        onTabChange={(id) => setParam('widok', id)}
        onSearch={handleSearch}
        searchValue={query}
        viewModes={['table']}
        filterControls={
          hiddenViews.length ? (
            <MoreTabsMenu
              items={hiddenViews}
              activeId={savedView}
              onSelect={(id) => setParam('widok', id)}
              label={t('caseWorkspace.list.moreViews.label', 'More')}
              ariaLabel={t('caseWorkspace.list.moreViews.ariaLabel', 'More order list views')}
            />
          ) : undefined
        }
        chips={statusChips}
        activeChip={statusChip ?? 'wszystkie'}
        onChipChange={(id) => setParam('status', id === 'wszystkie' ? null : id)}
      >
        <div className="mx-auto min-w-0 max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6">
          {/* Wynik ostatniej komendy — nad tabelą, żeby był widoczny bez szukania. */}
          <CommandBanner
            notice={notice}
            onRefresh={() => {
              setNotice(null);
              load();
            }}
            onDismiss={() => setNotice(null)}
          />
          {stateBlock ? (
            <div className="rounded-xl border border-c-border bg-c-surface">{stateBlock}</div>
          ) : null}
          {!loading && !failure && visible.length > 0 ? (
            <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-c-border bg-c-surface lg:h-[calc(100vh-260px)] lg:min-h-[420px] lg:flex-row">
              <div className="min-w-0 flex-1 overflow-auto p-2 sm:pl-4 sm:pr-1.5 sm:pt-3">
                <StandardTable
                  columns={columns}
                  data={rows}
                  selectedRowId={selectedId}
                  onRowClick={(row) => {
                    jedenPanel.otworz();
                    setSelectedId(String(row.id));
                  }}
                  onRowDoubleClick={(row) => openCase(String(row.id))}
                  rowDescription={() => null}
                  defaultSort={{ columnId: 'aktywnosc', direction: 'desc' }}
                  // Osobny klucz na telefon — inny zestaw kolumn nie może
                  // dziedziczyć zapamiętanego układu z widoku szerokiego.
                  persistKey={
                    isNarrow ? 'caseWorkspace.cases.list.mobile' : 'caseWorkspace.cases.list'
                  }
                  density="compact"
                  /*
                   * ★ ZMIERZONE przy 320 px: tabela dostawała zahardkodowane
                   * 980 px w kontenerze 244 px → 736 px poziomego przewijania
                   * UKRYTEGO wewnątrz tabeli. Metryka strony była czysta
                   * (`documentElement.scrollWidth === innerWidth`), ale nazwa
                   * zlecenia i status urywały się w połowie („Elkomtech — wybór
                   * dostawcy system…"). Litera warunku właściciela spełniona,
                   * duch złamany.
                   *
                   * `'columns'` (nie `'auto'`) — próg liczy WIDOCZNE kolumny
                   * danych: telefon deklaruje jedną → min-width znika; widok
                   * szeroki ma ich sześć → 980 px zostaje bez zmian. Kanon
                   * `StandardTable` nietknięty: moduł deklaruje treść i próg,
                   * komponent dalej narzuca wygląd.
                   */
                  minTableWidth="columns"
                  empty={{
                    icon: FolderOpen,
                    title: t('caseWorkspace.list.empty.tableEmptyTitle', 'No orders in this view'),
                    description: t('caseWorkspace.list.empty.tableEmptyDescription', 'Change the tab or clear the filters.'),
                  }}
                  rowMenu={rowMenu}
                />
              </div>
              <JedenPrawyPanel rekord={selected ? (
                  <StandardPreview
                    title={nazwaZlecenia(selected, naming[selected.caseId], t)}
                    onClose={() => setSelectedId(null)}
                    onOpenFull={() => openCase(selected.caseId)}
                    openLabel={t('caseWorkspace.list.preview.openOrder', 'Open order')}
                    meta={{
                      pills: [
                        { label: caseStatusLabel(selected.caseStatus, true), tone: 'info' },
                        { label: caseProfileLabel(selected.caseProfile, true), tone: 'neutral' },
                      ],
                      trailing: (
                        <span className="text-xs text-c-text-muted">
                          {relativeDays(selected.updatedAt, t)}
                        </span>
                      ),
                      recommendation: nextActionOf(selected, t),
                    }}
                    details={{
                      text:
                        podtytulZlecenia(selected, naming[selected.caseId], t) ||
                        t('caseWorkspace.list.preview.goalOutcomeUndescribed', 'Goal and expected outcome were not described.'),
                      showWordCount: false,
                      propertyLabel: t('caseWorkspace.list.preview.propertyLabel', 'Property'),
                      valueLabel: t('caseWorkspace.list.preview.valueLabel', 'Value'),
                      properties: previewProperties,
                    }}
                    whatsNext={{
                      label: t('caseWorkspace.list.preview.whatsNextLabel', "What's next"),
                      note: t('caseWorkspace.list.preview.whatsNextNote', 'Opens the order on the selected tab.'),
                      items: previewNextItems,
                    }}
                  />
              ) : null} />
            </div>
          ) : null}
        </div>
      </StandardModuleBar>
      {commandDialogCopy ? (
        <CommandDialog
          open
          title={commandDialogCopy.title}
          description={commandDialogCopy.description}
          confirmLabel={commandDialogCopy.confirmLabel}
          reason={commandDialogCopy.reason}
          busy={commandBusy}
          onConfirm={(reason) => {
            void runPendingCommand(reason);
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  );
};

export default CasesListScreen;
