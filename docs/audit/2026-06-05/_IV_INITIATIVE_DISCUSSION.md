# Inicjatywy — dokument dyskusyjny (pytania / wątpliwości / pomysły)

**Data:** 2026-06-05
**Kontekst:** Owner pokazał kartę inicjatywy (`Compliance & GDPR Audit`, `INIT-1ADDB472-3DD`) + wizard generatora. Poprosił: przejrzyj źródła prawdy o tym jak zarządzamy inicjatywami, przygotuj listę pytań/wątpliwości/pomysłów, potwierdź że masz wszystkie jego wcześniejsze obserwacje.

**Źródła prawdy przeczytane (potwierdzone w kodzie):**
- `server/src/constants/initiativeStatuses.ts` — 13-statusowa maszyna stanów
- `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` — kanon CTA × rola × status
- `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md` — backend-owned capabilities
- `docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md` — role
- `GET /api/initiatives/:id/gate-readiness-check` — backend source of truth dla uprawnień

---

## CZĘŚĆ 0 — Potwierdzenie: mam wszystkie Twoje wpisy ✅

Wszystkie 29 obserwacji + analiz są w `_IV_TEST_NOTES.md` (2071 linii). Indeks #1–#29 z pod-wpisami. **Nic nie przeleciało.** Trzy ostatnie wątki które wrzuciłeś w blokach (eksport-z-tabelą, Submit for Information, metryki/ID/drugi-widok) są zapisane jako **#25, #26, #27**. Generator insightów = **#28**, generator inicjatyw = **#29**.

---

## CZĘŚĆ 1 — Karta inicjatywy JAKO WZORZEC (Twoja teza: „to jest znacznie lepsze niż insight")

Zgadzam się w 100%. Karta `Compliance & GDPR Audit` ma to, czego brakuje Insightowi:

**Co jest świetne (i co przenosimy jako standard):**
1. ✅ **Top strip metryk czysty i symetryczny** — `Status · Phase · Next Gate · Priority · Owner · Target` (6 pól, równe) → **port do Insightów** (rozwiązuje #27 „10 okien niesymetrycznie")
2. ✅ **ID jako artefakt** — `INIT-1ADDB472-3DD` widoczny + link icon → to jest dokładnie wzorzec z #27 dla Insight `INS-II_A0552A23-`
3. ✅ **Action toolbar z hierarchią** — `Mark Complete · New Task · New Decision · Add RAID · Mark Blocked · Cancel` + `Generate scope` po prawej (primary AI) → lepszy niż tęczowy toolbar Insightu (#26)
4. ✅ **Sidebar 18 sekcji z numerkami + drag-reorder + count badges** — Initiative Scope / Tasks 4 / Decisions 1 / Team / Timeline / Risk & RAID 1 / Success Criteria / KPIs & Benefits / Dependencies / Financial Analysis / Financial Impact / RACI / Gates / Resources / Attachments & Links / Used in (backlinks) / Comments / Activity Log
5. ✅ **Per-sekcja AI button** (widoczny „✨ AI" przy PROBLEM / PROPOSED SOLUTION / COST OF INACTION / MARKET CONTEXT) → dokładnie czego chcesz dla insightów (#23)
6. ✅ **Każda sekcja sformatowany układ** (PROBLEM / PROPOSED SOLUTION / COST OF INACTION / MARKET CONTEXT z opisami i placeholderami)
7. ✅ **"Used in (backlinks)"** sekcja — pokazuje gdzie inicjatywa jest podpięta jako artefakt (to czego chcemy dla insight ID, #27)

**Wniosek:** karta inicjatywy to **referencyjny wzorzec dla #21 (detail view standard)**. Zamiast projektować od zera — bierzemy ten układ i:
- Przenosimy go do Insightów (top strip, per-section AI, backlinks, ID)
- Standardyzujemy oba na jeden `<DetailView>` kanon
- Dorabiamy brakujący **C-mode (ClickUp)** dla obu (Twój explicit: „nie mamy wersji clickupowej")

**Czego karcie brakuje (Twoje słowa „nie jest jeszcze idealne"):**
1. ❌ **Brak C-mode** (dense/summary view) — tylko N-mode (Notion sidebar)
2. ⚠️ **Menu 3 prawy slot niepełny** — `Generate scope` jest, ale brakuje `Regenerate całą inicjatywę` + spójnego AI-slot per sekcja w prawym rogu (Twój spec)
3. ⚠️ **18 sekcji to dużo** (jak w Insight 20) — adaptive hide-empty + grupowanie (jak #22)
4. ⚠️ **Standaryzacja formatów sekcji** — „każda zakładka swój układ" → ujednolicić na `<SectionCard>` kanon (#23)

---

## CZĘŚĆ 2 — ŹRÓDŁO PRAWDY: jak DZIŚ zarządzamy inicjatywami (żebyśmy nie projektowali na ślepo)

To jest **ciężki obiekt governance** — dużo bogatszy niż myślałem. Kluczowe fakty:

### Maszyna stanów — 13 statusów, 4 fazy:
```
FAZA 1 (Tools/Assessment):  DRAFT → PENDING_REVIEW
FAZA 2 (Initiatives):       REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED
FAZA 3 (Execution):         EXECUTING ⇄ BLOCKED → DONE
FAZA 4 (Benefits):          TRACKING
Terminalne:                 CANCELLED, ARCHIVED
```

### Gates (bramki) — przejścia governance, NIE swobodne:
- Każde przejście statusu = **gate** z **rolą zatwierdzającą** (np. `ACCEPT`: REVIEW→PROMOTED wymaga Sponsor/Steering)
- **Backend jest źródłem prawdy** — frontend NIGDY nie zgaduje uprawnień, woła `gate-readiness-check`
- Przykłady: `SUBMIT_FOR_REVIEW` (autor), `APPROVE_TO_INITIATIVE` (PM), `SCHEDULE` (PMO, zamraża timeline baseline), `START_TRACKING` (Business Owner, wymaga KPI)

### Role (10+): PROJECT_MANAGER, PROJECT_LEAD, PROJECT_SPONSOR, PMO, STEERING_COMMITTEE, INITIATIVE_OWNER, BUSINESS_OWNER, CONSULTANT (non-authoritative), TEAM_MEMBER...

### Scope — NIE jest osobnym wymiarem:
- Scope to **sekcja treści** + **zmieniany przez Decisions** (typ `SCOPE_CHANGE`)
- Nie ma „scope bands" / „resizing" — zmiana zakresu = decyzja z audit trail

### 4 ścieżki tworzenia:
1. **Manual wizard** (pełna proweniencja, `source_type='interview_insight'`)
2. **Handoff z findingu** ⚠️ (P0 bug — nie taguje source_type, niewidoczne w tab — to nasz #102 V-A S3 fix, ale Explore flaguje że handoff dalej może być dziurawy)
3. **AI generation service** (`initiativeGenerationService`)
4. **Assessment module** (DRAFT → review → promote)

### Editable bands per status:
- DRAFT/PENDING_REVIEW/REVIEW/PROMOTED → tylko `decision`, `raid` (ograniczone)
- PLANNING/APPROVED/SCHEDULED/EXECUTING/BLOCKED → pełna edycja (`task`, `decision`, `raid`)
- CANCELLED/ARCHIVED/DONE/TRACKING → read-only

**To jest kluczowe dla generatora:** inicjatywa z wizarda startuje jako **DRAFT** i przechodzi przez całą maszynę. Generator NIE tworzy od razu „gotowej" inicjatywy — tworzy **draft do governance flow**.

---

## CZĘŚĆ 3 — WIZARD: dlaczego „nie mogłeś przełączać zakładek" (Twoja wątpliwość)

Twoja obserwacja: „mam inicjatywy, później kandydaci, governance, i nie mogę tego dalej przełączać. Nie wiem jaka jest idea."

**Wyjaśnienie:** wizard `Intencja → Kandydaci → Governance → Wynik` jest **sekwencyjny i bramkowany**:
- Krok 2 (Kandydaci) jest **pusty dopóki nie klikniesz „Wygeneruj kandydatów"** w kroku 1
- Nie możesz przeskoczyć do Governance bo nie ma jeszcze kandydatów do governance'owania
- To jest **celowe**, ale **UX tego nie komunikuje** — wygląda jakby było zepsute

**To potwierdza #29:** wizard wymaga przeprojektowania na jasny flow z progress + Step 0 (wybór insightów).

---

## CZĘŚĆ 4 — WIELKI ROZJAZD który widzę (najważniejsza wątpliwość do dyskusji)

Jest **napięcie koncepcyjne** między dwoma rzeczami:

**A) Wizard generuje BULK kandydatów** — „z insightów AI proponuje 5 inicjatyw, wybierasz które, tworzysz listę"

**B) Karta inicjatywy to CIĘŻKI pojedynczy obiekt** — 18 sekcji, 13-statusowy lifecycle, gates, governance, KPIs, RAID, Financial, RACI...

**Pytanie:** kiedy wizard tworzy 5 inicjatyw naraz — czy każda od razu dostaje 18 pustych sekcji do wypełnienia? Bo wtedy:
- 5 inicjatyw × 18 sekcji = 90 sekcji do uzupełnienia → przytłoczenie
- Albo wizard wypełnia tylko 4-5 kluczowych (Problem / Solution / Scope / KPI), reszta zostaje pusta na później

**To jest dokładnie to, co powiedziałeś:** „duża część pracy automatycznie, ale bardzo duża część przez człowieka później, żeby korygował i dopisywał, AI mu podpowiada."

**Moja propozycja rozwiązania tego napięcia** (do Twojej akceptacji):

```
Wizard tworzy inicjatywę w stanie DRAFT z:
  ✅ Wypełnione przez AI (z insightu): Problem, Proposed Solution, Cost of Inaction,
     Scope (draft), Success Criteria (draft), KPIs (suggested), Evidence links
  ⬜ Puste, czekają na człowieka+AI: Team, Timeline, Financial, RACI, Resources,
     Dependencies, Technical Spec, Communication Plan, Vendor...
  
Każda pusta sekcja ma:
  • Placeholder z pytaniem naprowadzającym (już jest! „What problem are we solving?")
  • Przycisk „✨ AI" w prawym rogu → AI proponuje treść na bazie insightu + reszty inicjatywy
  • Human edytuje, AI podpowiada
```

**To rozwiązuje rozjazd:** wizard daje „szkielet z mięsem w kluczowych miejscach", człowiek+AI dopełniają resztę progresywnie w miarę jak inicjatywa przechodzi przez gates (sekcje stają się wymagane na różnych etapach — np. Timeline baseline dopiero przy SCHEDULE gate).

---

## CZĘŚĆ 5 — PYTANIA (potrzebuję Twojej decyzji)

**P1. Ile inicjatyw na raz z wizarda?** Czy wizard tworzy 1 inicjatywę (wybierasz najlepszego kandydata), czy bulk N inicjatyw naraz? Source-of-truth sugeruje że każda to ciężki obiekt — bulk 5 = 5 ciężkich draftów. Rekomenduję: **wizard proponuje N kandydatów, ale tworzysz świadomie 1-3, nie 10**.

**P2. Czy generator ma respektować capacity?** Maszyna stanów pokazuje że inicjatywa wymaga ownera, gates, KPI. Czy chcesz capacity check „zespół ma X aktywnych, dodaj rozsądnie" (mój #29 pomysł)?

**P3. Similarity / dedup — na jakim poziomie?** Owner spec „nie definiuj jeśli już jest". Czy porównujemy:
   (a) tylko w tym projekcie, (b) w całej org, (c) też completed z ostatnich 6 mies? Embedding service istnieje.

**P4. Insighty → inicjatywy: relacja 1:N czy N:M?** Czy 1 inicjatywa może wynikać z wielu insightów (N:M)? Source-of-truth ma `source_id` (pojedynczy) + `evidence_refs_json` (wiele). Rekomenduję **N:M przez evidence_refs**.

**P5. Czy wizard tworzy w DRAFT czy od razu wyżej?** Lifecycle startuje DRAFT. Czy inicjatywa z insightu ma iść do DRAFT (i przejść review), czy od razu REVIEW (bo konsultant już ją przemyślał)?

**P6. Submit for Information dla inicjatyw też?** Dla insightów ustaliliśmy „Submit for Information" zamiast review (#26). Ale inicjatywy MAJĄ formalny review (gate `APPROVE_TO_INITIATIVE`). Czyli inicjatywy ZOSTAJĄ przy review/approve, a insighty nie. Potwierdzasz tę asymetrię?

**P7. Drugi widok (C-mode) — teraz czy później?** Dla obu (Insight + Initiative)? To buduje reusable `<SummaryCard>` artefakt. Rekomenduję: **tak, w tej rundzie**, bo karta inicjatywy i tak wymaga refactoru.

---

## CZĘŚĆ 6 — WĄTPLIWOŚCI (napięcia/ryzyka które widzę)

**W1. 18 sekcji inicjatywy + 20 sekcji insightu = 38 formatów do ustandaryzowania.** To duża robota. Ryzyko: jeśli zrobimy to niespójnie, będzie gorszy chaos niż teraz. **Mitygacja:** najpierw `<SectionCard>` kanon (1 komponent), potem migracja per sekcja.

**W2. Backend inicjatyw jest BARDZO rozbudowany** (13 statusów, gates, capabilities endpoint, role resolution, ScheduleBaseline). Generator musi to respektować — nie może tworzyć inicjatyw omijających governance. **Ryzyko:** wizard który tworzy „gotowe" inicjatywy złamie model gate'ów.

**W3. 4 różne wizardy inicjatyw w kodzie** (`InitiativeWizardModal`, `InitiativeGeneratorWizard`, `InitiativesGenerationWizardModal`, `AdminInitiativeCreatorPanel` + hook). Konsolidacja konieczna ale ryzykowna — mogą mieć różne kontrakty.

**W4. Handoff z findingu może być dalej dziurawy** — Explore flaguje że P0 (source_type nie zapisywany). My naprawiliśmy część w V-A S3, ale trzeba zweryfikować pełny flow finding→initiative.

**W5. „Interview nie ma żadnej inicjatywy"** (Twoje słowa) — inicjatywy które pokazałeś były z innej części programu. Czyli **flow Interview→Initiative jeszcze realnie nie działa end-to-end**. To potwierdza że #29 (generator) + handoff fix to fundament, nie polish.

**W6. Scope przez Decisions** — to elegancki model, ale czy konsultant to zrozumie? „Chcę zmienić zakres" → musi zrobić Decision typu SCOPE_CHANGE. Może wymagać onboarding hint.

---

## CZĘŚĆ 7 — POMYSŁY (propozycje)

**I1. Jeden `<DetailView>` kanon dla Insight + Initiative** — top strip + sidebar sekcji (grupowane, adaptive) + per-section AI slot + N/C toggle + backlinks + ID artefakt. Karta inicjatywy = baza, insight się podciąga.

**I2. „Progresywne wypełnianie" inicjatywy** — wizard wypełnia rdzeń (Problem/Solution/Scope/KPI z insightu), reszta pusta z AI-assist per sekcja. Sekcje stają się wymagane progresywnie wg gate (Timeline dopiero przy SCHEDULE).

**I3. Menu 3 prawy slot — kanon dla obu:**
   - Globalnie: `[⚡ Regenerate całość] [✨ AI ▾]`
   - Per sekcja: `[✨ AI ▾]` w prawym rogu nagłówka (Regenerate sekcji / Improve / Expand / Suggest)

**I4. Generator inicjatyw = „transformation planner"** — nie „dodaj inicjatywę" tylko „zaplanujmy co zmienić w organizacji" (Twoje słowa). Z insightów → AI proponuje portfolio inicjatyw z dedup + capacity + similarity, konsultant kuratoruje.

**I5. Initiative ID jako uniwersalny artefakt** — `INIT-` linkowalny w Reports/Decks/Notes/innych inicjatywach (jak #27 dla insight). Plus „Used in (backlinks)" już istnieje — rozszerzyć.

**I6. Insight → Initiative lineage widoczny** — w inicjatywie sekcja „Source insights" (z których insightów powstała) + w insighcie „Spawned initiatives" (co z niej wynikło). Pełna dwukierunkowa proweniencja.

**I7. Capacity/Portfolio Health dashboard** — gdy masz N inicjatyw, widok „ile aktywnych, overload status, dependency graph, completion rate" (z #29 V3).

---

## CZĘŚĆ 8 — REKOMENDOWANA SEKWENCJA (do dyskusji)

**Najpierw fundament wspólny (Insight + Initiative):**
1. `<DetailView>` kanon (top strip + sidebar + section card + AI slot + N/C toggle) — bo oba tego potrzebują
2. `<SectionCard>` standard + per-section AI
3. ID artefakt + backlinks (oba)

**Potem generatory (rdzeń wartości):**
4. Insight generator + Source Basket (#28)
5. Initiative generator + similarity/capacity (#29) + handoff fix
6. Lineage dwukierunkowy

**Potem workflow:**
7. Insight Submit for Information (#26)
8. Initiative gates UI (respektować backend capabilities)

**Potem polish:**
9. C-mode dla obu
10. Reszta sekcji format standaryzacja

---

## PYTANIE KOŃCOWE DO CIEBIE

Zanim zacznę implementację, najważniejsze rozstrzygnięcia:
1. **P1** (1 vs N inicjatyw z wizarda)
2. **P4** (insight→initiative 1:N czy N:M)
3. **P5** (DRAFT czy REVIEW na start)
4. **P7** (C-mode teraz czy później)
5. Czy zaczynamy od **wspólnego `<DetailView>` kanonu** (moja rekomendacja — bo odblokowuje oba moduły naraz)?

To są 5 decyzji które determinują architekturę. Reszta to wykonanie.

---

## ✅ DECYZJE ZABLOKOWANE (owner, 2026-06-05)

| # | Decyzja | Wybór | Konsekwencja architektoniczna |
|---|---|---|---|
| **P1** | Ile inicjatyw z wizarda | **Proponuje N, tworzysz 1-3** | Wizard = capacity-aware: AI generuje 5-7 kandydatów, ale UI domyślnie pozwala utworzyć 1-3 (soft limit + ostrzeżenie przy >3). Unika cmentarzyska niepełnych draftów. |
| **P4** | Relacja insight→inicjatywa | **1:N (1 insight → wiele inicjatyw)** | `initiatives.source_type='interview_insight'` + `source_id=<insightId>` (pojedyncze źródło). Z jednego insightu można utworzyć kilka inicjatyw, każda taguje ten sam insight. `evidence_refs_json` dla findings. NIE robimy N:M — prościej, zgodnie z istniejącym schematem. |
| **P5** | Start status | **DRAFT (pełny review)** | Inicjatywa z wizarda startuje w `DRAFT`, przechodzi `SUBMIT_FOR_REVIEW → PENDING_REVIEW → APPROVE_TO_INITIATIVE → REVIEW...`. Pełne governance, bezpieczne. Respektuje maszynę stanów. |
| **P7** | C-mode (drugi widok) | **Teraz, dla obu** (rekomendacja domyślna) | `<DetailView>` od razu ma N/C toggle. Buduje reusable `<SummaryCard>` artefakt embedowalny w Reports/Decks. |
| **START** | Od czego zaczynamy | **Wspólny `<DetailView>` kanon** | Fundament odblokowujący Insight I Initiative naraz. Pierwszy krok implementacji. |

---

## 🚀 PLAN PIERWSZEGO KROKU — `<DetailView>` kanon (zgodnie z decyzją START)

**Cel:** jeden komponent detail-view obsługujący Insight + Initiative, z N/C toggle.

**Prymitywy do zbudowania (`src/components/shared/detailView/`):**
1. `<DetailHeader>` — back + title + status dot + ID artefakt (INIT-/INS-) + copy-link + N/C toggle + Saved indicator
2. `<MetricStrip>` — poziomy pasek metryk z dividerami (rozwiązuje #27 „10 okien"), część read-only część editable wg capabilities
3. `<ActionToolbar>` — primary action + secondary dropdowny (Export/Convert/AI) — kanon z #26
4. `<SectionSidebar>` — sekcje z numerkami + drag-reorder + count badges + adaptive hide-empty (grupowanie wg #22)
5. `<SectionCard>` — jeden kanon karty sekcji: header + AI slot prawy róg + body + footer (rozwiązuje #23)
6. `<AIActionSlot>` — dropdown AI per sekcja (Regenerate/Improve/Expand/Suggest) — Menu 3 prawy slot kanon
7. `<ViewModeToggle>` — N (Notion sidebar sequential) / C (ClickUp dense grid) + persystencja per user
8. `<SummaryCard>` — reusable compact artefakt (C-mode + embed w Reports/Decks)

**Pilotaż:** najpierw na **Initiative** (bo to już lepszy wzorzec wg ownera), potem podciągnąć Insight do tego samego kanonu.

**Respektować:** backend `gate-readiness-check` capabilities — AI slot disabled gdy `canUseAi=false`, sekcje editable wg status band.

**Weryfikacja:** tsc=0, esbuild OK, oba serwery 200 (standard sesji).
