# MODUŁ WYWIADY — MASTER PLAN ROZWOJU

**Data:** 2026-06-05
**Autor:** Claude (na bazie sesji testowej + audytów + źródeł prawdy w kodzie)
**Status:** synteza końcowa — fundament pod implementację
**Powiązane dokumenty:** `_IV_TEST_NOTES.md` (30 obserwacji) · `_IV_INITIATIVE_DISCUSSION.md` (lifecycle + decyzje) · `_IV_ANSWER_FORM_REDESIGN.md` · `_IV_SESSIONS_VS_ASSIGNED_DECISION.md` · `_IV_SYNTHESIS_PER_FEATURE.md` (quad-audit)

---

## 0. EXECUTIVE SUMMARY

Moduł Wywiady to **najtrudniejszy moduł w platformie** — łączy zbieranie danych (ankiety) z dwoma ciężkimi artefaktami transformacyjnymi (Insight + Initiative) i trzema wizardami AI. To nie jest „formularz ankiet" — to **silnik konsultingowy**: zbierz wywiady → zrozum co ludzie mówią (i między wierszami) → zaplanuj transformację → wykonaj ją.

**Łańcuch wartości:**
```
ANKIETA (zbieranie) → INSIGHT (zrozumienie) → INICJATYWA (transformacja) → WYKONANIE
       wizard 1            wizard 2                 wizard 3              gates/governance
```

**Trzy filary do dowiezienia:**
1. **Sensowne ankiety + system zbierania** (Templates + Sessions + manager workflow)
2. **Dwa wielkie artefakty** (Insight + Initiative) — czytelne, mądre, eksportowalne, wykonywalne
3. **Trzy wizardy** (ankiety/insighty/inicjatywy) — spójne wizualnie, mądre AI, kolory zarządzane

**Zasada przewodnia:** AI jako **silne wsparcie na trzech poziomach** + karta inicjatywy jako **wzorzec graficzny** dla wszystkiego.

Ten moduł to wg ownera **~40% całej pozostałej pracy**. Szacunek: **6-8 tygodni dedykowanej pracy** do poziomu production-grade.

---

## 1. CZYM JEST MODUŁ — MENTAL MODEL

### Sześć zakładek (dziś):
| Zakładka | Rola | Aktor |
|---|---|---|
| **Inbox** | moja praca dziś (przypisane mi ankiety) | użytkownik (respondent) |
| **Sessions** | wszystkie ankiety w org | manager |
| **Assigned** | komu co przypisałem | manager |
| **Templates** | biblioteka szablonów ankiet | autor/manager |
| **Insights** | wnioski z analizy wywiadów | konsultant |
| **Initiatives** | działania transformacyjne | konsultant + zespół projektu |

### Dwie role nakładające się:
- **Respondent** — wypełnia przypisane ankiety (Inbox)
- **Manager/Konsultant** — przypisuje, ocenia, analizuje, planuje transformację (Sessions/Assigned/Insights/Initiatives)

### Cztery „obiekty domenowe":
1. **Template** — szablon ankiety (pytania, typy, modalności)
2. **Session/Assignment** — instancja ankiety przypisana osobie (lifecycle: assigned→in_progress→submitted→approved/sent_back)
3. **Insight** — artefakt analityczny (20 sekcji, AI-generated z wielu sesji)
4. **Initiative** — artefakt transformacyjny (18 sekcji, 13-statusowy governance lifecycle)

---

## 2. DWA WIELKIE ARTEFAKTY + FUNDAMENT ANKIETOWY

### 2.1 INSIGHT — „zrozumienie"
**Rola:** zrozumieć co ludzie powiedzieli **oficjalnie i między wierszami**, zestawić zdania różnych osób, dostrzec zależności i ryzyka — to co widzi mądry konsultant po szeregu rozmów.

**Stan:** 20 sekcji w sidebarze, AI-generated, ale **graficznie „dramat"** (różne formaty per sekcja, surowy markdown, tęczowe karty akcji). Infrastruktura „między wierszami" częściowo istnieje (`Signals: tension/gap/contradiction/pattern`, `divergence_note`, `consensusTopics`).

**Co dorobić:** 7 nowych sekcji (Consensus Matrix, Quote Comparison, Sentiment, Power Dynamics, Hypothesis Board, Implicit Assumptions, Silences), reorganizacja 20→5 grup, adaptive hide-empty, mądry generator z Source Basket, ID jako artefakt, Submit for Information (zamiast review).

### 2.2 INITIATIVE — „transformacja"
**Rola:** podstawowe narzędzie transformacyjne. Z insightu → plan co zmienić w organizacji.

**Stan:** **najlepiej zrobiona karta w module** (owner: „dziesiątki godzin"). 18 sekcji, top strip czysty, ID artefakt (INIT-), per-section AI, drag-reorder, backlinks. **To jest wzorzec graficzny dla całej reszty.**

**Źródło prawdy (kod):** ciężki obiekt governance — 13 statusów, gates z rolami, backend-owned capabilities (`gate-readiness-check`), scope przez Decisions, 4 ścieżki tworzenia. Inicjatywa z wizarda startuje DRAFT i przechodzi pełny lifecycle.

**Co dorobić:** mały szlif (owner), C-mode, generator z similarity/capacity, handoff fix, progresywne wypełnianie sekcji.

### 2.3 FUNDAMENT ANKIETOWY
Bez dobrych ankiet nie ma dobrych insightów. **Stan:** działa end-to-end (Templates real, Sessions real, lifecycle approve/sendback naprawiony w V-A). **Co dorobić:** formatka odpowiedzi (redesign — Record inline, attachments, guidance), manager workflow (bulk/archive/escalation UI), filtry per-column, Audit Orchestrator (bulk-assign dla 100 osób).

---

## 3. STAN OBECNY — UCZCIWY SCORECARD

Z quad-audytu + sesji testowej:

| Obszar | Score | Stan |
|---|---|---|
| **Insights (silnik)** | 88→ | Najmocniejszy. P10 governance end-to-end. Ale graficznie „dramat" + crash w sekcji (#24). |
| **Initiative card** | ~85 | Najlepsza karta. Wzorzec. Brak C-mode + generator end-to-end. |
| **Templates** | 68→82 | Real data. Status/archive naprawione (V-A). Brak usage count, AI-vs-create mylące. |
| **Sessions** | 68→80 | Real. Ad-hoc naprawione. Brak archiwum, bulk, filtrów, kolumn. |
| **Assigned** | 63→82 | Security naprawione (V-A). Dobry kebab dynamiczny. Brak filtrów per-column, lifecycle scope. |
| **Inbox** | 58→80 | Assignee naprawione (V-A). Chipy mylące (Overdue org-wide). |
| **Generatory (3 wizardy)** | ~50 | Treściowo mądre, graficznie niespójne, brak Source Basket / similarity / capacity. |
| **Voice** | — | Klucz podłączony, ale „3 osoby" bug (#4). |
| **Tabele (wizual)** | — | Brak kanonu — tęczowe tła, niespójne bordery (#18). |
| **Modale formularzy** | — | Natywne selecty, dropdowny się zasłaniają (#14). |

**Naprawione tej sesji (V-A/V-B/V-C):** security gates, assignee resolution, status modeling, ad-hoc sessions, column persistence, dead-code sweep, AI keys (tani stack Railway), Voice key, demo-data trust guards.

**Średnia modułu: ~70 → ~81** po V-A/V-B/V-C. Do „100%" brakuje: graficzne kanony + generatory + dwa artefakty do standardu.

---

## 4. ŹRÓDŁO PRAWDY — ARCHITEKTURA (żeby nie projektować na ślepo)

### 4.1 Initiative lifecycle — 13 statusów, 4 fazy
```
FAZA 1 (Tools/Assessment):  DRAFT → PENDING_REVIEW
FAZA 2 (Initiatives):       REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED
FAZA 3 (Execution):         EXECUTING ⇄ BLOCKED → DONE
FAZA 4 (Benefits):          TRACKING
Terminalne:                 CANCELLED, ARCHIVED
```
- Każde przejście = **gate** z rolą zatwierdzającą
- **Backend źródłem prawdy** — frontend woła `GET /api/initiatives/:id/gate-readiness-check`, nigdy nie zgaduje
- Editable bands per status (DRAFT→ograniczone, PLANNING+→pełna edycja, DONE/CANCELLED→read-only)
- Scope zmieniany przez Decisions (typ SCOPE_CHANGE)

### 4.2 Session/Assignment lifecycle
```
assigned → in_progress → submitted → approved
                              ↓
                          sent_back → (powrót do in_progress)
```
- Submit (user) → AI review automatyczny → manager Approve/SendBack
- Approve wymaga completeness ≥50%

### 4.3 Insight — 3 generacje na jednej tabeli (`interview_insights`)
- Gen2 (V2 content), Gen3 (P10 findings governance: candidates→triage→promote→evidence→readback→handoff)

### 4.4 Provenance
- `source_type='interview_insight'` + `source_id` taguje pochodzenie (1:N insight→initiative)
- `evidence_refs_json` dla konkretnych findings
- ID artefaktów: INIT-/INS-/TSK-/DEC-/RPT- (stabilne, linkowalne)

---

## 5. TRZY WIZARDY — UJEDNOLICONY STANDARD ⭐

Trzy wizardy, dziś w różnym stanie i stylu:

| Wizard | Komponent | Linie | Kroki dziś | Stan |
|---|---|---|---|---|
| **Ankiety** | TemplateBuilder.tsx | 2838 | Create survey with AI + AI improve | Treściowo OK, 2 mylące AI buttony (#17) |
| **Insighty** | InsightCreatorModal.tsx | 2037 | Goal/People/Source/Analysis/Context (5) | Treściowo mądry, graficzne polish + brak Source Basket (#28) |
| **Inicjatywy** | InitiativeWizardModal.tsx | 1192 | Intencja/Kandydaci/Governance/Wynik (4) | Sekwencyjny mylący, PL/EN bug, brak similarity/capacity (#29) |

### Kanon wizarda (wspólny dla wszystkich trzech):

```
┌─ <WizardModal> ──────────────────────────────────────┐
│ Header: ikona + tytuł + Close ×                      │
│ ──────────────────────────────────────────────────  │
│ Progress: [▰▰▰▱▱ 60%]  1✓ Goal · 2● People · 3 Source │  ← progress bar + klikalne kroki
│ ──────────────────────────────────────────────────  │
│ Body (krok aktywny):                                 │
│   • Custom rounded inputy (h-10 rounded-xl)          │  ← kanon #14
│   • Portal-based dropdowny (nie zasłaniają)          │
│   • Chip-pickery zamiast natywnych selectów          │
│   • Hover tooltips „co zrobi ten wybór"              │
│ ──────────────────────────────────────────────────  │
│ Footer: [Anuluj] ............... [Back] [Next/Run]   │
└──────────────────────────────────────────────────────┘
```

**Wspólne zasady trzech wizardów:**
1. **Jeden wizualny shell** (`<WizardModal>`) — ten sam header/progress/footer/inputy
2. **Sekwencyjny z jasnym progress** — krok N pusty dopóki nie ukończysz N-1, ale UI to KOMUNIKUJE
3. **Portal dropdowny + chip pickery** (kanon #14 — nic się nie zasłania)
4. **Reusable selection** — Source Basket dla insightów (#28), Insight selection dla inicjatyw (#29)
5. **Duplicate/similarity detect** — przed Run sprawdza czy podobny artefakt istnieje
6. **Lokalizacja PL/EN spójna** — koniec mieszania (bug #29)
7. **Mądry treściowo** — lensy/tryby analizy, leading question, context docs

### Czym się RÓŻNIĄ (bo różne artefakty):
- **Ankiety:** output = template z pytaniami (lekki). Generator = „od zera" + „improve istniejące".
- **Insighty:** output = artefakt analityczny (z sesji). Generator = 5 kroków + Source Basket + variant (1 koszyk → wiele lensów).
- **Inicjatywy:** output = ciężki obiekt governance (DRAFT). Generator = z insightów + similarity dedup + capacity check + bulk 1-3.

---

## 6. AI NA TRZECH POZIOMACH ⭐⭐⭐ (zasada przewodnia ownera)

To jest **nowa pierwszorzędna zasada** — AI jako silne wsparcie na trzech poziomach granularności:

### Poziom 1 — CAŁE NARZĘDZIE (whole tool)
- **Gdzie:** toolbar artefaktu (Insight/Initiative), Menu 3 prawy slot
- **Akcje:** Regenerate całość · Re-run analysis · Generate report/deck z całości · Apply consultant lens · Compare versions
- **Przykład:** „Regeneruj całą inicjatywę z aktualnych insightów"

### Poziom 2 — DANA KARTA / SEKCJA (given card)
- **Gdzie:** prawy róg nagłówka każdej sekcji (`<AIActionSlot>`)
- **Akcje:** Regenerate tę sekcję · Improve clarity · Expand · Shorten · Suggest revisions
- **Przykład:** „Regeneruj sekcję Problem na bazie reszty inicjatywy"

### Poziom 3 — DANE POLE / KOLUMNA / OBSZAR W KARCIE (given column/area) ⭐ NAJNOWSZE
- **Gdzie:** inline przy konkretnym polu/komórce/obszarze
- **Akcje:** Improve to pole · Suggest value · Fill from context · Fix grammar
- **Przykład:** „W tabeli KPI — zaproponuj target value dla tego wiersza" / „W polu Cost of Inaction — rozwiń to zdanie"

**Implementacja — kanon `<AIAssist level>`:**
```tsx
<AIAssist level="tool" target={initiative} />       // toolbar
<AIAssist level="section" target={section} />       // section header
<AIAssist level="field" target={field} inline />    // przy polu/komórce
```

**Wspólne:** wszystkie 3 poziomy respektują backend capabilities (`canUseAi`), wszystkie zapisują wersję (rollback), wszystkie pokazują „human edytuje, AI podpowiada" — nie zastępują człowieka, wspierają go.

**Filozofia ownera:** „Duża część automatycznie, ale bardzo dużo przez człowieka — żeby korygował i dopisywał. AI mu podpowiada." → AI to **copilot na 3 poziomach**, nie autopilot.

---

## 7. STANDARD KART / DETAIL-VIEW (karta inicjatywy = wzorzec) ⭐

Owner: „karty inicjatyw były zrobione najlepiej. Resztę kart musimy doprowadzić do tego standardu."

### Wspólny `<DetailView>` kanon (Insight + Initiative + przyszłe Task/Decision/Report):

```
┌─ <DetailHeader> ─────────────────────────────────────┐
│ ← back · ● Title · [INIT-1ADDB472] 🔗 · Saved · [N|C] │  ← ID artefakt + N/C toggle
├─ <MetricStrip> ──────────────────────────────────────┤
│ Status • Phase • Next Gate • Priority • Owner • Target│  ← poziomy, dividery (nie 10 okien!)
├─ <ActionToolbar> ────────────────────────────────────┤
│ [Primary] · [Export▾][Convert▾][✨AI▾] · Generate    │  ← 1 primary + dropdowny
├──────────────┬───────────────────────────────────────┤
│ <Sidebar>    │  <SectionCard>                        │
│ (grupy +     │   Header + [✨AI▾] prawy róg           │  ← Poziom 2 AI
│  numerki +   │   ──────                               │
│  drag +      │   Body (pola z inline [✨] przy każdym)│  ← Poziom 3 AI
│  adaptive    │   ──────                               │
│  hide-empty) │   Footer (confidence/sources)         │
└──────────────┴───────────────────────────────────────┘
```

### 8 prymitywów (`src/components/shared/detailView/`):
1. `<DetailHeader>` — back/title/ID/copy-link/N-C toggle/saved
2. `<MetricStrip>` — poziomy pasek metryk z dividerami (rozwiązuje #27)
3. `<ActionToolbar>` — primary + Export/Convert/AI dropdowny (#26)
4. `<SectionSidebar>` — grupy + numerki + drag-reorder + count badges + adaptive hide-empty (#22)
5. `<SectionCard>` — jeden kanon karty sekcji (#23)
6. `<AIAssist>` — 3-poziomowy AI slot (sekcja #6)
7. `<ViewModeToggle>` — N (Notion sidebar) / C (ClickUp dense) + persystencja
8. `<SummaryCard>` — reusable compact artefakt (C-mode + embed w Reports/Decks)

### Dwa widoki (N + C):
- **N (Notion):** sidebar + 1 sekcja na raz, dużo whitespace. Onboarding-friendly.
- **C (ClickUp):** sidebar→ToC, wszystkie sekcje w grid 2-3 kol. Power-user, duże ekrany. (owner: „nie mamy clickupowej — do zrobienia")

---

## 8. SYSTEM KOLORÓW (owner: „tu możemy mieć więcej kolorów, to praktyczne narzędzia")

**Zasada:** tabele/listy = monochromatyczne (kolor tylko w status pills). **Ale artefakty (Insight/Initiative cards) = mogą mieć więcej koloru** — bo to praktyczne narzędzia robocze, kolor pomaga nawigować.

### Paleta (tailwind — istnieje):
- `navy` (tła dark), `primary` (akcent marki), `emerald` (sukces), `amber` (oczekuje), `rose` (uwaga)
- `statusColors.ts` (SSOT statusów)

### Kanon koloru:
| Kontekst | Reguła |
|---|---|
| **Tabele/listy** | Monochrome bg, kolor TYLKO w status pill + overdue chip (#18) |
| **Status pille** | 5 semantycznych: in_progress=blue, submitted=amber, approved=emerald, sent_back=rose, archived=slate |
| **Karty akcji** (Documents/App Actions) | Tło jednolite, kolor TYLKO w ikonie typu (Document=blue, Deck=purple, Table=emerald, Idea=amber, Note=slate, Initiative=primary) |
| **Sekcje artefaktu** | Mogą mieć subtelny kolorowy akcent per kategoria (np. Issues=rose-tint, Opportunities=emerald-tint) — ALE spójnie, nie tęcza |
| **AI elementy** | Zawsze primary/sparkles — user rozpoznaje „to AI" |
| **Wizardy** | Mogą używać koloru dla kroków (active=primary, done=emerald, locked=slate) |

**Kluczowe:** więcej koloru ≠ chaos. Kolor ma **znaczenie semantyczne**, nie dekoracyjne. Karta inicjatywy pokazuje dobry balans — to wzorzec.

---

## 9. 30 OBSERWACJI — POGRUPOWANE TEMATYCZNIE

(Pełne w `_IV_TEST_NOTES.md`. Tu mapa tematyczna.)

### A. FUNDAMENTY GRAFICZNE (kanony platformy)
- **#14** Form modal kanon (portal dropdowny, chip pickery, rounded)
- **#18** Tables kanon graficzny (monochrome, status pills, hairline)
- **#21** Detail view N+C standard
- **#23** Section card kanon + AI slot
- **#27** Metric strip + ID artefakt

### B. DWA ARTEFAKTY (Insight + Initiative)
- **#20** Insights tabela (porządek + kolumny + kebab)
- **#22** Insight 20→5 grup + adaptive + „między wierszami" (7 nowych sekcji)
- **#23-#27** Insight detail (format, generator, toolbar, metric, ID)
- **#30** Initiative card jako wzorzec + lifecycle source of truth

### C. TRZY GENERATORY
- **#17** Survey wizard (rebranding 2 AI buttony)
- **#28** Insight generator + Source Basket ⭐
- **#29** Initiative generator + similarity/capacity ⭐

### D. WORKFLOW MANAGERA
- **#7+#7b** System zatwierdzania (approve/sendback/submit)
- **#8** Bulk actions + archiwum
- **#9** Kolumny + kebab + eskalacja (silnik istnieje!)
- **#11** AI Quality Gate (pre-submit) — infrastruktura istnieje
- **#12** Sessions+Assigned merge + skala 400
- **#13** Assigned kolumny/kebab/filtry

### E. ZBIERANIE ANKIET
- **#5+#5b** Formatka odpowiedzi (Record inline, attachments, guidance)
- **#6** Inbox chipy filtrów
- **#10** Filtry per-column (systemowe)
- **#16** Templates kolumny (usage count)
- **#19** Audit Orchestrator (bulk-assign 100 osób) ⭐⭐⭐

### F. KIERUNKI PRODUKTU
- **#19** Audit Orchestrator (2 epicowe use case'y)
- **#26** Submit for Information (zamiast review dla insightów)

### G. BUGI / INFRA
- **#4** Voice „3 osoby" (fragment-per-message)
- **#24** Insight section crash + diagnostics
- **#3c** AI keys (tani stack Railway — ZROBIONE)
- **#1** Visible columns popover clipping

---

## 10. DECYZJE ZABLOKOWANE (owner)

| # | Decyzja | Wybór |
|---|---|---|
| Wizard output | Ile inicjatyw na raz | **Proponuje N, tworzysz 1-3** (capacity-aware) |
| Lineage | insight→initiative | **1:N** (source_type+source_id, jeden insight→wiele inicjatyw) |
| Start status | inicjatywa z wizarda | **DRAFT** (pełny review przez gates) |
| C-mode | drugi widok | **Teraz, dla obu** (reusable SummaryCard) |
| Start implementacji | od czego | **Wspólny `<DetailView>` kanon** |
| AI keys | tani stack | **OpenRouter+DeepSeek+ZAI, bez OpenAI** (ZROBIONE) |
| Voice | klucz Gemini | **Podłączony** (ZROBIONE) |
| Insight review | model | **Submit for Information** (nie review/approve) |
| Initiative review | model | **Zostaje formalny** (gate APPROVE_TO_INITIATIVE) — asymetria z insightami |

---

## 11. ROADMAPA — FAZOWANA

### FAZA 0 — P0 BUGI (przed nowymi ficzerami) · 2-3 dni
- #24 Insight section crash + crash diagnostics
- #4 Voice „3 osoby" (bufor + flush na turn-complete)
- #1 Visible columns popover clipping (portal — szybki, wspólny komponent)

### FAZA 1 — FUNDAMENT WIZUALNY (kanony) · 5-7 dni
- **#14** `<FormModal>` kanon (portal dropdowny, chip pickery, rounded) — odblokowuje 3 wizardy
- **#18** `<DataTable>` kanon (monochrome, status pills, hairline) — odblokowuje 6 tabel
- **#21+#23** `<DetailView>` kanon (8 prymitywów) — odblokowuje 2 artefakty ⭐ START
- Pilotaż DetailView na **Initiative** (już wzorzec), potem Insight

### FAZA 2 — DWA ARTEFAKTY DO STANDARDU · 7-10 dni
- Initiative: szlif do kanonu (mały — owner) + C-mode + AI 3-poziomowy
- Insight: refactor 20 sekcji → 5 grup + adaptive (#22) + per-sekcja format (#23) + 7 nowych sekcji „między wierszami"
- ID artefakt + backlinks (oba) (#27)
- Metric strip + toolbar kanon (#26, #27)

### FAZA 3 — TRZY GENERATORY · 7-10 dni
- `<WizardModal>` kanon (wspólny shell)
- Insight generator + Source Basket + variant (#28)
- Initiative generator + similarity (embeddings) + capacity + bulk 1-3 (#29)
- Survey wizard rebranding (#17)
- Handoff fix (Interview→Initiative end-to-end)
- Lineage dwukierunkowy (insight↔initiative)

### FAZA 4 — WORKFLOW MANAGERA · 5-7 dni
- Manager flow: Approve/SendBack/Archive/Bulk w menu + bulk bar (#7b, #8)
- AI Quality Gate pre-submit (#11 — infrastruktura istnieje)
- Sessions+Assigned merge + saved views + grouping (#12)
- Filtry per-column (#10) + lifecycle scope (#13)
- Eskalacja UI (#9 — silnik istnieje)

### FAZA 5 — AUDIT ORCHESTRATOR · 5-7 dni
- Audit Wizard (bulk-assign dla 100 osób × 4 zestawy) (#19)
- 2 warianty: nowa firma (digital transformation) + ISO 27001 preset
- Audit Program dashboard

### FAZA 6 — POLISH · 3-5 dni
- Formatka odpowiedzi redesign (#5)
- Inbox chipy (#6), Templates kolumny (#16)
- Reszta UX

**RAZEM: ~6-8 tygodni dedykowanej pracy.**

---

## 12. RYZYKA I PYTANIA OTWARTE

### Ryzyka:
1. **38 sekcji do ustandaryzowania** (20 insight + 18 initiative) — duża robota. Mitygacja: `<SectionCard>` kanon najpierw, migracja per sekcja.
2. **4 wizardy inicjatyw w kodzie** — konsolidacja ryzykowna (różne kontrakty).
3. **Backend gate model ciężki** — generator nie może omijać governance.
4. **Handoff Interview→Initiative dziurawy** — flow realnie nie działa end-to-end.
5. **Embeddings dla similarity** — service istnieje, ale trzeba zweryfikować jakość/koszt na tanim stacku.

### Pytania otwarte (do dalszej dyskusji):
- Czy Audit Orchestrator (#19) to osobna zakładka „Audits" czy wizard nad Sessions?
- Czy C-mode dla obu artefaktów buduje JEDEN reusable SummaryCard, czy per-typ?
- Czy 3 poziom AI (field-level) ma być wszędzie, czy tylko w wybranych polach (KPI, Financial)?
- Threshold quality gate (≥50% completeness) — konfigurowalny per org?

---

## 13. DEFINITION OF DONE (kiedy moduł jest „100%")

✅ **Ankiety:** Templates z usage/AI quality, formatka odpowiedzi pro (Record inline + attachments + guidance), manager workflow pełen (approve/sendback/archive/bulk/escalation), filtry per-column, Audit Orchestrator dla skali.

✅ **Insight:** 5-grup adaptive sidebar, 7 sekcji „między wierszami", per-sekcja format kanon, AI 3-poziomowy, Source Basket generator, ID artefakt, Submit for Information, N+C view, mądry eksport (tabela wyboru sekcji).

✅ **Initiative:** szlif do kanonu, C-mode, generator z similarity+capacity+1:N lineage, handoff end-to-end, progresywne wypełnianie, gates UI respektujące backend.

✅ **Trzy wizardy:** wspólny `<WizardModal>` shell, spójne kolory, mądre AI, reusable selection (basket/insights), duplicate detect, PL/EN spójne.

✅ **Kanony:** `<FormModal>`, `<DataTable>`, `<DetailView>`, `<AIAssist 3-level>` — wszystkie używane konsekwentnie, gotowe jako wzorzec dla innych modułów.

✅ **Zero P0 bugów:** Voice OK, brak crashy, diagnostyka działa.

**Rezultat:** jeden z najbardziej zaawansowanych qualitative-research + transformation tooli na rynku — przewaga nad RSM Wingman / Workiva / AuditBoard (klasyczne audit tools bez AI-na-3-poziomach, bez insight→initiative→execution chain).

---

## ZAŁĄCZNIK — co już ZROBIONE tej sesji (V-A/V-B/V-C + dziś)

- ✅ Security: v8 permission gates przywrócone (intra-org privilege escalation)
- ✅ Assignee resolution (3 bugi: Unknown/NULL-poison/u.name 500s)
- ✅ Status modeling (Templates real status + Assigned sent_back)
- ✅ Ad-hoc sessions nie znikają + column persistence (FilterableTable persistKey)
- ✅ D5 handoff source_type fix (initiatives widoczne w tab)
- ✅ Dead-code sweep (~1900 LOC: InsightPackView, NewSessionModal, DataTable, conflicting routes)
- ✅ Discovery revived (14→working)
- ✅ AI keys tani stack (OpenRouter+DeepSeek+ZAI na Railway, bez OpenAI)
- ✅ Voice key Gemini podłączony
- ✅ Demo-data trust guards (nie ładuje demo pod realny projekt)
- ✅ IDOR cross-org assignee guard
- ✅ 30 obserwacji + 3 dokumenty dyskusyjne + decyzje architektoniczne

**Branch:** `feat/wave1-foundations` (wypchnięty na GitHub, backup OK).
