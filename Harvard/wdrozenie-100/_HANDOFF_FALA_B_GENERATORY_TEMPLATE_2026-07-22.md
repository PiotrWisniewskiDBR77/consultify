# HANDOFF — FALA B: generatory template'ów (Word · Deck · Excel) — 2026-07-22
Wejście: `_HANDOFF_DOKUMENTY_2026-07-22.md`. To plan budowy 3 generatorów template'ów. Napisane bezpośrednio (agent utknął) — plik:linia z oceny PRZED, do potwierdzenia grepem przed pracą.

## Koncepcja (doktryna wymiar 4 · decyzja Piotra)
Każde narzędzie: 3 tryby wejścia — **czysto/ręcznie · z AI (Teresa) · z template**. Generator template'ów = **AI tworzy szablon z rozmowy ORAZ ręczny edytor** szablonu. Szablon = wielorazowy OBIEKT (układ+sekcje+placeholdery), nie migawka gotowego artefaktu.
**Teza nadrzędna:** zbudować JEDEN wzorzec generatora (Word — ma backend), potem sklonować na Deck i Excel.

## 1. Generator tpl. WORD (#2, PRZED 4.4) — WZORZEC
**ISTNIEJE (backend realny):**
- `POST /api/document-studio/templates/plan` → `draftTemplateAsync({useLlm:true})` = **AI szkicuje szablon** z `TemplateDraftInput{purpose,...}`; wariant deterministyczny `draftTemplate`. Plik: `server/src/routes/document-studio.routes.ts:816`, `server/src/services/documentStudio/documentTemplateService.ts`.
- Governance: approve/deprecate/audit/usage/feedback (`document-studio.routes.ts:855-1007`); Mode 3 generacja z zaakceptowanego szablonu; `content-blocks/:id/instantiate`.
**BRAK:** FRONTEND — kreatora AI + ręcznego edytora struktury. FE dziś: tylko picker `approvedTemplates` w intake (`DocumentStudioIntakeForm.tsx`).
**ZBUDOWAĆ (to jest WZORZEC):**
1. Ekran/menu „Szablony" z akcją **„Utwórz szablon"** (3 tryby: czysto/AI/z istniejącego).
2. Kreator AI: pole „opisz szablon" → woła `/templates/plan {useLlm:true}` → podgląd struktury → zapis (draft) → governance.
3. Ręczny edytor struktury: sekcje/placeholdery/kolejność (backend `PUT /templates/:id` już przyjmuje strukturę — potwierdź callerów).
4. Weryfikacja: dev-render ekranu (oba motywy) + live (utwórz szablon → użyj w Mode 3).
**Ryzyko:** nie ruszać działającej generacji dokumentu (Mode 1/3) — dodajemy warstwę tworzenia szablonu obok.

## 2. Generator tpl. PREZENTACJI (#1, PRZED 2.0) — KLON wzorca, dobudować backend
**ISTNIEJE:** governance + clone (`presentations.routes.ts:956`); „zapisz jako szablon" gotowego decka (`SaveAsTemplateModal`).
**BRAK (fantom):** tworzenie NOWEGO szablonu = brak `POST /templates`; AI-z-rozmowy nie istnieje; ręczny edytor = FANTOM (`PUT /templates/:id` przyjmuje `outlineJson`, ZERO callerów w `src/`). SSOT: „shared template generator runtime: MISSING".
**ZBUDOWAĆ:** dobudować backend `draftTemplateAsync`-odpowiednik dla decka (AI szkicuje outline szablonu) + wpiąć istniejący `PUT outlineJson`; FE = klon wzorca Word.

## 3. Generator tpl. EXCEL (#3, PRZED 2.0) — KLON, podłączyć fundament
**ISTNIEJE (fundament odłogiem — FANTOM):** `server/src/services/workbook/templates/index.ts` + `threeScenarioPnL.ts` = parametryczny rejestr `WORKBOOK_TEMPLATES` + `buildFromTemplate()` z gotowym szablonem „RZiS 3-scenariusze × 3 lata" (formuły łańcuchowe, arkusz Założeń). **ZERO callerów** — `WorkbookGeneratorService` go nie importuje (tylko testy).
**BRAK:** „save as template" dla sheet zablokowane API 409 (`server/src/routes/artifacts.routes.ts:1052` — tylko report/presentation); `deliverableTemplateService.ts` brak branchu `sheet`.
**ZBUDOWAĆ (najkrótsza droga = PODŁĄCZENIE):**
1. Wepnij `buildFromTemplate` do `WorkbookGeneratorService` (LLM wybiera pasujący szablon zamiast projektować od zera).
2. Zdejmij blokadę 409 dla `sheet` (`artifacts.routes.ts:1052`).
3. Dodaj branch `outputType='sheet'` w `deliverableTemplateService.ts`.
4. FE = klon wzorca Word.
**Uwaga (Fala A dotknęła):** `WorkbookGeneratorService.ts` już zmieniony w A3 — sprawdź konflikt przed pracą.

## Kolejność Fali B
1. **Word FE (wzorzec)** — pełny generator (kreator AI + edytor) na istniejącym backendzie.
2. **Excel** — podłącz `WORKBOOK_TEMPLATES` + zdejmij 409 + FE klon (fundament techniczny gotowy → szybkie).
3. **Deck** — dobuduj backend AI-draft + FE klon (najwięcej do zbudowania).
Każde: dev-render + live-verify, commit-per-krok, deploy za akceptem Piotra.
