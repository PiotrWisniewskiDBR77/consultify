import { Link2 } from 'lucide-react';
import React from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

import { commentCountOf, CommentPinBadge } from './CommentPinBadge';
import { WB_HANDLE_CLASS } from './whiteboardNodeHelpers';

export const LinkNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const [meta, setMeta] = React.useState<{
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    favicon?: string;
  }>({});
  const fetched = React.useRef(false);

  React.useEffect(() => {
    if (fetched.current || !data?.url || data?.ogTitle) return;
    fetched.current = true;
    const url = String(data.url);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMeta(d);
      })
      .catch(() => undefined);
  }, [data?.url, data?.ogTitle]);

  const ogTitle = data?.ogTitle || meta.ogTitle;
  const ogDesc = data?.ogDescription || meta.ogDescription;
  const ogImage = data?.ogImage || meta.ogImage;
  const favicon = data?.favicon || meta.favicon;

  const handleClick = React.useCallback(() => {
    if (data?.url) window.open(String(data.url), '_blank', 'noopener');
  }, [data?.url]);

  const commentCount = commentCountOf(data);

  return (
    <div className="relative w-[220px]">
      {/* Comment badge lives outside the card's overflow-hidden clip so it
          isn't cropped by the rounded corners / og-image crop below. */}
      <CommentPinBadge nodeId={nodeId} count={commentCount} />
      <div
        className={`group relative w-[220px] rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface dark:backdrop-blur-md shadow-sm dark:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition-shadow overflow-hidden cursor-pointer hover:shadow-md ${selected ? 'ring-2 ring-c-border-strong shadow-lg' : ''}`}
        onClick={handleClick}
      >
        {/* Fala 10: 4-side magnetic handles, matching StickyNoteNode (Fala 8).
            The two UNNAMED handles (target/Top, source/Bottom) are kept
            id-less on purpose — pre-Fala-10 persisted edges have no
            sourceHandle/targetHandle and react-flow resolves an undefined
            handle id to the sole id-less handle of that type on the node,
            so this keeps every existing edge rendering unchanged. All new
            handles get an explicit id so they never collide with that
            fallback. */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !bg-c-border-strong !-top-1"
        />
        <Handle type="source" id="top-source" position={Position.Top} className={WB_HANDLE_CLASS} />
        <Handle type="target" id="left" position={Position.Left} className={WB_HANDLE_CLASS} />
        <Handle
          type="source"
          id="left-source"
          position={Position.Left}
          className={WB_HANDLE_CLASS}
        />
        <Handle type="target" id="right" position={Position.Right} className={WB_HANDLE_CLASS} />
        <Handle
          type="source"
          id="right-source"
          position={Position.Right}
          className={WB_HANDLE_CLASS}
        />
        <Handle type="target" id="bottom" position={Position.Bottom} className={WB_HANDLE_CLASS} />
        {ogImage && (
          <div className="w-full h-[100px] bg-c-surface-raised overflow-hidden">
            <img src={ogImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-c-surface-raised flex items-center justify-center shrink-0">
              {favicon ? (
                <img src={favicon} alt="" className="w-3.5 h-3.5" />
              ) : (
                <Link2 size={10} className="text-c-text-secondary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-c-text truncate">
                {ogTitle || data?.label || data?.url || 'Link'}
              </div>
              {ogDesc && (
                <div className="text-[9px] text-c-text-muted line-clamp-2 mt-0.5 leading-relaxed">
                  {ogDesc}
                </div>
              )}
              {data?.url && (
                <div className="text-[8px] text-c-text-secondary truncate mt-0.5">{data.url}</div>
              )}
            </div>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-c-border-strong !-bottom-1"
        />
      </div>
    </div>
  );
};
