## V8.1 Evidence - broader `Mobile` redesign - bulk action bar mobile nav offset seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Mobile` redesign
Status: `active`

### Packet

`bulk action bar mobile nav offset seam`

### Why this packet

After the shared `TableWithPreviewLayout` mobile overlay packet landed, the next smallest honest broader-mobile seam remained a shared floating-control collision rather than a module rewrite.

`BulkActionBar` still anchored itself at `bottom-6`, while `BottomNavigation` occupied the fixed bottom strip with `h-16`. On phone widths this placed the bulk action surface inside the same bottom region as the navigation bar, so selected-item actions could visually collide with the mobile nav.

This packet stays bounded because it:

1. closes one shared geometry seam in `BulkActionBar`
2. preserves frozen layout rules and accepted mobile shell/navigation authority
3. avoids broadening into topbar or module-level responsive redesign work

### What changed

1. updated `src/components/ui/ResizableTable/BulkActionBar.tsx` to read `isMobile` and `safeAreaInsets` from `useDeviceType`
2. raised the bulk action bar above the mobile bottom-nav strip with a mobile-only bottom offset
3. kept desktop positioning unchanged
4. added focused regression coverage in `tests/components/shared/BulkActionBar.mobile-nav-offset.test.tsx`

### Verification

- `npx vitest run tests/components/shared/BulkActionBar.mobile-nav-offset.test.tsx`
- `ReadLints` clean for:
  - `src/components/ui/ResizableTable/BulkActionBar.tsx`
  - `tests/components/shared/BulkActionBar.mobile-nav-offset.test.tsx`

### Result

The active broader mobile lane now has a second real bounded packet. Shared bulk-action surfaces no longer sit in the same bottom strip as `BottomNavigation` on mobile; the selected-actions bar is lifted above the nav while desktop behavior stays unchanged.
