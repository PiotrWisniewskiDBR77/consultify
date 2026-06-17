/**
 * usePersistedColumnWidths — column-width state that survives reload.
 *
 * M03 L-10: the My Work §27 tables (Tasks / Decisions / Inbox) kept column
 * widths in plain useState, so any user resize was lost on reload. This hook
 * is a drop-in replacement for `useState(getDefaults())` that hydrates from
 * localStorage on mount and persists on change, keyed per table.
 */
import { useEffect, useState } from 'react';

import type { ColumnWidths } from '@/components/ui/ResizableTable';

export function usePersistedColumnWidths(
  storageKey: string,
  getDefaults: () => ColumnWidths
): readonly [ColumnWidths, React.Dispatch<React.SetStateAction<ColumnWidths>>] {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge over defaults so a newly-added column still gets a width.
        return { ...getDefaults(), ...parsed } as ColumnWidths;
      }
    } catch {
      /* ignore malformed storage */
    }
    return getDefaults();
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [storageKey, columnWidths]);

  return [columnWidths, setColumnWidths] as const;
}
