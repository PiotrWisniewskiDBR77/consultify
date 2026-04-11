import React from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

export const TextBlockNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) {
      data.onLabelChange(editValue);
    }
  };

  return (
    <div
      className={`relative w-[220px] min-h-[60px] p-3 rounded-xl border border-slate-200/80 dark:border-slate-400/25 bg-white/95 dark:bg-navy-900/80 dark:backdrop-blur-md shadow-lg shadow-slate-200/50 dark:shadow-[0_0_12px_rgba(148,163,184,0.15)] transition-shadow ${selected ? 'ring-2 ring-primary-500/60 shadow-xl' : ''}`}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
          }}
          className="w-full min-h-[40px] bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none resize-none border-b border-primary-400"
          rows={2}
        />
      ) : (
        <div>
          {data?.semanticLabel && (
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {String(data.semanticLabel)}
            </div>
          )}
          <div
            className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words"
            style={typeof data?.fontSize === 'number' ? { fontSize: data.fontSize } : undefined}
          >
            {data?.label || ''}
          </div>
        </div>
      )}
      {Array.isArray(data?.artifactLinks) && data.artifactLinks.length > 0 && (
        <div
          className="absolute -bottom-2 -left-2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 text-white text-[8px] font-bold shadow-sm cursor-pointer hover:bg-indigo-600 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent('idea-workspace-quick-action', {
                detail: { action: 'open_linked_artifacts', nodeId },
              })
            );
          }}
          title={`${data.artifactLinks.length} linked artifact${data.artifactLinks.length !== 1 ? 's' : ''}`}
        >
          🔗
        </div>
      )}
      {data?._converted && (
        <div className="absolute top-1 right-1 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] shadow-sm" title="Converted">
          ✓
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};
