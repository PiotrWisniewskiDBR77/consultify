# IDEAS + NOTATKI — przebudowa UI/UX do 2026-grade (spec wykonawczy)

> **Mandat Piotra 2026-06-28 (noc):** „przegląd UI/UX wszystkich Ideas i Notatek — funkcjonalności OK, grafika z poprzedniej ery — popraw serio nowoczesne. Leć sam do końca planu."
> **Tryb:** CTO autonomicznie, headless. Demo najpierw, prod nietknięty. Weryfikacja: tsc + vitest + Playwright screeny (before/after) przed ogłoszeniem „done".
> **Źródło uwag:** [`_UWAGI_TESTY_PIOTR_2026-06-28.md`](_UWAGI_TESTY_PIOTR_2026-06-28.md) (U1–U8). **Zasada nadrzędna:** standardy ISTNIEJĄ — to egzekucja. NIE wymyślam 6. kanonu; egzekwuję `docs/ui-standards/CANON.md`.

## 0. Zasada: zachować funkcję, wymienić grafikę
Piotr: „funkcjonalności już ok, ale grafiki z poprzedniej ery". → **NIE przepisujemy logiki** (autosave, sync, generacja). Zmieniamy: layout toolbara, hierarchię akcji, kolory (budżet czerwieni), gęstość/typografię, context-menu, stany hover/focus. Każda zmiana = czysto prezentacyjna lub przeniesienie istniejącej akcji, zero zmian kontraktu danych.

---

## 1. REGUŁY KANONU (wyciąg — obowiązują 1:1)

| # | Reguła | Źródło |
|---|--------|--------|
| K1 | **Tool-strip przy płótnie** (topbar canvas / prawy panel), NIE w lewym sidebarze nawigacyjnym. 3 ikony: Tools/Context/AI → otwierają prawy panel. | `02-components/workspace-3-tools-strip.md:9,71` |
| K2 | **Max 2–4 widoczne akcje** w topbarze; więcej → dropdown/overflow. **Kanon zakazuje 20 przycisków naraz.** | `03-modules/module-hub-standard.md:798` |
| K3 | **Max 2 poziomy ważności** w jednym toolbarze. | `00-foundation/visual-language.md:321` |
| K4 | **Primary CTA = 1 per widok**, violet `#7c3aed`. | VISUAL_STANDARD §5 |
| K5 | **Budżet czerwieni** — czerwień WYŁĄCZNIE: branding, sidebar-active 2px, „Talk to Teresa", Delete/Reject/Stop, Critical/Failed/Overdue. **ZNIKA z** focus-ringów, tabów, pills, primary, gradientów. | VISUAL_STANDARD §2.3 |
| K6 | **Context-menu struktura:** Open → Context → AI → Convert → Manage → Danger (ostatni, po separatorze, danger-styled). | `module-hub-standard.md:321` |
| K7 | **Gęstość:** nav tight (8–12px), content spacious (24–32px gap). Typografia: 14px `ui` default, 11px CAPS labels sekcji, 12px caption. Min `text-sm` dla danych. | `visual-language.md:220`, VISUAL_STANDARD §3 |
| K8 | Przyciski: `h-9` topbar / `h-8` chips Menu3, `rounded-lg`/`rounded-full`, **bez gradientów**, `--r-control` 8px. | VISUAL_STANDARD §5.1 |

---

## 2. DOCELOWY LAYOUT canvas-workspace (Ideas: Process Flow / Mind Map / Whiteboard / Table)

**Problem (U5/U6):** 4 grupy (FLOW MODE / BUILD FLOW / ANALYZE AND VALIDATE / MANAGE CANVAS) = ~20 akcji rozłożone w pasmie nad płótnem + tool-rail w lewym sidebarze (daleko od kanwy).

**Docelowo (wg K1/K2/K3):**
```
TOPBAR canvas (przy płótnie):
[Tytuł: Ideas / Process Flow]   [tryb: Classic ▾]   ·   [＋ Dodaj ▾]  [Auto-layout]  [Tools ⚙] [Context 💡] [AI ✦]   [Save ●]
                                                          PRIMARY        secondary       3-tools-strip (prawy panel)   status
```
- **PRIMARY (1):** `＋ Dodaj ▾` — dropdown z Start/End/Action/Decision/Lane/Insert/Split (cała grupa BUILD FLOW → jeden primary z menu).
- **Secondary (2–4):** `Auto-layout`, `Tools`, `Context`, `AI` (3-tools-strip).
- **Cała grupa ANALYZE & VALIDATE** (KPI/Validate/AI Coach/Summary/AI Proposal/Readback) → **prawy panel „AI/Validate"** (ikona AI ✦), nie pasmo.
- **MANAGE CANVAS** (Undo/Redo/Auto/Duplicate/Delete/Save/Ask AI/Convert) → undo/redo+zoom = pływający dock przy płótnie (dolny-prawy); Duplicate/Delete/Convert = context-menu; Save = status auto-save (bez przycisku, „Saved 1s ago").
- **Tool-rail** (kształty/węzły) → przenieść z lewego sidebara do **lewej krawędzi PŁÓTNA** (floating, jak Figma/Miro), nie do nav-sidebara.

**Efekt:** z ~20 widocznych → ~5 w topbarze + reszta progresywnie (dropdown/panel/context/dock). Zgodne K2.

---

## 3. CONTEXT-MENU węzła (U8 — „więcej można włożyć", wg K6)
Obecnie: Edit label / Duplicate / Properties / Delete (płaska lista 4).
**Docelowo (struktura K6):**
```
Otwórz / Podgląd
─────────────
Edytuj etykietę
Zmień typ ▸ (Start/Action/Decision/End)
Kolor / styl ▸
Połącz z… / Duplikuj
─────────────
✦ AI: rozwiń ten węzeł
✦ AI: podsumuj gałąź
─────────────
Konwertuj zaznaczenie ▸
─────────────
Usuń            (danger, ostatni)
```
Right-click przejmuje gęstość → odciąża topbar (wiąże U6).

---

## 4. BUDŻET CZERWIENI — co przestaje być czerwone (U2/U3, wg K5)
- Akcje **„Save to Notebook" / „Save to My Ideas"** (panel sygnałów) → z `text-primary`(crimson) na **neutralny/secondary** (`--text-secondary` + hover) lub primary-violet jeśli to CTA. Czerwień zostaje TYLKO na „Delete/Dismiss" jeśli destrukcyjne.
- **Validate** (⚠ żółty/amber ostrzeżenie — OK, to nie czerwień-brand).
- **Delete** (canvas/context) — zostaje `--danger` (poprawnie, K5 pkt 4).
- Focus-ring inputów (composer „Ask Teresa") → niebieski `--c-focus` (już jest w kodzie; zweryfikować że nic nie nadpisuje na czerwono — hipoteza U2: zewnętrzne Speechify).

---

## 5. GĘSTOŚĆ / TYPOGRAFIA (U6 „przeładowane", wg K7)
- Karty sygnałów / node-cards: padding 12–16px, gap 8–12px, tytuł 14px/600, opis 13px/400 `--text-secondary`.
- Pasma toolbara: usunąć puste „No details", dać oddech 16–24px między grupami.
- Labels sekcji (FLOW MODE/BUILD FLOW): 11px CAPS `--text-tertiary` — zostają jako overline, ale grupy zwijane.

---

## 6. PLAN IMPLEMENTACJI (fale — sekwencyjnie, każda: kod→tsc→vitest→commit)
> Czeka na: inwentaryzację akcji (martwe vs żywe — agent w toku) + analizę Notatek (agent w toku). Uzupełnię §7/§8 po ich powrocie.

- **F-A ✅ — Budżet czerwieni (systemowy):** crimson-leak sweep 31 plików MyWork/mindmap (gradient primary/crimson → slate neutral). Commit `e90a079b8b`, tsc+vitest 358/358.
- **F-B ✅ — Layout toolbara Process Flow:** 4 ciężkie bordered-karty z uppercase-labelami → jeden smukły pasek (Figma/Linear): kształty ikony+tooltip, separatory, header odchudzony, Save primary + Delete danger. Wszystkie akcje/handlery zachowane. Commit `37ca88f362`. *(Tool-rail-position U5 — krawędź płótna — odłożony, większe ryzyko layoutu; toolbar gęstość rozwiązuje rdzeń U6.)*
- **F-C ✅ — Context-menu węzła (U8):** naprawa no-op „Edit label" (data.editSignal → inline edit) + struktura K6 (Open→Edit/Duplicate→Auto-layout→Convert→Delete-danger) + separatory + akcje tylko gdy handler. Commit `01c8d842cd`, vitest 23/23.
- **F-D ✅ — Panel sygnałów (U3):** crimson→neutral, hierarchia akcji (2 solid+3 ghost), semibold. Commit `840ee37af0` (zrobione wcześniej w nocy).
- **F-E ✅ — Notatki M04:** 117 crimson AI-akcentów/aktywnych tabów → violet (spójne z AI=violet w ProcessFlowToolbar). Commit `6b72121258`, tsc+vitest 258/258.
- **F-F ✅ — Weryfikacja:** tsc 0 + vitest zielony po każdej fali. Wizualna (Ideas/Notatki headless = gates) → demo.
- **F-G ✅ — Deploy demo:** push feat HEAD→demo (ff) + Railway build **SUCCESS** (`demo/6b721212`, 13:45). Health 200, gitSha `6b72121258` potwierdzony żywy, DB+redis connected. **Czeka: wizualny odbiór Piotra na demo.consultify.ai** (Ideas → Process Flow + Notatki).

**Status uwag Piotra:** U3 ✅ (F-D) · U6 ✅ (F-B gęstość + F-A/F-E czerwień) · U8 ✅ (F-C) · U2 🟡 (hipoteza Speechify — do potwierdzenia) · U5 ⏸️ (tool-rail position — odłożony, ryzyko) · U4 🔴 (mind-map AI no-output — funkcjonalny P1, OSOBNY od UI, niezaadresowany — wymaga diagnozy ścieżki proposalUnification).

## 7. INWENTARYZACJA AKCJI IDEAS (ground-truth z kodu, ~44 akcje)
**Licznik:** 13 ✅ działa · ~22 ⚠️ warunkowa (zaznaczenie/flaga/AI-klucz/aktywne narzędzie) · **4 🔴 twardo martwe.**
**🔴 TWARDE MARTWE (priorytet):**
1. **Rail Import/Export + AI + More-tools martwe poza Mind Mapą** (największy zasięg) — `CanvasLeftToolbar.tsx:179-195` renderuje SHARED_BOTTOM dla każdego narzędzia, ale akcje `mm_`-prefiks obsługuje TYLKO `useMindMapQuickActions`. W Whiteboard/PF/Table = eksport+AI+15 more-tools nic nie robią. **Fix-kierunek:** ukryć SHARED_BOTTOM poza Mind Mapą ALBO routować per-tool prefiks.
2. **Context-menu „Edit label" = no-op** (`IdeaProcessFlowTool.tsx:2627-2635`) — ustawia tylko `selected`, nie otwiera edytora (inline edit w `FlowNodeComponent` osiągalny tylko double-click). **= U8.** Fix: podpiąć do inline-edit/Properties.
3. **Frame w PF** (`CanvasLeftToolbar.tsx:161`) wysyłał `wb_add_frame` (brak handlera PF) → **✅ NAPRAWIONE (slot usunięty, PF nie ma ramek)**.
4. **Rail Undo/Redo w Table** — emituje `mm_undo/redo`, `useTableQuickActions` nie obsługuje undo/redo.
- **Floating „Rename (F2)"** otwiera Properties, nie inline rename (mylący tooltip).

**🔴 U4 — mind-map z czatu „AI returned no output" (root-cause):** ścieżka czat→mind-map pęknięta. `generate_deliverable` w MCP (`mcpServer.ts:116-121`) ma enum `['document','sheet','presentation']` — **BEZ `mindmap`**. Intencja mind-map łapana regexem (`mindmapIntentDetector`) → wysyła `CustomEvent` do listenera żyjącego TYLKO w canvasie Ideas → w czacie brak listenera → pusty stream → `EMPTY_STREAM` (`llmService.ts:1211`). Deck działa bo ma generator in-place + enum. **Fix-kierunek:** (1) generator mind-map in-place w `UnifiedChatPanel` (wzorem decka), ALBO (2) dodać `mindmap` do enuma + handler backend. **RYZYKO:** dotyka mcpServer/llmService = rdzeń czatu żywych klientów → osobny task z weryfikacją, NIE nocą bez testów.

## 8. NOTATKI M04 — ✅ ZROBIONE (agent, 6 plików, tsc czysty, vitest 37/37)
Crimson-leak dekoracyjny → neutral (ikona książki, welcome banner) · `font-bold`→`font-semibold` (tytuły) · gradientowe płótna → flat surfaces · mikro-typografia `text-[9px/10px]`→`11px` · hardkod `#1a1a1d`→`navy-900` · focus-ring → token `--c-focus`. **Pominięte świadomie:** inverted-primary CTA (333 plików app-wide = celowy idiom, ryzyko) + konsolidacja 4 akcentów primary/indigo/blue/sky (osobny task). EDITOR_STYLES + `text-danger` nietknięte.

---
## STATUS FAL (2026-06-28 noc)
- **F-A budżet czerwieni:** ✅ ChatSignalsPanel (commit) + ✅ ProcessFlowToolbar (crimson→neutral, 6 miejsc) + ✅ Notatki (agent). 
- **F-C/F-E częściowo:** ✅ Notatki grafika (agent) + ✅ Frame martwy slot usunięty (PF).
- **⏳ DO ZROBIENIA (wymaga weryfikacji wizualnej / większe):** F-B layout toolbara (przeniesienie ~20 akcji → primary+overflow+dock — RYZYKO bez live-verify), context-menu „Edit label" fix (U8), rail SHARED_BOTTOM poza Mind Mapą (martwe), U4 mind-map MCP (rdzeń czatu — osobny task). 
- **Decyzja CTO (noc):** robię BEZPIECZNE czysto-graficzne + jednoznaczne martwe-bugi 1-liniowe. Layout-redesign + MCP-rewrite = oznaczone do weryfikacji z Piotrem (za duże/ryzykowne na headless bez screenów live).
**Status:** spec v1. Implementacja F-A done; deploy demo + raport poranny następnie.
