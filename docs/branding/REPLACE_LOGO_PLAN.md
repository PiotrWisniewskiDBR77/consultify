# Plan: Replace all logos with Consultinity

This repo currently uses **static logo assets** from `public/assets/logos/` in multiple UI surfaces.
After running `npm run branding:generate`, those static assets are regenerated from the **source of truth**
in `Logo consultinity/`.

## What is already covered (auto-updated via generated assets)

These components reference `/assets/logos/logo-{light,dark}.png` and will automatically show the new
Consultinity logo after regeneration:

- `src/components/navigation/Sidebar/SidebarHeader.tsx`
- `src/components/navigation/Sidebar/Sidebar.tsx`
- `src/components/layout/Sidebar.tsx` (legacy sidebar)
- `src/views/AuthView.tsx`
- `src/components/Landing/EntryTopBar.tsx`
- `src/components/Landing/EntryFooter.tsx`
- `src/views/LegalIndexView.tsx`

## PWA / browser chrome

Also regenerated and wired:

- `public/manifest.json`
- `public/icons/icon-*.png` + `public/icons/shortcut-*.png`
- `public/favicon.png` + `public/favicon-16.png`
- `index.html` links to manifest + favicon + apple touch icon

## Manual follow-ups (non-image “logo” / brand marks)

There are places that display *text-only* marks (not logo images). Decide whether to keep DBR77/TechnoLex
copy or migrate them to Consultinity:

- `src/views/PublicLandingPage.tsx` (uses “TL / TECHNOLEX” mark)
- `src/views/WelcomeView.tsx` (header shows “DBR77 / CONSULTINITY” as text)
- `src/views/TrialEntryView.tsx` (left sidebar uses “DBR77” text badge)

## White-label runtime branding (future-hardening)

This change makes the **default** product branding consistent.
If you want per-organization branding to override logos/favicons at runtime, next steps:

- Load `/api/branding/:orgId` after login
- Replace hardcoded `/assets/logos/...` with a resolver (branding → fallback)
- Dynamically update `<link rel="icon">` when branding changes

