# 1.12-R2 — pomiar przed naprawą i po (2026-09-06, stanowisko lokalne, org DBR77)

Baza: `consultify_noc` (127.0.0.1:54400). Własny serwer API na 4110 (kod z tego
worktree), własny vite na 3101. Konto: audyt@dbr77.local.

## KROK 0 — trzy warstwy „Zasoby wiszą" + brak podaży

| # | Miejsce (plik:linia PRZED) | Co zmierzono |
|---|---|---|
| a | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` — trasa `GET /runtime-v1/execution-cases` | sekwencyjna pętla `for (…) { await findById(); await authorize(); }` = **1 + N zapytań**. Zmierzone licznikiem między czytnikiem a pulą: 6 realizacji → **7 zapytań**, 12 realizacji → **13 zapytań** |
| b | `src/components/Execution/executionCaseFanOut.ts:26` | `EXECUTION_CASE_FANOUT_TIMEOUT_MS = 12_000`, ale `Promise.all` czeka na NAJWOLNIEJSZĄ → pierwszy wiersz po 12 s (zmierzone testem: 3017 ms bez wiersza przy limicie testu 3 s) |
| c | `src/components/Execution/ExecutionResourcesSurface.tsx` — `load(id)` | goły `Promise.all([readExecutionCase, readOperationalAllocations, readExecutionWork])` **bez `AbortSignal` i bez limitu** |
| d | `src/hooks/useDeferredLoading.ts:11-13` | po 15 s `ErrorState variant="timeout"` — właściciel widział „szkielet na zawsze", bo nie czekał 15 s |
| e | `server/src/services/workloadCapacityService.ts` (`getCapacityTimeline`) | podaż = `COUNT(DISTINCT user_id) FROM initiative_resources × 40 h` |

### Skąd „obłożenie 0 %" — liczby z żywej bazy

```
initiative_resources = 0
project_members      = 0
users                = 31
tasks                = 84   (81 z osobą, 84 z estimated_hours)
execution_case       = 0
handoff_package      = 0
```

Popyt BYŁ. Podaży nie było — bo jedyne jej źródło (`initiative_resources`)
jest puste, a `users` nie miało żadnego pola godzinowego
(sprawdzone w katalogu bazy: `user_availability` = obecność w czacie,
`organization_members` = rola/status, `initiative_resources.allocation_percentage`
= przydział do inicjatywy, nie etat).

## PO naprawie — runtime (nie testy)

`GET /api/execution-control/capacity/resource-plan?weeks=8` (konto DBR77):

```
osób 9 · wierszy 72 (osoba × tydzień) · tygodni 8
popyt 1042 h · podaż 2720 h · obłożenie 38 %
przeciążonych tygodni-osób 11 (np. Jan Zieliński 84/40 h = 210 %)
```

Pełna odpowiedź: `resource-plan-runtime.json`.

## Zrzuty (1440, light, realna trasa `/execution?tab=resources`)

| Plik | Co pokazuje | `url` | `bledyKonsoli` |
|---|---|---|---|
| `01-zasoby-lista.png` | tabela z realnymi wierszami, 6 kolumn wg C2, pasek „stan na", CTA „Dodaj dostępność" | `/execution?tab=resources&view=table` | 0 |
| `02-zasoby-podglad-osoby.png` | podgląd osoby-tygodnia (popyt/podaż/luka/zadania/przydziały) | j.w. | 0 |
| `03-dodaj-dostepnosc.png` | dialog „Dostępność · Marek Nowak" (godziny tygodniowo + dostępność %) | j.w. | 0 |

### Czego NIE ma na zrzutach — uczciwie

Stanu „ta realizacja nie odpowiada" **nie da się odtworzyć na tym stanowisku**:
w DBR77 jest 0 realizacji, a żadnej nie da się utworzyć jednym kontem
(patrz STOP w meldunku). Dowodem tego stanu jest test komponentu
`ExecutionResources.wiszacaRealizacja.test.tsx` z nierozwiązującym się fetchem —
i to jest dowód TESTOWY, nie runtime'owy. Nie udaję, że jest inaczej.
