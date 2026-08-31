# CODEX DAY 199 — karty wyników KPI / OKR / ROI

Data: 2026-08-31  
Marker: `60581ed6b5`  
Gałąź: `codex/day199-karty-wynikow-20260831`  
Wynik: **R1 ZROBIONE; R2 ZROBIONE; R3a PARTIAL; R3b PARTIAL; OWNER REVIEW OPEN**

## 0. Baza i zasoby

Instrukcję z recovery vaulta przeczytano w całości (1083 linie), stan `WYDANY`.

```text
60581ed6b5054e3218f7bc33d6e2a32794fb2af8
```

`git status --short | head -3` po utworzeniu worktree: brak wyjścia. Marker:

```text
60581ed6b5 odbior 196: ODESLANY — cicha luka R4 (pola kart puste) + grep-test R1; FIX-196 wydany
MARKER OK
```

Tip `github-backup/codex/m03-admin-20260824` był do przodu; diff markera do tipa nie dotykał plików implementacji dyżuru 199. Zasoby przed startem: porty `6129`, `5068`, `5069` wolne; Docker nie mapował żadnego z nich (`3 z 3`). Dysk: 19 GiB wolne. Worktree utworzono wyłącznie z vaulta.

## 1. Pomiary T1–T7 i korekty

- KPI: 8 sekcji; dokładnie 2 wejściowe `hasData:false` (`scorecards`, `history`).
- Obie trasy istniały, a front nie miał wołaczy: `GET /kpi/scorecards/for-kpi/:kpiId` oraz `GET /kpi/:kpiId/history`.
- OKR: 6 zakładek; Objectives/KRs/check-ins to jeden drill-down.
- ROI: 4 fazy o licznikach `6/2/5/3`, razem 16.
- OKR: 15 tabel `okr_vnext_*`, 0 tabel `rvn_okr_*`.
- Flagi bez zmian: KPI default-on poza publiczną produkcją, OKR/ROI default-off; parametry adresu pozostają mechanizmem odbioru.
- Seed wejściowy nie zawierał insertów do powierzchni wymienionych w R3a.

Korekty wobec instrukcji:

1. R3a nazywa zbiór „piętnaście tabel”, ale jawna lista zawiera **16** tabel (scorecard i item są osobnymi pozycjami). Pomiar `information_schema` potwierdził 16.
2. Dwie z 16 pozycji nie mogą dostać legalnego wiersza w zamkniętej licencji: `rvn_kpi_recovery_actions` ma FK do `kpi_recovery_cards`, którego seed nie tworzy i którego tabela nie jest licencjonowana; `okr_vnext_alignments` wymaga drugiego objective (`source_objective_id <> target_objective_id`), którego również nie wolno dodać. Nie obchodzono FK i nie rozszerzono licencji. Pozostałe 14 tabel dostało dane i readback.
3. Pierwszy HTTP reverse lookup KPI zwrócił `200/0`, mimo obecności scorecard i item. Przyczyna: brak `kpi_scorecard` w `rvn_platform_resource_visibility`. Fixture rozszerzono o jawny rekord widoczności, bazę zresetowano i zasiano od zera; ponowny wynik to `200/1`.
4. Narzędzie zrzutowe utworzyło pliki nazwane `results-vnext-roi-full-tool`, ale obraz przedstawia rejestr ROI, nie pełną kartę. R3b nie jest zaliczone dla ROI.

## 2. R1 — kontrakt 30 sekcji

Commit `66ae764a2e`. Dokument `docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md` zawiera 30/30 wierszy: KPI 8, OKR 6, ROI 16. Każdy ma definicję komponentu, metodę i pełną ścieżkę API, montaż w `Gateway`, wołacza, tabele, stan pusty, stan błędu i werdykt.

Jawne wyniki inwentarza:

- `correctiveActions` per KPI = `DO_ZBUDOWANIA`; istnieje tylko odczyt per deviation case;
- bez konsumenta pozostają `GET /kpi/:kpiId/trend` i `GET /kpi/:kpiId/next-obligation`;
- KPI ma inną powłokę niż OKR/ROI;
- rejestry nie mają double-click; OKR/ROI zachowują query string, KPI polega na mechanizmie flagi. Tych rozbieżności nie naprawiano poza licencją.

## 3. R2 — scorecards i historia KPI

Commit `77eb754f72`.

Zmierzony kontrakt odpowiedzi:

- scorecards: `200 { scorecards: KpiScorecard[] }`;
- history: `200 { entries: KpiHistoryEntry[], nextCursor: string | null }`, gdzie entry ma `entryId`, `occurredAt`, `kind`, `summaryCode`, `actorUserId`, `sourceVersion`, `references`.

Podział klientów jest zgodny z sąsiadami domenowymi: `listKpiScorecardsForKpi` w `kpiScorecardApi.ts`, `getKpiHistory` w `kpiApi.ts`. W komponencie nie ma bezpośredniego `fetch`. Obie sekcje mają loading, uczciwy empty, jawny error i listę danych; `hasData` wynika z liczby wierszy. Usunięto cztery nieprawdziwe bloki komentarzy (nagłówek + sekcje).

Dowód komponentowy (`--retry=0`):

```text
4/4 PASS
day199 ... honest empty state for scorecards
day199 ... scorecard data
day199 ... honest empty state for KPI history
day199 ... immutable KPI history entries
```

Dowód mutacyjny Z32:

- URL scorecards zmieniono na `/for-kpi-broken/…` → `2 PASS / 2 FAIL` (oba testy scorecards czerwone);
- plik przywrócono przez `cp` → `4 PASS / 0 FAIL`;
- `diff` kopii z plikiem po cofnięciu: brak wyjścia.

## 4. R3a — fixture, SQL i HTTP

Commity `1a4eb2b75c`, `077638fc06`.

Readback seeda po pełnym resecie potwierdził po 1 wierszu dla: corrective actions, initiative impacts, scorecards, scorecard items, assumptions, cost lines, benefit lines, benefit evidence links, scenarios, calculation policy, forecast versions, variances, OKR support requests i reflections. `visibility_rows=4`, `execution_orphans=0`. Brakujące recovery action oraz alignment pozostają `EVIDENCE_MISSING` z powodów FK/licencji opisanych wyżej.

Migracje:

```text
pierwszy przebieg: ✅ Postgres migrations complete
drugi przebieg: Applying migrations: 0
runtime: migrations=870, migrationState=ok, sqlMigrationState=ok
```

Kanoniczny runtime `adopt-existing` potwierdził SHA `077638fc066c0f931d75d631a0b0b3f0788a57df`, bazę `127.0.0.1:6129/consultify_w3_results_owner_cx199`, brak auth bypass i wyłączony dotenv. Podpisany login i GET-y przez realny `ApiGateway`:

```text
LOGIN_HTTP=200
KPI_HTTP=200 scorecards=1
OKR_HTTP=200 set=1
ROI_HTTP=200 case=1
```

## 5. Z30 — zero wysyłki

Przed testami: `BRAK ZMIENNYCH POCZTY`; `Gateway.ts` nie zawiera drenaży. Po migracjach, po seedzie i po runtime tabela `settings` zwracała 0 kluczy `smtp%`. Manifest runtime potwierdził `prohibitedKeysAbsentInOwnedGroupProcesses=true`.

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.”

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.”

Runtime służył również read-only HTTP. Został zatrzymany przez ten sam starter; potwierdzenie: owned process groups terminated, porty wolne, baza zachowana.

## 6. R3b — zrzuty

Katalog: `/private/tmp/cx-day199-karty-wynikow-artefakty/evidence/grafika/199-karty-wynikow/`. `git status` dla `evidence/`: czysto. Wszystkie 6 plików obejrzano wzrokiem.

```text
015f6879b68d087f78761f7b696f13fac9f6ac8e941b5d3ef003a8280df16d9d  results-vnext-kpi-tool__PO__dark.png
0a9b9a1fa66fdd9a97e12101a01a1e2dbfc1930dadac2377649ab32c63fdb36b  results-vnext-kpi-tool__PO__light.png
0a08fb7af495ed15dd81bc54005dc8a9a0c4ec59380b7ba470d93d072f5ec632  results-vnext-okr-workspace__PO__dark.png
c5e745451f91c692fca3a39fe0d0c48ea779d4d217898a1c2a7a4e1239fa1739  results-vnext-okr-workspace__PO__light.png
88f778357e12f27ab11cd679dd62f594fa5d3707ba14199d61d040865e59da55  results-vnext-roi-full-tool__PO__dark.png
caedf5cbbac5044bbc76d434751d900ea5e2ccae4bb28f12694ded9ceb48d47b  results-vnext-roi-full-tool__PO__light.png
```

KPI i OKR: oba motywy czytelne, bez uszkodzonego layoutu; KPI ma pełne menu ośmiu sekcji. KPI run zgłosił po 2 błędy konsoli na motyw — nie ukrywam tego. ROI: oba pliki są wizualnie rejestrem z jednym wierszem, nie pełną kartą, mimo nazwy ekranu; nie są dowodem orkiestracji full tool.

Każdy screenshot z harnessu dowodzi **wyglądu renderowanego stanu stubowego**, nie danych ani ścieżki backendowej. Dowodem danych jest SQL readback + realne HTTP z §4.

## 7. Pomiar nazw testów

Przed: 198 pełnych nazw, `154 PASS / 7 FAIL / 37 pending`. Po: 202 pełne nazwy, `159 PASS / 6 FAIL / 37 pending`. Zbiór nie utracił żadnej nazwy; dodano dokładnie 4 nazwy Day 199. Pakiet zbiorczy nie jest ogłoszony jako PASS — zawiera zastane testy realdb uruchamiane bez DB oraz zastane problemy; dowodem R2 jest osobny pakiet 4/4.

Pułapki: pakiet R2 jest czysto komponentowy i mockuje granicę `Api`, więc nie dowodzi Postgresa, JWT ani beta guard. Realne HTTP było uruchomione w development przez kanoniczny runtime z prawdziwym JWT i bez testowego bypassu, dlatego pułapki `ENABLE_TEST_AUTH_BYPASS`, `NODE_ENV=test` i samowyłączająca się beta nie dotyczą tego przebiegu. Seed i migracje używały wyłącznie jawnego lokalnego `DATABASE_URL`.

Artefakty nazw: `przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff`, `day199-r2*.json`, `przed.json`, `po.json` leżą poza repo w katalogu artefaktów.

## 8. TWIERDZENIA NIEZWERYFIKOWANE

- Kontrakt R1 obejmuje wszystkie 30 zmierzonych sekcji, nie próbkę. Każdy prefiks routera sprawdzono w `Gateway`; nie wykonywano 30 osobnych GET-ów, dlatego działanie każdej pojedynczej trasy nie jest udowodnione runtime’em.
- Liczba 30 zgodziła się z pomiarem: KPI 8 + OKR 6 + ROI 16.
- Sprawdzono dodatkowe seedy `seed-results-full-demo.ts` i `seed-results-module.ts` wyłącznie inwentarzowo w zakresie istnienia; nie uruchamiano ich i nie przyjmowano ich jako dowodu tego fixture’u.
- Wszystkie 6 PNG obejrzano wzrokiem. Dwa ROI nie przedstawiają pełnej karty; R3b ROI pozostaje nieudowodnione.
- Nie zmierzono pełnego browser F5/render z realnym backendem dla nowych sekcji KPI. Test komponentowy dowodzi callera i renderu, a runtime GET dowodzi backendu; ich połączenie w realnej przeglądarce pozostaje do odbioru.
- `rvn_kpi_recovery_actions` i `okr_vnext_alignments` nie zostały zasiane, bo wymagają rodziców poza licencją; R3a nie jest 16/16.

## 9. Pliki i commity

```text
66ae764a2e docs(results): define KPI OKR ROI card contract
77eb754f72 fix(results): connect KPI scorecards and history
1a4eb2b75c feat(results): expand owner review fixture
077638fc06 fix(results): expose seeded scorecard to owner review
```

Po każdym commicie wykonano push wyłącznie na `github-backup/codex/day199-karty-wynikow-20260831`. Zero pushu na `origin`, zero Railway, zero zdalnych baz.

Sprzątanie: `docker rm -f -v cx-day199-pg` zwróciło `cx-day199-pg`; własny kontener i jego anonimowy wolumen usunięto. Końcowy `git status --short`: brak wyjścia przed dopisaniem tej noty.
