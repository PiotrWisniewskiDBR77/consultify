/**
 * DecisionTimelineRenderer - Enterprise decision impact timeline
 *
 * Visualizes a sequence of decisions, milestones, and their impacts over time.
 * Designed for board-level presentation and strategic planning:
 * - Horizontal timeline with date markers
 * - Decision nodes with impact indicators (positive/negative/neutral)
 * - Dependency arrows between related decisions
 * - Risk/opportunity windows
 * - Export capabilities
 *
 * Expected JSON format:
 * {
 *   "title": "Digital Transformation Timeline",
 *   "timeRange": { "start": "2026-Q1", "end": "2027-Q4" },
 *   "events": [
 *     {
 *       "id": "1",
 *       "date": "2026-Q1",
 *       "label": "Cloud Migration Decision",
 *       "type": "decision",
 *       "impact": "high",
 *       "status": "completed",
 *       "description": "Moved to hybrid cloud architecture",
 *       "outcome": "positive",
 *       "metrics": { "costSaving": "$1.2M/yr", "uptime": "99.95%" }
 *     },
 *     {
 *       "id": "2",
 *       "date": "2026-Q2",
 *       "label": "Team Restructuring",
 *       "type": "milestone",
 *       "impact": "medium",
 *       "status": "in_progress",
 *       "description": "Agile transformation of delivery teams",
 *       "dependsOn": ["1"]
 *     }
 *   ],
 *   "riskWindows": [
 *     { "start": "2026-Q2", "end": "2026-Q3", "label": "Talent shortage risk", "severity": "high" }
 *   ]
 * }
 */

import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Download,
  Flag,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineEvent {
  id: string;
  date: string;
  label: string;
  type: 'decision' | 'milestone' | 'risk' | 'opportunity';
  impact: 'high' | 'medium' | 'low';
  status: 'completed' | 'in_progress' | 'planned' | 'cancelled';
  description?: string;
  outcome?: 'positive' | 'negative' | 'neutral' | 'mixed';
  metrics?: Record<string, string>;
  dependsOn?: string[];
}

interface RiskWindow {
  start: string;
  end: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
}

interface TimelineData {
  title?: string;
  timeRange?: { start: string; end: string };
  events: TimelineEvent[];
  riskWindows?: RiskWindow[];
}

interface DecisionTimelineRendererProps {
  content: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTimelineContent(content: string): TimelineData | null {
  try {
    const data = JSON.parse(content);
    if (!data.events || !Array.isArray(data.events)) return null;
    return data as TimelineData;
  } catch {
    return null;
  }
}

function impactColor(impact: string): string {
  switch (impact) {
    case 'high':
      return 'border-danger-400 dark:border-danger-600';
    case 'medium':
      return 'border-amber-400 dark:border-amber-600';
    case 'low':
      return 'border-green-400 dark:border-green-600';
    default:
      return 'border-slate-300 dark:border-slate-600';
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    case 'in_progress':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
    case 'planned':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    case 'cancelled':
      return 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 line-through';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  }
}

function outcomeIcon(outcome?: string) {
  switch (outcome) {
    case 'positive':
      return <TrendingUp size={12} className="text-green-500" />;
    case 'negative':
      return <AlertTriangle size={12} className="text-danger-500" />;
    case 'mixed':
      return <AlertTriangle size={12} className="text-amber-500" />;
    default:
      return <Clock size={12} className="text-slate-600" />;
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'decision':
      return <Flag size={12} className="text-c-text-secondary" />;
    case 'milestone':
      return <Check size={12} className="text-blue-500" />;
    case 'risk':
      return <AlertTriangle size={12} className="text-danger-500" />;
    case 'opportunity':
      return <TrendingUp size={12} className="text-green-500" />;
    default:
      return <Clock size={12} className="text-slate-600" />;
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'high':
      return 'bg-danger-50 dark:bg-danger-900/10 border-danger-200 dark:border-danger-800/50';
    case 'medium':
      return 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50';
    case 'low':
      return 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/50';
    default:
      return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DecisionTimelineRenderer: React.FC<DecisionTimelineRendererProps> = ({
  content,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [copied, setCopied] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const data = useMemo(() => parseTimelineContent(content), [content]);

  const handleCopy = () => {
    if (!data) return;
    const text = data.events
      .map(
        (e) =>
          `${e.date} | ${e.label} (${e.type}) — ${e.status}${e.description ? ': ' + e.description : ''}`
      )
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExport = () => {
    if (!data) return;
    let md = `# ${data.title || 'Decision Impact Timeline'}\n\n`;
    md += `| Date | Event | Type | Impact | Status | Outcome |\n`;
    md += `|------|-------|------|--------|--------|---------|\n`;
    for (const e of data.events) {
      md += `| ${e.date} | ${e.label} | ${e.type} | ${e.impact} | ${e.status} | ${e.outcome || '—'} |\n`;
    }
    if (data.riskWindows && data.riskWindows.length > 0) {
      md += `\n## Risk Windows\n\n`;
      for (const r of data.riskWindows) {
        md += `- **${r.label}** (${r.start} → ${r.end}) — Severity: ${r.severity}\n`;
      }
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'decision-timeline.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return (
      <div className={`p-4 text-sm text-slate-500 dark:text-slate-400 ${className}`}>
        {isPl ? 'Nie udało się sparsować danych timeline.' : 'Failed to parse timeline data.'}
      </div>
    );
  }

  const completedCount = data.events.filter((e) => e.status === 'completed').length;
  const totalCount = data.events.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-navy-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {data.title || (isPl ? 'Linia czasu decyzji' : 'Decision Impact Timeline')}
          </h3>
          {data.timeRange && (
            <p className="text-[10px] text-slate-600 dark:text-slate-500 mt-0.5">
              {data.timeRange.start} → {data.timeRange.end}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            title={isPl ? 'Kopiuj' : 'Copy'}
          >
            <Copy size={14} />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            title={isPl ? 'Eksportuj' : 'Export'}
          >
            <Download size={14} />
          </button>
          {copied && (
            <span className="text-[10px] text-green-500 animate-pulse">
              {isPl ? 'Skopiowano!' : 'Copied!'}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-navy-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {isPl ? 'Postęp realizacji' : 'Implementation progress'}
          </span>
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
            {completedCount}/{totalCount} ({progressPct}%)
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-c-surface-raised to-c-surface-raised rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Risk Windows */}
      {data.riskWindows && data.riskWindows.length > 0 && (
        <div className="px-4 py-2 space-y-1.5 border-b border-slate-200 dark:border-navy-800">
          {data.riskWindows.map((rw, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] ${severityColor(rw.severity)}`}
            >
              <AlertTriangle size={10} className="flex-shrink-0" />
              <span className="font-medium">{rw.label}</span>
              <span className="text-[9px] opacity-70 ml-auto">
                {rw.start} → {rw.end}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline Events */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-navy-700" />

          {data.events.map((event, idx) => {
            const isExpanded = expandedEvent === event.id;
            const hasDeps = event.dependsOn && event.dependsOn.length > 0;

            return (
              <div key={event.id} className="relative pl-10 pb-5 last:pb-0">
                {/* Timeline node */}
                <div
                  className={`absolute left-2.5 top-0.5 w-[13px] h-[13px] rounded-full border-2 ${impactColor(event.impact)} bg-white dark:bg-navy-900 z-10`}
                >
                  {event.status === 'completed' && (
                    <div className="absolute inset-[2px] rounded-full bg-green-400 dark:bg-green-500" />
                  )}
                  {event.status === 'in_progress' && (
                    <div className="absolute inset-[2px] rounded-full bg-blue-400 dark:bg-blue-500 animate-pulse" />
                  )}
                </div>

                {/* Event card */}
                <button
                  onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-500">
                      {event.date}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${statusBg(event.status)}`}
                    >
                      {event.status.replace('_', ' ')}
                    </span>
                    {event.outcome && outcomeIcon(event.outcome)}
                    {typeIcon(event.type)}
                  </div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-c-text dark:group-hover:text-c-text transition-colors">
                    {event.label}
                  </p>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-2 p-2.5 bg-slate-50 dark:bg-navy-800/50 rounded-lg border border-slate-200 dark:border-navy-700 space-y-2 animate-in fade-in duration-200">
                    {event.description && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {event.description}
                      </p>
                    )}

                    {event.metrics && Object.keys(event.metrics).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(event.metrics).map(([key, value]) => (
                          <div
                            key={key}
                            className="px-2 py-1 bg-white dark:bg-navy-900 rounded border border-slate-200 dark:border-navy-700"
                          >
                            <span className="text-[9px] text-slate-600 block">{key}</span>
                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {hasDeps && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-600">
                        <ArrowRight size={10} />
                        <span>
                          {isPl ? 'Zależy od:' : 'Depends on:'}{' '}
                          {event
                            .dependsOn!.map((depId) => {
                              const dep = data.events.find((e) => e.id === depId);
                              return dep?.label || depId;
                            })
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
