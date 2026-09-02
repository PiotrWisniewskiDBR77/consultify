# CODEX DAY268 — CZAT + MOJA PRACA — RAPORT ZRZUTÓW POD WERDYKT

## Stan wejściowy

- Gałąź: `codex/day268-czat-praca-zrzuty-20260901`; baza instrukcji: `df7f13056f`.
- Marker kolejki `7a733cb63d`: `GLOBAL MARKER OK`; marker instrukcji: `MARKER OK`.
- `git rev-parse HEAD` przed pracą: `df7f13056fa24995be07f64b0e8c877b3faeab45`.
- `git status --short | head -3` przed pracą: brak wyjścia.
- Dysk po utworzeniu worktree: `8.1 GiB` wolnego (> 5 GB).
- Porty 6276, 5256 i 5257 były wolne. PostgreSQL `pgvector/pgvector:pg16` działał wyłącznie na `127.0.0.1:6276/cx268`.
- Migracje: pierwszy przebieg `Postgres migrations complete`; drugi `Applying migrations: 0`, `Postgres migrations complete`.
- Tip bazy uciekł do przodu. Zgodnie z `DEC-2026-08-26-95` praca zaczęła się dokładnie z markera; scalenie późniejszych instrukcji pozostaje po stronie nadzorcy.

## Czat — R1/R2

`ConversationList.tsx:38-184` jest bespoke nawigacją: nie importuje `StandardTable` ani `StandardPreview`, grupuje własne `ConversationItem`. Reguła kanonicznego podglądu list nie stosuje się mechanicznie; właściwą relacją byłaby lista konwersacji → otwarty wątek.

Katalog deklaruje 14 typów `ChatActionType`. Osiem bez producenta w UI: `START_TOOL`, `OPEN_PREVIEW`, `ASSIGN_INTERVIEW`, `START_ARTIFACT_REVIEW`, `CHECK_TRUST_STATE`, `ANALYZE_STATEMENT`, `REVIEW_MODEL`, `CHECK_LANE_STATUS`. Wszystkie pozostają niefotografowalne, bo akcja nie może pojawić się użytkownikowi. Canvas pozostaje `NO_GO`; Run Agent (`AgentHubShell`) używa prawdziwego `StandardTable`+`StandardPreview`, ale jest poza zakresem.

Nie uruchomiono modelu językowego. Nie uruchomiono też kanonicznego pełnego runtime'u ani nie seedowano `conversation_messages`, więc liczba nowych zrzutów Czatu wynosi 0. Istniejący dowód dyżuru 223 został tylko zinwentaryzowany i nie jest przedstawiany jako nowy pomiar tego dyżuru.

| Ekran / stan | Osiągalny | Zrzut | Powód |
|---|---:|---:|---|
| Pusta/pełna lista konwersacji i otwarty wątek | tak | NIE | brak uruchomionego kanonicznego runtime'u |
| `execution_proposal` | tak, zmierzone wcześniej | NIE | brak nowego seedu i runtime'u |
| Feed Sygnałów pusty | tak | NIE | brak nowego runtime'u; stan znany jako `KNOWN_DECISION` |
| 8 typów akcji bez producenta | nie | nie dotyczy | brak producenta w UI |
| Canvas end-to-end | nie | nie dotyczy | `NO_GO` |
| Run Agent | tak | zakazane | moduł 17, poza zakresem |

## Moja Praca — R3/R4

Dodano licencjonowany ekran `day268-mywork-hub-zrzuty.tsx`, który montuje bezpośrednio realny `<MyWorkHub>`. Parametry `tab=` i `state=ready|empty` prowadzą do sześciu zamówionych zakładek oraz Vault. Stan danych ma kształt publicznych metod `Api`/`V8MyWorkApi`; globalny fallback fetch zwraca neutralne `{data:[],items:[]}` wyłącznie dla lokalnego harnessu.

| Powierzchnia | Mechanizm | Ready/empty | Light/dark | Otwarty podgląd |
|---|---|---:|---:|---:|
| Ideas | bespoke tabela; akcje korzystają z kontraktu StandardTable | tak | tak | NIEZWERYFIKOWANY |
| Notebook | `StandardTable` (`NotebookLibraryContent.tsx:346`) | tak | tak | NIEZWERYFIKOWANY |
| Inbox | `StandardTable` za flagą default OFF; bazowo bespoke | tak | tak | NIEZWERYFIKOWANY |
| Calendar | bespoke kalendarz | tak | tak | nie dotyczy |
| Tasks | `StandardTable` za flagą default OFF; bazowo bespoke | tak | tak | NIEZWERYFIKOWANY |
| Decisions | `StandardTable` (`DecisionsPanelContent.tsx:1672`) | tak | tak | NIEZWERYFIKOWANY |
| Vault | samodzielny ekran Sejfu | tak | tak | NIEZWERYFIKOWANY |

Cztery narzędzia Ideas są zakodowane jako `mindmap`, `whiteboard`, `process_flow`, `table` (`MyWorkHub.tsx:610-623`, `ideaSelectionTypes.ts`). Nie wykonywano ich osobnych kadrów.

Katalog artefaktów: `/private/tmp/cx-day268-czat-praca-zrzuty-artefakty`.

- 28 PNG: 7 powierzchni × ready/empty × light/dark.
- Każdy obraz ma 1440×1050 i unikalny SHA-256.
- Manifest: `SHA256SUMS.txt` w katalogu artefaktów.
- Przykładowa kontrola wizualna `mywork-ideas-ready-light.png` potwierdziła realny hub, paski zakładek i wiersz danych bez błędu renderu.

Pełny wynik `scripts/dev/check-devrender-main.sh`:

```text
✓ parsuje sie
✓ struktura spisu ekranow poprawna (kazdy wpis domkniety)
✓ wszystkie lazy-importy wskazuja na istniejace pliki
✓ brak zdublowanych kluczy
✓ kazdy leniwy import ma wpis w spisie
✓ kazdy wpis w spisie ma leniwy import
✓ liczba ekranow: 260 (podloga 259)
  • podloga podniesiona do 260
```

Automatyczna zmiana pliku podłogi została cofnięta, ponieważ nie jest licencjonowana.

## Form Builder — MYW-FORM-BUILDER

Kod i pomiar potwierdzają fałszywy sukces `toast.success('Form saved')` bez zapisu zaplecza w `IdeaTableTool.tsx:5061-5103`. Wymagana para „toast po Zapisz / pusty formularz po ponownym otwarciu” nie została wykonana. Nie naprawiano defektu i nie przedstawiono zwykłego stanu ready jako jego dowodu.

## Pomiar testów

Komenda instrukcji dla `scripts/dev/__tests__/day268-czat-praca-zrzuty-werdykt.test.mjs` zwróciła JSON z `numTotalTests: 0`. Zastany `vitest.config.ts` nie obejmuje tego pliku `.mjs`; to nie jest PASS. Nie zmieniono globalnej konfiguracji (`Z18`). Z tego powodu `przed-nazwy.txt` i `po-nazwy.txt` nie mogą być uczciwie przedstawione jako wykonany pomiar nazw.

Pułapki Z33: statyczny kontrakt nie przechodzi przez Gateway, auth, beta-visibility ani DB; `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` i `DB_TYPE` nie leżą na jego ścieżce. Brak uruchomionych przypadków pozostaje brakiem dowodu.

## Z30 — bezpieczeństwo wysyłki

`env | grep ...` → `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` → 0 wierszy; grep drenów w `Gateway.ts` → brak trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Twierdzenia niezweryfikowane

- Nowe zrzuty Czatu: empty/full, light/dark, otwarty wątek, `execution_proposal`, Feed Sygnałów.
- Kliknięte podglądy zakładek Mojej Pracy.
- Para dowodowa Form Buildera.
- Dwa selektory wyników asynchronicznych i `checkScreenshotPairState`.
- Mutacyjny dowód realności obu modułów; pliki produktu są w licencji tylko do odczytu.
- Zielona suita Vitest i porównanie pełnych nazw.
- Realny HTTP → ApiGateway → JWT → Postgres; zakres był zrzutowo-harnessowy i nie dodawał backendu.

## Korekty wobec instrukcji

1. Instrukcja wymaga mutacji widocznych elementów plików produktu, a tabela licencji oznacza `src/components/AIChat/**` i `src/components/MyWork/**` jako zakaz zapisu. Wybrano bezpieczniejszą interpretację: plików produktu nie zmieniono, brak mutacyjnego dowodu opisano.
2. Instrukcja podaje komendę Vitest dla `.mjs`, lecz zastany include uruchamia 0 testów. Nie przedstawiono tego jako PASS i nie zmieniono globalnego configu.
3. `check-devrender-main.sh` aktualizuje plik podłogi poza licencją. Aktualizację cofnięto po zachowaniu pełnego wyniku.
4. Teza „żaden dev-render nie montuje pełnego MyWorkHub” jest prawdziwa dla dosłownego grepu w `main.tsx`, lecz istniejące ekrany `mywork-calendar.tsx`, `mywork-inbox.tsx` i `mywork-idea-topbar.tsx` montują realny hub fragmentami. Nowy ekran zapewnia jeden wspólny parametr dla wszystkich zakładek.

## Werdykt

`CZĘŚCIOWO`: dostarczono 28 zweryfikowanych wizualnie i hashowanych zrzutów realnego huba Mojej Pracy oraz pełny inwentarz Czatu. Brak nowych zrzutów Czatu, otwartych podglądów, pary Form Builder, selektorów, dowodów mutacyjnych i uruchomionych przypadków testowych nie pozwala ogłosić pełnego DoD.
