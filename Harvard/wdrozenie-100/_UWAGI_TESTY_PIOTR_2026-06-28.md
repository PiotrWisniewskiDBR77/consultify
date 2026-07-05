# UWAGI Z TESTÓW — Piotr · 2026-06-28

> **Tryb:** Piotr testuje na demo (`demo.consultify.ai`, `67e90e27`), CTO **NOTUJE** uwagi.
> **Przebudowa = PÓŹNIEJ** (zbiorczo, nie reaguję na bieżąco). Ten plik = SSOT uwag tej sesji.
> Klasyfikacja: 🟢 szybki-fix · 🔵 kierunkowe (decyzja/roadmap) · 🟡 do-weryfikacji (czy nasz bug) · ⚪ pozytyw/sygnał.
> Wzorzec: [[feedback_harvard_test_notes_as_signals]] — uwagi żywe = sygnały program-wide; klasyfikować SYSTEMOWE vs LOKALNE.

| # | Moduł / ekran | Uwaga Piotra | Kontekst / lokalizacja (CTO) | Klasa | Status |
|---|---|---|---|---|---|
| U1 | Materiały / Documents (deck/doc/sheet) | „Podoba mi się co do zasady nowy moduł documents" — kierunek dobry | Warstwa deliverables; live-smoke potwierdził generację 4×OOXML valid. Słabe punkty znane z oceny jakości (zmyślone źródła, model fin. szkielet, deck=bullety) — patrz taski `task_8ba27e76`, `task_c1e87be1` | ⚪ pozytyw + znane do-poprawy | notowane |
| U2 | Czat / composer | „Nie chcę tej czerwonej ramki" wokół pola „Ask Teresa about your work" | **Ustalenie CTO:** kod + żywy CSS demo = focus border NIEBIESKI (`--c-focus-solid:#2563eb`, `EnhancedChatInput.tsx:1080`); brak `required/:invalid`. Czerwień NIE z naszego kodu. Hipoteza: rozszerzenie Speechify (panel widoczny na screenie) podświetla pole tekstowe. **DO WERYFIKACJI przy przebudowie:** czy zewnętrzne (Speechify/cache) czy jednak nasz stan konta/accent | 🟡 do-weryfikacji | notowane |
| U3 | Czat / panel „Important signals" (prawy dock) | „Wygląda fatalnie graficznie. Użyteczność ważna, ale ma wyglądać jak aplikacja z 2026, nie chujowo" | **Komponent:** `AIChat/ChatSignalsPanel.tsx` (panel w czacie) + ten sam wzorzec `MyWork/Home/RadarTriageCard.tsx`. **Konkretne wady:** (1) **przyciski akcji czerwone** — „Save to Notebook"/„Save to My Ideas" mają `text-primary` (crimson-leak; akcje ≠ danger, `RadarTriageCard.tsx:50/234`); (2) karty „No details" puste — brak treści/hierarchii; (3) **5 akcji na kartę** bez hierarchii (primary vs secondary), upchnięte; (4) brak oddechu, słaba typografia, tandetne karty. **= NIE 2026-grade.** | 🔵 kierunkowe + **SYSTEMOWE** (crimson-leak na przyciskach akcji + jakość kart radiuje na całość) | notowane |

---

| U4 | Ideas / Process Flow — czat Teresa | „AI nie buduje" — napisał „to jest ok. zrób to jako mapę myśli" → **„AI returned no output. Please try again"** (2×) | **FUNKCJONALNY P1, NIE UI.** Komunikat: `UnifiedChatPanel.tsx` + `api.ts` (FE gdy AI output pusty). Ścieżka gen.: `v8/proposalUnificationService.ts` (intent „mapa myśli") + `v8/mindmap.routes.ts`. **Hipoteza CTO:** LLM globalnie ŻYJE na demo (deliverables smoke generował deck 11 slajdów + bundle) → to NIE globalny brak klucza, lecz **bug specyficznej ścieżki mind-map z czatu** (proposalUnification zwraca pusto). DO DIAGNOZY: API-smoke tej ścieżki na demo (czy 500/pusto/timeout). Możliwy też circuit per-model jeśli mind-map używa innego modelu. | 🔴 funkcjonalny P1 (core Ideas value — osobno od przebudowy UI) | notowane |

| U5 | Ideas / Process Flow — pasek narzędzi canvas | „Te menu powinno być w oknie do malowania, a nie tak daleko poza nim" — pionowy pasek narzędzi (kształty/węzły/insert) wciśnięty w LEWY sidebar nawigacyjny, płótno po prawej → narzędzia po przeciwnej stronie niż canvas | **Komponent:** `MyWork/IdeaProcessFlowTool.tsx` + `IdeaMapWorkspace.tsx` (left tool rail). **Odstępstwo od ISTNIEJĄCEGO kanonu:** `docs/ui-standards/02-components/workspace-3-tools-strip.md` mówi wprost — narzędzia w **PRAWYM panelu przy płótnie** (Tools/Context/AI strip), nie w lewym. **= dowód „problem=egzekucja, nie brak standardu".** Radiuje na wszystkie canvas-tools (Process Flow / Mind Map / Whiteboard). | 🔵 kierunkowe UI/UX + **SYSTEMOWE** (odstępstwo od workspace-3-tools-strip) | notowane |
| U6 | **Ideas — CAŁY moduł (werdykt całościowy)** | „Cały ten moduł Idea jest bardzo niegotowy. Ogromna ilość przycisków i mało co działa dobrze niestety. Grafika jest super przeładowana." | **Werdykt nad całą pulą Ideas (M05–M09).** Konkret z ekranu Process Flow: 4 grupy paska (FLOW MODE / BUILD FLOW / ANALYZE AND VALIDATE / MANAGE CANVAS) = **~20 akcji naraz** bez hierarchii (Start/End/Action/Decision/Lane/Insert/Split/KPI/Validate/AI Coach/Summary/AI Proposal/Readback/Auto/Duplicate/Delete/Save/Ask AI/Convert). **KONSEKWENCJA ODBIORU:** mimo „zielonej realizacji" code-side (testy ✅), Ideas **NIE jest gotowa do →F** — UI/UX i gęstość blokują. Odstępstwo od `interactive-board-standard.md` + `module-hub-standard.md` (progresywne ujawnianie, hierarchia akcji). **Radiuje na M06/M07/M08/M09.** | 🔵 kierunkowe + **SYSTEMOWE** (gęstość/przeładowanie + decyzja: Ideas wstrzymana do przebudowy UI) | notowane |
| U7 | Ideas — lewy pionowy pasek ikon (tool rail) | „To jest zawodowe menu, tylko nie wszystko chyba w nim działa" — pasek wygląda profesjonalnie (wzorzec OK), ale część ikon nie ma efektu / jest martwa | **Komponent:** tool rail w `IdeaMapWorkspace.tsx`/`IdeaProcessFlowTool.tsx` (ikony: select/shape/node/insert/frame/upload/AI/undo/redo/more). **Powiązanie:** [[finding_ideas_m5_m9_closure_2026-06-21]] notował **5 luk produktowych M06** — funkcje zbudowane ale **nieosiągalne z UI** (Timeline/3D/TimeHeatmap/BatchConvert), część wpięta do Cmd+K ale nie do paska. **DO WERYFIKACJI przy przebudowie:** zinwentaryzować każdą ikonę → ma handler+efekt czy martwa. Wzorzec wizualny zachować (Piotr: „zawodowe"), domknąć działanie. | 🟡 do-weryfikacji (audyt każdej ikony) + 🔵 | notowane |
| U8 | Ideas — kontekstowe menu węzła (prawy przycisk) | „Więcej pod menu prawego przycisku można włożyć" — obecnie tylko: Edit label / Duplicate / Properties / Delete (4 akcje, „Delete" czerwony OK=destrukcja) | **Komponent:** context-menu węzła w `IdeaProcessFlowTool.tsx`/`IdeaMapWorkspace.tsx`. **Kierunek:** wzbogacić o akcje kontekstowe konsultanta — np. zmiana typu węzła (Start/Action/Decision/End), kolor/styl, połącz-z, grupuj, kopiuj styl, AI-akcje (rozwiń/podsumuj ten węzeł), konwertuj zaznaczenie, lock/pin. Right-click = naturalne miejsce na gęstość (odciąża górny pasek — wiąże z U6). | 🔵 kierunkowe (wzbogacić context-menu) → **✅ ZROBIONE F-C** (`01c8d842cd`: Edit-label fix + struktura K6 + Auto-layout/Convert) | notowane |
| U9 | Notatki — modal „Edit notebook" nie zapisuje | Edycja notatnika (Title „Test 1" / Type Personal / Share-org-AI) → **toast „Failed to save notebook"**, zmiany NIE zapisane | **FUNKCJONALNY P1, NIE UI.** Handler: `NotebookLibraryContent.tsx:498 handleSave` → `Api.updateNotebook(editing.id, {title, scope, teamId, contextSharing})` rzuca → catch → toast `:517`. **Hipotezy CTO:** (a) endpoint PATCH/PUT notebook 404/405 na demo (drift); (b) walidacja backendu odrzuca `contextSharing`/`scope`; (c) „Moje notatki" = seed/demo-notebook read-only lub brak `created_by`=user → 403; (d) `editing.id` mismatch. **DO DIAGNOZY:** API-smoke `updateNotebook` na demo (status + body błędu). Wzorzec jak [[finding_subquery_optional_table_silent_empty]]/[[finding_settings_500_lazy_ddl]] (graceful-fail maskuje root cause). Demo `6b72121258e1`. | 🔴 funkcjonalny P1 (osobny od UI) | notowane |

---

## 🛠️ MANDAT PIOTRA 2026-06-28 — Ideas: PRZEANALIZUJ → PLAYWRIGHT → POPRAW „ZASADY PRACY" przed oddaniem do testów
> Piotr: „zanim dasz mi to do testowania przeanalizował dokładnie te obrazy i może sam zrobił playwright poprawił zasady pracy z tym narzędziem". **= zielone światło na autonomiczną przebudowę Ideas (nie tylko notowanie), z self-verify przez Playwright.** Kolejność: (1) głęboka analiza obrazów+kodu (inwentaryzacja akcji: działa/martwe), (2) wyciąg reguł z ISTNIEJĄCEGO kanonu (interactive-board-standard, workspace-3-tools-strip, module-hub-standard), (3) zaprojektować poprawione „zasady pracy" (IA + hierarchia akcji + progressive disclosure), (4) Playwright ground-truth, (5) implementacja, (6) dowód → dopiero wtedy →F Piotra. Status: **W TOKU** (CTO, headless).

## 🎨 BAZA PRZEBUDOWY UI/UX (Piotr 2026-06-28: „UI/UX do ogromnej naprawy")

**Ustalenie CTO — standardy ISTNIEJĄ (robione wielokrotnie), problem = EGZEKUCJA nie brak dokumentacji:**

**THE autorytet:** `docs/ui-standards/CANON.md` (v3.0, 2026-06-14) — README: „AUTORYTET PRZENIESIONY → CANON.md §2 Hierarchia prawdy", „NIE WYMYŚLAJ NOWYCH STANDARDÓW". Pod nim:
- `00-foundation/` (color-system, visual-language, light-mode-readability)
- `02-components/` (notification-panel, decision-panel, task-panel, ai-suggestions-modal, building-blocks…)
- `03-modules/` (TABLE_AND_PREVIEW_CANON, module-hub-standard, INSIGHT/INITIATIVE/FINANCE_VISUAL_CANON…)
- `docs/standards/VISUAL_STANDARD.md` + `CARD_CONTENT_FORMULA.md`
- `docs/qa/` (VISUAL_QUALITY_SPRINT_PLAN, MASTER_VISUAL_QA_CATALOG, VISUAL_AUDIT_PROCEDURE — egzekucja)
- Szum: konkurujące GOLDEN/OPERATING/UI_UX_CANON_V3 + duplikaty `* 2.md` (snapshoty, NIE autorytet)

**DLACZEGO UI nadal zły mimo standardów (diagnoza):**
1. Kanon istnieje, ale **kod go nie przestrzega** — komponenty pisane bez sprawdzania CANON (crimson-leak U2/U3, tandetne karty).
2. **Brak twardej egzekucji** — nic nie wymusza zgodności (lint/tokeny/CI-gate na kolory/komponenty).
3. Visual Quality (audyt) odpalony ale **niedokończony** → odstępstwa się kumulują. [[project_visual_quality_program]] [[project_ui_canon_consolidation]]

**PROPOZYCJA podejścia do przebudowy (NIE zaczynam bez zgody Piotra):**
- NIE pisać 6. kanonu. Zamiast: (a) **audyt zgodności kodu vs CANON.md** (gdzie odbiega, per komponent/ekran), (b) **egzekucja** — tokeny + lint wymuszające budżet-czerwieni / no-danger-fill na akcjach / niebieski-focus, (c) **przebudowa komponentów-grzeszników** (panele sygnałów, karty triage, composer) do CANON, (d) sprzątnąć duplikaty/konkurujące „kanony" → jeden CANON.md.

---

## Następne uwagi (dopisuję w miarę testów Piotra)

*(kolejne pozycje U4, U5… — CTO dopisuje na bieżąco, bez naprawiania)*
