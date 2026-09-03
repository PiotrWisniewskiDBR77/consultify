# CODEX DAY 303 — preferencje Czatu

## Stan wejściowy

- marker: `416432abafe31a390a909cf7e460a4bad7bef191`
- `MARKER OK`
- worktree po utworzeniu: czysty
- tip gałęzi bazowej był przed markerem do przodu; nadzorca scala później, bez rebase w dyżurze
- porty `5284`, `5285`, `6307`: wolne; kontenery `cx-day303*`: `0`; wolne miejsce: `44 GiB`
- PostgreSQL: wyłącznie `cx-day303-pg`, `127.0.0.1:6307`, baza `cx303`
- migracje: pierwszy przebieg zakończony `Postgres migrations complete`; drugi: `Applying migrations: 0`, `Postgres migrations complete`

## Z30

Dowody: `BRAK ZMIENNYCH POCZTY`; zapytanie `SELECT ... FROM settings WHERE key LIKE 'smtp%'` zwróciło `0 rows`; grep drenów w `server/src/Gateway.ts` zwrócił 0 trafień.

Korekta kolejności: dowody Z30 zapisano bezpośrednio po migracjach, a nie przed nimi. Migracje działały w odrębnym procesie migratora, nie uruchomiono `server/src/index.ts`, żadnego drenażu ani wywołania tworzącego wiadomość. To uchybienie raportowe nie jest dowodem wysyłki; pełne wyniki fail-closed podano powyżej.

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.”

## R1 — inwentarz

Pełna tabela: `docs/program/prototypy/PREFERENCJE_CZATU_20260903.md`.

Pomiar tez autora: `AISettings.tsx` ma `1857` linii; istnieje `13` komponentów `AI*Settings.tsx`; `/api/ai-settings` jest zamontowane w `Gateway.ts:744`; `ToolsMenu.tsx` opisuje persystencję preferencji wyświetlania do `aiConfig`; `CHAT-OWN-001` żądało przełączania stron, lecz D17 ustaliła układ na sztywno.

Werdykt R1: preferencje Czatu już istnieją i są osiągalne. Ich główny magazyn to `localStorage` (`consultify-storage`), nie tabela użytkownika. Przeładowanie tej samej przeglądarki wynika z kodu, lecz zimne logowanie na osobnym kliencie jest `NIEZWERYFIKOWANE`.

## Korekty wobec instrukcji

- Teza „B6 ma w całym korpusie jeden wiersz opisu”: semantycznie jeden wiersz opisuje funkcję (`:69`), lecz identyfikator B6 występuje też w indeksie decyzji (`:28`) i decyzji terminowej (`:35`). Żaden z tych wpisów nie dodaje kryterium odbioru.
- Komentarz `ToolsMenu` mówi „persisted”, ale pomiar kodu zawęża to do `localStorage`; nie dowodzi synchronizacji per użytkownik między klientami.

## Testy i pułapki Z33

Uruchomiono ten sam pakiet `tests/components/AIChat/ToolsMenu.test.tsx` przed i po zamknięciu dokumentacji, zawsze: `RUN_DB_TESTS=0 MOCK_DB=true ... --retry=0 --reporter=json`.

- `przed-nazwy.txt`: 14 pełnych nazw;
- `po-nazwy.txt`: 14 pełnych nazw;
- `diff -u`: pusty; dodane `0`, zniknięte `0`;
- suma obu list nazw: `dd30e11f40c6849c7d9562913bc6bfa1f1cec48d181ab304d20a8d1a256d3a93`;
- artefakty: `/private/tmp/cx-day303-preferencje-czatu-artefakty/`.

Pułapki Z33: pakiet jest czysto komponentowy, ma zamockowany store i fetch, więc nie dowodzi HTTP, `ApiGateway`, PostgreSQL ani zimnej persystencji. `RUN_DB_TESTS=0 MOCK_DB=true` jawnie wyklucza użycie go jako dowodu bazy. Służy wyłącznie do kontroli, że skład istniejącego pakietu nie zniknął; wnioski o czterech warstwach pochodzą z kodu, a brak dowodu zimnego klienta pozostaje jawny.

## R2 — odzyskanie zakresu

Zakres odzyskano bez pytania do właściciela:

- `TRIAZ_UWAG_20260902.md:170`: `UW-13-02` oznacza kontekstowy przełącznik chipów sugestii;
- `KORPUS_UWAG_20260902.md:84` i `BACKLOG_UWAG_ODBIORU_20260902.md:156`: właściciel nie lubi chipów, ale nie chce ich usuwać osobom, którym pomagają; prosi o włączanie/wyłączanie;
- `ANALIZA_G13_MODULY_09_16_20260903.md:212`: ta sama pozycja była sklasyfikowana jako nowa preferencja użytkownika;
- commit `fcb83a5f7d` jest przodkiem markera i implementuje `aiConfig.chatSuggestionsEnabled` w istniejącym menu oraz jego konsumenta.

Wniosek R2: B6 jest już zaimplementowane na bazie dyżuru. Nie powstało STOP-pytanie, bo korpus daje odpowiedź jednoznaczną.

## R3 — prototyp

`n/d`: nie dodano drugiego prototypu ani drugiej flagi. Funkcja już istnieje w kanonicznym miejscu; duplikacja byłaby sprzeczna z R3/Z40. Zastany przełącznik ma domyślnie `ON`, ponieważ pochodzi ze starszej, wdrożonej decyzji D-104 i zachowuje chipy dla użytkowników; dyżur nie zmienił tej wartości ani nie włączył żadnej nowej powierzchni.

## R4 — trwałość

`n/d` dla nowej migracji: B6 nie używa bazy, lecz `consultify-storage.state.aiConfig.chatSuggestionsEnabled`. Kod dowodzi rehydratacji w tej samej przeglądarce; osobny klient i synchronizacja konta pozostają `NIEZWERYFIKOWANE` i nie są kryterium odzyskanego B6. Nie dodano pola ani migracji.

## R5 — kadry i lista czekowania

`n/d` dla nowych kadr: nie powstała nowa powierzchnia. Commit zastany `fcb83a5f7d` zawiera parę light/dark i sekwencję interakcyjną `toggle-01`…`toggle-05`, ale w tym dyżurze nie użyto ich jako świeżego dowodu wizualnego i nie ogłoszono ponownej akceptacji właściciela.

Lista czekowania część B w zakresie ustawień:

- istniejące miejsce ustawień: TAK — `ToolsMenu` przy kompozytorze;
- widoczny stan włączony/wyłączony: TAK w kodzie, świeży render `NIEZWERYFIKOWANY`;
- light/dark i PL/EN: klucze istnieją, świeże kadry `n/d` bez zmiany wizualnej;
- klawiatura/fokus: zastana kontrolka `button`, świeży przebieg a11y `NIEZWERYFIKOWANY`;
- synchronizacja per użytkownik między klientami: `NIEZWERYFIKOWANA`, poza odzyskanym zakresem B6.

## R6 — wynik

- Ile z B6 już istniało: **cały odzyskany zakres funkcjonalny** — przełącznik, konsument, domyślne zachowanie zachowujące chipy, i persystencja po przeładowaniu tej samej przeglądarki.
- Co dołożono: wyłącznie inwentarz i dowód mapowania B6 → `UW-13-02` → istniejący commit; zero kodu produktu.
- STOP-pytania: brak, bo zakres odzyskano.
- TWIERDZENIA NIEZWERYFIKOWANE: synchronizacja ustawienia między urządzeniami/klientami; realny zimny login na osobnym kliencie; świeży render i a11y; zachowanie przez realny HTTP/ApiGateway/PG (ścieżka B6 nie korzysta z backendu).

## Stan końcowy

`GOTOWE` jako pomiar i odzyskanie zakresu; bez scalania, bez uruchomienia flag, bez zmian produktu i bez środowisk zdalnych.
