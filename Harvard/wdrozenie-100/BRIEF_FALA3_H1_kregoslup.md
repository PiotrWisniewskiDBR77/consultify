# HARVARD 1 — Kręgosłup SPEC_01 (czat → deliverable)
**Fala:** 3 (rebalans 2026-06-17) | **Branch:** Londyn

Cześć. Jesteś **Harvard 1**, jedna z 5 równoległych sesji programu domykania Consultify do 100%. Pracujesz autonomicznie w swojej strefie i raportujesz. **Masz pełną pulę tokenów — pracuj szeroko, rób fan-out na sub-agenty.**

## NAJPIERW PRZECZYTAJ
1. `Harvard/wdrozenie-100/_KONTYNUACJA.md` — metoda, topologia env, zasady twarde
2. `Harvard/wdrozenie-100/AGENT_MAP.md` — sekcja „FALA 3 — AKTYWNA" (twój wiersz)
3. `Harvard/SPEC_ZADANIE_01_chat_controller.md` — to JEST twoja główna specyfikacja
4. `M01-czat.md` (§03) + sekcje SPEC_01 w `M17/M18/M19/M20-*.md`

## ZAKRES — jeden epik odblokowuje 5 modułów
Czat ma **realnie generować artefakt** (dokument/deck/arkusz) i otwierać go w canvasie.

| Luka | Moduł | Kotwica | Co zrobić |
|------|-------|---------|-----------|
| **M01 L-09** | Czat | `src/components/AIChat/WorkCanvasDocumentPanel.tsx:704-747,711-720` | handoff→panel zerwany — spięcie eventu czatu z mountem panelu (Tryb A/C) |
| **M17 L-10** | Outputs | SPEC_01 | czat→deliverable jako źródło Outputs |
| **M18 L-11** | Dokumenty | SPEC_01 | auto-generacja doc z czatu |
| **M19 L-08** | Prezentacje | SPEC_01 | czat→deck (auto-trigger) |
| **M20 L-04** | Tabele | SPEC_01 | czat→arkusz |

Strefa plików: `src/components/AIChat/` (`UnifiedChatPanel.tsx`, `WorkCanvasDocumentPanel.tsx`, `WorkCanvas/`, `CanvasEditor/`, `documentIntentDetector.ts`, `canvasStreamIntentDetector.ts`, `CanvasArtifactSwitcher.tsx`), store `useArtifactsStore`, backend `server/src/services/ai/AIPipeline.ts`, `server/src/ai/persona.ts`.

Stan (MASTER §3): Tryb B + PL→PL ZROBIONE. Do zrobienia: **Tryb A (function-calling)**, **Tryb C (konsolidacja artefaktów)**, reasoning realny (`AIPipeline.ts:2052-2067`).

## GRANICA (anty-kolizja)
- NIE ruszaj `AIChat/Wave5-9*.tsx` ani `artifacts.routes.ts` → Harvard 3.
- `table-platform.routes.ts` dzielisz z Harvard 4 → `git fetch`+HEAD, commit sekwencyjnie.
- NIE ruszaj `public/locales/*` → Harvard 2. Nowy string = `t('klucz')`, klucz zgłoś H2.

## FAN-OUT
Sub-agenty (Agent tool): 1 mapuje SPEC_01→kod, 1 analizuje intent-detector, 1 pisze test kontraktowy intencji. Zwracają diff+dowód; ty scalasz i **commitujesz sekwencyjnie**. Każda zmiana UI → preview (`preview_start`→`snapshot`/`screenshot`). Nigdy „done" na samym tsc.

## GIT
`git fetch origin Londyn` przed commitem; **NIGDY `git add -A`**; testy w `/tests/` → `git add -f`; commit `fix(M01/L-09): …` / `feat(SPEC_01/M18-L-11): …`.

## DONE
- [ ] S-A/S-B/S-C/S-D ze SPEC_01 zielone (test + dowód w preview)
- [ ] 5 luk → `ZAMKNIĘTA <data> <SHA>` w teczkach
- [ ] 0 nowych błędów `tsc`; raport (co działa, screenshoty, reszta)

Prod (centerbeam) tylko za osobną zgodą. Staging najpierw.
