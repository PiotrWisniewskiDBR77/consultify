/**
 * Sparkline
 *
 * A simple sparkline chart component for showing KPI trends.
 */

import React, { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  targetValue?: number;
  isOnTarget?: boolean;
  showTarget?: boolean;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 32,
  targetValue,
  isOnTarget = true,
  showTarget = true,
  className = '',
}) => {
  const { path, targetY, minVal, maxVal, points } = useMemo(() => {
    if (data.length === 0) {
      return { path: '', targetY: null, minVal: 0, maxVal: 0, points: [] };
    }

    const allValues = targetValue !== undefined ? [...data, targetValue] : data;
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;
    const padding = 2;

    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * effectiveWidth;
      const y = padding + (1 - (value - minVal) / range) * effectiveHeight;
      return { x, y, value };
    });

    // Create smooth path using bezier curves
    let path = '';
    if (points.length > 0) {
      path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpX = (prev.x + curr.x) / 2;
        path += ` Q ${cpX} ${prev.y} ${curr.x} ${curr.y}`;
      }
    }

    // Calculate target line Y position
    let targetY = null;
    if (targetValue !== undefined && showTarget) {
      targetY = padding + (1 - (targetValue - minVal) / range) * effectiveHeight;
    }

    return { path, targetY, minVal, maxVal, points };
  }, [data, width, height, targetValue, showTarget]);

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-slate-600 text-xs ${className}`}
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const lineColor = isOnTarget ? 'stroke-green-500' : 'stroke-red-500';
  const dotColor = isOnTarget ? 'fill-green-500' : 'fill-red-500';
  const areaColor = isOnTarget ? 'fill-green-500/10' : 'fill-red-500/10';

  // Create area path
  const areaPath = useMemo(() => {
    if (points.length === 0) return '';

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    let area = `M ${firstPoint.x} ${height - 2}`;
    area += ` L ${firstPoint.x} ${firstPoint.y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      area += ` Q ${cpX} ${prev.y} ${curr.x} ${curr.y}`;
    }

    area += ` L ${lastPoint.x} ${height - 2} Z`;
    return area;
  }, [points, height]);

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      {/* Area fill */}
      <path d={areaPath} className={areaColor} />

      {/* Target line */}
      {targetY !== null && (
        <line
          x1={2}
          y1={targetY}
          x2={width - 2}
          y2={targetY}
          className="stroke-slate-500"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}

      {/* Main line */}
      <path
        d={path}
        className={lineColor}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot (latest value) */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          className={dotColor}
        />
      )}
    </svg>
  );
};

export default Sparkline;
