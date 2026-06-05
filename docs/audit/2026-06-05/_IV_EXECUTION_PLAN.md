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
- [x] **#27b** Metric strip symetria: `propertiesMaxColumns` pass-through w NModeShell; Insight ustawia 5 → 10 metryk renderuje się jako symetryczne 5×2 (koniec 6+4) ✅
- [x] **#27c** ID artefaktu (INS-/INIT-) w NModeHeader: monospace chip teraz **kopiowalny kliknięciem** (Copy/Check feedback) + permalink już istniał; ×8 widoków ✅
- [x] **#21** N/C toggle — framework istniał; ✅ **Insight: zbudowany C-layout** (grid sekcji jako children). ✅ **Initiative: JUŻ MIAŁ własny C-mode** (InitiativeDocumentView:8880 „C-MODE RENDER" — grid kart/scroll). Oba artefakty mają teraz tryb C. (TODO przyszłe: ujednolicić Initiative legacy C-mode na ten sam wzorzec.)
- [ ] **#21b** Persystencja trybu N/C per user (localStorage)
- [ ] **#6/§6** AI 3-poziomowy w NModeLayout: poziom „tool" w NModeActionBar
- [ ] **#23/§6** AI 3-poziomowy: poziom „section" w NModeSectionWrapper (prawy róg nagłówka sekcji)
- [ ] **§6** AI 3-poziomowy: poziom „field" inline przy polach (KPI, Financial)
- [x] **#22** Adaptive hide-empty w NModeLeftNav (×8 widoków): `hasData`/`alwaysShow` w NModeSection + filtr + toggle „Pokaż wszystkie (N)". Insight wpięty konserwatywnie (ukrywa tylko sekcje z pewnym count=0; core zawsze widoczne) ✅
- [x] **#22b** Grupowanie sekcji w NModeLeftNav: `group?` w NModeSection + grouped render (agregacja po labelu). Insight: 20 sekcji → 5 grup (Wgląd/Między wierszami/Dowody/Dostarczane/Audyt) ✅
- [ ] **#27d** SummaryCard — nowy komponent w NModeLayout (kompakt + embed w Reports/Decks)

### 1B. Kanon tabel (6 tabel Interview + reszta platformy)
- [ ] **#18** `<DataTable>` kanon graficzny: monochrome bg, brak zebra/row-tone, hairline dividers, sticky header
- [~] **#18b** StatusPill SSOT — `shared/StatusPill.tsx` gotowy: 1 komponent, 5 tonów (blue/amber/emerald/rose/slate) + `statusTone()` ✅ (agent C). ⬜ Migracja konsumentów (tabele) — osobno (dotyka InterviewHub).
- [ ] **#10** Migracja Interview tabel na FilterableTable → filtry per-column automatycznie
- [ ] **#18c** Spec `docs/design-system/TABLES.md` (standard dla całej platformy)

### 1C. Kanon modali formularzy (3 wizardy + reszta)
- [x] **#14** `shared/forms/` kanon: portal Select/MultiSelect (nie zasłaniają), Field wrappers, usePopoverPosition — adoptowane w AssignInterviewModal ✅ (agent A)
- [x] **#14b** PriorityPicker (chip-row 1-klik zamiast `<select>`) + DatePicker custom (kalendarz + skróty, cross-browser) ✅ (agent A)
- [ ] **#14c** Spec `docs/design-system/FORMS.md` (do dopisania) + migracja innych modali na kanon

---

## FAZA 2 — DWA WIELKIE ARTEFAKTY DO STANDARDU · ~7-10 dni

### 2A. Insight detail (refactor na NModeLayout kanon)
- [ ] **#23** Wszystkie sekcje na `NModeSectionWrapper` kanon (koniec różnych formatów per sekcja)
- [x] **#23b** Strip markdown w sub-tekstach ✅ (agent G: InsightViewer; agent I: Insights tabela)
- [ ] **#22** Reorganizacja 20 sekcji → 5 grup (INSIGHT / BETWEEN THE LINES / EVIDENCE / DELIVERABLES / AUDIT)
- [ ] **#23c** Merge sekcji: Material Quality+Truth→Quality&Trust · Source Pack+Sessions→Sources · Candidates+Traceability→Findings&Evidence · usunąć Full Analysis · Activity→header · Comments→drawer
- [ ] **#22c** ⭐ 3 nowe sekcje „między wierszami": Consensus&Divergence Matrix · Implicit Assumptions · Silences
- [ ] **#23d** 4 dalsze nowe: Cross-person Quote Comparison · Sentiment/Tone Map · Power Dynamics · Hypothesis Board
- [x] **#26** Toolbar kanon: 1 primary + Export/AI dropdowny (koniec tęczy) ✅ (agent G)
- [x] **#26b** ⭐ Submit for Review → **Submit for Information** (bez gate; notyfikacja managerów/ownerów) ✅ (agent G)
- [x] **#20** Insights tabela: StatusPill + strip markdown + Source „—" + kolumna Exported to + kebab preview ✅ (agent I)
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
- [x] **#28c** ⭐ **Source Basket** — tabela insight_source_baskets + CRUD + UI (Use existing/Build new/Save) w InsightCreatorModal ✅ (agent D)
- [~] **#28d** Generate variant — Source Basket gotowy (fundament); 1-klik „nowy lens z tego koszyka" do dodania osobno ✅cz. (agent D)
- [ ] **#28e** Duplicate-detect przed Run (podobny insight istnieje?)

### 3C. Generator Inicjatyw ⭐⭐⭐
- [ ] **#29** Konsolidacja 4 wizardów w 1 kanon
- [x] **#29b** Step 0 — wybór insightów (multi-select, 1:N lineage) ✅ (agent H)
- [x] **#29c** Capacity check — GET /initiatives/capacity + banner „X aktywnych, sugerowane Y" + default count ✅ (agent H)
- [x] **#29d** ⭐ similarity check (embeddings+Jaccard fallback): endpoint /initiatives/similarity-check + flagi NEW/SIMILAR/DUPLICATE/RELATED per kandydat w wizardzie ✅ (agent E)
- [ ] **#29e** Merge/Extend/Create-anyway flow przy podobnych
- [x] **#29f** Bulk-create 1-3 (soft limit) w stanie DRAFT + source tagging ✅ (agent H)
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
- [x] **#8b** Archiwum — BACKEND (kolumny+endpointy+bulk+?lifecycle, agent B) ✅ + FRONTEND (kebab Archive/Restore/Trash/Delete-forever + chip-row Active|Archive|Trash + bulk, agent F) ✅
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

---

# 🧭 HANDOFF — CIĄGŁOŚĆ MIĘDZY SESJAMI (czytaj to najpierw)

> Ta sekcja jest pisana tak, by **świeża sesja bez pamięci** mogła podjąć pracę. Aktualizowana 2026-06-05 po wave 3.

## Gdzie jesteśmy
- **29 punktów odhaczonych** (fundament + 3 fale agentów). Zostało **~46 punktów** (lista `- [ ]` powyżej).
- Branch roboczy: **`feat/wave1-foundations`** (NIE `Londyn` — to default remote). Wszystko commitowane na bieżąco.
- Serwery dev: FE `:3000`, BE `:3001`. Log dev: `/tmp/consultify-dev.log`.

## Komendy weryfikacji (gate przed każdym commitem)
```bash
# FE typecheck (musi być exit 0)
npx tsc --noEmit -p tsconfig.json
# BE gate = esbuild ESM (NIE tsc!), exit 0
cd server && npx esbuild --bundle --platform=node --format=esm '--external:*' --outfile=/dev/null src/index.ts
# lint autofix
npx eslint --fix <plik>
# zdrowie serwerów
curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health   # 200
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000              # 200
```
Commit message kończy się: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Twarde ograniczenia (NIE łamać)
1. **DB_MANAGED_SCHEMA off** → nowe kolumny przez **lazy-ensure ALTER** (`getTableColumns()` + `queryHelpers.queryRun('ALTER TABLE ...')`), nigdy migracje.
2. **Backend gate to esbuild ESM, nie tsc** — tsc na server/ ma szum, ignorować; liczy się esbuild.
3. **Tani AI stack — ZERO OpenAI.** Aktywne w `llm_providers` (Railway): OpenRouter (default), DeepSeek, ZAI. Voice = `GEMINI_LIVE_API_KEY` z env. Nie włączać `openai`/`google` providerów.
4. **Sekrety** nie trafiają do czatu ani gita (`.env.staging.local` jest gitignored).
5. Pliki kończące się ` 2`/` 3` to **duplikaty sync GDrive — ignorować**.
6. **Agenty: file-disjoint, NIE commitują.** Każdy agent dostaje rozłączny zbiór plików, zostawia zmiany w working tree, sam weryfikuje. JA robię wspólną weryfikację + sekwencyjne commity + tick planu. Backend mount-point (`server/src/Gateway.ts`) trzyma max 1 agent na falę.

## Kanony, których MUSISZ używać (nie dublować)
- **Detail-view = `src/components/shared/NModeLayout/NModeShell`** (8 widoków). Struktura: `NModeHeader → NModePropertiesStrip → NModeActionBar → NModeLeftNav + NModeCanvas` (N-mode) albo `children` (C-mode, gdy `presentationMode==='c' && children`). Tryb: hook `usePresentationMode` (`'n'|'c'`).
- **Sekcje:** typ `NModeSection` ma `hasData?`, `alwaysShow?`, `group?` (grupowanie nav). Adaptive sidebar + „Pokaż wszystkie sekcje" już są w `NModeLeftNav`.
- **Formularze/modale = `src/components/shared/forms/`** (portal: `Select`, `MultiSelect`, `PriorityPicker`, `DatePicker`, `Field`, `usePopoverPosition`) — nigdy nie przycinane.
- **Statusy = `src/components/shared/StatusPill.tsx`** (`statusTone()`, 5 tonów). Migrować tabele na to.
- **Popover/dropdown = portal do `document.body`** wg wzorca `TableSettingsPopover.tsx` (fixed pos z `getBoundingClientRect`, auto-flip, viewport-clamp).
- **Crash isolation = `SectionErrorBoundary`** owija aktywną sekcję w `NModeCanvas` (już wpięte dla 8 widoków).

## Trzy zasady produktowe od ownera (pamiętać przy każdym ficzerze)
1. **Trzy wizardy** (survey/insight/initiative) mają wyglądać podobnie — wspólny `<WizardModal>` shell, zarządzane kolory (§5).
2. **AI na 3 poziomach** — tool (cały NModeActionBar) · section (prawy róg nagłówka sekcji) · field (inline przy polu). Copilot, nie autopilot (#6/#23/§6).
3. **Karta Inicjatywy = wzorzec złoty.** Pozostałe karty (Insight, Task, Decision…) doprowadzić do tego standardu.

## REKOMENDOWANA KOLEJNOŚĆ (leverage-first) + podział na fale agentów

### Najpierw P0 bug (solo, szybki)
- **#24b** crash telemetria app-level („could not be delivered").

### Fala A — kanon NModeLayout (najwyższy leverage, dotyka 8 widoków)
- Agent A1: **AI 3-poziomowy** — `#6/§6` poziom „tool" w `NModeActionBar` + typy w `NModeLayout/types.ts` (`aiContextActions` już istnieje — rozszerzyć o section/field hooki). **Owner pliki: `NModeLayout/*` tylko.**
- Agent A2: **#21b** persystencja trybu N/C per user (localStorage) w `usePresentationMode.ts`. **Disjoint.**
- Agent A3: **#27d** `SummaryCard` nowy komponent w `NModeLayout/`. **Disjoint (nowy plik).**
> Uwaga: A1 i A3 oba dotykają `NModeLayout/` — jeśli kolizja, rozbić na 2 fale albo dać A1 tylko `types.ts`+`NModeActionBar`, A3 nowy plik + `index` export.

### Fala B — kanon tabel (1B) — wspólny graficzny styl
- **#18** `<DataTable>` kanon (monochrome, hairline dividers, sticky header) — nowy plik `src/components/shared/DataTable/`.
- **#10** migracja tabel Interview na FilterableTable (filtry per-column).
- **#18b** dociągnąć StatusPill do tabel · **#16/#15** kolumny+kebab Templates.
- **#18c/#14c** specy `docs/design-system/TABLES.md` + `FORMS.md`.

### Fala C — Faza 4 workflow managera (dużo wartości, infra częściowo istnieje)
- **#11** ⭐ AI Quality Gate **pre-submit** (modal „odpowiedzi za krótkie" przed Submit) — infra istnieje.
- **#7b/#8** manager row-menu (Approve/Send back/Reassign/Due) + bulk actions.
- **#9/#9b** kolumny Sessions (Due/Submitted/Overdue/Assignee/AI Score) + eskalacja UI.
- **#5** redesign formatki odpowiedzi (Record inline + attachments inline + guidance).
- **#6** Inbox chipy (All/Answered/Approved/Sent-back, koniec org-wide overdue).

### Potem (większe, wrażliwe — najlepiej z ownerem przy testach)
- **2A Insight detail** pełny refactor sekcji: `#22` (20 sekcji→5 grup), `#23c` merge sekcji, `#22c`/`#23d` ⭐ nowe sekcje „między wierszami" (Consensus&Divergence, Implicit Assumptions, Silences, Quote Comparison, Sentiment Map, Power Dynamics, Hypothesis Board).
- **3A §5** wspólny `<WizardModal>` shell → potem `#29` konsolidacja 4 wizardów.
- **3C** generator inicjatyw reszta (#29e/#29g/#29h), **3B** generator insightów (#28b/#28e).
- **#25** mądry generator-eksport z preview-pane.
- **2B #30** Initiative detail szlif (#30b PL/EN, #30c C-mode, #30d backlinks/lineage).
- **Faza 5 #19** ⭐ Audit Orchestrator (kierunek produktu) — wizard celu + multi-template + multi-assignee + obiekt `audit_programs` + skala 400 ankiet.

## Rytm pracy (sprawdzony w tej sesji)
3 agenty równolegle / falę → wspólna weryfikacja → 3 osobne commity → tick w tym pliku → `git commit` docs. Owner powiedział: „rób bez przerwy, odhaczaj statusy" — wykonywać autonomicznie, nie dopytywać o zgodę na każdy krok.

## NASTĘPNY PUNKT DO ODHACZENIA
→ **#24b** (solo P0), potem **Fala A** (AI 3-poziomowy + N/C persist + SummaryCard).
