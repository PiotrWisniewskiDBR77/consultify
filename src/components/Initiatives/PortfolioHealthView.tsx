/**
 * Zdrowie portfela (Kręgosłup inicjatyw · F4 · D9).
 *
 * Read-only widok zdrowia portfela inicjatyw: mapa pokrycia MECE nad stałą
 * taksonomią obszarów, lista luk, klastry duplikatów oraz rozkład statusów i
 * balansu effort×impact. Karmiony z endpointu `GET /api/initiatives/portfolio-health`
 * (kontrakt = PortfolioHealth z server/.../portfolioAnalysisService.ts).
 *
 * Samowystarczalny: własny hook fetch (bez zależności od współdzielonego
 * initiatives.api.ts), i18n PL/EN z fallbackami przez t(). Tokeny kanonu (bez
 * hex/rose — primary + slate).
 */
import {
  AlertTriangle,
  CopyX,
  Grid3x3,
  Layers,
  Loader2,
  Map as MapIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Kontrakt danych (lustrzane wobec portfolioAnalysisService.ts)
// ---------------------------------------------------------------------------
export interface AreaCoverage {
  area: string;
  count: number;
  sharePct: number;
}
export interface BalanceCell {
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  count: number;
}
export interface DuplicateCluster {
  ids: string[];
  titles: string[];
  peakScore: number;
}
export interface PortfolioHealth {
  total: number;
  byStatus: Record<string, number>;
  coverage: AreaCoverage[];
  gaps: string[];
  balance: {
    grid: BalanceCell[];
    quickWins: number;
    bigBets: number;
    moneyPits: number;
    fillIns: number;
  };
  duplicateClusters: DuplicateCluster[];
}

const LEVELS: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

// ---------------------------------------------------------------------------
// Fetch hook (samowystarczalny — stub endpoint)
// ---------------------------------------------------------------------------
export function usePortfolioHealth(endpoint = '/api/initiatives/portfolio-health') {
  const [data, setData] = useState<PortfolioHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(endpoint, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PortfolioHealth | { data?: PortfolioHealth };
        if (!alive) return;
        // Toleruj oba kształty: surowy obiekt lub { data }.
        const payload = (json as { data?: PortfolioHealth }).data ?? (json as PortfolioHealth);
        setData(payload ?? null);
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'fetch failed');
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [endpoint]);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Podkomponenty
// ---------------------------------------------------------------------------
function ShareBar({ label, count, total }: { label: React.ReactNode; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-36 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">{label}</div>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {count} · {pct}%
      </div>
    </div>
  );
}

function HeadlineStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
      <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</span>
      <span className="text-center text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widok główny
// ---------------------------------------------------------------------------
export interface PortfolioHealthViewProps {
  /** Nadpisanie endpointu (testy / inne osadzenie). */
  endpoint?: string;
  /** Wstrzyknięcie danych (testy / storybook) — pomija fetch. */
  health?: PortfolioHealth | null;
}

export function PortfolioHealthView({ endpoint, health: injected }: PortfolioHealthViewProps) {
  const { t } = useTranslation();
  const hook = usePortfolioHealth(endpoint);
  // Wstrzyknięte dane mają priorytet (test/preview), inaczej z hooka.
  const health = injected !== undefined ? injected : hook.data;
  const loading = injected !== undefined ? false : hook.loading;

  const statusTotal = useMemo(
    () => (health ? Object.values(health.byStatus).reduce((a, b) => a + b, 0) : 0),
    [health]
  );

  const areaLabel = (area: string) =>
    t(`initiatives.portfolioHealth.area.${area}`, area.charAt(0).toUpperCase() + area.slice(1));
  const levelLabel = (lvl: string) => t(`initiatives.portfolioHealth.level.${lvl}`, lvl);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-500" data-testid="portfolio-health-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading', 'Ładowanie…')}
      </div>
    );
  }

  if (!health) {
    return (
      <div className="p-6 text-sm text-slate-500" data-testid="portfolio-health-empty">
        {t('initiatives.portfolioHealth.empty', 'Brak danych o zdrowiu portfela.')}
      </div>
    );
  }

  // Maks. liczność komórki balansu — do skali tła heatmapy.
  const maxCell = health.balance.grid.reduce((m, c) => Math.max(m, c.count), 0) || 1;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4" data-testid="portfolio-health-view">
      {/* Nagłówek + statystyki ------------------------------------------------ */}
      <header className="flex flex-wrap items-center gap-2">
        <MapIcon className="h-5 w-5 text-primary-500" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {t('initiatives.portfolioHealth.title', 'Zdrowie portfela')}
        </h2>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {t('initiatives.portfolioHealth.total', '{{count}} inicjatyw', { count: health.total })}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <HeadlineStat label={t('initiatives.portfolioHealth.quickWins', 'Szybkie wygrane')} value={health.balance.quickWins} />
        <HeadlineStat label={t('initiatives.portfolioHealth.bigBets', 'Duże zakłady')} value={health.balance.bigBets} />
        <HeadlineStat label={t('initiatives.portfolioHealth.moneyPits', 'Studnie bez dna')} value={health.balance.moneyPits} />
        <HeadlineStat label={t('initiatives.portfolioHealth.gapsCount', 'Luki pokrycia')} value={health.gaps.length} />
      </div>

      {/* MECE coverage -------------------------------------------------------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('initiatives.portfolioHealth.coverageTitle', 'Mapa pokrycia (MECE)')}
          </h3>
        </header>
        {health.coverage.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">{t('initiatives.portfolioHealth.noCoverage', 'Brak danych pokrycia.')}</p>
        ) : (
          <div className="space-y-0.5">
            {[...health.coverage]
              .sort((a, b) => b.count - a.count)
              .map((c) => (
                <ShareBar
                  key={c.area}
                  label={
                    <span className="flex items-center gap-1.5">
                      {health.gaps.includes(c.area) && (
                        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                      )}
                      {areaLabel(c.area)}
                    </span>
                  }
                  count={c.count}
                  total={health.total}
                />
              ))}
          </div>
        )}
      </section>

      {/* Luki ----------------------------------------------------------------- */}
      {health.gaps.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <header className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('initiatives.portfolioHealth.gapsTitle', 'Luki pokrycia')}
            </h3>
          </header>
          <div className="flex flex-wrap gap-2" data-testid="portfolio-health-gaps">
            {health.gaps.map((g) => (
              <span
                key={g}
                className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-700 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300"
              >
                {areaLabel(g)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Balans effort × impact (heatmapa 3×3) -------------------------------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-3 flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('initiatives.portfolioHealth.balanceTitle', 'Balans wysiłek × wpływ')}
          </h3>
        </header>
        <div className="inline-grid grid-cols-[auto_repeat(3,minmax(3.5rem,1fr))] gap-1 text-xs">
          <div />
          {LEVELS.map((imp) => (
            <div key={`h-${imp}`} className="px-1 text-center font-medium text-slate-400">
              {levelLabel(imp)}
            </div>
          ))}
          {LEVELS.map((eff) => (
            <React.Fragment key={`row-${eff}`}>
              <div className="flex items-center pr-2 text-right font-medium text-slate-400">
                {levelLabel(eff)}
              </div>
              {LEVELS.map((imp) => {
                const cell = health.balance.grid.find((c) => c.effort === eff && c.impact === imp);
                const count = cell?.count ?? 0;
                const intensity = count / maxCell;
                return (
                  <div
                    key={`${eff}-${imp}`}
                    className="flex h-12 items-center justify-center rounded-md border border-slate-100 tabular-nums dark:border-slate-800"
                    style={{
                      backgroundColor:
                        count === 0
                          ? undefined
                          : `color-mix(in srgb, var(--color-primary-500, #3b82f6) ${Math.round(
                              15 + intensity * 70
                            )}%, transparent)`,
                    }}
                    title={`${t('initiatives.portfolioHealth.effort', 'Wysiłek')}: ${levelLabel(
                      eff
                    )} · ${t('initiatives.portfolioHealth.impact', 'Wpływ')}: ${levelLabel(imp)}`}
                  >
                    <span className={count > 0 ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-300'}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {t('initiatives.portfolioHealth.balanceHint', 'Wiersze = wysiłek, kolumny = wpływ.')}
        </p>
      </section>

      {/* Status + Duplikaty --------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('initiatives.portfolioHealth.byStatus', 'Wg statusu')}
          </h3>
          {Object.keys(health.byStatus).length === 0 ? (
            <p className="text-sm text-slate-500">{t('initiatives.portfolioHealth.empty', 'Brak danych.')}</p>
          ) : (
            Object.entries(health.byStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <ShareBar key={status} label={status} count={count} total={statusTotal} />
              ))
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <header className="mb-3 flex items-center gap-2">
            <CopyX className="h-4 w-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('initiatives.portfolioHealth.duplicatesTitle', 'Klastry duplikatów')}
            </h3>
          </header>
          {health.duplicateClusters.length === 0 ? (
            <p className="text-sm text-slate-500" data-testid="portfolio-health-no-dupes">
              {t('initiatives.portfolioHealth.noDuplicates', 'Brak wykrytych duplikatów.')}
            </p>
          ) : (
            <ul className="space-y-2" data-testid="portfolio-health-dupes">
              {health.duplicateClusters.map((cl, idx) => (
                <li
                  key={cl.ids.join('-') || idx}
                  className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t('initiatives.portfolioHealth.cluster', 'Grupa {{n}}', { n: idx + 1 })}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      {Math.round(cl.peakScore * 100)}%
                    </span>
                  </div>
                  <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300">
                    {cl.titles.map((tt, i) => (
                      <li key={`${cl.ids[i] ?? i}`} className="truncate">
                        {tt || t('initiatives.portfolioHealth.untitled', '(bez tytułu)')}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default PortfolioHealthView;
