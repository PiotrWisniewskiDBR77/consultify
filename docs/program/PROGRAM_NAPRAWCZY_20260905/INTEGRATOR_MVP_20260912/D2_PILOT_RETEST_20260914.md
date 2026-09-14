# D-2 — retest pilotażu P-P11 / P-T13 / P-T19

**Werdykt:** P-T19 jest lokalnie **PASS** na świeżej bazie i prawdziwej ścieżce przeglądarkowej; P-P11 po rozbiciu daje **5 obszarów zielonych i 1 czerwony**; P-T13 ma sprawny przewód kontekstu Mind Map, ale nadal nie ma autorytatywnej mapy aplikacji w instrukcji Teresy, dlatego zmiana produktu pozostaje **STOP — decyzja właściciela**.

- Baza kodu po mechanicznym rebase W62: `7ecfcf007b` (pierwotnie zbadana na `4de31efbcb0c286cdcbdb0251b10a894db02848d`; range-diff 2/2 bez zmiany patcha).
- Źródło kryteriów: `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`, DEC-496, wiersze P-P11, P-T13 i P-T19.
- Środowisko: osobny PostgreSQL 16 + pgvector, `consultify_d2`, port `5321`; API `4217`; frontend `4218`; `MOCK_DB=false`; `ENABLE_V8_GLOBAL=true`.
- Zakres jest pomiarem i propozycją. Nie ma migracji ani zmiany semantyki produktu.

## P-P11 — ogólne UX Assessment rozbite na mierzalne kryteria

Źródłowa uwaga `ceb436ce` mówi tylko „nawigacja, spójność danych”. Nie dopisujemy testerowi szczegółów, których nie podał. Retest rozkłada ten ogólny sygnał na kontrakty już obecne w produkcie i sąsiadujące zgłoszenia P-P08–P-P12.

| Punkt | Kryterium zachowania | Dowód | Wynik |
|---|---|---|---|
| P-P11.1 | Pięć powierzchni Assessment ma stabilne zakładki i deep-link po odświeżeniu | `AssessmentHub.five-surfaces.test.tsx` | PASS 6/6 |
| P-P11.2 | Lista pokazuje jedną kanoniczną sesję DRD; legacy nie podszywa się pod nią; tytuł, wynik i confidence są spójne | `AssessmentHub.method-core-cutover.test.tsx` | PASS 6/6 |
| P-P11.3 | Completion na liście pochodzi z kanonicznego kontraktu i nie przegrywa z konfliktem legacy | `AssessmentHub.processes-completion.test.tsx` | PASS 3/3 |
| P-P11.4 | Pusty/niedomknięty raport nie udaje wyniku; bramka pokrycia wskazuje realne braki | `reportCoverageGate.pawel.test.ts`, `AssessmentReportView.test.tsx` | PASS 7/7 |
| P-P11.5 | Świeża organizacja widzi Assessment bez błędu V8 i z pięcioma zakładkami | formularz `/register` → `/assessment`, RealPG/API/browser | PASS; `/api/v8/assessment` 200 |
| P-P11.6 | Ta sama sesja jest odnajdywalna dla drugiej osoby z tej organizacji, otwiera się po zimnym starcie, a utrata transportu pokazuje retry | `asm-ui-canon-library.spec.ts` na prawdziwym API/PG/browser | **FAIL 0/2** |

Łącznie skupione testy komponentowe: **22/22 PASS**. Montowany test przeglądarkowy: **0/2**, z dwoma reprodukcjami:

1. Po utworzeniu sesji przez OWNER wiersz tej sesji nie pojawił się w Library użytkownika ADMIN tej samej organizacji w ciągu 10 s; oczekiwany identyfikator i wersja były nieosiągalne.
2. Po przerwaniu `GET /api/method/sessions/:id` ekran nie pokazał `drd-http-error-view` z komunikatem Offline/Brak połączenia w ciągu 10 s.

Cleanup przyrządu również zwrócił 500 przez FK `admin_audit_logs_admin_id_fkey`; to osobny błąd harnessu i nie jest zaliczony jako defekt UX. Pierwszy przebieg bez `DATABASE_URL` był błędem konfiguracji przyrządu; przebieg rozstrzygający używał jawnego RealPG URL.

Dowody: `evidence/a-d2-pilot/pp11-focused-vitest.log`, `evidence/a-d2-pilot/pp11-asm-browser.log`, `evidence/a-d2-pilot/pt19-fresh-org-no-v8-404.png`.

## P-T13 — kontekst Teresy w Mind Map

### Pomiar bieżącego zachowania

- `IdeaMapWorkspace` buduje outline mapy i otwiera jedyne okno Teresy przez `useOpenChatWithContext`.
- Przy `ENABLE_TERESA_MINDMAP` klient przenosi `ideaId`, prompt mapy i aktywną reprezentację. Powtórne otwarcie tej samej idei używa tej samej rozmowy.
- `UnifiedChatPanel` wysyła `ideaContext`, `screenContext` i `workspaceContext`.
- Serwer dodaje do promptu nazwę otwartej reprezentacji i zakaz twierdzenia, że mapa jest niewidoczna.
- Serwer **nie importuje ani nie buduje kanonicznego katalogu modułów, tras, uprawnień i następnych kroków**. Dlatego Teresa zna bieżącą mapę, ale nie ma wiarygodnej podstawy do odpowiedzi „gdzie w Consultify wykonam X?”.

Dowód istniejącego przewodu: **12/12 PASS** (`useOpenChatWithContext.idea.test.ts` 6/6, `ai.mindmapRetrieval.test.ts` 6/6). Dowód luki: `evidence/a-d2-pilot/pt13-source-measurement.txt` — brak odwołania do rejestru tras lub manifestu nawigacji w budowanym promptcie.

### Propozycja decyzji właściciela

Rekomendowany wariant **B — Teresa jako nawigator całej aplikacji w granicach dostępu użytkownika**:

1. Zbudować jeden kanoniczny `navigation manifest` z istniejącego rejestru tras, zawierający `moduleId`, ścieżkę, etykietę EN/PL, krótki cel i dozwolone akcje startowe.
2. Filtrować manifest przed promptem po roli, organizacji i aktywnych flagach; Teresa nie może polecać powierzchni niedostępnej dla użytkownika.
3. Wysyłać mały, deterministyczny wycinek pasujący do pytania, wraz z aktualnym `screenContext`; nie kopiować całej instrukcji aplikacji do każdej rozmowy.
4. Dla odpowiedzi nawigacyjnej zwracać `route + label + reason`, a frontend renderuje bezpieczny link. Model nie wymyśla URL.
5. Zachować obecny kontekst mapy jako dodatkową warstwę: „co jest otwarte” oraz „gdzie przejść dalej” są dwoma odrębnymi źródłami.

Alternatywa A ogranicza pomoc do samej Mind Map i nie zamyka zgłoszenia „nawigacja po środowisku”. Wariant B lepiej odpowiada źródłowemu problemowi, ale zmienia obietnicę produktową Teresy i wymaga jawnej decyzji właściciela. **STOP przed implementacją.**

## P-T19 — rejestracja nowej organizacji i V8

Prawdziwy przebieg przeglądarkowy na świeżej bazie:

1. Formularz `/register` zwrócił **200** i przekierował do `/chat`.
2. PostgreSQL zawiera **9/9** jawnych wierszy `v8.v8_feature_flags` dla nowej organizacji; wszystkie `enabled=1` (`chat`, `ai_core`, `multiplayer`, `workspace`, `lifecycle`, `pm_sync`, `outputs`, `finance`, `results`).
3. Autoryzowany `GET /api/v8/interview/sessions` zwrócił **200**, `sessions=[]`, bez `V8_ORG_DISABLED`.
4. Wejście do `/assessment` wyrenderowało pięć zakładek, `GET /api/v8/assessment` zwrócił **200**, a baner niedostępności V8 był nieobecny.

Dowody: `evidence/a-d2-pilot/pt19-browser-receipt.json`, `pt19-realpg-flags.txt`, `pt19-fresh-org-no-v8-404.png`. P-T19 jest **PASS lokalnie**; nie jest to dowód stagingu.
