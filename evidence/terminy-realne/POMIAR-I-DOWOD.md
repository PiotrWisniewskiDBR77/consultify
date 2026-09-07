# Terminy inicjatyw — pomiar, porządkowanie, dowód (07.09.2026)

Słowa właściciela: „A możesz poprawić terminy, żeby nie było takich głupot?
Po prostu zaktualizuj terminy na obecne. I naprawdę."

Bazy: **stanowisko** `127.0.0.1:54400/consultify_noc`, org DBR77
`cc9db573-260f-4a19-927f-f3cc1fbaea38` · **staging** `thomas.proxy.rlwy.net:52567`
(bez SSL), org DBR77 `a3e05d4a-5397-419d-b486-8e44366c0063`.
Produkcji `consultify.ai` **nie dotykano**.

---

## 0. SPROSTOWANIE ZAŁOŻENIA ZLECENIA — artefaktu „+40 / +65" NIE BYŁO W DANYCH

Zlecenie mówiło, że Legacy Decommission ma `+40`, ERP SAP Integration `+65`
i że plan Legacy to `27.07.2026 → 13.01.2027`. **Pomiar tego nie potwierdza —
na żadnej z dwóch baz.** Stan PRZED jakąkolwiek moją zmianą:

| Miara | stanowisko | staging |
|---|---|---|
| inicjatywy z `baseline_end_date ≠ planned_end_date` | **0** | **0** |
| inicjatywy z `schedule_shift_count ≠ 0` | **0** | **0** |
| wiersze w `initiative_rebaseline_log` | **0** | **0** |
| Legacy Decommission | `27.07.2026 → 4.12.2026`, baseline identyczny, odchylenie **0** | brak takiej inicjatywy |
| ERP SAP Integration | `1.08.2026 → 25.10.2026`, baseline identyczny, odchylenie **0** | brak |

Zrzut `PRZED-stanowisko-realizacje.png` pokazuje **same zera i „Na czas"** —
żadnego `+40`. Zgadza się to z własnym dowodem R3
(`evidence/r3-kamienie/POMIAR-I-DOWOD.md` §3): przesunięcia testowe wykonano
na **jednorazowej bazie `127.0.0.1:55611`** (kontener usunięty po teście), a
„Baza właściciela (54400) była czytana i **nie została zapisana**". `+40/+65`
istnieje wyłącznie na zrzucie dowodowym R3, nie w danych właściciela.
**Punkt 2 zlecenia (wyzerowanie artefaktu) nie miał więc czego zerować.**

## 1. CO NAPRAWDĘ BYŁO BEZ SENSU — rozkład PRZED

| Miara (na dziś 07.09.2026) | stanowisko (72 inicjatywy) | staging (97 inicjatyw) |
|---|---|---|
| bez obu dat planu | **57** | **81** |
| bez daty startu | 57 | 87 |
| bez daty końca | 57 | 81 |
| koniec planu w przeszłości | 0 | **16** |
| koniec przed startem | 0 | 0 |
| koniec absurdalnie odległy (> dziś+540 dni) | 0 | 0 |
| start absurdalnie dawny (< dziś−1095 dni) | 0 | 0 |
| odchylenie ≠ 0 | 0 | 0 |

Rozbicie na statusy PRZED (braki dat / koniec w przeszłości):

| Status | stanowisko | staging |
|---|---|---|
| IN_EXECUTION | 10 z 23 bez dat | 6 z 6 z brakiem, 2 z końcem w przeszłości |
| APPROVED | 10 z 12 bez dat | 2 z 2 z końcem w przeszłości |
| PENDING_APPROVAL | 16 z 16 bez dat | 3 z 4 bez dat, 1 z końcem w przeszłości |
| CLOSED | 9 z 9 bez dat | 5 z 5 bez dat |
| DRAFT | 9 z 9 bez dat | 64 z 65 bez dat, 1 z planem 13.02→17.03.2026 |
| REJECTED | 3 z 3 bez dat | 9 z 15 bez dat, 10 z końcem w przeszłości |

Obraz na ekranie: `PRZED-stanowisko-brak-dat.png` — wiersze „W realizacji"
i „Zamknięta" z napisem **„brak dat planu"**, odchyleniem „—" i szarym RAG
„Brak dat planu".

## 2. CO ZMIENIŁEM I WEDŁUG JAKIEJ ZASADY

Skrypt `server/scripts/napraw-terminy-inicjatyw.ts` (dry-run domyślnie,
`--org` obowiązkowe bez wartości domyślnej, `resolveOrg` odmawia gdy uuid nie
istnieje w bazie, kopia CSV przed każdym zapisem, jedna transakcja).

Reguła sensowności (dokładnie reguły właściciela, nic ponad):

* `IN_EXECUTION` → start w przeszłości **i** koniec w przyszłości,
* `APPROVED` / `PENDING_APPROVAL` → start w przyszłości albo najwyżej 30 dni temu, koniec w przyszłości,
* `CLOSED` → koniec w przeszłości,
* dla wszystkich: koniec ≥ start, koniec ≤ dziś+540 dni, start ≥ dziś−1095 dni,
* `DRAFT` / `REJECTED` → **nie ruszane** (właściciel nie dał dla nich reguły; brak dat w szkicu nie jest błędem),
* daty spełniające regułę zostają **nietknięte**.

Rozrzut nowych dat jest deterministyczny (SHA-1 z `id`), więc drugi przebieg
daje ten sam wynik: `IN_EXECUTION` start 3 tyg.–5 mies. temu, `APPROVED` start
za 10–50 dni, `PENDING_APPROVAL` za 30–90 dni, `CLOSED` koniec 10 dni–11 mies.
temu; czas trwania 120–329 dni (4–11 miesięcy).

W tej samej transakcji **plan bazowy = plan bieżący** (`baseline_* =
planned_*::text`, `baseline_set_at`, `schedule_shift_count = 0`). Bez tego samo
sprzątanie dat wyprodukowałoby fałszywy poślizg w kolumnie „Odchylenie (dni)".
Inicjatywy ze ŚLADEM DECYZJI w `initiative_rebaseline_log` są **pomijane** —
ich poślizg jest zatwierdzony i nie wolno go kasować sprzątaniem (dziś: 0).

Zapisano: **stanowisko 45 inicjatyw**, **staging 17 inicjatyw**. Kamienie
milowe, statusy, właściciele, `start_date`/`end_date`, `forecast_*`,
`actual_*` i dziennik re-baseline — **nietknięte**.

## 3. ROZKŁAD PO

| Miara | stanowisko | staging |
|---|---|---|
| bez obu dat planu | 12 (9 DRAFT + 3 REJECTED) | 69 (64 DRAFT + 5 REJECTED bez dat) |
| koniec planu w przeszłości | 9 (wszystkie CLOSED — zgodnie z regułą) | 16 (5 CLOSED + 10 REJECTED + 1 DRAFT) |
| koniec przed startem | 0 | 0 |
| absurdalnie odległe / dawne | 0 / 0 | 0 / 0 |
| `baseline ≠ plan` | 0 | 0 |
| `schedule_shift_count ≠ 0` | 0 | 0 |
| IN_EXECUTION niezgodne z regułą | **0** | **0** |
| APPROVED / PENDING_APPROVAL niezgodne | **0** | **0** |
| CLOSED niezgodne | **0** | **0** |

Liczby ekranowe policzone **modułem produkcyjnym** (`initiativeDeviationDays`,
`initiativeRag`) na wierszach z bazy, serializowanych 1:1 jak
`InitiativeController`:

* stanowisko: `green|0` × 60, `grey|null` × 12, **zero czerwonych**;
* staging: `green|0` × 27, `grey|null` × 69, `red|>0` × 1 (jeden **szkic**
  z planem 13.02→17.03.2026 — poza regułami właściciela, patrz ZNALEZISKA).

## 4. IDEMPOTENCJA

Drugi przebieg na obu bazach: `bez sensu … : 0`, `ZERO ZMIAN — terminy są już
zgodne z regułami`. Pliki: `dryrun-PO-stanowisko-idempotencja.txt`,
`dryrun-PO-staging-idempotencja.txt`.

## 5. SPRZECZNOŚĆ „+40 / Na czas" — CO ZOSTAŁO ROZSTRZYGNIĘTE

Sprzeczność jest realna i **wracała** przy każdym przesunięciu terminu:
`initiativeDeviationDays` mierzy poślizg od planu **bazowego**, a
`initiativeRag` mierzył wyłącznie dystans do **dzisiejszego** terminu. Wiersz
z terminem przesuniętym o 40 dni w przyszłość pokazywał `+40` crimsonem i
zielone „Na czas" naraz.

**Wybrano: RAG uwzględnia poślizg od planu bazowego** (`green → amber`, gdy
odchylenie > 0). Jedna zmiana, w jednym pliku, poza zamrożeniem
(`src/components/Execution/executionRealData.ts`).

Dlaczego to, a nie opisanie kolumn:

1. etykiety kolumn („Odchylenie (dni)", „Na czas") mieszkają w
   `src/components/Execution/ExecutionHub.tsx`, a moduł **06_EXECUTION jest
   ZAMROŻONY** (`docs/program/MVP_FINAL_ZAMROZONE.json`) — ich zmiana wymaga
   znacznika `[ODMROZENIE 06_EXECUTION DEC-<numer>]`, czyli decyzji właściciela;
2. opis usuwa nieporozumienie, nie sprzeczność — dwie liczby dalej mówiłyby
   przeciwne rzeczy o tym samym wierszu;
3. dziś nie zmienia **nic** widocznego (0 inicjatyw ma dodatni poślizg), więc
   nie może zepsuć odebranego ekranu; uzbraja tylko poprawne zachowanie na
   moment, gdy ktoś naprawdę przesunie termin;
4. **amber, nie red** — przesunięte zobowiązanie to ryzyko, nie stan krytyczny;
   czerwień zostaje dla terminu faktycznie przekroczonego (prawo UI §3).

**Nie zmieniano** etykiet ani nagłówków (zakaz „nie rób obu").

## 6. DEFEKT UJAWNIONY PRZEZ PORZĄDKI — inicjatywa ZAMKNIĘTA „Po terminie"

Reguła właściciela „zamknięta ma mieć koniec w przeszłości" natychmiast
odsłoniła drugi błąd formuły: 9 zamkniętych inicjatyw zaświeciło
**„+195 / +331 / +229" crimsonem obok RAG „Po terminie"** (zrzut pośredni), mimo
że plan bazowy był równy bieżącemu, czyli poślizgu nie było żadnego. Przyczyna:
`initiativeDeviationDays` liczy od `max(plan, DZIŚ)` — klauzula sensowna dla
pracy, która TRWA, i fałszywa dla pracy skończonej; `initiativeRag` malował
crimsonem każdy miniony termin.

Naprawa (ten sam, niezamrożony plik): inicjatywa terminalna
(`DONE`/`CANCELLED`/`ARCHIVED`, po normalizacji także `CLOSED`/`REJECTED`)
liczy odchylenie od swojego planu (bez `max(…, dziś)`) i nie jest „po terminie".
Gdy jest FAKT (`actualEndDate`), poślizg dalej jest pokazywany — test to pilnuje.

## 7. DOWÓD

| Plik | Co pokazuje |
|---|---|
| `PRZED-stanowisko-realizacje.png` (+ `.json`) | 1440, jasny, `/execution?tab=list&view=table`, kolumny Start/koniec planu · Odchylenie (dni) · RAG; `bledyKonsoli: []` |
| `PRZED-stanowisko-brak-dat.png` | wiersze „W realizacji"/„Zamknięta" z „brak dat planu" i szarym RAG |
| `PRZED-stanowisko-realizacje-pelna.png` | zakres „Wszystkie" (47 wierszy) przed zmianą |
| `PO-stanowisko-realizacje.png` (+ `.json`) | ten sam ekran po porządkach; `bledyKonsoli: []` |
| `PO-stanowisko-dawne-braki.png` | te same wiersze: mają daty, odchylenie 0, RAG „Na czas"; zamknięte bez crimsonu |
| `dryrun-PRZED-*.txt`, `apply-*.txt`, `dryrun-PO-*-idempotencja.txt` | pomiar, zapis, drugi przebieg = 0 zmian |
| `kopia-stanowisko-*.csv`, `kopia-staging-*.csv` | stan PRZED wszystkich wierszy (`id, status, planned_*, baseline_*, schedule_shift_count`) |

Testy: `src/components/Execution/__tests__/executionRealData.test.ts`
29 → 35 zielonych. Katalog `src/components/Execution/__tests__/` — 22 zielone /
3 czerwone **przed i po** zmianie (te same 5 przypadków; sprawdzone przez
podmianę obu plików na wersje z `HEAD`). `tsc` serwera: **0**. `tsc` frontu:
**200 przed = 200 po**.

## 8. ZNALEZISKA

1. **Baza `tsc` frontu w zleceniu (877) nie zgadza się z gałęzią** —
   `npm run type-check` daje tu **200** błędów, i tyle samo na `HEAD`.
2. **5 testów Realizacji czerwonych przed moją zmianą** (nie moja regresja):
   `ExecutionHub.daneRealne.source` (asercja `InitiativeStatus.BLOCKED`, a kod
   używa `isBlockedInitiative`), 2× `ExecutionSurfaces.hangingCase`,
   2× `ExecutionWorkSurface.ownerNames`.
3. **Jeden SZKIC na stagingu ma plan, który już wygasł** (13.02→17.03.2026) i
   liczy się jako „Po terminie", +173. Właściciel nie dał reguły dla `DRAFT`,
   więc go nie ruszałem; na ekranie Realizacji szkice i tak nie są listowane
   (zakres „Wszystkie" = 47 z 72 na stanowisku — bez `DRAFT` i `PENDING_APPROVAL`).
   Propozycja: albo szkic z wygasłym planem traktować jak `PENDING_APPROVAL`,
   albo czyścić mu daty.
4. **Staging ma 65 szkiców, w tym pięć duplikatów** „Wdrożenie predykcyjnego
   utrzymania ruchu (PdM)…" o różnych nazwach i statusie `CLOSED`.
5. **Kolumny planu mają różny typ w obu bazach**: `TEXT` na stanowisku,
   `timestamp` na stagingu (`baseline_*` w obu `TEXT`). Skrypt zrównuje baseline
   przez `planned_*::text`, więc format zostaje taki, jaki dana baza już trzyma.
6. **Staging nie ma jeszcze tego kodu.** Dane są uporządkowane na obu bazach, ale
   poprawka RAG/odchylenia dla inicjatyw zakończonych wejdzie na staging dopiero
   z wdrożeniem tej gałęzi — do tego czasu zamknięte inicjatywy będą tam
   pokazywać „Po terminie" i rosnący plus.
