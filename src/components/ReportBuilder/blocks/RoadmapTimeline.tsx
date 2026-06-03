/**
 * RoadmapTimeline
 *
 * Visual timeline renderer for roadmap/action plan blocks.
 * Shows:
 * - Phases with milestones
 * - Timeline orientation (horizontal/vertical)
 * - Status indicators
 * - Owner badges
 */

import { CheckCircle, Circle, Clock, Flag } from 'lucide-react';
import React, { useMemo } from 'react';

// ==========================================
// TYPES
// ==========================================

interface Milestone {
  title: string;
  description?: string;
  date?: string;
  status?: 'completed' | 'in_progress' | 'upcoming' | 'at_risk';
  owner?: string;
}

interface Phase {
  title: string;
  description?: string;
  timeframe?: string;
  status?: 'completed' | 'in_progress' | 'upcoming';
  milestones?: Milestone[];
  items?: string[];
}

interface RoadmapData {
  type?: 'roadmap' | 'timeline' | 'action_plan';
  phases: Phase[];
  title?: string;
  orientation?: 'horizontal' | 'vertical';
}

interface RoadmapTimelineProps {
  content: string;
  primaryColor?: string;
  orientation?: 'horizontal' | 'vertical';
}

// ==========================================
// HELPERS
// ==========================================

function parseRoadmapData(content: string): RoadmapData | null {
  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

    const parsed = JSON.parse(trimmed);

    if (parsed.phases && Array.isArray(parsed.phases)) {
      return parsed as RoadmapData;
    }

    if (Array.isArray(parsed)) {
      return {
        phases: parsed.map((item: any) => ({
          title: String(item.title || item.name || item.phase || ''),
          description: item.description || undefined,
          timeframe: item.timeframe || item.timeline || item.date || undefined,
          status: item.status || undefined,
          milestones: Array.isArray(item.milestones) ? item.milestones : undefined,
          items: Array.isArray(item.items || item.actions) ? item.items || item.actions : undefined,
        })),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function getStatusIcon(status?: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    case 'in_progress':
      return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
    case 'at_risk':
      return <Flag className="w-5 h-5 text-rose-500" />;
    default:
      return <Circle className="w-5 h-5 text-slate-600 dark:text-slate-600" />;
  }
}

function getPhaseColor(index: number, status?: string): string {
  if (status === 'completed') return 'from-emerald-500 to-emerald-600';
  if (status === 'in_progress') return 'from-blue-500 to-blue-600';
  if (status === 'at_risk') return 'from-rose-500 to-rose-600';

  const colors = [
    'from-blue-500 to-blue-600',
    'from-primary-500 to-primary-600',
    'from-indigo-500 to-indigo-600',
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-amber-500 to-amber-600',
  ];
  return colors[index % colors.length];
}

// ==========================================
// COMPONENT
// ==========================================

export const RoadmapTimeline: React.FC<RoadmapTimelineProps> = ({
  content,
  orientation = 'vertical',
}) => {
  const data = useMemo(() => parseRoadmapData(content), [content]);

  if (!data || !data.phases || data.phases.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-600">
        <p className="text-sm">No roadmap data available</p>
      </div>
    );
  }

  const displayOrientation = data.orientation || orientation;

  // Horizontal Timeline
  if (displayOrientation === 'horizontal') {
    return (
      <div className="space-y-3">
        {data.title && (
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{data.title}</h4>
        )}
        <div className="relative overflow-x-auto pb-4">
          {/* Timeline Line */}
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700" />

          <div className="flex gap-4 min-w-max px-4">
            {data.phases.map((phase, i) => (
              <div key={i} className="relative flex flex-col items-center w-48">
                {/* Node */}
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getPhaseColor(i, phase.status)} flex items-center justify-center text-white font-bold text-lg shadow-lg z-10`}
                >
                  {i + 1}
                </div>

                {/* Timeframe */}
                {phase.timeframe && (
                  <span className="mt-2 text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    {phase.timeframe}
                  </span>
                )}

                {/* Title */}
                <h5 className="mt-1 text-sm font-semibold text-slate-800 dark:text-white text-center">
                  {phase.title}
                </h5>

                {/* Description */}
                {phase.description && (
                  <p className="mt-1 text-[11px] text-slate-500 text-center line-clamp-3">
                    {phase.description}
                  </p>
                )}

                {/* Items */}
                {phase.items && phase.items.length > 0 && (
                  <div className="mt-2 space-y-1 w-full">
                    {phase.items.slice(0, 3).map((item, ii) => (
                      <div key={ii} className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                        <span className="text-[10px] text-slate-500 leading-tight">{item}</span>
                      </div>
                    ))}
                    {phase.items.length > 3 && (
                      <span className="text-[10px] text-slate-600">
                        +{phase.items.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Vertical Timeline (default)
  return (
    <div className="space-y-3">
      {data.title && (
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{data.title}</h4>
      )}

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

        <div className="space-y-6">
          {data.phases.map((phase, i) => (
            <div key={i} className="relative flex gap-4">
              {/* Timeline Node */}
              <div className="flex-shrink-0 relative z-10">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPhaseColor(i, phase.status)} flex items-center justify-center text-white font-bold shadow-md`}
                >
                  {i + 1}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-white">
                      {phase.title}
                    </h5>
                    {phase.timeframe && (
                      <span className="text-xs text-slate-600 font-medium">{phase.timeframe}</span>
                    )}
                  </div>
                  {getStatusIcon(phase.status)}
                </div>

                {phase.description && (
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {phase.description}
                  </p>
                )}

                {/* Items */}
                {phase.items && phase.items.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {phase.items.map((item, ii) => (
                      <div key={ii} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1 flex-shrink-0" />
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Milestones */}
                {phase.milestones && phase.milestones.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {phase.milestones.map((ms, mi) => (
                      <div
                        key={mi}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <Flag className="w-3 h-3 text-slate-600" />
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                          {ms.title}
                        </span>
                        {ms.owner && (
                          <span className="text-[9px] text-slate-600 ml-1">({ms.owner})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoadmapTimeline;
