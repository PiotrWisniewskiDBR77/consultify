import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';
import { type NodeProps, NodeResizer } from 'reactflow';

import { useIsDark } from './whiteboardNodeHelpers';

export const FrameNode: React.FC<NodeProps> = ({ data, selected }) => {
  const isDark = useIsDark();
  const lightBg = data?.bgColor || 'rgba(241,245,249,0.6)';
  const darkBg = 'rgba(15,23,42,0.7)';
  const collapsed = Boolean(data?.collapsed);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onCollapseToggle) data.onCollapseToggle(!collapsed);
  };

  const childCount = data?.childCount ?? 0;

  return (
    <>
      <NodeResizer
        isVisible={selected && !data?.locked && !collapsed}
        minWidth={160}
        minHeight={120}
      />
      <div
        className={`relative p-3 rounded-2xl border-2 transition-all ${selected ? 'ring-2 ring-primary-500/60 border-primary-400/80 shadow-lg shadow-primary-500/10' : 'border-slate-300/80 dark:border-indigo-400/25'} shadow-xl shadow-slate-300/25 dark:shadow-[0_0_20px_rgba(99,102,241,0.12)]`}
        style={{
          width: collapsed ? data?.width || 400 : '100%',
          height: collapsed ? 'auto' : '100%',
          minHeight: collapsed ? 'auto' : data?.height || 300,
          backgroundColor: isDark ? darkBg : lightBg,
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          {data?.semanticLabel && (
            <span className="px-1.5 py-0.5 rounded-full bg-white/70 dark:bg-navy-800/60 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {String(data.semanticLabel)}
            </span>
          )}
          {!data?.locked && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200/60 dark:hover:bg-navy-700/60 transition-colors shrink-0"
            >
              {collapsed ? (
                <ChevronRight size={12} className="text-slate-500 dark:text-slate-400" />
              ) : (
                <ChevronDown size={12} className="text-slate-500 dark:text-slate-400" />
              )}
            </button>
          )}
          <div
            className="flex-1 cursor-text min-w-0"
            onDoubleClick={() => {
              if (!data?.locked) {
                setEditValue(String(data?.label || ''));
                setEditing(true);
              }
            }}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-full bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none border-b border-primary-400 uppercase tracking-wider"
              />
            ) : (
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
                {data?.label || 'Frame'}
              </div>
            )}
          </div>
          {collapsed && childCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-slate-200 dark:bg-navy-700 text-[9px] font-semibold text-slate-600 dark:text-slate-300 px-1 shrink-0">
              {childCount}
            </span>
          )}
        </div>
        {collapsed && (
          <div className="text-[10px] text-slate-600 dark:text-slate-500 italic">
            {childCount > 0 ? `${childCount} item${childCount !== 1 ? 's' : ''} hidden` : 'Empty'}
          </div>
        )}
      </div>
    </>
  );
};
