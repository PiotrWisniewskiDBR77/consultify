/**
 * ROI (P7K C) — POZIOM 2: karta N jednej analizy ROI, trzy części.
 *
 * Trasa: `/results/roi/:roiCaseId` (`ROUTES.RESULTS_ROI.CARD`).
 * Wzorzec zaakceptowany: `evidence/p7k-wyniki/prototype/roi-l2--light.png`.
 * Źródło prawdy treści: `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` §4.
 *
 * ── WYBÓR POWŁOKI ─────────────────────────────────────────────────────────
 * `NModeShell` + `ArtifactRightPanel` BEZPOŚREDNIO, nie `StandardArtifactShell`.
 * Powód jest ten sam, który w swoim nagłówku opisuje `../../kpiTool/KpiToolPage.tsx`
 * (i `../../kpiScorecards/ResultsKpiScorecardDetailPage.tsx`): opakowanie
 * `StandardArtifactShell` wymaga `karta: KartaNKey` z ZAMKNIĘTEGO rejestru
 * (`src/components/standard/registry.ts`), w którym nie ma pozycji dla narzędzi
 * Wyników, a jego rozszerzenie należy do Platformy, nie do tej paczki.
 * `ArtifactRightPanel` — czyli realny wspólny kontrakt SPEC-A §10.2/§11.2 —
 * jest użyty bez zmian, więc reguła CLAUDE.md #6 („powłoka wspólna") jest
 * spełniona bez ruszania zamkniętego rejestru. To jest DOKŁADNIE ta sama
 * decyzja, którą już podjęły dwie siostrzane karty Wyników, a nie nowy wyjątek.
 *
 * ── TERESA ────────────────────────────────────────────────────────────────
 * DEC-419 (właściciel, 06.09.2026, karta Inicjatywy): sekcja „Teresa" (zakładka
 * z `TeresaEntryButton`, dawna odpowiedź na werdykt K8) USUNIĘTA — jedyne
 * wejście do Teresy jest teraz w Menu 1 (DEC-404). Drugie wejście z panelu
 * artefaktu było duplikatem, nie dodatkową funkcją.
 *
 * ── DLACZEGO TA KARTA NIE ZASTĘPUJE PEŁNEGO NARZĘDZIA ─────────────────────
 * `RoiCaseFullTool` (`/results/roi/cases/:roiCaseId`) niesie 17 podwidoków
 * CRUD (dodawanie pozycji, przebiegi, migawki, wykonania, PIR…). Ta karta jest
 * NARRACJĄ ANALIZY do czytania i odbioru, w trzech częściach, których żądał
 * właściciel. Wejście do pełnego narzędzia stoi w prawym panelu, w sekcji
 * Akcje — nie kasujemy zdolności, którą karta świadomie nie jest.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Blocks,
  Calculator,
  ClipboardList,
  FileText,
  Link2,
  ListChecks,
  Settings2,
  Target,
} from 'lucide-react';

import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ArtifactRightPanel, type ArtifactRightPanelSection } from '@/components/standard/ArtifactRightPanel';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import { NModeMenu2 } from '@/components/shared/NModeLayout/NModeMenu2';
import { SectionsManagerMenu } from '@/components/shared/NModeLayout/NModeCardManager';
import { NCardAIAnalysisPanel } from '@/components/shared/NModeLayout/NCardAIAnalysisPanel';
import { useCardAIAnalysis } from '@/components/shared/NModeLayout/useCardAIAnalysis';
import { useCardLayout } from '@/components/shared/NModeLayout/useCardLayout';
import type { CardAnalysisChange, CardAnalysisField } from '@/services/cardAnalysis';
import { PracujZAI } from '@/components/standard/PracujZAI';
import type { ZrodloUzupelnienia } from '@/components/standard/PracujZAI.types';
import type { NModeHeaderConfig, NModeSection } from '@/components/shared/NModeLayout/types';
import { EmptyState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives';
import { memberNameOrUnknown, useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';
import { ROUTES } from '@/routes/routeConfig';

import { ResultsVNextForbiddenState } from '../../ResultsVNextForbiddenState';
import { isResultsVNextFlagEnabled } from '../../resultsVNextFeatureFlags';
import {
  KartaWynikowChrome,
  PasekZapisuAI,
  useZapisPolAI,
  zbudujSpecSekcji,
} from '../../shared/kartaWynikow';
import type { ResultsVNextForbiddenDetail } from '../../types';
import { newRoiIdempotencyKey } from '../roiApi';
import {
  getRoiPostInvestmentReview,
  updateRoiPostInvestmentReviewDraft,
  type UpdateRoiPirDraftInput,
} from '../roiCaseFullToolApi';
import { getRoiCaseCard, type RoiCaseCard } from './roiCardApi';
import {
  BRAK,
  fmtDate,
  fmtMoney,
  fmtPercent,
  fmtYears,
  phaseLabel,
  RECOMMENDATION_LABEL,
  roiHorizonLabel,
  variantLabel,
} from './roiCardFormat';
import {
  RoiAssumptionsPart,
  RoiCalculationsPart,
  RoiRealizationPart,
} from './RoiCardSections';

/** Trzy części — kolejność jest treścią decyzji właściciela, nie preferencją. */
const SECTION_IDS = ['zalozenia', 'wyliczenia', 'realizacja'] as const;
type RoiCardSectionId = (typeof SECTION_IDS)[number];

export const RoiCaseCardPage: React.FC = () => {
  // `tr` = klucze i18n (`results.roi.card.*`, pl+en w public/locales) tam,
  // gdzie etykieta jest NAZWĄ CZĘŚCI karty i pojawia się też poza tym plikiem
  // (okruszek, nawigacja). Reszta tekstów zostaje przy `t(pl, en)` — tak samo
  // jak KpiToolPage i ResultsRoiHub obok; mieszanie dwóch mechanizmów w jednym
  // zdaniu byłoby dwiema prawdami o tym samym napisie.
  const { t: tr, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { roiCaseId } = useParams<{ roiCaseId: string }>();
  const enabled = isResultsVNextFlagEnabled('roiRegistry');
  // Hak zwraca RESOLVER (funkcję), nie obiekt z listą — destrukturyzacja
  // `{ members }` dawała `undefined`, a przez to każde nazwisko schodziło na
  // „Nieznany użytkownik". Złapane na zrzucie, nie w typach: `useCallback`
  // zwraca funkcję, więc destrukturyzacja jest legalna składniowo.
  const resolveMemberName = useOrganizationMemberNames();

  const [card, setCard] = useState<RoiCaseCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);
  const [activeSection, setActiveSection] = useState<RoiCardSectionId>('zalozenia');

  const load = useCallback(async () => {
    if (!roiCaseId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getRoiCaseCard(roiCaseId);
      if (!result) {
        // 404 z serwera nie mówi (i nie może mówić), czy sprawa nie istnieje,
        // czy jest poza widocznością — stan jest jeden, uczciwy.
        setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        setCard(null);
        return;
      }
      setForbidden(null);
      setCard(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [roiCaseId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  /** Karta otwiera się na NAJDALSZEJ wypełnionej części — tam, gdzie praca
   *  faktycznie stoi, a nie zawsze na pierwszym ekranie. */
  useEffect(() => {
    if (!card) return;
    setActiveSection(
      card.phase === 'realization' ? 'realizacja' : card.phase === 'calculations' ? 'wyliczenia' : 'zalozenia'
    );
  }, [card]);

  const goToRegistry = useCallback(
    () => navigate({ pathname: ROUTES.RESULTS_ROI.ROOT, search: window.location.search }),
    [navigate]
  );

  const ownerName = useMemo(
    () => (card ? memberNameOrUnknown(resolveMemberName, card.ownerUserId, isPolish) : BRAK),
    [card, resolveMemberName, isPolish]
  );

  const propertyRows: ArtifactPropertyRow[] = useMemo(() => {
    if (!card) return [];
    return [
      { id: 'owner', label: t('Właściciel', 'Owner'), value: ownerName },
      { id: 'subject', label: t('Przedmiot', 'Subject'), value: card.subjectType ?? BRAK },
      {
        id: 'variant',
        label: t('Wariant', 'Option'),
        value: variantLabel(card.optionVariant, card.optionVariantLabel),
      },
      {
        id: 'horizon',
        label: t('Horyzont', 'Horizon'),
        value: card.indicators.horizonYears ? `${card.indicators.horizonYears} ${t('lat', 'yrs')}` : BRAK,
        mono: true,
      },
      { id: 'currency', label: t('Waluta', 'Currency'), value: card.currency, mono: true },
      {
        id: 'discountRate',
        label: t('Stopa dyskontowa', 'Discount rate'),
        value: fmtPercent(card.calculationPolicy?.discountRatePct ?? null, isPolish, 1),
        mono: true,
      },
      { id: 'phase', label: t('Faza', 'Phase'), value: phaseLabel(card.phase, isPolish) },
      { id: 'updated', label: t('Aktualizacja', 'Updated'), value: fmtDate(card.updatedAt, isPolish), mono: true },
    ];
  }, [card, ownerName, isPolish, t]);

  const wszystkieSekcje: NModeSection[] = useMemo(() => {
    if (!card) return [];
    return [
      {
        id: 'zalozenia',
        icon: ClipboardList,
        label: {
          pl: tr('results.roi.card.parts.assumptions', 'Założenia'),
          en: tr('results.roi.card.parts.assumptions', 'Assumptions'),
        },
        hasData: true,
        alwaysShow: true,
        component: <RoiAssumptionsPart card={card} isPolish={isPolish} />,
      },
      {
        id: 'wyliczenia',
        icon: Calculator,
        label: {
          pl: tr('results.roi.card.parts.calculations', 'Wyliczenia'),
          en: tr('results.roi.card.parts.calculations', 'Calculations'),
        },
        hasData: !!card.storedRun,
        alwaysShow: true,
        component: <RoiCalculationsPart card={card} isPolish={isPolish} />,
      },
      {
        id: 'realizacja',
        icon: Target,
        label: {
          pl: tr('results.roi.card.parts.realization', 'Realizacja'),
          en: tr('results.roi.card.parts.realization', 'Realization'),
        },
        hasData: card.variances.length > 0 || card.pirs.length > 0,
        alwaysShow: true,
        component: <RoiRealizationPart card={card} isPolish={isPolish} />,
      },
    ];
  }, [card, isPolish, tr]);

  // DEC-419 (06.09.2026): sekcja „Teresa" (przycisk „Zapytaj Teresę o tę
  // analizę" + `openTeresa`) usunięta — jedyne wejście do Teresy jest teraz
  // w Menu 1 (DEC-404).
  const rightPanelSections: ArtifactRightPanelSection[] = useMemo(() => {
    if (!card) return [];
    return [
      {
        id: 'actions',
        label: t('Akcje', 'Actions'),
        icon: Settings2,
        defaultOpen: true,
        children: (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-xs font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              onClick={() =>
                navigate({
                  pathname: ROUTES.RESULTS_ROI.CASE.replace(':roiCaseId', card.caseId),
                  search: window.location.search,
                })
              }
            >
              {t('Otwórz pełne narzędzie ROI', 'Open the full ROI tool')}
            </button>
            <p className="text-[11px] leading-relaxed text-c-text-muted">
              {t(
                'Ta karta jest do czytania analizy. Wprowadzanie pozycji, przebiegi kalkulacji, wykonania i przegląd PIR robi się w pełnym narzędziu.',
                'This card is for reading the analysis. Entering lines, running calculations, actuals and the PIR happen in the full tool.'
              )}
            </p>
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
        children: (
          <ArtifactPropertiesTable
            rows={[
              {
                id: 'initiative',
                label: t('Inicjatywa', 'Initiative'),
                value: card.initiativeId,
              },
            ]}
            propertyLabel={t('Obiekt', 'Object')}
            valueLabel={t('Identyfikator', 'Identifier')}
          />
        ),
      },
      {
        id: 'evidence',
        label: t('Źródła i założenia', 'Sources and assumptions'),
        icon: FileText,
        defaultOpen: false,
        isEmpty: !card.baseline?.source && !card.calculationPolicy?.notes,
        emptyLabel: t('Brak zapisanych źródeł.', 'No sources recorded.'),
        children: (
          <div className="space-y-2 text-xs text-c-text-secondary">
            {card.baseline?.source ? (
              <p>
                <span className="text-c-text-muted">{t('Punkt odniesienia: ', 'Baseline: ')}</span>
                {card.baseline.source}
              </p>
            ) : null}
            {card.calculationPolicy?.notes ? <p>{card.calculationPolicy.notes}</p> : null}
          </div>
        ),
      },
      {
        id: 'comments',
        label: t('Komentarze', 'Comments'),
        defaultOpen: false,
        isEmpty: true,
        emptyLabel: t('Komentarze do analizy ROI nie są jeszcze podpięte do modelu.', 'Comments are not connected to the ROI analysis model yet.'),
        children: null,
      },
      {
        id: 'history',
        label: t('Historia', 'History'),
        defaultOpen: false,
        isEmpty: true,
        emptyLabel: t('Historia analizy ROI nie jest jeszcze dostępna w tym API.', 'ROI analysis history is not available in this API yet.'),
        children: null,
      },
    ];
  }, [card, propertyRows, t, navigate]);

  // ══════════════════════════════════════════════════════════════════════════
  // [ODMROZENIE 16_GLOBAL_STANDARDS DEC-422] KARTA N ANALIZY ROI — Menu 5,
  // „Pracuj z AI", przyklejone nagłówki.
  //
  // SŁOWA WŁAŚCICIELA (06.09.2026, otwarta analiza ROI): „narzędzie naprawdę
  // świetne; jedyny brak: ustabilizować menu 1–3 i formułę Pracuj z AI".
  //
  // SSOT: docs/ssot/STEROWANIE_KART_N_I_AI.md (zasady 2, 2b, 3).
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * ZASADA 2b — prawo edycji tej karty. Karta jest NARRACJĄ do czytania i nie
   * ma ANI JEDNEGO pola edytowalnego inline; jedyny tekst tej sprawy, do
   * którego backend przyjmuje zapis, to SZKIC przeglądu po wdrożeniu:
   * `PATCH .../post-investment-reviews/:pirId` z polami `lessonsLearned`
   * i `recommendation` (`roiCaseFullToolApi.ts`). Serwer odrzuca ten zapis
   * kodem `NOT_EDITABLE`, gdy PIR nie jest szkicem (`roiPirCommands.ts:678`).
   *
   * Prawem edycji jest więc ISTNIENIE PIR-u w statusie `draft`. Gdy go nie ma,
   * przełącznik „Edycja | Podgląd" NIE renderuje się, a z „Pracuj z AI"
   * zostaje samo „Analizuj" — dokładnie tak, jak każe Zasada 2b.
   */
  const szkicPir = useMemo(
    () => card?.pirs?.find((pir) => pir.status === 'draft') ?? null,
    [card]
  );
  const mozeEdytowac = !!szkicPir;

  const [readMode, setReadMode] = useState(true);
  useEffect(() => {
    setReadMode(!mozeEdytowac);
  }, [mozeEdytowac]);

  /**
   * Pola przeglądu po wdrożeniu, do których backend potrafi zapisać.
   * LICZB NIE GENERUJEMY: sekcja „Wyliczenia" (NPV, IRR, payback, przepływy)
   * pochodzi z silnika kalkulacji — model miałby tam zmyślić pomiar, nie
   * uzupełnić prozę. Ta sekcja dostaje pozycję WYSZARZONĄ.
   */
  const POLA_PIR: Record<string, 'lessonsLearned' | 'recommendation'> = useMemo(
    () => ({ lessonsLearned: 'lessonsLearned', recommendation: 'recommendation' }),
    []
  );

  /**
   * `RoiCardPir` (kształt karty) NIE niesie `rowVersion`, a komenda PATCH
   * wymaga `expectedVersion` (CAS). Dlatego zapis DOCZYTUJE bieżący PIR
   * (`GET .../post-investment-reviews/:pirId`) tuż przed wysłaniem — zgadnięta
   * wersja to gwarantowany konflikt 409, a nie oszczędność zapytania.
   */
  const zapiszPolePir = useCallback(
    async (poleId: string, wartosc: string) => {
      const klucz = POLA_PIR[poleId];
      if (!klucz) throw Object.assign(new Error('FIELD_NOT_WRITABLE'), { code: 'FIELD_NOT_WRITABLE' });
      if (!card || !szkicPir) throw Object.assign(new Error('NO_DRAFT_PIR'), { code: 'NO_DRAFT_PIR' });
      const biezacy = await getRoiPostInvestmentReview(card.caseId, szkicPir.pirId);
      if (!biezacy) throw Object.assign(new Error('PIR_NOT_FOUND'), { code: 'PIR_NOT_FOUND' });
      const patch: UpdateRoiPirDraftInput & { idempotencyKey: string } = {
        expectedVersion: biezacy.rowVersion,
        idempotencyKey: newRoiIdempotencyKey(),
      };
      if (klucz === 'lessonsLearned') patch.lessonsLearned = wartosc;
      else patch.recommendation = wartosc;
      await updateRoiPostInvestmentReviewDraft(card.caseId, szkicPir.pirId, patch);
      await load();
    },
    [POLA_PIR, card, szkicPir, load]
  );

  const zapisAI = useZapisPolAI(zapiszPolePir);

  const roiPolaSekcji = useCallback(
    (sekcjaId: string): CardAnalysisField[] => {
      if (!card) return [];
      if (sekcjaId === 'zalozenia') {
        return [
          {
            id: 'problemStatement',
            label: t('Problem', 'Problem statement'),
            value: card.problemStatement ?? '',
            kind: 'text',
            // Brak trasy zapisu: `roiApi.ts` ma wyłącznie tworzenie sprawy
            // i przejścia cyklu życia — żadnego PATCH na narracji sprawy.
            writable: false,
          },
          {
            id: 'scopeSummary',
            label: t('Zakres', 'Scope'),
            value: card.scopeSummary ?? '',
            kind: 'text',
            writable: false,
          },
          {
            id: 'baselineSource',
            label: t('Źródło punktu odniesienia', 'Baseline source'),
            value: card.baseline?.source ?? '',
            kind: 'text',
            writable: false,
          },
        ];
      }
      if (sekcjaId === 'wyliczenia') {
        return [
          {
            id: 'storedRun',
            label: t('Zapisany przebieg kalkulacji', 'Stored calculation run'),
            value: card.storedRun
              ? `ROI ${card.storedRun.roiPct ?? '—'}%, payback ${card.storedRun.paybackPeriods ?? '—'}`
              : '',
            kind: 'text',
            writable: false,
          },
        ];
      }
      if (sekcjaId === 'realizacja') {
        return [
          {
            id: 'lessonsLearned',
            label: t('Wnioski z przeglądu', 'Review learnings'),
            value: szkicPir?.lessonsLearned ?? '',
            kind: 'text',
            writable: mozeEdytowac,
            hint: t(
              'Co się potwierdziło, co nie, i co z tego wynika dla następnych analiz.',
              'What held true, what did not, and what follows for the next analyses.'
            ),
          },
          {
            id: 'recommendation',
            label: t('Rekomendacja po wdrożeniu', 'Post-implementation recommendation'),
            value: szkicPir?.recommendation ?? '',
            kind: 'text',
            writable: mozeEdytowac,
            hint: t(
              'Werdykt wprost i warunek, pod którym obowiązuje.',
              'A plain verdict and the condition under which it holds.'
            ),
          },
        ];
      }
      return [];
    },
    [card, szkicPir, mozeEdytowac, t]
  );

  /**
   * Tylko „Realizacja" ma pola tekstowe z drogą zapisu. „Założenia" ich nie
   * mają (brak trasy PATCH na narracji sprawy — zgłoszone w meldunku),
   * „Wyliczenia" to liczby z silnika. Obie dostają pozycję wyszarzoną.
   */
  const SEKCJE_Z_POLAMI_TEKSTOWYMI = useMemo(() => new Set(['realizacja']), []);

  const roiWritableFieldIds = useMemo(
    () => (mozeEdytowac ? Object.keys(POLA_PIR) : []),
    [mozeEdytowac, POLA_PIR]
  );

  const roiApplyChange = useCallback(
    (change: CardAnalysisChange): boolean => {
      if (!mozeEdytowac || readMode) return false;
      if (!POLA_PIR[change.fieldId]) return false;
      return zapisAI.zastosuj(change.fieldId, change.proposedValue);
    },
    [mozeEdytowac, readMode, POLA_PIR, zapisAI]
  );

  const roiCardAnalysis = useCardAIAnalysis({
    activeCardId: activeSection,
    buildInput: () => ({
      artifactType: 'roi_case',
      cardId: activeSection,
      artifactTitle: card?.title ?? '',
      artifactContext: [
        card ? `Faza: ${card.phase}` : '',
        card ? `Waluta: ${card.currency}` : '',
        card?.recommendation ? `Rekomendacja: ${card.recommendation}` : '',
        card ? `Założenia: ${card.assumptions.length}` : '',
        card ? `Wariancje: ${card.variances.length}` : '',
        card ? `Przeglądy po wdrożeniu: ${card.pirs.length}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      fields: roiPolaSekcji(activeSection),
      isPolish,
    }),
    applyChange: roiApplyChange,
  });

  const zrodloSekcji = useMemo<ZrodloUzupelnienia>(
    () => ({
      rodzaj: 'pola',
      pola: ({ sekcjaId }) =>
        (sekcjaId ? roiPolaSekcji(sekcjaId) : [])
          .filter((f) => f.writable)
          .map((f) => ({
            id: f.id,
            etykieta: f.label,
            wartosc: String(f.value ?? ''),
            format: 'paragraph' as const,
            sekcjaId: sekcjaId ?? undefined,
            sekcjaEtykieta: t('Realizacja', 'Realization'),
          })),
      zastosuj: zapisAI.zastosuj,
    }),
    [roiPolaSekcji, t, zapisAI.zastosuj]
  );

  const zrodloDokumentu = useMemo<ZrodloUzupelnienia>(
    () => ({
      rodzaj: 'pola',
      pola: () =>
        [...SEKCJE_Z_POLAMI_TEKSTOWYMI].flatMap((id) =>
          roiPolaSekcji(id)
            .filter((f) => f.writable)
            .map((f) => ({
              id: f.id,
              etykieta: f.label,
              wartosc: String(f.value ?? ''),
              format: 'paragraph' as const,
              sekcjaId: id,
              sekcjaEtykieta: t('Realizacja', 'Realization'),
            }))
        ),
      zastosuj: zapisAI.zastosuj,
    }),
    [SEKCJE_Z_POLAMI_TEKSTOWYMI, roiPolaSekcji, t, zapisAI.zastosuj]
  );

  const specSekcji = useMemo(
    () =>
      zbudujSpecSekcji(
        [
          { id: 'zalozenia', label: { pl: 'Założenia', en: 'Assumptions' }, ikona: 'FileText' },
          { id: 'wyliczenia', label: { pl: 'Wyliczenia', en: 'Calculations' }, ikona: 'BarChart3' },
          { id: 'realizacja', label: { pl: 'Realizacja', en: 'Realization' }, ikona: 'Target' },
        ],
        { pl: 'Karta analizy ROI', en: 'ROI analysis card' }
      ),
    []
  );
  const ukladSekcji = useCardLayout({ artifactType: 'tool', spec: specSekcji });

  if (!enabled) {
    return (
      <div className="flex h-full items-center justify-center p-6" data-testid="results-vnext-roi-card-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Analiza ROI — jeszcze nie włączona', 'ROI analysis — not yet enabled')}
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

  if (loading || (!card && !loadError)) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="results-vnext-roi-card-loading">
        <div className="text-sm text-c-text-muted">{t('Ładowanie analizy ROI…', 'Loading the ROI analysis…')}</div>
      </div>
    );
  }

  if (loadError || !card) {
    return (
      <div className="flex h-full items-center justify-center p-6" data-testid="results-vnext-roi-card-error">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title={t('Nie udało się wczytać analizy ROI', 'Could not load the ROI analysis')}
          description={loadError ?? undefined}
          onRetry={() => void load()}
          compact
        />
      </div>
    );
  }

  /**
   * Podtytuł Menu 1 = jedna linia tożsamości analizy, dokładnie jak na
   * zaakceptowanym zrzucie: „wariant 2 · 5 lat · CONDITIONAL GO".
   */
  const identityLine = [
    card.optionVariant !== null ? t(`wariant ${card.optionVariant}`, `option ${card.optionVariant}`) : null,
    card.indicators.horizonYears ? `${card.indicators.horizonYears} ${t('lat', 'yrs')}` : null,
    card.recommendation ? RECOMMENDATION_LABEL[card.recommendation] : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const header: NModeHeaderConfig = {
    title: card.title,
    onTitleChange: () => {},
    titleReadOnly: true,
    // Pigułka Menu 1 = FAZA karty (najdalsza wypełniona część), neutralna.
    statusLabel: phaseLabel(card.phase, isPolish),
    statusTone: 'neutral',
    artifactType: 'kpi',
    artifactId: card.caseId,
    onSave: () => {},
    saveState: 'saved',
    onClose: goToRegistry,
    // Karta jest do CZYTANIA — brak primary jest decyzją, nie przeoczeniem
    // (SPEC-N §2.3 wymaga, żeby ten brak był jawny).
    primaryAction: undefined,
  };

  /** Kropka statusu pigułki Menu 3 — mapa z fazy analizy. */
  const statusPigulki =
    card.phase === 'realization' ? 'TRACKING' : card.phase === 'calculations' ? 'PLANNING' : 'DRAFT';

  return (
    <KartaWynikowChrome
      domena="roi"
      kartaId={card.caseId}
      kartaNazwa={card.title}
      kartaOdznaka="ROI"
      kartaStatus={statusPigulki}
      onPokazListe={goToRegistry}
      testId="results-vnext-roi-card-chrome"
    >
    <div className="flex h-full min-h-0 flex-col" data-testid="results-vnext-roi-card-page">
      <ArtifactBreadcrumb
        items={[
          { label: t('Wyniki', 'Results'), onClick: () => navigate(ROUTES.RESULTS) },
          { label: 'ROI', onClick: goToRegistry },
          { label: card.title },
        ]}
      />
      <div className="px-4 pb-1 text-xs text-c-text-muted" data-testid="roi-card-identity-line">
        {identityLine || BRAK}
      </div>
      {/* Pasek streszczenia — trzy liczby, których właściciel szuka najpierw. */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2" data-testid="roi-card-summary-pills">
        <StatusChip
          label={`CAPEX ${fmtMoney(card.indicators.capex, card.currency, isPolish)}`}
          tone="neutral"
          hideDot
        />
        <StatusChip
          label={`${roiHorizonLabel(card.indicators.horizonYears)} ${fmtPercent(card.storedRun?.roiPct ?? null, isPolish, 0)}`}
          tone="neutral"
          hideDot
        />
        <StatusChip
          label={`Payback ${fmtYears(card.storedRun?.paybackPeriods ?? null, isPolish)}`}
          tone="neutral"
          hideDot
        />
      </div>
      <PasekZapisuAI stan={zapisAI.stan} isPolish={isPolish} onZamknij={zapisAI.wyczysc} />
      <div className="min-h-0 flex-1">
        <NModeShell
          header={header}
          sections={ukladSekcji.applyToSections(wszystkieSekcje)}
          activeSection={activeSection}
          onSectionChange={(id) => setActiveSection(id as RoiCardSectionId)}
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
                  onAnalizuj={roiCardAnalysis.run}
                  analizaWToku={roiCardAnalysis.loading}
                  analizaOtwarta={roiCardAnalysis.open}
                  aktywnaSekcja={activeSection}
                  kontekstArtefaktu={{
                    title: card.title,
                    status: card.phase,
                    type: 'roi_case',
                  }}
                  moznaEdytowac={mozeEdytowac && !readMode}
                  powodTylkoOdczyt={
                    !szkicPir
                      ? t(
                          'brak przeglądu po wdrożeniu w statusie szkicu — pozostałe treści analizy edytuje się w pełnym narzędziu ROI',
                          'no post-implementation review in draft status — the rest of the analysis is edited in the full ROI tool'
                        )
                      : t('karta otwarta w trybie Podgląd', 'card opened in Preview mode')
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
            <ArtifactRightPanel
              sections={rightPanelSections}
              ariaLabel={t('Panel analizy ROI', 'ROI analysis panel')}
            />
          }
        />
      </div>
      <NCardAIAnalysisPanel
        open={roiCardAnalysis.open}
        onClose={roiCardAnalysis.close}
        loading={roiCardAnalysis.loading}
        result={roiCardAnalysis.result}
        errorCode={roiCardAnalysis.errorCode}
        serverErrorCode={roiCardAnalysis.serverErrorCode}
        onRerun={roiCardAnalysis.rerun}
        onApplyChange={roiCardAnalysis.applyChange}
        writableFieldIds={roiWritableFieldIds}
        readMode={readMode}
        isPolish={isPolish}
      />
    </div>
    </KartaWynikowChrome>
  );
};

export default RoiCaseCardPage;
