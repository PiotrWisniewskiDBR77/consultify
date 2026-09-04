# Dyżur 347 — przyczyna czerwieni 403

Data: 2026-09-04  
Marker: `6a4919f72db338e7f49a2cacb3787d20cc649883`  
Gałąź: `codex/day347-403-przyczyna-20260904`  
Werdykt: **PRZYCZYNA POTWIERDZONA DLA 09_RESULTS; TEZA 415/415 OBALONA DLA 10_FINANCE; 401 Z 542 CZERWIENI ZNIKNĘŁO**

## Stan startowy i rozjazd tipa

Dosłowny wynik markera:

```text
6a4919f72d fix(day341,342): przenies testy spod src/ do tests/ — bezpiecznik osiagalnosci zielony
MARKER OK
6a4919f72db338e7f49a2cacb3787d20cc649883
```

Tip `github-backup/grafika/m03-20260902` był nowszy od markera. Zgodnie z `DEC-2026-08-26-95` praca pozostała dokładnie na markerze; nadzorca scala nowszy tip przy odbiorze. Na starcie było 24 GiB wolnego, po materializacji 9.6 GiB; wszystkie dalsze pomiary pozostawały powyżej progu 5 GiB.

## R0 — trzy twarde zasady

Przeczytałem i stosowałem zasadę, że każda zmiana dotykająca koperty wymaga pary dowodów: obcy nadal 403, właściciel 200/201. Przeczytałem i stosowałem zakaz naprawiania pojedynczych testów zamiast wspólnej przyczyny. Przeczytałem i stosowałem porównania wyłącznie po pełnych nazwach `fullName`, nie po samych liczbach.

Żaden commit nie zmienia kodu `resultsInternalBetaVisibility.middleware.ts`; `git diff 6a4919f72d..HEAD -- server/src/middleware/resultsInternalBetaVisibility.middleware.ts` jest pusty. Commity dyżuru i ich `git show --stat` są przytoczone w sekcji „Commity”.

## R1 — 542 czerwienie i kubełki

`evidence/g15/day347/przed-nazwy.txt` zawiera 542 unikalne wiersze `moduł | plik | fullName`.

| Kubełek | Liczba |
| --- | ---: |
| `expected 403 to be X` | 415 |
| `expected 503 to be X` | 19 |
| `RESULTS_INTERNAL_BETA_VISIBILITY_DENIED` w asercji kodu | 12 |
| `createArtifactViaHttp failed` | 20 |
| `TypeError` / `undefined` | 46 |
| `ENOENT` | 5 |
| Reszta | 25 |
| **Suma** | **542** |

W `10_FINANCE` potwierdzono kaskadę: 31 `TypeError` po braku obiektu oraz 20 `createArtifactViaHttp failed: 403 {"success":false,"code":"ORG_MEMBERSHIP_REVOKED"}`. To 51 skutków wcześniejszego nieudanego przygotowania danych, nie 51 samodzielnych defektów.

Plik-świadek `roiFinanceSeam.routes.test.ts` miał 25/26 FAIL. Jedyny zielony przypadek — `POST /visibility-policy maps RoiVisibilityGovernanceActorNotAuthorizedError to 403` — oczekiwał 403, więc przechodził na przedwczesnym 403 koperty bez dojścia do mockowanego serwisu. Pełna analiza: `evidence/g15/day347/r1-analiza.md`.

## R2 — rozstrzygnięcie przyczyny

Migracje: pierwszy przebieg 894, drugi 0; oba `Postgres migrations complete`. `okr.routes.test.ts`, cwd `server/`, realny PG, `--retry=0`, dwa przebiegi różniące się jedną zmienną:

| Wariant | Total | PASS | FAIL |
| --- | ---: | ---: | ---: |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | 118 | 0 | 118 |
| zmienna nieobecna | 118 | 118 | 0 |

Hipoteza jest **potwierdzona** dla izolowanych kontraktów Results. Decydująca gałąź to `server/src/middleware/resultsInternalBetaVisibility.middleware.ts:27-32`, a odczyt zmiennej jest w linii 29. Z 19 pakietów Results tylko 3 zawierają lokalny opt-out/mock koperty; 16 nie. Pełna rodzina 19 Results + 28 Finance: `evidence/g15/day347/r2-rodzina.tsv`.

## R3 — jedna naprawa i nienaruszona koperta

Wybrano drogę C: w istniejącym rejestrze G15 rozdzielono pomiar koperty (`enforce`) od izolowanych kontraktów tras (bez `enforce`). Odrzucono A, ponieważ powieliłoby opt-out w kilkunastu plikach; odrzucono B jako zmianę charakteru jednostkowych kontraktów tras w testy integracyjne; D nie było potrzebne. Nie zmieniono produktu, ról ani globalnej infrastruktury testów.

| Dowód | Przed | Po |
| --- | ---: | ---: |
| koperta mounted PG | 4/4 PASS | 4/4 PASS |
| pięć Day46 real ApiGateway/PG | 77/77 PASS | 77/77 PASS |

Para statusów z realnego `ApiGateway`, podpisanego JWT i realnego `organization_members`: `ACTIVE OWNER|ADMIN` → **200**; `MEMBER|CONSULTANT|GUEST` → **403** i `RESULTS_INTERNAL_BETA_VISIBILITY_DENIED` (60/60 przypadków).

Mutacja zabezpieczenia: dopisanie `MEMBER` do `ALLOWED_RESULTS_ROLES` dało 2/4 FAIL; przywrócenie przez `cp` dało 4/4 PASS; końcowy diff middleware był pusty. Artefakty: `evidence/g15/day347/r3-*`.

## R4 — przed/po po nazwach

| Zniknęły | Zostały z wejściowych | Pojawiły się | Bieżące czerwienie |
| ---: | ---: | ---: | ---: |
| 401 | 141 | 1 | 142 |

Pełna tabela trzech kolumn: `evidence/g15/day347/r4-tabela-trzech-kolumn.tsv`. Pełny diff: `evidence/g15/day347/r4-przed-po.diff`. `po-nazwy.txt` ma 142 wiersze. Wszystkie 15 modułów zachowały łącznie mianownik 1825: 1551 PASS, 142 FAIL, 132 pending.

- `09_RESULTS`: 567 total, 535 PASS, 12 FAIL, 20 pending — spadek 413 → 12, czyli zniknęło 401 nazw;
- `10_FINANCE`: 277 total, 143 PASS, 114 FAIL, 20 pending — brak spadku;
- pozostałe 13 modułów: pełny kontrolny przebieg, bez zgaszenia mianownika.

Jedyna pojawiona nazwa to timeout Interview: 2005 ms wobec `<2000`; natychmiastowy recheck bez zmiany kodu dał 2/2 PASS. Nie została ukryta ani zaliczona do naprawionych.

## Korekty wobec instrukcji

1. Teza „415 z 415 czerwieni 403 ma jedną przyczynę” jest częściowo obalona. Jedna przyczyna usuwa 401 czerwieni Results; 114 Finance, w tym 59 komunikatów z 403, pozostaje i wskazuje m.in. `ORG_MEMBERSHIP_REVOKED`, nie kopertę Results.
2. Pierwszy wspólny przebieg Day46 bez RN-G6 wykonał 65 PASS i 12 pending; nie został uznany za dowód. Po kanonicznym lokalnym seedzie wykonano pełne 77/77 przed i po.
3. Polecenie utworzenia symlinka zgłosiło istniejący wpis wewnątrz celu, ale kontrola wykazała, że `node_modules` w worktree jest prawidłowym symlinkiem do dozwolonego źródła; status repo pozostał czysty.
4. Tip gałęzi bazowej był nowszy od markera; zgodnie z instrukcją praca wystartowała z markera i nie wykonano rebase.

## R5 — dług, regresja, nieorzeczone

Baza `f65c4ff6a0`; 26/26 plików czerwonych przeszło `esbuild`. Wynik po dokładnym `fullName`:

| Klasa | Liczba |
| --- | ---: |
| ZASTANA | 139 |
| REGRESJA | 2 |
| NIEORZECZONA | 1 |
| **Suma** | **142** |

Regresje: niestabilny timeout Interview oraz `roiFinanceSeam.routes.test.ts | POST .../finance-reconciliations 201s on success`. NIEORZECZONA: cleanup `fixtureGenerator.pg.test.ts`, ponieważ na bazie był `skipped`. Pełna imienna tabela: `evidence/g15/day347/r5-klasy.tsv`; pełny dług zastany: `evidence/g15/day347/dlug-po-naprawie.md`.

Bazowy worktree usunięto; wolne miejsce wzrosło z 8.3 do 8.6 GiB.

## §0.2e — wyłączenie pułapek dla uruchomionych pakietów

| Pakiety | Pułapki i dowód wyłączenia |
| --- | --- |
| R2 `okr.routes.test.ts` | (a) `ENABLE_V8_GLOBAL=true`; (b/e) dwa przebiegi jawnie różniące tylko `enforce`; (c) `MOCK_DB=false DB_TYPE=postgres` + DSN 6394; (d) auth bypass false; 118 przypadków po obu stronach |
| Koperta acceptance + Day46 | (a) V8 true; (b/e) `enforce`; (c) real PG 6394 i RN-G6; (d) auth bypass false; 4 oraz 77 wykonanych, zero pending po seedzie |
| R4 moduły 01–08, 11–14, 16 | (a) V8 true; (b) koperta nie jest przedmiotem, zachowano `enforce`; (c) real PG; (d) bypass false; każdy JSON podaje niezerowy total |
| R4 `09_RESULTS` | (a) V8 true; (b/e) brak `enforce` jest świadomym opt-outem izolowanych kontraktów, zabezpieczenie bronione osobno; (c) real PG; (d) bypass false; 567 total |
| R4 `10_FINANCE` | identyczny wariant korekty dla testu rodzinnej hipotezy; brak wpływu: 277 total i nadal 114 FAIL; osobne dowody koperty pozostały z `enforce` |
| R5 baza | te same dwa warianty co R4; 26 plików najpierw skompilowano; klasyfikowano tylko nazwy wykonane po obu stronach, skipped → NIEORZECZONA |

Każda komenda testowa miała `--retry=0`. Każdy test DB miał jawny DSN `127.0.0.1:6394/cx347` w tej samej linii.

## CO NADAL WYMAGA OSOBNEGO ZLECENIA

Pełne 139 nazw długu znajduje się w `evidence/g15/day347/dlug-po-naprawie.md`; 142 nazwy wraz z klasami w `r5-klasy.tsv`. Szacuję co najmniej 10 rodzin naprawczych, nie 142 niezależne poprawki:

1. Finance RBAC/membership i przygotowanie artefaktu (największa rodzina; m.in. 20 `approveRbacGate`, 15 lifecycle, 31 wtórnych TypeError);
2. Finance comments/saved views/compare/cross-tenant/valuation — kilka podrodzin kontraktu i fixtur;
3. Results inventory/visibility migrations i read-surface;
4. pojedyncza regresja `roiFinanceSeam` 201;
5. Meeting boundary (8 nazw);
6. Interview migracje dokładnie-once/published assignment i niestabilny timeout;
7. My Work org isolation (2);
8. Initiative lifecycle (1);
9. Materials policy lock (1);
10. Audits cleanup append-only (1, obecnie NIEORZECZONA względem bazy).

To jest realny promień pracy: dominujący licznik 542 zawierał 401 powtórzeń jednej przyczyny oraz 51 błędów kaskadowych Finance.

## PYTANIA DO WŁAŚCICIELA

Czy zatwierdzasz jako trwałą regułę G15 rozdzielenie wariantu pomiarowego: `enforce` obowiązkowo dla dowodów koperty/uprawnień, a brak `enforce` dla izolowanych kontraktów tras bez fixtury członkostwa — **tak/nie**?

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano produkcji, stagingu, demo, Railway ani żadnej zdalnej bazy; były jawnie poza zakresem.
- Nie ustalono jednej przyczyny 114 czerwieni Finance; wskazano rodziny i kaskady, ale wymagają osobnego zlecenia.
- Nie rozstrzygnięto stabilności timeoutu Interview; pojedynczy recheck był zielony, lecz nie jest badaniem statystycznym.
- Nie rozstrzygnięto cleanup Audits na bazie, bo przypadek był pominięty.
- Nie wykonano UI, eksportu ani testów urządzeniowych; dyżur dotyczył wyłącznie serwera.

## Zero wysyłki i izolacja

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Nie wykonano połączeń do Railway, demo, stagingu ani produkcji. Jedyna baza to efemeryczny `cx-day347-pg` na `127.0.0.1:6394/cx347`.

## Commity

- `aca1828db7` — R1 analiza (1 plik, 47 linii);
- `eb11e0996d` — R1 pełne 542 nazwy (1 plik, 542 linie); osobny commit, ponieważ `*.txt` jest ignorowane i wymagało `git add -f`;
- `4bb335d870` — R2, dwa JSON-y i rodzina 47 pakietów;
- `2160db138c` — R3, korekta rejestru + dowody przed/po i mutacja;
- `c4e198f4cb` — R4, 15 JSON-ów, pełny diff i tabela trzech kolumn;
- `4f62e62b4e` — R5, 139 nazw długu i 142 klasy.

Żaden z tych commitów nie dotyka kodu koperty; jedyna mutacja kodu była tymczasowa, cofnięta przez `cp` i miała pusty diff przed commitem.

