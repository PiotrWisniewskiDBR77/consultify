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

Na etapie R1 nie ogłoszono wyniku żadnego pakietu testowego i nie użyto testów jako dowodu działania. W konsekwencji §0.4a nie został jeszcze uruchomiony; tabela jawnie oznacza brak testu zimnego klienta zamiast przepisywać cudze liczby. Grep i lektura kodu dowodzą istnienia czterech warstw, nie działania HTTP.

## R2–R6

Do uzupełnienia po odzyskaniu zakresu R2.
