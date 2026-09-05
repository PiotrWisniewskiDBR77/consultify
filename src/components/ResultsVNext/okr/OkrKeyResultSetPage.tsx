/**
 * `/results/okr/:objectiveId/rezultaty` — POZIOM 3 czteropoziomowej formuły
 * OKR: ZBIÓR KART KLUCZOWYCH REZULTATÓW.
 *
 * POWÓD ISTNIENIA (odrzucenie właściciela 2026-09-05, cytat dosłowny):
 *   „Zatwierdzona wersja, czyli karta KPI, jest OK. I teraz nad kartą jest ich
 *    zestawienie. To jest trzypoziomowe menu. (…) Tutaj mamy tabelę, pod nią
 *    kartę, piętro niżej – zbiór kart, a poniżej kolejna karta."
 *
 * Bliźniak `../kpiTool/KpiCardSetPage.tsx` dla rodziny OKR. Wchodzi się tu
 * z sekcji „Kluczowe rezultaty" karty celu (poziom 2), a wychodzi w KARTĘ
 * Kluczowego Rezultatu (poziom 4). Ścieżka poziomów widoczna cały czas
 * w Menu 1 (`StandardModuleBar breadcrumbs`) — patrz `okrObjectiveCardPath.ts`.
 *
 * ── KANON (CLAUDE.md §UI): powłoka NARZUCA wygląd ───────────────────────────
 * Ekran NIE buduje własnej tabeli ani własnego kafelka: Menu 1/2 to
 * `StandardModuleBar` (ten sam, którego używa rejestr OKR), a KAŻDY kafelek to
 * `StandardGridCard` — jedyny dozwolony renderer karty w widoku kafelkowym
 * (kanon #76a). Zero `primary-*`/crimson, wyłącznie tokeny `c-*`.
 *
 * ── UCZCIWOŚĆ DANYCH (zmierzone, nie założone) ──────────────────────────────
 * 1. Kluczowe Rezultaty przychodzą ZAGNIEŻDŻONE w celu
 *    (`GET /vnext/results/okr/objectives/:objectiveId` →
 *    `OkrObjectiveWithKeyResultsDto.keyResults`). Osobnej trasy „lista KR dla
 *    celu" backend NIE MA — to udokumentowany kształt API, nie obejście
 *    (nagłówek `okrObjectiveApi.ts`, sekcja „REAL, CONFIRMED GAP").
 * 2. `postęp` KR-a jest wartością liczoną przez silnik i bywa nieobliczalny
 *    (`progressCalcReason` z prefiksem `not_calculable:`). Kafelek w takim
 *    wypadku NIE pokazuje paska ani procentu — mówi wprost, że nie da się
 *    policzyć. Nigdy nie podstawiamy zera.
 * 3. `GET /objectives/:id` zwraca to samo 404 dla „nie istnieje" i dla „nie
 *    widzisz" — dlatego pusty wynik renderujemy jako uczciwy stan „nie widzisz
 *    tego celu", nigdy jako „cel jest pusty".
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Blocks, ListChecks } from 'lucide-react';

import { StandardGridCard, type StandardGridCard as StandardGridCardData } from '@/components/standard/StandardGridCard';
import { StandardModuleBar } from '@/components/standard';
import { EmptyState } from '@/components/shared/states';
import { ROUTES } from '@/routes/routeConfig';

import { getResultsDomainPath, getResultsDomainTabs, isResultsDomain } from '../resultsDomainNavigation';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import { getOkrSet, type OkrSetDto } from './okrApi';
import {
  getObjectiveWithKeyResults,
  type OkrObjectiveWithKeyResultsDto,
} from './okrObjectiveApi';
import {
  formatOkrDate,
  formatOkrNumeric,
  formatOkrProgressPercent,
  OKR_KEY_RESULT_STATUS_TONE,
  okrKeyResultMeasurementTypeLabel,
  okrKeyResultStatusLabel,
  parseOkrKeyResultProgress,
  parseOkrNumericField,
} from './okrObjectiveMappers';
import {
  okrKeyResultCardPath,
  okrObjectiveCardPath,
  withOwnerSampleData,
} from './okrObjectiveCardPath';

export const OkrKeyResultSetPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { objectiveId } = useParams<{ objectiveId: string }>();
  const enabled = isResultsVNextFlagEnabled('okrRegistry');

  const [objective, setObjective] = useState<OkrObjectiveWithKeyResultsDto | null | 'loading'>('loading');
  const [parentSet, setParentSet] = useState<OkrSetDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !objectiveId) return;
    setObjective('loading');
    setLoadError(null);
    getObjectiveWithKeyResults(objectiveId)
      .then(setObjective)
      .catch((err) => {
        setObjective(null);
        setLoadError(toUserFacingErrorMessage(err, isPolish));
      });
  }, [enabled, isPolish, objectiveId]);

  const setId = objective && objective !== 'loading' ? objective.setId : null;
  useEffect(() => {
    if (!enabled || !setId) return;
    getOkrSet(setId)
      .then(setParentSet)
      .catch(() => setParentSet(null));
  }, [enabled, setId]);

  const cards: StandardGridCardData[] = useMemo(() => {
    if (!objective || objective === 'loading') return [];
    return objective.keyResults.map((kr) => {
      const progress = parseOkrKeyResultProgress(kr.progress, kr.progressCalcReason);
      const current = parseOkrNumericField(kr.currentValue);
      const target = parseOkrNumericField(kr.targetValue);
      return {
        id: kr.keyResultId,
        title: kr.title,
        subtitle: `${t('Typ pomiaru', 'Measurement type')}: ${okrKeyResultMeasurementTypeLabel(kr.measurementType, isPolish)}`,
        description: kr.description ?? undefined,
        statusLabel: okrKeyResultStatusLabel(kr.status, isPolish),
        statusTone: OKR_KEY_RESULT_STATUS_TONE[kr.status],
        // Pasek postępu renderujemy WYŁĄCZNIE gdy silnik zwrócił liczbę.
        progress: typeof progress === 'number' ? Math.round(progress * 100) : undefined,
        metrics: [
          {
            id: 'value',
            label: `${t('Bieżąca', 'Current')}: ${
              current === null ? '—' : formatOkrNumeric(current, isPolish, kr.unit)
            } · ${t('Cel', 'Target')}: ${target === null ? '—' : formatOkrNumeric(target, isPolish, kr.unit)}`,
          },
          {
            id: 'progress',
            label: `${t('Postęp', 'Progress')}: ${
              typeof progress === 'number'
                ? formatOkrProgressPercent(progress, isPolish)
                : progress === 'not_calculable'
                  ? t('nie da się policzyć', 'not calculable')
                  : '—'
            }`,
          },
        ],
        footerRight: formatOkrDate(kr.updatedAt, isPolish),
      } satisfies StandardGridCardData;
    });
  }, [isPolish, objective, t]);

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-key-result-set-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Zbiór kluczowych rezultatów — jeszcze nie włączony', 'Key result set — not yet enabled')}
          description={t(
            'Ten ekran jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.',
            'This screen is still being built. Check back later, or ask an administrator for flag access.'
          )}
          compact
        />
      </div>
    );
  }

  const objectiveTitle =
    objective && objective !== 'loading' ? objective.title : t('Karta celu', 'Objective card');
  const setTitle = parentSet?.title ?? t('Zestaw OKR', 'OKR set');

  return (
    <div className="h-full" data-testid="results-vnext-okr-key-result-set-page">
      <StandardModuleBar
        breadcrumbs={[
          { label: t('Rejestr OKR', 'OKR registry'), onClick: () => navigate(ROUTES.RESULTS_OKR.ROOT) },
          { label: setTitle, onClick: () => (setId ? navigate(`/results/okr/sets/${setId}`) : undefined) },
          {
            label: objectiveTitle,
            onClick: () =>
              objectiveId ? navigate(withOwnerSampleData(okrObjectiveCardPath(objectiveId))) : undefined,
          },
          { label: t('Kluczowe rezultaty', 'Key results') },
        ]}
        tabs={getResultsDomainTabs()}
        activeTab="okr"
        onTabChange={(id) => {
          if (id === 'search' || id === 'legacy' || isResultsDomain(id)) navigate(getResultsDomainPath(id));
        }}
        showTabCounts={false}
      >
        <div className="flex h-full min-h-0 flex-col gap-4 p-6" data-testid="okr-key-result-set-body">
          <p className="text-[11px] text-c-text-muted" data-testid="okr-key-result-set-notice">
            {t(
              'Zbiór kart kluczowych rezultatów tego celu. Wartości pochodzą wprost z kontraktu każdego rezultatu i z ostatniego check-inu — kafelek nie pokazuje procentu, którego silnik postępu nie policzył.',
              'The set of key result cards for this objective. Values come straight from each key result contract and its latest check-in — a tile never shows a percentage the progress engine did not calculate.'
            )}
          </p>

          {loadError ? (
            <EmptyState
              variant="error"
              icon={AlertTriangle}
              title={t('Nie udało się wczytać celu', 'Could not load the objective')}
              description={loadError}
              compact
            />
          ) : objective === null ? (
            <EmptyState
              variant="new"
              icon={ListChecks}
              title={t('Nie widzisz tego celu', 'You cannot see this objective')}
              description={t(
                'Cel nie istnieje albo nie masz do niego dostępu — serwer zwraca ten sam kod w obu przypadkach, więc nie zgadujemy który.',
                'The objective does not exist or you have no access to it — the server returns the same code for both, so we do not guess which.'
              )}
              compact
            />
          ) : objective === 'loading' ? (
            <p className="text-sm text-c-text-muted" data-testid="okr-key-result-set-loading">
              {t('Ładowanie zbioru kart…', 'Loading card set…')}
            </p>
          ) : cards.length === 0 ? (
            <EmptyState
              variant="new"
              icon={ListChecks}
              title={t('Ten cel nie ma kluczowych rezultatów', 'This objective has no key results')}
              description={t(
                'Dodaj pierwszy kluczowy rezultat w widoku „Kluczowe Rezultaty" zestawu OKR — bez niego cel nie ma czym mierzyć postępu.',
                'Add the first key result in the OKR set "Key Results" view — without one the objective has nothing to measure progress with.'
              )}
              compact
            />
          ) : (
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="okr-key-result-set-grid"
            >
              {cards.map((card) => (
                <StandardGridCard
                  key={card.id}
                  card={card}
                  onClick={() =>
                    objectiveId
                      ? navigate(withOwnerSampleData(okrKeyResultCardPath(objectiveId, card.id)))
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </StandardModuleBar>
    </div>
  );
};

export default OkrKeyResultSetPage;
