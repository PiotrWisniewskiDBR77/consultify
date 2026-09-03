/**
 * Document Studio — DocKpiStrip (R3).
 *
 * Pure renderer for a strip of KPI cards. Consumes the narrowed
 * {@link NarrowedKpiContent} produced by `narrowKpiContent`, which already
 * collapses BOTH source shapes (`items[]` and `columns+rows`) into a single
 * `items[]` list. This component therefore renders one shape.
 *
 * A convenience overload also accepts raw content and narrows it internally,
 * so callers can pass either the narrowed object or the raw block content.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { type NarrowedKpiContent, type NarrowedKpiItem, narrowKpiContent } from './docBlockContent';

export interface DocKpiStripProps {
  /** Either an already-narrowed `{items}` object, or raw block content. */
  content: NarrowedKpiContent | unknown;
}

function isNarrowed(c: unknown): c is NarrowedKpiContent {
  return typeof c === 'object' && c !== null && Array.isArray((c as { items?: unknown }).items);
}

// axe color-contrast: the previous fixed hex pair (#1e6b32 up / #9b1c2e down)
// was theme-blind — on the dark surface (var(--c-surface) = #0f172a) it
// measured only 2.72:1 / 3.75:1 (< 4.5). The `--c-success`/`--c-danger`/
// `--c-text-muted` tokens already carry theme-appropriate values that pass
// 4.5:1 against both surfaces (light ≥4.66:1, dark ≥5.18:1).
function trendColor(trend?: NarrowedKpiItem['trend']): string {
  if (trend === 'up') return 'var(--c-success)';
  if (trend === 'down') return 'var(--c-danger)';
  return 'var(--c-text-muted)';
}

export const DocKpiStrip: React.FC<DocKpiStripProps> = ({ content }) => {
  const { t } = useTranslation();
  const narrowed = isNarrowed(content) ? content : narrowKpiContent(content);

  if (!narrowed || narrowed.items.length === 0) {
    return (
      <div
        className="doc-kpi-strip__empty"
        style={{ padding: '16px 0', color: 'var(--c-text-secondary)', fontSize: 13 }}
      >
        {t('documentStudio.blocks.noKpiData', 'No KPIs available')}
      </div>
    );
  }

  return (
    <figure className="doc-kpi-strip" style={{ margin: 0, width: '100%' }}>
      <div
        className="doc-kpi-strip__grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
          gap: 12,
        }}
      >
        {narrowed.items.map((item, idx) => (
          <div
            key={idx}
            className="doc-kpi-strip__card"
            style={{
              border: '1px solid var(--c-border)',
              borderRadius: 8,
              padding: '12px 14px',
              background: 'var(--c-surface)',
            }}
          >
            <div
              className="doc-kpi-strip__label"
              style={{
                fontSize: 12,
                color: 'var(--c-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 4,
              }}
            >
              {item.label}
            </div>
            <div
              className="doc-kpi-strip__value"
              style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.1 }}
            >
              {item.value || '—'}
            </div>
            {item.delta && (
              <div
                className="doc-kpi-strip__delta"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: trendColor(item.trend),
                  marginTop: 4,
                }}
              >
                {item.delta}
              </div>
            )}
          </div>
        ))}
      </div>
      {narrowed.caption && (
        <figcaption
          className="doc-kpi-strip__caption"
          style={{ fontSize: 12, color: 'var(--c-text-secondary)', marginTop: 6 }}
        >
          {narrowed.caption}
        </figcaption>
      )}
    </figure>
  );
};

export default DocKpiStrip;
