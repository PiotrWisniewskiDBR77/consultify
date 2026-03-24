/**
 * SubMapBreadcrumb — Breadcrumb navigation for drill-down sub-maps.
 * Shows the path from root to the currently focused node.
 */
import { ChevronRight, Home } from 'lucide-react';
import React from 'react';

export interface BreadcrumbItem {
  nodeId: string;
  label: string;
}

interface SubMapBreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (nodeId: string | null) => void;
  isPl: boolean;
}

export const SubMapBreadcrumb: React.FC<SubMapBreadcrumbProps> = ({ path, onNavigate, isPl }) => {
  if (path.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-white/85 dark:bg-navy-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.06] shadow-2xl">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        title={isPl ? 'Wróć do głównej mapy' : 'Back to main map'}
      >
        <Home size={12} />
        <span>{isPl ? 'Mapa główna' : 'Main map'}</span>
      </button>

      {path.map((item, idx) => (
        <React.Fragment key={item.nodeId}>
          <ChevronRight size={12} className="text-slate-400 shrink-0" />
          {idx < path.length - 1 ? (
            <button
              onClick={() => onNavigate(item.nodeId)}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors truncate max-w-[140px]"
              title={item.label}
            >
              {item.label}
            </button>
          ) : (
            <span
              className="px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate max-w-[140px]"
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
