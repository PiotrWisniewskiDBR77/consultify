---
doc_id: architektura-modul-17
status: canonical
owner: piotr
truth_type: architecture
established: 2026-08-31
---

# MODUŁ 17 — ARCHITEKTURA AGENTA I TERESY (do akceptu właściciela, wg DEC-23)

Synteza nadzorcy z 4 map rekonesansu (A rdzeń czatu · B plany agenta · C koordynacja
· D wymagania), 31.08.2026. Każde twierdzenie zmierzone plik:linia w mapach
(transkrypty w kartach sesji); tu — obraz i decyzje.

## 1. TEZA GŁÓWNA

**Nie trzeba budować agenta. Trzeba go SPIĄĆ.** Wizja z 104_RAW (conversation →
context → artifact → decision → task → execution → report) ma w kodzie ~85%
ogniw zbudowanych i utwardzonych (w tym cały cykl planów z oknami anulowania,
limitami i cennikiem — dyżury 164-180). Łańcuch jest przerwany w PIĘCIU
policzalnych miejscach i zdublowany w trzech. Moduł 17 to dyżury spinające
+ włączenia po odbiorach — nie nowa cywilizacja.

## 2. STAN ZASTANY — co DZIAŁA (zmierzone, nie deklarowane)

- **Rdzeń czatu**: strażnik poufności E1-E3 fail-closed w 3 punktach; teksty
  projektu w promptcie (rejestr był przeterminowany — DZIAŁA z kwarantanną);
  wybór modelu DB-first + circuit breaker na każdym wywołaniu.
- **Tworzenie z czatu (ocena A)**: zadania, decyzje, mapy myśli, tabele,
  whiteboardy, notatki — przez narzędzia z bramką zgody.
- **Governed handoff dokumentów**: propozycja→zgoda→lease→materializacja,
  transakcyjnie, idempotentnie — świeżo domknięte E2E (dyżur 195, plik przeszedł QA).
- **Plany agenta**: classic-5 (Kubr/ILO — 1:1 z wizją) i drd w ProcessLibrary;
  canvas z draft→run→approve; 4 okna anulowania zamknięte; limity z wyczerpującym
  cennikiem 20 narzędzi i politykami per (org,projekt); 19/31 manifestów built.
- **Zmysły**: sygnały deterministyczne ON (D-2), feed w czacie z akcją Open;
  interpreter AI **kompletny od crona po kartę z provenance** — czeka na flagę
  (dokładnie wg Twojej DEC-89: „zbudowany, za flagą OFF do akceptu").

## 3. PIĘĆ PRZERWANYCH OGNIW (sedno modułu 17)

| # | Ogniwo | Stan | Ruch |
|---|---|---|---|
| P1 | **Model nie ma pętli narzędziowej w czacie** — 19 narzędzi osiągalne tylko przez powierzchnię Wave-8; czat używa ręcznych regexów intencji | zerwane | tool-loop w /chat/stream: READ bez zgody, WRITE wyłącznie jako governed proposal (wzorzec już istnieje); wykonanie 17-B: §10 |
| P2 | **Zapisy czatu = trzecia droga poza kanonem** — create_task/decision robi surowy INSERT do legacy, omijając bramę 409 i ie_aggregate_state | groźne (D-7!) | przełączyć na kanoniczne polecenia (po 197-E2) albo przejściowo na governed proposal→trasy modułów; surowe INSERT-y wygasić |
| P3 | **Dokument z czatu martwy** — ENABLE_DELIVERABLES_LIGHT=false, a silnik pod spodem to TEN SAM co Materiały (właśnie naprawiony) | flaga | odbiór ścieżki czatowej → ON |
| P4 | **Inicjatywa z czatu = sierota** — draft bez wołania registerInitiative→handoff→execution_case | zerwane | opcjonalny krok „przekaż do realizacji" za zgodą (łańcuch z planu migracji A4.0); wykonanie 17-D: [Day214](../waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY214_ADOPT_DRAFT_REPORT.md) |
| P5 | **15/17 akcji czatu to widma** — handler je zna, nic ich nie produkuje (w tym GENERATE_REPORT); +2 stuby narzędzi (generate_report_section, schedule_meeting); +trzeci dispatcher bez importerów; +update_assessment_score poza filtrem | martwy kod udający funkcje | jedna decyzja: dobudować producentów (SmartSuggestions→akcje) dla 4-5 wartościowych, RESZTĘ USUNĄĆ; stuby podpiąć do realnych silników (report→document-studio; meeting→moduł otwarty D-1) |

Plus dwa dublety do zgaszenia: martwy `server/src/ai/aiContextBuilder.ts` (0 importerów)
i podwójny system uprawnień AI (pipeline nie konsultuje aiRoleGuard — jedna macierz).

## 4. DWA ŚWIATY AGENTOWE — werdykt

Planner (klient) i V8 wave8/adapter (silnik case-workspace za ENABLE_V8_GLOBAL)
to NIE duplikaty: V8 ma realnych konsumentów (transformation-cases pipeline)
i jeden zdrowy punkt styku (canonicalRunId → wspólny reżim rezerwacji).
**Decyzja architektoniczna: zostają OBA** — planner jako twarz, V8 jako silnik
spraw; spinamy przez canonicalRunId (dziś NULL dla planów z czatu — plan
tworzony w kontekście projektu ma dostawać powiązanie ze sprawą).

## 5. PUŁAPKA WDROŻENIOWA (checklist stagingu)

`DISABLE_SCHEDULER=true` siedzi na stałe w configach dev/staging-local →
**harmonogram i auto-wznowienia wait_until nie działają w tych configach**.
Na usłudze staging Railway zmienna NIE może być ustawiona + `ENABLE_AI_TASKS_WORKER=true`
(D-9) + realny Redis. To 3 pozycje checklisty K5, nie kod.

## 6. TEST AKCEPTACYJNY — GF-AGT-02 NA ŻYWO (pierwszy w historii)

Jeden scenariusz, kanoniczny runtime, Piotr klika WYŁĄCZNIE zgody w UI:
1. Brief w czacie → kontekst z Vault/tekstów projektu (strażnik widoczny w logu);
2. Plan classic-5 z procesu → canvas → „Uruchom";
3. Diagnoza: get_assessment_data + search_knowledge_base (kroki auto);
4. Rekomendacje: calculate_financial POD BRAMKĄ zgody (klik Piotra);
5. Inicjatywa → **handoff do sprawy** (P4 zszyte) → zadania przez KANON (P2 zszyte);
6. Dokument raportu przez governed handoff (ścieżka 195) → plik z QA-gate;
7. Anulowanie drugiego planu w trakcie kroku (dowód okien) + odmowa limitu
   kosztu widoczna w UI.
Bramki: każdy krok = wpis dowodowy; zero surowych INSERT; zero qaOverride.
**Dopiero PASS tego scenariusza = akcept modułu 17.**

Wykonanie techniczne łańcucha GF-AGT-02: patrz §12 (Day217); wynik jest częściowy, ponieważ realna druga rozmowa zatrzymała się na bramce profilu przed wywołaniem modelu.

## 7. PLAN DYŻURÓW MODUŁU 17 (po Twoim akcepcie TEGO dokumentu)

17-A spięcie zapisów z kanonem (P2, zależne od 197-E1) · 17-B tool-loop READ
(P1a) · 17-C tool-loop WRITE-as-proposal + zgaszenie widm (P1b+P5) · 17-D
inicjatywa→handoff (P4) · 17-E deliverables-light odbiór+ON (P3) · 17-F
uprawnienia jedną macierzą + sprzątnięcie dubletów · 17-G interpreter sygnałów
odbiór na zrzutach → ON (DEC-89) · 17-H GF-AGT-02 live (test §6).
Szacunek: **8-10 dyżurów** + 2 sesje Twoich zgód.

## 8. DECYZJE WŁAŚCICIELA (blokują start 17-A..H)

1. Akcept tej architektury (albo korekty).
2. P5: które z 15 widm dobudować (proponuję 4: GENERATE_REPORT,
   GENERATE_PRESENTATION, USE_TEMPLATE, RECORD_KPI), reszta do usunięcia?
3. Kolejność włączeń flag po odbiorach: deliverables-light → teresa-retrieval →
   interpreter → korpus organizacji (proponowana).
4. Czy GF-AGT-02 wykonujemy na stagingu (po K5) czy na lokalnym kanonicznym runtime?

## 9. MĄDROŚĆ ORGANIZACJI — pętla „praca → wiedza → kontekst" (rekonesans 31.08)

**Werdykt uczciwy: rdzeń pętli jest PRAWDĄ, nie mitem** — `organization_context_claims`
z 9 realnymi pisarzami (wywiady, sesje narzędzi, idee My Work, czat, załączniki,
profil org) + `orgContextRebuildJob` co 4h + `buildResolvedContext()` (30+ wołaczy)
wpięty wprost w prompt Teresy. System NAPRAWDĘ odżywia się codzienną pracą,
automatycznie. To jest przewaga, o której mówi właściciel — i ona istnieje.

**ALE trzy dziury, z których jedna boli najbardziej:**
- ★★ **Moduł 01 (CLOSED_FINAL!) pisze do MARTWEJ tabeli.** 5 ekranów Celów/Wyzwań/
  Ryzyk/Zakresu/Przyczyn zapisuje do `organization_context_store` — tabeli o myląco
  podobnej nazwie, której NIKT nie czyta poza jej własnym GET-em. Wiedza, którą
  właściciel osobiście akceptował jako serce kontekstu, nigdy nie dociera do Teresy.
  Naprawa NIE otwiera modułu (zapis-obok przez istniejący claim-writer, zero zmian ekranu).
- **Wiedza-sieroca:** dokumenty ze Studio, raporty ~20 generatorów, decki — generowane
  i GUBIONE (zero indeksacji do KB). Pamięć decyzji ma czytelnika bez pisarza
  (`recordDecision` — zero wołaczy → `find_similar_decisions` zawsze puste).
  Zamknięcia sygnałów bez śladu wiedzy. Crosswalk KPI/backfill 159 — nadal zero wołaczy.
- Martwy `AIMemoryManager` (~900 linii, 8/9 metod bez wołacza) obok żywego
  `aiMemoryService` — dublet do zgaszenia.

**TOP-5 najtańszych spięć (wchodzą do planu jako 17-I):** (1) moduł 01 → claim-writer
obok store (1 wywołanie w save-handlerze); (2) zamknięcie sygnału → recordManualAIContext
(2 endpointy); (3) recordDecision przy rekomendacji (1 linia obok istniejącego
czytelnika); (4) zdjęcie blokady migracji 946 po weryfikacji (kod obu stron istnieje);
(5) indeksacja artefaktów Studio/raportów do KB (jeden hook w materializacji —
większy, ale domyka „raport dzisiejszy = wiedza jutrzejsza").

**Plan §7 rozszerzony:** `17-I` pętla mądrości (spięcia 1-4) · `17-J` indeksacja
artefaktów (spięcie 5) — razem z 17-A..H daje 10-12 dyżurów modułu 17.
## 10. Wykonanie — 17-B (Day206)

Pomiar na markerze `c50847c259` skorygował P1: wielokrokowa pętla model-driven już istniała
w `callStream`, ale widziała wyłącznie narzędzia tworzące z MCP. Definicje 19 `AI_TOOLS`
nie miały żadnego wołacza modelowego. Day206 dodał, za domyślnie wyłączoną flagą
`ENABLE_TERESA_TOOL_LOOP`, osobną rodzinę 11 narzędzi READ (`AI_TOOLS` minus osiem
`SIDE_EFFECT_TOOLS`) z dyspozytorem `executeToolCall`, limitem iteracji, timeoutem,
egzekwowanym licznikiem kosztu oraz sanitarnym SSE `tool_step` renderowanym w czacie.

Kolizja `search_knowledge_base` została rozstrzygnięta świadomie: w rodzinie READ pierwszeństwo
ma implementacja `toolDefinitions.ts`, ponieważ zawiera mierzoną bramkę retrieval i izolację
sejfu; implementacja MCP pozostaje bez zmian dla dotychczasowych konsumentów. WRITE nie weszło
do pętli i pozostaje zakresem 17-C. Na etapie pierwszego commitu dowody R2 real-Postgres oraz
R3 z realnym modelem pozostawały otwarte; aktualny stan i dowody są w raporcie Day206.

## 11. Wykonanie — 17-D (Day214)

Day214 dodał za domyślnie wyłączoną flagą `ENABLE_TERESA_ADOPT_CHAT_DRAFT` bezpośredni
most `initiative.adopt-chat-draft` z klasycznego draftu `source_type='teresa_chat'` do
kanonicznego `REGISTERED_DRAFT`. Most reużywa identyfikator istniejącej inicjatywy,
wymaga projektu, właściciela i treści problemu, zapisuje osobny append-only paragon oraz
nie wykonuje żadnego dalszego kroku governance.

Przy fladze OFF dotychczasowa nawigacja z czatu pozostaje bez zmian. Przy ON wiadomość
czatu dostaje kartę `idle → checking → blocked|ready → adopting → adopted|failed`;
adopcja wymaga osobnego kliknięcia, a stan `blocked` prowadzi do istniejącego dokumentu
inicjatywy. Realny `ApiGateway`, podpisany JWT i lokalny PostgreSQL potwierdziły blokadę
bez mutacji, pojedynczy paragon, kanoniczny readback i readiness ośmiu kart. Ograniczenie:
równoległy replay tego samego `clientRequestId` nadal wpada w konflikt wspólnego silnika
material commands; szczegóły i czerwony dowód są w raporcie Day214.

**Korekta (FIX-214, odbiór adwersaryjny 31.08):** wiersz P4 w tabeli §3 (i pierwsze
wydanie tego rozdziału) mogą sugerować, że naprawą miało być DOSŁOWNE wywołanie
`registerInitiative→handoff→execution_case`. To było **strukturalnie niemożliwe** —
`registerInitiative.ts` (`:80-95`) wymaga PRZED-ISTNIEJĄCEGO wiersza w
`source_proposals` (czytanego przez `getSourceProposalForUpdate`) z dokładnym
dopasowaniem treści do propozycji, a draft z czatu Teresy (`generateInitiative.ts`
pisze bezpośrednio do `initiatives`, z pominięciem `source_proposals`) takiej
propozycji nigdy nie ma i mieć nie może bez przebudowy generatora czatu (poza
zakresem 17-D). Naiwne wywołanie `registerInitiative` na czatowym drafcie kończy
się `MaterialCommandConflictError`. Zamiast tego most `initiative.adopt-chat-draft`
naśladuje SPRAWDZONY wzorzec BEZPOŚREDNIEGO mostu `adoptAcceptedClassicInitiative`
(most-siostra SWOT→runtime, `postgresMaterialCommandUnitOfWork.ts:90-206`) — obie
metody wchodzą do kanonicznego `REGISTERED_DRAFT` z pominięciem dwuetapowego
`submit-proposal→register`, przez ten sam silnik `executeMaterialCommand`. To NIE
jest obejście ani dług — to jedyna strukturalnie możliwa droga przy dzisiejszym
kształcie `registerInitiative`; kolejny czytelnik tego rozdziału nie powinien
traktować wyboru `adoptAcceptedClassicInitiative` jako tymczasowego zamiennika
czekającego na „prawdziwą” naprawę przez `registerInitiative`.

## 12. Wykonanie — GF-AGT-02 (Day217)

Ogniwo 1 (READ w rozmowie): działa — trzy realne żądania HTTP przez ApiGateway/JWT uruchomiły `search_knowledge_base` i zwróciły kroki narzędzia.
Ogniwo 2 (kontekst organizacji w promptcie): działa — marker `DAY217-ORG-CONTEXT-89630f9a8a`, zapisany przez `OrganizationContextService`, wystąpił w pełnym wyrenderowanym promptcie każdego przebiegu.
Ogniwo 3 (propozycja zapisu → zgoda → wykonanie → realne zadanie w My Work): działa — trzy actionId dały po jednym zadaniu z `source_type='ai_chat_proposal'`, `source_id=actionId`, widocznym przez GET My Work.
Ogniwo 4 (dokument realną drogą): działa — trzy POST `/api/document-studio/generate` zapisały trzy artefakty ze świeżymi markerami.
Ogniwo 5 (indeksacja z zasięgiem): działa — trzy dokumenty trafiły do `knowledge_docs` i `ai_knowledge_embeddings` ze scope `organization`; mutacja scope dała 4/6 czerwonych testów.
Ogniwo 6 (druga rozmowa cytuje znalezisko z pierwszej): nie działa — obie dozwolone tury R5 zostały zatrzymane przez `TRIAL_PROFILE_INCOMPLETE` przed modelem, więc brak tool-call, cytatu i dowodu R3 Day206.

Werdykt: techniczny łańcuch wstrzyknięty R1–R4 jest powtarzalnie zielony, lecz moduł 17 nie jest zamknięty, ponieważ realna pętla modelowa pozostaje `NOT_PROVEN`.
