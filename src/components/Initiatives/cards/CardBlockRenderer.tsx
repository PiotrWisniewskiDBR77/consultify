/**
 * CardBlockRenderer — F3 (D11): generyczny renderer kart inicjatyw z bloków.
 *
 * Bierze `CardSpec` (deklaratywne bloki — patrz `cardBlockSchema.ts`) i mapuje
 * każdy blok → element UI. To docelowy renderer, na który migrują 4–6 kart
 * rdzenia (problem / teza / business-case …) zamiast bespoke JSX.
 *
 * Zasady:
 *   - Samodzielny, bez zależności od kontekstu inicjatywy (czyste dane in → UI).
 *   - Dark-mode aware przez istniejące klasy tailwind (slate/blue/emerald/amber/rose).
 *   - i18n-fallback: komponent renderuje DOSTARCZONĄ treść (AI/serwer tłumaczy);
 *     własne etykiety (puste stany) mają proste PL/EN fallbacki bez twardej zależności.
 *   - Robustny: nieznany/uszkodzony blok jest pomijany (lub pokazany dyskretnie),
 *     pusta karta → łagodny empty-state. NIE rzuca.
 *
 * UWAGA (F3): chart renderuje się jako PROSTY pasek proporcji + legenda
 * (placeholder), nie pełny wykres — pełny chart to późniejszy krok.
 */

import React from 'react';

import {
  type CalloutTone,
  type CardBlock,
  type CardSpec,
  type KpiTile,
  validateCardSpec,
} from './cardBlockSchema';

// ── Empty-state etykiety (lekki fallback bez i18n-providera) ─────────────────

const EMPTY_LABELS = {
  pl: 'Brak treści do wyświetlenia.',
  en: 'Nothing to display yet.',
};

export interface CardBlockRendererProps {
  spec: CardSpec | null | undefined;
  /** Język dla fallback-etykiet pustego stanu (domyślnie 'pl'). */
  lang?: 'pl' | 'en';
  /** Renderuj tytuł karty (domyślnie true). */
  showTitle?: boolean;
  /** Pomiń niewalidne bloki cicho (domyślnie true). false = pokaż znacznik. */
  silentInvalid?: boolean;
  className?: string;
}

// ── Tone → klasy tailwind (callout) ──────────────────────────────────────────

const TONE_CLASSES: Record<CalloutTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100',
  danger:
    'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100',
};

const TREND_CLASSES: Record<NonNullable<KpiTile['trend']>, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-rose-600 dark:text-rose-400',
  flat: 'text-slate-500 dark:text-slate-400',
};

// ── Per-block renderery ──────────────────────────────────────────────────────

function HeadingView({ block }: { block: Extract<CardBlock, { type: 'heading' }> }) {
  const cls =
    block.level === 4
      ? 'text-sm font-semibold text-slate-700 dark:text-slate-200'
      : 'text-base font-semibold text-slate-900 dark:text-slate-100';
  return (
    <p className={`${cls} mt-1`} data-block="heading">
      {block.text}
    </p>
  );
}

function ParagraphView({ block }: { block: Extract<CardBlock, { type: 'paragraph' }> }) {
  const emphasis = block.emphasis ?? 'normal';
  const cls =
    emphasis === 'lead'
      ? 'text-[15px] font-medium leading-relaxed text-slate-800 dark:text-slate-100'
      : emphasis === 'muted'
        ? 'text-sm leading-relaxed text-slate-500 dark:text-slate-400'
        : 'text-sm leading-relaxed text-slate-700 dark:text-slate-300';
  return (
    <p className={cls} data-block="paragraph">
      {block.text}
    </p>
  );
}

function KpiStripView({ block }: { block: Extract<CardBlock, { type: 'kpi_strip' }> }) {
  const tiles = (block.tiles ?? []).filter((t) => t && t.label && t.value);
  if (tiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-block="kpi_strip">
      {tiles.map((tile, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/60"
          data-kpi-tile
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {tile.label}
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">
            {tile.value}
          </div>
          {tile.delta ? (
            <div className={`mt-0.5 text-xs font-medium ${TREND_CLASSES[tile.trend ?? 'flat']}`}>
              {tile.delta}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BulletListView({ block }: { block: Extract<CardBlock, { type: 'bullet_list' }> }) {
  const items = (block.items ?? []).filter((s) => typeof s === 'string' && s.trim().length > 0);
  if (items.length === 0) return null;
  const ListTag = block.ordered ? 'ol' : 'ul';
  return (
    <ListTag
      className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300`}
      data-block="bullet_list"
    >
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ListTag>
  );
}

function TableView({ block }: { block: Extract<CardBlock, { type: 'table' }> }) {
  const columns = block.columns ?? [];
  const rows = block.rows ?? [];
  if (columns.length === 0) return null;
  return (
    <div className="overflow-x-auto" data-block="table">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              {columns.map((_, ci) => (
                <td key={ci} className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                  {row?.[ci] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartView({ block }: { block: Extract<CardBlock, { type: 'chart' }> }) {
  const series = (block.series ?? []).filter(
    (s) =>
      s && typeof s.label === 'string' && typeof s.value === 'number' && Number.isFinite(s.value)
  );
  if (series.length === 0) return null;
  const max = Math.max(...series.map((s) => Math.abs(s.value)), 1);
  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40"
      data-block="chart"
      data-chart-kind={block.chartKind}
    >
      {block.title ? (
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {block.title}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-2" data-chart-bar>
            <span className="w-24 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">
              {s.label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <span
                className="block h-full rounded-full bg-blue-500 dark:bg-blue-400"
                style={{ width: `${Math.round((Math.abs(s.value) / max) * 100)}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalloutView({ block }: { block: Extract<CardBlock, { type: 'callout' }> }) {
  if (!block.text || !block.text.trim()) return null;
  const tone = (TONE_CLASSES[block.tone] ? block.tone : 'info') as CalloutTone;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${TONE_CLASSES[tone]}`}
      data-block="callout"
      data-tone={tone}
      role="note"
    >
      {block.title ? <div className="mb-0.5 font-semibold">{block.title}</div> : null}
      <div>{block.text}</div>
    </div>
  );
}

/**
 * Czy blok ma JAKĄKOLWIEK renderowalną treść? Używane do liczenia
 * faktycznie wyrenderowanych bloków (komponenty zwracające null nie liczą się).
 */
function blockHasContent(block: CardBlock): boolean {
  switch (block?.type) {
    case 'heading':
    case 'paragraph':
    case 'callout':
      return typeof block.text === 'string' && block.text.trim().length > 0;
    case 'bullet_list':
      return (block.items ?? []).some((s) => typeof s === 'string' && s.trim().length > 0);
    case 'kpi_strip':
      return (block.tiles ?? []).some((t) => t && t.label && t.value);
    case 'table':
      return (block.columns ?? []).length > 0;
    case 'chart':
      return (block.series ?? []).some(
        (s) => s && typeof s.value === 'number' && Number.isFinite(s.value)
      );
    default:
      return false;
  }
}

/** Mapuje JEDEN blok → element. Zwraca null dla bloku bez treści. */
function renderBlock(block: CardBlock, index: number, silentInvalid: boolean): React.ReactNode {
  switch (block?.type) {
    case 'heading':
      return <HeadingView key={index} block={block} />;
    case 'paragraph':
      return <ParagraphView key={index} block={block} />;
    case 'kpi_strip':
      return <KpiStripView key={index} block={block} />;
    case 'bullet_list':
      return <BulletListView key={index} block={block} />;
    case 'table':
      return <TableView key={index} block={block} />;
    case 'chart':
      return <ChartView key={index} block={block} />;
    case 'callout':
      return <CalloutView key={index} block={block} />;
    default:
      // Nieznany typ — cicho pomiń lub pokaż dyskretny znacznik (debug).
      return silentInvalid ? null : (
        <div
          key={index}
          className="rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-400 dark:border-slate-600"
          data-block="unknown"
        >
          {(block as { type?: string })?.type ?? 'unknown'}
        </div>
      );
  }
}

// ── Public component ─────────────────────────────────────────────────────────

export const CardBlockRenderer: React.FC<CardBlockRendererProps> = ({
  spec,
  lang = 'pl',
  showTitle = true,
  silentInvalid = true,
  className,
}) => {
  const emptyLabel = EMPTY_LABELS[lang] ?? EMPTY_LABELS.pl;

  // Łagodny empty-state: brak spec / brak (poprawnych) bloków.
  const blocks = spec && Array.isArray(spec.blocks) ? spec.blocks : [];
  const rendered = blocks
    .map((b, i) => renderBlock(b, i, silentInvalid))
    .filter((node): node is React.ReactElement => node != null);
  // Czy cokolwiek faktycznie ma treść (komponenty bloków mogą zwrócić null wewnętrznie)?
  const hasContent = blocks.some((b) => b && blockHasContent(b));

  if (!spec || !hasContent) {
    return (
      <div
        className={`text-sm italic text-slate-400 dark:text-slate-500 ${className ?? ''}`}
        data-card-empty
      >
        {emptyLabel}
      </div>
    );
  }

  // Walidacja jest informacyjna (renderer i tak jest fail-open) — eksponujemy
  // liczbę issues jako data-atrybut, by debug/test mógł to sprawdzić.
  const issueCount = validateCardSpec(spec).length;

  return (
    <section
      className={`space-y-3 ${className ?? ''}`}
      data-card-renderer
      data-section-key={spec.sectionKey}
      data-issues={issueCount}
    >
      {showTitle && spec.title ? (
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100" data-card-title>
          {spec.title}
        </h3>
      ) : null}
      {rendered}
    </section>
  );
};

export default CardBlockRenderer;
