import { Image as ImageIcon } from 'lucide-react';
import React from 'react';
import { Handle, type NodeProps, NodeResizer, Position } from 'reactflow';

export const ImageNode: React.FC<NodeProps> = ({ data, selected }) => {
  const imgSrc = data?.imageUrl || data?.src;

  return (
    <>
      <NodeResizer
        isVisible={selected && !data?.locked}
        minWidth={80}
        minHeight={60}
        keepAspectRatio
      />
      <div
        className={`relative w-full h-full rounded-xl overflow-hidden border border-c-border-subtle shadow-sm dark:shadow-[0_0_12px_rgba(148,163,184,0.1)] transition-shadow ${selected ? 'ring-2 ring-c-border-strong shadow-lg' : ''}`}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-c-border-strong !-top-1" />
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
