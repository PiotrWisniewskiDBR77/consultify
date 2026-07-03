# ★★★ DZIENNY PLAYBOOK — 2 PACZKI × 10 ZADAŃ (handoff dla agenta dziennego)
> Ustanowiony 2026-07-03 przez partnera-CTO na polecenie Piotra. Czytasz to jako ŚWIEŻY agent-orkiestrator z zerową pamięcią rozmowy. Ten dokument + 4 pliki niżej = wszystko, czego potrzebujesz.
> **Kontekst:** noc (R1-R4, 40 zadań) wdrożona i live; program finiszu 3 filarów trwa. Ty domykasz następne 20 działań (2 paczki) z podziałem Oxford/Vegas/Harvard.

## 0. NAJPIERW PRZECZYTAJ (w tej kolejności)
1. `_FINISZ_MASTER_PLAN.md` — pakt, 3 projekty, §2b modele, §0b metoda, macierz pokrycia.
2. `_PROJEKT_A_HARVARD.md` / `_PROJEKT_B_VEGAS.md` / `_PROJEKT_C_OXFORD.md` — zamknięte listy z licznikami.
3. `_TEST_ZAUFANIA_TRZY_FILARY.md` — miara jakości (ŁADNI×NIEZAWODNI×KOMPETENTNI).
4. `_KOORDYNACJA_CLAUDE_PIOTR.md` sekcja C — dziennik decyzji+odbiorów.
5. Ten plik — kolejka 20 zadań (2 paczki).

## 1. STAN NA START (demo LIVE po nocy)
- Noc R1-R4 wdrożone: OXFORD 19/19 tooli + DRD raport/narrator + q-bank EN + AI-guidance + finanse-doradztwo + CONCLUSION_LAYER · VEGAS Fale 1-3 częściowo + edytory + huby + stylery · HARVARD golden-path 9/11 + bugi + Panel Health + reconciliation.
- **Wszystko z nocy = 🟡 wdrożone-czeka-na-odbiór Piotra.** Ty budujesz NASTĘPNE, nie ruszasz zrobionego.

## 2. ⚙️ FORMUŁA PRACY WIELOMA AGENTAMI + MODELE (zarządzenie Piotra 2026-07-03)
**Fale wielu agentów w worktree, rozłączne zakresy. Model dobierasz do trudności:**
- **FABLE 5** = **cały czas AUDYTUJE pracę** sub-agentów (nie tylko na bramkach) + **zarządza jakością** + robi **NAJTRUDNIEJSZE kody/architekturę/decyzje**. Nic trudnego nie idzie do merge bez przeglądu Fable. To jest mózg jakości fali.
- **OPUS** = inne trudne kody — koń roboczy implementacji wg spec.
- **SONNET** = tworzenie prostych rzeczy, treści (q-banki/prompty/raporty/i18n), instrukcje.
- **HAIKU** = trywialna mechanika.
- **Kanapka:** Fable projektuje/audytuje → Opus/Sonnet wykonuje → Fable weryfikuje. Eskalacja: 2× zła robota Opusa → Fable przejmuje.
- **Miara każdego zlecenia:** „czy konsultant HBS (MBA, 10 lat) pokazałby to klientowi?" + „widać poprawę bez szukania?".

## 3. REGUŁY OPERACYJNE (twarde — łam=psujesz)
- **PROD (centerbeam/consultify.ai) NIETYKALNY** bez jawnej zgody Piotra. Demo deploy = gałąź `demo`→Railway.
- Każdy sub-agent = **worktree** (`isolation`), commit na swojej gałęzi, NIE pushuje. TY mergujesz zbiorczo.
- **★ KOORDYNACJA — 3 RÓWNOLEGŁE STRUMIENIE, NIE DOTYKAJ ICH PLIKÓW** (kolizja=STOP+raport):
  - **Atelier seeding:** `server/src/services/demo/atelierToysDemoTemplate.ts`, `demoSeedService.ts`, `server/scripts/*seed*`, `scripts/deliverables/_atelier-*`.
  - **Remont wejścia do demo:** `UserProfileMenu.tsx`, demoSlice, `/api/demo/*`, gatewaye WS (`ideaCollabWs.gateway.ts`), komponenty Demo*.
  - **Slack:** `server/src/routes/feedback.routes.ts`, `server/src/routes/slack/slackInbound.routes.ts`, `server/src/services/slack/feedbackThreadAnchor.ts`.
- **Deploy na demo KOORDYNUJ z partnerem-CTO** (3 strumienie na jednym `demo` = git-race) — domyślnie commituj na gałęzie, batch-deploy uzgodniony.
- Build `NODE_OPTIONS=--max-old-space-size=8192 npm run build`. Testy `git add -f` (/tests/ gitignored). i18n gate 0.
- Znany pre-existing test-noise (ignoruj przy failures=0): highlight.js tiptap-gate, i18n-mock v8-strip, post-teardown OOM, AuditsHub waitFor (3), InitiativeGantt (3), CreateModelModal (2).

## 4. RECEPTA MIĘDZY-PACZKOWA (po każdej paczce)
Agent-merger (Opus): fetch+race-check (origin ruszył→wmerguj nie nadpisuj) · merge branchy bezkonfliktowych · konflikty=unia semantyczna, feature-splątany→STOP · testy failures=0 (ignoruj noise) · i18n 0 · build 8GB zielony · **push feat; demo-deploy uzgodnij z partnerem-CTO**. Hot-spoty kolizji: translation.json, hubs (AssessmentHub/AdminSettingsModule/DiscoveryToolsHub), promptRegistry.ts → struktura HEAD wygrywa, intencje nakładasz.

---

## 📦 PACZKA 1 — GŁĘBIA + WYKOŃCZENIE ŚCIEŻKI (priorytet wyższy)
*Cel: wpiąć mózg Oxford w UI, domknąć łańcuch Harvard, podnieść wygląd ścieżki klienta.*

| # | Zadanie | Projekt | Model | SSOT/kontekst |
|---|---|---|---|---|
| 1 | **Wpięcie ścieżki dojrzałości N→N+1 w UI** raportów DRD/SIRI/ADMA — serwis z R4 gotowy, niewpięty; assessment z opisu → RECEPTA „co zrobić by przejść wyżej" | OXFORD | Opus (audyt Fable) | O1, serwis maturityPath (R4), DRD_CANON 32 ścieżki |
| 2 | **CONCLUSION_LAYER na outputach WSZYSTKICH 19 tooli** — executive summary z rationale/werdyktem K1-K4 (nie tylko top-5) | OXFORD | Opus | O2.3, CONCLUSION_LAYER_STANDARD |
| 3 | **Golden-path: domknięcie 2 pozostałych przejść + Panel Health probe'y na CAŁĄ ścieżkę** (round-trip dowody utwórz→zapisz→reload) | HARVARD | **FABLE** (cross-module, najtrudniejsze) | H1, healthProbeService, mapa 11 przejść |
| 4 | **Fail-soft sweep domknięcie** — gołe HTTP 500 (ensure*Table DDL bez try/catch) → ErrorState/Retry wszędzie (koniec białych ekranów) | HARVARD | Opus | H6.4, finding settings_500_lazy_ddl |
| 5 | **RBAC bramki ról M03/M04 jawne + M25 fasady** — urealnić albo ukryć ~8 paneli AI/Voice/Memory | HARVARD | Opus | H6.5/H6.9 |
| 6 | **VEGAS Fala 4: z-index sweep + motyw dark app-wide hardening** — dropdowny/modale/menu + reszta jasnych powierzchni→dark tokeny | VEGAS | Opus | Fala 4, RESKIN_AUDIT |
| 7 | **VEGAS Fala 3 reszta: huby poza golden-path** (Admin/Settings, Assessment huby, M13 hub) do anatomii SPEC | VEGAS | Opus | ARTIFACT_ANATOMY §15/§17 |
| 8 | **VEGAS V7: Empty/Loading rollout reszta (~20 ekranów) + sweep ikonografii lucide** | VEGAS | Sonnet+Opus | empty-loading-states, V7.1/2/6 |
| 9 | **O5 Persona Teresy (język konsultanta, nie asystenta) + rejestr promptów** (jedno miejsce, wersjonowanie, właściciel) | OXFORD | Sonnet (audyt Fable) | O5.4/O5.5, persona.ts |
| 10 | **O8 hinty „dlaczego to pytanie" w assessmentach/toolach + słownik pojęć konsultingowych** dla nie-konsultanta | OXFORD | Sonnet | O8.1/O8.3 |

## 📦 PACZKA 2 — SZEROKOŚĆ + HARTOWANIE
*Cel: domknąć niezawodność, rozszerzyć wygląd na resztę apki, ugruntować standardy treści.*

| # | Zadanie | Projekt | Model | SSOT/kontekst |
|---|---|---|---|---|
| 11 | **H3 e2e mechanika tooli/assessmentów** (start→zapis→wznowienie→outputs) z dowodem na wzorcu SWOT/DRD | HARVARD | **FABLE** (najtrudniejsza diagnoza) | H3.1/H3.3 |
| 12 | **H5 wydajność domknięcie** — N+1/timeout ciężkich/skeleton + **strażnik regresji v8-mutacji** (test kanaryjny — 2× wracało) | HARVARD | Opus | H5.3/5.4, findings v8_req_destroyed/baseClient |
| 13 | **H6 M27 SuperAdmin pakiet + eksporty PDF pozostałe** (koniec „PDF=Markdown") | HARVARD | Opus | H6.10/H6.13 |
| 14 | **VEGAS Fala 5: ekrany P3 public/docs/legal** (część z ~50) na tokeny/anatomię | VEGAS | Opus | Fala 5 |
| 15 | **VEGAS Fala 6: tożsamość DOCX + spójny branding plików 3-pak** (utrzymać „dobrze", dorównać deck/sheet) | VEGAS | Opus | Fala 6, WorkbookStyler/DeckStyler |
| 16 | **VEGAS V7.3 e-maile systemowe (szablon marki, wiązki crona) + V7.4 onboarding/first-run** | VEGAS | Opus | V7.3/V7.4 |
| 17 | **VEGAS V7.7 ESLint gate na tokeny (blokada nowego długu) + V7.8 smoke-suite regresji po fali** | VEGAS | Opus | V7.7/V7.8 |
| 18 | **O6 benchmarki finansowe per branża** (zakresy wskaźników zamiast ±15%) + źródła/aktualizacja | OXFORD | Sonnet | O6.2/O6.3 |
| 19 | **O7 jakość języka outputów PL/EN (ton konsultanta) + walidator CARD_CONTENT_FORMULA** w kartach | OXFORD | Sonnet+Opus | O7.1/O7.3 |
| 20 | **O5.6 jakość zestawów pytań Wywiadu** (pytania klasy konsultanta, nie ankieta HR) | OXFORD | Sonnet | O5.6, M10 szablony |

**Podział:** Oxford 7 · Vegas 7 · Harvard 6. Fable prowadzi #3 i #11 (najtrudniejsze cross-module) + audytuje resztę. Opus=koń roboczy. Sonnet=treści (persona/prompty/benchmarki/język/hinty/i18n).

---

## 5. PO PACZKACH — meldunek + higiena kontekstu
- Po każdej paczce: recepta §4 → raport do sekcji A tablicy (co zbudowane, gałęzie+sha, blockery) → uzgodnij batch-deploy z partnerem-CTO.
- Gdy TWÓJ context się zapełni (~15%): dopisz stan tutaj (która paczka, które branche, jakie sha), poproś o świeżego agenta. NIGDY nie urywaj w połowie merge'a.
- ✅ na liście projektu = dopiero po dowodzie + odbiorze Piotra. Ty raportujesz WYKONANIE (🟡), nie przyznajesz ✅.

---

## ★★★ TRYB PRODUKCYJNY INTENSYWNY (2026-07-03, polecenie Piotra: „ostra taśma, tokeny na 100%, dowieźć ile się da")
Cel: maksymalny przerób aplikacji dziś. 4 paczki × 10 = **40 zadań**. Priorytet: Paczka 1 → 2 → 3 → 4. Vegas dostaje najwięcej (największa powierzchnia apki).

### 🛡️ PROTOKÓŁ ODPORNOŚCI NA SIEĆ (twardy — sieć zabija agentów, nie trać pracy)
- Sub-agenci: **KRÓTKI zakres + COMMIT po każdym logicznym kroku** (jeden plik/jedna zmiana = commit). Śmierć na sieci traci wtedy ≤1 krok, nie całą pracę.
- Sub-agent zginął → jego gałąź ma commity → **re-dispatch dokończenia** (nie od zera).
- Batche **6-8 agentów równolegle**, nie 40 naraz.
- **STAN WYKONANIA (log niżej)** aktualizuj po KAŻDYM zamkniętym zadaniu (task→status→gałąź→sha). Świeży orkiestrator (jeśli TY zginiesz) wznawia z tego logu — NIGDY od zera.
- Deploy demo **koordynuj z partnerem-CTO** (3 równoległe strumienie + ten = git-race).

### 📦 PACZKA 3 — VEGAS SZEROKOŚĆ (najwięcej powierzchni apki)
| # | Zadanie | Projekt | Model | SSOT |
|---|---|---|---|---|
| 21 | Fala 5: ekrany public/marketing/landing → tokeny c.*/anatomia (batch ~15) | VEGAS | Opus | Fala 5, ARTIFACT_ANATOMY |
| 22 | Fala 5: docs/help/legal → tokeny/anatomia (batch ~15) | VEGAS | Opus/Sonnet | Fala 5 |
| 23 | Fala 3: Finance hub (M16) instrumenty+wykresy do standardu | VEGAS | Opus | ANATOMY §15/17 |
| 24 | Fala 3: Results hub (M15) instrumenty+panele KPI do standardu | VEGAS | Opus | ANATOMY |
| 25 | Fala 3: Notatnik/Notes ekrany do anatomii | VEGAS | Opus | ANATOMY |
| 26 | Fala 3: Wywiad (M10) ekrany do anatomii | VEGAS | Opus | ANATOMY |
| 27 | Fala 4: modale/dropdowny/overlay z-index + focus states sweep | VEGAS | Opus | Fala 4 |
| 28 | Fala 4: formularze/inputy/tabele spójność sweep | VEGAS | Opus | Fala 4 |
| 29 | M01 Chat pełny SPEC-K (ramka/composer/załączniki, nie tylko bąble) | VEGAS | Opus | ANATOMY §16 SPEC-K |
| 30 | Centrum powiadomień + toast + banery do marki | VEGAS | Opus | ANATOMY |

### 📦 PACZKA 4 — OXFORD GŁĘBIA + HARVARD HARTOWANIE
| # | Zadanie | Projekt | Model | SSOT |
|---|---|---|---|---|
| 31 | SIRI: ścieżka N→N+1 + raport do klasy wnioskowej | OXFORD | Opus | O1, CONCLUSION_LAYER |
| 32 | ADMA: ścieżka N→N+1 + raport do klasy wnioskowej | OXFORD | Opus | O1 |
| 33 | DRD radar/mapa (P0 wizualny diagnostyk) — jeśli jeszcze nie zrobione | OXFORD | Opus (audyt Fable) | O1 Mapa/radar |
| 34 | Jakość outputów WSZYSTKICH 19 tooli — każdy wniosek do bramki HBS (audyt+podniesienie) | OXFORD | **FABLE** | CONCLUSION_LAYER, miara HBS |
| 35 | i18n M18/M20/M02 residuum isPolish→t() | HARVARD | Sonnet | i18n gate |
| 36 | Wyszukiwanie globalne — weryfikacja stanu + zakres v1 + impl | HARVARD | Opus | H6.12 |
| 37 | Spójność powiadomień (dedup, szablony) | HARVARD | Opus | H6.3 |
| 38 | Higiena CI/testów (umiejscowienie tests/, martwe testy, pokrycie) | HARVARD | Opus | H6.6, findings CI |
| 39 | M16 finanse V8 reszta + valuations polish | HARVARD | Opus | D-E, M16 |
| 40 | Dostępność golden-path (klawiatura/aria/kontrast) | HARVARD | Opus | a11y |

**Podział produkcyjny (40):** Vegas 17 · Oxford 11 · Harvard 12. Fable prowadzi #3/#11/#34 + audytuje ciągle.

### 📊 STAN WYKONANIA (log orkiestratora — aktualizuj po każdym zadaniu; to jest punkt wznowienia)
- **Baza:** feat/deliverables-w1 · demo LIVE. Atelier zaseedowany (login antoine.laurent+atelier@demo.ateliertoys.com). 3 strumienie równoległe (Atelier/wejście/Slack) — NIE dotykaj ich plików.
- (orkiestrator dopisuje: task # → status → gałąź → sha)

**LIVE STATE 2026-07-03 (partner-CTO backstop):**
- ✅ **#5** RBAC M03/M04+M25 — DONE, gałąź `worktree-agent-a6bd6b1577d51c96d` @ `1e218e8737` (do merge).
- 🟡 **PACZKA 1 batch dispatched** (8 agentów, worktree, commit-per-step): #1 a0339b1675ea2b5e3 (N→N+1 UI) · #2 a73817b58986fa8d5 (CONCLUSION_LAYER 19 tooli) · #3 a1641f920a3a78b9b (golden-path FABLE) · #4 aec22d77960917d36 (fail-soft 500) · #6 aee492d5b7f205aa2 (z-index/dark) · #7 a980e78f4ed2a54ad (huby off-path) · #9 ab3a37ea8195b3edc (persona Teresy) · #10 abe7a165d07c57c5c (hinty+słownik).
- 🟡 **PACZKA 3 (partner-CTO prowadzi)** (4 agenty Vegas-szerokość): #21 aeb4565cd12146896 (public/landing) · #22 ab2749617df1beb75 (docs/help/legal) · #23 aadcab262537582fd (Finance hub) · #24 ae7dff8340535d5e6 (Results hub).
- ⏸️ **#8** empty/loading rollout — WSTRZYMANE (kolizja z Paczką 3).
- ⚠️ Orkiestrator produkcyjny `a7a60b7d11aed443c` ZATRZYMAŁ się po dispatchu batcha → wymaga wskrzeszenia do merge'a Paczki 1 + dispatchu Paczki 2, ALBO partner-CTO merge'uje.
- Reszta paczek 2/4 + #8 = do zrobienia po batchu 1.

**ZBANKOWANE GAŁĘZIE (gotowe do merge zbiorczego — rozłączne pliki poza uwagą):**
- #5 `a6bd6b1577d51c96d` @ `1e218e8737` — RBAC my-work + M25 verify
- #9 `ab3a37ea8195b3edc` @ `e822ef9e52` — persona.ts + promptRegistry.ts
- #2 `a73817b58986fa8d5` @ `6712546ad8` — swot/conclusionPrompts (19/19)
- #7 `a980e78f4ed2a54ad` @ `aa82bafc57` — Initiatives/Assessment/Discovery huby
- #6 `aee492d5b7f205aa2` @ `925473107f` — z-index skala + overlaye · ⚠️ dotyka `tailwind.config.js` (merge-watch, portował tokeny z siostry)
- #23 `aadcab262537582fd` @ `868e8a63ff` — Economics/finance charts + NOWY financeChartTokens.ts
**JESZCZE W TOKU:** #1 `a0339b1675ea2b5e3` · #3 `a1641f920a3a78b9b` · #4 `aec22d77960917d36` · #10 `abe7a165d07c57c5c` (Paczka 1) · #21 `aeb4565cd12146896` · #22 `ab2749617df1beb75` · #24 `ae7dff8340535d5e6` (Paczka 3).
**MERGE-NOTA:** worktree bazują czasem na STAREJ bazie (a2b8b8b0/1067-behind) → agenci sami mergowali feat; przy integracji weryfikuj tsc/build w GŁÓWNYM drzewie (worktree node_modules niepełne).

**★ BATCH KOMPLET 2026-07-03 — 13 GAŁĘZI DO MERGE (Paczka 1 9/9 + Paczka 3 4/4):**
P1: #1 `a0339b1675ea2b5e3`@`2cd2ca3c03` (N→N+1 UI) · #2 `a73817b58986fa8d5`@`6712546ad8` (SWOT conclusion 19/19) · #3 `a1641f920a3a78b9b`@`5cc9baedb9` (golden-path fix#5 + 5 probe'ów) · #4 `aec22d77960917d36`@`9ea5cc57c8` (fail-soft) · #5 `a6bd6b1577d51c96d`@`1e218e8737` (RBAC) · #6 `aee492d5b7f205aa2`@`925473107f` (z-index ⚠tailwind.config.js) · #7 `a980e78f4ed2a54ad`@`aa82bafc57` (huby) · #9 `ab3a37ea8195b3edc`@`e822ef9e52` (persona+registry) · #10 `abe7a165d07c57c5c`@`d167a11805` (hinty+słownik +6 i18n).
P3: #21 `aeb4565cd12146896`@`dc66a3c31` (landing 23p) · #22 `ab2749617df1beb75`@`2c00bd0` (docs/legal) · #23 `aadcab262537582fd`@`868e8a63ff` (Finance charts) · #24 `ae7dff8340535d5e6`@`d8fc94cd5c` (Results M15).
MERGE w izolowanym worktree z bazy origin/demo (czysta), symlink node_modules; NIE deploy demo (partner-CTO koordynuje); pre-existing server tsc ~112 tolerowane (--noCheck); nie tykać plików 3 strumieni; tangle→STOP+raport.
POZOSTAJE: #8 (empty/loading) + Paczka 2 (11-20) + Paczka 4 (31-40) — do dispatchu po merge P1/P3.

## ★★★ HANDOFF DLA ŚWIEŻEGO PARTNERA-CTO (v2, 2026-07-03 popołudnie — poprzedni partner wyczerpał kontekst PO deployu P6)
> Świeży partnerze: (1) `_KONSTYTUCJA_PARTNERSKA.md` = Twoja rola/wartości. (2) Ta sekcja = stan. (3) `_ROZWOJ_PO_AUDYCIE_2026-07-03.md` = mapa wniosków audytu Piotra → działania → dokończenie per filar (TO JEST TWÓJ PLAN PRACY). (4) Sekcja C `_KOORDYNACJA_CLAUDE_PIOTR.md` wpisy [2026-07-03] = pełne detale audytu (kody UI-*).

**STAN LIVE: demo = `215ea8a871`** (Railway; health: `curl -A "Mozilla/5.0" https://demo.consultify.ai/api/health`). `origin/feat/deliverables-w1` = `215ea8a871` = baza kolejnych fal. **28+ zadań wdrożonych dziś w 4 falach:**
- **P1+P3 (12)** @ `9108fcf0dd`: N→N+1 w raportach DRD/SIRI/ADMA · CONCLUSION 19/19 tooli · golden-path fix+20 probe'ów · RBAC gap · fail-soft · z-index skala · persona Teresy+rejestr promptów · słownik+hinty · landing 23p · docs/legal 11 ekranów · Finance/Results wykresy na tokenach.
- **P5 (10)** @ `628caf94ab`: **Conclusions e2e** (Fable: createConclusion+bridge 19 tooli+DRD/SIRI/ADMA, fail-safe) · **global search+Cmd+K ożywiony** (był nigdy-nie-zamontowany) · DOCX premium (**Fala 6=3/3**) · notification dedup · ~36 ekranów stanów · 53 views na tokenach · e-maile→brand (FINDING: .hbs=martwe assety) · i18n 615 ternariów · odzysk #24 (8 leaków).
- **P6 hotfix po audycie Piotra (Sesja 3, 25×🔴)** @ `215ea8a871`: TOP-3 (generator bez placeholderów `slidePlanningEngine` · promowany dokument→realny cel `originRuntime` · Execution=kod OK/dane śmieciowe) · **64 śmieci-rekordy skasowane** (backup `docs/qa/runs/2026-07-03-paczka6-garbage/`, Atelier nietknięte) · D2 sidebar split · D3 Audits closed · toggle-fix (FORCE_DEMO_OFF usunięty).

**ATELIER (pokaz klienta 16:00):** Piotr = **OWNER org `atelier` na demo** (insert members `fcdc6587…`, org-switch działa; po deployu `215ea8a871` działa też toggle „Open Sample Workspace"). Zapas: `antoine.laurent+atelier@demo.ateliertoys.com`/`AtelierToys2026!` (ADMIN). Dataset: 33 inicjatywy/80 tasków/8 projektów/30 Ideas. **RÓWNOLEGLE: osobny agent Piotra robi GŁĘBOKI seed Atelier na jego koncie** — nie koliduj z `atelierToysDemoTemplate.ts`/`demoSeedService.ts`/seed-skryptami.

**DECYZJE PIOTRA DZIŚ:** 🟦 **Q1: Inicjatywy = JEDYNE źródło statusów; Execution nie dubluje portfela** (Summary-tab Execution do usunięcia/przekierowania — scoped follow-up, hub 5379 linii). 🟦 D2/D3 wykonane.

**CZEKA NA PIOTRA:** 55 DRAFT-duplikatów w DBR77 (filtr is_draft vs kasacja) · UI-A1 (tryb „Survey" w DRD — czy to ta ankieta?) · PROD-seed Atelier (`ateliertoys-demo`, ścieżka gotowa, jawne „tak") · light-mode · D-G.

**TWOJE NASTĘPNE RUCHY (z `_ROZWOJ_PO_AUDYCIE` §C):**
1. Po pokazie: sesja odbiorowa #4 wg „🔍 CO ODEBRAĆ" wyżej — konwersja 🟡→✅.
2. Fala nocna: **P7** (§A3: matematyka portfela UI-T11 · Preview kanon · UI-T drobne) + **zaległe Paczki 2 (11-20) i 4 (31-40)** z tego playbooka (NIGDY nie zbudowane — orkiestratorzy stawali po recon; recon-raporty są w transkryptach, ale listy zadań wystarczą) + **#66 follow-upy** (FilterableTable MA prop `selection` — gap to wiring per-adopter) + **remont wejścia Grupa 0** (P0: WS-leak pisze na realny org! `ATELIER_ENTRY_RENOVATION_BRIEF.md`; presenter-WIP backup w scratchpad `presenter-wip-backup/`).
3. Granica sprintu: liczniki `_PROJEKT_{A,B,C}` (✅ tylko z dowodem+odbiorem).

**REGUŁY NAUCZONE (krwią):**
- Orkiestratorzy-agenci STAJĄ po dispatchu/recon (koniec tury) → relaunch/kontynuuj sam; sub-agenci z konkretnym zadaniem DOWOŻĄ.
- Sieć niestabilna: commit-per-krok (pad=strata ≤1) · backup WIP do scratchpada · dispatch w izolowanych worktree (`isolation: worktree` — bez tego bałaganią główne drzewo).
- Worktree bywają na STAREJ bazie (1067 behind) → każ agentom `git fetch` + bazować na origin/feat; nietypowe nazwy gałęzi agentów notuj w banku.
- Merge: cherry-pick > pipe-apply; translation.json/Gateway/MainLayout = hot-spoty unii; weryfikuj build w drzewie z pełnym node_modules (symlink na czas, usuń po).
- Deploy demo TYLKO skoordynowany (fetch+merge-base race-check → push integration:demo + :feat). PROD centerbeam NIETYKALNY. `.env.local` = PROD! Demo DB = Railway env demo, proxy trolley.
- Piotr chce meldunków zwięzłych, po polsku, z tabelą i modelem; „walcz ostro" = maksymalna równoległość, ale ekonomika modeli (Fable=najtrudniejsze+audyt · Opus=trudne · Sonnet=proste).

## 📦 PACZKA 5 — „WYPASIONA" (2026-07-03, 10 dużych zadań, dispatch partner-CTO; cele z recon 5 raportów)
Baza: origin/feat/deliverables-w1 @ `9108fcf0dd`. Modele: FABLE=najtrudniejsze · OPUS=średnie · SONNET=proste.
| # | Zadanie | Model | Cel z recon |
|---|---|---|---|
| 41 | **CONCLUSION_LAYER e2e wiring:** 19 tooli → `ConclusionService.createConclusion()` (dziś stub; infra gotowa: conclusions.routes, Readout) | **FABLE** | mózg, cross-module |
| 42 | **Global search:** zweryfikuj realny stan (gap-reports overstate!) → zakres v1 → implementacja (H6.12) | Opus | recon: NOT FOUND |
| 43 | **DocxStyler premium parity** — najsłabszy z 3-paku: PALETTE const + overflow guards jak Deck/Workbook (Fala 6 → 3/3) | Opus | documentDocxStyles.ts |
| 44 | **Notification dedup/idempotency-key** przed multi-channel send (H6.3; recon: brak dedup = ryzyko dubli) | Opus | notificationService.ts |
| 45 | **Empty/Loading rollout batch A:** huby+workspaces z listy recon (MyWorkHub, InterviewHub×2, ExecutionHub, FinanceHub, EconomicsHub, DecisionsHub, PresentationsHub, ReportsHub, FullStep1-6, FullROI, FullPilot, ToolWorkspace, InterviewWorkspace — TYLKO src/components/**) | Opus | lista w recon #8 |
| 46 | **Empty/Loading rollout batch B:** assessment (8 workspaces) + Benefits (4) + admin/superadmin huby + ModuleHub + NotificationsHub + IdeaMapWorkspace + Megatrend/PeopleChange (TYLKO src/components/**, rozłączne z batch A) | Opus | jw. |
| 47 | **Fala 5 hardcoded colors sweep:** TYLKO `src/views/**` (~50 plików z recon) + statusColors.ts + pdfExport/notebookExport → tokeny | Opus | recon Vegas |
| 48 | **#24 rebase:** wyodrębnij realne panele KPI z `worktree-agent-ae7dff8340535d5e6` na świeżej bazie; OperationalAnalysisView ZOSTAJE stubem | Opus | merger-raport |
| 49 | **E-maile systemowe:** 8 szablonów billing .hbs → brand (crimson/navy, nie #4f46e5) + spójny layout (V7.3) | Sonnet | templates/emails/billing |
| 50 | **i18n isPolish→t():** silniki config (ansoff/dms/smed index+validators) + notificationContent.ts (147) + DecisionDetailView top-residuum; gate 0 | Sonnet | recon i18n top-list |

### 📊 PACZKA 5 — BANK GAŁĘZI (aktualizowane na bieżąco)
- ✅ #49 `a92485a50cb0d879d` @ `21708c14b9` — 9 szablonów e-mail → brand. FINDING: .hbs = martwe assety (nikt nie renderuje; wpięcie do emailService = task backlogu).
- ✅ #44 gałąź **`task44-dedup-idempotency`** @ `c2c3bcf1f2` (⚠ inna nazwa niż worktree-agent) — dedup sha256+TTL fail-open, 8/8 testów.
- ✅ #48 gałąź **`rebase/results-m15-token-salvage`** @ `00cf315241` (⚠ inna nazwa) — netto 2 pliki/8 swap (KPITimeSeriesDrawer target-line + KpiQueueView chipy → c-info); reszta #24 słusznie odrzucona.
- ✅ #43 gałąź **`feat/docx-styler-parity`** @ `5430d6fb4e` (⚠ inna nazwa) — Fala 6 = 3/3 (DOCX_PALETTE navy+teal, overflow-guardy, 873/873 testów, próbka docs/qa/deliverables/runs/docx-styler-parity-2026-07-03/).
- ✅ #47 **⚠⚠ na LOKALNEJ `feat/deliverables-w1` w GŁÓWNYM checkoutcie** @ `3e9f9c931b` (53 commity, 53 pliki views+statusColors+pdfExport/notebookExport; przodek 9108fcf0dd). ZAKAZ reset na lokalnym feat! Merger: te commity bierz z lokalnego feat, nie z worktree-brancha.
- ✅ #45 `worktree-agent-ab7d4e02796310de1` @ `748cecace7` — 21 ekranów stanów/11 plików na kanon shared/states (i18n 0, tsc 0).
- ✅ #42 gałąź **`feat/global-search-h612`** @ `d940f93480` (⚠ inna nazwa) — GET /api/search 7 encji + CommandPalette OŻYWIONY (był nigdy-nie-zamontowany!) app-wide w MainLayout; 14/14. ⚠ merge-watch: MainLayout.tsx (dotykany też przez z-index #6 — już w bazie, agent bazował na 9108fcf0dd, OK).
- ✅ #41 (FABLE) `worktree-agent-a8f01198408449a32` @ `3095327768` — createConclusion + toolConclusionBridge (1 generyczny, 19 tooli) + DRD/SIRI/ADMA push, fail-safe; 20/20+66/66. NOTKA: SIRI/ADMA szablony wciąż niezamontowane w widoku (most gotowy, aktywuje się z renderem). UWAGA: cudzy stash zachowany w stash@{0} głównego drzewa.
- ✅ #46 `worktree-agent-ab7b0099c0749ce2d` @ `d3140aa1e1` — 16 commitów, 15 plików (assessment/Benefits/admin) na kanon stanów; i18n 0.
- ✅ #50 gałąź **`i18n-h62-residuum`** @ `83f73f9e1d` — notificationContent 147/147 (helpers przyjmują TFunction, 2 callers zaktualizowane) + DecisionDetailView 468/470; 4 silniki config uczciwie zostawione (wzorzec bilingual SSOT rodziny modułów).
**★ PACZKA 5 = 10/10 KOMPLET.** Merger dispatch: patrz lista gałęzi wyżej. Hot-spoty: translation.json (#42/#45/#46/#50 — unia), MainLayout (#42), #47 NA LOKALNYM feat @ 3e9f9c931b.

## 🚨 PACZKA 6 — HOTFIX PO SESJI 3 (dispatch 2026-07-03, źródło: RAPORT ZAMYKAJĄCY sekcja C tablicy, 25×🔴)
| # | Zadanie | Źródło |
|---|---|---|
| 61 | Kasacja/ukrycie śmieci-danych demo (THROWAWAY/E2E/DELETE, duplikaty ×3, DRAFT 130/148) — **P0, naprawia 5+ modułów naraz** | root-cause raportu |
| 62 | UI-M4/M6: generator treści — fallback `Key message for ${title}` (slidePlanningEngineService.ts:161) + tabela 1-wiersz zamiast 8 | TOP-3 #2 |
| 63 | UI-M5: promowany dokument → pusty Report Builder (AssessmentWorkbenchService.ts:961 originRecordId=assessmentId → fix originRuntime) | TOP-3 #3 |
| 64 | UI-E1: Execution — audyt czy realnie zero funkcjonalności vs dane-only; werdykt+fix minimalny | TOP-3 #1 |
| 65 | DECYZJA-D2: sidebar Tools/Assessment na 2 pozycje + deploy D3 (Audits closed — fix lokalny w betaAccess.ts czeka) | decyzje Piotra |
| 66 | 4 systemowe naprawy komponentów współdzielonych: (a) checkbox+bulk w tabelach (b) pill-ramki 2. paska (c) Preview spójny (d) style przycisków | wzorzec „4>>20" |
Status: dispatch → orkiestrator hotfix. **🟦 Q1 ROZSTRZYGNIĘTE (Piotr 2026-07-03): Inicjatywy = jedyne źródło statusów; Execution nie dubluje portfela (warstwa wykonawcza: taski/rollout/timeline). Przekazane do #64.** Otwarte follow-up: UI-A1 (tryb Survey w DRD).
- ✅ **P5 ZDEPLOYOWANA: demo = `628caf94ab`** (integration/paczka5, 10/10, FF-clean; origin/feat zsynchronizowany).
- ✅ **PILNE: Piotr = OWNER org atelier na demo DB** (insert organization_members `fcdc6587-…5f51`, zweryfikowane live przez API; org-switch działa od razu). Fix toggle FORCE_DEMO_OFF: gałąź `worktree-agent-a8fbe9859e63daa6c` @ `2229e1ef18` (tylko AppRoutes.tsx, −15 linii) — **dołączyć do merge P6** (nieznana baza gałęzi → cherry-pick tego 1 commita na aktualny feat).

### 🔍 CO ODEBRAĆ (dla agenta odbiorowego Piotra — stan po deploy `9108fcf0dd`)
1. **Atelier:** login antoine.laurent+atelier@demo.ateliertoys.com / AtelierToys2026! → 33 inicjatywy, 8 projektów; klik po inicjatywach (charter/taski/decyzje pełne?).
2. **Raport DRD:** sekcja „Ścieżka dojrzałości N→N+1" (karty co-zrobić-by-przejść-wyżej) + hinty ⓘ przy pytaniach + przycisk Słownik.
3. **Toole:** dowolny z 19 → output ma werdykt/wniosek (CONCLUSION_LAYER), nie samą listę.
4. **Landing/docs/legal:** spójny motyw, zero czerwonych bąbli/crimson poza brandem.
5. **Finance/Results:** wykresy czytelne, serie NIE-czerwone, panele KPI nie rozjeżdżają się.
6. **Golden-path:** Ideas→konwersja na inicjatywę (back-ref źródła widoczny) · Panel Health (Admin) → Re-run 20 probe'ów zielone.
