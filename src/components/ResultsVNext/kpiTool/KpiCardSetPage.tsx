/**
 * `/results/kpi/zestawienie/:scorecardId` — POZIOM 2 trzypoziomowej formuły
 * KPI: LISTA ZESTAWIENIA (opis + pozycje).
 *
 * POWÓD ISTNIENIA (odrzucenie właściciela 2026-09-05, cytat dosłowny):
 *   „To nie jest, niestety, to, co wcześniej zgłosiliśmy i omawialiśmy.
 *    Omawialiśmy tabelę; z poziomu tabeli otwiera się lista. Lista ma opis
 *    KPI, kilka pozycji, a każdy KPI ma swoją kartę typu N. Tego tu nie mamy
 *    teraz."
 *
 * Ten ekran jest tą LISTĄ. Wchodzi się w niego KLIKIEM W WIERSZ tabeli
 * zestawień (poziom 1, `../ResultsKpiRegistryPage.tsx`), a wychodzi w KARTĘ N
 * wskaźnika (poziom 3 = `KpiToolPage`). Ścieżka poziomów jest widoczna cały
 * czas w Menu 1 (`StandardModuleBar breadcrumbs`) — patrz `kpiCardSetPath.ts`.
 *
 * ── KANON (CLAUDE.md §UI): powłoka NARZUCA wygląd ────────────────────────────
 * Ekran NIE buduje własnej tabeli ani własnego kafelka: Menu 1/2 to
 * `StandardModuleBar` (ten sam, którego używa rejestr KPI), a KAŻDA pozycja to
 * `StandardGridCard` — jedyny dozwolony renderer karty w widoku kafelkowym
 * (kanon #76a). Zero `primary-*`/crimson, wyłącznie tokeny `c-*`.
 *
 * ── UCZCIWOŚĆ DANYCH (zmierzone, nie założone) ───────────────────────────────
 * 1. `rvn_kpi_scorecard_items` „carries NO KPI-fact column" (komentarz
 *    migracji, cytowany w `kpiScorecardApi.ts`) — sama pozycja zestawienia
 *    zna WYŁĄCZNIE `kpiName`/`role`/`sortOrder`/`addedAt`. Wartości liczbowe
 *    biorą się jedynie z OPUBLIKOWANEJ migawki przeglądu
 *    (`GET .../review-snapshots/published`); gdy zestawienie nigdy jej nie
 *    opublikowało, kafelek uczciwie nie pokazuje żadnej liczby (nie zeruje,
 *    nie zgaduje) i mówi to wprost w pasku pod Menu.
 * 2. `GET /:scorecardId` zwraca 404 zarówno dla „nie istnieje", jak i dla
 *    „brak widoczności" (nagłówek `kpiScorecardApi.ts`) — dlatego pusty wynik
 *    renderujemy jako uczciwy stan „nie widzisz tego zestawienia", nigdy jako
 *    „zestawienie jest puste".
 * 3. ZESTAWIENIE SYSTEMOWE „Bez zestawienia" (`UNASSIGNED_CARD_SET_ID`) nie
 *    jest rekordem w bazie — to wyliczenie po stronie klienta: wszystkie
 *    widoczne KPI MINUS te, które są pozycją jakiegokolwiek widocznego
 *    zestawienia. Istnieje po to, żeby przejście poziomu 1 na tabelę zestawień
 *    niczego nie ukryło. Nie ma opublikowanej migawki (bo nie jest
 *    zestawieniem), więc nigdy nie pokazuje wartości liczbowych.
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
import { listKpis, type KpiDefinitionDto } from '../kpiApi';
import {
  getKpiScorecard,
  getPublishedKpiScorecardSnapshot,
  listKpiScorecardItems,
  listKpiScorecards,
  type KpiScorecardDto,
  type KpiScorecardItemDto,
  type KpiScorecardReviewSnapshotDto,
  type ScorecardSnapshotItemFactDto,
} from '../kpiScorecards/kpiScorecardApi';
import { kpiScorecardItemRoleLabel } from '../kpiScorecards/kpiScorecardMappers';
import {
  isUnassignedCardSetId,
  kpiCardFromSetPath,
  UNASSIGNED_CARD_SET_ID,
  withOwnerSampleData,
} from './kpiCardSetPath';

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

/** Jedna pozycja LISTY — wspólny kształt dla realnego zestawienia
 * (`KpiScorecardItemDto`) i dla wyliczonego zestawienia systemowego
 * (`KpiDefinitionDto`), żeby renderować JEDNYM kodem. */
interface CardSetEntry {
  kpiId: string;
  kpiName: string;
  /** Podpis pod nazwą: rola w zestawieniu albo kod KPI (systemowe). */
  subtitle: string;
  /** Data w stopce: dodania do zestawienia albo aktualizacji KPI. */
  footerDate: string | null;
}

export const KpiCardSetPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { scorecardId } = useParams<{ scorecardId: string }>();
  const enabled = isResultsVNextFlagEnabled('kpiRegistry');
  const isUnassigned = isUnassignedCardSetId(scorecardId);

  const [scorecard, setScorecard] = useState<KpiScorecardDto | null | 'loading'>('loading');
  const [items, setItems] = useState<KpiScorecardItemDto[] | 'loading'>('loading');
  const [snapshot, setSnapshot] = useState<KpiScorecardReviewSnapshotDto | null | 'loading'>('loading');
  /** Pozycje zestawienia SYSTEMOWEGO — KPI spoza wszystkich zestawień. */
  const [unassigned, setUnassigned] = useState<KpiDefinitionDto[] | 'loading'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !scorecardId || isUnassigned) return;
    setScorecard('loading');
    setLoadError(null);
    getKpiScorecard(scorecardId)
      .then(setScorecard)
      .catch((err) => {
        setScorecard(null);
        setLoadError(toUserFacingErrorMessage(err, isPolish));
      });
  }, [enabled, isPolish, isUnassigned, scorecardId]);

  useEffect(() => {
    if (!enabled || !scorecardId || isUnassigned) return;
    setItems('loading');
    listKpiScorecardItems(scorecardId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [enabled, isUnassigned, scorecardId]);

  useEffect(() => {
    if (!enabled || !scorecardId || isUnassigned) return;
    setSnapshot('loading');
    getPublishedKpiScorecardSnapshot(scorecardId)
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, [enabled, isUnassigned, scorecardId]);

  // ZESTAWIENIE SYSTEMOWE — te same dwa realne wywołania, których używa
  // poziom 1 do policzenia wiersza „Bez zestawienia": lista KPI minus
  // członkowie wszystkich widocznych zestawień. Zero zmyślonych danych.
  useEffect(() => {
    if (!enabled || !isUnassigned) return;
    let cancelled = false;
    setUnassigned('loading');
    setLoadError(null);
    (async () => {
      try {
        const [kpis, scorecards] = await Promise.all([listKpis({}), listKpiScorecards({})]);
        const memberLists = await Promise.all(
          scorecards.map((sc) => listKpiScorecardItems(sc.scorecardId).catch(() => []))
        );
        const members = new Set<string>();
        for (const list of memberLists) for (const item of list) members.add(item.kpiId);
        if (cancelled) return;
        setUnassigned(kpis.filter((kpi) => !members.has(kpi.kpiId)));
      } catch (err) {
        if (cancelled) return;
        setUnassigned([]);
        setLoadError(toUserFacingErrorMessage(err, isPolish));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, isPolish, isUnassigned]);

  /** Fakty z OPUBLIKOWANEJ migawki, po `kpiId` — jedyne realne źródło liczb. */
  const factsByKpi = useMemo(() => {
    const map = new Map<string, ScorecardSnapshotItemFactDto>();
    if (snapshot && snapshot !== 'loading' && snapshot.snapshotPayload?.items) {
      for (const fact of snapshot.snapshotPayload.items) map.set(fact.kpiId, fact);
    }
    return map;
  }, [snapshot]);

  const entries: CardSetEntry[] | 'loading' = useMemo(() => {
    if (isUnassigned) {
      if (unassigned === 'loading') return 'loading';
      return unassigned.map((kpi) => ({
        kpiId: kpi.kpiId,
        kpiName: kpi.name || kpi.kpiCode,
        subtitle: kpi.kpiCode,
        footerDate: kpi.updatedAt,
      }));
    }
    if (items === 'loading') return 'loading';
    return items.map((item) => ({
      kpiId: item.kpiId,
      kpiName: item.kpiName ?? item.kpiId,
      // Etykieta roli z SSOT mapperów zestawień — jedna nazwa w całej
      // rodzinie, żadna powierzchnia nie wymyśla własnego słownika.
      subtitle: `${t('Rola', 'Role')}: ${kpiScorecardItemRoleLabel(item.role, isPolish)}`,
      footerDate: item.addedAt,
    }));
  }, [isPolish, isUnassigned, items, t, unassigned]);

  const cards: StandardGridCardData[] = useMemo(() => {
    if (entries === 'loading') return [];
    return entries.map((entry) => {
      const fact = factsByKpi.get(entry.kpiId);
      const statusLabel = performanceLabel(fact?.performanceStatus ?? null, isPolish);
      const valueText =
        fact && fact.actualValue !== null && fact.actualValue !== undefined
          ? `${fact.actualValue.toLocaleString(isPolish ? 'pl-PL' : 'en-US')}${fact.unit ? ` ${fact.unit}` : ''}`
          : '—';
      return {
        id: entry.kpiId,
        title: entry.kpiName,
        subtitle: entry.subtitle,
        statusLabel,
        statusTone: statusLabel ? PERFORMANCE_TONE[fact?.performanceStatus ?? 'neutral'] : undefined,
        // Krótka etykieta metryki — kafelek ma ~200 px w siatce 4-kolumnowej,
        // a długi podpis nachodził na datę w stopce (zmierzone na zrzucie
        // L2, 05.09). Skąd bierze się (albo nie bierze) wartość, mówi pasek
        // nad siatką — nie powtarzamy tego na każdym kafelku.
        metrics: [{ id: 'value', label: `${t('Wartość', 'Value')}: ${valueText}` }],
        footerRight: formatDate(entry.footerDate, isPolish),
      } satisfies StandardGridCardData;
    });
  }, [entries, factsByKpi, isPolish, t]);

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

  const scorecardName = isUnassigned
    ? t('Bez zestawienia', 'Not in any card set')
    : scorecard && scorecard !== 'loading'
      ? scorecard.name
      : t('Zestawienie wskaźników', 'Indicator card set');

  // OPIS ZESTAWIENIA — to jest ten „opis KPI", którego brak właściciel
  // wypunktował 05.09 („Lista ma opis KPI, kilka pozycji").
  const scorecardDescription = isUnassigned
    ? t(
        'Wskaźniki, które nie należą do żadnego widocznego zestawienia. To wyliczenie, nie rekord w bazie — istnieje po to, żeby żaden KPI nie zniknął z rejestru.',
        'Indicators that belong to no visible card set. A computed list, not a stored record — it exists so that no KPI disappears from the registry.'
      )
    : scorecard && scorecard !== 'loading'
      ? (scorecard.description ?? t('Brak opisu zestawienia.', 'This card set has no description.'))
      : '';

  const snapshotNotice = isUnassigned
    ? t(
        'Zestawienie systemowe nie ma przeglądu ani migawki — dlatego kafelki nie pokazują wartości liczbowych.',
        'The system card set has no review and no snapshot — that is why the tiles show no numbers.'
      )
    : snapshot === 'loading'
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

  const notVisible = !isUnassigned && scorecard === null;
  const loadingList = entries === 'loading' || (!isUnassigned && scorecard === 'loading');

  return (
    <div className="h-full" data-testid="results-vnext-kpi-card-set-page">
      <StandardModuleBar
        breadcrumbs={[
          {
            label: t('Rejestr KPI', 'KPI registry'),
            onClick: () => navigate(withOwnerSampleData(ROUTES.RESULTS_KPI.ROOT)),
          },
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
          {/* NAGŁÓWEK LISTY — nazwa zestawienia, jego OPIS i liczba pozycji. */}
          <header className="flex flex-col gap-1" data-testid="kpi-card-set-header">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-base font-semibold text-c-text">{scorecardName}</h1>
              <span className="text-xs text-c-text-secondary" data-testid="kpi-card-set-count">
                {entries === 'loading'
                  ? t('Wskaźniki: …', 'Indicators: …')
                  : `${t('Wskaźniki', 'Indicators')}: ${entries.length}`}
              </span>
            </div>
            {scorecardDescription ? (
              <p className="max-w-3xl text-sm text-c-text-secondary" data-testid="kpi-card-set-description">
                {scorecardDescription}
              </p>
            ) : null}
            <p className="text-[11px] text-c-text-muted" data-testid="kpi-card-set-snapshot-notice">
              {snapshotNotice}
            </p>
          </header>

          {loadError ? (
            <EmptyState
              variant="error"
              icon={AlertTriangle}
              title={t('Nie udało się wczytać zestawienia', 'Could not load the card set')}
              description={loadError}
              compact
            />
          ) : notVisible ? (
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
          ) : loadingList ? (
            <p className="text-sm text-c-text-muted" data-testid="kpi-card-set-loading">
              {t('Ładowanie listy wskaźników…', 'Loading the indicator list…')}
            </p>
          ) : cards.length === 0 ? (
            <EmptyState
              variant="new"
              icon={LayoutGrid}
              title={
                isUnassigned
                  ? t('Każdy KPI należy do zestawienia', 'Every KPI belongs to a card set')
                  : t('Zestawienie nie ma jeszcze wskaźników', 'This card set has no indicators yet')
              }
              description={
                isUnassigned
                  ? t(
                      'Nie ma wskaźnika poza zestawieniami — dlatego ta lista jest pusta.',
                      'No indicator sits outside a card set — that is why this list is empty.'
                    )
                  : t(
                      'Dodaj wskaźniki do zestawienia w narzędziu kart wyników.',
                      'Add indicators to this card set in the scorecards tool.'
                    )
              }
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
                    navigate(
                      withOwnerSampleData(
                        kpiCardFromSetPath(card.id, scorecardId ?? UNASSIGNED_CARD_SET_ID)
                      )
                    )
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
