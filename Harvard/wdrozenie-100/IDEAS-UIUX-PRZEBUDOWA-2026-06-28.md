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

- **F-A — Budżet czerwieni (systemowy, radiuje):** crimson-leak na akcjach nie-destrukcyjnych → neutral/primary. Komponenty: panel sygnałów (`ChatSignalsPanel`/`RadarTriageCard`), Ideas toolbar (Delete zostaje, reszta nie). Najtańszy, najszerszy efekt.
- **F-B — Layout toolbara Ideas:** zwinięcie ~20 akcji → primary `Dodaj▾` + 3-tools-strip + dock + context (wg §2). Tool-rail do krawędzi płótna.
- **F-C — Context-menu węzła:** wzbogacić wg §3 (przenieść istniejące akcje + dodać AI/typ/kolor jeśli handlery istnieją; martwe NIE dodawać).
- **F-D — Gęstość/typografia:** spacing, karty, oddech (§5).
- **F-E — Notatki M04:** wg analizy (agent w toku) — modernizacja grafiki, ten sam budżet czerwieni + typografia.
- **F-F — Weryfikacja:** tsc + vitest (Ideas+Notebook suites) + Playwright screeny before/after na demo → dowód.
- **F-G — Deploy demo** (merge feat→demo) → Piotr rano widzi.

## 7. INWENTARYZACJA AKCJI (martwe/żywe) — uzupełnię po agencie
*(pending: agent inwentaryzacji Ideas)*

## 8. NOTATKI M04 — grzechy graficzne — uzupełnię po agencie
*(pending: agent analizy Notatek)*

---
**Status:** spec v0 (reguły+layout+plan). Czekam na 2 inwentaryzacje → v1 → implementacja F-A.
