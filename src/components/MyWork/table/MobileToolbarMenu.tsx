import { MoreHorizontal, X } from 'lucide-react';
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
        className="p-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 transition-colors"
        aria-label={open ? 'Close menu' : 'More actions'}
      >
        {open ? <X size={16} /> : <MoreHorizontal size={16} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-overlay bg-white dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-navy-700 shadow-xl p-2 min-w-[200px] max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-1" onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileToolbarMenu;
