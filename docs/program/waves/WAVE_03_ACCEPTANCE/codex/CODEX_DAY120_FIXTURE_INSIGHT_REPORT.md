# CODEX DAY 120 — fixture Insightu Wywiadu

Data: 2026-08-29  
Gałąź: `codex/day120-fixture-insight-20260829`  
Marker: `86eeb60fb3fd6343536e6a8f0fbddfb63acf5a0e`  
Pierwszy commit kodu: `a1215a8fbb`  
Werdykt: `FIXED / MIERZALNE 6 Z 6 / OWNER ACCEPTANCE PENDING`

## 0. Wejście i tożsamość

Dokument instrukcji miał stan `WYDANY`. Praca odbyła się wyłącznie w
`/private/tmp/cx-day120-fixture-insight`, utworzonym z bare-vaulta. Katalog
właściciela nie był czytany ani zmieniany; jedyny kontakt to dozwolony symlink
`node_modules`.

Wolne miejsce przed startem: `31 GiB` (wymagane co najmniej `5 GiB`). Porty
`6003`, `4906`, `4907`: `3 z 3` wolne.

Wynik markera, dosłownie:

```text
63b5f8e64b docs(day118-120): fala naprawcza 2
86eeb60fb3 merge: dyzur 117 — kontrakt statusu naprawiony, ekran wola nieistniejaca trase
...
MARKER OK
```

Wynik sanity worktree, dosłownie:

```text
86eeb60fb3fd6343536e6a8f0fbddfb63acf5a0e
```

Tip był o `1` commit przed markerem. Rozjazd:

```text
63b5f8e64b docs(day118-120): fala naprawcza 2
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_118_PROPAGACJA.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_119_TRZY_STANY.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_120_FIXTURE_INSIGHT.md
```

## 1. Z30 — zero wysyłki

Przed operacjami zapisującymi:

```text
BRAK ZMIENNYCH POCZTY
BRAK DRENAZY W GATEWAY
 key | left
-----+------
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu na potrzeby testów. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

Proces serwera miał `DOTENV_DISABLED=1`, `ENABLE_TEST_AUTH_BYPASS=false` i
`DATABASE_URL` na `127.0.0.1:6003`; nie miał `SMTP_*`, `RESEND`, `SENDGRID`,
`MAIL*` ani `EMAIL_LIVE_SEND`.

## 2. B.1 — stan zastany i kształt tabeli

Pełne migracje na `pgvector/pgvector:pg16`:

- pierwszy przebieg: `Postgres migrations complete`;
- drugi przebieg: `Applying migrations: 0` i `Postgres migrations complete`;
- kanoniczny runtime potwierdził `863` udane migracje, `migrationState=ok`,
  `sqlMigrationState=ok`.

Stan bazowy po seedzie zastanego pliku:

```text
 interview_insights_for_fixture
--------------------------------
                              0
(1 row)
```

Tabela `interview_insights` ma `43` kolumny. Wymagane bez wartości domyślnej są
`id`, `organization_id`, `title`, `created_by`. Klucz główny: `id`. Kolumny V6
użyte przez kartę (`issues_json`, `opportunities_json`, `signals_json`,
`evidence_map_json`, `missing_data_json`) są typu `TEXT`; `structured_content`
jest `JSONB`.

## 3. B.2 — najmniejsza naprawa

Zmieniono wyłącznie
`server/scripts/seed-wave3-interview-owner-review.ts` po stronie kodu.

Seeder tworzy idempotentnie `wave3-int-owner-review-insight-v1` przez
`ON CONFLICT(id) DO UPDATE`, wiąże go z istniejącą sesją review i zapisuje:

- `3 z 3` realistyczne polskie fakty sesji;
- `2` problemy/ryzyka;
- `1` szansę;
- `1` sygnał;
- `3` wpisy mapy dowodów;
- `2` jawne braki danych;
- uczciwą jakość materiału: `58/100`, `single_perspective`, `1` respondent.

Nie dodano AI, flagi, wysyłki, nowego ekranu ani zmiany uprawnień. Marker
fixture otrzymał `ON CONFLICT DO NOTHING`, aby drugi seed zachował ten sam
nonce własności i nie tworzył duplikatu.

## 4. B.3/B.4 — readback, idempotencja i realne HTTP

Pierwszy i drugi seed na tej samej bazie zakończyły się `EXIT 0`. Po drugim:

```text
 insights | distinct_ids
----------+--------------
        1 |            1

 markers | distinct_markers
---------+------------------
       1 |                1
```

SQL struktury Insightu:

```text
status=completed · source_session_count=1 · issues=2 · opportunities=1
signals=1 · evidence=3
```

Kanoniczny runtime: server `4906`, client `4907`, DB `6003`, health `200`, ready
`200`, frontend `200`, auth bypass `false`, V8 global `true`. Realny login
`w3.interview.owner@local.test` zwrócił `HTTP 200`. Następnie realne żądanie
`GET /api/v8/interview/insights` przez zamontowany `ApiGateway` zwróciło
`HTTP 200`, kopertę `data.insights` i `1 z 1` Insight.

Pułapki Z33:

- (a) `ENABLE_V8_GLOBAL=true` w kanonicznym runtime — brak fałszywego 404;
- (b) strażnik Results nie leży na ścieżce `/api/v8/interview/insights`;
- (c) runtime miał `DB_TYPE=postgres`, `MOCK_DB=false`, a readback wskazuje
  dokładnie lokalny Postgres na `6003`;
- (d) `ENABLE_TEST_AUTH_BYPASS=false`, login wydał realny token/cookie;
- (e) nie wystąpił `500`; zapisano rzeczywiste kody `200` dla loginu i listy.

## 5. Sześć wartości karty

Pełny produkt, zalogowany właściciel, tryb Podgląd:

| Pole | Wartość | Uzasadnienie |
| --- | ---: | --- |
| OFFICIAL ANSWERS | `3` | trzy rzeczywiste odpowiedzi sesji, zapisane jako fakty |
| ISSUES / RISKS | `2` | brak definicji gotowości; opóźnienie o 9 dni |
| SIGNALS / OPPORTUNITIES | `2` | `1` sygnał + `1` szansa |
| Findings / Ustalenia | `3` | trzy materializowane ustalenia/dowody karty |
| Confidence / Pewność | `Niewystarczające` | uczciwy wynik pojedynczej perspektywy i braków danych |
| ACTIONS / Akcje | `0` | prawdziwy stan Podglądu; akcje zmiany statusu są celowo ukryte |

Wypełniono pola, które fixture faktycznie posiada: odpowiedzi, ryzyka, sygnał,
szansę, dowody i ograniczenia. Nie wymuszono wysokiej pewności ani akcji,
ponieważ przy `1` respondencie i w trybie Podgląd byłaby to atrapa (`Z16`).

## 6. Dowód mutacyjny w obie strony

Poprawny plik skopiowano przez `cp` do
`/private/tmp/cx-day120-fixture-insight-scratch/seed-wave3-interview-owner-review.fixed.ts`.
Mutacja omijała wyłącznie INSERT Insightu. Na bazie bez własnego rekordu:

```text
MUTATION RED EXIT 1
Error: Wave 3 Interview FINAL readback mismatch
insights_after_red = 0
```

Po przywróceniu przez `cp`:

```text
RESTORE CMP EXIT 0
MUTATION DIFF EXIT 0 (0 = pusty)
MUTATION GREEN EXIT 0
insights_after_green = 1
official_answers_after_green = 3
```

Vitest nie uczestniczył w tym kontrakcie, więc `--retry=0` nie ma zastosowania;
wykonywalnym strażnikiem jest `FINAL readback` samego seedera. Mutacja czerwieni
dokładnie na brakującym rekordzie i nie czerwieni sąsiednich liczników sesji,
pytań ani dystrybucji.

## 7. Brak regresji i zasięg testów

Pomiar niezależny:

```text
rg -l "seed-wave3-interview-owner-review|W3-INTERVIEW-OWNER-v1|wave3-int-owner-review" \
  tests server/src --glob '*.{test,spec}.{ts,tsx,js,mjs}'
0
```

Repo ma `0` plików testowych bezpośrednio obejmujących seeder, dlatego zbiór
pełnych nazw przed/po to `0/0`, delta nazw `0`; nie przedstawiam tego jako
silnego dowodu regresji. Dodatkowo przeszły:

- `npx tsc --noEmit ... server/scripts/seed-wave3-interview-owner-review.ts`;
- `npx prettier --check server/scripts/seed-wave3-interview-owner-review.ts`;
- `git diff --check`;
- hook commita: ratchet artefaktów i gęstości bez nowych naruszeń.

## 8. Zrzuty 4 z 4

| Stan | Motyw | Plik | SHA-256 |
| --- | --- | --- | --- |
| przed — lista pusta | jasny | `/private/tmp/cx-day120-fixture-insight-artefakty/day120-before-light.png` | `760766697f13ee83bd79befe01c2e0b1b5251be7624ea5d2b85830474b25fc75` |
| przed — lista pusta | ciemny | `/private/tmp/cx-day120-fixture-insight-artefakty/day120-before-dark.png` | `68f4a952f0913da8b4bebe0ef232bd0fd21e6a5ab5a02340d52676c5a87a5c44` |
| po — pełna karta | jasny | `/private/tmp/cx-day120-fixture-insight-artefakty/day120-after-light.png` | `33c614d091accf810343dcce5149d59d833154fc23eca0749dfdc211da15590d` |
| po — pełna karta | ciemny | `/private/tmp/cx-day120-fixture-insight-artefakty/day120-after-dark.png` | `202498c1080802675020ad456e8d0347eab3c4998aa1e9a0a380ae72c169f5d1` |

## 9. Korekty wobec instrukcji

1. Instrukcja oczekiwała `0` Insightów — własny pomiar potwierdził `0`; brak
   korekty.
2. Po pierwszym INSERT karta nadal pokazywała `OFFICIAL ANSWERS=0`, mimo `3 z 3`
   odpowiedzi. Pomiar kodu i runtime wykazał, że licznik czyta
   `interview_sessions.summary_facts`, nie bezpośrednio `interview_questions`.
   Seeder uzupełnia więc podsumowanie faktów bez AI; wynik po korekcie: `3`.
3. Instrukcja numeruje B.3 i B.4 dwukrotnie. Zastosowano bezpieczniejszą
   interpretację: wykonano wszystkie pozycje niezależnie od numeracji.
4. Instrukcja odwołuje się do `§0.4a`, którego wydany plik nie zawiera.
   Zamiast STOP-u wykonano własny pomiar wszystkich testów nawiązujących do
   zmienionego seedera; wynik `0` opisano jawnie.
5. Kanoniczny runtime został uruchomiony na markerze i jego dirty fingerprint,
   po czym kod został zgodnie z Z34a zacommitowany. Kanoniczny `stop` wymaga
   tożsamości bieżącego HEAD równej `state.sha`, więc po commicie nie mógłby
   zaakceptować starej tożsamości bez zakazanego resetu. Zamiast resetu
   zweryfikowano dosłownie PID=PGID z owned `state.json`, wysłano `TERM` tylko
   do PGID `76131` i `76152`, a następnie potwierdzono oba porty jako wolne.

## 10. TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano akceptacji właściciela produktu; status pozostaje
  `OWNER ACCEPTANCE PENDING`.
- Nie uruchomiono pełnego korpusu testów repozytorium. Brak bezpośrednich testów
  seedera oznacza, że delta nazw `0` jest pomiarem pustego zbioru, nie dowodem
  braku wszystkich możliwych regresji.
- Nie uruchomiono produkcji, demo, stagingu, Railway ani CI GitHub Actions.
- Nie zweryfikowano karty na tablecie/mobile ani pełnego audytu a11y.
- `Findings=3`, `Confidence=Niewystarczające` i `Actions=0` zostały potwierdzone
  na karcie runtime; nie zweryfikowano ich decyzją właściciela jako docelowej
  semantyki produktu.

## 11. Pliki i cleanup

Docelowa lista zmian względem markera obejmuje wyłącznie:

- `server/scripts/seed-wave3-interview-owner-review.ts`;
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY120_FIXTURE_INSIGHT_REPORT.md`;
- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/MODULE_ACCEPTANCE.md`.

Po zrzutach oba owned process-groupy runtime'u zostały zatrzymane po weryfikacji
PID/PGID; porty `4906` i `4907` są wolne. Kontener `cx-day120-pg` usunięto przez
`docker rm -fv`; nazwa nie występuje w `docker ps -a`. Artefakty pozostają
wyłącznie w `/private/tmp`.
