/**
 * CommandPalette — shared popover used by both the `/`-command and `@`-mention
 * surfaces. Presentational only: it renders a styled, keyboard-navigable list
 * above the composer. Selection / navigation state is owned by the composer via
 * useComposerCommands; this component just paints `items` and reports clicks.
 *
 * Styling mirrors ToolsMenu's dropdown (bottom-full, backdrop blur, rounded-2xl)
 * with the same getBoundingClientRect-based maxHeight clamp so it never overflows
 * above the viewport when the composer sits near the bottom of the screen.
 */

import type { LucideIcon } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

export interface CommandPaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
}

interface CommandPaletteProps {
  header: string;
  items: CommandPaletteItem[];
  activeIndex: number;
  emptyText: string;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  header,
  items,
  activeIndex,
  emptyText,
  onSelect,
  onHover,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [maxHeight, setMaxHeight] = React.useState<number | undefined>(undefined);

  // Clamp height to the space above the composer (same technique as ToolsMenu).
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const availableAbove = rect.bottom - 24;
      setMaxHeight(Math.max(200, availableAbove));
    }
  }, [items.length]);

  // Keep the highlighted row visible during keyboard navigation.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Close on outside click (clicking back into the textarea also closes — fine,
  // the trigger is recomputed on the next keystroke).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      role="listbox"
      className="
        absolute left-0 right-0 bottom-full mb-2 z-50
        py-1.5
        bg-white/95 dark:bg-[#1a1d2e]/95 backdrop-blur-xl
        border border-slate-200/40 dark:border-white/[0.08]
        rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
        animate-in fade-in-0 slide-in-from-bottom-2 duration-150
        overflow-y-auto overflow-x-hidden
      "
      style={{ maxHeight: maxHeight ? `${maxHeight}px` : '60vh' }}
    >
      <div className="px-3.5 pt-1.5 pb-1">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
          {header}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-3.5 py-2 text-[13px] text-slate-600 dark:text-slate-500">
          {emptyText}
        </div>
      ) : (
        items.map((item, index) => {
          const Icon = item.icon;
          const isActive = index === activeIndex;
          return (
            <button
              key={`${item.id}-${index}`}
              ref={isActive ? activeRef : undefined}
              role="option"
              aria-selected={isActive}
              // onMouseDown (not onClick) so selection fires before the textarea blur,
              // keeping the caret position valid for the insertion.
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(index);
              }}
              onMouseEnter={() => onHover(index)}
              className={`
                w-full flex items-center gap-3 px-3.5 py-2 text-left transition-colors
                ${isActive ? 'bg-primary-50/70 dark:bg-primary-900/15' : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.04]'}
              `}
            >
              {Icon && (
                <Icon
                  size={16}
                  className={`shrink-0 ${isActive ? 'text-primary-500' : 'text-slate-600 dark:text-slate-500'}`}
                />
              )}
              <span className="flex flex-col min-w-0 flex-1">
                <span
                  className={`text-[13px] truncate ${isActive ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-slate-700 dark:text-slate-200'}`}
                >
                  {item.label}
                </span>
                {item.sublabel && (
                  <span className="text-[11px] text-slate-600 dark:text-slate-500 truncate">
                    {item.sublabel}
                  </span>
                )}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
};
