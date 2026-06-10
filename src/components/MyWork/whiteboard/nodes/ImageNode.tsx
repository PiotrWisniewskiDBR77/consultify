import { Image as ImageIcon } from 'lucide-react';
import React from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

export const ImageNode: React.FC<NodeProps> = ({ data, selected }) => {
  const imgSrc = data?.imageUrl || data?.src;
  const [nodeWidth, setNodeWidth] = React.useState<number>(data?.width || 200);
  const resizing = React.useRef(false);
  const startX = React.useRef(0);
  const startW = React.useRef(0);

  const onResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizing.current = true;
      startX.current = e.clientX;
      startW.current = nodeWidth;

      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        const delta = ev.clientX - startX.current;
        const next = Math.max(80, startW.current + delta);
        setNodeWidth(next);
        if (data?.onWidthChange) data.onWidthChange(next);
      };
      const onUp = () => {
        resizing.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [nodeWidth, data]
  );

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-500/20 shadow-sm dark:shadow-[0_0_12px_rgba(148,163,184,0.1)] transition-shadow ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : ''}`}
      style={{ width: nodeWidth }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={data?.label || 'Image'}
          className="w-full object-contain"
          draggable={false}
        />
      ) : (
        <div
          className="w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-navy-900/80 text-slate-600"
          style={{ height: data?.height || 150 }}
        >
          <ImageIcon size={24} />
          <div className="text-[10px] mt-1">{data?.label || 'Image'}</div>
        </div>
      )}
      {data?.label && imgSrc && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] px-2 py-1 truncate">
          {data.label}
        </div>
      )}
      {!data?.locked && (
        <div
          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-primary-400/20 transition-colors"
          onMouseDown={onResizeStart}
        />
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};
