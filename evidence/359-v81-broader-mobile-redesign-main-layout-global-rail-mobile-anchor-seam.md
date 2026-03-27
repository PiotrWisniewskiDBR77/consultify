## V8.1 Evidence - broader `Mobile` redesign - main layout global rail mobile anchor seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Mobile` redesign
Status: `active`

### Packet

`main layout global rail mobile anchor seam`

### Why this packet

After the shared preview-overlay, bulk-action offset, and compact model-selector packets, the next smallest honest broader-mobile seam remained a shared fixed-control geometry issue in `MainLayout`.

The global right-edge action rail still used a desktop-style `top-[70%]` anchor even on mobile, while `BottomNavigation` occupied the fixed bottom strip. That left the shared floating rail without any mobile bottom-nav or safe-area awareness.

This packet stays bounded because it:

1. closes one shared anchoring seam in `MainLayout`
2. mirrors the already accepted mobile bottom-offset pattern used by `BulkActionBar`
3. avoids broadening into header redesign or module-level responsive work

### What changed

1. updated `src/layouts/MainLayout.tsx` to anchor the global action rail above the mobile bottom-nav strip using `safeAreaInsets`
2. kept the existing desktop `top-[70%]` behavior outside mobile breakpoints
3. extended focused regression coverage in `tests/components/layout/MainLayout.mobile-llm-compact.test.tsx`

### Verification

- `npx vitest run tests/components/layout/MainLayout.mobile-llm-compact.test.tsx`
- `ReadLints` clean for:
  - `src/layouts/MainLayout.tsx`
  - `tests/components/layout/MainLayout.mobile-llm-compact.test.tsx`

### Result

The active broader mobile lane now has a fourth real bounded packet. The shared global action rail in `MainLayout` now sits above the mobile bottom-nav strip with safe-area-aware spacing, while desktop positioning remains unchanged.
