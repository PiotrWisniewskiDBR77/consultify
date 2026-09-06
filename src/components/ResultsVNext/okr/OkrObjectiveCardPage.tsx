/**
 * `/results/okr/:objectiveId` — POZIOM 2 czteropoziomowej formuły OKR:
 * KARTA CELU jako JEDNA KARTA N.
 *
 * ── POWÓD ISTNIENIA (odrzucenie właściciela 2026-09-05) ─────────────────────
 * Ekran `cel-jedna-karta` został ZATWIERDZONY (pakiet odbioru `08-wyniki`,
 * ocena A, decyzja „ok”) — ale wyłącznie jako PROTOTYP w harnessie
 * (`dev-render/screens/cel-jedna-karta.tsx`, wpis nosił wprost adnotację
 * „PROTOTYP do Twojej decyzji — zero zmian w tym, co widzi dziś użytkownik”).
 * W aplikacji nie było ani jednej trasy, która by go pokazywała
 * (`08-wyniki/wyniki.json` → `cel-jedna-karta` = `BRAK_W_APLIKACJI`). Ten plik
 * przenosi zatwierdzoną formułę na PRODUKCYJNĄ powierzchnię, na REALNYCH
 * danych z API OKR — zero danych pokazowych na ścieżce produkcyjnej.
 *
 * Cytat właściciela o poziomach: „Tutaj mamy tabelę, pod nią kartę, piętro
 * niżej – zbiór kart, a poniżej kolejna karta." Ścieżka poziomów:
 * `okrObjectiveCardPath.ts`.
 *
 * ── SKĄD SIĘ TU WCHODZI ────────────────────────────────────────────────────
 * Rejestr `/results/okr` listuje ZESTAWY OKR (`OkrSetDto`), nie cele — to nie
 * jest założenie, tylko zmierzony kształt backendu: NIE MA trasy „wszystkie
 * cele organizacji”, `GET .../objectives` wymaga `setId`
 * (`ResultsOkrHub.tsx`/`OkrObjectivesView.tsx` opisują to szczegółowo).
 * Dlatego ścieżka poziomów brzmi „Rejestr OKR › <zestaw> › <cel>”: wiersz
 * rejestru otwiera cele zestawu, a wiersz celu (dwuklik / kebab / podgląd)
 * otwiera TĘ kartę. Nie udajemy trasy, której backend nie ma.
 *
 * ── POWŁOKA ────────────────────────────────────────────────────────────────
 * Te same wspólne cegiełki SPEC-A co karta ROI i karta KPI: `ArtifactBreadcrumb`
 * (element ㉛ Menu 1) + `NModeShell` (pigułka statusu w nagłówku) +
 * `ArtifactRightPanel` + `ArtifactPropertiesTable`. Zero własnego layoutu,
 * zero własnej tabeli, wyłącznie tokeny `c-*`.
 *
 * ── UCZCIWOŚĆ DANYCH ───────────────────────────────────────────────────────
 *  - `progress`/`confidence` idą przez `parseOkrObjectiveProgress`/
 *    `parseOkrObjectiveConfidence` i `HonestValueCell`: brak wartości to „—”,
 *    a `not_calculable:` to WPROST „nie da się policzyć”, nigdy 0%.
 *  - Sekcja „Refleksja” pokazuje REALNE przeglądy zestawu
 *    (`listOkrSetReviews`) — komentarze przypięte do TEGO celu plus werdykt
 *    przeglądu. Gdy przeglądu nie ma, mówi to wprost; nie generuje narracji.
 *  - Sekcja „Powiązania” pokazuje REALNE wyrównania (`/alignments`), w obu
 *    kierunkach, oraz zestaw-rodzica. Nic ponad to nie istnieje w API.
 *  - Cel bez Kluczowych Rezultatów dostaje uczciwy stan pusty z drogą dalej,
 *    nigdy wymyślonego KR-a.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  Compass,
  Flag,
  Gauge,
  Link2,
  ListChecks,
  Settings2,
  Target,
  TrendingUp,
} from 'lucide-react';

import { EmptyState } from '@/components/shared/states';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import { NModeMenu2 } from '@/components/shared/NModeLayout/NModeMenu2';
import { SectionsManagerMenu } from '@/components/shared/NModeLayout/NModeCardManager';
import { NCardAIAnalysisPanel } from '@/components/shared/NModeLayout/NCardAIAnalysisPanel';
import { useCardAIAnalysis } from '@/components/shared/NModeLayout/useCardAIAnalysis';
import { useCardLayout } from '@/components/shared/NModeLayout/useCardLayout';
import type { CardAnalysisChange, CardAnalysisField } from '@/services/cardAnalysis';
import { PracujZAI } from '@/components/standard/PracujZAI';
import type { ZrodloUzupelnienia } from '@/components/standard/PracujZAI.types';
import { NModeContentBlock } from '@/components/shared/NModeLayout/NModeContentBlock';
import type { NModeHeaderConfig, NModeSection } from '@/components/shared/NModeLayout/types';
import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ArtifactRightPanel, type ArtifactRightPanelSection } from '@/components/standard/ArtifactRightPanel';
import { StatusChip } from '@/components/ui/primitives';

import { HonestValueCell } from '../HonestValue';
import {
  KartaWynikowChrome,
  PasekZapisuAI,
  useZapisPolAI,
  zbudujSpecSekcji,
} from '../shared/kartaWynikow';
import { ResultsVNextForbiddenState } from '../ResultsVNextForbiddenState';
import type { ResultsVNextForbiddenDetail } from '../types';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import { memberNameOrUnknown, useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';
import { getOkrSet, type OkrSetDto } from './okrApi';
import { getOkrCycle, type OkrCycleDto } from './okrAdminApi';
import { listCheckIns, type OkrCheckInDto } from './okrCheckInApi';
import { OKR_CHECKIN_STATUS_TONE, okrCheckInStatusLabel } from './okrCheckInMappers';
import {
  getObjectiveWithKeyResults,
  newOkrIdempotencyKey,
  updateObjective,
  type OkrKeyResultDto,
  type OkrObjectiveWithKeyResultsDto,
  type UpdateOkrObjectiveInput,
} from './okrObjectiveApi';
import {
  getOkrCheckInSetLock,
  getOkrSetChildEditLock,
  formatOkrDate,
  formatOkrNumeric,
  formatOkrProgressPercent,
  OKR_KEY_RESULT_STATUS_TONE,
  OKR_OBJECTIVE_HEADER_STATUS_TONE,
  okrKeyResultDirectionLabel,
  okrKeyResultStatusLabel,
  okrObjectiveAmbitionLabel,
  okrObjectiveConfidenceLabel,
  okrObjectiveStatusLabel,
  parseOkrKeyResultProgress,
  parseOkrNumericField,
  parseOkrObjectiveConfidence,
  parseOkrObjectiveProgress,
} from './okrObjectiveMappers';
import { okrSetStatusLabel } from './okrRegistryMappers';
import {
  listAlignmentsForObjective,
  listOkrSetReviews,
  type OkrAlignmentDto,
  type OkrReviewDto,
} from './okrWorkspaceApi';
import {
  OKR_OBJECTIVE_CARD_DEFAULT_SECTION,
  OKR_OBJECTIVE_CARD_SECTIONS,
  isOkrObjectiveCardSectionId,
  type OkrObjectiveCardSectionId,
} from './OkrObjectiveCardSections';
import { withOwnerSampleData } from './okrObjectiveCardPath';
import {
  okrObjectiveCardInReportPath,
  okrReportPath,
  OKR_REPORT_REGISTRY_PATH,
} from './p7k/okrReportPaths';
import {
  listCheckInOccurrences,
  newOkrCheckInIdempotencyKey,
  OkrCheckInApiError,
  recordCheckIn,
  suggestNextCheckInValue,
  type OkrCheckInOccurrenceOption,
  type OkrSuggestNextCheckInValue,
  type RecordOkrCheckInInput,
} from './okrCheckInApi';
import {
  OkrCheckInRecordDialog,
  type OkrCheckInRecordFormValues,
} from './OkrCheckInRecordDialog';
import {
  OKR_CARD_LINK_CLASS,
  OKR_TONE_TEXT_CLASS,
  OkrBullets,
  OkrKeyValueGrid,
  OkrProgressBar,
  OkrStatTile,
  type OkrCardTone,
} from './okrCardPrimitives';

/** `OkrStatusTone` (5 wartości) → ton prymitywów karty (4 wartości). `info` to
 * u nas stan neutralny — kolor koduje wyłącznie sygnał, nie kategorię. */
export function okrToneToCardTone(tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'): OkrCardTone {
  return tone === 'info' ? 'neutral' : tone;
}

/** Etykieta parametru URL niosącego aktywną sekcję (ta sama nazwa co
 * w zatwierdzonym prototypie — adres jest podlinkowalny i przeżywa F5). */
export const OKR_CARD_SECTION_PARAM = 'sekcja';

const NULL_TEXT = '—';

/**
 * Lewa krawędź bloku kluczowego rezultatu (SSOT §3). Kolor koduje WYŁĄCZNIE
 * sygnał: czerwień tylko dla krytycznego, bursztyn dla zagrożenia, zieleń
 * jako cienka kreska „idzie dobrze", neutralny dla reszty. Ani jednego
 * `primary-*` — w tym repo `primary` to crimson (kanon UI #3).
 */
const KR_EDGE_CLASS: Record<OkrCardTone, string> = {
  neutral: 'border-l-c-border',
  success: 'border-l-c-success',
  warning: 'border-l-c-warning',
  danger: 'border-l-c-danger',
};

/**
 * Etykiety sekcji biorą się WYŁĄCZNIE z kontraktu `OkrObjectiveCardSections.ts`
 * (jedno źródło prawdy o kolejności i nazwach) — komponent nie ma własnej
 * drugiej listy, która mogłaby po cichu odjechać od zatwierdzonego obrazu.
 */
function sectionMeta(id: OkrObjectiveCardSectionId): { label: { pl: string; en: string }; title: { pl: string; en: string } } {
  const def = OKR_OBJECTIVE_CARD_SECTIONS.find((section) => section.id === id);
  if (!def) throw new Error(`Unknown OKR objective card section: ${id}`);
  return { label: def.label, title: def.title };
}

function progressPct(value: number): number {
  return Math.round(value * 1000) / 10;
}

export const OkrObjectiveCardPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  // P7K część A — karta celu żyje POD raportem:
  // `/results/okr/:setId/objectives/:objectiveId`. `setId` z adresu ma
  // pierwszeństwo nad `objective.setId`, bo okruszek musi wiedzieć, z
  // którego raportu przyszliśmy, ZANIM cel się wczyta.
  const { objectiveId, setId: routeSetId } = useParams<{ objectiveId: string; setId?: string }>();
  const enabled = isResultsVNextFlagEnabled('okrRegistry');

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get(OKR_CARD_SECTION_PARAM);
  const activeSection = isOkrObjectiveCardSectionId(sectionParam)
    ? sectionParam
    : OKR_OBJECTIVE_CARD_DEFAULT_SECTION;
  const setActiveSection = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      params.set(OKR_CARD_SECTION_PARAM, next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const resolveMemberNameRaw = useOrganizationMemberNames();
  const resolveMemberName = useCallback(
    (userId: string | null | undefined): string => memberNameOrUnknown(resolveMemberNameRaw, userId, isPolish),
    [resolveMemberNameRaw, isPolish]
  );

  const [objective, setObjective] = useState<OkrObjectiveWithKeyResultsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);

  const [parentSet, setParentSet] = useState<OkrSetDto | null>(null);
  const [cycle, setCycle] = useState<OkrCycleDto | null>(null);
  const [alignments, setAlignments] = useState<OkrAlignmentDto[] | 'loading'>('loading');
  const [alignmentsError, setAlignmentsError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<OkrReviewDto[] | 'loading'>('loading');
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<Record<string, OkrCheckInDto[]>>({});

  // ── Check-in NA BLOKU rezultatu (P7K, SSOT §3) ──────────────────────────
  // Karta celu jest jedynym miejscem, z którego rezultat da się dziś
  // zaktualizować (osobnej strony rezultatu nie ma), więc formularz
  // check-inu musi być TUTAJ, a nie „gdzieś w zestawie".
  const [checkInTarget, setCheckInTarget] = useState<OkrKeyResultDto | null>(null);
  const [checkInSuggestion, setCheckInSuggestion] = useState<
    OkrSuggestNextCheckInValue | null | undefined
  >(undefined);
  const [checkInOccurrences, setCheckInOccurrences] = useState<
    OkrCheckInOccurrenceOption[] | undefined
  >(undefined);
  const [checkInOccurrencesError, setCheckInOccurrencesError] = useState<string | null>(null);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInConflict, setCheckInConflict] = useState(false);

  /** `?rezultat=<id>` — wejście z wiersza tabeli poziomu 2 podświetla TEN
   * rezultat w sekcji, zamiast otwierać dla niego osobną stronę. */
  const highlightedKeyResultId = searchParams.get('rezultat');

  const openCheckIn = useCallback(
    (keyResult: OkrKeyResultDto) => {
      setCheckInError(null);
      setCheckInConflict(false);
      setCheckInSuggestion(undefined);
      setCheckInOccurrences(undefined);
      setCheckInOccurrencesError(null);
      setCheckInTarget(keyResult);
      suggestNextCheckInValue(keyResult.keyResultId)
        .then(setCheckInSuggestion)
        .catch(() => setCheckInSuggestion(null));
      listCheckInOccurrences(keyResult.keyResultId)
        .then(setCheckInOccurrences)
        .catch((err) => {
          setCheckInOccurrences([]);
          setCheckInOccurrencesError(toUserFacingErrorMessage(err, isPolish));
        });
    },
    [isPolish]
  );

  const loadObjective = useCallback(async () => {
    if (!objectiveId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const record = await getObjectiveWithKeyResults(objectiveId);
      if (!record) {
        // `GET /objectives/:id` zwraca to samo 404 dla „nie istnieje" i dla
        // „nie widzisz" — nie zgadujemy który (D06/D07, fail-closed).
        setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        setObjective(null);
        return;
      }
      setForbidden(null);
      setObjective(record);
    } catch (err) {
      setLoadError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setLoading(false);
    }
  }, [isPolish, objectiveId]);

  useEffect(() => {
    if (!enabled) return;
    void loadObjective();
  }, [enabled, loadObjective]);

  const setId = routeSetId ?? objective?.setId ?? null;

  useEffect(() => {
    if (!enabled || !setId) return;
    getOkrSet(setId)
      .then(setParentSet)
      .catch(() => setParentSet(null));
  }, [enabled, setId]);

  const cycleId = parentSet?.cycleId ?? null;
  useEffect(() => {
    if (!enabled || !cycleId) {
      setCycle(null);
      return;
    }
    getOkrCycle(cycleId)
      .then(setCycle)
      .catch(() => setCycle(null));
  }, [enabled, cycleId]);

  useEffect(() => {
    if (!enabled || !objectiveId) return;
    setAlignments('loading');
    setAlignmentsError(null);
    Promise.all([
      listAlignmentsForObjective(objectiveId, 'outgoing'),
      listAlignmentsForObjective(objectiveId, 'incoming'),
    ])
      .then(([outgoing, incoming]) => setAlignments([...outgoing, ...incoming]))
      .catch((err) => {
        setAlignments([]);
        setAlignmentsError(toUserFacingErrorMessage(err, isPolish));
      });
  }, [enabled, isPolish, objectiveId]);

  useEffect(() => {
    if (!enabled || !setId) return;
    setReviews('loading');
    setReviewsError(null);
    listOkrSetReviews(setId)
      .then(setReviews)
      .catch((err) => {
        setReviews([]);
        setReviewsError(toUserFacingErrorMessage(err, isPolish));
      });
  }, [enabled, isPolish, setId]);

  const keyResults = useMemo<OkrKeyResultDto[]>(() => objective?.keyResults ?? [], [objective]);

  useEffect(() => {
    if (!enabled || keyResults.length === 0) return;
    let cancelled = false;
    Promise.all(
      keyResults.map((kr) =>
        listCheckIns(kr.keyResultId)
          .then((list) => [kr.keyResultId, list] as const)
          .catch(() => [kr.keyResultId, [] as OkrCheckInDto[]] as const)
      )
    ).then((pairs) => {
      if (cancelled) return;
      setCheckIns(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, keyResults]);

  const handleCheckInSubmit = useCallback(
    (values: OkrCheckInRecordFormValues) => {
      if (!checkInTarget) return;
      setCheckInBusy(true);
      setCheckInError(null);
      setCheckInConflict(false);
      const input: RecordOkrCheckInInput = {
        ...values,
        idempotencyKey: newOkrCheckInIdempotencyKey(),
      };
      recordCheckIn(checkInTarget.keyResultId, input)
        .then(() => {
          setCheckInTarget(null);
          // Check-in zmienia wartość bieżącą, postęp rezultatu I postęp celu
          // (rollup po stronie serwera) — przeładowujemy cel, zamiast
          // domalowywać nową wartość lokalnie.
          void loadObjective();
        })
        .catch((err) => {
          setCheckInConflict(err instanceof OkrCheckInApiError && err.status === 409);
          setCheckInError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setCheckInBusy(false));
    },
    [checkInTarget, loadObjective, isPolish]
  );

  const goToRegistry = useCallback(
    () => navigate({ pathname: OKR_REPORT_REGISTRY_PATH, search: window.location.search }),
    [navigate]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // [ODMROZENIE 16_GLOBAL_STANDARDS DEC-422] KARTA N CELU OKR — Menu 5,
  // „Pracuj z AI", przyklejone nagłówki.
  //
  // SŁOWA WŁAŚCICIELA (06.09.2026, otwarta karta celu): „dokładnie te same
  // uwagi" co przy karcie miernika — brak drugiego i trzeciego menu, brak
  // przycisku „Work with AI", brak zarządzania kartą.
  //
  // SSOT: docs/ssot/STEROWANIE_KART_N_I_AI.md (zasady 2, 2b, 3).
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * ZASADA 2b — prawo edycji celu. Karta NIE ma własnego sprawdzenia roli
   * (grep `canEdit|readOnly` 06.09.2026 = 0 trafień), ale ma bramkę cyklu
   * życia, którą już dziś czyta jej rodzeństwo: `getOkrSetChildEditLock`
   * (`okrObjectiveMappers.ts` — biała lista `draft`/`changes_requested`,
   * serwerowy kod `SET_NOT_EDITABLE`). Cele pod zestawem w innym statusie są
   * zablokowane do EDYCJI TREŚCI i to jest właśnie prawo, którego szuka
   * Zasada 2b. Dopóki zestaw się nie wczyta, traktujemy kartę jak zamkniętą
   * (fail-closed) — nie zgadujemy uprawnienia.
   */
  const blokadaEdycji = parentSet ? getOkrSetChildEditLock(parentSet.status) : null;
  const mozeEdytowac = !!parentSet && !blokadaEdycji && objective?.status !== 'cancelled';

  const [readMode, setReadMode] = useState(true);
  useEffect(() => {
    setReadMode(!mozeEdytowac);
  }, [mozeEdytowac]);

  /** `rowVersion` po ostatnim zapisie — komenda CAS podnosi ją przy każdym PATCH. */
  const wersjaRef = React.useRef<number | null>(null);
  useEffect(() => {
    wersjaRef.current = objective?.rowVersion ?? null;
  }, [objective?.rowVersion]);

  /**
   * Pola celu, do których backend REALNIE potrafi zapisać.
   * `UpdateOkrObjectiveInput` przyjmuje `title`/`description`/`rationale`/
   * `ambitionType`/`ownerUserId`. Uzupełniamy WYŁĄCZNIE dwa pola prozy
   * (opis i uzasadnienie): tytuł jest tożsamością rekordu widoczną na
   * listach, a ambicja i właściciel to WYBORY, nie tekst do napisania.
   */
  const POLA_CELU: Record<string, 'description' | 'rationale'> = useMemo(
    () => ({ description: 'description', rationale: 'rationale' }),
    []
  );

  const zapiszPoleCelu = useCallback(
    async (poleId: string, wartosc: string) => {
      const klucz = POLA_CELU[poleId];
      const wersja = wersjaRef.current;
      if (!klucz) throw Object.assign(new Error('FIELD_NOT_WRITABLE'), { code: 'FIELD_NOT_WRITABLE' });
      if (!objectiveId || wersja === null) {
        throw Object.assign(new Error('NO_OBJECTIVE_VERSION'), { code: 'NO_OBJECTIVE_VERSION' });
      }
      const patch: UpdateOkrObjectiveInput = {
        expectedVersion: wersja,
        idempotencyKey: newOkrIdempotencyKey(),
      };
      if (klucz === 'description') patch.description = wartosc;
      else patch.rationale = wartosc;
      const wynik = await updateObjective(objectiveId, patch);
      wersjaRef.current = wynik.objective.rowVersion;
      await loadObjective();
    },
    [POLA_CELU, objectiveId, loadObjective]
  );

  const zapisAI = useZapisPolAI(zapiszPoleCelu);

  /**
   * Deklaracja pól per sekcja. Zapisywalne są tylko dwa pola sekcji „Cel".
   * Sekcja „Refleksja" NIE dostaje pól zapisywalnych, mimo że jest prozą:
   * refleksja mieszka w PRZEGLĄDZIE ZESTAWU (`listOkrSetReviews`), a nie
   * w celu — nie ma trasy „zapisz refleksję dla tego celu". Zgłoszone
   * w meldunku; udawanie zapisu byłoby obietnicą bez pokrycia.
   */
  const okrPolaSekcji = useCallback(
    (sekcjaId: string): CardAnalysisField[] => {
      if (!objective) return [];
      if (sekcjaId === 'cel') {
        return [
          {
            id: 'description',
            label: isPolish ? 'Co chcemy osiągnąć' : 'What we want to achieve',
            value: objective.description ?? '',
            kind: 'text',
            writable: mozeEdytowac,
            hint: isPolish
              ? 'Zmiana stanu organizacji, którą widać po zakończeniu cyklu.'
              : 'The change of state visible when the cycle ends.',
          },
          {
            id: 'rationale',
            label: isPolish ? 'Dlaczego ten cel' : 'Why this objective',
            value: objective.rationale ?? '',
            kind: 'text',
            writable: mozeEdytowac,
            hint: isPolish
              ? 'Powód, dla którego ten cel jest ważniejszy od innych w tym cyklu.'
              : 'Why this objective outranks the others in this cycle.',
          },
          {
            id: 'title',
            label: isPolish ? 'Tytuł celu' : 'Objective title',
            value: objective.title,
            kind: 'text',
            writable: false,
          },
        ];
      }
      if (sekcjaId === 'kluczowe-rezultaty') {
        return keyResults.map((kr) => ({
          id: `kr-${kr.keyResultId}`,
          label: kr.title,
          value: [kr.startValue, kr.targetValue, kr.currentValue]
            .map((v) => (v === null || v === undefined ? '—' : String(v)))
            .join(' → '),
          kind: 'text' as const,
          writable: false,
        }));
      }
      return [];
    },
    [objective, keyResults, mozeEdytowac, isPolish]
  );

  const SEKCJE_Z_POLAMI_TEKSTOWYMI = useMemo(() => new Set(['cel']), []);

  const okrWritableFieldIds = useMemo(
    () => (mozeEdytowac ? Object.keys(POLA_CELU) : []),
    [mozeEdytowac, POLA_CELU]
  );

  const okrApplyChange = useCallback(
    (change: CardAnalysisChange): boolean => {
      if (!mozeEdytowac || readMode) return false;
      if (!POLA_CELU[change.fieldId]) return false;
      return zapisAI.zastosuj(change.fieldId, change.proposedValue);
    },
    [mozeEdytowac, readMode, POLA_CELU, zapisAI]
  );

  const okrCardAnalysis = useCardAIAnalysis({
    activeCardId: activeSection,
    buildInput: () => ({
      artifactType: 'objective',
      cardId: activeSection,
      artifactTitle: objective?.title ?? '',
      artifactContext: [
        objective ? `Status celu: ${objective.status}` : '',
        objective ? `Ambicja: ${objective.ambitionType}` : '',
        parentSet ? `Zestaw OKR: ${parentSet.title} (status ${parentSet.status})` : '',
        `Kluczowe rezultaty: ${keyResults.length}`,
      ]
        .filter(Boolean)
        .join('\n'),
      fields: okrPolaSekcji(activeSection),
      isPolish,
    }),
    applyChange: okrApplyChange,
  });

  const zrodloSekcji = useMemo<ZrodloUzupelnienia>(
    () => ({
      rodzaj: 'pola',
      pola: ({ sekcjaId }) =>
        (sekcjaId ? okrPolaSekcji(sekcjaId) : [])
          .filter((f) => f.writable)
          .map((f) => ({
            id: f.id,
            etykieta: f.label,
            wartosc: String(f.value ?? ''),
            format: 'paragraph' as const,
            sekcjaId: sekcjaId ?? undefined,
            sekcjaEtykieta: isPolish ? 'Cel' : 'Objective',
          })),
      zastosuj: zapisAI.zastosuj,
    }),
    [okrPolaSekcji, isPolish, zapisAI.zastosuj]
  );

  const zrodloDokumentu = useMemo<ZrodloUzupelnienia>(
    () => ({
      rodzaj: 'pola',
      pola: () =>
        [...SEKCJE_Z_POLAMI_TEKSTOWYMI].flatMap((id) =>
          okrPolaSekcji(id)
            .filter((f) => f.writable)
            .map((f) => ({
              id: f.id,
              etykieta: f.label,
              wartosc: String(f.value ?? ''),
              format: 'paragraph' as const,
              sekcjaId: id,
              sekcjaEtykieta: isPolish ? 'Cel' : 'Objective',
            }))
        ),
      zastosuj: zapisAI.zastosuj,
    }),
    [SEKCJE_Z_POLAMI_TEKSTOWYMI, okrPolaSekcji, isPolish, zapisAI.zastosuj]
  );

  /** Menu 5 → „Sekcje": pięć sekcji 1:1 z kontraktem `OkrObjectiveCardSections`. */
  const specSekcji = useMemo(
    () =>
      zbudujSpecSekcji(
        OKR_OBJECTIVE_CARD_SECTIONS.map((sekcja) => ({
          id: sekcja.id,
          label: sekcja.label,
          ikona:
            sekcja.id === 'cel'
              ? 'Target'
              : sekcja.id === 'kluczowe-rezultaty'
                ? 'CheckSquare'
                : sekcja.id === 'check-iny'
                  ? 'TrendingUp'
                  : sekcja.id === 'powiazania'
                    ? 'Link2'
                    : 'Flag',
        })),
        { pl: 'Karta celu', en: 'Objective card' }
      ),
    []
  );
  const ukladSekcji = useCardLayout({ artifactType: 'tool', spec: specSekcji });

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-objective-card-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Karta celu OKR — jeszcze nie włączona', 'OKR objective card — not yet enabled')}
          description={t(
            'Ten ekran jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.',
            'This screen is still being built. Check back later, or ask an administrator for flag access.'
          )}
          compact
        />
      </div>
    );
  }

  if (forbidden) {
    return <ResultsVNextForbiddenState forbidden={forbidden} onBack={goToRegistry} />;
  }

  if (loading || (!objective && !loadError)) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="results-vnext-okr-objective-card-loading">
        <div className="text-sm text-c-text-muted">{t('Ładowanie karty celu…', 'Loading objective card…')}</div>
      </div>
    );
  }

  if (loadError || !objective) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-objective-card-error">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title={t('Nie udało się wczytać celu', 'Could not load the objective')}
          description={loadError ?? undefined}
          onRetry={() => void loadObjective()}
          compact
        />
      </div>
    );
  }

  const scope = `okr-objective:${objective.objectiveId}`;
  const progress = parseOkrObjectiveProgress(objective.progress, objective.progressCalcReason);
  const confidence = parseOkrObjectiveConfidence(objective.confidence, objective.confidenceCalcReason);
  const setTitle = parentSet?.title ?? t('Zestaw OKR', 'OKR set');
  const cyclePeriod = cycle
    ? `${cycle.name} (${formatOkrDate(cycle.startDate, isPolish)} – ${formatOkrDate(cycle.endDate, isPolish)})`
    : NULL_TEXT;

  const achievedCount = keyResults.filter((kr) => kr.status === 'achieved').length;
  const notAchievedCount = keyResults.filter((kr) => kr.status === 'not_achieved').length;

  // ── SEKCJA 1: CEL ────────────────────────────────────────────────────────
  const celSection: NModeSection = {
    id: 'cel',
    icon: Compass,
    ...sectionMeta('cel'),
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="flex flex-col gap-4" data-testid="okr-objective-card-section-cel">
        <NModeContentBlock
          blockId="cel-oswiadczenie"
          scope={scope}
          title={t('Co chcemy osiągnąć', 'What we want to achieve')}
          readMode
        >
          {objective.description ? (
            <p className="whitespace-pre-line text-xs leading-relaxed text-c-text-secondary">
              {objective.description}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-c-text-muted">
              {t(
                'Ten cel nie ma jeszcze opisu. Opis uzupełnia się w formularzu celu — karta nie wymyśla treści za autora.',
                'This objective has no description yet. It is filled in on the objective form — this card does not invent content for the author.'
              )}
            </p>
          )}
        </NModeContentBlock>

        <NModeContentBlock
          blockId="cel-dlaczego"
          scope={scope}
          title={t('Dlaczego to ważne teraz', 'Why it matters now')}
          readMode
        >
          {objective.rationale ? (
            <p className="whitespace-pre-line text-xs leading-relaxed text-c-text-secondary">{objective.rationale}</p>
          ) : (
            <p className="text-xs leading-relaxed text-c-text-muted">
              {t(
                'Uzasadnienie celu nie zostało zapisane.',
                'No rationale has been recorded for this objective.'
              )}
            </p>
          )}
        </NModeContentBlock>

        <NModeContentBlock blockId="cel-parametry" scope={scope} title={t('Parametry celu', 'Objective parameters')} readMode>
          <OkrKeyValueGrid
            rows={[
              { label: t('Właściciel celu', 'Objective owner'), value: resolveMemberName(objective.ownerUserId) },
              { label: t('Okres (cykl)', 'Period (cycle)'), value: cyclePeriod },
              { label: t('Zestaw OKR', 'OKR set'), value: setTitle },
              {
                label: t('Status zestawu', 'Set status'),
                value: parentSet ? okrSetStatusLabel(parentSet.status, isPolish) : NULL_TEXT,
              },
              { label: t('Ambicja', 'Ambition'), value: okrObjectiveAmbitionLabel(objective.ambitionType, isPolish) },
              {
                label: t('Status celu', 'Objective status'),
                value: okrObjectiveStatusLabel(objective.status, isPolish),
              },
              {
                label: t('Pewność', 'Confidence'),
                value: (
                  <HonestValueCell
                    isPolish={isPolish}
                    value={confidence}
                    format={(v) => okrObjectiveConfidenceLabel(v, isPolish)}
                  />
                ),
              },
              {
                label: t('Kluczowe rezultaty', 'Key results'),
                value: String(keyResults.length),
              },
            ]}
          />
        </NModeContentBlock>
      </div>
    ),
  };

  // ── SEKCJA 2: KLUCZOWE REZULTATY ─────────────────────────────────────────
  const keyResultsSection: NModeSection = {
    id: 'kluczowe-rezultaty',
    icon: ListChecks,
    ...sectionMeta('kluczowe-rezultaty'),
    hasData: keyResults.length > 0,
    alwaysShow: true,
    component: (
      <div className="flex flex-col gap-4" data-testid="okr-objective-card-section-key-results">
        <NModeContentBlock
          blockId="kr-jak-liczymy"
          scope={scope}
          title={t('Jak liczony jest postęp', 'How progress is calculated')}
          readMode
        >
          <p className="text-xs leading-relaxed text-c-text-secondary">
            {t('Postęp kluczowego rezultatu = ', 'Key result progress = ')}
            <strong className="text-c-text">
              {t('(bieżąca − startowa) ÷ (docelowa − startowa)', '(current − start) ÷ (target − start)')}
            </strong>
            {t(
              ', liczony przez silnik postępu po stronie serwera i ograniczony do przedziału 0–100%. Kierunek pomiaru („rośnie" / „maleje" / „utrzymanie zakresu") jest kolumną kontraktu każdego rezultatu. Gdy wartości kontraktu nie da się policzyć, karta pisze to wprost zamiast pokazywać zero.',
              ', calculated by the server-side progress engine and clamped to 0–100%. The measurement direction ("increase" / "decrease" / "maintain range") is part of each key result contract. When a value cannot be calculated, this card says so instead of showing zero.'
            )}
          </p>
          {/* P7K: poziomy OKR są TRZY. „Piętra niżej" nie ma — kluczowy
              rezultat jest BLOKIEM tej sekcji, a nie osobną stroną
              (SSOT §1, korekta P7K §6). */}
          <p className="mt-2 text-[11px] text-c-text-muted">
            {t(
              'Każdy kluczowy rezultat jest blokiem poniżej — z własnym check-inem. Osobnej strony rezultatu nie ma.',
              'Every key result is a block below — with its own check-in. There is no separate key result page.'
            )}
          </p>
        </NModeContentBlock>

        {keyResults.length === 0 ? (
          <EmptyState
            variant="new"
            icon={ListChecks}
            title={t('Ten cel nie ma jeszcze kluczowych rezultatów', 'This objective has no key results yet')}
            description={t(
              'Cel bez kluczowych rezultatów nie ma czym mierzyć postępu. Dodaj pierwszy rezultat w widoku „Kluczowe Rezultaty" zestawu OKR.',
              'An objective with no key results has nothing to measure progress with. Add the first one in the OKR set "Key Results" view.'
            )}
            compact
          />
        ) : (
          keyResults.map((kr, index) => {
            const krProgress = parseOkrKeyResultProgress(kr.progress, kr.progressCalcReason);
            const tone = okrToneToCardTone(OKR_KEY_RESULT_STATUS_TONE[kr.status]);
            const start = parseOkrNumericField(kr.startValue);
            const target = parseOkrNumericField(kr.targetValue);
            const current = parseOkrNumericField(kr.currentValue);
            return (
              /* SSOT §3: rezultat zagrożony ma bursztynowy, krytyczny czerwony
                 AKCENT NA LEWEJ KRAWĘDZI bloku — kolor niesie sygnał, nie
                 kategorię, i nigdy nie wypełnia bloku (kanon UI #3). */
              <div
                key={kr.keyResultId}
                className={`overflow-hidden rounded-xl border-l-4 ${KR_EDGE_CLASS[tone]} ${
                  highlightedKeyResultId === kr.keyResultId
                    ? 'ring-2 ring-c-focus ring-offset-1 ring-offset-c-app'
                    : ''
                }`}
                data-testid={`okr-objective-card-kr-block-${kr.keyResultId}`}
              >
              <NModeContentBlock
                blockId={`kr-${kr.keyResultId}`}
                scope={scope}
                title={`KR${index + 1} — ${kr.title}`}
                readMode
              >
                <div className="flex flex-col gap-3" data-testid={`okr-objective-card-kr-${kr.keyResultId}`}>
                  <p className="text-[11px] text-c-text-muted">
                    {t('Właściciel: ', 'Owner: ')}
                    {resolveMemberName(kr.ownerUserId)}
                    {' · '}
                    {t('Zespół: ', 'Team: ')}
                    {kr.teamName ?? NULL_TEXT}
                    {' · '}
                    {t('Termin: ', 'Deadline: ')}
                    {kr.deadline ? formatOkrDate(kr.deadline, isPolish) : NULL_TEXT}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <OkrStatTile
                      label={t('Start', 'Start')}
                      icon={Gauge}
                      value={
                        <HonestValueCell
                          isPolish={isPolish}
                          value={start}
                          format={(v) => formatOkrNumeric(v, isPolish, kr.unit)}
                        />
                      }
                      sub={okrKeyResultDirectionLabel(kr.direction, isPolish)}
                    />
                    <OkrStatTile
                      label={t('Cel', 'Target')}
                      icon={Target}
                      value={
                        <HonestValueCell
                          isPolish={isPolish}
                          value={target}
                          format={(v) => formatOkrNumeric(v, isPolish, kr.unit)}
                        />
                      }
                    />
                    <OkrStatTile
                      label={t('Bieżąca', 'Current')}
                      icon={TrendingUp}
                      tone={tone}
                      value={
                        <HonestValueCell
                          isPolish={isPolish}
                          value={current}
                          format={(v) => formatOkrNumeric(v, isPolish, kr.unit)}
                        />
                      }
                      sub={formatOkrDate(kr.updatedAt, isPolish)}
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-c-text-muted">
                      <span>{t('Postęp', 'Progress')}</span>
                      <span className="font-semibold">
                        <HonestValueCell
                          isPolish={isPolish}
                          value={krProgress}
                          notCalculableReason={kr.progressCalcReason ?? undefined}
                          format={(v) => (
                            <span className={OKR_TONE_TEXT_CLASS[tone]}>
                              {formatOkrProgressPercent(v, isPolish)} · {okrKeyResultStatusLabel(kr.status, isPolish)}
                            </span>
                          )}
                        />
                      </span>
                    </div>
                    <OkrProgressBar
                      pct={typeof krProgress === 'number' ? progressPct(krProgress) : 0}
                      tone={tone}
                    />
                  </div>
                  {kr.description ? (
                    <p className="text-[11px] leading-relaxed text-c-text-muted">{kr.description}</p>
                  ) : null}
                  {/* Check-in NA BLOKU (SSOT §3: „przycisk »Check-in« na
                      bloku"). Zapisuje przez `recordCheckIn` — realny wpis,
                      nie atrapa. Gdy zestaw nie jest aktywny, przycisk nadal
                      działa, a okno mówi DLACZEGO nie da się zapisać
                      (TRIADA §C3), zamiast milczeć. */}
                  <div>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-lg border border-c-border px-3 text-xs font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      data-testid={`okr-objective-card-checkin-${kr.keyResultId}`}
                      onClick={() => openCheckIn(kr)}
                    >
                      {t('Check-in', 'Check-in')}
                    </button>
                  </div>
                </div>
              </NModeContentBlock>
              </div>
            );
          })
        )}
      </div>
    ),
  };

  // ── SEKCJA 3: POSTĘP ─────────────────────────────────────────────────────
  const allCheckIns = keyResults
    .flatMap((kr) => (checkIns[kr.keyResultId] ?? []).map((entry) => ({ kr, entry })))
    .sort((a, b) => (a.entry.submittedAt < b.entry.submittedAt ? 1 : -1));

  const progressSection: NModeSection = {
    id: 'check-iny',
    icon: TrendingUp,
    ...sectionMeta('check-iny'),
    hasData: typeof progress === 'number' || allCheckIns.length > 0,
    alwaysShow: true,
    component: (
      <div className="flex flex-col gap-4" data-testid="okr-objective-card-section-progress">
        <NModeContentBlock blockId="postep-kafle" scope={scope} title={t('Stan celu', 'Objective state')} readMode>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OkrStatTile
              label={t('Postęp celu', 'Objective progress')}
              icon={TrendingUp}
              value={
                <HonestValueCell
                  isPolish={isPolish}
                  value={progress}
                  notCalculableReason={objective.progressCalcReason ?? undefined}
                  format={(v) => formatOkrProgressPercent(v, isPolish)}
                />
              }
            />
            <OkrStatTile
              label={t('Osiągnięte KR', 'Achieved KRs')}
              icon={CheckCircle2}
              tone={achievedCount > 0 ? 'success' : 'neutral'}
              value={`${achievedCount} / ${keyResults.length}`}
            />
            <OkrStatTile
              label={t('Nieosiągnięte KR', 'Not achieved KRs')}
              icon={AlertTriangle}
              tone={notAchievedCount > 0 ? 'warning' : 'neutral'}
              value={`${notAchievedCount} / ${keyResults.length}`}
            />
          </div>
          {typeof progress === 'number' ? (
            <div className="mt-3">
              <OkrProgressBar pct={progressPct(progress)} />
            </div>
          ) : null}
        </NModeContentBlock>

        <NModeContentBlock
          blockId="postep-kr"
          scope={scope}
          title={t('Postęp poszczególnych rezultatów', 'Progress per key result')}
          readMode
        >
          {keyResults.length === 0 ? (
            <p className="text-xs text-c-text-muted">
              {t('Brak kluczowych rezultatów do rozliczenia.', 'No key results to account for.')}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {keyResults.map((kr) => {
                const krProgress = parseOkrKeyResultProgress(kr.progress, kr.progressCalcReason);
                const tone = okrToneToCardTone(OKR_KEY_RESULT_STATUS_TONE[kr.status]);
                return (
                  <div key={kr.keyResultId}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                      <span className="min-w-0 truncate text-c-text">{kr.title}</span>
                      <span className="shrink-0 text-c-text-muted">
                        <HonestValueCell
                          isPolish={isPolish}
                          value={krProgress}
                          notCalculableReason={kr.progressCalcReason ?? undefined}
                          format={(v) => formatOkrProgressPercent(v, isPolish)}
                        />
                      </span>
                    </div>
                    <OkrProgressBar pct={typeof krProgress === 'number' ? progressPct(krProgress) : 0} tone={tone} />
                  </div>
                );
              })}
            </div>
          )}
        </NModeContentBlock>

        <NModeContentBlock blockId="postep-checkiny" scope={scope} title={t('Check-iny', 'Check-ins')} readMode>
          {allCheckIns.length === 0 ? (
            <p className="text-xs text-c-text-muted">
              {t(
                'Dla tego celu nie zapisano jeszcze ani jednego check-inu. Historia pojawi się, gdy właściciel rezultatu zapisze pierwszy pomiar.',
                'No check-in has been recorded for this objective yet. The history appears once a key result owner records the first measurement.'
              )}
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="okr-objective-card-checkins">
              {allCheckIns.map(({ kr, entry }) => (
                <li key={entry.checkInId} className="rounded-xl border border-c-border-subtle p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-c-text">{kr.title}</span>
                    <span className="text-[11px] tabular-nums text-c-text-muted">
                      {formatOkrDate(entry.submittedAt, isPolish)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-c-text-secondary">
                    <span className="tabular-nums">
                      <HonestValueCell
                        isPolish={isPolish}
                        value={parseOkrNumericField(entry.newValue)}
                        format={(v) => formatOkrNumeric(v, isPolish, kr.unit)}
                      />
                    </span>
                    {entry.ownerDeclaredStatus ? (
                      <StatusChip
                        label={okrCheckInStatusLabel(entry.ownerDeclaredStatus, isPolish)}
                        tone={OKR_CHECKIN_STATUS_TONE[entry.ownerDeclaredStatus]}
                      />
                    ) : null}
                    <span>{resolveMemberName(entry.submittedBy)}</span>
                  </div>
                  {entry.note ? <p className="mt-1 text-[11px] text-c-text-muted">{entry.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </NModeContentBlock>
      </div>
    ),
  };

  // ── SEKCJA 4: POWIĄZANIA ─────────────────────────────────────────────────
  const alignmentList = alignments === 'loading' ? [] : alignments;
  const relationsSection: NModeSection = {
    id: 'powiazania',
    icon: Link2,
    ...sectionMeta('powiazania'),
    hasData: alignmentList.length > 0,
    alwaysShow: true,
    component: (
      <div className="flex flex-col gap-4" data-testid="okr-objective-card-section-relations">
        <NModeContentBlock blockId="powiazania-zestaw" scope={scope} title={t('Zestaw OKR', 'OKR set')} readMode>
          <OkrBullets
            items={[
              <>
                {t('Ten cel należy do zestawu ', 'This objective belongs to the set ')}
                <button
                  type="button"
                  className={OKR_CARD_LINK_CLASS}
                  data-testid="okr-objective-card-open-set"
                  onClick={() => (setId ? navigate(`/results/okr/sets/${setId}`) : undefined)}
                >
                  {setTitle}
                </button>
                {parentSet
                  ? t(
                      ` (status: ${okrSetStatusLabel(parentSet.status, isPolish)}).`,
                      ` (status: ${okrSetStatusLabel(parentSet.status, isPolish)}).`
                    )
                  : '.'}
              </>,
              t(
                'Cykl rozliczeniowy decyduje o oknach check-inów i o tym, kiedy cel można edytować.',
                'The cycle governs check-in windows and when the objective may still be edited.'
              ) + ` ${cyclePeriod}`,
            ]}
          />
        </NModeContentBlock>

        <NModeContentBlock
          blockId="powiazania-wyrownania"
          scope={scope}
          title={t('Wyrównania (alignments)', 'Alignments')}
          readMode
        >
          {alignments === 'loading' ? (
            <p className="text-xs text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
          ) : alignmentsError ? (
            <EmptyState
              variant="error"
              icon={AlertTriangle}
              title={t('Nie udało się wczytać wyrównań', 'Could not load alignments')}
              description={alignmentsError}
              compact
            />
          ) : alignmentList.length === 0 ? (
            <p className="text-xs text-c-text-muted">
              {t(
                'Ten cel nie jest wyrównany do żadnego innego celu — ani w górę, ani w dół. Wyrównanie proponuje się z widoku „Wyrównania" zestawu.',
                'This objective is not aligned to any other objective, up or down. Alignments are proposed from the set "Alignments" view.'
              )}
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="okr-objective-card-alignments">
              {alignmentList.map((alignment) => {
                const outgoing = alignment.sourceObjectiveId === objective.objectiveId;
                const otherId = outgoing ? alignment.targetObjectiveId : alignment.sourceObjectiveId;
                return (
                  <li key={alignment.alignmentId} className="rounded-xl border border-c-border-subtle p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-c-text">
                        {outgoing
                          ? t('Ten cel wspiera cel:', 'This objective contributes to:')
                          : t('Ten cel jest wspierany przez cel:', 'This objective is supported by:')}
                      </span>
                      <StatusChip label={alignment.status} tone="neutral" />
                    </div>
                    <button
                      type="button"
                      className={`${OKR_CARD_LINK_CLASS} mt-1`}
                      onClick={() => navigate(withOwnerSampleData(`/results/okr/objectives/${otherId}`))}
                    >
                      {otherId}
                    </button>
                    {alignment.rationale ? (
                      <p className="mt-1 text-[11px] text-c-text-muted">{alignment.rationale}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </NModeContentBlock>
      </div>
    ),
  };

  // ── SEKCJA 5: REFLEKSJA ──────────────────────────────────────────────────
  const reviewList = reviews === 'loading' ? [] : reviews;
  const objectiveComments = reviewList.flatMap((review) =>
    review.comments
      .filter((comment) => comment.level === 'set' || comment.targetId === objective.objectiveId)
      .map((comment) => ({ review, comment }))
  );

  const reflectionSection: NModeSection = {
    id: 'refleksja',
    icon: Flag,
    ...sectionMeta('refleksja'),
    hasData: reviewList.length > 0,
    alwaysShow: true,
    component: (
      <div className="flex flex-col gap-4" data-testid="okr-objective-card-section-reflection">
        {reviews === 'loading' ? (
          <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
        ) : reviewsError ? (
          <EmptyState
            variant="error"
            icon={AlertTriangle}
            title={t('Nie udało się wczytać przeglądów', 'Could not load reviews')}
            description={reviewsError}
            compact
          />
        ) : reviewList.length === 0 ? (
          <EmptyState
            variant="new"
            icon={Flag}
            title={t('Nie ma jeszcze refleksji', 'No reflection yet')}
            description={t(
              'Refleksja powstaje w przeglądzie zestawu OKR (własnym lub menedżerskim) na koniec cyklu. Dla tego zestawu nie zapisano jeszcze żadnego przeglądu — karta nie pisze podsumowania za ludzi.',
              'The reflection is written in the OKR set review (self or manager) at the end of the cycle. No review has been recorded for this set yet — this card does not write the summary for people.'
            )}
            compact
          />
        ) : (
          <>
            <NModeContentBlock
              blockId="refleksja-przeglady"
              scope={scope}
              title={t('Przeglądy zestawu', 'Set reviews')}
              readMode
            >
              <ul className="flex flex-col gap-2">
                {reviewList.map((review) => (
                  <li key={review.reviewId} className="rounded-xl border border-c-border-subtle p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-c-text">
                        {review.reviewType === 'self'
                          ? t('Przegląd własny', 'Self review')
                          : t('Przegląd menedżerski', 'Manager review')}
                      </span>
                      <StatusChip label={review.status} tone="neutral" />
                    </div>
                    <p className="mt-1 text-[11px] text-c-text-muted">
                      {t('Recenzent: ', 'Reviewer: ')}
                      {resolveMemberName(review.reviewerUserId)}
                      {review.submittedAt ? ` · ${formatOkrDate(review.submittedAt, isPolish)}` : ''}
                    </p>
                    {review.outcome ? (
                      <p className="mt-1 whitespace-pre-line text-xs text-c-text-secondary">{review.outcome}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </NModeContentBlock>

            <NModeContentBlock
              blockId="refleksja-komentarze"
              scope={scope}
              title={t('Uwagi dotyczące tego celu', 'Comments on this objective')}
              readMode
            >
              {objectiveComments.length === 0 ? (
                <p className="text-xs text-c-text-muted">
                  {t(
                    'Przegląd nie zostawił ani jednej uwagi przypiętej do tego celu.',
                    'The review left no comment attached to this objective.'
                  )}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {objectiveComments.map(({ review, comment }, idx) => (
                    <li key={`${review.reviewId}-${idx}`} className="rounded-xl border border-c-border-subtle p-3">
                      <p className="whitespace-pre-line text-xs text-c-text-secondary">{comment.text}</p>
                      <p className="mt-1 text-[11px] text-c-text-muted">
                        {resolveMemberName(comment.createdBy)} · {formatOkrDate(comment.createdAt, isPolish)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </NModeContentBlock>
          </>
        )}
      </div>
    ),
  };

  const wszystkieSekcje: NModeSection[] = [
    celSection,
    keyResultsSection,
    progressSection,
    relationsSection,
    reflectionSection,
  ];
  // Widoczność i kolejność sekcji steruje Menu 5 → „Sekcje" (kanoniczny
  // `useCardLayout.applyToSections`), nie kolejność zapisana w tym pliku.
  const sections: NModeSection[] = ukladSekcji.applyToSections(wszystkieSekcje);

  // Pigułka statusu obok tytułu + tytuł „Cel — …" — 1:1 z zatwierdzonym obrazem.
  const header: NModeHeaderConfig = {
    title: `${t('Cel', 'Objective')} — ${objective.title}`,
    onTitleChange: () => {},
    titleReadOnly: true,
    statusLabel: okrObjectiveStatusLabel(objective.status, isPolish),
    statusTone: OKR_OBJECTIVE_HEADER_STATUS_TONE[objective.status],
    artifactType: 'okr',
    artifactId: objective.objectiveId,
    onSave: () => {},
    saveState: 'saved',
    onClose: goToRegistry,
  };

  const propertyRows: ArtifactPropertyRow[] = [
    { id: 'owner', label: t('Właściciel', 'Owner'), value: resolveMemberName(objective.ownerUserId) },
    { id: 'status', label: t('Status', 'Status'), value: okrObjectiveStatusLabel(objective.status, isPolish) },
    { id: 'ambition', label: t('Ambicja', 'Ambition'), value: okrObjectiveAmbitionLabel(objective.ambitionType, isPolish) },
    { id: 'set', label: t('Zestaw OKR', 'OKR set'), value: setTitle },
    { id: 'cycle', label: t('Okres', 'Period'), value: cyclePeriod },
    {
      id: 'progress',
      label: t('Postęp', 'Progress'),
      value: (
        <HonestValueCell
          isPolish={isPolish}
          value={progress}
          notCalculableReason={objective.progressCalcReason ?? undefined}
          format={(v) => formatOkrProgressPercent(v, isPolish)}
        />
      ),
    },
    {
      id: 'confidence',
      label: t('Pewność', 'Confidence'),
      value: (
        <HonestValueCell
          isPolish={isPolish}
          value={confidence}
          format={(v) => okrObjectiveConfidenceLabel(v, isPolish)}
        />
      ),
    },
    { id: 'keyResults', label: t('Kluczowe rezultaty', 'Key results'), value: String(keyResults.length) },
    { id: 'created', label: t('Utworzono', 'Created'), value: formatOkrDate(objective.createdAt, isPolish) },
    { id: 'updated', label: t('Zaktualizowano', 'Updated'), value: formatOkrDate(objective.updatedAt, isPolish) },
  ];

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('Akcje', 'Actions'),
      icon: Settings2,
      defaultOpen: true,
      children: (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-lg border border-c-border px-3 py-1.5 text-left text-xs text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            data-testid="okr-objective-card-panel-key-results"
            onClick={() => setActiveSection('kluczowe-rezultaty')}
          >
            {t('Kluczowe rezultaty i check-in', 'Key results and check-in')}
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-c-border px-3 py-1.5 text-left text-xs text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            data-testid="okr-objective-card-panel-open-report"
            onClick={() => (setId ? navigate(okrReportPath(setId)) : undefined)}
          >
            {t('Otwórz raport OKR', 'Open the OKR report')}
          </button>
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('Właściwości', 'Properties'),
      icon: ListChecks,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          rows={propertyRows}
          propertyLabel={t('Właściwość', 'Property')}
          valueLabel={t('Wartość', 'Value')}
        />
      ),
    },
    {
      id: 'relations',
      label: t('Powiązania', 'Relations'),
      icon: Link2,
      defaultOpen: false,
      isEmpty: alignmentList.length === 0,
      emptyLabel: t('Brak wyrównań', 'No alignments'),
      badge: alignmentList.length,
      children: (
        <button
          type="button"
          className={OKR_CARD_LINK_CLASS}
          onClick={() => setActiveSection('powiazania')}
        >
          {t(`${alignmentList.length} wyrównanie/wyrównania`, `${alignmentList.length} alignment(s)`)}
        </button>
      ),
    },
  ];

  // Trzy stopnie, dokładnie tyle, ile jest poziomów (P7K): raporty → raport
  // → cel. Środkowy stopień prowadzi do RAPORTU (poziom 2), nie do powłoki
  // administracyjnej zestawu — inaczej okruszek wychodziłby z formuły.
  const breadcrumbItems: { label: string; onClick?: () => void }[] = [
    { label: t('Raporty OKR', 'OKR reports'), onClick: goToRegistry },
    {
      label: setTitle,
      onClick: () => (setId ? navigate(okrReportPath(setId)) : undefined),
    },
    { label: objective.title },
  ];

  /** Kropka statusu pigułki Menu 3 — mapa ze statusu celu. */
  const statusPigulki =
    objective.status === 'cancelled'
      ? 'CANCELLED'
      : objective.status === 'completed' || objective.status === 'closed'
        ? 'DONE'
        : objective.status === 'at_risk'
          ? 'BLOCKED'
          : objective.status === 'active'
            ? 'TRACKING'
            : objective.status === 'approved'
              ? 'APPROVED'
              : objective.status === 'submitted'
                ? 'PENDING_REVIEW'
                : 'DRAFT';

  return (
    <KartaWynikowChrome
      domena="okr"
      kartaId={objective.objectiveId}
      kartaNazwa={objective.title}
      kartaOdznaka="OKR"
      kartaStatus={statusPigulki}
      onPokazListe={goToRegistry}
      testId="results-vnext-okr-objective-card-chrome"
    >
    <div className="flex h-full min-h-0 flex-col" data-testid="results-vnext-okr-objective-card-page">
      <ArtifactBreadcrumb items={breadcrumbItems} />
      <PasekZapisuAI stan={zapisAI.stan} isPolish={isPolish} onZamknij={zapisAI.wyczysc} />
      <div className="min-h-0 flex-1">
        <NModeShell
          header={header}
          sections={sections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          presentationMode="n"
          onPresentationModeChange={() => {}}
          showModeSwitcher={false}
          readMode={readMode}
          stickyStosMenu45
          renderActionBar={() => (
            <NModeMenu2
              isPolish={isPolish}
              sectionsMenu={<SectionsManagerMenu layout={ukladSekcji} isPolish={isPolish} />}
              readMode={readMode}
              onReadModeChange={mozeEdytowac ? setReadMode : undefined}
              aiButton={
                <PracujZAI
                  isPolish={isPolish}
                  onAnalizuj={okrCardAnalysis.run}
                  analizaWToku={okrCardAnalysis.loading}
                  analizaOtwarta={okrCardAnalysis.open}
                  aktywnaSekcja={activeSection}
                  kontekstArtefaktu={{
                    title: objective.title,
                    status: objective.status,
                    type: 'objective',
                  }}
                  moznaEdytowac={mozeEdytowac && !readMode}
                  powodTylkoOdczyt={
                    objective.status === 'cancelled'
                      ? isPolish
                        ? 'cel anulowany'
                        : 'objective is cancelled'
                      : blokadaEdycji
                        ? isPolish
                          ? blokadaEdycji.reason.pl
                          : blokadaEdycji.reason.en
                        : isPolish
                          ? 'karta otwarta w trybie Podgląd'
                          : 'card opened in Preview mode'
                  }
                  uzupelnijSekcje={
                    SEKCJE_Z_POLAMI_TEKSTOWYMI.has(activeSection) ? zrodloSekcji : undefined
                  }
                  uzupelnijDokument={zrodloDokumentu}
                />
              }
            />
          )}
          rightPanel={
            <ArtifactRightPanel sections={rightPanelSections} ariaLabel={t('Panel celu OKR', 'OKR objective panel')} />
          }
        />
      </div>
      <NCardAIAnalysisPanel
        open={okrCardAnalysis.open}
        onClose={okrCardAnalysis.close}
        loading={okrCardAnalysis.loading}
        result={okrCardAnalysis.result}
        errorCode={okrCardAnalysis.errorCode}
        serverErrorCode={okrCardAnalysis.serverErrorCode}
        onRerun={okrCardAnalysis.rerun}
        onApplyChange={okrCardAnalysis.applyChange}
        writableFieldIds={okrWritableFieldIds}
        readMode={readMode}
        isPolish={isPolish}
      />
      <OkrCheckInRecordDialog
        open={!!checkInTarget}
        keyResultTitle={checkInTarget?.title ?? ''}
        isPolish={isPolish}
        onClose={() => (checkInBusy ? undefined : setCheckInTarget(null))}
        onSubmit={handleCheckInSubmit}
        suggestion={checkInSuggestion}
        occurrences={checkInOccurrences}
        occurrencesError={checkInOccurrencesError}
        blockedReason={
          parentSet
            ? (() => {
                const lock = getOkrCheckInSetLock(parentSet.status);
                return lock ? (isPolish ? lock.reason.pl : lock.reason.en) : null;
              })()
            : null
        }
        busy={checkInBusy}
        errorMessage={checkInError}
        isConflict={checkInConflict}
      />
    </div>
    </KartaWynikowChrome>
  );
};

export default OkrObjectiveCardPage;
