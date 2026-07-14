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

function trendColor(trend?: NarrowedKpiItem['trend']): string {
  if (trend === 'up') return '#1e6b32';
  if (trend === 'down') return '#9b1c2e';
  return '#64748b';
}

export const DocKpiStrip: React.FC<DocKpiStripProps> = ({ content }) => {
  const { t } = useTranslation();
  const narrowed = isNarrowed(content) ? content : narrowKpiContent(content);

  if (!narrowed || narrowed.items.length === 0) {
    return (
      <div
        className="doc-kpi-strip__empty"
        style={{ padding: '16px 0', color: '#64748b', fontSize: 13 }}
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
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 14px',
              background: '#ffffff',
            }}
          >
            <div
              className="doc-kpi-strip__label"
              style={{
                fontSize: 12,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 4,
              }}
            >
              {item.label}
            </div>
            <div
              className="doc-kpi-strip__value"
              style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', lineHeight: 1.1 }}
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
          style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}
        >
          {narrowed.caption}
        </figcaption>
      )}
    </figure>
  );
};

export default DocKpiStrip;
