# M02 Canvas — pakiet ekranów do odbioru UI (→UI)

**Data:** 2026-06-20 · **Moduł:** M02 Canvas · **Źródło inwentarza:** `Harvard/wdrozenie-100/M02-canvas.md` (sekcja EKRANY, 16 ekranów)
**Jak zrobione:** Playwright headless, żywa aplikacja (`:3000`/`:3001`→trolley), capture spec `tests/e2e/smoke/m02-canvas-ui-capture.spec.ts`. Ekrany z capabilities (deck/share/generacja) — sesja owner DBR77 na żywo.

## Ekrany na dysku (demo-auth)

| Plik | Ekran (inwentarz) |
|------|-------------------|
| `01-panel-header-editor-light.png` | #1 Panel canvas (prawy slot) + nagłówek + #3 edytor TipTap (light) |
| `02-split-fullpage-light.png` | Pełny split — chat lewo / canvas prawo (light) |
| `03-diagnostics-menu-open.png` | #7/#1.7 Menu „…" (diagnostyka: widok, quick-add, eksporty) |
| `04-markdown-view.png` | #3 Widok Markdown (canvas-md-view) — wspólne źródło z Dock |
| `05-new-canvas-templates.png` | #2 „+ New Canvas" — lista szablonów |
| `06-version-history.png` | #7 Historia wersji (popover) |
| `07-capability-gating-strips.png` | #1.3/#1.4 Paski OUTPUT + PROMOTE w stanie gated (brak capability) |
| `08-selection-ai-block-actions.png` | #5 Floating AI menu (Ask AI/Condense/Expand/Tone/Explain/Actions) na zaznaczeniu + render tabeli GFM (siatka) |
| `10-diagnostics-menu-dark.png` | Menu „…" w dark mode |
| `11-split-fullpage-dark.png` | Pełny split w dark mode |

## Ekrany wymagające capability owner (zweryfikowane na żywo, sesja Chrome owner DBR77 2026-06-20)

- #4 Widok prezentacji (deck) — `CanvasPresentationView`, 5 slajdów, tytuł + branding DBR77 (live).
- #9 Stan ładowania / #13 checklista planu — „Document plan — 9 sections" + „Organization sources — 3 found" + Writing/Validating/Artifact ready (live).
- #1 Render dokumentu z bogatą treścią PL + tabela kosztów (live, „Plan wdrożenia AI w obsłudze klienta z tabelą kosztów").
- #11 Pasek share / #15 publiczny viewer `/public/artifacts/:token` — wymaga `canvas.share` (owner); demo user = gated (widoczne na 07).

## Uwagi
- Demo user (register-demo) = ADMIN bez capability `canvas.*` → paski OUTPUT/PROMOTE/share są celowo gated (ekran 07) — zgodne z DoD #2 (bramki serwerowe 9/9).
- Tabele GFM renderują się jako prawdziwa siatka `<table>` (widoczne na ekranie 08) — potwierdza N-9.
- Light + dark pokryte. Formalny odbiór UX = audytor + Piotr.
