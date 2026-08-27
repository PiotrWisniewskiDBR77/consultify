# Wywiad dzień 44 — martwe warstwy, izolacja najemcy, trzy flagi do akceptu — raport dyżuru 2026-08-28

Gałąź: `codex/interview-day44-20260828` · baza: `b151977e4b` · Poziom ukończenia: `CZĘŚCIOWO`

Kontener: `cx-day44-pg`, port `5811` · harness dev-render: nieuruchomiony

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Przed pełnym odczytem instrukcji wykonałem w chronionym checkoutcie `pwd`, `git status`, `git remote -v`, `git fetch github-backup codex/day44-instrukcja-20260828` i odczyt instrukcji przez `git show`. Po odczytaniu `Z5` nie wykonywałem tam dalszych operacji poza dozwolonym symlinkiem `node_modules` do odczytu. Pracę wykonałem w `/private/tmp/consultify-interview-day44` z osobnego klonu kontrolnego.

## Oświadczenie o zakazie `git stash` (Z27)

Nie wykonałem żadnej operacji `git stash`. Wynik końcowy `git stash list`: pusty.

## Dowód celu połączenia (Z20/Z25/Z26/Z28)

Host nie ma klienta `psql` (`command not found`), dlatego wykonałem równoważny odczyt wewnątrz własnego kontenera:

```text
current_database | inet_server_addr | inet_server_port
cx_day44         | 127.0.0.1        | 5432
```

## Weryfikacja erraty §1.2

1. POTWIERDZAM: `22/22` metod klienta v4 i `0/22` wołaczy poza `src/services/api.ts`.
2. CZĘŚCIOWO POTWIERDZAM: router ma `27/27` tras; publiczna trójka i klient `publicInterview.ts` zostały potwierdzone lekturą, bez nowego przebiegu E2E Day 44.
3. POTWIERDZAM: `0/6` tras candidate-handoff ma klienta w `src/`; trafienia bez Finance to `3/3` komentarze manifestu.
4. POTWIERDZAM: `interview_findings` występuje w żywym `20260719_baseline_gap.sql`.
5. POTWIERDZAM: router candidate-handoff ma `6/6` tras.
6. POTWIERDZAM lekturą: na markerze router nie deklarował `router.use` ani `verifyToken`; `Gateway.ts` montował wcześniej chroniony `/api/interview`.
7. POTWIERDZAM lekturą: trzy flagi istnieją; `.env.example` nie deklaruje `VITE_INTERVIEW_*`.
8. NIEZWERYFIKOWANE: nie zbudowałem dwóch brakujących ekranów harnessu.
9. POTWIERDZAM pomiarem kanonu: `394/394`, `171` plików, `1/11` hubów z legacy menu.
10. POTWIERDZAM lekturą: test aliasu używa pomiaru tekstowego; nie przepisałem go.
11. CZĘŚCIOWO: zmierzyłem rodziny `27/27` i `6/6`; nie policzyłem sam pozostałych `151` tras.
12. POTWIERDZAM lekturą: v4 pobiera organizację z walidowanego kontekstu; nie wykonałem pełnej macierzy mutacyjnej D.4.
13. POTWIERDZAM: nie wystawiłem panelu ani oceny `/10`.

## Warunki wstępne — dwanaście komend

| Punkt | Wynik własny                                                | Stan   |
| ----- | ----------------------------------------------------------- | ------ |
| a     | `27` tras v4                                                | ZGODNE |
| b     | `6` tras candidate-handoff                                  | ZGODNE |
| c     | komentarz `api.ts:19320`; `22` stringi `interview-v4`       | ZGODNE |
| d     | mounty `Gateway.ts:1351,1357,1361,1373`                     | ZGODNE |
| e     | legacy chain `34-38`; candidate-handoff bez własnego chaina | ZGODNE |
| f     | v4 chain `171-174`                                          | ZGODNE |
| g     | `3/3` pliki flag; `0` deklaracji w `.env.example`           | ZGODNE |
| h     | `394/394`, `171` plików, `1/11`, exit `0`                   | ZGODNE |
| i     | `20260719_baseline_gap.sql`                                 | ZGODNE |
| j     | brak migracji `20261250-20261269`                           | ZGODNE |
| k     | bezpiecznik `tests/setup.ts:384-398` obecny                 | ZGODNE |
| l     | `retry: process.env.CI ? 3 : 1`                             | ZGODNE |

## Marker i rozejście

`git merge-base --is-ancestor b151977e4b origin/codex/m03-admin-20260824` dał `MARKER OK`. Tip wynosił `6df39f226`. Rozejście obejmowało 12 commitów po markerze i pliki DRD/ledger; nie scalałem go.

## Migracje pełnym runnerem

Pierwsza komenda dosłowna z instrukcji odmówiła lokalnego hosta poza testem. Powtórzyłem pełny runner z `NODE_ENV=test`: `855` zastosowanych. Drugi przebieg: `0` nowych. Nie zmieniłem resolvera.

## Bramka wejściowa i inwentarz konsumentów

Wyniki: `27/27` tras v4, `6/6` tras candidate-handoff, `22/22 BRAK` wołaczy metod klienta, candidate-handoff w `src/` ma tylko `3/3` komentarze niezwiązane z klientem, kanon `394/394`, rozejście niepuste. Inwentarz konsumentów jest pełny dla `22/22` metod klienta, ale nie został zapisany per ścieżka dla wszystkich `33/33` tras; status `CZĘŚCIOWO`.

## Pozycje

| Pozycja | Commit      | Status      | Dowód osiągalności                            | Dowód testowy             |
| ------- | ----------- | ----------- | --------------------------------------------- | ------------------------- |
| D.1     | brak        | NIE_ZACZĘTE | brak macierzy `27/27`                         | brak                      |
| D.2     | brak        | CZĘŚCIOWO   | pomiar konsumentów `22/22`                    | brak tabel A-D            |
| D.3     | `a289f60c0` | CZĘŚCIOWO   | Gateway → auth → router → handler → realny PG | `7/7 PASS`                |
| D.4     | brak        | NIE_ZACZĘTE | brak pełnej macierzy N1-N6                    | brak                      |
| D.5     | brak        | NIE_ZACZĘTE | brak zrzutów                                  | brak                      |
| D.6     | brak        | CZĘŚCIOWO   | kanon przed `394/394`                         | brak pomiaru wizualnego   |
| D.7     | brak        | CZĘŚCIOWO   | pięć kształtów rozpoznane lekturą             | brak pięciu pełnych tabel |
| D.8     | brak        | NIE_ZACZĘTE | brak audytu trzech seedów                     | brak                      |
| R.1     | `193bd53e5` | CZĘŚCIOWO   | wpis `INT-PF-004`                             | odnosi się do `7/7`       |
| R.2     | bieżący     | CZĘŚCIOWO   | ten raport                                    | kontrola zakresu poniżej  |

## Pięć kształtów fałszywego „gotowe"

| Kształt                       | Wynik                      | Dowód                                                         | Adresat                              |
| ----------------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| Backend ma / front nie woła   | TAK                        | `0/22` wołaczy v4; brak klienta dla `6/6` handoff             | decyzja właściciela / dyżur frontowy |
| Zapis bez czytelnika          | NIEZWERYFIKOWANE           | nie wykonano śledzenia pięciu tabel do UI                     | kolejny dyżur 44                     |
| Ekran działa / baza pusta     | NIEZWERYFIKOWANE           | nie uruchomiono trzech powierzchni                            | kolejny dyżur 44                     |
| Nigdy nie zadziałało E2E      | CZĘŚCIOWO OBALONE dla auth | real Gateway + PG, `7/7 PASS`                                 | dyżur 44                             |
| Metryka zepsuta z konstrukcji | TAK                        | `interviewAliasRedirect.test.ts` używa `readFileSync/indexOf` | dyżur frontowy                       |

## Tabele werdyktów

Nie powstały kompletne tabele A-D, więc nie nadaję im statusu DoD. Zero werdyktów `USUŃ`.

- Publiczne `3/27` tras v4: roboczy werdykt `PODŁĄCZ` — mają istniejącego klienta i ekran, ale brak nowego pełnego dowodu Day 44.
- Uwierzytelnione `24/27` tras v4: `DO_DECYZJI_WLASCICIELA` do czasu D.1 i czterech dowodów.
- Candidate-handoff `6/6`: `DO_DECYZJI_WLASCICIELA` w sprawie podłączenia; auth został lokalnie utwardzony.
- Metody klienta `22/22`: `DO_DECYZJI_WLASCICIELA`; brak wołaczy nie spełnia sam wymogów `USUŃ`.

## D.3 — łańcuch uwierzytelnienia

Na markerze router nie miał własnego chaina. Po zmianie deklaruje lokalnie `apiAuthRateLimiter → verifyToken → requireOrgAccess() → demoContextMiddleware`. `Gateway.ts` pozostał bez zmian. Przez realny Gateway wszystkie `6/6` anonimowych kształtów tras zwróciły `401`, z niezależnym readbackiem liczby `initiative_candidates` bez zmian. Ważny token OWNER dotarł do handlera i zwrócił uczciwe `404` dla brakującego submission. Nie udowodniłem licznikiem idempotencji podwójnego rate-limitera ani dynamicznie nie odizolowałem wcześniejszego mountu; D.3 pozostaje `CZĘŚCIOWO`.

## D.4 — izolacja

Nie wykonano macierzy N1-N6 ani kierunków mutacyjnych A/B. Nie wolno z tego raportu wyprowadzać twierdzenia o braku wycieku. Znaleziska P0: `0` potwierdzonych / zakres niewykonany.

## D.5 — flagi

Nie włączyłem żadnej flagi. Żadna wartość domyślna nie została zmieniona. Nie powstały zrzuty ani karty akceptu; trzy decyzje właściciela pozostają otwarte.

## D.6 — kanon

Pomiar przed: `394/394` naruszeń, `171` plików, `1/11` hubów z legacy menu, exit `0`. W diffie nie ma zmian `src/` ani `dev-render/`, więc nie dodano czerwieni, tabel, menu ani preview.

## Pomiar testów (Z24)

Marker: `383 PASS / 9 FAIL / 5 SKIPPED` w `43` plikach (`397` przypadków). HEAD wraz z nowym testem: `390 PASS / 9 FAIL / 5 SKIPPED` w `44` plikach (`404` przypadki). Wprowadzone czerwone: `0/9`; wszystkie `9/9` były zastane. Każdy przebieg miał w tej samej linii `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres ENABLE_V8_GLOBAL=true DATABASE_URL=...127.0.0.1:5811...` oraz `--retry=0`. ZASIĘG PEŁNY dla minimum §0.4a plus nowy dotknięty test. NIE przepisałem liczb z `MODULE_ACCEPTANCE.md` ani z wcześniejszego raportu — zmierzyłem sam.

## Errata i korekty wobec instrukcji

- Instrukcja nie istnieje na markerze, choć końcowa komenda każe ją grepować. Nie dodałem drugiego nowego dokumentu wbrew `Z14`.
- Lokalny `psql` nie jest zainstalowany; użyłem klienta z własnego kontenera.
- Runner migracji wymagał `NODE_ENV=test` dla lokalnego hosta.
- Pierwsza próba `prettier` na `MODULE_ACCEPTANCE.md` zmieniła 111 linii dla jednego wpisu. Wycofałem własny commit i dodałem wpis w stylu zastanym, zgodnie z wyjątkiem §0.3.

## Pozycje otwarte

Nie postawiłem formalnego STOP-u. D.1, D.2, D.4-D.8 są jawnie nieukończone albo częściowe; nie brakowało licencji z §1.7, więc formalny STOP byłby niezasadny.

## Twierdzenia niezweryfikowane — czego NIE udowodniłem, choć napisałem

- Nie udowodniłem zachowania `27/27` tras v4 na realnym Gateway i PG; wymaga testu D.1.
- Nie udowodniłem izolacji tenantowej N1-N6 ani kontroli mutacyjnej A/B na trasach D.4.
- Nie udowodniłem idempotencji podwójnego `verifyToken` i rate-limitera pomiarem liczników.
- Nie udowodniłem, że trzy flagowane powierzchnie są czyste w light/dark ani identyczne przy OFF.
- Nie udowodniłem idempotencji, jakości i cleanup trzech seedów.
- Nie udowodniłem kompletu czterech przesłanek dla żadnego `USUŃ`.

## Licznik

`0/10 ZROBIONE_WG_DoD · 4/10 CZĘŚCIOWO · 0/10 STOP · 0/10 BRAK_API · 0/10 BRAK_POTRZEBY · 6/10 NIE_ZACZĘTE`.

## Kontrola zakresu i cleanup

`Gateway.ts`: diff `0` linii. `server/src/middleware/`, `.env.example`, `tests/setup.ts`, `vitest.config.ts`: diff `0` linii. Flagi: diff pusty. Trzy zapytania pozostałości przed cleanupem: `interview_sessions 0`, `interview_findings 0`, `initiative_candidates 0`. Port `3352` był wolny. `docker rm -fv cx-day44-pg` zwrócił nazwę `cx-day44-pg`; późniejszy `docker ps -a --filter name=^/cx-day44-pg$` był pusty.

## Gotowość

Gałąź nie jest gotowa do scalenia jako pełny Day 44. Zawiera wąskie utwardzenie auth z realnym testem oraz jawny raport częściowy. Nie zawiera wizualiów, pełnych werdyktów ani dowodu izolacji.
