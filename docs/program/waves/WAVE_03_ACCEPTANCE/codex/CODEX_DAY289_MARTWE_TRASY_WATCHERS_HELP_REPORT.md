# CODEX DAY 289 — martwe trasy watchers/help

## Wynik

**B naprawione i zweryfikowane lokalnie na RealPG. A potwierdzone jako martwy komponent, bez zmian w kodzie.** Nie jest to dowód stagingu, demo ani produkcji.

Commit produktu: `820b8d0a5b`. Gałąź: `codex/day289-martwe-trasy-watchers-help-20260903`, push `github-backup` wykonany.

## Wejście

Dosłowny wynik markera:

```text
MARKER OK
```

Dosłowny wynik sanity:

```text
17dfbc0c8ad28d27a2daeb1ac417aa26d00e7991
```

`status --short` był pusty. Dysk: 48 GiB wolne przy pierwszym pomiarze. Porty 5256, 5257 i 6293 były wolne; kontenerów `cx-day289` było 0.

Tip `github-backup/grafika/m03-20260902` = `96982ed24f156d8d9cac7a56432c6586277e304c`, 39 commitów i 77 plików przed markerem. Zgodnie z DEC-2026-08-26-95 praca wystartowała dokładnie z markera, bez rebase.

## R1 — pomiar

### A — watchers

- `src`: dokładnie 3 wołania `/api/settings/watchers`; `server/src`: 0.
- Realny `ApiGateway` na 5256: `GET /api/settings/watchers` → 404 `Cannot GET`.
- Serwer ma obserwatorów per obiekt: `initiative_watchers` oraz `record_watches`; nie ma agregatu wielotypowego task/initiative/project oczekiwanego przez hook.
- `NotificationSettingsV2` i `WatchingTab` mają wyłącznie importy we własnej rodzinie. Żywy `src/views/SettingsView.tsx:433` renderuje `NotificationSettings` v1. Werdykt: **MARTWY KOMPONENT, nie żywa zepsuta zakładka**. Zgodnie z R4: zero kodu A.

### B — schemat PRZED

Pełny strict chain na `pgvector/pgvector:pg16`, `127.0.0.1:6293/cx289`: 886 migracji; drugi przebieg `Applying migrations: 0`.

| Kolumna używana przez trasę | Stan po migracjach PRZED |
| --- | --- |
| `help_articles.category_id` | BRAK |
| `help_articles.body` | BRAK |
| `help_articles.status` | BRAK |
| `help_events.article_id` | BRAK |
| `help_events.metadata` | BRAK |

`help_categories` istniała z `id,name,sort_order,created_at`. Pięć miejsc maskowało błędy: cztery `.catch(() => [])` i handler zdarzeń.

## R2 — HTTP PRZED

Realny proces montował `ApiGateway.getInstance().initializeRoutes(app)`, słuchał na 5256, używał podpisanego JWT i RealPG:

| Żądanie | PRZED |
| --- | --- |
| `GET /api/settings/watchers` | 404 |
| `GET /api/help/articles` | 200 + pusta lista; log PG `category_id does not exist` |
| `GET /api/help/articles?q=probe` | 200 + pusta lista; ten sam błąd |
| `GET /api/help/categories` | 200 + pusta lista; licznik wpadał w 42703 |
| `POST /api/help/events` payloadem frontu | **200, `stored:true`, ale INSERT odrzucony i zimny readback = 0** |

Korekta tezy instrukcji: handler nie zwracał `stored:false`. `dbRun` zwracał `{success:false}` bez wyjątku, a kod bezwarunkowo ustawiał `stored=true`. To jest gorszy fałszywy sukces niż teza wejściowa.

## R3/R5 — naprawa i dowód PO

- Dodano migrację addytywną pięciu kolumn, backfill `category_id←category`, `body←content`, `status←is_published` oraz indeksy.
- Usunięto całe runtime DDL z `help.routes.ts`; schemat pochodzi z migracji.
- Cztery puste catch logują kontekst i propagują błąd.
- `POST /events` przyjmuje `playbookKey/context`, zapisuje `playbook_key/event_data/route`, zachowuje kompatybilność `articleId/metadata` i sprawdza `dbRun.success`; nieudany zapis daje 500.
- HTTP PO na 5257: artykuły i kategorie 200 bez błędów schematu; event 200 `stored:true`; zimny klient `pg` odczytał `playbook_key='day289-before'` i `event_data={"route":"/day289-before"}`.
- Końcowy fresh chain przeszedł; idempotencja: `Applying migrations: 0`.
- RealPG test przez Gateway: 2/2 PASS. Jednostkowy pakiet porównawczy: 24/24 PRZED i PO; `diff przed-nazwy.txt po-nazwy.txt` pusty.

Dowód mutacyjny: usunięto przez `apply_patch` tylko linię `ADD COLUMN ... article_id`, odbudowano bazę od zera i uruchomiono test z `--retry=0`: 1 PASS / 1 FAIL; przypadek zapisu otrzymał 500 zamiast 200. Po przywróceniu przez `cp` z katalogu scratch: 2/2 PASS. `git diff` nie zawiera mutacji.

## Pułapki (a)-(e)

- (a)-(d): jawnie ustawiono `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `DB_TYPE=postgres`, `MOCK_DB=false`, `RUN_DB_TESTS=1`, `ENABLE_TEST_AUTH_BYPASS=false`, `JWT_SECRET`; pierwszy test asertuje `DB_TYPE=postgres`.
- (e1): przyczyna była widoczna w logu serwera, nie w pustym body.
- (e2): baza zawsze po pełnych migracjach; runtime DDL usunięto.
- (e4): zimny readback wykonywał niezależny `pg`, nie `DbPromise`.
- (e5): główny dowód HTTP uruchomiono przez `tsx` i prawdziwy port, poza Vitest/global.fetch.
- Każda komenda testowa miała `--retry=0`.

## Z30

`env` → `BRAK ZMIENNYCH POCZTY`; `settings WHERE key LIKE 'smtp%'` → 0 wierszy; Gateway nie montuje drenaży.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Artefakty i SHA-256

- `before-http.log`: `3b9a3d799f92b58a6bd79b46cd544f8a939b67e0b1b1de3fa200d3742e14f98d`
- `after-http.log`: `062f1f40c2ba0e501b2494471a25a2e6cff61f1ed53050a1d9a71f42fc993ec2`
- `help-schema-mutated-red.json`: `abc8adff2c2e4d533ca54606e7010a6325b4337ec1ffbc65bc0f5e67283e9cf1`
- `przed-nazwy.txt` i `po-nazwy.txt`: `5bc2431ceb542f20d7ccc209afb2e98b2ab15d1bd3cd0814eeac5c113aad9167`

Katalog: `/private/tmp/cx-day289-martwe-trasy-artefakty`.

## Korekty wobec instrukcji

1. Teza „dwie funkcje widoczne” kontra sprostowanie/R4 „WatchingTab martwy”: pomiar potwierdził bezpieczniejszą interpretację R4; A nie jest powierzchnią użytkownika.
2. Instrukcja podaje dwie nazwy migracji (`20260903_help_articles_category_id.sql` i `20260903_help_schema_do_kodu.sql`). Zastosowano nazwę wynikającą z mierzonego zakresu i kolejności: `20260904_help_shape_alignment.sql`.
3. Commit-per-R1/R2 nie powstał, bo artefakty pomiarowe zgodnie z Z13 były poza repo; pierwszy commit zawiera kod, migrację i test, po czym natychmiast wykonano push. Pomiar jest utrwalony w tym raporcie.

## STOP — A / decyzja produktowa

Rodzaj: MERYTORYCZNY  
Powód: budowa agregatu watchers wymaga decyzji właściciela, a komponent nie ma żywego importera.  
Licencja, którą sprawdziłem: R4 i Z40 — zero kodu A; wynik: brak agregatu, komponent martwy.  
Dowód: 3 wołacze w `src`, 0 w `server/src`, realny 404, tylko importy własnej rodziny.  
Co dostarczyłem ZAMIAST zmiany: pełny inwentarz i jednoznaczny werdykt MARTWY.  
Co zrobiłbym po decyzji: osobny dyżur może usunąć rodzinę; jeśli właściciel chce ekran, potrzebny jest agregat, Bearer JWT, izolacja org i odbiór UI za flagą OFF.  
Rekomendacja: usunąć martwą rodzinę w już uruchomionym dyżurze nadzorcy; nie budować API bez decyzji.  
Stan: NIE ZACOMMITOWANO kodu A.  
Czy kontynuowałem: TAK — B zakończone.

## TWIERDZENIA NIEZWERYFIKOWANE

- Stan staging/demo/produkcji i danych tam istniejących — zakaz Z28.
- Zachowanie po integracji z tipem oddalonym o 39 commitów — scalenie należy do nadzorcy.
- Odbiór właściciela i wdrożenie — nie wykonywano.

## Zdania dla D5/D6

- D5: „Dyżur 289 potwierdził 3 martwe wołacze `/api/settings/watchers`, 0 tras i realny 404, ale obalił wpływ produktowy: `NotificationSettingsV2/WatchingTab` nie ma żywego importera; zero kodu A, do usunięcia jako martwa rodzina.”
- D6: „Dyżur 289 dodał addytywne wyrównanie pięciu kolumn, usunął runtime DDL i fałszywe sukcesy, mapuje payload `HelpContext`, a RealPG/Gateway RED→GREEN i zimny readback potwierdzają zapis; commit `820b8d0a5b`.”
