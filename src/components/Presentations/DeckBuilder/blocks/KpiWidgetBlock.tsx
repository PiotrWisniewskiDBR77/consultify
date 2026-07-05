import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';
import type { BlockDensity } from './blockDensity';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
  /** GROW-CONTENT: 'hero' when this metric is the dominant content of its region. */
  density?: BlockDensity;
}

export const KpiWidgetBlock: React.FC<Props> = ({ block, theme, density = 'default' }) => {
  const label = (block.content.label as string) || 'KPI';
  const value = (block.content.value as string | number) || '—';
  const unit = (block.content.unit as string) || '';
  const trend = block.content.trend as 'up' | 'down' | 'stable' | undefined;
  const change = (block.content.change as string) || '';
  // GROW-CONTENT: benchmark is a real content field in the VTS fixture — surface
  // it so a lone hero metric carries a comparison instead of a bare number.
  const benchmark = (block.content.benchmark as string) || '';

  const trendColor =
    trend === 'up' ? theme.chartPalette[2] || '#16A34A' : trend === 'down' ? '#DC2626' : theme.colors.textSecondary;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const isHero = density === 'hero';

  return (
    <div
      className={`rounded-2xl text-center ${isHero ? 'py-7 px-8' : 'p-4'}`}
      style={{
        backgroundColor: theme.colors.primary + (isHero ? '0A' : '08'),
        border: `1px solid ${theme.colors.primary}${isHero ? '1F' : '12'}`,
      }}
    >
      <p
        className={`font-semibold tracking-wide uppercase ${isHero ? 'text-sm mb-3' : 'text-xs mb-1'}`}
        style={{ color: theme.colors.textSecondary }}
      >
        {label}
      </p>
      <p
        className={`font-extrabold leading-none tracking-tight ${
          isHero ? 'text-[7rem]' : 'text-3xl'
        }`}
        style={{ color: theme.colors.heading }}
      >
        {value}
        {unit && <span className={isHero ? 'text-5xl ml-2' : 'text-lg ml-1'}>{unit}</span>}
      </p>
      {(trend || change) && (
        <div className={`flex items-center justify-center gap-1.5 ${isHero ? 'mt-4' : 'mt-1'}`}>
          <TrendIcon size={isHero ? 22 : 12} style={{ color: trendColor }} />
          {change && (
            <span
              className={`font-semibold ${isHero ? 'text-xl' : 'text-xs'}`}
              style={{ color: trendColor }}
            >
              {change}
            </span>
          )}
        </div>
      )}
      {benchmark && (
        <p
          className={`${isHero ? 'text-base mt-5' : 'text-[11px] mt-2'}`}
          style={{ color: theme.colors.textSecondary }}
        >
          {benchmark}
        </p>
      )}
    </div>
  );
};
