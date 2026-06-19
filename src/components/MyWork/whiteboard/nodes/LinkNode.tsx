import { Link2 } from 'lucide-react';
import React from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

export const LinkNode: React.FC<NodeProps> = ({ data, selected }) => {
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

  return (
    <div
      className={`relative w-[220px] rounded-xl border border-slate-200 dark:border-blue-500/25 bg-white dark:bg-navy-900/80 dark:backdrop-blur-md shadow-sm dark:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition-shadow overflow-hidden cursor-pointer hover:shadow-md ${selected ? 'ring-2 ring-slate-500/60 shadow-lg' : ''}`}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {ogImage && (
        <div className="w-full h-[100px] bg-slate-100 dark:bg-navy-900/60 overflow-hidden">
          <img src={ogImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-slate-100 dark:bg-navy-900/60 flex items-center justify-center shrink-0">
            {favicon ? (
              <img src={favicon} alt="" className="w-3.5 h-3.5" />
            ) : (
              <Link2 size={10} className="text-slate-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
              {ogTitle || data?.label || data?.url || 'Link'}
            </div>
            {ogDesc && (
              <div className="text-[9px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                {ogDesc}
              </div>
            )}
            {data?.url && (
              <div className="text-[8px] text-slate-600 truncate mt-0.5">{data.url}</div>
            )}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};
