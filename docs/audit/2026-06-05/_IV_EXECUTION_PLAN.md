# MODUŁ WYWIADY — PLAN PRZEBUDOWY (tracker do odhaczania)

**Data:** 2026-06-05 · **Branch:** `feat/wave1-foundations`
**Jak czytać:** punkty idą w kolejności wykonania (zależności od góry do dołu). Każdy punkt = ~1 commit, zweryfikowany (tsc=0, esbuild OK, serwery 200). Odhaczamy `[x]` po wykonaniu + teście.
**Źródła:** `_IV_TEST_NOTES.md` (30 obserwacji), `_IV_MODULE_MASTER_PLAN.md`, `_IV_INITIATIVE_DISCUSSION.md`, `_IV_SESSIONS_VS_ASSIGNED_DECISION.md`, `_IV_ANSWER_FORM_REDESIGN.md`.

**Legenda:** `[ ]` do zrobienia · `[x]` zrobione · `[~]` częściowe · ⭐ kluczowe · 🔴 bug

---

## ✅ JUŻ ZROBIONE (ta sesja — fundament + naprawy)

- [x] V-A: security gates v8, assignee resolution, status modeling, ad-hoc sessions, IDOR guard, demo-data trust guards
- [x] V-B Phase 0: FilterableTable column persistence
- [x] V-C: dead-code sweep (~1900 LOC) + Discovery revived
- [x] AI keys: tani stack Railway (OpenRouter+DeepSeek+ZAI, bez OpenAI)
- [x] Voice: klucz Gemini podłączony
- [x] **#27 część:** NModePropertiesStrip — read-only pola jako czysty label+wartość (8 widoków naraz)
- [x] Odkrycie: kanon detail-view = `NModeLayout` (8 konsumentów) — rozwijamy IT, nie budujemy od zera

---

## FAZA 0 — P0 BUGI (przed nowymi ficzerami) · ~2-3 dni

- [x] 🔴 **#24** Insight section crash — per-section ErrorBoundary w **NModeCanvas** izoluje crash sekcji we WSZYSTKICH 8 widokach NModeShell automatycznie (koniec pełnoekranowego „Coś poszło nie tak") ✅
- [ ] 🔴 **#24b** Crash diagnostics nie wysyłane („could not be delivered") — app-level telemetria (osobny od #24; per-section boundary omija app-level dla crashy sekcji)
- [x] 🔴 **#4** Voice „3 osoby" — bufor akumulacyjny w `useTeresaVoice` + flush na `turnComplete` (jedna tura = jedna wiadomość) ✅ `commit`
- [x] **#1** Popover „Visible columns" przycinany do tabeli — `TableSettingsPopover` portalowany do body (fixed + auto-flip + viewport clamp), nigdy nie przycinany; dotyczy wszystkich tabel ✅

---

## FAZA 1 — FUNDAMENTY WIZUALNE (kanony — leverage ×N) · ~5-7 dni

### 1A. NModeLayout — rozwój istniejącego kanonu detail-view (8 widoków)
- [x] **#27** Metric strip: read-only → label+wartość (NModePropertiesStrip)
- [ ] **#27b** Metric strip: layout inline z dividerami zamiast sztywnego grid-cols-10 (symetria)
- [x] **#27c** ID artefaktu (INS-/INIT-) w NModeHeader: monospace chip teraz **kopiowalny kliknięciem** (Copy/Check feedback) + permalink już istniał; ×8 widoków ✅
- [ ] **#21** N/C toggle w NModeHeader — UWAGA: `PresentationModeSwitcher` + `usePresentationMode` JUŻ ISTNIEJE w headerze; sprawdzić co robi tryb C dziś, dodać/dokończyć grid 2-3 kol
- [ ] **#21b** Persystencja trybu N/C per user (localStorage)
- [ ] **#6/§6** AI 3-poziomowy w NModeLayout: poziom „tool" w NModeActionBar
- [ ] **#23/§6** AI 3-poziomowy: poziom „section" w NModeSectionWrapper (prawy róg nagłówka sekcji)
- [ ] **§6** AI 3-poziomowy: poziom „field" inline przy polach (KPI, Financial)
- [ ] **#22** Adaptive hide-empty w NModeLeftNav (sekcje bez treści ukryte + „Pokaż wszystkie")
- [ ] **#22b** Grupowanie sekcji w NModeLeftNav (np. 5 grup zamiast płaskiej listy)
- [ ] **#27d** SummaryCard — nowy komponent w NModeLayout (kompakt + embed w Reports/Decks)

### 1B. Kanon tabel (6 tabel Interview + reszta platformy)
- [ ] **#18** `<DataTable>` kanon graficzny: monochrome bg, brak zebra/row-tone, hairline dividers, sticky header
- [ ] **#18b** StatusPill SSOT — jeden komponent, 5 semantycznych kolorów (zabija 4 rozjechane systemy)
- [ ] **#10** Migracja Interview tabel na FilterableTable → filtry per-column automatycznie
- [ ] **#18c** Spec `docs/design-system/TABLES.md` (standard dla całej platformy)

### 1C. Kanon modali formularzy (3 wizardy + reszta)
- [ ] **#14** `<FormModal>` kanon: portal dropdowny (nie zasłaniają), chip-pickery zamiast natywnych selectów, h-10 rounded-xl
- [ ] **#14b** PriorityPicker (chip-row zamiast `<select>`), DatePicker custom (zamiast natywnego)
- [ ] **#14c** Spec `docs/design-system/FORMS.md`

---

## FAZA 2 — DWA WIELKIE ARTEFAKTY DO STANDARDU · ~7-10 dni

### 2A. Insight detail (refactor na NModeLayout kanon)
- [ ] **#23** Wszystkie sekcje na `NModeSectionWrapper` kanon (koniec różnych formatów per sekcja)
- [ ] **#23b** Strip markdown w sub-tekstach (koniec surowego `## Executive Summary`)
- [ ] **#22** Reorganizacja 20 sekcji → 5 grup (INSIGHT / BETWEEN THE LINES / EVIDENCE / DELIVERABLES / AUDIT)
- [ ] **#23c** Merge sekcji: Material Quality+Truth→Quality&Trust · Source Pack+Sessions→Sources · Candidates+Traceability→Findings&Evidence · usunąć Full Analysis · Activity→header · Comments→drawer
- [ ] **#22c** ⭐ 3 nowe sekcje „między wierszami": Consensus&Divergence Matrix · Implicit Assumptions · Silences
- [ ] **#23d** 4 dalsze nowe: Cross-person Quote Comparison · Sentiment/Tone Map · Power Dynamics · Hypothesis Board
- [ ] **#26** Toolbar kanon: 1 primary (Submit for Information) + Export/Convert/AI dropdowny (koniec tęczy)
- [ ] **#26b** ⭐ Submit for Review → **Submit for Information** (bez gate'u, leci do inboxa managera/ownera)
- [ ] **#20** Insights tabela: porządek graficzny (left bar, chipy) + kolumny (Exported to, AI Score, Findings count) + kebab (Convert/Edit/Share/View sources)
- [ ] **#25** Mądry generator z preview-pane: tabela wyboru sekcji przy eksporcie (Report/Deck/Table/Idea/Note=fragmenty/Initiative)

### 2B. Initiative detail (szlif do kanonu — owner: „mały")
- [ ] **#30** Initiative card: dociągnąć do NModeLayout kanonu (top strip, per-section AI) — już blisko
- [ ] **#30b** PL/EN spójne (notatka kontekstowa po angielsku → naprawić)
- [ ] **#30c** C-mode dla inicjatywy (gdy NModeLayout dostanie C-mode w 1A)
- [ ] **#30d** „Used in (backlinks)" + lineage „Source insights" (dwukierunkowo z insightem)

---

## FAZA 3 — TRZY GENERATORY (rdzeń wartości) · ~7-10 dni

### 3A. Wspólny shell
- [ ] **§5** `<WizardModal>` kanon: jeden header/progress-bar/footer/inputy dla 3 wizardów (na `<FormModal>` z 1C)
- [ ] **§5b** Progress bar + klikalne kroki + jasny komunikat „krok pusty dopóki nie wygenerujesz"

### 3B. Generator Insightów
- [ ] **#28** Graficzne polish 5 kroków (progress, hover tooltips, drag-drop zone, custom checkboxy)
- [ ] **#28b** Step 2 „People" — naprawić puste sloty checkbox (bug/placeholder?)
- [ ] **#28c** ⭐ **Source Basket** — koszyk źródeł reusable (model + UI: Use existing / Build new)
- [ ] **#28d** ⭐ **Generate variant** — z 1 koszyka → wiele insightów pod różnym kątem (1 klik, zmień tylko output type/analysis)
- [ ] **#28e** Duplicate-detect przed Run (podobny insight istnieje?)

### 3C. Generator Inicjatyw ⭐⭐⭐
- [ ] **#29** Konsolidacja 4 wizardów w 1 kanon
- [ ] **#29b** Step 0 — wybór insightów (1-N, multi-select) [decyzja: 1:N lineage]
- [ ] **#29c** Capacity check — „zespół ma X aktywnych, dodaj rozsądnie" (AI-suggested liczba)
- [ ] **#29d** ⭐ Step 2 Kandydaci z **similarity check** (embeddings): flaga NEW/SIMILAR/DUPLICATE/RELATED per kandydat
- [ ] **#29e** Merge/Extend/Create-anyway flow przy podobnych
- [ ] **#29f** Bulk-create [decyzja: 1-3 inicjatywy] w stanie **DRAFT** [decyzja] z governance + lineage
- [~] **#29g** PL/EN: notatka konsultanta zlokalizowana (PL z diakrytykami + „Najważniejsze insighty") ✅ · Esc anuluje + root-cause isPolish=false do sprawdzenia
- [ ] **#29h** Progresywne wypełnianie: wizard wypełnia rdzeń (Problem/Solution/Scope/KPI z insightu), reszta pusta z AI-assist

### 3D. Generator Ankiet (TemplateBuilder)
- [x] **#17** Rebranding: „AI" (prawy górny) → „Popraw z AI" + tooltip wyjaśniający różnicę od „Stwórz ankietę z AI" ✅
- [ ] **#17b** Brakujące ficzery: sekcje pytań · preview-as-user · duplicate question · question-type preview

### 3E. Handoff end-to-end
- [ ] **#W5** Interview→Initiative flow realnie działa (handoff finding→initiative taguje source_type, widoczne w tab)

---

## FAZA 4 — WORKFLOW MANAGERA · ~5-7 dni

- [ ] **#12** ⭐ Decyzja: merge Sessions+Assigned w jedną zakładkę „Work" (lub potwierdzić rozdzielenie)
- [ ] **#7b** Manager flow w menu wiersza: Approve/Send back/Reassign/Change due date (handlery są)
- [ ] **#8** Bulk actions: Approve/Send back/Remind/Archive zaznaczonych
- [ ] **#8b** Archiwum: kolumny `archived_at`/`trashed_at` + akcje Archive/Restore/Trash/Delete-forever
- [ ] **#8c** Chip-row lifecycle: Active / Archive / Trash
- [ ] **#9** Kolumny Sessions: rozbić DATE na Due/Submitted/Overdue + Assignee + AI Score (opt-in)
- [ ] **#9b** Eskalacja UI (silnik istnieje): escalation target + manual „Escalate now" + kolumna
- [ ] **#11** ⭐ AI Quality Gate **pre-submit** (infrastruktura istnieje): modal przed Submit „odpowiedzi 2,5 za krótkie" + opcja wróć/wyślij-mimo-to
- [ ] **#11b** Manager AI snapshot panel w Approve (score + weak answers + 1-klik Send back from AI)
- [ ] **#11c** Per-question instant feedback (odpowiedź <20 znaków → hint)
- [ ] **#6** Inbox chipy: koniec org-wide Overdue w widoku usera → All/Answered/Approved/Sent-back
- [ ] **#5** Formatka odpowiedzi redesign: Record inline (nie osobne okno) + attachments/images inline + guidance (pulsująca ikona + instrukcja+przykład)

---

## FAZA 5 — AUDIT ORCHESTRATOR (kierunek produktu) ⭐⭐⭐ · ~5-7 dni

- [ ] **#19** Audit Wizard (MVP): cel + multi-template + multi-assignee → bulk-create wszystkich ankiet
- [ ] **#19b** Wariant 1: nowa firma (z org context AI proponuje plan: kto co wypełnia)
- [ ] **#19c** Wariant 2: ISO 27001 preset (14 sekcji → AI mapuje na role)
- [ ] **#19d** Obiekt `audit_programs` + zakładka „Audits" + dashboard programu
- [ ] **#19e** Skala 400 ankiet: saved views, grouping, server-side pagination, batch AI insights

---

## FAZA 6 — POLISH · ~3-5 dni

- [ ] **#16** Templates kolumny: usage count, AI quality score, last used
- [ ] **#15** Templates kebab: Archive, Delete-forever, Set/Unset default, View usage
- [ ] Insights Gen-1 export column-sniffing cleanup
- [ ] Summary AI-vs-keyword honesty
- [ ] Cross-project scope leaks
- [ ] Pozostałe drobne UX

---

## STATYSTYKA
- **Faza 0:** 4 punkty (P0 bugi)
- **Faza 1:** 18 punktów (kanony — najwyższy leverage)
- **Faza 2:** 14 punktów (dwa artefakty)
- **Faza 3:** 17 punktów (trzy generatory)
- **Faza 4:** 11 punktów (workflow managera)
- **Faza 5:** 5 punktów (Audit Orchestrator)
- **Faza 6:** 6 punktów (polish)
- **RAZEM: ~75 punktów · ~6-8 tygodni dedykowanej pracy**

## ZASADY WYKONANIA
1. Każdy punkt = osobny commit, zweryfikowany (tsc=0, esbuild OK, serwery 200)
2. Kanony (Faza 1) przed konsumentami (Faza 2-4) — leverage ×N
3. NModeLayout rozwijamy, nie dublujemy
4. Kolory: tabele monochrome, artefakty mogą mieć więcej (semantyczne)
5. AI: copilot na 3 poziomach, nie autopilot
6. Po każdym punkcie: owner testuje, odhaczamy razem

## NASTĘPNY PUNKT DO ODHACZENIA
→ **Faza 0, #24** (Insight section crash) albo **Faza 1A #27b/#27c** (kontynuacja metric strip + ID).
Owner decyduje: bugi najpierw, czy kanon dalej?
