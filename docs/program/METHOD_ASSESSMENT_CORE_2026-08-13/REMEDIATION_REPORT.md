# ASSESSMENT — raport z remediacji (6 strumieni)

> Odpowiedź na reklasyfikację do `ASSESSMENT_TECHNICAL_CANDIDATE`.
> Punkt startowy: `eb3e2b5c85`.

---

## STRUMIEŃ 1 — czysta historia

| Pole | Wartość |
| --- | --- |
| Gałąź czysta | `codex/method-assessment-clean-20260813` |
| Backup refs | `backup/assessment-preclean-20260813` → `eb3e2b5c85`, `backup/assessment-s8-preclean-20260813` → `a032eec4c2` |
| Narzędzie | `git-filter-repo 2.47.0` (doinstalowane) |
| Usunięte bloby | **2**, razem **248 MB** |

### ★ Dlaczego NIE uruchomiłem filter-repo na repo głównym

`git worktree list` → **331 worktree**. `filter-repo` na współdzielonym `.git`
przepisałby gałęzie **wszystkich innych sesji** i unieważnił każdy z tych worktree.
Zrobiłem to na **izolowanym klonie** (`--no-local`, żeby przepisywanie nie mogło
tknąć obiektów źródłowych), a wynik sprowadziłem `git fetch` jako **nową** gałąź.
Stara gałąź nietknięta.

### ★ Pierwsze podejście było BŁĘDNE i to wyłapałem

Domyślne `filter-repo` przepisało **9229 z 10163 commitów — włącznie z baseline**
(`f3e7df565e` → `17ed6723d3`). Taka gałąź nie dzieli historii z `origin/demo`,
czyli byłaby **niescalalna** (udokumentowana pułapka „gałąź o niepowiązanej
historii: tylko cherry-pick"). Powtórzyłem z `--refs f3e7df565e..HEAD`.

### Dowody po poprawnym przebiegu

| Kontrola | Wynik |
| --- | --- |
| baseline istnieje i jest przodkiem | **TAK** — historia wspólna z demo zachowana |
| commitów kandydata | **136** (bez zmian) |
| HAR osiągalny z HEAD | **0** |
| bloby > 5 MB unikalne dla kandydata | **0** |
| różnica drzewa HEAD vs stary kandydat | **dokładnie 1 wpis** (usunięty HAR) |
| `git cat-file -t <blob>` | `could not get object info` — obiekty **nie istnieją** |

★ **Znalazłem drugi HAR, o którym nie wiedziałem**: `e2e-drd-2026-08-13` (56,7 MB)
był **nadal śledzony w HEAD** — wcześniej wypiąłem tylko ten 192 MB.

### Mapa SHA
`136/136` commitów przemapowanych, **0** pominiętych, **0** usuniętych.
Pełna mapa: `/tmp/sha-map-kandydat.tsv` (stary → nowy).

---

## STRUMIEŃ 2 — osiem niezielonych testów

Wszystkie **8** pochodziło z **jednego** pliku `teresaContractCycle.live.test.ts`.

| Klasyfikacja | Liczba |
| --- | ---: |
| introduced | **0** |
| pre-existing | **0** |
| fixed | **0** |
| flaky | **0** |
| **warunkowo pomijane (wymagają żywego serwera)** | **8** |

**Rozwiązanie:** nie wyciszyłem ich i nie osłabiłem asercji — **uruchomiłem naprawdę**
przeciw żywemu serwerowi. Front **337/337**, zakres dotknięty **538/538**,
zero pominiętych, `--retry=0`. Utrwalone jako `npm run test:method-core:front:live`.

### ★ Przy okazji: bramka serwera MIGOTAŁA

| | |
| --- | --- |
| Objaw | 2 z 5 przebiegów czerwone: `Parse Error: Expected HTTP/`, `createSession failed: 200 {}` (200 z **pustym** ciałem zamiast 201), `socket hang up` |
| Hipoteza | zweryfikowana przed naprawą: pojedynczy plik **w izolacji** padał 3 z 6 razy → to nie kolizja między plikami |
| Przyczyna | `supertest` podnosi **nowy efemeryczny listener na KAŻDE** `request(app)`. W bramce było **145** takich wywołań. Przy `load average 482` na 16 rdzeniach → wyczerpanie zasobów sieciowych |
| Naprawa | **jeden** nasłuchujący serwer na plik (`app.listen(0)` + `close`). **145 → 5** listenerów |
| Dowód | **6/6** przebiegów `170/170` exit 0, przy porównywalnym obciążeniu |

★ Zero retry, zero quarantine, zero osłabiania asercji.

---

## STRUMIEŃ 3 — niezależne MPQ

Dwóch audytorów, **żaden nie był autorem ocenianych zmian**, osobne worktree.

### ★ Ustalenie, które unieważnia mój wcześniejszy raport

`MethodReportView` i `MethodPresentationView` miały **ZERO callerów produkcyjnych**
— tylko barrel i testy. Klient po zamrożeniu sesji widział **panel debugowy**:
surowy `contentHash`, pełne UUID, cztery gołe `<p>`.

**Moje wcześniejsze „Report 30/30, Presentation 30/30" oceniało HARNESS, nie produkt.**
To ta sama pułapka „prawdziwy ekran vs harness", którą sam wcześniej piętnowałem.

### Wyniki pierwszego niezależnego odbioru

| Widok | Light | Dark | Próg | Werdykt |
| --- | ---: | ---: | ---: | --- |
| Sessions | 29 | 29 | 27 | **PASS** |
| Library | 26 | 26 | 27 | FAIL |
| Work View | 25 | 25 | 27 | FAIL |
| Output | 15 | 15 | 27 | FAIL |
| Report (produkcja) | 13 | 13 | 29 | FAIL |
| Initiative Proposal | 16 | 16 | 27 | FAIL |
| Presentation | — | — | 29 | **NOT_IMPLEMENTED** |
| Live Artifact | — | — | — | **NOT_IMPLEMENTED** |

### Naprawy wykonane po odbiorze

| Defekt | Naprawa |
| --- | --- |
| Report/Presentation osierocone | podłączone do `FrozenOutputView`; **nowa sekcja Prezentacji** (wcześniej nie istniała) |
| `MethodReportView` `<h1>` = etykieta zakresu | `<h1>` to teraz **wniosek**; zakres schodzi do metadanych |
| stopka bez liczby dowodów i klauzuli | dodane (miał je już `MethodPresentationView`) |
| `1A`/`1B` na slajdach | nazwy jednostek (podaje warstwa DRD) |
| przeciek pierścienia fokusu na dzieci w nawigatorze | selektor bezpośredniego dziecka |
| brak focus ring na zakładkach osi i selektorze aktora | dodany + `aria-current` |

★ **Teza audytu o `tailwind.config.js` została EMPIRYCZNIE OBALONA** —
`.ring-c-focus` kompiluje się poprawnie, a defekt był już naprawiony wcześniej;
audyt mierzył stan sprzed tamtego commitu. Agent **nie „naprawił" czegoś, co nie
było zepsute** — znalazł za to inny, realny błąd.

★ Przy podłączaniu Prezentacji **sam wprowadziłem defekt** (nagłówek slajdu jako
surowy UUID, wykres się nie rysował, bo podałem zagnieżdżoną mapę zamiast płaskiej).
Wyszło przy oglądaniu zrzutu; poprawione i przerenderowane.

---

## STRUMIEŃ 4 — prawdziwy browser E2E

**13 / 14 PASS.** Dane wprowadzane przez UI; SQL wyłącznie do potwierdzenia.

| Scenariusz | Werdykt |
| --- | --- |
| DRD pełny łańcuch (19 kroków, 2 restarty) | PASS |
| SIRI — bramka gotowości odmawia startu | PASS (**dowód działania bramki**) |
| Teresa Intent→Preview→Commit | PASS |
| voice transcript tym samym API | PASS |
| offline → realny reconnect → **RECOVERED** | **PASS** |
| dwie karty + CAS/409 | PASS |
| stale version · duplicate submit · cross-org · unauthorized | PASS |
| send-back · reopen (`content_hash` identyczny) · supersession | PASS |
| **błąd Report/Presentation + retry** | **FAIL → naprawione** |

★ Badge **RECOVERED jest realnie osiągalny** — niezależne potwierdzenie naprawy
`refresh({preserveStatus})` z poprzedniej fali.

★ Defekt #14: nieudane `generateReport()` kończyło się unhandled rejection i
**zerowym śladem na ekranie**. Dodany kanał `actionError` (osobny od `status`,
żeby nie chować warsztatu przy zdrowej sesji) + test regresyjny, który **pada na
starej logice**.

★ **BLOKADA:** „Library → Session" **przez naturalny klik w aplikacji jest martwe**
— patrz `COORDINATION_REQUIRED_REJESTRY.md`. Agent miał zakaz obchodzenia tego
SQL-em i **nie obszedł**.

---

## STRUMIEŃ 5 — readiness

Pełna macierz: `READINESS_MATRIX.md`.

| Wymiar | DRD | SIRI |
| --- | --- | --- |
| Technical | **PASS** | **PASS** |
| Methodology | **BLOCKED** | **BLOCKED** |
| Legal | n/d | **BLOCKED** |
| Runtime | warunkowe (flagi OFF) | warunkowe |

`canStartSession()` = **false** dla obu. Demo-bypass **nie zmienia**
`method_packs.readiness` — dowiedzione testem przed i po całym przepływie.

---

## STRUMIEŃ 6 — rejestr dowodowy

Pełny: `EVIDENCE_LEDGER_TESTS.md`.

**Liczba „+380" była BŁĘDNA** (pochodziła z szerszego przebiegu całego `src`).
Odtwarzalna, zmierzona identyczną komendą po obu stronach: **+384** w **47 nowych
plikach**, **0** plików zmienionych, **0** usuniętych.

★ Przy liczeniu wyszło, że sond `zz-opus` było **sześć, nie dwie**. Pięć niosło
asercje **nośne** (bramka roli D1, dowód że `byGroup` się nie zmienił, determinizm
bez cache, no-leapfrog SIRI) — **awansowane** do właściwych nazw, 13 `console.log`
usuniętych. Dwie w pełni pokryte — skasowane.
