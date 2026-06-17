# HARVARD 4 — Fala 1 residue + testy (domknięcie do 100%)
**Fala:** 3 (rebalans 2026-06-17) | **Branch:** Londyn

Cześć. Jesteś **Harvard 4**. Zbierasz drobne, realne resztki Fali 1: dwie podpisane decyzje do wykonania, dwa zestawy testów, dwa flipy preview i dwie weryfikacje/zamknięcia. To zamyka ostatnie luki KOD Fali 1. Pełna pula tokenów — fan-out na sub-agenty.

## NAJPIERW PRZECZYTAJ
1. `Harvard/wdrozenie-100/_KONTYNUACJA.md`
2. `Harvard/wdrozenie-100/_DECYZJE_RUNDA3.md` — decyzje #1, #2 (M04) PODPISANE
3. `Harvard/SPEC_ZADANIE_07_notebook_workspace.md` — dla M04 rail
4. Teczki: `M04-notatnik.md`, `M19-prezentacje.md`, `M15-rezultaty.md`, `M20-tabele-studio.md`, `M05-ideas-zarzadzanie.md`, `M13-inicjatywy.md` (§03)

## ZAKRES — 7 zadań

### M04 Notatnik — 3 luki (decyzje podpisane)
- **L-02** (DP-2 LEKKI RAIL): jeden trwały prawy rail z kontekstem, **przeżywający nawigację**, BEZ pełnego multi-instance docking. State w layout/context (nie per-route unmount). Spójne ze SPEC_07. Pliki: powłoka `RightRail`/`SplitLayout`/`MainLayout`.
- **L-03** (ODCHUDŹ TERAZ): czysto FE refactor — odchudź `src/components/MyWork/notebook/NotebookCanonicalPathStrip.tsx:25-179` + scal prawy panel do 1 raila z 2 zakładkami.
- **L-09** (P0-test): TipTap/SlashMenu — 0 testów, S5 fałszywa zieleń, 8 `it.todo`. Dopisz realne testy zachowania edytora.

### M19 Prezentacje — 1 luka
- **L-07** (P0-test): 15/21 testów p20 fałszywa zieleń + S4/S5 niezweryfikowane. Napraw deck-version round-trip; usuń maskujące asercje. Pliki: `src/components/Presentations/` + testy. (Patrz `evidence/f2_tests_report.md` w teczce.)

### M15 + M20 — flipy DP-6 preview (decyzja podpisana #4-5, #8)
- **M15 L-05** i **M20 L-05** (governed sync STUB): ukryj przyciski sync + komunikat „preview", **ZERO fałszywego `success:true`**, status luki → `PODGLĄD-DP6`. Pliki: `ExecutionHub.tsx:945`; `server/src/services/tablePlatform/ModuleSyncService.ts:57-110,90`.

### M05 + M13 — weryfikacja/zamknięcie
- **M05 L-07**: split-brain `versions` vs `snapshots` — kod ROZSTRZYGNIĘTY (2026-06-17); zweryfikuj runtime (mig. 622 vs 20260611), flip ZAMKNIĘTA jeśli OK.
- **M13 L-12**: governance router „org-spoofable" = **FAŁSZYWY ALARM** (`Gateway.ts:906` ma `requireRole`); potwierdź jednym cytatem i flip `NIEAKTUALNA`.

## GRANICA (anty-kolizja)
- `ModuleSyncService.ts` / `table-platform.routes.ts` dzielisz z **Harvard 1** (M20 L-04 SPEC) → `git fetch`+HEAD, zmiany wąskie (tylko sync-flip), commit sekwencyjnie.
- NIE ruszaj `public/locales/*` (Harvard 2) ani `AIChat/` chat-controller (Harvard 1).
- M19 ruszasz tylko w zakresie **testów** — feature SPEC_01 M19 (L-08) robi Harvard 1.

## FAN-OUT
Sub-agenty: 1 na M04-rail, 1 na M04-strip, 1 na M04-testy, 1 na M19-testy, 1 na flipy+weryfikacje. Zwracają diff+dowód; ty scalasz, **commitujesz sekwencyjnie**. UI (M04 rail/strip) → preview (`preview_start`→`snapshot`/`screenshot`), dowód trwałości raila przez nawigację.

## GIT
`git fetch origin Londyn` przed commitem; **NIGDY `git add -A`**; testy w `/tests/` → `git add -f`; commit `fix(M04/L-02): trwały lekki rail` / `docs(M13/L-12): FAŁSZYWY ALARM → NIEAKTUALNA`.

## DONE
- [ ] M04 L-02 (rail trwały przez nawigację — dowód w preview), L-03 (strip odchudzony), L-09 (testy edytora zielone)
- [ ] M19 L-07 (S4/S5 zweryfikowane, brak fałszywej zieleni)
- [ ] M15/M20 L-05 → `PODGLĄD-DP6` (przyciski ukryte, zero fake success)
- [ ] M05 L-07 zweryfikowana, M13 L-12 flip NIEAKTUALNA
- [ ] 0 nowych błędów `tsc`; raport + teczki (SHA)

Prod (centerbeam) tylko za osobną zgodą. Staging najpierw.
