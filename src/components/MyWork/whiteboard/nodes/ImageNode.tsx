import { Image as ImageIcon } from 'lucide-react';
import React from 'react';
import { Handle, type NodeProps, NodeResizer, Position } from 'reactflow';

import { commentCountOf, CommentPinBadge } from './CommentPinBadge';
import { WB_HANDLE_CLASS } from './whiteboardNodeHelpers';

export const ImageNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const imgSrc = data?.imageUrl || data?.src;
  const commentCount = commentCountOf(data);

  return (
    <>
      <NodeResizer
        isVisible={selected && !data?.locked}
        minWidth={80}
        minHeight={60}
        keepAspectRatio
      />
      {/* Comment badge sits in a non-clipped overlay sibling — the image
          wrapper below uses overflow-hidden to crop the photo, which would
          otherwise clip a corner-anchored badge. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto">
          <CommentPinBadge nodeId={nodeId} count={commentCount} />
        </div>
      </div>
      <div
        className={`group relative w-full h-full rounded-xl overflow-hidden border border-c-border-subtle shadow-sm dark:shadow-[0_0_12px_rgba(148,163,184,0.1)] transition-shadow ${selected ? 'ring-2 ring-c-border-strong shadow-lg' : ''}`}
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
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={data?.label || 'Image'}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-c-surface-raised text-c-text-secondary">
            <ImageIcon size={24} />
            <div className="text-[10px] mt-1">{data?.label || 'Image'}</div>
          </div>
        )}
        {/* Caption scrim sits over an arbitrary photo, so it stays a fixed
            dark wash (theme-independent) with white text for legibility. */}
        {data?.label && imgSrc && (
          <div
            className="absolute bottom-0 left-0 right-0 text-white text-[10px] px-2 py-1 truncate"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            {data.label}
          </div>
        )}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-c-border-strong !-bottom-1"
        />
      </div>
    </>
  );
};
