/**
 * IdeaSummaryCardNode — Auto-generated summary card for a group of nodes.
 *
 * Displays: element count, key themes, completeness score.
 * Updates dynamically when nodes are added/removed from the group.
 */
import { BarChart3, FileText, Hash } from 'lucide-react';
import React from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

export const SummaryCardNode: React.FC<NodeProps> = ({ data, selected }) => {
  const themes: string[] = data?.themes || [];
  const nodeCount: number = data?.nodeCount || 0;
  const completeness: number = data?.completeness || 0;
  const title: string = data?.label || 'Summary';

  const completenessColor =
    completeness >= 75
      ? 'text-emerald-500'
      : completeness >= 50
        ? 'text-amber-500'
        : 'text-slate-600';

  const completenessBarColor =
    completeness >= 75 ? 'bg-emerald-400' : completeness >= 50 ? 'bg-amber-400' : 'bg-slate-300';

  return (
    <div
      className={`relative w-[220px] p-3 rounded-2xl border-2 transition-all ${
        selected
          ? 'border-c-info ring-2 ring-c-info/30 shadow-lg'
          : 'border-c-info/20 shadow-md'
      } bg-gradient-to-br from-c-info/5 to-c-info/5 dark:from-c-info/10 dark:to-c-info/10`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-c-info !-top-1" />

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 rounded-lg bg-c-info/20 flex items-center justify-center">
          <FileText size={10} className="text-c-info" />
        </div>
        <div className="text-[10px] font-bold text-c-info uppercase tracking-wider flex-1 truncate">
          {title}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1">
          <Hash size={9} className="text-slate-600" />
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
            {nodeCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <BarChart3 size={9} className={completenessColor} />
          <span className={`text-[10px] font-semibold ${completenessColor}`}>{completeness}%</span>
        </div>
      </div>

      {/* Completeness bar */}
      <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-navy-700 mb-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${completenessBarColor}`}
          style={{ width: `${Math.min(100, completeness)}%` }}
        />
      </div>

      {/* Themes */}
      {themes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {themes.slice(0, 4).map((theme, i) => (
            <span
              key={i}
              className="inline-block px-1.5 py-0.5 rounded-full text-[8px] font-semibold bg-c-info/15 text-c-info"
            >
              {theme}
            </span>
          ))}
          {themes.length > 4 && (
            <span className="text-[8px] text-slate-600">+{themes.length - 4}</span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-c-info !-bottom-1"
      />
    </div>
  );
};

export default SummaryCardNode;
