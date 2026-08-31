/**
 * Seed default-hidden columns for a `FilterableTable`/`StandardTable` list
 * whose full column count cannot fit its container even at the readability
 * floor (`FIT_MIN_COLUMN_WIDTH` in `FilterableTable.tsx`) — the arithmetic
 * case documented there ("nawet podłogi się nie mieszczą → uczciwe
 * przewijanie"). An honest horizontal scroll is correct behaviour for the
 * table kernel, but it still reads to a first-time user as the same
 * "ostatnia kolumna ucięta" defect the kernel fix (97-czternascie-kolumn,
 * 2026-08-30) was meant to end — the columns past the fold are simply not
 * visible without knowing to scroll.
 *
 * `FilterableTable` already owns a per-column visibility toggle (the
 * "Ustawienia widoku" / pstryczek popover), persisted in `localStorage` under
 * `filterableTable.cols.<persistKey>`. There is no prop on `TableColumn` to
 * declare a column hidden-by-default — `FilterableTable.tsx` is locked for
 * this change (another workstream owns it) — so this seeds THAT SAME storage
 * format, once, before the table's own persisted-layout read on first mount.
 * The user can re-enable any hidden column from the same popover at any
 * time; the moment they touch visibility themselves, `FilterableTable`'s own
 * persistence takes over and this seed is never written again.
 *
 * Call this synchronously in the component body (e.g. via a `useRef` guard),
 * NOT inside a `useEffect` — it must run before the table child mounts and
 * reads `localStorage` for the first time, and effects fire after mount.
 */
export function seedDefaultHiddenColumns(
  persistKey: string,
  hiddenColumnIds: readonly string[]
): void {
  if (typeof window === 'undefined' || hiddenColumnIds.length === 0) return;
  const storageKey = `filterableTable.cols.${persistKey}`;
  try {
    // Never override a layout the user (or a prior seed) already produced.
    if (window.localStorage.getItem(storageKey) !== null) return;
    const visibility: Record<string, boolean> = {};
    for (const id of hiddenColumnIds) visibility[id] = false;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ widths: {}, visibility, order: {} })
    );
  } catch {
    // Storage unavailable/quota — table just falls back to all-visible, harmless.
  }
}
