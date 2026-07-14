/**
 * SubMapBreadcrumb — Breadcrumb navigation for drill-down sub-maps.
 * Shows the path from root to the currently focused node.
 */
import { ChevronRight, Home } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface BreadcrumbItem {
  nodeId: string;
  label: string;
}

interface SubMapBreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (nodeId: string | null) => void;
  isPl: boolean;
}

export const SubMapBreadcrumb: React.FC<SubMapBreadcrumbProps> = ({ path, onNavigate }) => {
  const { t } = useTranslation();
  if (path.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm border border-c-border-subtle dark:border-c-border-subtle shadow-2xl">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
        title={t('ideas.mindmap.backMainMap', 'Back to main map')}
      >
        <Home size={12} />
        <span>{t('ideas.mindmap.mainMap', 'Main map')}</span>
      </button>

      {path.map((item, idx) => (
        <React.Fragment key={item.nodeId}>
          <ChevronRight size={12} className="text-c-text-secondary shrink-0" />
          {idx < path.length - 1 ? (
            <button
              onClick={() => onNavigate(item.nodeId)}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors truncate max-w-[140px]"
              title={item.label}
            >
              {item.label}
            </button>
          ) : (
            <span
              className="px-2 py-1 text-[11px] font-bold text-c-warning dark:text-c-warning truncate max-w-[140px]"
              title={item.label}
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SubMapBreadcrumb;
