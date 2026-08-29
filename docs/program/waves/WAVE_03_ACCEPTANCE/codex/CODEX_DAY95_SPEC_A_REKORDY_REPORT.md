# CODEX DAY 95 — SPEC-A REKORDY — RAPORT

Data pomiaru: 2026-08-29  
Marker: `188cb75f5b8f3b87eb8346160e5ee1aa56942988`  
Gałąź: `codex/day95-spec-a-rekordy-20260829`  
Werdykt: **PARTIAL — 12/12 plików PNG, 10/12 semantycznie zgodnych; żaden z trzech artefaktów nie przechodzi pełnego DoD §18.1.**

## 1. Tożsamość wejścia i rozjazd tipa

Wynik komendy markera, dosłownie:

```text
8c7a853a6c docs(day95,96,97,99): armia SPEC-A — odbior artefaktow i kreatorow wg DoD 18.1
188cb75f5b docs(ledger): DEC-331..332 — straznik rozluzniony, Kanban naprawiony, znalezisko o granulacji
...
MARKER OK
```

Sanity worktree, dosłownie:

```text
188cb75f5b8f3b87eb8346160e5ee1aa56942988
```

`git status --short | head -3` nie zwrócił żadnej linii. Tip uciekł o jeden commit. Pomiar:

```text
$ git log --oneline 188cb75f...github-backup/codex/m03-admin-20260824
8c7a853a6c docs(day95,96,97,99): armia SPEC-A — odbior artefaktow i kreatorow wg DoD 18.1

$ git diff --name-only 188cb75f...github-backup/codex/m03-admin-20260824
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_95_SPEC_A_REKORDY.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_96_SPEC_A_CANVAS.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_97_SPEC_A_MATRYCA_DECK.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_99_KREATORY.md
```

Start wykonano dokładnie z markera. Scalenie nowszego tipa pozostaje dla nadzorcy.

## 2. Stan wejściowy i trasy

- Dysk: `61 GiB` wolne z mianownika `1.8 TiB`; próg 5 GB spełniony.
- Porty przed startem: `5975`, `4850`, `4851` — `0/3` zajętych.
- W1: render `<ArtifactRightPanel` występuje `28` razy w `src/` poza `__tests__`; to liczba renderów, nie liczba artefaktów.
- W2: §18.1 zaczyna się w `ARTIFACT_ANATOMY_STANDARD.md:1524`; przeczytano pełne 16 punktów przed zrzutami.
- W3: `scripts/check-artefakt.sh` jest ratchetem; wynik `aktualnie 7, baseline 7`, brak wzrostu.
- W4: stan G06/G07 przed dyżurem był odpowiednio `PARTIAL_DESKTOP_PL_CURRENT_REPLAY` i `PARTIAL_PACKET_READY_16_OF_20`.
- Migracje o prefiksie `202617`: `0 z oczekiwanych 0`.

Trasy montowane przez realny `ApiGateway`:

- Zadanie: `server/src/Gateway.ts:903` — `app.use('/api/tasks', taskRoutes)` oraz alias PMO w `:1150`.
- Decyzja: `server/src/Gateway.ts:1121` — `app.use('/api/decisions', decisionsRoutes)`.
- Insight: `server/src/Gateway.ts:1349` — `app.use('/api/interview', interviewRoutes)`; koszyki źródeł pod tym samym prefiksem w `:1359`.

## 3. Fixture, migracje i readback

Kontener: `cx-day95-pg`, obraz `pgvector/pgvector:pg16`, host wyłącznie `127.0.0.1:5975`, baza `consultify_w3_execution_owner_day95`.

Kontrakt seedera ustalony przed uruchomieniem:

- `scripts/dev/seed-wave3-execution-owner-review.mjs:3-6` definiuje `provision|seed|readback|reset|drop`, lokalny prefiks `consultify_w3_execution_owner_*`, nowy manifest `wx/0600` i jawne potwierdzenie.
- `scripts/dev/seed-wave3-owner-review-overlay.mjs:1-8` jest lokalnym, append-only overlayem; nie zmienia users, memberships, credentials, roles ani feature flags.
- `server/scripts/seed-insights-initiatives-rich-demo.ts:1-16` tworzy deterministyczne insighty i jest idempotentny; wskazano jawnie organizację, projekt i lokalny `DATABASE_URL`.

Migracje:

```text
pierwszy przebieg: Applying migrations: 863 / Postgres migrations complete
drugi przebieg: Applying migrations: 0 / Postgres migrations complete
readback schema_migrations: 863 successful
```

Readback fixture:

- manifest bazowy: `ownershipState=FINAL`, marker `W3-EXECUTION-OWNER-v1`, właściwa baza;
- overlay: `1/1 project`, `3/3 tasks`, `1/1 decision`, `1/1 template`, `1/1 session`, `1/1 assignment`, `3/3 questions`;
- insighty: `8/10 completed`, `1/10 failed`, `1/10 generating`;
- pomocnicza kwerenda do nieistniejącej kolumny `review_status` zwróciła błąd. Nie użyto jej jako readbacku; wiążące są liczniki po istniejącej kolumnie `status`.

Runtime kanoniczny: server `4850`, client `4851`, realne logowanie `w3.exe.owner@local.test`, `ENABLE_TEST_AUTH_BYPASS=false`. Manifest runtime podał `health=200`, `ready=200`, frontend `200`, SHA serwera i klienta zgodne z markerem oraz `863` migracje. Późniejsze ręczne `GET /health` i `/ready` (bez ścieżki kanonicznego probe) dały `500`; nie relabeluję ich jako awarii readiness, ale zapisuję jako niezweryfikowany rozjazd endpointu.

## 4. Z30 — deklaracja i dowody

Przed zapisem:

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%';
(0 rows)
grep drenów w server/src/Gateway.ts
(0 trafień)
```

Po starcie runtime procesu serwera:

```text
DOTENV_DISABLED=1
DATABASE_URL=postgresql://postgres:***@127.0.0.1:5975/consultify_w3_execution_owner_day95
settings smtp%: 0 rows
```

Log potwierdził start lokalnych drenów, lecz bez transportu; osobny wpis podał `No transport configured ... message dropped`. Nie wykonano operacji tworzącej wiadomość, zaproszenie ani powiadomienie.

**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.”**

## 5. Powierzchnie zadeklarowane przed pierwszym zrzutem

1. Zadanie — `TaskDetailView.tsx`: pełny rekord z listy oraz `New Task` jako uczciwy nowy/pusty rekord; light i dark.
2. Decyzja — `DecisionDetailView.tsx`: pełny rekord z listy oraz `New Decision` jako uczciwy nowy/pusty rekord; light i dark.
3. Insight — `InsightViewer.tsx`: pełny rekord z listy; light i dark. Slot pusty próbowano osiągnąć z listy. Bez uruchomienia generatora/LLM osiągalny był wyłącznie rekord `Failed`, więc zrzuty nazywają się `empty-slot-error` i **nie liczą się semantycznie jako empty**.

Każdy duży rekord otwarto ścieżką lista → preview → `Open` → pełna strona. Nie użyto renderu komponentu.

## 6. Macierz zrzutów i sumy K2

Na dysku jest `12/12` plików PNG po `1280×720`. Semantycznie zgodne jest `10/12`: osiem stanów Zadania/Decyzji oraz dwa pełne Insightu. Dwa pliki `insight-*-empty-slot-error.png` są uczciwym dowodem, że slot pusty nie został osiągnięty; nie są pustym stanem.

```text
8bdbdd23a719876ea22c95b64814d20362c40d2c8e7e4348639d511e6cb01465  decision-dark-empty.png
d145ec813df55f4bdb8d94658f2915d5a375e4b7fea5a6ff505bb44567e6d3a6  decision-dark-full.png
c248778e6bccbd8bb9f9a1926fdbeed205ec7e0b9e534f2ae7e81b2b001bfea5  decision-light-empty.png
05287ff0232fa077d5dfc49856212f46af487b1773325c8baee136a4b85815e8  decision-light-full.png
f9b3a6e590cd852f8b3394928fc9c5cfaeb0486ca9ac8e3a7f438389bb6e63dd  insight-dark-empty-slot-error.png
af7c2bc8615cd8e2a06e7cb99dbb584dff04ffbbe20d1ccdcf852ab646bce238  insight-dark-full.png
55ca3129fc35f3c89e47aff6478078c3ae5827e806d4a28d1d7d32e1049e9890  insight-light-empty-slot-error.png
fe1c308da63bf28c267baae3b07f2a7b6c3f52880dfa328627fb05805f7d6e7e  insight-light-full.png
943f1ba7f7f0a8c56fe9bfc3d04617aeddf7bd93d67b69c46e7fa5a2b369d5d0  task-dark-empty.png
d9af266dfa6c1df8bc4be627516e6f9948bedca2a60e973aeb23fbca145629f3  task-dark-full.png
7028523b9b8de15f204cd41d092b967f2114c9ac97ff19ae5d47d6fc8e61573b  task-light-empty.png
f83c4636a98e70c6409693dae433d2910d871f79fda286c35bd6002c560e5d56  task-light-full.png
```

Katalog dowodów: `/private/tmp/cx-day95-spec-a-rekordy-artefakty`.

## 7. DoD §18.1 — Zadanie — 6 z 16

| # | Wynik | Jednozdaniowy dowód |
|---:|---|---|
| 1 | TAK | Zrzut pełny pokazuje back, ikonę typu, edytowalny tytuł, lifecycle `To Do`, osobne `Saved` i jedną akcję główną `Start`. |
| 2 | TAK | Układ Menu 1, Menu 2, lewy rail, centrum i wspólny prawy panel odpowiada archetypowi Rekord. |
| 3 | TAK | Kod `TaskDetailView.tsx:5202+` daje kolejno actions, properties, relations, comments, history. |
| 4 | TAK | `Relations` jest osobnym, klikalnym akordeonem, a brak relacji nie jest zastąpiony tekstową atrapą. |
| 5 | NIE | AI jest w nagłówku/Menu 2, ale brak stałej sekcji AI w prawym panelu. |
| 6 | NIE | Lista→preview→Open działa; guard niezapisanych zmian nie został potwierdzony. |
| 7 | NIE | Pusty rekord jest uczciwy, lecz loading i error nie zostały zweryfikowane. |
| 8 | TAK | Własne zrzuty light/dark są czytelne; badany plik nie ma wykonywalnych klas raw slate/primary/hex. |
| 9 | TAK | Lifecycle, selection i fokus nie używają crimson; crimson jest widoczny wyłącznie dla destrukcyjnego `Block`/ostrzeżenia. |
| 10 | NIE | Realne Tab/Shift+Tab powtarzały fokus na tym samym tabie dokumentu 18/18 razy; pełnego cyklu nie uzyskano. |
| 11 | NIE | Nie uzyskano osobnego dowodu warstwowego `Esc`. |
| 12 | NIE | Aktywny tab ma `focus-visible:ring-c-focus`, lecz nie zweryfikowano każdego elementu interaktywnego. |
| 13 | NIE | Grep badanego pliku nie znalazł `role="log"`, `aria-live="polite"` ani `aria-relevant="additions text"`. |
| 14 | NIE DOTYCZY | Rekord Zadania nie jest generatorem/wizardem. |
| 15 | NIE DOTYCZY | Archetyp C, nie Canvas. |
| 16 | NIE DOTYCZY | Archetyp C, nie Canvas. |

## 8. DoD §18.1 — Decyzja — 5 z 16

| # | Wynik | Jednozdaniowy dowód |
|---:|---|---|
| 1 | NIE | Back, typ, tytuł, lifecycle i `Saved` są, lecz Menu 1 nie pokazuje jednoznacznej pojedynczej akcji głównej workflow; akcja approve jest w panelu. |
| 2 | TAK | Powłoka odpowiada temu samemu archetypowi Rekord co Zadanie. |
| 3 | TAK | Kod `DecisionDetailView.tsx:4609+` daje kolejno actions, properties, relations, comments, history. |
| 4 | TAK | `Relations` jest pierwszoklasowym klikalnym akordeonem. |
| 5 | NIE | Brak stałej sekcji AI w prawym panelu. |
| 6 | NIE | Lista→preview→Open działa; guard niezapisanych zmian nie został potwierdzony. |
| 7 | NIE | Pusty ekran jest uczciwy, ale banner mówi, że comments/alternatives/risks/notes są tylko w tym browserze; to nie jest kanoniczna persystencja, a loading/error nie zmierzono. |
| 8 | TAK | Własne zrzuty light/dark są czytelne; badany plik nie ma wykonywalnych klas raw slate/primary/hex. |
| 9 | TAK | Status/badge/selection badanych stanów nie używa crimson poza destrukcyjną semantyką. |
| 10 | NIE | Pełnego cyklu klawiaturowego nie zweryfikowano. |
| 11 | NIE | Nie zweryfikowano priorytetu lokalnej warstwy `Esc`. |
| 12 | NIE | Nie zweryfikowano widocznego fokusa na każdym elemencie. |
| 13 | NIE | Grep badanego pliku nie znalazł wymaganego kontenera streamingowego. |
| 14 | NIE DOTYCZY | Rekord Decyzji nie jest generatorem/wizardem. |
| 15 | NIE DOTYCZY | Archetyp C, nie Canvas. |
| 16 | NIE DOTYCZY | Archetyp C, nie Canvas. |

## 9. DoD §18.1 — Insight — 3 z 16

| # | Wynik | Jednozdaniowy dowód |
|---:|---|---|
| 1 | NIE | Back, typ, tytuł, lifecycle i `Saved` są, ale brak jednej jawnej akcji głównej w Menu 1. |
| 2 | TAK | Wspólna geometria Rekordu jest zachowana. |
| 3 | NIE | Kod `InsightViewer.tsx:8832+` wstawia `results` między relations a comments/history, więc nie zachowuje literalnej kolejności pięciu sekcji. |
| 4 | TAK | `Relations` jest osobnym klikalnym akordeonem. |
| 5 | NIE | AI jest w Menu 2, ale brak stałego slotu/sekcji AI w prawym panelu. |
| 6 | NIE | Lista→preview→Open działa; guard niezapisanych zmian nie został potwierdzony. |
| 7 | NIE | Pełny i error są uczciwe, ale pusty Insight jest nieosiągalny bez generatora/LLM; loading nie zweryfikowano. |
| 8 | TAK | Własne zrzuty light/dark są czytelne; raw hex występuje w kodzie print/export (`:9933-9934`), nie w zmierzonym ekranie produktu. |
| 9 | NIE | Status `Failed` jest czerwony, mimo literalnego zakazu crimson na statusie. |
| 10 | NIE | Pełnego cyklu klawiaturowego nie zweryfikowano. |
| 11 | NIE | Nie zweryfikowano priorytetu lokalnej warstwy `Esc`. |
| 12 | NIE | Nie zweryfikowano widocznego fokusa na każdym elemencie. |
| 13 | NIE | Grep badanego pliku nie znalazł wymaganego kontenera streamingowego. |
| 14 | NIE DOTYCZY | Viewer nie jest generatorem/wizardem. |
| 15 | NIE DOTYCZY | Archetyp C, nie Canvas. |
| 16 | NIE DOTYCZY | Archetyp C, nie Canvas. |

## 10. Testy i pułapki Z33

Komenda była czysto jednostkowa: `RUN_DB_TESTS=0 MOCK_DB=true ... --retry=0 --reporter=json`. Wynik po pełnych nazwach: `14/24 PASS`, `10/24 FAIL`, `0/24 pending`. Wszystkie 10 czerwonych przypadków należą do `ArtifactApprovalStatusBar.5types.test.tsx` i nie znajdują tekstów `Approved`/`Draft`; pozostałe nazwane przypadki InsightViewer i DecisionDetailView przeszły. JSON: `/private/tmp/cx-day95-spec-a-rekordy-artefakty/day95-focused-tests.json`.

Pułapki (a)–(d) nie dotyczą tego pakietu, bo `RUN_DB_TESTS=0 MOCK_DB=true`, a pakiet nie dowodzi auth, V8 ani realdb. Pułapka (e) dotyczyła zwiadu adopcji: nie uznano importu za runtime; wszystkie trzy widoki otwarto realnie z list w produkcie. Ten pakiet nie jest dowodem egzekucji HTTP/DB; tę rolę pełnią realny runtime, logowanie i readback fixture.

## 11. Korekty wobec instrukcji

1. Instrukcja tezuje, że Zadanie i Decyzja są „niemal gotowe”. Pomiar obala wersję silną: Zadanie ma `6/16`, Decyzja `5/16`; Decyzja jawnie ostrzega o danych tylko w localStorage.
2. Instrukcja tezuje, że Insight ma kod w pełni SPEC-A. Pomiar obala tę tezę: `3/16`, dodatkowa sekcja `Results` łamie literalną kolejność, brak pustego stanu bez generatora, czerwony status `Failed` i brak wymaganego kontenera streamingowego.
3. Instrukcja wymaga empty/full dla Insightu, jednocześnie Z15 zabrania modelu językowego. Bez wywołania generatora nie znaleziono drogi do nowego pustego `InsightViewer`. Wybrano bezpieczniejszą interpretację: nie uruchomiono LLM; zachowano dwa zrzuty error jako dowód brakującego slotu i policzono `10/12` semantycznie.
4. W dokumencie brak rzeczywistej sekcji `§0.4a`, choć Z24 do niej odsyła. Zamiast STOP-u wykonano jawny, pełnonazwowy pomiar czterech znalezionych pakietów bez zawężania wyników.

## 12. TWIERDZENIA NIEZWERYFIKOWANE

- Niezweryfikowane: guard niezapisanych zmian dla trzech artefaktów; nie wykonano mutacji formularza, aby nie mieszać pomiaru stanu zastanego.
- Niezweryfikowane: loading dla trzech artefaktów i error dla Zadania/Decyzji; fixture nie udostępniał deterministycznej drogi z listy.
- Niezweryfikowane: pełny cykl Tab/Shift+Tab dla Decyzji i Insightu oraz lokalność `Esc`; po ujawnieniu powtarzalnego fokusa Zadania nie ekstrapolowano wyniku na inne ekrany.
- Niezweryfikowane: fokus każdego elementu; sprawdzono jedynie aktywny tab Zadania (`focus-visible:ring-c-focus`).
- Niezweryfikowane: `GET /health` i `/ready` po starcie pod ręcznie założonymi ścieżkami; kanoniczny runtime wcześniej zapisał `200/200`, ręczne ścieżki dały `500/500`.
- Niezweryfikowane: czy 10 czerwonych testów status bara to zastany defekt produktu, tłumaczeń czy testu; dyżur Z40 nie naprawia i nie wykonuje mutacyjnego red/green.
- Niezweryfikowane: owner visual judgment; zrzuty są pakietem wykonawcy, nie decyzją Piotra.

## 13. Stan końcowy i K1–K6

| Kryterium | Stan |
|---|---|
| K1 | SPEŁNIONE — powierzchnie nazwano przed pierwszym zrzutem. |
| K2 | PARTIAL — `12/12` plików, `10/12` semantycznie zgodnych, SHA-256 wyżej. |
| K3 | SPEŁNIONE JAKO POMIAR — trzy osobne tabele, wyniki `6/16`, `5/16`, `3/16`; nie jest to PASS produktu. |
| K4 | SPEŁNIONE — deklaracja i dowody Z30 w §4. |
| K5 | SPEŁNIONE — sekcja niepusta. |
| K6 | SPEŁNIONE po commicie — wyłącznie raport i `MODULE_ACCEPTANCE.md`; zero `src/`, `server/src/`, migracji i seedera. |

Nie naprawiono żadnego defektu produktu (`Z40`).
