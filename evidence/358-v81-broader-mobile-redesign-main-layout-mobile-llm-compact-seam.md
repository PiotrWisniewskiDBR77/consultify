## V8.1 Evidence - broader `Mobile` redesign - main layout mobile LLM compact seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Mobile` redesign
Status: `active`

### Packet

`main layout mobile LLM compact seam`

### Why this packet

After the shared preview-overlay and bulk-action bottom-offset packets, the next smallest honest broader-mobile seam was the app header chrome.

`MainLayout` rendered the shared `LLMSelector` in full mode even on mobile, despite `LLMSelector` already supporting a built-in `compact` contract. That left the narrow top bar carrying the full selector footprint inside the same row as breadcrumbs, system health, tasks, notifications, and profile controls.

This packet stays bounded because it:

1. closes one existing shared header seam through an already-supported `compact` prop
2. preserves frozen layout order in the top bar
3. avoids broadening into a wider header redesign across multiple controls

### What changed

1. updated `src/layouts/MainLayout.tsx` to read `isMobile` from `useDeviceType`
2. passed `compact={isMobile}` into the shared `LLMSelector`
3. added focused regression coverage in `tests/components/layout/MainLayout.mobile-llm-compact.test.tsx`

### Verification

- `npx vitest run tests/components/layout/MainLayout.mobile-llm-compact.test.tsx`
- `ReadLints` clean for:
  - `src/layouts/MainLayout.tsx`
  - `tests/components/layout/MainLayout.mobile-llm-compact.test.tsx`

### Result

The active broader mobile lane now has a third real bounded packet. The shared model selector in the app header now switches into its compact mobile mode on narrow viewports without changing header control order or reopening broader topbar redesign work.
