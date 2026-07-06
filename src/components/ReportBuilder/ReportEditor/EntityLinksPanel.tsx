/**
 * EntityLinksPanel
 *
 * Sidebar panel showing entities (initiatives, tasks, decisions) linked from a report.
 * Fetches data on mount and presents collapsible sections with status badges.
 */

import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Loader2,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '../../../services/api';

// ==========================================
// TYPES
// ==========================================

interface LinkedEntity {
  id: string;
  title: string;
  status: string;
}

interface EntityLinksData {
  initiatives: LinkedEntity[];
  tasks: LinkedEntity[];
  decisions: LinkedEntity[];
}

interface EntityLinksPanelProps {
  reportId: string;
  isPl: boolean;
  onNavigateToEntity?: (type: string, id: string) => void;
}

// ==========================================
// HELPERS
// ==========================================

const STATUS_BADGE_COLORS: Record<string, string> = {
  DRAFT: 'bg-c-text-muted text-c-text-secondary',
  draft: 'bg-c-text-muted text-c-text-secondary',
  step3: 'bg-c-text-muted text-c-text-secondary',
  ACTIVE: 'bg-blue-500/20 text-blue-400',
  active: 'bg-blue-500/20 text-blue-400',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  completed: 'bg-green-500/20 text-green-400',
  done: 'bg-green-500/20 text-green-400',
  APPROVED: 'bg-emerald-500/20 text-emerald-400',
  REJECTED: 'bg-danger-500/20 text-danger-400',
  CANCELLED: 'bg-danger-500/20 text-danger-400',
  BLOCKED: 'bg-amber-500/20 text-amber-400',
};

function getStatusBadgeClass(status: string): string {
  return STATUS_BADGE_COLORS[status] || 'bg-c-text-muted text-c-text-secondary';
}

// ==========================================
// COMPONENT
// ==========================================

export const EntityLinksPanel: React.FC<EntityLinksPanelProps> = ({
  reportId,
  isPl,
  onNavigateToEntity,
}) => {
  const [data, setData] = useState<EntityLinksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    initiatives: true,
    tasks: true,
    decisions: true,
  });

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await Api.get(`/report-builder/${reportId}/entity-links`);
      setData(res as EntityLinksData);
    } catch {
      setError(isPl ? 'Nie udało się pobrać powiązań' : 'Failed to load entity links');
    } finally {
      setLoading(false);
    }
  }, [reportId, isPl]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalCount =
    (data?.initiatives.length || 0) + (data?.tasks.length || 0) + (data?.decisions.length || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-c-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">{isPl ? 'Ładowanie…' : 'Loading…'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 text-center text-sm text-danger-400">
        <p>{error}</p>
        <button
          onClick={fetchLinks}
          className="mt-2 text-xs text-c-accent hover:text-c-accent underline"
        >
          {isPl ? 'Spróbuj ponownie' : 'Try again'}
        </button>
      </div>
    );
  }

  if (!data || totalCount === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-c-text-secondary">
        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>{isPl ? 'Brak powiązanych elementów' : 'No linked entities'}</p>
        <p className="mt-1 text-xs text-c-text-secondary">
          {isPl
            ? 'Utwórz inicjatywę z sekcji raportu, aby zobaczyć powiązania'
            : 'Create an initiative from a report section to see links here'}
        </p>
      </div>
    );
  }

  const sections: Array<{
    key: string;
    label: string;
    icon: React.ElementType;
    iconColor: string;
    items: LinkedEntity[];
  }> = [
    {
      key: 'initiatives',
      label: isPl ? 'Inicjatywy' : 'Initiatives',
      icon: Target,
      iconColor: 'text-c-accent',
      items: data.initiatives,
    },
    {
      key: 'tasks',
      label: isPl ? 'Zadania' : 'Tasks',
      icon: CheckSquare,
      iconColor: 'text-blue-400',
      items: data.tasks,
    },
    {
      key: 'decisions',
      label: isPl ? 'Decyzje' : 'Decisions',
      icon: GitBranch,
      iconColor: 'text-amber-400',
      items: data.decisions,
    },
  ];

  return (
    <div className="space-y-1">
      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSections[section.key];
        const count = section.items.length;

        return (
          <div key={section.key}>
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-c-text-secondary shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-c-text-secondary shrink-0" />
              )}
              <Icon className={`h-4 w-4 ${section.iconColor} shrink-0`} />
              <span className="flex-1 text-left">{section.label}</span>
              {count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-c-surface text-c-text-secondary">
                  {count}
                </span>
              )}
            </button>

            {isExpanded && count > 0 && (
              <div className="ml-5 pl-3 border-l border-c-border-subtle space-y-0.5 mb-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigateToEntity?.(section.key, item.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-c-text-secondary hover:text-c-text hover:bg-c-surface rounded-md transition-colors group"
                  >
                    <span className="flex-1 text-left truncate">{item.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-medium ${getStatusBadgeClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                    {onNavigateToEntity && (
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0 transition-opacity" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {isExpanded && count === 0 && (
              <p className="ml-10 text-xs text-c-text-secondary py-1">{isPl ? 'Brak' : 'None'}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EntityLinksPanel;
