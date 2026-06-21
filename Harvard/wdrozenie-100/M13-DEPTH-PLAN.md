# M13 DEPTH — Program rozwoju wg mapy myśli (nowy kanon)

> **Status:** plan do akceptacji Piotra · **Data:** 2026-06-20 · **Decyzja:** mapa myśli „Inicjatywy" = nowy kanon M13; domknięcie 8/8 wstrzymane, teczka idzie na re-plan.
> **Powiązane SSOT:** [`M13-inicjatywy.md`](M13-inicjatywy.md) (teczka) · [`../../docs/product/INITIATIVE_GATE_AI_SPEC.md`](../../docs/product/INITIATIVE_GATE_AI_SPEC.md) (Fala 1) · `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` · `docs/standards/CARD_CONTENT_FORMULA.md` · `docs/initiatives/INITIATIVE_FORMULA.md`
> **Zasada nadrzędna:** kod jest ~80–90% gotowy w każdej gałęzi. To program **pogłębienia i wykończenia**, nie greenfield. Wszystko, co dotyka żywych klientów (VTS/Apator/Elkomtech), idzie za flagą per-org.

---

## 0 · Stan wejściowy (recon 2026-06-20)

| # | Gałąź | Stan | Główna delta |
|--|--|--|--|
| 1 | Generator | 🟢 solidny | portfolio-aware (dedup) 🔴 · wybór modelu LLM 🟡 · orkiestrator „cała inicjatywa" 🟡 |
| 2 | AI wypełnia (całość/karta/sekcja) | 🟢/🟡 | 7 sekcji bez AI · jakość = advisory nie bramka |
| 3 | Karty | 🟢 katalog+AI+CRUD | §B3 nieegzekwowane 🟡 · brak `CardContainer` 🟡 · korelacja in-memory 🟡 |
| 4 | Proces zatwierdzania | 🟢 maszyna+role+bramki | AI merytoryczne 🔴 · AI na linii czasu 🔴 · cross-module status 🟡 |
| 5 | Powiązane M13a–d | 🟢/🔴 | Taski ✅ · Decyzje ✅ · Kalendarz 🔴 · Notyfikacje 🔴 |
| 6 | Widoki | 🟢 Lista/Kanban/Grid/Preview | Gant = kwartalny portfelowy, nie zadaniowy 🟡 |
| 7 | Tworzenie przez Teresę | 🟡 tool niepodłączony | `create_initiative` approval-gated, persona nie wymienia inicjatyw |

---

## 1 · Fale (sekwencja programu)

| Fala | Zakres (gałąź) | Rozmiar | Ryzyko żywych | Stan planu |
|--|--|--|--|--|
| **W1** | **AI na bramce** (#4) — merytorycznie + na linii czasu | L | 🔴 wysokie (za flagą) | **spec gotowy** → `INITIATIVE_GATE_AI_SPEC.md` |
| **W2** | **Kalendarz M13c + Notyfikacje M13d** (#5) — realne braki | M+M | 🟡 średnie | ten dok §3 |
| **W3** | **Generator portfolio-aware + Teresa e2e** (#1+#7) | M | 🟢 niskie | ten dok §2 |
| **W4** | **Karty: jakość §B3 + CardContainer + korelacja** (#3) + domknięcie AI-fill sekcji (#2) | M–L | 🟢 niskie | ten dok §2 |
| **W5** | **Widoki: realny Gant zadaniowy + drag-reschedule** (#6) | M | 🟢 niskie | ten dok §2 |
| **W0** | Stabilizacja M13a/M13b (Taski/Decyzje) — domknięcie istniejącego | S | 🟢 niskie | §3 |

Kolejność W2–W5 = rekomendacja CTO (Piotr może przestawić). W1 zablokowana decyzją Piotra.

---

## 2 · Epiki per gałąź (cel · delta · DoD)

### EPIK 1 — Generator *(W3)*
- **Cel:** generować inicjatywę wg doktryny McKinsey, świadomą całego portfela.
- **Stan:** `initiativeGenerationService.ts` (doktryna, suggest-sections, readiness-analysis) — solidny.
- **Delta:**
  - 🔴 **Portfolio-aware**: przed generacją query istniejących inicjatyw org → wykrycie duplikatu/podobieństwa (embedding/kategoria) → ostrzeżenie „podobna inicjatywa już istnieje: …".
  - 🟡 **Wybór modelu LLM** (mapa: „Modele LLM do tworzenia"): dziś stały tier `premium`. Decyzja Piotra (pytanie §4) czy dodajemy UI wyboru per-org/per-sekcja.
  - 🟡 **Orkiestrator „cała inicjatywa od zera"**: endpoint łączący generację sekcji w komplet (dziś per-sekcja + iteracja).
- **DoD:** dedup ostrzega przed duplikatem · (opcj.) wybór modelu · „generuj całość" zwraca komplet kart wg formuły · testy.

### EPIK 2 — AI wypełnia (kompetentny system) *(W4)*
- **Cel:** AI uzupełnia całość / pojedynczą kartę / pojedynczy obszar — kompetentnie i wiarygodnie.
- **Stan:** całość+karta OK; sekcje częściowo (dispatcher `runActiveSectionAi`).
- **Delta:** domknąć 7 sekcji bez AI (RACI, OKR, hipoteza, change-log, workstream-owners, lessons-learned, suggested-changes) — priorytetyzacja wg wartości (OKR/hipoteza wyżej niż change-log). Jakość: spójność z decyzją o bramkach (miękka).
- **DoD:** każda sekcja ma albo realny AI-handler, albo świadomy, opisany no-op · testy.

### EPIK 3 — Karty *(W4)*
- **Cel:** spójny, dobrze opisany, skorelowany system kart.
- **Stan:** katalog 24–32 + registry + AI-propozycja kart + CRUD typów — solidny.
- **Delta:**
  - 🟡 **Egzekwowanie §B3** (mapa: „zakres kart i dokładny opis"): walidatory `CARD_CONTENT_FORMULA` §B3 jako realna warstwa (dziś tylko advisory). Tryb (twardy/miękki) = pytanie §4.
  - 🟡 **`CardContainer`** (mapa: „układ graficzny na kartach"): wspólny komponent nagłówka/ciała karty → spójność §27 zamiast 32 bespoke. Spory refactor — pytanie §4 (v1 czy później).
  - 🟡 **Korelacja artefaktów** (mapa: „korelacja z innymi artefaktami"): `LinkedItems` dziś in-memory → trwała tabela `initiative_linked_items` + graf prowieniencji (`link_graph_edges`).
- **DoD:** walidatory działają wg decyzji · karty renderują się przez wspólny container · linki trwałe + odpytywalne · testy.

### EPIK 4 — Proces zatwierdzania *(W1)* → **`INITIATIVE_GATE_AI_SPEC.md`**
- **Cel:** AI wspiera bramki merytorycznie i na linii czasu; status „rządzi pracą w organizacji".
- **Delta:** AI gate rollup (9 bramek) · analizator czasowy (SCHEDULE/START) · miękka blokada + override + telemetria · flaga per-org · cross-module status enforcement (M14/15/16).
- **DoD:** patrz spec §9.

### EPIK 5 — Powiązane M13a–d *(W0+W2)* → §3 (zadania)
- Taski (M13a) ✅ · Decyzje (M13b) ✅ · Kalendarz (M13c) 🔴 · Notyfikacje (M13d) 🔴.

### EPIK 6 — Widoki *(W5)*
- **Cel:** Lista/Kanban/Grid/Preview (✅) + **realny Gant zadaniowy**.
- **Delta:** dziś Gant = kwartalny portfelowy (`InitiativesTimelineView`). Build: schedule-bar na poziomie zadań/kamieni (dni/tygodnie) + drag-to-reschedule + ścieżka krytyczna z `TimelineAnalysis`.
- **DoD:** Gant zadaniowy z drag-reschedule, spójny z Kalendarzem M13c (wspólne źródło dat) · testy.

### EPIK 7 — Tworzenie przez Teresę *(W3)*
- **Cel:** użytkownik tworzy inicjatywę z czatu Teresy.
- **Stan:** `create_initiative` tool istnieje, ale MUTATION approval-gated + persona nie wymienia inicjatyw → e2e nie działa.
- **Delta:** `generate_initiative` (READ/auto, wzorem `generate_deliverable`) tworzący DRAFT bez approval-gate + dopisanie inicjatyw do system-promptu Teresy + montaż w czacie.
- **DoD:** „Teresa, stwórz inicjatywę X" → DRAFT na liście, otwieralny · live test PL/EN.

---

## 3 · ZADANIA M13a–M13d (powiązane artefakty)

> Decyzja architektoniczna do potwierdzenia (pytanie §4): czy M13a–d są **tylko dla inicjatyw**, czy **współdzielone sub-artefakty** reużywalne przez pozostałe moduły (M14/15/16…). Poniższe karty zakładają start jako initiative-scoped z myślą o późniejszym współdzieleniu.

### M13a — Taski *(W0 · stabilizacja)*
- **Stan:** ✅ `sections/TasksMilestonesSection.tsx` (CRUD + statusy + AI-propozycje).
- **Do domknięcia:** korelacja z Kalendarzem/Gantt (wspólne źródło dat) · AI-fill polish · testy + screeny.
- **DoD:** CRUD+AI live-zweryfikowane · zasilają Kalendarz M13c i Gant.

### M13b — Decyzje *(W0 · stabilizacja)*
- **Stan:** ✅ `sections/DecisionsSection.tsx` + `DecisionController`.
- **Do domknięcia:** korelacja decyzji GO/NO-GO ↔ bramki (#4) · testy + screeny.
- **DoD:** decyzje typu GO_NO_GO widoczne przy odpowiedniej bramce · CRUD live.

### M13c — Kalendarz *(W2 · build)*
- **Stan:** 🔴 brak (jest timeline/Gantt-analiza, brak widoku kalendarza).
- **Build:** widok kalendarza (miesiąc/tydzień) dla tasków+kamieni+terminów inicjatywy · źródło: tasks/milestones/timeline · drag-to-reschedule (PATCH dat) · filtry status · dark/light.
- **DoD:** kalendarz renderuje zadania po dacie · drag przesuwa termin (persist) · spójny z Gant M13 · testy + screeny.

### M13d — Notyfikacje *(W2 · build)*
- **Stan:** 🔴 brak wiring (infra `NotificationApi` + reminders UI istnieją, ZERO eventów inicjatyw).
- **Build:** emitery eventów inicjatywy → status change · przypisanie (owner/assignee) · przekroczenie terminu · blocker. Kanały: in-app + email (Slack? — pytanie §4). Reużycie istniejącej infra + reminders.
- **DoD:** zmiana statusu/przypisanie/termin/blocker generują notyfikację (in-app+email) · org-scope · testy.

---

## 4 · Otwarte pytania produktowe (do Piotra)

1. **§3 required-sections per bramka** (`GATE_AI_SPEC` §3) — walidacja domenowa: które sekcje są wymagane dla której bramki?
2. **M13a–d: initiative-scoped czy współdzielone** sub-artefakty (reuse w M14/15/16)? (= „dla pozostałych artefaktów"?)
3. **Notyfikacje M13d:** kanały (in-app / email / Slack?) i które eventy są MUST.
4. **Kalendarz M13c vs Gant:** osobny widok kalendarza + osobny Gant, czy jeden wspólny silnik czasu?
5. **Generator — wybór modelu LLM:** UI wyboru (per-org/per-sekcja) czy zostaje stały premium-tier + fallback?
6. **Karty — `CardContainer`:** robimy wspólny refactor 32 komponentów w v1 czy odkładamy?
7. **Jakość kart §B3:** egzekwowanie twarde (blokuje zapis) czy miękkie (spójnie z decyzją o bramkach)?
8. **Kolejność fal:** akceptujesz W2–W5 jak wyżej, czy przestawiamy?

---

## 5 · Bezpieczeństwo / zależności

- Wszystko dotykające bramek/statusów (W1, cross-module) za flagą per-org; demo/wewn najpierw.
- Kalendarz/Gant współdzielą źródło dat (tasks+milestones+timeline) — wspólny serwis czasu, by uniknąć dryfu.
- Notyfikacje reużywają istniejącej infra (nie nowy system).
- Done-by-the-way (już w kodzie): DELETE status-guard 409 + test 7/7, kebab Archive/Delete w dokumencie (tsc clean).
