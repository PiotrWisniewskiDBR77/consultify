# CODEX DAY 336 — rozkład bramki G15

Stan dyżuru: `PARTIAL — POMIAR DOMKNIĘTY, DŁUG NIE NAPRAWIANY`
Marker pracy: `1c4b5a5635bafd38ef375227824ada9b62be186e`
Gałąź: `codex/day336-g15-rozklad-20260904`

## R0 — zasady wiążące

Przeczytałem zasadę, że wiersz macierzy może zmienić stan wyłącznie z dowodem załączonym w tym samym commicie. Przeczytałem też zakaz zamiany `PARTIAL_PASS` na `PASS` przez zawężenie kryterium; warstwa serwerowa pozostaje częścią mianownika G15.

## Stan wejściowy

Dosłowny wynik markera i sanity:

```text
MARKER OK
1c4b5a5635bafd38ef375227824ada9b62be186e
```

Warunki zasobowe: 55 GiB wolne po utworzeniu worktree; porty `6372` i `5512` nie miały listenera; licznik kontenerów `cx-day336` wyniósł `0`.

Korekta wobec instrukcji: na markerze pracy `f65c4ff6a0` jest przodkiem odległym o `661` commitów, a `35afcb15fd` o `598`, nie odpowiednio 662 i 599. Tip gałęzi bazowej jest o 7 commitów przed markerem pracy; lista rozbieżnych plików obejmuje dokumenty instrukcji 334–342 i rejestr znalezisk, bez zmian produktu objętego pomiarem.

Warunki wspólne PRZED pierwszym commitem: liście `pl=35198`, `en=33065`; `focus-canon=0`, `list-canon=0`, `artefakt=0`.

## R1 — dekodowanie podtypów

Pole statusu ma siedem dosłownych etykiet niezielonych, ale instrukcja grupuje dwa warianty `*_CONFIRMED` w jeden z sześciu typów semantycznych. Liczby zmierzono przez odczyt wiersza `G15` wszystkich 16 plików `MODULE_ACCEPTANCE.md`, normalizację czwartej kolumny i `sort | uniq -c`.

| Typ semantyczny | Liczba wierszy | Dosłowny cytat źródłowy | Kategoria | Warunek usunięcia etykiety |
| --- | ---: | --- | --- | --- |
| `RED_LEGACY_1` | 2 | „ta sama pełna nazwa czerwieni ToolCanvas na bazie i markerze (ZASTANA)” | DŁUG ZASTANY | Naprawić wskazaną czerwień produktu w osobnym, licencjonowanym dyżurze i ponowić pełny mianownik. |
| `RED_LEGACY_2` | 1 | „te same 2 pełne nazwy czerwone na bazie i markerze (ZASTANE)” | DŁUG ZASTANY | Naprawić oba nazwane przypadki w osobnym dyżurze i ponowić mianownik. |
| `RED_LEGACY_7` | 2 | „7 czerwieni ma parę i klasę ZASTANA” | DŁUG ZASTANY | Naprawić siedem nazwanych przypadków na moduł i ponowić odpowiednie warstwy. |
| `RED_LEGACY_2_PLUS_RED_NEW_1` | 1 | „2 ZASTANE i 1 NOWA (MYW-IDEAS-010) mają parę bazową” | MIESZANY: dług oraz stan nowej czerwieni do ponownego pomiaru | Zweryfikować `MYW-IDEAS-010`; dług zastany pozostaje do osobnego zlecenia. |
| `SERVER_NOT_MEASURED` | 5 | „front 418/418 zielone, zero czerwieni; […] serwer niezmierzony” | BRAK POMIARU | Uruchomić komplet serwerowych katalogów modułu z właściwym configiem, realnym PG i `--retry=0`; zero wykonanych testów nie zamyka braku. |
| `RED_LEGACY_N_CONFIRMED` (`N=1`: 3; `N=2`: 1) | 4 | „plików bazy nie skompilowało się […] co najmniej część […] jest ZASTANA” | BRAK POMIARU klasy; zawiera częściowo potwierdzony dług | Uruchomić te same pełne nazwy na kompilowalnej bazie i HEAD oraz nadać każdej klasę `ZASTANA`, `NOWA` albo `NIEORZECZONA`. |

Wniosek R1: podział autora jest zasadniczo potwierdzony, z doprecyzowaniem, że `RED_LEGACY_2_PLUS_RED_NEW_1` jest typem mieszanym, a `*_CONFIRMED` nie oznacza samego braku pomiaru — zawiera już potwierdzone czerwienie zastane, lecz nie pozwala sklasyfikować całego zbioru.

## R2 — 16 wierszy: dług kontra brak pomiaru

Poniższa tabela używa świeżej pary `f65c4ff6a0` (po jawnej kopii `PreviewAIHintStrip.tsx` z HEAD) ↔ HEAD i porównania `fullName`. Kolumna serwerowa opisuje stan pomiaru przed R3, zgodnie z wierszem macierzy; nie udaje, że brak pomiaru jest zielenią.

| Moduł | Stan wejściowy | ZASTANA | NOWA | NIEORZECZONA | Serwer wcześniej | Kategoria wejściowa | Co zamyka wiersz |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 01_ORGANIZATION | PASS | 0 | 0 | 0 | TAK | zamknięty | Brak działania. |
| 02_INTERVIEW | PARTIAL / LEGACY_7 | 0 | 1 | 0 | częściowo | mieszany | Rozstrzygnąć nową czerwień i pełny serwer; historyczna etykieta `LEGACY_7` jest nieaktualna. |
| 03_TOOLS | PARTIAL / LEGACY_1 | 1 | 0 | 0 | NIE | mieszany | Osobno naprawić ToolCanvas i wykonać serwer. |
| 04_ASSESSMENT | PARTIAL / SERVER_NOT_MEASURED | 11 | 0 | 0 | NIE | mieszany | Serwer oraz osobne zlecenie na 11 zastanych czerwieni bieżącego mianownika. |
| 05_INITIATIVES | NOT_MEASURED / CONFIRMED | 16 | 1 | 5 plików z błędem suity | NIE | mieszany | Serwer, rozstrzygnięcie błędów inicjalizacji, nowa czerwień; dług osobno. |
| 06_EXECUTION | NOT_MEASURED / CONFIRMED | 12 | 1 | 3 pliki z błędem suity | NIE | mieszany | Serwer, rozstrzygnięcie błędów inicjalizacji, nowa czerwień; dług osobno. |
| 07_MY_WORK_AGENT | PARTIAL / 2 LEGACY + 1 NEW | 2 | 2 | 3 pliki z błędem suity | NIE | mieszany | Zweryfikować obie nowe czerwienie, serwer; dług osobno. |
| 08_MEETINGS | NOT_MEASURED / CONFIRMED | 3 | 0 | 0 | NIE | mieszany | Serwer oraz osobna naprawa trzech zastanych czerwieni. |
| 09_RESULTS | PARTIAL / SERVER_NOT_MEASURED | 0 | 4 | 0 | NIE | brak pomiaru + nowe czerwienie | Serwer i rozstrzygnięcie czterech nowych czerwieni z testu flagi archiwum. |
| 10_FINANCE | PARTIAL / LEGACY_1 | 0 | 0 | 0 | NIE | brak pomiaru; etykieta długu nieaktualna | Wykonać serwer i usunąć nieaktualny podtyp dopiero z dowodem. |
| 11_MATERIALS | PARTIAL / LEGACY_2 | 2 | 0 | 0 | NIE | mieszany | Serwer oraz osobna naprawa dwóch zastanych czerwieni. |
| 12_AUDITS | PARTIAL / SERVER_NOT_MEASURED | 0 | 0 | 0 | NIE | wyłącznie brak pomiaru | Wykonać serwer. |
| 13_CHAT | PARTIAL / SERVER_NOT_MEASURED | 0 | 0 | 0 | NIE | wyłącznie brak pomiaru | Wykonać serwer. |
| 14_ADMIN | PARTIAL / LEGACY_7 | 7 | 0 | 0 | NIE | mieszany | Serwer oraz osobna naprawa siedmiu zastanych czerwieni. |
| 15_SETTINGS | PARTIAL / SERVER_NOT_MEASURED | 0 | 0 | 0 | NIE, lecz rejestr nie wskazuje ścieżki serwerowej | wyłącznie brak rozstrzygnięcia kryterium | Decyzja właściciela, czy brak serwera w mianowniku jest zamierzony; bez cichego zawężenia. |
| 16_PARTNER | NOT_MEASURED / CONFIRMED | 9 | 0 | 0 | NIE | mieszany | Pełny serwer i osobna naprawa dziewięciu zastanych czerwieni. |

Na stanie wejściowym wyłącznie na długu zastanym stoi `0` wierszy: każdy niezielony wiersz z długiem miał również serwer poza pełnym pomiarem albo nieorzeczoną część. Wyłącznie na braku pomiaru stały `2` wiersze (`12_AUDITS`, `13_CHAT`); `15_SETTINGS` wymaga decyzji o mianowniku i nie został doliczony. Jest to klasyfikacja wejściowa, nie końcowy werdykt po R3.

Imienna lista 63 świeżo potwierdzonych czerwieni zastanych znajduje się w `evidence/g15/day336-dlug-zastany.md`. Nowe czerwienie nie zostały przemianowane na dług.

## R3 — brakujące pomiary serwerowe

Kontener `cx-day336-pg` pracował wyłącznie na `127.0.0.1:6372/cx336`, obraz `pgvector/pgvector:pg16`. Pierwszy przebieg wykonał pełny łańcuch migracji i zakończył się `Postgres migrations complete`; drugi podał `Applying migrations: 0` i zakończył się poprawnie. Przed startem było 53 GiB wolnego.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Każdy poniższy pakiet uruchomiono z `cwd=server`, `--config vitest.config.ts`, `--retry=0`, realnym `DATABASE_URL`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` i lokalnym `JWT_SECRET`. W ten sposób wyłączono pułapki §0.2e(a)–(e): flaga V8 i enforcement były jawne, auth bypass był jawnie wyłączony, SQLite/mock zostały nadpisane, liczono `numTotalTests`, a mianownik pochodził wprost z R1 rejestru. Błędy suity przy zerze asercji pozostają błędami komendy, nie PASS.

| Moduł | Ścieżki serwerowe z mianownika | Total | Passed | Failed | Pending | Błędy pliku/suity bez czerwonej asercji | JSON |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 01 | `organizationContext/__tests__` | 18 | 18 | 0 | 0 | 3 | `01-organization-serwer.json` |
| 02 | `interview`, `interviewCandidate`, `interviewDelivery` | 63 | 51 | 2 | 10 | 0 | `02-interview-serwer.json` |
| 03 | `tools`, `toolCatalog`, `toolFreeze` | 27 | 21 | 0 | 6 | 1 | `03-tools-serwer.json` |
| 04 | `routes/assessment*`, `services/assessment*` | 113 | 113 | 0 | 0 | 0 | `04-assessment-serwer.json` |
| 05 | `services/initiative` | 125 | 124 | 1 | 0 | 0 | `05-initiatives-serwer.json` |
| 06 | `domain/initiatives-execution`, `services/execution*` | 101 | 101 | 0 | 0 | 0 | `06-execution-serwer.json` |
| 07 | `routes/my-work`, `services/myWork` | 43 | 41 | 2 | 0 | 0 | `07-my-work-serwer.json` |
| 08 | `services/meeting*` | 33 | 25 | 8 | 0 | 0 | `08-meetings-serwer.json` |
| 09 | `routes/resultsVnext`, `services/results*/**` | 567 | 136 | 413 | 18 | 2 | `09-results-serwer.json` |
| 10 | `routes/v8/finance-v2`, `services/finance` | 277 | 143 | 114 | 20 | 2 | `10-finance-serwer.json` |
| 11 | `materials`, `materialExport`, `presentationExport` | 64 | 59 | 1 | 4 | 1 | `11-materials-serwer.json` |
| 12 | `routes/audits`, `services/audits`, `services/auditProgram*` | 317 | 244 | 1 | 72 | 0 | `12-audits-serwer.json` |
| 13 | `chatHandoff`, `chatToSchema` | 67 | 67 | 0 | 0 | 0 | `13-chat-serwer.json` |
| 14 | `services/invitation` | 3 | 3 | 0 | 0 | 0 | `14-admin-serwer.json` |
| 15 | brak ścieżki serwerowej w R1 rejestru | 0 | 0 | 0 | 0 | — | `BRAK_POMIARU: brak mianownika` |
| 16 | cztery partnerowe pliki wskazane nazwą/semantyką w szerokich katalogach R1 | 7 | 7 | 0 | 0 | 1 | `16-partner-serwer.json` |

Pięć wierszy `SERVER_NOT_MEASURED`: `04` jest 113/113; `09` wykonał 567 przypadków, ale 413 jest czerwonych i 2 pliki nie wystartowały; `12` wykonał 317, z 1 czerwienią; `13` jest 67/67; `15` nie ma żadnej ścieżki serwerowej w rejestrze. Zatem brak pomiaru zamknął się maszynowo tylko dla 04 i 13; 09 i 12 zostały zmierzone jako czerwone, a 15 pozostaje nierozstrzygnięty z powodu pustego mianownika.

Wszystkie 542 wykonane czerwienie serwerowe na HEAD mają tę samą pełną nazwę czerwoną na naprawionej bazie (`2+1+2+8+413+114+1+1=542`), więc są `ZASTANE`; nie wykryto serwerowej czerwieni klasy `NOWA`. Osobno 10 plików/suit na HEAD nie wykonało czerwonej asercji i pozostaje `NIEORZECZONE/BŁĄD KOMENDY`. Pełne nazwy pozostają w JSON-ach poza repo; raport nie redukuje ich do samego exit code.

Pomiar zasięgu: agregat zawiera 7610 nazw przypadków; `przed-nazwy.txt` i `po-nazwy.txt` mają identyczny SHA-256 `537ad270840fb0af9fc23d17114ab77955d6c60433d91af1c30355bf50ea72f4`, a `diff` zakończył się kodem 0. Nie było zmian produktu ani testów między przebiegami.

Ścieżka artefaktów: `/private/tmp/cx-day336-g15-rozklad-artefakty`. Sumy SHA-256 serwerowych JSON-ów są w `evidence/g15/day336-r3-serwer.md`.

## R4 — klasy na kompilowalnej bazie

Założyłem bazowy worktree z `f65c4ff6a0` pod `/private/tmp/cx-day336-g15-rozklad-artefakty/baza`. Jedyna ingerencja polegała na skopiowaniu z HEAD pliku `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx`; `git status --short` przed usunięciem pokazywał wyłącznie ten zmodyfikowany plik. `PreviewAIHintStrip.tsx` oraz wszystkie 17 unikalnych plików zawierających czerwone asercje modułów 05/06/08/16 przeszły `esbuild`.

| Moduł | HEAD: pass/fail/pending | Baza: pass/fail/pending | ZASTANA | NOWA | NIEORZECZONA (plik nie wykonał czerwonej asercji) |
| --- | --- | --- | ---: | ---: | ---: |
| 05_INITIATIVES | 839/17/8 | 852/16/8 | 16 | 1 | 5 |
| 06_EXECUTION | 412/13/0 | 439/12/0 | 12 | 1 | 3 |
| 08_MEETINGS | 32/3/0 | 32/3/0 | 3 | 0 | 0 |
| 16_PARTNER | 141/9/0 | 141/9/0 | 9 | 0 | 0 |

Nowe pełne nazwy to w modułach 05 i 06 ten sam przypadek `InitiativesHub canonical intake navigation clears retired proposal context and links a scheduled initiative to Execution`. Każda pełna nazwa zastana znajduje się w `day336-dlug-zastany.md`; żadnej nie wywnioskowano z samej liczby. Osiem błędów plików w 05/06 pozostaje `NIEORZECZONA`, bo brak wykonanej asercji nie jest bazą do klasyfikacji.

Przed usunięciem bazowego worktree było 43 GiB wolnego, po usunięciu 45 GiB. `git worktree list` potwierdził `BRAK WORKTREE BAZOWEGO`.

## R5 — MYW-IDEAS-010 i cała rodzina

Commit `a995ca4c20 fix(mywork): extend candidate->initiative path beyond Process Flow (MYW-IDEAS-010)` jest przodkiem HEAD. Jego stat obejmuje 4 pliki, 68 insertions i 5 deletions: kod `IdeaMapWorkspace.tsx`, test kontraktowy oraz dwa dokumenty statusowe.

Ukierunkowany przebieg HEAD wykonał 4 przypadki: 3 PASS i 1 FAIL. Czerwona pełna nazwa brzmi: `MYW-IDEAS-010 candidate→initiative path is no longer tool-gated does not gate the floating candidate panel (mels/active render path) to activeTool === process_flow`. Asercja pada wcześniej na `activeBranchEnd > 0`, ponieważ tekstowy sentinel `\n  return (\n    <div\n      ref={workspaceRootRef}` nie występuje już w źródle. Jednocześnie behawioralny kontrakt `shows the candidate panel for any real idea in the active render path` przechodzi. Werdykt: naprawa produktu wygląda na obecną, ale w bramce nadal istnieje czerwony, kruchy kontrakt źródłowy; nie ma podstaw do usunięcia `RED_NEW_1` ani do wpisania PASS bez osobnego, licencjonowanego uporządkowania testu z dowodem mutacyjnym.

| Rodzina | Werdykt rejestru |
| --- | --- |
| MYW-IDEAS-008 | `ODLOZONE_DEC / DEC_OK / DEC-2026-09-03-372` |
| MYW-IDEAS-009 | `ODLOZONE_DEC / DEC_OK / DEC-2026-09-03-372` |
| MYW-IDEAS-010 | `NAPRAWIONE / SHA_OK / a995ca4c20` |
| MYW-IDEAS-011 | `ODLOZONE_DEC / DEC_OK / DEC-2026-09-03-372` |
| MYW-IDEAS-012 | `ODLOZONE_DEC / DEC_OK / DEC-2026-09-03-373` |
| MYW-IDEAS-013 | `ODLOZONE_DEC / DEC_OK / DEC-2026-09-03-372` |
| MYW-IDEAS-014 | `ZAMKNIETE_DEC / DEC_OK / DEC-2026-09-03-373` |
| MYW-IDEAS-CORE-001 | `ODLOZONE_DEC / DEC_OK / DEC-2026-09-03-373` |
| MYW-IDEAS-CORE-002 | `ODLOZONE_DEC / DEC_OK / DEC-2026-08-25-27` |

Artefakt: `/private/tmp/cx-day336-g15-rozklad-artefakty/r5-myw-ideas-010.json`, SHA-256 `f4595cc638e7a55f5a7b19fbe6569b3f96cb0a6f640e50a6b65be5578c856560`.

## Stan PRZED / PO 16 wierszy

| Moduł | PRZED | PO |
| --- | --- | --- |
| 01 | PASS | PASS, lecz świeży bieg ma 3 błędy suity serwera — stan wymaga niezależnego odbioru |
| 02 | PARTIAL / LEGACY_7 | bez zmiany; nowa czerwień front + 2 zastane serwerowe |
| 03 | PARTIAL / LEGACY_1 | bez zmiany; dług front + błąd suity serwera |
| 04 | PARTIAL / SERVER_NOT_MEASURED | bez zmiany; serwer 113/113, ale front ma 11 zastanych czerwieni |
| 05 | NOT_MEASURED / CONFIRMED | bez zmiany; klasy zmierzone, lecz dług/nowa/błędy pozostają |
| 06 | NOT_MEASURED / CONFIRMED | bez zmiany; klasy zmierzone, lecz dług/nowa/błędy pozostają |
| 07 | PARTIAL / 2 LEGACY + 1 NEW | bez zmiany; MYW-IDEAS-010 nadal 1 FAIL, druga nowa czerwień i dług |
| 08 | NOT_MEASURED / CONFIRMED | bez zmiany; 3 front + 8 serwerowych czerwieni zastanych |
| 09 | PARTIAL / SERVER_NOT_MEASURED | bez zmiany; 4 nowe front, 413 zastanych serwerowych, 2 błędy suity |
| 10 | PARTIAL / LEGACY_1 | bez zmiany; front 924/924, serwer 114 zastanych + 2 błędy suity |
| 11 | PARTIAL / LEGACY_2 | bez zmiany; 2 front + 1 serwerowa zastana, 1 błąd suity |
| 12 | PARTIAL / SERVER_NOT_MEASURED | bez zmiany; serwer zmierzony jako 1 czerwień zastana |
| 13 | PARTIAL / SERVER_NOT_MEASURED | PASS: front 462/462 + serwer 67/67 |
| 14 | PARTIAL / LEGACY_7 | bez zmiany; 7 zastanych front, serwer 3/3 |
| 15 | PARTIAL / SERVER_NOT_MEASURED | bez zmiany; brak serwerowej ścieżki w R1 wymaga decyzji |
| 16 | NOT_MEASURED / CONFIRMED | bez zmiany; 9 zastanych front i 1 błąd suity serwera |

## Korekty wobec instrukcji

- Dystanse wynoszą 661/598 commitów, nie 662/599.
- R1 rejestru nie zawiera ścieżki serwerowej dla Settings, mimo tezy instrukcji, że serwer należy do mianownika każdego modułu.
- Aktualny mianownik frontu różni się od historycznego; m.in. Assessment wykonuje 768, Chat 462, Results 419, a Finance 924/924.
- `MYW-IDEAS-010` figuruje jako naprawione, ale jego własny pakiet ma nadal 1 czerwoną asercję tekstową.
- Historyczne etykiety nie opisują aktualnego rozkładu: Interview ma nową czerwień, Finance nie ma już czerwieni frontowej, Results ma 4 nowe czerwienie frontowe.

## PYTANIA DO WŁAŚCICIELA O KRYTERIUM

1. Czy `15_SETTINGS` ma mieć warstwę serwerową w mianowniku G15, mimo że R1 rejestru wymienia wyłącznie dwa katalogi frontowe?
2. Czy potwierdzony dług zastany ma nadal blokować `PASS` G15, czy G15 ma raportować osobno regresję względem bazy i bezwzględną zieleń bieżącego mianownika?

## Werdykt

Pomiar G15 został wykonany bez zmian produktu. Jedyny bezspornie domknięty wiersz to `13_CHAT`; pozostałe nie zostały zazielenione przez zawężenie. Główny wynik falsyfikacyjny: brak pomiaru serwera ukrywał przede wszystkim 542 zastane czerwienie i 10 błędów uruchomienia, a nie prostą pulę zielonych testów.

## Mianowniki plików na HEAD

Zmierzona liczba plików testowych na moduł (front + wskazany serwer): `01=11`, `02=27`, `03=41`, `04=53`, `05=76`, `06=115`, `07=101`, `08=12`, `09=69`, `10=107`, `11=27`, `12=40`, `13=52`, `14=39`, `15=7`, `16=40`. Różnice względem rejestru historycznego są wynikiem pomiaru; Partner liczono na czterech imiennie dobranych plikach serwera, nie na całych szerokich katalogach.

Warunki wspólne PO ostatnich zmianach dokumentacyjnych: liście `pl=35198`, `en=33065`; `focus-canon=0`, `list-canon=0`, `artefakt=0`. Kontener `cx-day336-pg` usunięto przez `docker rm -fv`; po sprzątaniu było 45 GiB wolnego.

## TWIERDZENIA NIEZWERYFIKOWANE

- Czy kruchy tekstowy sentinel `activeBranchEnd` ma zostać naprawiony w osobnym dyżurze testowym, pozostaje decyzją poza licencją tego dyżuru.
