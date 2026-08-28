# Dyżur 61 — Materiały — pakiet odbioru właściciela G07–G10

## Karta przeglądu dla Piotra

Materiały są wspólnym miejscem, w którym konsultant odnajduje i otwiera końcowe rezultaty swojej pracy. Moduł zbiera dokumenty, prezentacje, arkusze i szablony w jednym rejestrze, dzięki czemu użytkownik nie musi pamiętać, w którym narzędziu dany rezultat powstał. Głównym punktem wejścia jest lista wszystkich materiałów. Z niej można przejść do widoku ograniczonego do dokumentów, prezentacji, arkuszy albo biblioteki szablonów.

Docelowa ścieżka jest prosta: użytkownik wchodzi do rejestru, wybiera interesujący typ, odnajduje konkretny materiał, ogląda jego podstawowe informacje i podgląd, a następnie otwiera pełną kartę. Dokument powinien pokazywać treść i historię wersji, prezentacja slajdy wraz z notatkami i opisami dostępności, a arkusz dane, formuły i rewizję. Menu przy wierszu ma udostępniać tylko działania rzeczywiście dostępne i bezpieczne.

W MVP nie należy obiecywać działania zewnętrznych generatorów, udostępniania ani eksportu, jeśli dostawca nie jest dostępny lub nie ma na to dowodu. Tak samo materiał, dla którego prawa do treści, obrazów albo fontów są oznaczone jako `UNKNOWN`, musi pozostać wyraźnie odseparowany i nie może wyglądać jak zatwierdzony. Zatwierdzony szablon oraz szablon o nieznanych prawach to dwa różne stany i wymagają innego komunikatu.

Ten dyżur nie dostarczył Piotrowi gotowej sesji przeglądowej. Wiążąca instrukcja nakazała użycie konkretnej lokalnej bazy, lecz istniejący mechanizm przygotowania danych odrzucił jej nazwę, zanim utworzył materiały i personę recenzenta. Bez obchodzenia logowania widoczny był wyłącznie ekran logowania. Dlatego poniższa karta opisuje właściwy zakres i uczciwie wskazuje, że ocena pierwszego wrażenia, pełna ścieżka użytkownika oraz warianty jasny/ciemny i pusty/pełny nie zostały wykonane.

## Wynik wykonawczy

- Instrukcja: commit `9ff0b3749d45928cf9137a778eae47201cca8719`; SHA-256 `3ab0f00e0f6bd763c8543c53f18bea7af2fb9f0617f4b18ff1ba215b515ca5ce`; sentinele `0`; marker w dokumencie `4` razy.
- Marker i HEAD wejściowy: `5e30cb9bf66c8e75481ba723debdd04f3c1a6893`.
- Branch: `codex/materials-day61-owner-review-20260828`.
- Worktree: `/private/tmp/consultify-materials-day61-review`.
- Artefakty: `/private/tmp/cx-day61-materials-review`.
- PostgreSQL: `127.0.0.1:5933`, baza `consultify_day61_materials_review`, użytkownik `postgres`, PostgreSQL `16.15` w `pgvector/pgvector:pg16`.
- Harness: prawdziwy `ApiGateway.getInstance().initializeRoutes(app)` i frontend jako middleware na `127.0.0.1:3991`; bez pełnego `server/src/index.ts`.
- Nowe migracje: żadne. Pierwszy migrator `exit 0`; drugi migrator `exit 0`, `Applying migrations: 0`.
- Mutacja: `N/A — dyżur nie naprawia produktu`.

## Komendy i wyniki

| Etap | Polecenie / pomiar | Kod | Literalny wynik |
| --- | --- | ---: | --- |
| Integralność instrukcji | `shasum -a 256 "$DOC"`; grep sentineli i markera | 0 | hash zgodny; `0`; `4` |
| Rodowód | `git merge-base --is-ancestor 5e30… HEAD` | 0 | marker jest przodkiem HEAD |
| Migracje 1 | jawne `DATABASE_URL`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `NODE_ENV=test`; migrator | 0 | migracje zakończone |
| Migracje 2 | identyczne środowisko; migrator | 0 | `Applying migrations: 0` |
| Seeder | wymagane potwierdzenie + baza dyżuru | 1 | `Database name must match consultify_w3_materials_owner_*` |
| Frontend | `GET /presentations` na `3991` | 0 / HTTP 200 | HTML dostarczony; przeglądarka przekierowana do logowania |
| Gateway | anonimowe `GET /api/artifacts` | 0 / HTTP 401 | `Unauthorized` |
| DB | `SELECT count(*) FROM v8_output_artifacts` | 0 | `0` |
| No-send | zmienne SMTP/Resend/SendGrid po `unset` | grep 1 | brak zmiennych; brak repozytoryjnego procesu worker/outbox |
| Outbox | lokalny odczyt DB | 0 | `notification_outbox=0`; `case_workspace_event_outbox=0` |

Uwaga środowiskowa: host nie ma klienta `psql` (`exit 127`); te same odczyty wykonano klientem wewnątrz kontenera (`exit 0`). Szeroki pierwszy grep procesów dawał fałszywe trafienia Microsoft Teams; wiążący pomiar zawężono do procesów tego worktree/kontenera i workerów — wynik pusty.

Odchyłka proceduralna: `git -C "$VAULT" rev-parse --git-path "worktrees/…"` zwrócił ścieżkę względną. Pierwsza próba utworzyła wyłącznie nasz plik `worktrees/consultify-materials-day61-review/config.worktree` w chronionym checkoutcie. Plik oraz oba utworzone, puste katalogi zostały natychmiast usunięte; ponowny `git status --short` chronionego checkoutu pokazał wyłącznie zastany WIP, a status izolowanego worktree był czysty. Żaden istniejący plik ani WIP właściciela nie został zmieniony. Właściwy `config.worktree` zapisano w dokładnej ścieżce odczytanej z `$WT/.git`.

## Mianownik

Marker montuje pięć widoków rejestru i trzy pełne karty. Mianownik wynosi `8` powierzchni; bazowa macierz wizualna wynosi `8 × 2 motywy × 2 stany = 32` zrzuty, przed dodatkowymi ujęciami menu i podglądu.

| # | Ekran | Route | Wymagane stany | Pokrycie |
| ---: | --- | --- | --- | --- |
| 1 | Wszystkie materiały | `/presentations?tab=all` | jasny/ciemny × pusty/pełny | `0/4 — STOP` |
| 2 | Dokumenty | `/presentations?tab=documents` | jasny/ciemny × pusty/pełny | `0/4 — STOP` |
| 3 | Prezentacje | `/presentations?tab=presentations` | jasny/ciemny × pusty/pełny | `0/4 — STOP` |
| 4 | Arkusze | `/presentations?tab=sheets` | jasny/ciemny × pusty/pełny | `0/4 — STOP` |
| 5 | Biblioteka szablonów | `/presentations?tab=templates` | jasny/ciemny × pusty/pełny | `0/4 — STOP` |
| 6 | Pełna karta dokumentu | `/document-studio/:artifactId` | jasny/ciemny × pusty/pełny | `0/4 — STOP` |
| 7 | Pełna karta prezentacji | `/presentations/builder/:deckId` | jasny/ciemny × pusty/pełny | `0/4 — STOP` |
| 8 | Pełna karta arkusza | `/excele?ff_excele=1&artifactId=:id` | jasny/ciemny × pusty/pełny | `0/4 — STOP`; dodatkowo flaga silnika wymaga jawnego przypięcia |

Źródło pomiaru: `ReportsAndPresentationsHub.tsx:334–359` (pięć kart) oraz `AppRoutes.tsx:1849–1877, 2601, 2743, 2775–2802` (rejestr i pełne karty). Nie użyto próbki reprezentatywnej.

## Manifest zrzutów

Wymaganych zrzutów Materiałów wykonano `0/32`. Zachowano jeden obejrzany zrzut blokady; nie jest liczony jako poprawny pakiet G08/G10.

| Plik | Ekran/route | Motyw | Stan | Rola | Timestamp UTC | Marker | SHA-256 | Inspekcja |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `render-attempt-presentations.png` | próba rejestru; końcowo `/login?redirect=%2Fpresentations` | ciemny | blokada auth | anonimowa | `2026-08-28T07:16:35Z` | `5e30cb9bf6` | `337ce0c77b46db90e8fc4e6111c8b3668fbed0ebd2de721fbed61e2987cbced2` | Obejrzany 1280×823. Widoczny wyłącznie angielski ekran logowania; Materiały nie renderują się. Dowód STOP, nie PASS. |

## G09 — realna ścieżka CX

| Krok | Działanie | Route/żądanie | Metoda | HTTP | Tożsamość/organizacja | Widok / wynik |
| ---: | --- | --- | --- | ---: | --- | --- |
| 1 | Wejście do rejestru | `/presentations` | GET | 200 HTML | anonimowa / brak organizacji | przekierowanie klienta do `/login?redirect=%2Fpresentations`; STOP |
| 2 | Odczyt rejestru przez Gateway | `/api/artifacts` | GET | 401 | anonimowa / brak organizacji | `Unauthorized`; granica auth działa |
| 3–9 | Dokument, podgląd, prezentacja, arkusz, kebab, zatwierdzony szablon, prawa `UNKNOWN` | wymagają seedowanej persony i danych | — | — | `NOT_PROVEN` | `NOT_STARTED` po fail-closed seedzie; nie symulowano powodzenia |

## Znaleziska i STOP

### MAT-D61-001 — sprzeczność nazwy bazy i seedera

- Objaw: seeder kończy się przed utworzeniem danych i manifestu.
- Reprodukcja: uruchomić istniejący seeder na wymaganym `DATABASE_URL` do `consultify_day61_materials_review` z jego wymaganymi zmiennymi potwierdzającymi.
- Plik+linia: `server/scripts/seed-wave3-materials-owner-review.ts:21–22`.
- Dowód: `seed.log`, `exit 1`, literalnie `Database name must match consultify_w3_materials_owner_*`.
- Wpływ: brak pełnego stanu, persony, G09 i poprawnej macierzy 32 zrzutów.
- Najwęższe pytanie: która nazwa jest wiążąca — baza Day 61 z instrukcji czy wzorzec wymagany przez istniejący seeder?

### MAT-D61-002 — render-blocking ekran logowania

- Objaw: rejestr Materiałów nie renderuje się; widoczny jest ekran logowania.
- Reprodukcja: uruchomić minimalny Gateway na pustej bazie po odrzuconym seedzie i otworzyć `/presentations`.
- Plik+linia: montaż rejestru `src/routes/AppRoutes.tsx:2601`; przyczyna danych/auth: `server/scripts/seed-wave3-materials-owner-review.ts:21–22`.
- Dowód: zrzut i hash w manifeście; anonimowe API `401`.
- Wpływ: STOP całego zależnego renderu G08/G10 i przejścia G09.
- Najwęższe pytanie: po rozstrzygnięciu nazwy bazy, czy wznowić ten sam branch i odtworzyć pełną macierz?

## Wynik G07–G10

| Gate | Wynik | Uzasadnienie |
| --- | --- | --- |
| G07 | `PARTIAL` | Karta po polsku i pełny mianownik są gotowe; brak guided replay Piotra. |
| G08 | `STOP_RENDER_BLOCKING` | `0/32` wymaganych zrzutów; tylko dowód ekranu logowania. |
| G09 | `STOP_AUTH_FIXTURE_MISSING` | Realny Gateway zwraca 401 anonimowo; brak legalnie seedowanej persony. |
| G10 | `STOP_FULL_STATE_UNAVAILABLE` | Nie dało się uzyskać wymaganego pełnego stanu; alternate-state review niewykonany. |

G00–G06 nie zostały przepisane jako jednolity PASS. G11–G20 pozostają bez zmian.

## Twierdzenia niezweryfikowane

- `NOT_PROVEN`: wygląd pięciu kart rejestru w jasnym i ciemnym motywie.
- `NOT_PROVEN`: stany puste i pełne ośmiu powierzchni.
- `NOT_PROVEN`: pełna karta wersjonowanego dokumentu na tym markerze/runtime.
- `NOT_PROVEN`: slajdy, notatki i alt text prezentacji w UI.
- `NOT_PROVEN`: formuła i rewizja arkusza w UI; flaga Excele nie została przypięta w działającym review.
- `NOT_PROVEN`: kebab, podgląd i karta w kontekście seedowanych danych.
- `NOT_PROVEN`: widoczna różnica zatwierdzonego szablonu i kwarantanny praw `UNKNOWN`.
- `NOT_PROVEN`: share/export/provider; nie wywoływano ich i nie symulowano.
- `NOT_PROVEN`: decyzja/akceptacja Piotra.

## KARTA DOWODOWA — DYŻUR 61 (MATERIAŁY)

Gałąź: `codex/materials-day61-owner-review-20260828`  
Tip: commit zawierający ten raport; SHA podany w handoffie  
Marker: `5e30cb9bf66c8e75481ba723debdd04f3c1a6893`  
Data: `2026-08-28`

### 1. Rodowód

- Marker jest przodkiem tipa: `TAK`; `git merge-base --is-ancestor … HEAD` → `0`.
- Kopia zapasowa po pierwszym commicie: push wyłącznie `github-backup`, wynik w handoffie.
- Commitów ponad marker: `2` po finalnym commicie; zmienionych plików: `3`.

### 2. Rozłączność

- Pliki spoza licencji zapisane w repo: `ŻADNE`.
- Pliki przekrojowe: `ŻADNE`.
- Migracje dodane: `ŻADNE`; wykonano zastany łańcuch dwukrotnie.
- Port PG / harness: `5933 / 3991`.

### 3. Osiągalność

| Ścieżka | Metoda | Kod | Readback | Artefakt |
| --- | --- | ---: | --- | --- |
| `/presentations` | GET | 200 | widok końcowy: login redirect | zrzut blokady |
| `/api/artifacts` | GET | 401 | `v8_output_artifacts=0` | log Gateway/DB |

### 4. Dowód mutacyjny

`N/A — dyżur nie naprawia produktu`; nie deklaruje żadnej naprawy.

### 5. Regres

`N/A — dyżur odbiorczy`; nie uruchamiano regresu i nie zmieniano produktu. `--retry=0`: `N/A`.

### 6. Zmiany istniejących testów

`ŻADNE`.

### 7. Mianowniki

| Liczba | Co mierzy | Komenda / źródło |
| ---: | --- | --- |
| 5 | zamontowane karty rejestru | odczyt tablicy `tabs`, linie 334–359 |
| 3 | pełne typy artefaktów | odczyt routingu markera dla DOC/PPT/XLSX |
| 8 | powierzchnie mianownika | `5 + 3` |
| 32 | bazowe wymagane zrzuty | `8 × 2 motywy × 2 stany` |
| 0 | poprawne zrzuty Materiałów | manifest; jedyny obraz jest dowodem STOP |
| 1 | zrzut blokady | `find`/manifest w `$ART` |

### 8. Wygląd

- Zrzuty wykonane: `NIE — wymagany pakiet`; jeden zrzut STOP.
- Obejrzane oczami: `TAK`, wyłącznie ekran blokady.
- Stany: ciemny / blokada auth; język: EN.
- Widoczne zmiany produktu poza zakresem: `ŻADNE`.

### 9. Status per pozycja

| Pozycja | Status | Brak do ZROBIONE |
| --- | --- | --- |
| G07 | `CZĘŚCIOWO` | guided replay Piotra |
| G08 | `STOP` | render modułu i 32-zrzutowa macierz |
| G09 | `STOP` | legalnie seedowana persona i pełna ścieżka |
| G10 | `STOP` | pełny stan DB i alternate-state review |

### 10. Twierdzenia niezweryfikowane

Niepusta lista znajduje się powyżej; obejmuje wygląd, pełne karty, interakcje, prawa, providerów i owner acceptance.

### 11. STOP-y

| Powód | Sprawdzona licencja | Potrzeba od nadzorcy |
| --- | --- | --- |
| Seeder odrzuca wymaganą nazwę DB | brak prawa do zmiany `server/**`; tylko istniejący seeder | rozstrzygnięcie jednej kanonicznej nazwy bazy lub nowy związany marker |
| Brak persony powoduje login redirect | zakaz obejścia auth i atrap danych | po rozstrzygnięciu bazy zgoda na wznowienie tej samej sesji review |

## Karta teza–dowód

| Teza | Wejście | Mechanizm | Skutek | Negatywna granica | Artefakt | Wynik |
| --- | --- | --- | --- | --- | --- | --- |
| Instrukcja jest związana z markerem | commit instrukcji + oczekiwany hash | `git show`, SHA-256, liczenie markerów | właściwy marker/worktree | stary załącznik nieużyty | kontrola źródła | `PASS` |
| DB jest świeża i lokalna | jawny URL `127.0.0.1:5933` | kontener PG16 + migrator dwa razy | drugi przebieg 0 zmian | brak zdalnej DB | logi migracji/fingerprint | `PASS` |
| Pełny fixture nie istnieje | wymagana nazwa DB | fail-closed guard seedera | exit 1 przed seedem | bez zmiany seedera/alternatywnej DB | `seed.log`, linia 21 | `STOP` |
| Materiały nie renderują się do review | brak seedowanej persony | realny Gateway + chroniona trasa | login redirect; API 401 | bez obejścia auth | screenshot + HTTP | `STOP` |
| Mianownik został policzony kompletnie | routing i nawigacja markera | pięć kart + trzy pełne typy | 8 powierzchni / 32 bazowe ujęcia | zero próbki reprezentatywnej | linie routingu/tabs | `PASS_SCOPE_ONLY` |
