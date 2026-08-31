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
| P1 | **Model nie ma pętli narzędziowej w czacie** — 19 narzędzi osiągalne tylko przez powierzchnię Wave-8; czat używa ręcznych regexów intencji | zerwane | tool-loop w /chat/stream: READ bez zgody, WRITE wyłącznie jako governed proposal (wzorzec już istnieje) |
| P2 | **Zapisy czatu = trzecia droga poza kanonem** — create_task/decision robi surowy INSERT do legacy, omijając bramę 409 i ie_aggregate_state | groźne (D-7!) | przełączyć na kanoniczne polecenia (po 197-E2) albo przejściowo na governed proposal→trasy modułów; surowe INSERT-y wygasić |
| P3 | **Dokument z czatu martwy** — ENABLE_DELIVERABLES_LIGHT=false, a silnik pod spodem to TEN SAM co Materiały (właśnie naprawiony) | flaga | odbiór ścieżki czatowej → ON |
| P4 | **Inicjatywa z czatu = sierota** — draft bez wołania registerInitiative→handoff→execution_case | zerwane | opcjonalny krok „przekaż do realizacji" za zgodą (łańcuch z planu migracji A4.0) |
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
