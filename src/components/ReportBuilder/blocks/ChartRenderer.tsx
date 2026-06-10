/**
 * ChartRenderer
 *
 * Rich chart renderer using Recharts.
 * Supports: Bar, Pie, Radar, and comparison charts.
 * Parses JSON content from AI-generated blocks.
 */

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ==========================================
// TYPES
// ==========================================

interface ChartDataPoint {
  name: string;
  value: number;
  target?: number;
  color?: string;
  label?: string;
}

interface ChartConfig {
  type: 'bar' | 'pie' | 'radar' | 'horizontal_bar' | 'comparison';
  title?: string;
  data: ChartDataPoint[];
  xLabel?: string;
  yLabel?: string;
  showLegend?: boolean;
  colors?: string[];
}

interface ChartRendererProps {
  content: string;
  primaryColor?: string;
  accentColor?: string;
}

// ==========================================
// DEFAULT COLORS
// ==========================================

// Harvard categorical chart palette — crimson-anchored, HBS complementary order.
// was arbitrary Tailwind hexes (blue/indigo/emerald/amber/rose/pink).
// Order: crimson, hbs-blue, hbs-green, hbs-orange, hbs-teal, hbs-purple, hbs-gold, hbs-magenta,
// then dark/light family members to keep array length and distinguishability.
const DEFAULT_COLORS = [
  '#A51C30', // Harvard Crimson — primary series
  '#6578B4', // HBS Blue 2 (was #3b82f6)
  '#52A52E', // HBS Green 2 (was #6366f1)
  '#E87D1E', // HBS Orange 2 (was #3b82f6)
  '#00979D', // HBS Teal 2 (was #10b981)
  '#80408D', // HBS Purple 2 (was #f59e0b)
  '#EBCD00', // HBS Gold 2 (was #f43f5e)
  '#C9006B', // HBS Magenta 2 (was #ec4899)
  '#3B2883', // HBS Blue 1 (dark) (was #6366f1)
  '#AE6429', // HBS Orange 1 (dark) (was #f59e0b)
];

// ==========================================
// CHART PARSER
// ==========================================

function parseChartData(content: string): ChartConfig | null {
  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

    const parsed = JSON.parse(trimmed);

    // Direct chart config format
    if (parsed.type && parsed.data) {
      return parsed as ChartConfig;
    }

    // Array format - convert to bar chart
    if (Array.isArray(parsed)) {
      return {
        type: 'bar',
        data: parsed.map((item: any) => ({
          name: String(item.name || item.label || item.axis || 'Item'),
          value: Number(item.value || item.score || 0),
          target: item.target ? Number(item.target) : undefined,
        })),
      };
    }

    // Assessment matrix format - convert to radar
    if (parsed.type === 'assessment_matrix' && Array.isArray(parsed.axes)) {
      return {
        type: 'radar',
        data: parsed.axes.map((axis: any) => ({
          name: String(axis.axisName || ''),
          value: Number(axis.score || 0),
          target: axis.targetScore ? Number(axis.targetScore) : Number(parsed.scaleMax || 7),
        })),
      };
    }

    // Score summary format
    if (parsed.scores || parsed.metrics) {
      const items = parsed.scores || parsed.metrics;
      if (Array.isArray(items)) {
        return {
          type: 'bar',
          data: items.map((item: any) => ({
            name: String(item.name || item.label || ''),
            value: Number(item.value || item.score || 0),
            target: item.target ? Number(item.target) : undefined,
          })),
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ==========================================
// COMPONENT
// ==========================================

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  content,
  primaryColor = '#A51C30', // was '#3b82f6' — Harvard Crimson brand default
  accentColor = '#6578B4', // was '#6366f1' — HBS Blue 2 complement
}) => {
  const config = useMemo(() => parseChartData(content), [content]);

  if (!config || !config.data || config.data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-600">
        <p className="text-sm">No chart data available</p>
      </div>
    );
  }

  const colors = config.colors || DEFAULT_COLORS;

  // Bar Chart (vertical)
  if (config.type === 'bar' || config.type === 'comparison') {
    const hasTarget = config.data.some((d) => d.target !== undefined);
    return (
      <div className="w-full">
        {config.title && (
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 text-center">
            {config.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={Math.max(250, config.data.length * 40)}>
          <BarChart data={config.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                color: '#f1f5f9',
              }}
            />
            {hasTarget && <Legend />}
            <Bar dataKey="value" name="Current" fill={primaryColor} radius={[4, 4, 0, 0]} />
            {hasTarget && (
              <Bar
                dataKey="target"
                name="Target"
                fill={accentColor}
                radius={[4, 4, 0, 0]}
                opacity={0.4}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Horizontal Bar
  if (config.type === 'horizontal_bar') {
    return (
      <div className="w-full">
        {config.title && (
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 text-center">
            {config.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={Math.max(250, config.data.length * 40)}>
          <BarChart
            data={config.data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748b' }}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                color: '#f1f5f9',
              }}
            />
            <Bar dataKey="value" fill={primaryColor} radius={[0, 4, 4, 0]}>
              {config.data.map((_, idx) => (
                <Cell key={idx} fill={colors[idx % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Pie Chart
  if (config.type === 'pie') {
    return (
      <div className="w-full">
        {config.title && (
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 text-center">
            {config.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={config.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {config.data.map((_, idx) => (
                <Cell key={idx} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                color: '#f1f5f9',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Radar Chart
  if (config.type === 'radar') {
    const hasTarget = config.data.some((d) => d.target !== undefined);
    return (
      <div className="w-full">
        {config.title && (
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 text-center">
            {config.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={config.data} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
            <PolarRadiusAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Radar
              name="Current"
              dataKey="value"
              stroke={primaryColor}
              fill={primaryColor}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            {hasTarget && (
              <Radar
                name="Target"
                dataKey="target"
                stroke={accentColor}
                fill={accentColor}
                fillOpacity={0.1}
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            )}
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                color: '#f1f5f9',
              }}
            />
            {hasTarget && <Legend />}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-center py-8 text-slate-600">
      <p className="text-sm">Unsupported chart type: {config.type}</p>
    </div>
  );
};

export default ChartRenderer;
