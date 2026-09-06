# P12 — raport wykonania DEC-424

Stan: **PARTIAL — implementacja i bramki kodu/bazy są zielone; brak dowodu zrzutem po faktycznie wykonanej mutacji na karcie.**

## 1. Pomiar wejściowy

- Marker: `8d1600d530e19888fd9ae9d2a979017ce4eacc83`; `github-backup/codex/m03-admin-20260824`: `bfbada085e07af513b8ea79d8a216f042540f9ce`; `MARKER OK`.
- Worktree utworzony procedurą §0.1, HEAD markera, 12 GiB wolnego miejsca, `core.bare=false`.
- Stanowisko przed pracą: HTTP 200, baza `connected`.
- Testy zastane przed zmianą: 9 plików, 93/93 PASS (`evidence/p12-statusy/testy-baza.txt`).
- Przed migracją: 82 inicjatywy, 13 statusów; runtime-v1: 5 rekordów `APPROVED_BACKLOG`.

Pełna definicja CHECK zmierzona przed jakąkolwiek migracją:

```sql
CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PENDING_REVIEW'::text, 'REVIEW'::text,
'PROMOTED'::text, 'PLANNING'::text, 'APPROVED'::text, 'SCHEDULED'::text,
'EXECUTING'::text, 'BLOCKED'::text, 'DONE'::text, 'TRACKING'::text,
'CANCELLED'::text, 'ARCHIVED'::text])))
```

## 2. Progi przed → po

| Miara §7 | Przed | Po | Pomiar |
|---|---:|---:|---|
| pięć starych literałów w `src/components/Initiatives` | 50 / 12 plików | 0 | dokładny `grep` z §7, bez testów |
| trasy piszące status poza silnikiem | 7 | 0 | miejsca wskazane w §7; pozostałe trafienia są komentarzami historycznymi |
| kopie słownika 13 wartości | 7 | 0 | ręczny SSOT + wygenerowany reeksport |
| wartości DB spoza 7 kodów | 13 kodów wejściowych | 0 | `GROUP BY status` i negacja słownika |
| drugi przebieg migracji | n/d | 0 aktualizacji | komunikat `UPDATE 0` |
| `validateInitiativeStatus` | 1 | 0 | `grep -rn` |
| `labelPL` w SSOT serwera | obecne | 0 | `grep -n` |
| stare enumy w kodzie produkcyjnym serwera | obecne | 0 | `rg InitiativeStatus.<stary kod>`, bez testów |
| `primary-[0-9]` w dotkniętych plikach | n/d | 0 | `grep` po diffie |
| przejście spoza macierzy / bez roli | dozwolone | odrzucone | testy macierzy i capability |
| RealPG fixture po `afterAll` | n/d | 0 inicjatyw, 0 organizacji | niezależny SQL po teście |
| check-list-canon | dług 361 | dług 361 | pełny fallback scan, exit 0 |

Bloki i18n PL/EN są kanoniczne dla siedmiu statusów inicjatywy; pliki przechodzą `JSON.parse`. Świadome wystąpienia nazw podobnych statusów w innych domenach nie są słownikiem inicjatyw.

## 3. Migracja danych

Pierwsza próba została w całości wycofana: zastany ścisły CHECK odrzucił nowy kod `IN_EXECUTION`. Kolejność „zdejmij stary CHECK dopiero po backfillu” jest niewykonalna przy zmierzonej definicji. Migracja utrzymuje ochronę bez przerwy: w jednej transakcji dodaje przejściowy CHECK na sumę słowników, zdejmuje stary, wykonuje backfill, dodaje docelowy CHECK i usuwa przejściowy.

Pierwszy skuteczny przebieg: `UPDATE 58`; drugi: `UPDATE 0`.

| Status zastany | Status docelowy | Wiersze |
|---|---|---:|
| DRAFT | DRAFT | 19 |
| PENDING_REVIEW, REVIEW, PROMOTED, PLANNING | PENDING_APPROVAL | 16 |
| APPROVED, SCHEDULED | APPROVED | 12 |
| EXECUTING, BLOCKED | IN_EXECUTION | 23 |
| DONE, TRACKING, ARCHIVED | CLOSED | 9 |
| CANCELLED | REJECTED | 3 |

Po migracji: `APPROVED=12`, `CLOSED=9`, `DRAFT=19`, `IN_EXECUTION=23`, `PENDING_APPROVAL=16`, `REJECTED=3`; brak `PROPOSED` wynika z danych. `on_hold=true`: 6; `archived=true`: 1. Docelowy CHECK zawiera dokładnie 7 kodów. Plik: `20262103_p12_initiative_status_slownik.sql`.

## 4. Procedura dla stagingu

Codex nie łączył się ze stagingiem. Operator stagingu powinien: wykonać backup; zmierzyć aktywny CHECK przez `pg_get_constraintdef`; zmierzyć rozkład statusów; uruchomić standardowy runner z plikiem `20262103_…`; zweryfikować dokładnie 7 kodów, flagi i 0 wartości spoza słownika; uruchomić runner drugi raz i wymagać 0 zmian; dopiero potem uruchomić smoke realnych tras. Rollback operacyjny wymaga odtworzenia backupu, ponieważ mapowanie wielu starych kodów do jednego jest nieodwracalne.

## 5. Mutacje RED → GREEN

| # | Mutacja zabezpieczenia | Dowód RED | Po przywróceniu |
|---:|---|---|---|
| 1 | usunięcie roli z wiersza macierzy | `dec424TransitionMatrix.test.ts` | 13/13 PASS |
| 2 | ADMIN omija warunek merytoryczny | `gatesAndValidation.test.ts` | 5/5 PASS |
| 3 | `blockInitiative` wraca do surowego UPDATE | `InitiativeController.dec424Adapters.test.ts` | 3/3 PASS |
| 4 | usunięcie mapowania `EFFECTIVENESS_REVIEWED` | `statusMapping.dec424.test.ts` | 3/3 PASS |
| 5 | usunięcie guardu statusu KPI | trzy testy `KPI_NOT_APPROVED` | 11/11 PASS |
| 6 | usunięcie warunku idempotencji migracji | drugi przebieg niezerowy/RED | przywrócone `UPDATE 0` |

Każda mutacja została wykonana pojedynczo, dała RED i została przywrócona przed dalszą pracą.

## 6. Dowody zachowania

- RealPG: własne losowe `orgId` i `initiativeId`; 7 kodów zaakceptowanych, `EXECUTING` odrzucone przez CHECK (`23514`), flagi utrwalone, sprzątanie 0/0. `evidence/p12-statusy/testy-po.txt`.
- Zrzut 01: realna trasa `/initiatives`, 1440, light, kolumna Status oraz otwarty filtr z siedmioma polskimi nazwami; URL nie jest `/login`, 401=0.
- Zrzut 02: realna trasa karty tej samej inicjatywy, status „Zatwierdzona” i dostępne przejście „Rozpocznij realizację”; URL nie jest `/login`, 401=0.
- Zrzut 03: realna trasa `/execution`, ta sama inicjatywa i status „Zatwierdzona”; URL nie jest `/login`, 401=0.
- Nie wykonano mutacji rekordu demonstracyjnego. Dlatego 02 dowodzi renderowania kontrolowanego przejścia, ale nie spełnia literalnie wymogu „karta z wykonanym przejściem”; stan pozostaje PARTIAL zamiast fałszywego COMPLETE.
- Esbuild per każdy dotknięty plik TS/TSX: exit 0. Vitest per plik: 20 plików, 121/121 PASS, w tym RealPG 2/2.
- Zastane 9 nazw plików testowych pozostało; oczekiwania starego 13-statusowego kontraktu zaktualizowano świadomie do DEC-424. Po zmianie ten zestaw ma 70/70 PASS.

## 7. Commity

1. `5f05eb9fe4` — SSOT siedmiu statusów.
2. `1300e26b85` — generowany kontrakt frontendu.
3. `404a988dd1` — macierz i warunki przejść.
4. `564764f9a7` — adaptery kontrolerów.
5. `6c522e3aa9` — generowanie szkiców przez silnik.
6. `a20a40d507` — akcje menedżera przez silnik.
7. `6b408f1629` — usunięcie martwego walidatora.
8. `baa4906d62` — jedna funkcja mapowania runtime-v1.
9. `8d77200fb3` — migracja danych i CHECK.
10. `7d9900ef76` — R3: tylko zatwierdzony KPI.
11. `adc8f2c016` — kanoniczne statusy na powierzchniach UI.
12. Commit domykający — zgodność runtime, dowody, RealPG i raport (SHA po utworzeniu commitu).

## 8. Granice i znaleziska

- Nazwa `20262103_…` jest ostatnia w fazie datowanej, ale runner ma późniejsze fazy `late/unordered`; pytanie zapisano w `99_DECYZJE_WLASCICIELA.md`.
- Nie zmieniono istniejących migracji, flag env ani środowisk staging/demo/prod. Nie wykonano push.
- Pełny model około 12 statusów pozostaje poza zakresem jako Fala 2.
