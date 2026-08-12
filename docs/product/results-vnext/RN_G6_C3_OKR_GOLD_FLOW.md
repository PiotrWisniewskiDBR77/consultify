# RN-G6-C3 — złota ścieżka OKR, real app + real dane

**Cel.** Dwadzieścia kroków złotej ścieżki OKR przeklikanych na REALNEJ
aplikacji przeciw REALNEMU PostgreSQL 17, z realnym backendem i frontendem —
pierwszy w tym programie kompletny przebieg od utworzenia zestawu OKR do
zamknięcia cyklu, dowodzący (albo obalający) naprawę P0-D ścieżki zapisu.

Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g6-okr`, gałąź `rn-g6-okr-v2`.
HEAD startowy: `c5852ace32`. HEAD końcowy: `9ababe0b90` (3 commity:
`493b5cbe25` fix flagi, `fa735ca442` fix refleksji, `9ababe0b90` zrzuty).

Zrzuty (persisted, headless Playwright): `docs/qa/screens/rn-g6-okr/*.png` +
`gold-flow-proof-report.json`. Skrypt: `scripts/rn-g6-okr-gold-flow-proof.mjs`.

---

## 0. Środowisko — WŁASNY backend/frontend, nie współdzielony

Postgres 17.9 współdzielony, PID `38806`, port `55821`, gniazdo
`/tmp/rn-g6-sock`, baza `rn_g6_runtime` — **nietknięty, nie restartowany**.

Porty `:3097`/`:3197` z zadania okazały się ZAJĘTE przez inną, już działającą
sesję (backend na SHA `3ad73a98d3`, nie moim `c5852ace32`; frontend z
worktree `g6-runtime`) — PID-y `18133`/`18161`, **nie moje**. Zgodnie z
regułą „zabijaj wyłącznie PID-y które sam uruchomiłeś" — **nie ruszone**.
Zamiast tego uruchomiłem WŁASNY stos na wolnych portach, wskazany na tę samą
współdzieloną bazę:

```bash
# Backend :3099 (własny PID, potem zrestartowany po fixie reflection —
# tsx bez --watch, restart wymagany po każdej zmianie server/src)
cd server && DATABASE_URL=postgresql://postgres@127.0.0.1:55821/rn_g6_runtime \
  NODE_ENV=test DB_TYPE=postgres DB_MANAGED_SCHEMA=off PORT=3099 MOCK_DB=false \
  RUN_DB_TESTS=1 POSTGRES_SKIP_INIT_IN_TEST=1 ENABLE_TEST_GATEWAY=true \
  DISABLE_SCHEDULER=true DISABLE_AI_PROVIDER_SENTINEL=true \
  DISABLE_AI_HEALTH_MONITOR=true DISABLE_STARTUP_HEALTH_MONITOR=true \
  SKIP_STARTUP_VALIDATOR=true DEFER_LLM_CONFIG_INIT_MS=3000 npx tsx src/index.ts

# Frontend :3298
VITE_API_TARGET=http://127.0.0.1:3099 VITE_API_URL= npx vite --port 3298 --strictPort
```

`server/scripts/migrate.postgres.ts` uruchomiony przeciw mojemu SHA przed
startem: `0 applied` (schemat identyczny z tym, na czym stała baza —
żadna migracja OKR-owa nie zmieniła DDL od poprzedniej rundy).

**Stan na koniec sesji:** Postgres, mój backend (`:3099`) i frontend
(`:3298`) URUCHOMIONE (zostawione żywe dla kolejnych torów, zgodnie z
konwencją tego programu). PID-y do zatrzymania precyzyjnym `kill` — sprawdź
`lsof -nP -iTCP:3099 -sTCP:LISTEN` / `:3298` przed zabiciem czegokolwiek na
tym współdzielonym hoście.

---

## 1. Dowód rozdzielności CZTERECH pojęć (postęp / pewność / status / uwaga)

Bezpośrednio z bazy, KR `d083e196…` po check-inie:

| pole | wartość | źródło |
|---|---|---|
| `new_value` (wartość) | `6` | `okr_vnext_checkins.new_value` |
| `calculated_progress` (postęp) | `0.6` (60%) | silnik, `(current-baseline)/(target-baseline)` |
| `owner_declared_status` (status) | `on_track` | deklaracja właściciela w check-inie |
| `confidence` (pewność) | `high` | deklaracja właściciela w check-inie |

To są CZTERY OSOBNE kolumny w `okr_vnext_checkins`, zapisywane niezależnie w
jednym POST-cie, ale przechowywane i renderowane osobno. **Dowód że zmiana
jednego nie rusza pozostałych — korekta check-inu KR2** (krok 9): zmieniłem
TYLKO `new_value` (8→7.5, `okr-correct-change-value` checkbox), zostawiając
status/confidence niezaznaczone w formularzu korekty:

| | przed korektą | po korekcie |
|---|---|---|
| new_value | 8 | **7.5** |
| calculated_progress | 133.3% | **125%** (przeliczone automatycznie z nowej wartości) |
| owner_declared_status | achieved | achieved (**niezmieniony**) |
| confidence | high | high (**niezmieniony**) |

Dodatkowo — **STATUS KR-u (`okr_vnext_key_results.status`) to CZWARTA,
NIEZALEŻNA kolumna od `owner_declared_status` w check-inie**: po check-inie
z `owner_declared_status='on_track'`, kolumna `status` na samym wierszu KR
w tabeli `okr_vnext_key_results` pozostała `not_started` (widoczne też w UI
— tabela KR pokazuje kolumnę STATUS osobno od kolumny CONFIDENCE, i po
check-inie STATUS nie zmienił się mimo że PROGRESS/CONFIDENCE tak). Patrz
§5 finding E — to jest dowód rozdzielności, ale też realny gap (KR.status
nie synchronizuje się z ostatnim check-inem).

**ATTENTION (uwaga)** — czwarte pojęcie, na poziomie Zestawu:
`okr_vnext_sets.attention_state='watch'`, niezależne od `overall_progress`
(86%) i `overall_confidence` (high) — to osobna kolumna wyliczana przez
osobną regułę (widoczna w rejestrze jako osobna kolumna ATTENTION, chip
bursztynowy „Watch" obok progress/confidence).

---

## 2. Skala >100% — 133.3%, potem 125% po korekcie (dowód nieklampowania)

KR `4c192b9f…` (baseline 0, target 6, geometria `increase`):

```
POST .../check-ins  {value: 8}   → calculated_progress = 1.3333333333333333
UI:  "8" / "133.3%" / "Achieved" / "High"
```

Baza: `calculated_progress` = `1.3333333333333333` (numeric, DOKŁADNIE
ułamek nieklampowany 0–1+, string dziesiętny jak opisano w brief). UI
renderuje `133.3%` — **nie** `13.3%` (błąd skali x10, którego szukał brief)
i **nie** `100%` (klampowanie). Po korekcie na `7.5`: `1.25` → **`125%`**.
Overall progress Zestawu odzwierciedla to natychmiast: `89.3%` → `86%` po
korekcie (roll-up ważony: `0.6·0.6 + 0.4·1.25 = 0.86`, KR3 waga 0 nie liczy
się do sumy wag).

**Weryfikacja że skala jest poprawna, nie odwrotna:** `0.6` → `60%` (nie
`0,6%`), `1.3333` → `133.3%` (nie `0,013%` ani `1333%`) — jeden spójny
mnożnik ×100 w całej ścieżce KR→Objective→Set, potwierdzony na trzech
niezależnych punktach danych (60%, 133.3%→125%, 86%/89.3%).

---

## 3. Krok 12 — `not_calculable` z powodem: Cel i KR TAK, Zestaw/check-in NIE

Mechanizm: `HonestValueCell` (`src/components/ResultsVNext/HonestValue.tsx`)
— trójstan `decimal | null | 'not_calculable'`. `null` → `—` (myślnik,
wyciszony). `'not_calculable'` → **bordowany chip „n/a" z tooltipem**
(`data-testid="honest-value-not-calculable"`, `title=<powód z silnika>`) —
wizualnie i strukturalnie ODRÓŻNIALNE od `—`.

### Działa: Kluczowy Rezultat

KR `bb871b9c…` (nigdy nie miał check-inu):
```
progress_calc_reason = "not_calculable: increase geometry requires
  current_value, baseline_value, and target_value — at least one is missing"
```
UI: 2 chipy `n/a` (lista KR + panel szczegółów), oba z dokładnie tym
powodem w `title`. Zrzut: `docs/qa/screens/rn-g6-okr/03-set-a-objectives-key-results.png`
(kolumna PROGRESS dla trzeciego KR pokazuje bordowany „n/a", nie myślnik).

### Działa: Cel (Objective)

Stworzyłem DRUGI zestaw (`87e7cc9e…`, celowo osobny, bo pierwszy jest już
Active/Closed i edycja Celów/KR-ów jest zablokowana poza `draft`/
`changes_requested` — patrz §5 finding B) z jednym Celem i DWOMA KR-ami, OBA
bez check-inu:

```
objective.progressCalcReason  = "not_calculable: every key result under
  this objective is itself not_calculable"
objective.confidenceCalcReason = "not_calculable: no key result under this
  objective has a confidence value set yet"
```
UI: **2 chipy `n/a`** na poziomie Celu — jeden dla PROGRESS, jeden dla
CONFIDENCE, każdy z INNYM powodem w tooltipie. Zrzut:
`docs/qa/screens/rn-g6-okr/08-set-b-not-calculable-objective.png`.

### NIE działa: Zestaw i check-in (znany, otwarty brak)

`okr_vnext_sets.overall_progress`/`overall_confidence` to zwykłe nullable
`numeric`/`text` — **BRAK kolumny na powód**. Zestaw #2 (oba Cele/KR-y
`not_calculable`): `overall_progress` i `overall_confidence` w bazie to
zwykły `NULL` (nie `'not_calculable'`, nie ma gdzie tego zapisać). UI:
`docs/qa/screens/rn-g6-okr/02...` / weryfikacja DOM na żywo —
`honest-value-not-calculable` chipów: **0**, `honest-value-empty` (myślnik):
**1**, mimo że pod spodem WSZYSTKO jest strukturalnie `not_calculable`.
Zgodne z komentarzem w kodzie (`okrRegistryMappers.ts:71`: „no
'not_calculable' branch for this field on the wire"). To jest **dokładnie
ten gap z briefu** ("Zestaw i check-in" — naprawia go równoległy tor
serwerowy D08, `okrCheckInCommands.ts`/`okrSetTypes.ts`, **nietknięte przeze
mnie**).

---

## 4. Tabela 20 kroków

Legenda ID: Zestaw A = `644a4ebd-828e-486f-8a24-c0e6c0319913` (główna
ścieżka), Cel A = `d3ee2786-9db9-4dcf-ac98-f7358573d779`, KR1=`d083e196…`,
KR2=`4c192b9f…`, KR3=`bb871b9c…`. Zestaw B = `87e7cc9e…` (demo not_calculable
na poziomie Celu). Wszystkie kroki wykonane jako realne kliknięcia/wypełnienia
w przeglądarce (MCP Browser pane) przeciw żywemu API — nie SQL wprost, poza
krokami 2/12(B) gdzie UI nie ma wejścia (patrz §5).

| # | Krok | Wykonany | Co zobaczyłem | Realne ID | Błędy konsoli / ≥400 |
|---|---|---|---|---|---|
| 1 | Wejście do rejestru `/results/okr` | TAK | `StandardTable`, 1 seedowany zestaw, 58%/Medium/Watch | — | 0 / `admin/flags` 404 (baseline) |
| 2 | Utworzenie zestawu | TAK (API, brak UI — finding A) | `POST .../okr/sets` → 201, status `draft` | `644a4ebd…` | 0 |
| 3 | Zakres/właściciel/cykl | TAK (przy tworzeniu) | scope=team, owner=rn-g6-user-a-owner, cycle=Q3 2026 (`cbf590dc…`) | — | 0 |
| 4 | Cel | TAK (UI, modal „New objective") | Cel utworzony, status Draft | `d3ee2786…` | 0 |
| 5 | 2–4 KR | TAK (UI, 3× „New Key Result") | 3 KR: target 10/6/100 | `d083e196…`/`4c192b9f…`/`bb871b9c…` | 0 |
| 6 | Właściciele i wagi | TAK (przy tworzeniu KR) | owner=domyślny twórca, wagi 60/40/0 | — | 0 |
| 7 | Uruchomienie/zgłoszenie | TAK (UI: Submit→Approve→Activate) | draft→submitted→approved→**active** | — | 0 (jeden 403 self-approval, patrz §5C) |
| 8 | Check-in | TAK (UI, 2× „New check-in") | KR1: 6/60%/on_track/high. KR2: 8/133.3%/achieved/high | checkin `e5e47e7f…`/`3e8d7733…` | 0 |
| 9 | Korekta check-inu | TAK (UI, „Correct") | KR2: 7.5/125%, `correction_of_checkin_id`→oryginał, append-only potwierdzone (oba wiersze w bazie) | checkin `780a06a7…` | 0 (pierwsza próba miała podwójny modal — UI glitch, nie defekt zapisu, patrz §5) |
| 10 | Postęp | TAK | 60% (KR1) / 125% (KR2) / 86% (Cel i Zestaw) — trzy niezależne liczby | — | 0 |
| 11 | Pewność | TAK | High na KR1/KR2/Cel/Zestaw, niezależne od wartości postępu | — | 0 |
| 12 | `not_calculable` z powodem | TAK | Patrz §3 — KR i Cel: TAK z rozróżnialnym chipem; Zestaw: NIE (gap znany) | KR3, Cel B `dd6f9164…` | 0 |
| 13 | Dopasowanie | TAK (UI, „Propose alignment") | `contributes_to` → obiekt seedowany `f770ff2b…`, status `proposed` | alignment `2e5f8144…` | 0 |
| 14 | Prośba o wsparcie | TAK (UI, „Add” → Support request) | status `open`, przypisane do admina | request `875902fd…` | 0 |
| 15 | Przegląd menedżerski | CZĘŚCIOWO — patrz §5C | Self-review + Manager review oba `submitted`; **Approve zablokowane dla OBU dostępnych userów** (self-approval-denial) | review self/manager | 2×403 (oczekiwane, reguła biznesowa) |
| 16 | Wynik końcowy | TAK (UI, „Compute final score”) | banner „Final score computed for every objective”, `final_score=0.86` zapisany w `okr_vnext_reflections` | reflection `7b552bfc…` | 0 |
| 17 | Refleksja | TAK, **po naprawie defektu** (§5D) | 5 pól + dyspozycja `carry_forward` zapisane, przetrwały F5 | reflection row_version 1→3 | 1×409 PRZED fixem (defekt), 0 PO |
| 18 | Przeniesienie/zamknięcie | Close: TAK. Carry forward: poprawnie zablokowane | `active`→`review`→**`closed`** (DB potwierdzone). Carry forward: honest błąd „No cycle in planned/drafting status” | set `644a4ebd…` status `closed` | 0 |
| 19 | Historia | TAK | 24 zdarzenia, chronologicznie zgodne z każdą moją akcją + 1 approval snapshot | — | 0 |
| 20 | F5 + zimny deep link | TAK, oba osobno | F5: stan `Closed/86%/High/Watch` przetrwał. Zimny deep link: `localStorage.clear()` → redirect `/login?redirect=...` (flaga+ścieżka zachowane) → login → dokładny powrót na deep link | — | 0 (poza baseline 404) |

---

## 5. Znalezione defekty — co naprawiłem, co zgłosiłem

### A. UI GAP (zgłoszony, nie naprawiony — poza prostym zakresem) — brak przycisku „Nowy zestaw OKR”

`ResultsOkrHub.tsx` (rejestr `/results/okr`) nie ma ŻADNEGO wejścia do
tworzenia zestawu — `primaryCtaContent` renderuje tylko „Programs”/„Cycles”.
Klient (`okrApi.ts`) nie eksportuje nawet `createOkrSet`. Endpoint istnieje
i działa (`POST /api/vnext/results/okr/sets`, `okrSetCommands.ts`) — użyty
bezpośrednio (autentykowany token z realnego loginu, nie ominięcie bazy).
**Nie naprawiłem** — dodanie całego kreatora (program→cykl→scope→owner→title)
to osobny kawałek pracy UI, nie łatka.

### B. NAPRAWIONE — flaga `?ff_resultsVNextOkr=1` gubiona przy nawigacji (commit `493b5cbe25`)

`ResultsOkrHub.tsx` (przyciski Programs/Cycles + otwarcie zestawu z wiersza,
3 miejsca) i `OkrSetToolPage.tsx` (breadcrumb „OKR sets") wołały
`navigate(ROUTES.X)` BEZ `window.location.search`. Efekt: kliknięcie
„Programs” pokazywało **fałszywy** „OKR Programs — not yet enabled” (bo
`OkrProgramsPage.tsx` czyta flagę z URL query, nie z kontekstu) — a
Programs/Cycles są w pełni zbudowane i działające (potwierdzone zrzutem
`09-programs-flag-preserved.png`: realny program z danymi, przycisk „New
program”). To NIE była nieukończona funkcja, tylko martwy link do niej.
Naprawa: `${ROUTES.X}${window.location.search}` w 5 miejscach. Zweryfikowane
przed i po na żywo.

### C. Business rule (zgłoszony, poprawny — NIE defekt) — self-approval-denial blokuje zatwierdzenie manager review

`Approve` na manager review odrzucone DWUKROTNIE: raz dla admina
(„matches its own submitted_by” — sam złożył recenzję), raz dla właściciela
(„matches its own owner_user_id” — jest właścicielem zestawu). W seedzie
org A dostępne do `/results/*` są TYLKO te dwa konta (patrz
`RN_G6_RUNTIME_ENVIRONMENT.md` §5 — MEMBER/CONSULTANT/GUEST odbijane na
`/interview`). **Strukturalnie nie da się dokończyć zatwierdzenia
manager review tym seedem** — potrzebny trzeci użytkownik org A z dostępem
do `/results/*`. To POPRAWNE wymuszenie separation-of-duties, nie bug — ale
blokuje pełne domknięcie kroku 15 bez zmiany seeda (poza moim zakresem —
seed to nie mój plik). `Close set` (krok 18) i tak zadziałał mimo
`manager review` w stanie `submitted` (nie `approved`) — polityka programu
nie wymaga zatwierdzenia do zamknięcia, tylko złożenia.

### D. NAPRAWIONE — refleksja permanentnie niezapisywalna po odświeżeniu (commit `fa735ca442`)

**Najpoważniejszy defekt tej sesji.** `OkrReviewReflectionView.tsx`
trzymał `expectedVersion` refleksji WYŁĄCZNIE w lokalnym stanie sesji
(`reflectionVersions`, domyślnie `0`), bo — cytując komentarz w kodzie —
„no GET endpoint exists to discover this after a reload”. Skutek: gdy
wiersz `okr_vnext_reflections` już istnieje (utworzony przez „Compute final
score” ALBO przez dowolny wcześniejszy zapis, w tej LUB innej sesji), KAŻDY
kolejny zapis po odświeżeniu strony dostawał `409 STALE_VERSION`
(`currentVersion:1, expectedVersion:0`) i **tracił wpisany tekst bez
ostrzeżenia w formularzu** (pola nie resetowały się widocznie, ale zapis
faktycznie nigdy się nie zapisywał — sprawdzone bezpośrednio w bazie:
`what_worked` pozostawało `NULL` mimo widocznego kliknięcia „Save”).
Odtworzone 100% powtarzalnie (2 próby z rzędu, ten sam wynik).

Naprawa (4 pliki, w allowliście):
- `server/src/services/resultsVnext/okr/okrReflectionCommands.ts` — nowa
  funkcja `getObjectiveReflection()` (plain SELECT, bez `FOR UPDATE`).
- `server/src/routes/resultsVnext/okr.routes.ts` — nowa trasa
  `GET /api/vnext/results/okr/objectives/:objectiveId/reflection`.
- `src/components/ResultsVNext/okr/okrWorkspaceApi.ts` — klient
  `getObjectiveReflection()`.
- `OkrReviewReflectionView.tsx` — `load()` odpytuje refleksję dla każdego
  Celu, wypełnia zarówno `expectedVersion` JAK I treść pól (bonus: drafty
  przetrwają teraz reload, nie tylko wersja).

Zweryfikowane end-to-end na żywej bazie: zapis się powiódł
(`row_version` 1→2→3 na kolejnych zapisach), pełny reload strony poprawnie
wypełnił wszystkie 5 pól + dyspozycję z bazy. Sieć: `GET .../reflection`
→ 200, zero 409 po naprawie.

### E. Zgłoszony, nie naprawiony — `okr_vnext_key_results.status` nie synchronizuje się z check-inem

Po check-inie z `owner_declared_status='on_track'`, kolumna WŁASNA KR-u
(`status`) zostaje `not_started` — widoczne w UI jako osobna kolumna STATUS
pokazująca „Not started” obok kolumny CONFIDENCE pokazującej „High” (patrz
zrzut interaktywny, opisany w §1). Może być zamierzone (status = cykl życia
KR-u, nie odbicie ostatniego check-inu) — **nie naprawiłem**, bo zmiana
znaczenia pola bez pewności co do intencji projektowej byłaby ryzykowna;
zgłaszam jako obserwację do weryfikacji przez właściciela produktu.

### F. Kosmetyczny — podwójny modal przy szybkich kolejnych akcjach

Przy bardzo szybkim wywołaniu drugiej akcji modalnej zaraz po sukcesie
pierwszej (np. „Correct” z menu kebab tuż po zamknięciu poprzedniego
dialogu), zaobserwowano dwa nałożone dialogi jednocześnie (jeden
niewidoczny/zawieszony w stanie „Saving…”), blokujące submit. Zniknęło po
pełnym `location.reload()`. Nie zbadano głębiej (prawdopodobnie wyścig
animacji zamknięcia/otwarcia w bibliotece modali) — **zgłoszone, nie
naprawione**, niski priorytet (workaround: reload).

---

## 6. Bramki

| Bramka | Wynik | Exit code |
|---|---|---|
| `git diff --check` | czysto | 0 |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` | **0 błędów** w całym repo | 0 |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p server --noEmit` | **18 błędów, wszystkie w `roiCalculationEngine.ts`** (przedistniejące, niezwiązane z OKR) — zero nowych | 0 (błędy w output, exit potwierdzony przez zawartość logu, nie OOM-owe 134) |
| `npx vite build` | `✓ built in 2m 51s`, 10235 modułów | 0 |
| hook pre-commit (check-list-canon, check-artefakt, check-triada, check-gestosc, check-focus-canon) | 3/3 commity przeszły, „dług nie rośnie” na każdym | 0 |

---

## 7. Czego TO NIE dowodzi

- Że tworzenie zestawu jest osiągalne z UI — nie jest (finding A), dowód
  idzie przez API z realnym tokenem, nie przez formularz.
- Zatwierdzenia manager review (Approve) — strukturalnie niedostępne tym
  seedem (finding C), zgłoszone jako poprawna reguła biznesowa, nie defekt.
- Pełnego `Carry forward` do przodu — poprawnie zablokowane brakiem cyklu
  `planned`/`drafting` w tym Programie; walidacja działa, ścieżka
  end-to-end (nowy cykl→realny carry) nieprzetestowana.
- Zachowania przy wielu równoczesnych użytkownikach edytujących ten sam
  Zestaw (poza sekwencyjną zmianą ról owner↔admin w tej samej przeglądarce).
- 40-punktowej listy czekowania TRIADA/SPEC-A (menu/kebab/dark+light) — ten
  program to workspace bez kebab-menu na wierszach w większości miejsc,
  odbiór wizualny osobno.
- Że seed `okr_vnext_checkin_occurrences` (2 okazje cadence wklejone ręcznie
  z bazy) reprezentuje UI realnego wyszukiwania okazji — pole wymaga
  ręcznego UUID, brak endpointu listującego (zgłoszone w treści formularza
  przez sam produkt: „this package hasn't the API endpoint yet”).

## 8. Czy ruszyłem coś poza allowlistą

**Nie.** Zmienione pliki (7, wszystkie w dozwolonych ścieżkach):
- `src/components/ResultsVNext/okr/ResultsOkrHub.tsx`
- `src/components/ResultsVNext/okr/OkrSetToolPage.tsx`
- `src/components/ResultsVNext/okr/OkrReviewReflectionView.tsx`
- `src/components/ResultsVNext/okr/okrWorkspaceApi.ts`
- `server/src/routes/resultsVnext/okr.routes.ts`
- `server/src/services/resultsVnext/okr/okrReflectionCommands.ts`
- `scripts/rn-g6-okr-gold-flow-proof.mjs` (nowy)
- `docs/qa/screens/rn-g6-okr/**` (nowe)
- ten dokument (nowy)

`okrCheckInCommands.ts`, `okrSetTypes.ts` — **nietknięte** (potwierdzone
`git diff` przed każdym commitem). `PostgresDatabase.ts`, trzy
`*.realdb.test.ts`, `20260810_fix_initiatives_status_default.sql` —
nietknięte. `src/components/standard/**`, `shared/**` — nietknięte.
`.claude/launch.json` — nieużyty (backend/frontend uruchamiane bezpośrednio
przez `npx`/Bash). `**/roi/**`,
`src/components/ResultsVNext/kpiScorecards/**`, `ResultsKpiRegistryPage.tsx`
— nietknięte. Żaden push/merge/deploy. Zero sub-agentów.

Postgres (PID `38806`) i cudze backendy/frontendy na portach
`3097`/`3197`/`3098`/`3198`/`3199` — zweryfikowane przed każdym potencjalnym
działaniem, **nigdy nie zabite**.
