# D4 — Realizacja (Northwind Manufacturing Ltd.), dowody

Paczka D4 programu „jedna baza pokazowa po angielsku"
(`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D4, §3.1 poz. 7).
Gałąź `mvp/dane-d4-realizacja`, baza `127.0.0.1:54418/consultify_kopia_d4`
(TEMPLATE `consultify_staging_kopia` + `01-rdzen.ts --apply` + `03-inicjatywy.ts --apply`).
Stanowisko: API 4184, Vite 3204, konto OWNER `james.whitfield@northwind.example`.

## Pliki

| Plik | Co zawiera |
|---|---|
| `dowod-cli.txt` | reset → verify(0) → dry-run → apply#1 → verify → apply#2 (0/0) → verify → verify paczki D3 |
| `pomiar-api.txt` | odczyty z ŻYWEGO API: realizacje, register, plan zasobów, sygnały, RAID, raporty, decyzje |
| `dowod-mutacja.txt` | testy bez bazy: GREEN → trzy mutacje RED → GREEN |
| `dowod-testy-i-tsc.txt` | wynik `vitest` i `tsc -p server/tsconfig.json --noEmit` |
| `pomiar-jezyka-innerText.txt` | surowy `innerText` ośmiu ekranów |
| `dlug-j7-polskie-napisy-ui.txt` | 49 linii POLSKIEGO INTERFEJSU (dane są po angielsku) — dług J7 |
| `01..08-*.png` | zrzuty 1440 jasny: Realizacje, Praca, Zasoby, Decyzje, Ryzyka, Sygnały, Kokpit, Raporty |

## Co jest w bazie po `--apply`

36 zadań (8 po terminie, 0 bez inicjatywy, 0 bez osoby, 0 bez projektu),
7 pozycji RAID przez kanonicznego writera (dual-write: `raid_items` +
`ie_aggregate_state`), 9 decyzji z 20 opcjami i 3 rozstrzygnięciami
(3 otwarte po terminie), 8 kamieni z planem bazowym i 2 udokumentowanymi
przesunięciami, 2 migawki `plan_baselines`, 2 opublikowane raporty statusu.
`--verify` = 31 asercji twardych, wszystkie przechodzą; `--verify` paczki D3
po D4 nadal 25/25.

## ŁAŃCUCH KANONICZNY przekazanie → `execution_case`: NIE POWSTAŁ

Zlecenie prosiło o `execution_case` dla każdej z 4 realizowanych inicjatyw.
**Nie da się go zbudować na tym zbiorze danych bez złamania zamrożonej bramki
paczki D3.** Poniżej pomiar, nie opinia.

### Gdzie się zatrzymuje

Jedynym twórcą agregatu `execution_case` jest akceptacja przekazania
(`server/src/domain/initiatives-execution/handoffAcceptance.ts:228-263`).
Nie istnieje `POST /execution-cases` — trasa `:4814` w
`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` to wyłącznie odczyt.
Żeby dojść do akceptacji, trzeba przejść całą sekwencję:

1. `initiative` musi mieć agregat w stanie `APPROVED_BACKLOG`
   (`scheduleDecision.ts:208` i `:299`: „Initiative is not APPROVED_BACKLOG").
2. Bramka harmonogramu wymaga OPUBLIKOWANEGO portfela, planu i analizy
   obciążenia oraz **okna planu dokładnie dla tej inicjatywy i dokładnie dla
   jej bieżącej wersji agregatu** (`scheduleDecision.ts:144-146`:
   „Exact Initiative planned window is missing").
3. Dopiero decyzja harmonogramu tworzy zamrożoną paczkę `handoff_package`
   i przestawia inicjatywę na `SCHEDULED` (`scheduleDecision.ts:355-389`, `:410`).
4. `initiative.handoff.request` wymaga `lifecycleState === 'SCHEDULED'`
   i dokładnie tej paczki (`handoffAcceptance.ts:90-97`).
5. `initiative.handoff.decide` musi być wykonana PRZEZ Execution Managera
   (`handoffAcceptance.ts:205-211`) i dopiero ona zakłada `execution_case`.

**Blokada jest w kroku 1.** Cztery inicjatywy realizowane w Northwind nie mają
agregatu `initiative` w ogóle — D3 świadomie ich nie zarejestrował, bo agregat
w `APPROVED_BACKLOG` PRZYKRYWA status wiersza klasycznego (DEC-397,
`src/contracts/initiatives-execution/statusMapping.ts:20`) i lista pokazałaby
„In execution 0". Rejestracji nie da się wykonać, bo `register` odrzuca
`IN_EXECUTION`:

```
POST /api/initiatives/runtime-v1/planning/initiatives/<MES Rollout Line 3>/register
→ 400 {"error":{"code":"INITIATIVE_NOT_PLANNABLE","rule":"INITIATIVE_NOT_PLANNABLE"}}
```

(`server/src/domain/initiatives-execution/registerModuleInitiativeForPlanning.ts:38`
— `PLANNABLE_MODULE_STATUSES = ['APPROVED','PENDING_APPROVAL']` — odmowa rzucana w `:103-106`; pełny
odczyt w `pomiar-api.txt` §2, a `plannable-initiatives` w §3 wymienia wyłącznie
cztery inicjatywy `APPROVED`.)

### Dlaczego obejście też jest zamknięte

Obejście („przestaw status na `APPROVED` → zarejestruj → przeprowadź łańcuch →
wróć na `IN_EXECUTION`") wymaga dodatkowo okna planu dla tych czterech
inicjatyw. Opublikowany plan Northwind ma **dokładnie cztery okna i są to okna
czterech INNYCH inicjatyw** (tych w `APPROVED`). Żeby dołożyć okna, trzeba albo
rozszerzyć ten plan, albo opublikować drugi. Obie drogi łamią zamrożone asercje
paczki D3 (`server/scripts/seed/demo-en/03-inicjatywy.ts`):

| Asercja D3 | Linia | Co ją łamie |
|---|---|---|
| `plany OPUBLIKOWANE = 1` | `:1301-1308` | drugi opublikowany plan |
| `inicjatywy w oknach opublikowanego planu = 4` | `:1311-1319` | rozszerzenie planu do 8 okien |
| `agregaty runtime-v1 założone inicjatywom IN_EXECUTION = 0` | `:1281-1288` | 4 nowe agregaty |
| `agregaty „initiative" NIE w stanie APPROVED_BACKLOG = 0` | `:1291-…` | agregaty przechodzą w `SCHEDULED`, potem `IN_EXECUTION` |

Trzecia i czwarta asercja D3 są **zbyt szerokie**: chronią przed realnym
defektem („agregat w `APPROVED_BACKLOG` przykrywa `IN_EXECUTION` na liście"),
ale zakazują też stanu poprawnego. `statusMapping.ts:22` mapuje
`lifecycleState = 'IN_EXECUTION'` na status `IN_EXECUTION` — po pełnym łańcuchu
lista pokazałaby prawdę. **To jest decyzja dla nadzorcy, nie dla robotnika D4:**
albo D3 zwęża dwie asercje (do „agregat w APPROVED_BACKLOG/SCHEDULED na
inicjatywie IN_EXECUTION = 0") i przyjmuje plan z ośmioma oknami, albo łańcuch
kanoniczny zostaje poza zakresem bazy pokazowej.

**D4 nie łamie D3 po cichu.** Zakładka „Realizacje" jest niepusta bez
`execution_case` — `ExecutionHub.tsx:1339-1360` bierze inicjatywy po statusie
ALBO realizacje kanoniczne; zrzut `01-realizacje-lista-light.png` pokazuje
cztery wiersze, w tym „On hold".
