# PROTOKÓŁ AUDYTU MODUŁU — V1 (2026-06-11)

**Status:** SSOT dla wszystkich audytów per-moduł z Mapy Modułów V2 (`docs/audit/2026-06-11/_MODULE_MAP_V2.md`).
**Cel:** każdy z 27 modułów przechodzi IDENTYCZNY, 8-fazowy audyt, którego wynikiem są dwa artefakty: (1) **karta audytu** z oceną /100 wg stałej rubryki i (2) **plan dokończenia w falach** z twardym Definition of Done. Zero losowości: każda faza ma zdefiniowany cel, metodę, narzędzia, wymagane dowody i format outputu.

**Zasady nadrzędne (obowiązują w każdej fazie):**
1. **Prawda kodu, nie dokumentacji** — każde twierdzenie ma dowód `plik:linia`; dokumenty STATUS/CODEMAP/plany traktujemy jako hipotezy do weryfikacji (finding: gap-reporty przeszacowują ~7×).
2. **Verify before claiming** (reguła właścicielska) — żadne „działa" bez dowodu: kod → uruchomiony test → żywy ekran ze screenshotem. `tsc`/`eslint` NIE jest dowodem działania.
3. **Nie powielać naprawionych findingów** — przed startem sprawdź listę „naprawione od 2026-06-02" w _MODULE_MAP_V2 (wątek przekrojowy nr 7).
4. **Każda pozycja inwentarza dostaje werdykt** — punkt wyjścia to zamrożona lista funkcjonalności z `inventory/INV_*.md`; nic nie znika, nic nie jest „poza zakresem" bez jawnej decyzji.
5. **Dowody są składowane** — `docs/audit/<data>/<moduł>/evidence/` (screenshoty, logi, wyniki curl, output testów). Karta linkuje do dowodów.

---

## PRZEBIEG: 8 FAZ

### FAZA 0 — Zamrożenie zakresu (scope freeze)
**Cel:** audyt ma zamknięty, policzalny zakres zanim ktokolwiek otworzy kod.
**Wejścia (obowiązkowe):** wpis modułu w `_MODULE_MAP_V2.md`; inwentarz `INV_*`; poprzednia karta (2026-06-02 / ideas/); powiązane plany w `docs/plans/`; powiązane findingi z pamięci projektu.
**Czynności:**
- Przepisz pozycje inwentarza do checklisty audytowej (kolumny: # / funkcja / status z inwentarza / werdykt audytu / dowód).
- Dopisz pozycje NOWE odkryte od czasu inwentarza (git log na katalogach modułu od daty inwentarza).
- Wskaż obowiązujące kanony (Faza 5): które tabele podlegają TABLE_AND_PREVIEW_CANON, czy są karty pod CARD_CONTENT_FORMULA, czy moduł ma wzorzec ModuleHub/MELS, czy podlega beta-gatingowi.
- Zdefiniuj **3–7 scenariuszy krytycznych** (happy path E2E + najważniejsze przepływy) — to one będą testowane żywo w Fazie 4 i to ich pokrycie liczy się w Fazie 2.
**Output:** sekcja „Zakres i scenariusze krytyczne" w karcie. Bez tej sekcji audyt nie startuje.

### FAZA 1 — Prawda kodu (code truth)
**Cel:** dla każdej pozycji checklisty werdykt: **REALNE / MOCK-STUB / ZEPSUTE / UKRYTE / MARTWE**, z dowodem.
**Metoda:** czytanie kodu runtime (montaż → komponent → wywołanie API → handler → SQL); polowanie na: mocki/hardcode/dane fabrykowane klientem („real call, fake feature"), ciche degradacje (`catch→[]`, `requireTables→503` połykane, fallbacki demo), przyciski-zawsze-błąd, rozjazdy kontraktu (koperta odpowiedzi, ID, auth headers), kod nieosiągalny.
**Obowiązkowe tabele w karcie:**
- **Wiring FE↔BE↔DB:** funkcja → endpoint → tabela DB → migracja (plik) → status.
- **Flagi:** flaga → default BE (komentarz vs runtime!) → default FE → kto może włączyć → wpływ na moduł.
- **Martwy kod:** plik → dlaczego martwy → rekomendacja (wytnij/wepnij).
- **Połączenia międzymodułowe (1g):** wszystkie WEJŚCIA i WYJŚCIA modułu (eventy, API, registry, konwersje, deep-linki, handoffy czatu) z plikiem i statusem — to paliwo Kroku 6 sekwencji (`docs/audyt-harvard/INTEGRACJE.md`).
**Output:** sekcje karty 1a–1g (Realne / Mock / Zepsute / Martwe / Wiring / Flagi / Połączenia).

### FAZA 2 — Testy automatyczne: przód i tył
**Cel:** wiedzieć, co jest chronione testem, co jest zielone NAPRAWDĘ, i co trzeba dopisać.
**Czynności (w tej kolejności):**
1. **Inwentarz testów:** FE (`vitest`, `tests/unit`, `tests/components`), BE (`server/src/**/__tests__`), E2E (`tests/e2e`). Per plik: czego dotyczy, ile testów.
2. **URUCHOM testy modułu** (nie cytuj cudzych wyników): zapisz liczbę PASS/FAIL/SKIP + czas + log do evidence. Komenda i commit w karcie.
3. **Mapa pokrycia scenariuszy krytycznych:** dla każdego scenariusza z Fazy 0 → czy istnieje test FE? BE? E2E? Czy jest w CI (`.github/workflows/`)? (Wzorzec znany z Mind Map: e2e istnieje, ale nie jest w CI = nie liczy się jako ochrona.)
4. **Pułapki znane:** testy mockujące serwis (testują walidację, nie zachowanie — wzorzec facilitation), testy pokrywające wyłącznie ścieżkę za flagą OFF (wzorzec Table platform).
5. **Backlog testowy:** lista braków — każda pozycja: typ (unit/integration/E2E) + plik docelowy + scenariusz + priorytet. To wchodzi wprost do planu dokończenia.
**Output:** sekcja „Testy" karty + backlog testowy.

### FAZA 3 — Środowiska / Railway
**Cel:** odpowiedź na pytanie „czy to, co działa w kodzie, działa na staging i prod" — bez zgadywania.
**Checklist (każdy punkt z dowodem w evidence):**
1. **Wersje wdrożone:** jaki commit jest na staging, jaki na prod (Railway dashboard / `railway status` / endpoint wersji), vs branch audytowany. Prod = 2026-05-18 do czasu promocji Londyn — każdy finding „działa w kodzie" musi mieć dopisek czy istnieje na prodzie.
2. **Migracje:** lista tabel modułu (z Fazy 1) → czy migracja istnieje w repo → czy jest ZASTOSOWANA na staging i prod (zapytanie `information_schema.tables/columns` przez `DATABASE_URL`; pamiętaj: runner manualny + migrationRunner „marks-applied-even-on-error" → weryfikuj schemat, nie tabelę migracji).
3. **Env/flagi:** wymagane zmienne modułu (z tabeli flag Fazy 1) → wartości na staging/prod (Railway variables). Szczególnie: `ENABLE_V8_GLOBAL`, `ENABLE_DELIVERABLES_LIGHT`, klucze (GEMINI_LIVE, TAVILY, STRIPE).
4. **Smoke endpointów na staging:** curl z tokenem na 5–10 kluczowych endpointów modułu → status code + kształt odpowiedzi. Wyłapuje: 404 (v8 gate/brak mountu), 503 (requireTables/feature-unavailable), 500 (schema drift — wzorzec stagingu 2026-06-08).
5. **Logi:** `railway logs` (lub dashboard) — błędy związane z modułem w ostatnich 24–48 h.
6. **Znane pułapki infra:** Dockerfile.api gubi zależności (wzorzec rrule — explicit-install); SQLite-izmy (`datetime('now',...)`) padające na Postgresie; dev backend wpięty w PROD DB (uważać z zapisami podczas audytu!).
**Output:** sekcja „Środowiska" karty — tabela: aspekt → staging → prod → werdykt.

### FAZA 4 — Żywa użyteczność frontu (wykonuje Claude osobiście, nie subagent)
**Cel:** potwierdzić oczami, że scenariusze krytyczne DZIAŁAJĄ dla użytkownika; dostarczyć dowód wizualny.
**Środowisko:** preview lokalny (`preview_start`) lub staging w przeglądarce; konto adekwatne do modułu. Jeśli przeglądarka niedostępna — audyt dostaje status „NIEPEŁNY (bez Fazy 4)" i NIE może dostać oceny końcowej powyżej 70.
**Skrypt przejścia (stały):**
1. **Happy path E2E** każdego scenariusza z Fazy 0: utwórz → edytuj → zapisz → **przeładuj stronę → zweryfikuj trwałość** (反 wzorzec „rename tylko w stanie Reacta").
2. **Każdy widoczny przycisk coś robi** — klikamy wszystkie akcje pierwszego poziomu; polowanie na zawsze-błąd (wzorzec 4 przycisków Table: 404/401).
3. **Stany:** pusty (nowe konto/brak danych), ładowanie, błąd (odetnij sieć/wymuś 500), długa treść/overflow.
4. **i18n:** przełącz PL↔EN — brakujące klucze, mieszanka języków, zepsute stringi (wzorzec „Cost roseuction").
5. **Role:** przejście na koncie MEMBER (nie tylko admin) tam, gdzie moduł jest dla członków; pilot jeśli dotyczy.
6. **Konsola i sieć:** `preview_console_logs` + `preview_network` podczas przejścia — errory, 4xx/5xx, pętle żądań.
7. **Skróty klawiaturowe** deklarowane przez moduł — wyrywkowo 3–5.
**Dowody:** screenshot per scenariusz (PASS i FAIL) do `evidence/`; nazewnictwo `f4_<scenariusz>_<pass|fail>.png`.
**Output:** sekcja „Żywa weryfikacja" karty — tabela scenariusz → wynik → dowód.

### FAZA 5 — Kanony i standardy graficzne
**Cel:** zgodność z ustanowionymi standardami — per powierzchnia, nie „ogólnie".
**Checklisty źródłowe:**
- **Tabele list + preview:** `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` — pełna checklista **§27 (A–S)** dla KAŻDEJ tabeli listowej modułu (wynik: tabela powierzchnia × pozycje A–S).
- **Karty treści (insights/inicjatywy):** `docs/standards/CARD_CONTENT_FORMULA.md` — walidatory formuły dla próbki ≥5 kart, jeśli moduł produkuje karty.
- **Wzorzec hubowy:** ModuleHub (Menu 1/2/3, taby, dynamic tabs dokumentów, breadcrumbs) lub MELS (ExecutiveModuleShell) — zgodność z implementacją referencyjną.
- **UI-standards:** `docs/ui-standards/` (typografia, kolory, spacing, komponenty współdzielone vs lokalne kopie).
- **Beta gating:** zgodność z SSOT `betaAccess.ts` + branded plate (nie własne mechanizmy).
- **Stany standardowe:** empty/loading/error wg wzorca aplikacji (nie gołe „No data").
**Output:** sekcja „Kanony" karty — tabela zgodności per powierzchnia + lista odstępstw z priorytetem.

### FAZA 6 — Bezpieczeństwo i dostęp
**Cel:** moduł nie wycieka danych i nie udaje zabezpieczonego.
**Checklist:**
1. **Trzy warstwy gatingu osobno:** nawigacja (sidebar) / route (`ProtectedRoute`/gate) / API (middleware) — gdzie jest dziura między nimi (wzorzec: beta-lock tylko nawigacyjny).
2. **Org-scope na KAŻDYM endpoincie modułu** — szukaj zapytań bez `organization_id` (wzorzec: 5 dziur facilitation).
3. **Zasoby publiczne** (share tokeny, public viewery): revoke działa, brak enumeracji, brak danych ponad potrzebę.
4. **WS/realtime:** autoryzacja zasobu przy upgrade, nie tylko JWT (wzorzec `/ws/collab`).
5. **Capabilities egzekwowane serwerowo**, nie tylko w UI (wzorzec canvas.share przed fixem).
6. **Sekrety/PII w logach i konsoli** — przegląd logów z Fazy 3/4.
**Output:** sekcja „Bezpieczeństwo" karty; każdy finding z severity (P0–P3).

### FAZA 7 — Ocena: stała rubryka /100
**Cel:** porównywalność między modułami. Oceny wyłącznie z rubryki — bez „na oko".

| Wymiar | Waga | Kryterium oceny (pełne punkty gdy…) |
|---|---|---|
| **A. Realność funkcji** | 25 | 100% pozycji inwentarza REALNE; odejmuj proporcjonalnie za MOCK/ZEPSUTE/fabrykowane klientem |
| **B. Wiring i dane** | 15 | każda funkcja ma żywy endpoint + tabelę + migrację zastosowaną; brak split-brain schema↔kod; brak cichych degradacji bez komunikatu |
| **C. Testy automatyczne** | 15 | wszystkie scenariusze krytyczne pokryte (FE+BE), testy zielone PO URUCHOMIENIU, podpięte do CI |
| **D. Żywa użyteczność** | 15 | 100% scenariuszy Fazy 4 PASS ze screenshotem; zero przycisków-zawsze-błąd; trwałość po reloadzie |
| **E. Kanony/UI** | 10 | §27 A–S spełnione dla tabel; formuła kart spełniona; wzorzec hubowy; i18n PL/EN komplet |
| **F. Bezpieczeństwo/dostęp** | 10 | trzy warstwy gatingu spójne; org-scope wszędzie; zero P0/P1 z Fazy 6 |
| **G. Środowiska (Railway)** | 10 | migracje + flagi + smoke 200 na staging; znana i udokumentowana delta prod |

**Hard caps (nadpisują sumę):** happy path FAIL żywo → max **55**; zero testów scenariuszy krytycznych → max **70**; cross-org leak / brak auth na zapisie → max **50** + finding P0; Faza 4 niewykonana → max **70** + status „NIEPEŁNY".
**Tier:** ≥85 **GA-ready** · 65–84 **Beta** · 40–64 **Alpha** · <40 **Broken**.

### FAZA 8 — Plan dokończenia (drugi artefakt)
**Cel:** plan, który po wykonaniu daje „pełne dokończenie pracy" wg definicji właściciela.
**Struktura (stała):**
- **Fala 1 — Integralność (P0):** wszystko, co łamie zaufanie lub dane (zepsute przyciski, silent overwrite, dziury org-scope, padające na PG zapytania).
- **Fala 2 — Domknięcie wartości (P1):** funkcje MOCK→REAL, kontrakty FE↔BE, odblokowanie flag, brakujące przepływy.
- **Fala 3 — Jakość i kanony (P2):** §27, formuły kart, i18n, sprzątnięcie martwego kodu, backlog testowy „nice-to-have".
- Każda pozycja: **co / dlaczego (1 zdanie z dowodem z audytu) / jak zweryfikować (konkretny test lub screenshot)**.

**DEFINITION OF DONE modułu („pełne dokończenie") — wszystkie 6 muszą być spełnione:**
1. ✅ **Testy auto przód+tył**: scenariusze krytyczne pokryte FE+BE(+E2E gdzie zasadne), zielone, w CI.
2. ✅ **Żywa weryfikacja Claude'a**: pełny skrypt Fazy 4 PASS, dowody w evidence (screenshoty + console/network czyste).
3. ✅ **Railway**: migracje zastosowane, flagi ustawione i udokumentowane, smoke endpointów 200, brak błędów modułu w logach.
4. ✅ **Kanony graficzne**: checklisty Fazy 5 bez odstępstw P0/P1.
5. ✅ Zero pozycji WIDOCZNE-ALE-ZEPSUTE (naprawione albo ukryte decyzją).
6. ✅ Zero cichych degradacji bez komunikatu dla użytkownika.

---

## MODEL WYKONANIA (jak fizycznie przebiega jeden audyt)

| Rola | Fazy | Wykonawca |
|---|---|---|
| Agent KOD | 1 (+wkład do 0) | subagent general-purpose — czyta kod, buduje tabele wiring/flagi/martwe |
| Agent TESTY | 2 | subagent — inwentaryzuje i URUCHAMIA testy, buduje backlog |
| Agent KANON+SEC | 5+6 | subagent — checklisty §27/formuła/gating/org-scope |
| **Claude (main)** | 0, 3, 4, 7, 8 | osobiście: scope freeze; Railway (poświadczenia, ostrożność z prod DB); żywa weryfikacja w przeglądarce ze screenshotami; synteza, ocena, karta, plan |

Agenci 1/2/5+6 idą RÓWNOLEGLE po Fazie 0. Faza 4 po Fazie 1 (wiem już, czego szukać żywo). Pojedynczy moduł = jedna sesja robocza; duże moduły (M01 Czat, M20 Tabele) można ciąć na pod-zakresy, ale karta jest jedna.

**Szablon karty:** `docs/audit/templates/MODULE_AUDIT_CARD_TEMPLATE.md` — struktura sekcji jest OBOWIĄZKOWA (puste sekcje zostają z adnotacją „brak ustaleń", nie znikają).
**Tracker:** `docs/audit/2026-06-11/_AUDIT_TRACKER.md` — status wszystkich 27 modułów, aktualizowany po każdym audycie.

## Kolejność audytów (rekomendacja z Mapy V2)
1. Core otwarte dla klientów: M01 Czat → M03 My Work organizer → M10 Wywiad → M13 Inicjatywy → M14 Wdrożenie → M25 Ustawienia
2. Beta-closed wg priorytetu produktowego: M02 Canvas → M17 Outputs → M18 Dokumenty → M19 Prezentacje → M20 Tabele → M16 Finanse → M15 Rezultaty → M21 Meeting → M12 Audyty → M04 Notatnik
3. M05–M09 Ideas: karty świeże (2026-06-11) — wymagają TYLKO dociągnięcia do protokołu (Fazy 2–6, których tam brakowało: testy uruchomione ✓, ale Railway/żywa/kanony — nie)
4. Internal/admin: M22 AI OS → M23 Organizacja → M24 Admin → M27 SuperAdmin → M26 Partner → A1 decyzja
