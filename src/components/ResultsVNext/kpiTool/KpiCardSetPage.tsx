/**
 * `/results/kpi/:kpiId/zestawienie/:scorecardId` — POZIOM 3 trzypoziomowej
 * formuły KPI: ZBIÓR KART KPI.
 *
 * POWÓD ISTNIENIA (odrzucenie właściciela 2026-09-05, cytat dosłowny):
 *   „Zatwierdzona wersja, czyli karta KPI, jest OK. I teraz nad kartą jest ich
 *    zestawienie. To jest trzypoziomowe menu. (…) Tutaj mamy tabelę, pod nią
 *    kartę KPI, piętro niżej – zbiór kart KPI, a poniżej kolejna karta KPI."
 *
 * Ten ekran jest brakującym „piętrem niżej". Wchodzi się w niego z sekcji
 * „Zestawienia" karty KPI (poziom 2), a wychodzi w KOLEJNĄ kartę KPI
 * (poziom 4 = ta sama `KpiToolPage`). Ścieżka poziomów jest widoczna cały
 * czas w Menu 1 (`StandardModuleBar breadcrumbs`) — patrz `kpiCardSetPath.ts`.
 *
 * ── KANON (CLAUDE.md §UI): powłoka NARZUCA wygląd ────────────────────────────
 * Ekran NIE buduje własnej tabeli ani własnego kafelka: Menu 1/2/3 to
 * `StandardModuleBar` (ten sam, którego używa rejestr KPI), a KAŻDY kafelek to
 * `StandardGridCard` — jedyny dozwolony renderer karty w widoku kafelkowym
 * (kanon #76a). Zero `primary-*`/crimson, wyłącznie tokeny `c-*`.
 *
 * ── UCZCIWOŚĆ DANYCH (zmierzone, nie założone) ───────────────────────────────
 * 1. W backendzie NIE MA relacji rodzic→dziecko między KPI. `rg parentKpiId|
 *    parent_kpi_id|childKpi|kpiChildren` po `server/src` + `src` = ZERO
 *    trafień (jedyny `linkedKpis` to lokalna zmienna w
 *    `executionResultsBridge.ts`, inicjatywa→KPI, nie KPI→KPI). Hierarchii
 *    NIE udajemy danymi pokazowymi — „zbiorem" jest REALNE zestawienie
 *    (`rvn_kpi_scorecards` + `rvn_kpi_scorecard_items`), do którego wskaźnik
 *    z poziomu 2 należy; to jedyna istniejąca relacja KPI↔KPI.
 * 2. `rvn_kpi_scorecard_items` „carries NO KPI-fact column" (komentarz
 *    migracji, cytowany w `kpiScorecardApi.ts`) — sama pozycja zestawienia
 *    zna WYŁĄCZNIE `kpiName`/`role`/`sortOrder`/`addedAt`. Wartości liczbowe
 *    biorą się jedynie z OPUBLIKOWANEJ migawki przeglądu
 *    (`GET .../review-snapshots/published`); gdy zestawienie nigdy jej nie
 *    opublikowało, kafelek uczciwie nie pokazuje żadnej liczby (nie zeruje,
 *    nie zgaduje) i mówi to wprost w pasku pod Menu.
 * 3. `GET /:scorecardId` zwraca 404 zarówno dla „nie istnieje", jak i dla
 *    „brak widoczności" (nagłówek `kpiScorecardApi.ts`) — dlatego pusty wynik
 *    renderujemy jako uczciwy stan „nie widzisz tego zestawienia", nigdy jako
 *    „zestawienie jest puste".
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Blocks, LayoutGrid } from 'lucide-react';

import { StandardGridCard, type StandardGridCard as StandardGridCardData } from '@/components/standard';
import { StandardModuleBar } from '@/components/standard';
import { EmptyState } from '@/components/shared/states';
import { ROUTES } from '@/routes/routeConfig';

import { getResultsDomainPath, getResultsDomainTabs, isResultsDomain } from '../resultsDomainNavigation';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import { getKpi, type KpiDefinitionDto } from '../kpiApi';
import {
  getKpiScorecard,
  getPublishedKpiScorecardSnapshot,
  listKpiScorecardItems,
  type KpiScorecardDto,
  type KpiScorecardItemDto,
  type KpiScorecardReviewSnapshotDto,
  type ScorecardSnapshotItemFactDto,
} from '../kpiScorecards/kpiScorecardApi';
import { kpiScorecardItemRoleLabel } from '../kpiScorecards/kpiScorecardMappers';
import { kpiCardFromSetPath, withOwnerSampleData } from './kpiCardSetPath';

/** `performanceStatus` migawki → ton pigułki `StandardGridCard` (kanon: kolor
 * TYLKO jako sygnał, nigdy dekoracja; brak wartości = brak pigułki). */
const PERFORMANCE_TONE: Record<string, StandardGridCardData['statusTone']> = {
  on_target: 'success',
  warning: 'warning',
  critical: 'danger',
  neutral: 'neutral',
};

function performanceLabel(status: string | null, isPolish: boolean): string | undefined {
  if (!status) return undefined;
  const map: Record<string, { pl: string; en: string }> = {
    on_target: { pl: 'W normie', en: 'On target' },
    warning: { pl: 'Ostrzeżenie', en: 'Warning' },
    critical: { pl: 'Krytyczny', en: 'Critical' },
    neutral: { pl: 'Neutralny', en: 'Neutral' },
  };
  const entry = map[status];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}

function formatDate(iso: string | null | undefined, isPolish: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const KpiCardSetPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { kpiId, scorecardId } = useParams<{ kpiId: string; scorecardId: string }>();
  const enabled = isResultsVNextFlagEnabled('kpiRegistry');

  const [scorecard, setScorecard] = useState<KpiScorecardDto | null | 'loading'>('loading');
  const [items, setItems] = useState<KpiScorecardItemDto[] | 'loading'>('loading');
  const [snapshot, setSnapshot] = useState<KpiScorecardReviewSnapshotDto | null | 'loading'>('loading');
  const [parentKpi, setParentKpi] = useState<KpiDefinitionDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !scorecardId) return;
    setScorecard('loading');
    setLoadError(null);
    getKpiScorecard(scorecardId)
      .then(setScorecard)
      .catch((err) => {
        setScorecard(null);
        setLoadError(toUserFacingErrorMessage(err, isPolish));
      });
  }, [enabled, isPolish, scorecardId]);

  useEffect(() => {
    if (!enabled || !scorecardId) return;
    setItems('loading');
    listKpiScorecardItems(scorecardId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [enabled, scorecardId]);

  useEffect(() => {
    if (!enabled || !scorecardId) return;
    setSnapshot('loading');
    getPublishedKpiScorecardSnapshot(scorecardId)
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, [enabled, scorecardId]);

  // Nazwa karty KPI POZIOMU 2 do breadcrumbu — bez niej ścieżka poziomów
  // pokazywałaby surowy identyfikator (defekt rodziny „UUID w miejscu
  // człowieka/nazwy", zgłoszony przez właściciela).
  useEffect(() => {
    if (!enabled || !kpiId) return;
    getKpi(kpiId)
      .then(setParentKpi)
      .catch(() => setParentKpi(null));
  }, [enabled, kpiId]);

  /** Fakty z OPUBLIKOWANEJ migawki, po `kpiId` — jedyne realne źródło liczb. */
  const factsByKpi = useMemo(() => {
    const map = new Map<string, ScorecardSnapshotItemFactDto>();
    if (snapshot && snapshot !== 'loading' && snapshot.snapshotPayload?.items) {
      for (const fact of snapshot.snapshotPayload.items) map.set(fact.kpiId, fact);
    }
    return map;
  }, [snapshot]);

  const cards: StandardGridCardData[] = useMemo(() => {
    if (items === 'loading') return [];
    return items.map((item) => {
      const fact = factsByKpi.get(item.kpiId);
      const statusLabel = performanceLabel(fact?.performanceStatus ?? null, isPolish);
      const valueText =
        fact && fact.actualValue !== null && fact.actualValue !== undefined
          ? `${fact.actualValue.toLocaleString(isPolish ? 'pl-PL' : 'en-US')}${fact.unit ? ` ${fact.unit}` : ''}`
          : '—';
      return {
        id: item.kpiId,
        title: item.kpiName ?? item.kpiId,
        // Etykieta roli z SSOT mapperów zestawień — jedna nazwa w całej
        // rodzinie, żadna powierzchnia nie wymyśla własnego słownika.
        subtitle: `${t('Rola', 'Role')}: ${kpiScorecardItemRoleLabel(item.role, isPolish)}`,
        statusLabel,
        statusTone: statusLabel ? PERFORMANCE_TONE[fact?.performanceStatus ?? 'neutral'] : undefined,
        metrics: [
          {
            id: 'value',
            label: `${t('Ostatnia opublikowana wartość', 'Latest published value')}: ${valueText}`,
          },
        ],
        footerRight: formatDate(item.addedAt, isPolish),
      } satisfies StandardGridCardData;
    });
  }, [factsByKpi, isPolish, items, t]);

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-kpi-card-set-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Zestawienia KPI — jeszcze nie włączone', 'KPI card sets — not yet enabled')}
          description={t(
            'Ten ekran jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.',
            'This screen is still being built. Check back later, or ask an administrator for flag access.'
          )}
          compact
        />
      </div>
    );
  }

  const scorecardName =
    scorecard && scorecard !== 'loading'
      ? scorecard.name
      : t('Zestawienie wskaźników', 'Indicator card set');
  const parentTitle = parentKpi?.name || parentKpi?.kpiCode || t('Karta KPI', 'KPI card');

  const snapshotNotice =
    snapshot === 'loading'
      ? null
      : snapshot === null
        ? t(
            'To zestawienie nie ma jeszcze opublikowanej migawki przeglądu — kafelki pokazują skład zestawienia, bez wartości liczbowych (pozycja zestawienia nie niesie żadnego pola z wartością KPI).',
            'This card set has no published review snapshot yet — the tiles show its composition, without numbers (a card-set item carries no KPI value column).'
          )
        : t(
            `Wartości pochodzą z opublikowanej migawki przeglądu za okres ${formatDate(snapshot.reviewPeriodStart, isPolish)} – ${formatDate(snapshot.reviewPeriodEnd, isPolish)}.`,
            `Values come from the published review snapshot for ${formatDate(snapshot.reviewPeriodStart, isPolish)} – ${formatDate(snapshot.reviewPeriodEnd, isPolish)}.`
          );

  return (
    <div className="h-full" data-testid="results-vnext-kpi-card-set-page">
      <StandardModuleBar
        breadcrumbs={[
          { label: t('Rejestr KPI', 'KPI registry'), onClick: () => navigate(withOwnerSampleData(ROUTES.RESULTS_KPI.ROOT)) },
          { label: parentTitle, onClick: () => (kpiId ? navigate(withOwnerSampleData(`/results/kpi/${kpiId}`)) : undefined) },
          { label: scorecardName },
        ]}
        // Menu 2 = te same pigułki domen co rejestr KPI i ekran karty wyników
        // (`ResultsVNextRegistryShell`) — powłoka narzuca wygląd, ekran nie
        // wymyśla własnego paska.
        tabs={getResultsDomainTabs()}
        activeTab="kpi"
        onTabChange={(id) => {
          if (id === 'search' || id === 'legacy' || isResultsDomain(id)) navigate(getResultsDomainPath(id));
        }}
        showTabCounts={false}
      >
        <div className="flex h-full min-h-0 flex-col gap-4 p-6" data-testid="kpi-card-set-body">
          <p className="text-[11px] text-c-text-muted" data-testid="kpi-card-set-snapshot-notice">
            {snapshotNotice}
          </p>

          {loadError ? (
            <EmptyState
              variant="error"
              icon={AlertTriangle}
              title={t('Nie udało się wczytać zestawienia', 'Could not load the card set')}
              description={loadError}
              compact
            />
          ) : scorecard === null ? (
            <EmptyState
              variant="new"
              icon={LayoutGrid}
              title={t('Nie widzisz tego zestawienia', 'You cannot see this card set')}
              description={t(
                'Zestawienie nie istnieje albo nie masz do niego dostępu — serwer zwraca ten sam kod w obu przypadkach, więc nie zgadujemy który.',
                'The card set does not exist or you have no access to it — the server returns the same code for both, so we do not guess which.'
              )}
              compact
            />
          ) : items === 'loading' || scorecard === 'loading' ? (
            <p className="text-sm text-c-text-muted" data-testid="kpi-card-set-loading">
              {t('Ładowanie zbioru kart…', 'Loading card set…')}
            </p>
          ) : cards.length === 0 ? (
            <EmptyState
              variant="new"
              icon={LayoutGrid}
              title={t('Zestawienie nie ma jeszcze wskaźników', 'This card set has no indicators yet')}
              description={t(
                'Dodaj wskaźniki do zestawienia w narzędziu kart wyników.',
                'Add indicators to this card set in the scorecards tool.'
              )}
              compact
            />
          ) : (
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="kpi-card-set-grid"
            >
              {cards.map((card) => (
                <StandardGridCard
                  key={card.id}
                  card={card}
                  onClick={() =>
                    kpiId && scorecardId
                      ? navigate(withOwnerSampleData(kpiCardFromSetPath(card.id, scorecardId, kpiId)))
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

export default KpiCardSetPage;
