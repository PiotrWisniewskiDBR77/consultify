import { MoreVertical, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface MobileToolbarMenuProps {
  children: React.ReactNode;
}

export const MobileToolbarMenu: React.FC<MobileToolbarMenuProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="md:hidden relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg bg-c-surface-raised text-c-text-secondary transition-colors"
        aria-label={open ? 'Close menu' : 'More actions'}
      >
        {open ? <X size={16} /> : <MoreVertical size={16} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-overlay bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] shadow-xl p-2 min-w-[200px] max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-1" onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileToolbarMenu;
