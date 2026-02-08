/**
 * InitiativeCards
 *
 * Rich visual renderer for initiative/project cards in reports.
 * Designed for report context (read-only, no interactions).
 *
 * Displays initiative data as professional cards with:
 * - Strategic intent & role badges
 * - Priority / effort / impact indicators
 * - Budget, ROI, timeline metrics
 * - Effort profile bars (analytical/operational/change)
 * - Status & confidence indicators
 * - Related gap / problem statement
 *
 * Expected JSON format:
 * {
 *   type: "initiatives",
 *   title?: string,
 *   items: [{
 *     name: string,
 *     summary?: string,
 *     status?: string,
 *     strategicIntent?: string,      // Grow | Fix | Stabilize | De-risk | Build Capability
 *     strategicRole?: string,        // Foundation | Enabler | Accelerator | Scaling
 *     priority?: "high" | "medium" | "low",
 *     timeline?: string,
 *     budget?: string | number,
 *     roi?: string | number,
 *     impact?: number,               // 1-5
 *     effort?: number,               // 1-5
 *     effortProfile?: { analytical: number, operational: number, change: number },
 *     owner?: string,
 *     relatedGap?: string,
 *     relatedAxis?: string,
 *     confidence?: "High" | "Medium" | "Low" | number,
 *     tags?: string[],
 *   }],
 *   layout?: "grid" | "list",
 *   columns?: number,
 * }
 */

import {
  AlertTriangle,
  Anchor,
  ArrowUpCircle,
  DollarSign,
  Layers,
  Target,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import React, { useMemo } from 'react';

// ==========================================
// TYPES
// ==========================================

interface InitiativeItem {
  name: string;
  summary?: string;
  description?: string;
  status?: string;
  strategicIntent?: string;
  strategicRole?: string;
  priority?: 'high' | 'medium' | 'low' | string;
  timeline?: string;
  timeframe?: string;
  budget?: string | number;
  roi?: string | number;
  impact?: number;
  effort?: number;
  effortProfile?: {
    analytical?: number;
    operational?: number;
    change?: number;
  };
  owner?: string;
  relatedGap?: string;
  relatedAxis?: string;
  axis?: string;
  confidence?: 'High' | 'Medium' | 'Low' | number | string;
  tags?: string[];
  problemStatement?: string;
}

interface InitiativesData {
  type?: string;
  title?: string;
  items: InitiativeItem[];
  layout?: 'grid' | 'list';
  columns?: number;
}

interface InitiativeCardsProps {
  content: string;
  layout?: 'grid' | 'list';
  columns?: number;
  primaryColor?: string;
  showEffortBars?: boolean;
}

// ==========================================
// PARSER
// ==========================================

function parseInitiativesData(content: string): InitiativesData | null {
  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

    const parsed = JSON.parse(trimmed);

    // { type: "initiatives", items: [...] }
    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed as InitiativesData;
    }

    // Direct array of initiatives
    if (Array.isArray(parsed)) {
      return {
        items: parsed.map((item: any) => ({
          name: String(item.name || item.title || item.initiative || ''),
          summary: item.summary || item.description || undefined,
          status: item.status || undefined,
          strategicIntent: item.strategicIntent || item.intent || undefined,
          strategicRole: item.strategicRole || item.role || undefined,
          priority: item.priority || undefined,
          timeline: item.timeline || item.timeframe || undefined,
          budget: item.budget || item.cost || undefined,
          roi: item.roi || item.expectedRoi || undefined,
          impact: item.impact || undefined,
          effort: item.effort || undefined,
          effortProfile: item.effortProfile || undefined,
          owner: item.owner || item.responsible || undefined,
          relatedGap: item.relatedGap || item.gap || undefined,
          relatedAxis: item.relatedAxis || item.axis || undefined,
          confidence: item.confidence || item.aiConfidence || undefined,
          tags: item.tags || undefined,
          problemStatement: item.problemStatement || item.problem || undefined,
        })),
      };
    }

    // { initiatives: [...] }
    if (parsed.initiatives && Array.isArray(parsed.initiatives)) {
      return { items: parsed.initiatives, title: parsed.title };
    }

    return null;
  } catch {
    return null;
  }
}

// ==========================================
// STYLE HELPERS
// ==========================================

function getIntentColor(intent?: string): string {
  switch (intent) {
    case 'Grow':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    case 'Fix':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
    case 'Stabilize':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    case 'De-risk':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    case 'Build Capability':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  }
}

function getRoleIcon(role?: string) {
  switch (role) {
    case 'Foundation':
      return <Anchor className="w-3 h-3" />;
    case 'Enabler':
      return <Layers className="w-3 h-3" />;
    case 'Accelerator':
      return <Zap className="w-3 h-3" />;
    case 'Scaling':
      return <ArrowUpCircle className="w-3 h-3" />;
    default:
      return null;
  }
}

function getRoleColor(role?: string): string {
  switch (role) {
    case 'Foundation':
      return 'text-slate-600 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    case 'Enabler':
      return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    case 'Accelerator':
      return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    case 'Scaling':
      return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
    default:
      return 'hidden';
  }
}

function getPriorityBadge(priority?: string): { color: string; label: string } {
  switch (priority?.toLowerCase()) {
    case 'high':
    case 'critical':
      return {
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        label: priority.charAt(0).toUpperCase() + priority.slice(1),
      };
    case 'medium':
      return {
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        label: 'Medium',
      };
    case 'low':
      return {
        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        label: 'Low',
      };
    default:
      return { color: '', label: '' };
  }
}

function getConfidenceDot(confidence?: string | number): { color: string; label: string } {
  if (typeof confidence === 'number') {
    if (confidence >= 70) return { color: 'bg-emerald-500', label: 'High' };
    if (confidence >= 40) return { color: 'bg-amber-500', label: 'Medium' };
    if (confidence > 0) return { color: 'bg-red-500', label: 'Low' };
    return { color: 'bg-slate-300', label: '' };
  }
  switch (confidence) {
    case 'High':
      return { color: 'bg-emerald-500', label: 'High' };
    case 'Medium':
      return { color: 'bg-amber-500', label: 'Medium' };
    case 'Low':
      return { color: 'bg-red-500', label: 'Low' };
    default:
      return { color: 'bg-slate-300', label: '' };
  }
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

const EffortBars: React.FC<{ profile: NonNullable<InitiativeItem['effortProfile']> }> = ({
  profile,
}) => {
  const bars = [
    { label: 'Analytical', value: profile.analytical || 0, color: 'bg-blue-500' },
    { label: 'Operational', value: profile.operational || 0, color: 'bg-emerald-500' },
    { label: 'Change', value: profile.change || 0, color: 'bg-rose-500' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {bars.map((bar) => (
        <div key={bar.label} className="space-y-0.5">
          <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400">
            <span>{bar.label}</span>
            <span>{bar.value}/5</span>
          </div>
          <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${bar.color} rounded-full transition-all`}
              style={{ width: `${(bar.value / 5) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const MetricCell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}> = ({ icon, label, value, valueColor = 'text-slate-800 dark:text-slate-200' }) => (
  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-700">
    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
      {icon}
      <span className="text-[9px] uppercase font-bold tracking-wide">{label}</span>
    </div>
    <div className={`text-sm font-semibold ${valueColor}`}>{value}</div>
  </div>
);

const ImpactEffortDots: React.FC<{ impact?: number; effort?: number }> = ({ impact, effort }) => {
  if (impact === undefined && effort === undefined) return null;

  const renderDots = (count: number, maxCount: number, activeColor: string) => (
    <div className="flex gap-0.5">
      {Array.from({ length: maxCount }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < count ? activeColor : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="flex items-center gap-3 text-[10px] text-slate-500">
      {impact !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">Impact</span>
          {renderDots(impact, 5, 'bg-emerald-500')}
        </div>
      )}
      {effort !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">Effort</span>
          {renderDots(effort, 5, 'bg-amber-500')}
        </div>
      )}
    </div>
  );
};

// ==========================================
// INITIATIVE CARD (single)
// ==========================================

const InitiativeCardItem: React.FC<{
  item: InitiativeItem;
  index: number;
  showEffortBars: boolean;
  layout: 'grid' | 'list';
}> = ({ item, index, showEffortBars, layout }) => {
  const priorityBadge = getPriorityBadge(item.priority);
  const confidenceInfo = getConfidenceDot(item.confidence);
  const isGrid = layout === 'grid';

  return (
    <div
      className={`
        group relative bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700
        hover:shadow-md transition-all overflow-hidden
        ${isGrid ? 'p-4' : 'p-4 flex gap-4'}
      `}
    >
      {/* Top color accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 opacity-60" />

      {/* Index badge */}
      <div
        className={`
          flex-shrink-0
          ${isGrid ? 'absolute top-3 right-3' : ''}
          w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800
          flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600
        `}
      >
        {index + 1}
      </div>

      <div className={`flex-1 min-w-0 ${isGrid ? 'pr-10' : ''}`}>
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {item.strategicRole && (
            <span
              className={`inline-flex items-center gap-1 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getRoleColor(item.strategicRole)}`}
            >
              {getRoleIcon(item.strategicRole)}
              {item.strategicRole}
            </span>
          )}
          {item.strategicIntent && (
            <span
              className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getIntentColor(item.strategicIntent)}`}
            >
              {item.strategicIntent}
            </span>
          )}
          {priorityBadge.label && (
            <span
              className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${priorityBadge.color}`}
            >
              {priorityBadge.label}
            </span>
          )}
          {(item.relatedAxis || item.axis) && (
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 dark:bg-slate-700 dark:text-slate-400">
              {item.relatedAxis || item.axis}
            </span>
          )}
          {confidenceInfo.label && (
            <span className="flex items-center gap-1 text-[9px] text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full ${confidenceInfo.color}`} />
              AI: {confidenceInfo.label}
            </span>
          )}
        </div>

        {/* Name */}
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug mb-1">
          {item.name}
        </h4>

        {/* Summary */}
        {(item.summary || item.description) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
            {item.summary || item.description}
          </p>
        )}

        {/* Related Gap */}
        {item.relatedGap && (
          <div className="flex gap-2 mb-3">
            <div className="min-w-[3px] w-[3px] bg-purple-400/50 rounded-full" />
            <div>
              <span className="text-[9px] font-bold text-purple-500 uppercase">Gap</span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                {item.relatedGap}
              </p>
            </div>
          </div>
        )}

        {/* Problem Statement */}
        {item.problemStatement && !item.relatedGap && (
          <div className="flex gap-2 mb-3">
            <div className="min-w-[3px] w-[3px] bg-red-400/50 rounded-full" />
            <div>
              <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                Problem
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                {item.problemStatement}
              </p>
            </div>
          </div>
        )}

        {/* Impact / Effort dots */}
        <ImpactEffortDots impact={item.impact} effort={item.effort} />

        {/* Metrics Grid */}
        {(item.budget || item.roi || item.timeline || item.timeframe || item.owner) && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {item.budget !== undefined && (
              <MetricCell
                icon={<DollarSign className="w-3 h-3" />}
                label="Budget"
                value={
                  typeof item.budget === 'number'
                    ? `$${item.budget.toLocaleString()}`
                    : String(item.budget)
                }
              />
            )}
            {item.roi !== undefined && (
              <MetricCell
                icon={<TrendingUp className="w-3 h-3" />}
                label="ROI"
                value={typeof item.roi === 'number' ? `${item.roi}x` : String(item.roi)}
                valueColor="text-emerald-600 dark:text-emerald-400"
              />
            )}
            {(item.timeline || item.timeframe) && (
              <MetricCell
                icon={<Target className="w-3 h-3" />}
                label="Timeline"
                value={String(item.timeline || item.timeframe)}
              />
            )}
            {item.owner && (
              <MetricCell icon={<User className="w-3 h-3" />} label="Owner" value={item.owner} />
            )}
          </div>
        )}

        {/* Effort Profile */}
        {showEffortBars && item.effortProfile && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5 block">
              Effort Profile
            </span>
            <EffortBars profile={item.effortProfile} />
          </div>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {item.tags.map((tag, i) => (
              <span
                key={i}
                className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const InitiativeCards: React.FC<InitiativeCardsProps> = ({
  content,
  layout = 'grid',
  columns = 2,
  showEffortBars = true,
}) => {
  const data = useMemo(() => parseInitiativesData(content), [content]);

  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <p className="text-sm">No initiative data available</p>
      </div>
    );
  }

  const displayLayout = data.layout || layout;
  const gridCols = data.columns || columns;

  return (
    <div className="space-y-4">
      {data.title && (
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{data.title}</h4>
      )}

      {displayLayout === 'grid' ? (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(gridCols, 3)}, 1fr)` }}
        >
          {data.items.map((item, i) => (
            <InitiativeCardItem
              key={i}
              item={item}
              index={i}
              showEffortBars={showEffortBars}
              layout="grid"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((item, i) => (
            <InitiativeCardItem
              key={i}
              item={item}
              index={i}
              showEffortBars={showEffortBars}
              layout="list"
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
        <span className="text-[10px] text-slate-400 font-medium">
          {data.items.length} initiative{data.items.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          {data.items.filter((i) => i.priority === 'high' || i.priority === 'critical').length >
            0 && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="w-3 h-3" />
              {
                data.items.filter((i) => i.priority === 'high' || i.priority === 'critical').length
              }{' '}
              high priority
            </span>
          )}
          {data.items.filter((i) => i.strategicIntent === 'Grow').length > 0 && (
            <span className="text-emerald-500">
              {data.items.filter((i) => i.strategicIntent === 'Grow').length} growth
            </span>
          )}
          {data.items.filter((i) => i.strategicIntent === 'Fix').length > 0 && (
            <span className="text-red-500">
              {data.items.filter((i) => i.strategicIntent === 'Fix').length} fix
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitiativeCards;
