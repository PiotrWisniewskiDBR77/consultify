// components/Megatrend/TrendRadarCard.tsx
// UI component for the "Trend Radar Map" card of the Megatrend Scanner module
// ---------------------------------------------------------------
// Professional, responsive, dark‑mode ready radar visualization.
// Features:
//   • Industry selector (dropdown)
//   • Fetches data from /api/megatrends/radar
//   • Uses existing RadarChart for the grid
//   • Overlays SVG points: colour = type, size = impact, radius = ring
//   • Hover tooltip with emoji, label and short description
//   • Click opens a modal with full trend details (placeholder for AI insights)
//   • Legend, loading spinner, error handling, smooth animations
// ---------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/shared/states';

import { RadarChart } from '../RadarChart';

// Types matching the backend response from /api/megatrends/radar
export interface RadarMegatrend {
  id: string; // stable key
  label: string;
  type: 'Technology' | 'Business' | 'Societal';
  ring: 'Now' | 'Watch Closely' | 'On the Horizon';
  impact: number; // 1‑7
  description?: string;
}

// Ring order determines distance from centre (inner → outer)
const ringOrder: Record<RadarMegatrend['ring'], number> = {
  Now: 1,
  'Watch Closely': 2,
  'On the Horizon': 3,
};

// Colours and emojis per type
const typeColors: Record<RadarMegatrend['type'], { bg: string; border: string; emoji: string }> = {
  Technology: { bg: 'bg-c-tag-1', border: 'border-c-tag-1', emoji: '🔵' },
  Business: { bg: 'bg-c-tag-3', border: 'border-c-tag-3', emoji: '🟣' },
  Societal: { bg: 'bg-c-tag-9', border: 'border-c-tag-9', emoji: '🟠' },
};

interface TrendRadarCardProps {
  data: RadarMegatrend[];
  onTrendSelect?: (trendId: string) => void;
  loading?: boolean;
  error?: string | null;
  /** Refetch handler — renders a "Try again" button on the error state. */
  onRetry?: () => void;
}

export const TrendRadarCard: React.FC<TrendRadarCardProps> = ({
  data = [],
  onTrendSelect,
  loading,
  error,
  onRetry,
}) => {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Responsive size - based on container width (max 500 px)
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number>(400);
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setSize(Math.min(width, 500));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Helper to compute SVG coordinates (same as RadarChart)
  const radius = size / 2;
  const maxVal = 7; // impact range
  const angleSlice = data.length ? (Math.PI * 2) / data.length : 0;
  // getCoords removed (unused)

  // Render SVG points on top of the RadarChart
  const renderPoints = () =>
    data.map((mt, i) => {
      const ringFactor = ringOrder[mt.ring] / 3; // 0.33, 0.66, 1.0
      const baseRadius = (radius - 30) * ringFactor;
      const angle = i * angleSlice - Math.PI / 2;
      const x = radius + baseRadius * Math.cos(angle);
      const y = radius + baseRadius * Math.sin(angle);
      const sizePx = Math.max(6, (mt.impact / maxVal) * 20); // 6-20 px
      const { bg, border, emoji } = typeColors[mt.type];
      return (
        <g key={mt.id}>
          <circle
            cx={x}
            cy={y}
            r={sizePx}
            className={`${bg} ${border} stroke-2 transition-transform duration-200 ease-out hover:scale-125 cursor-pointer`}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({
                x: rect.x + rect.width / 2,
                y: rect.y,
                text: `${emoji} ${mt.label}: ${mt.description ?? ''}`,
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => onTrendSelect?.(mt.id)}
            aria-label={`Megatrend ${mt.label}, type ${mt.type}, impact ${mt.impact}`}
          />
        </g>
      );
    });

  return (
    <div className="bg-c-surface rounded-xl shadow-lg p-6 space-y-4" ref={containerRef}>
      <h2 className="text-2xl font-semibold text-c-text">Trend Radar Map</h2>

      {loading && (
        <div className="flex items-center space-x-2 text-c-text-secondary">
          <svg
            className="animate-spin h-5 w-5 text-c-accent"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <span>Loading radar data…</span>
        </div>
      )}
      {/* Was a bare, untranslated `Error: {error}` line with no recovery. */}
      {error && (
        <EmptyState
          variant="error"
          compact
          title={t('tools.megatrends.radarLoadFailed', 'Could not load the trend radar')}
          description={t(
            'tools.megatrends.loadFailedDesc',
            'The megatrend baseline for this industry could not be fetched.'
          )}
          onRetry={onRetry}
        />
      )}

      <div className="relative mx-auto" style={{ width: size, height: size }}>
        {/* Base radar grid – dummy max values just to draw the web */}
        <RadarChart data={data.map((d) => ({ label: d.label, value: maxVal }))} size={size} />
        {/* Overlay points */}
        <svg
          className="absolute inset-0"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {renderPoints()}
        </svg>
        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute bg-c-text text-c-bg text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg"
            style={{ left: tooltip.x - 50, top: tooltip.y - 40 }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center space-x-6 mt-4 text-sm text-c-text-secondary">
        {Object.entries(typeColors).map(([type, { emoji }]) => (
          <div key={type} className="flex items-center space-x-1">
            <span>{emoji}</span>
            <span>{type}</span>
          </div>
        ))}
        <div className="flex items-center space-x-1">
          <span className="inline-block w-3 h-3 bg-c-surface-raised rounded-full"></span>
          <span>Impact size (larger = stronger)</span>
        </div>
      </div>

      {/* Detail modal Removed: Handled by parent via onTrendSelect */}
    </div>
  );
};

export default TrendRadarCard;
