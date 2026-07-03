/**
 * ColorPalette — Palette picker + auto-color assignment for the Idea Table.
 * Predefined palettes (Pastel, Vibrant, Earth, Ocean, Sunset) theme the entire table.
 */
import { Check, Palette } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TableNode } from './tableTypes';
import { COLOR_PALETTES, ROW_ACCENT_COLORS } from './tableTypes';

interface ColorPaletteProps {
  open: boolean;
  onClose: () => void;
  activePalette: string;
  onPaletteChange: (paletteId: string) => void;
  onAutoAssign: () => void;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({
  open,
  onClose,
  activePalette,
  onPaletteChange,
  onAutoAssign,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full mt-1 z-overlay w-[240px] rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Palette size={10} className="inline mr-1" />
          {isPl ? 'Paleta kolorów' : 'Color Palette'}
        </span>
      </div>

      <div className="space-y-2">
        {Object.entries(COLOR_PALETTES).map(([id, palette]) => (
          <button
            key={id}
            onClick={() => onPaletteChange(id)}
            className={`w-full flex items-center gap-2 p-2 rounded-xl transition-colors ${
              activePalette === id
                ? 'bg-primary-500/10 ring-1 ring-primary-500/30'
                : 'hover:bg-slate-50 dark:hover:bg-navy-800'
            }`}
          >
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {palette.colors.slice(0, 6).map((c, i) => (
                <div key={i} className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex-1 text-left">
              {palette.name}
            </span>
            {activePalette === id && <Check size={12} className="text-primary-500" />}
          </button>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-navy-700/60">
        <button
          onClick={() => {
            onAutoAssign();
            onClose();
          }}
          className="w-full px-3 py-2 rounded-xl text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 transition-colors"
        >
          {isPl ? 'Auto-przypisz kolory do wierszy' : 'Auto-assign colors to rows'}
        </button>
      </div>
    </div>
  );
};

export function autoAssignColors(
  nodes: TableNode[],
  paletteId: string,
  groupByField?: string
): Map<string, string> {
  const palette = COLOR_PALETTES[paletteId] || COLOR_PALETTES.vibrant;
  const colorMap = new Map<string, string>();

  if (groupByField) {
    const groups = new Map<string, number>();
    let colorIdx = 0;
    for (const node of nodes) {
      const groupVal = String(node.data?.[groupByField] || 'other');
      if (!groups.has(groupVal)) {
        groups.set(groupVal, colorIdx % palette.colors.length);
        colorIdx++;
      }
      colorMap.set(node.id, palette.colors[groups.get(groupVal)!]);
    }
  } else {
    nodes.forEach((node, idx) => {
      colorMap.set(node.id, palette.colors[idx % palette.colors.length]);
    });
  }

  return colorMap;
}

export default ColorPalette;
