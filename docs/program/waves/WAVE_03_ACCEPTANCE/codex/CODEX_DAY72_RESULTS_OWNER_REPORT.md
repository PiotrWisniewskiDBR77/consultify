# CODEX DAY 72 — Wyniki — pakiet odbioru właściciela G07–G10

Data: 2026-08-29  
Marker: `b57253c0397994d2acd7eb79dd56e874fe40c55a`  
Gałąź: `codex/day72-results-owner-20260829`  
Zakres: wyłącznie dowody i dokumentacja modułu `09_RESULTS`  
Werdykt: `PARTIAL / OWNER_REVIEW_PENDING / VISUAL_DEFECTS_RECORDED`

## Podsumowanie

Fixture i kanoniczny runtime są zielone na dokładnym markerze. Wykonałem i
obejrzałem **20 z 20** wymaganych zrzutów: 5 ekranów × 2 motywy × 2 prawdziwe
stany. Stan pełny pochodzi z organizacji OWNER, a pusty z osobnej organizacji
FOREIGN-OWNER bez danych. Nie relabelowałem pustych ekranów.

Pakiet wizualny nie uzasadnia `PASS` G08–G10. Wszystkie ekrany pozostają w
języku angielskim, pełne ROI i OKR Set pokazują techniczne identyfikatory, a
tabele ROI i OKR Set są ucięte po prawej stronie przy 1280×720. Defektów nie
naprawiałem (`Z40`). G07–G10 pozostają do decyzji właściciela.

## §0.1 — baza, marker i sanity

`df -h /`:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi   8.7Gi    58%    459k   91M    1%   /
```

Wynik kroku (2), dosłownie:

```text
b8fa285c83 docs: dyzury 72 (Wyniki) i 73 (Wykonanie) + DEC-277..279 dysk, przypiete migracje, wydanie
b57253c039 docs(ledger): DEC-271..276 AKCEPT wlasciciela UI Partnera + odbior 69/70/71 + licencja na stala migracji
b48dc4ddc4 merge: dyzur 70 proba 3 — trzeci STOP, stala 834 w seederze
8c33ea26ea merge: dyzur 71 — bramka C.1 zatrzymala ryzykowna zmiane, K4 FAIL
3b86048090 merge: dyzur 69 proba 2 — K4 zwolnione, ekran Prowizji po polsku, akcept wlasciciela
ee981c4212 fix(i18n): domknij polski interfejs partnera
33323504fb test(day71): measure schema isolation gate
da8192d837 docs(finance): record day70 third fixture stop
a4e3312908 docs(ledger): DEC-269/270 drugi STOP dyzuru 70 + poprawka nr 2
3b1f4af016 docs(instrukcje): POPRAWKA 2 dyzuru 70 — nazwa bazy consultify_w3_finance_owner_*, narzedzie zrzutow, porty chronione
6ecf9a3e21 merge: dyzur 70 proba 2 — drugi zasadny STOP (nazwa bazy narzucona przez harness)
11240d9c25 docs: DEC-266..268 odbior dyzuru 69, dwa znaleziska, licencja na testy pinujace
149b893184 docs(finance): record day70 corrected-seed stop
4ba28438d2 merge: dyzur 69 fala jezykowa — PARTIAL uczciwy, klasa B/D Partnera
b92528e223 docs(day69): zapisz czesciowy raport i dowody
edc11e3340 fix(i18n): rozpocznij fale jezykowa Partnera
85619fcb9e docs: DEC-264/265 odbior STOP-u dyzuru 70 + poprawka instrukcji u zrodla
1008976649 merge: dyzur 70 Finanse — zasadny STOP, raport i MODULE_ACCEPTANCE
7ebd967e10 docs(ledger): DEC-262 WYCOFANIE falszywego zarzutu wobec wykonawcy + DEC-263 kolejnosc macierzy
e85371d110 docs(instrukcje): dyzur 71 izolacja schematu testowego (48 plikow, bramka dowodowa)
590cc5e9a3 docs(finance): record day70 cleanup
ec129e83e3 docs(finance): finalize day70 evidence card
6ef8c3f08c docs(finance): record day70 owner fixture stop
5aca498cfd docs(ledger): DEC-259..261 odbior dlugu integracyjnego + przyczyna zrodlowa w infrastrukturze testowej
688b407e22 merge: raport dlugu integracyjnego (klasyfikacja 742/742, uczciwy NOT_PROVEN)
MARKER OK
```

Tip jest o jeden commit przed markerem. Wymagany log/diff rozjazdu:

```text
b8fa285c83 docs: dyzury 72 (Wyniki) i 73 (Wykonanie) + DEC-277..279 dysk, przypiete migracje, wydanie
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_72_WYNIKI_ODBIOR.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_73_WYKONANIE_ODBIOR.md
```

Krok (4):

```text
[core]
	bare = false
```

Wynik kroku (7), dosłownie:

```text
b57253c0397994d2acd7eb79dd56e874fe40c55a
```

Druga komenda kroku (7), `git status --short | head -3`, nie wypisała nic.

## §A — weryfikacja kontraktu seedera

W1–W3, dosłownie:

```text
23:if (!/^consultify_w3_results_owner_[a-z0-9_]+$/.test(dbName))
24:  throw new Error('Database name must match consultify_w3_results_owner_*');
138:  if (Number(mig.rows[0]?.count) < 800) throw new Error('Results DB is not migrated');
40:| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 8. Owner decisions remain pending. |
41:| G08 | First-impression review | `NOT_STARTED` | — |
42:| G09 | Guided CX journey review | `NOT_STARTED` | — |
43:| G10 | Alternate-state owner review | `NOT_STARTED` | — |
```

Porty `5944` i `4660` nie miały listenerów ani mapowań Dockera przed startem.

## B.1 — fixture, migracje i readback

Kontener: `cx-day72-pg`, obraz `pgvector/pgvector:pg16`, mapowanie wyłącznie
`127.0.0.1:5944:5432`, baza `consultify_w3_results_owner_day72`.

Pierwszy migrator zakończył się:

```text
→ 20260813c_method_core_roles_and_approvals.sql
→ init-pgvector.sql
✅ Postgres migrations complete
```

Drugi przebieg, dosłownie w części rozstrzygającej:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Niezależny pomiar właściwej tabeli:

```text
 applied_migrations
--------------------
                863
(1 row)
```

Pierwszy pomiar użył błędnej nazwy `migrations` i zwrócił
`ERROR: relation "migrations" does not exist`; poprawiłem wyłącznie komendę
pomiarową na kontrakt seedera `schema_migrations`, bez zmiany kodu i bazy.

Readback seedera, dosłownie:

```json
{"fixture":"wave3-results-owner-review-v1","seeded":true,"readback":{"kpi_points":2,"deviations":1,"receipts":1,"actuals":1,"reconciliations":1,"pirs":1,"approval_snapshots":1,"roi_pointers":1,"key_results":1,"checkins":1,"reviews":1,"visibility_rows":3,"roi_governance":1,"execution_graph":1,"execution_orphans":0},"manifestPath":"/private/tmp/cx-day72-artefakty/results-owner-fixture-manifest.json"}
```

Manifest ma tryb `0600` i SHA-256
`25fc2cbf31360ba7d3e5df28cba5d55df6ff52f430e7b694e90f38b746fa809a`.

## Z30 — brak wysyłki

Przed zapisem środowisko zwróciło `BRAK ZMIENNYCH POCZTY`; grep drenaży w
`server/src/Gateway.ts` zwrócił 0 trafień. Po migracjach:

```text
 key | left
-----+------
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Kanoniczny runtime uruchomił
`server/src/index.ts` z `DOTENV_DISABLED=1` i `DISABLE_SCHEDULER=true`; nie
uruchomiłem ręcznie żadnego drenażu outboxu. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane. Nie składam fałszywej dosłownej deklaracji z
§0.2b, jakobym nie uruchomił `index.ts`; konflikt opisuję w Korektach.

## B.2 — runtime i macierz zrzutów

Kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` adoptował fixture. Runtime
manifest potwierdza `health/readiness/frontend = 200/200/200`, dokładny SHA,
`migrations=863`, oba ledgery `ok`, `ENABLE_TEST_AUTH_BYPASS=false`, izolację
dotenv i brak zakazanych sekretów w procesach. SHA-256 manifestu runtime:
`71d776b94c06767fc70fb225a37ce0b6c5c3bafb1c7807407a7117dc19eab6d5`.

Wymiary każdego zrzutu: `1280×720`. Liczba zadeklarowana: **20**. Liczba plików
PNG na dysku: **20**.

| # | Ekran | Motyw | Stan | Co zobaczyłem |
|---:|---|---|---|---|
| 1 | KPI | dark | full | Angielskie menu/nagłówki/status/data; wartość KPI po polsku; surowy kod `DELIVERY_ON_TIME`; brak nakładania; czerwień `Model` bez semantyki krytycznej. |
| 2 | KPI | light | full | Jak #1; jasny styl działa; data `Aug 21, 2026`; brak ucięcia tabeli. |
| 3 | KPI | dark | empty | Zamierzona karta pustego stanu, ale cała po angielsku; brak surowego ID i kolizji. |
| 4 | KPI | light | empty | Jak #3; kontrast i układ czytelne. |
| 5 | ROI | dark | full | Angielskie nagłówki/status/data; tytuł po polsku; surowy UUID właściciela; prawa część daty ucięta. |
| 6 | ROI | light | full | Jak #5; `Updated`/data nadal ucięte; `PLN` jako kod waluty, bez kwoty do oceny formatu. |
| 7 | ROI | dark | empty | Zamierzony empty-state po angielsku; CTA widoczne; brak kolizji. |
| 8 | ROI | light | empty | Jak #7; czytelny kontrast. |
| 9 | OKR Programs | dark | full | Angielskie nagłówki/status; wartości techniczne `quarterly`, `zero_to_one`; brak ucięcia. |
| 10 | OKR Programs | light | full | Jak #9; czytelny układ. |
| 11 | OKR Programs | dark | empty | Zamierzony empty-state po angielsku; CTA widoczne. |
| 12 | OKR Programs | light | empty | Jak #11; czytelny kontrast. |
| 13 | OKR Cycles | dark | full | Angielskie nagłówki/status i format dat `Jul 1, 2026, 12:00 AM`; data łamie się na dwie linie, ale nie nachodzi. |
| 14 | OKR Cycles | light | full | Jak #13; trzy daty nie są w polskim formacie. |
| 15 | OKR Cycles | dark | empty | Zamierzony empty-state po angielsku; brak CTA w karcie, CTA globalne jest widoczne. |
| 16 | OKR Cycles | light | empty | Jak #15; brak kolizji. |
| 17 | OKR Sets | dark | full | Angielskie nagłówki/status/data; surowy skrócony UUID właściciela; kolumny od `Progress` są ucięte po prawej. |
| 18 | OKR Sets | light | full | Jak #17; widoczna tylko część nagłówka `PROGF…` i wartość `7…`; brak pełnej tabeli. |
| 19 | OKR Sets | dark | empty | Zamierzony empty-state po angielsku; nagłówki po prawej są ucięte. |
| 20 | OKR Sets | light | empty | Jak #19; kontrast czytelny, szerokość tabeli nadal wadliwa. |

### SHA-256 zrzutów

```text
180f95a8b3fb75dafff9bad9b0721e44d6f1a2243eb071ed491ac81040fff581  /private/tmp/cx-day72-artefakty/kpi-dark-empty.png
579dea4ce275f3c71efa14d0dfb3e51b649aae525e4e29d5d42d966a9c410b52  /private/tmp/cx-day72-artefakty/kpi-dark-full.png
812cdf715f8778917f3a9e74b83219adb5c21498941672195300d783b5579166  /private/tmp/cx-day72-artefakty/kpi-light-empty.png
962edfccc6312a77feac4d20919b893322698e67bddf08b4f9d1e754265381ce  /private/tmp/cx-day72-artefakty/kpi-light-full.png
3e4b2c2f4cd504688220db27fd00fc7c3749a2640285d3d9ff30ec7c3bf0655f  /private/tmp/cx-day72-artefakty/okr-cycles-dark-empty.png
8536359e9d9220984f4c7ed8561e634925fbdf31262ed305a73e957ea09614c9  /private/tmp/cx-day72-artefakty/okr-cycles-dark-full.png
33f93f0ee5406c6b2406573dd65474d7aefb5e43afcaa1eb27372b5a4934ffdd  /private/tmp/cx-day72-artefakty/okr-cycles-light-empty.png
c504c48721f536584ba5d6cf83e23221242acdea40a36792a2858d09250ff66c  /private/tmp/cx-day72-artefakty/okr-cycles-light-full.png
9a2edbaa929e0b1bb5d128ccee85095421cda205ffb860bab55e6199dcb04b98  /private/tmp/cx-day72-artefakty/okr-programs-dark-empty.png
71d9b0672f0ac81c087dccceb890c34427ff43ee94dd9559893f1c179a9df576  /private/tmp/cx-day72-artefakty/okr-programs-dark-full.png
7d23fa40f9c0eef1d4191b6ac82ddf5a38ed47d2c81187bb5363c636d0946f68  /private/tmp/cx-day72-artefakty/okr-programs-light-empty.png
bc93a867006cf3797bb98412ce9d410a790902d7ae8ff996324e18a4c7cb85aa  /private/tmp/cx-day72-artefakty/okr-programs-light-full.png
b5516f48486ba1ba98113623f57d694a81e8d19e79f944210904028b8627ee64  /private/tmp/cx-day72-artefakty/okr-sets-dark-empty.png
be528d63e566d11aee4afff930616fb4cff8169811c8db720a77205bf491bd9f  /private/tmp/cx-day72-artefakty/okr-sets-dark-full.png
d341f794037a10f0243e5426b50325838610201974929413f6ce26bb7ac9baeb  /private/tmp/cx-day72-artefakty/okr-sets-light-empty.png
82c2410ef2a64e08479c5077271338e2612de561ae02fac5c96bf1f83392830f  /private/tmp/cx-day72-artefakty/okr-sets-light-full.png
1cda1666be00474ea13ad5c995d4a4bf7e2160afbc90e317c83b82708d323713  /private/tmp/cx-day72-artefakty/roi-dark-empty.png
45355876971e57d3d40fd9e782074325ac2d1d9a7725772675f96fd2b1edb5e3  /private/tmp/cx-day72-artefakty/roi-dark-full.png
e3e21470b893460addffa0d137ff6d6a1a63ebc4799de43e40811512c055d0c2  /private/tmp/cx-day72-artefakty/roi-light-empty.png
7367a42aa7cd12d9fc901337b59a79b00106404d50c27fa47aad2083b1a9dc18  /private/tmp/cx-day72-artefakty/roi-light-full.png
```

## B.3 — znaleziska

1. `P0/P1 — LANGUAGE`: wszystkie 20 ekranów są w angielskim wariancie UI.
   Warunki i18n są widoczne m.in. w
   `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx:1510-1513`,
   `src/components/ResultsVNext/roi/ResultsRoiHub.tsx:642`,
   `src/components/ResultsVNext/okr/OkrProgramsPage.tsx:160-184`,
   `src/components/ResultsVNext/okr/OkrCyclesPage.tsx:173` i
   `src/components/ResultsVNext/okr/ResultsOkrHub.tsx:370`. Nie naprawiono —
   język jest terenem dyżuru 69.
2. `P0 — RAW IDENTIFIERS`: pełne ROI pokazuje UUID właściciela; pełne OKR Set
   pokazuje jego skrót. Renderer jawnie używa fallbacku ID w
   `src/components/ResultsVNext/okr/okrRegistryPresenters.tsx:103-116`.
3. `P0 — CLIPPING`: w obu motywach ROI ucina datę po prawej, a OKR Set ucina
   kolumny od `Progress`. Szerokości kolumn ROI są zadane m.in. w
   `src/components/ResultsVNext/roi/roiRegistryPresenters.tsx:128-154`, a OKR
   Set w `src/components/ResultsVNext/okr/okrRegistryPresenters.tsx:103-133`.
4. `P1 — RAW INTERNAL VALUES`: Programy OKR pokazują `quarterly` i
   `zero_to_one` bez prezentera; bezpośredni render jest w
   `src/components/ResultsVNext/okr/OkrProgramsPage.tsx:160-161`.
5. `P1 — LOCALE`: KPI/ROI/OKR pokazują daty `Aug/Jul/Sep` i czas z `AM`, nie
   polski format. Mapery dobierają `en-US`, gdy `isPolish=false`, m.in.
   `src/components/ResultsVNext/roi/roiRegistryMappers.ts:322` i
   `src/components/ResultsVNext/okr/okrRegistryMappers.ts:325`.
6. `P2 — CRIMSON`: kontrolka `Model` używa czerwieni na wszystkich ekranach,
   mimo że nie komunikuje stanu krytycznego. Jest to obserwacja wizualna z
   każdego zrzutu; pliku przekrojowego nie zmieniano.

Konsola przeglądarki po pełnej macierzy: `0` wpisów `warn/error`.

## Pułapki Z33 dla wykonanych dowodów

- Migracje/seed: pułapka (e) została wyłączona przez utworzenie bazy i dwa
  przebiegi migratora przed seedem; seeder potwierdził minimum 800, pomiar 863.
- Runtime/browser: (a) `ENABLE_V8_GLOBAL=true`; (b)
  `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` było obecne w komendzie
  startu; (c) runtime potwierdził realny PostgreSQL i 863 migracje; (d)
  manifest runtime potwierdził `enableTestAuthBypass=false`; logowanie było
  realne dla obu kont.
- Nie uruchomiono pakietu Vitest jako dowodu. Nie ma zatem twierdzenia o
  pokryciu testowym ani egzekucji pełnej macierzy uprawnień.

## Pomiar zasięgu testów — `NOT_PROVEN`

Instrukcja odsyła w Z24 do `§0.4a`, lecz dokument nie zawiera nagłówka ani
treści tej sekcji. Grep pełnej instrukcji znajduje wyłącznie trzy odwołania do
`§0.4a` (linie 130, 171, 286). Nie wymyśliłem selektora pakietów ani mianownika.
Wynik zasięgu testów: `NOT_PROVEN / EVIDENCE_MISSING_IN_INSTRUCTION`.

## Korekty wobec instrukcji

1. Konflikt: §0.2b mówi „nie uruchomić serwera pełnym `server/src/index.ts`”,
   a §B.2 wymaga `scripts/dev/start-wave3-owner-runtime.mjs`; narzędzie
   kanoniczne uruchamia `server/src/index.ts` w `start()` (kod około linii
   660). Wybrałem zamówiony runtime z jego bezpiecznym środowiskiem:
   `DOTENV_DISABLED=1`, `DISABLE_SCHEDULER=true`, brak SMTP, brak sekretów
   dostawców. Nie wpisałem nieprawdziwego zdania, że `index.ts` nie wystartował.
2. Z24 wymaga pomiaru „wg §0.4a”, ale §0.4a nie istnieje w 699-liniowym
   dokumencie. Zgodnie z regułą bezpieczniejszej interpretacji nie zgadłem
   zakresu i oznaczyłem go `NOT_PROVEN`.
3. Instrukcja podaje twardy mianownik pięciu ekranów, ale nie wymienia ich
   nazw. Zastosowałem pięć kanonicznych list jawnie wymienionych w G05 modułu:
   KPI, ROI, program, cycle i OKR set. Jest to mierzalny, nieposzerzony zakres.

## NIEZWERYFIKOWANE

- Piotr nie wykonał jeszcze first-impression, guided CX ani alternate-state
  review; G08–G10 nie są akceptacją właściciela.
- Nie wykonano tablet/mobile, klawiatury, czytnika ekranu ani pełnej macierzy
  uprawnień; mobile jest jawnie poza zakresem.
- Nie wykonano mutacji ani dowodu mutacyjnego; raport nie używa `FIXED`,
  `VERIFIED` ani `ZROBIONE_WG_DoD` dla defektów.
- Nie ma wyniku testowego §0.4a, ponieważ sekcja nie istnieje.

## Kryteria końcowe

| Kryterium | Wynik |
|---|---|
| K1 readback | `PASS` — zielony readback seedera, 15 pól zgodnych |
| K2 liczba zrzutów | `PASS` — 20 zadeklarowanych i 20 plików, każdy z SHA-256 |
| K3 każdy obejrzany | `PASS_WITH_FINDINGS` — 20/20, ze stylami, dwoma motywami |
| K4 tylko dokumentacja | `PASS` — dokładnie raport Day 72 i MODULE_ACCEPTANCE |
| K5 MODULE odzwierciedla wynik | `PARTIAL / OWNER_REVIEW_PENDING` |

Zdanie końcowe: wykonano i obejrzano **20 z 20** zrzutów, ale pakiet pozostaje
`PARTIAL`, ponieważ ujawnia istotne defekty języka, identyfikatorów i szerokości
tabel, a decyzje właściciela G08–G10 nie zapadły.

## Końcowy K4 po pierwszym commicie

Commit dokumentacyjny: `61b902b046bd2d47b9891f7cb3cc009d739db4a7`.

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY72_RESULTS_OWNER_REPORT.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md
```

`git status --short` po commicie nie wypisał nic. Nie ma zmian w `src/`,
`server/src/`, seederach, migracjach ani globalnej infrastrukturze testowej.
