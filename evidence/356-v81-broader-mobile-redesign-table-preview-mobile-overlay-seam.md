## V8.1 Evidence - broader `Mobile` redesign - table preview mobile overlay seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Mobile` redesign
Status: `active`

### Packet

`table preview mobile overlay seam`

### Why this packet

After the accepted `Mobile / Landing` and `Mobile breadth` lanes, the smallest honest broader-mobile seam was no longer shell navigation. The remaining visible mobile breakage sat inside shared module-level list surfaces: `TableWithPreviewLayout` still rendered the preview as a right-side pane with desktop width assumptions, which squeezed the table into unreadable narrow columns on phone widths.

This packet stays bounded because it:

1. closes one shared responsive seam instead of rewriting individual modules
2. preserves frozen layout rules and the existing preview canon (`single click -> preview`, `double click / Enter -> full`, `Esc -> close`)
3. avoids reopening accepted mobile nav and sidebar continuity work

### What changed

1. updated `src/components/shared/TableWithPreviewLayout.tsx` so mobile preview content opens as a fullscreen overlay instead of a side pane
2. kept desktop/tablet side-pane behavior unchanged
3. preserved batch preview continuity on mobile through the same overlay treatment
4. suppressed pin-for-comparison only on mobile, where side-by-side compare would recreate the same narrow-width failure
5. added focused regression coverage in `tests/components/shared/TableWithPreviewLayout.mobile-overlay.test.tsx`

### Verification

- `npx vitest run tests/components/shared/TableWithPreviewLayout.mobile-overlay.test.tsx`
- `ReadLints` clean for:
  - `src/components/shared/TableWithPreviewLayout.tsx`
  - `tests/components/shared/TableWithPreviewLayout.mobile-overlay.test.tsx`

### Result

The active broader mobile lane now has its first real code-backed packet after the split-brain map. Shared list surfaces that rely on `TableWithPreviewLayout` no longer collapse into table-plus-micro-preview behavior on mobile; the preview becomes a dedicated overlay while the desktop Outlook-style split layout remains intact.
