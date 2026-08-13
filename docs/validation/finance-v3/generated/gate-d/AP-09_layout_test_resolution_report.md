# AP-09 — rozstrzygnięcie sprzecznych raportów o teście layoutu 1280 px

Data: 2026-08-10 · Gałąź: `codex/finance-v3-gate-a-20260809` · Worktree: `gate-a-20260809`

## 1. Po co ten dokument

Dwa raporty tego samego dnia podały wykluczające się liczby dla jednego pliku testowego:

| Raport | Commit | Twierdzenie |
|---|---|---|
| `AP-09_10_11_workspace_contracts_report.md` | `7ba33e3c6d` | `workspaceContracts.test.ts` — **80/80 zielone** |
| `VALUATION_ADVISOR_GENERATOR_report.md` | `b440f35844` | `src/services/finance` — 350 testów, **349 pass / 1 fail**: `workspaceContracts.test.ts > … fits every module at 1280 px` → `analysis: needs 1484px of 1280px` |

Commit `b440f35844` siedzi NA WIERZCHU `7ba33e3c6d`, więc na pierwszy rzut oka nowszy pomiar
unieważniał starszy. Ten dokument ustala fakt pomiarem, nie lekturą raportów.

## 2. Fakt — realne uruchomienie na HEAD

HEAD = `b440f35844`. Drzewo robocze czyste (żadnych zmian w plikach śledzonych),
`git stash list` nie zawiera niczego dotyczącego `workspace/`.

```
cd server && npx vitest run src/services/finance/workspace/__tests__/workspaceContracts.test.ts
  Test Files  1 passed (1)
       Tests  80 passed (80)
```

Uruchomione **trzykrotnie** — 80/80 za każdym razem. Test jest deterministyczny.
(Uruchomienie z roota repo daje „No test files found" + exit 1 — to fałszywy sukces,
którego tu nie użyto.)

**Wniosek: na HEAD test NIE pada. Raport AP-09 jest prawdziwy, raport Valuation Advisora
opisuje stan, który już nie istniał w momencie jego własnego commita.**

## 3. Przyczyna rozbieżności

Nie jest to niedeterminizm, nie jest to regresja wniesiona przez Valuation Advisora,
i nie jest to pomiar na innym commicie w sensie „starszej gałęzi". To **wyścig o drzewo robocze
we wspólnym worktree**:

1. `git show b440f35844 --stat` — commit Valuation Advisora dotyka **trzech** plików:
   `valuationAdvisorService.ts`, `valuationAdvisorService.pg.test.ts`,
   `VALUATION_ADVISOR_GENERATOR_report.md`. **Zero plików w `workspace/`.** Zgodnie z raportem.
2. Znaczniki czasu: `7ba33e3c6d` = 09:14:54, `b440f35844` = 09:16:45 — **1 minuta 51 sekund
   różnicy**. Regresja `src/services/finance`, którą wykonał Valuation Advisor, jest z definicji
   wcześniejsza niż jego commit, czyli została uruchomiona **przed 09:14:54** — gdy pakiet AP-09
   leżał w tym samym drzewie roboczym jako pliki nieśledzone, w trakcie edycji.
3. Vitest zbiera pliki z dysku, nie z indeksu gita — więc pomiar Valuation Advisora złapał
   **pierwszą, błędną wersję estymatora**, tę samą, którą AP-09 opisuje jako odrzuconą
   (§4.4: „Pierwsza wersja `estimateWorkspaceBarLayout` rezerwowała sztywne 60 znaków … i orzekła,
   że Analysis potrzebuje 1484 px z 1280").
4. Potwierdza to nazwa testu w komunikacie błędu: `fits every module at 1280 px`. Na HEAD
   ten test nazywa się `leaves room for the artifact name at 1280 px in every module (no overlap)`.
   Valuation Advisor cytuje **nazwę sprzed przepisania** — dowód, że mierzył wersję pośrednią.

Raporty nie są więc w istocie sprzeczne: raport Valuation Advisora sam zastrzega, że awaria
pochodzi z „untracked, in-progress package belonging to a parallel session … outside this package's
allowlist and never imported by it", i podaje wynik z jego pominięciem (272/272). Sprzeczność
powstała dopiero przy zestawieniu samych nagłówkowych liczb.

## 4. Rozstrzygnięcie merytoryczne — test czy estymator?

Sprawdzone niezależnie od obu raportów, przeciw źródłu:

`FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md:107` brzmi dosłownie:
„przy 1280 px i nazwie 60 znaków **brak nakładania**; maksymalnie pięć bezpośrednich controls
po prawej; 200% zoom pozostaje operacyjny".

Kryterium mówi „brak nakładania", nie „pełne 60 znaków widoczne". Nazwa artefaktu jest jedynym
elastycznym elementem paska; skrócenie z tooltipem to zaprojektowane zachowanie, nie nakładanie.
Model, który rezerwuje sztywne 60 znaków i sumuje do 1484 px, mierzy pasek, którego nikt nie zbuduje.

**Właściwa poprawka to poprawka TESTU (i modelu estymatora), nie „naprawa paska" — i ona już jest
w kodzie na HEAD.** Stan zastany na `7ba33e3c6d`:

- `fits` = `treść stała + minimum nazwy (120 px) ≤ viewport` — to jest kryterium „brak nakładania";
- `fitsWithoutTruncation` / `displayableNameChars` — pełne 60 znaków raportowane **osobno**,
  jako wejście dla kroku wizualnego, nie jako pass/fail;
- test dodatkowo pilnuje **podłogi czytelności**: `displayableNameChars >= 24` dla każdego modułu;
- test przypina zbiór modułów pokazujących pełne 60 znaków do `['statements', 'valuation']` —
  regresja w którąkolwiek stronę zaczerwieni test.

**Żadna zmiana kodu nie była potrzebna. Nic w `workspace/` nie zostało zmodyfikowane.**

## 5. Udokumentowana długość nazwy per moduł (1280 px, najgorszy przypadek)

Odczytane z realnego uruchomienia (prefiks `Nieaktualne ·` poszerza CTA):

| Moduł | Treść stała | Nazwa dostaje | Znaków | Pełne 60 znaków? |
|---|---:|---:|---:|---|
| `statements` | 754 px | 527 px | **70** | tak |
| `valuation` | 806 px | 474 px | **63** | tak |
| `analysis` | 960 px | 320 px | **42** | nie — skraca |
| `baselineModel` | 960 px | 320 px | **42** | nie — skraca |
| `prediction` | 1020 px | 260 px | **34** | nie — skraca |

Minimum kontraktowe: **24 znaki** (podłoga egzekwowana testem) oraz 120 px szerokości nazwy
(`minNamePx`, poniżej tego `fits` = false). Najciaśniejszy realny moduł (`prediction`, 34 znaki)
ma 140 px zapasu ponad minimum.

Pełne 60 znaków mieści się wyłącznie tam, gdzie nawigacja widoków zeszła z paska. Trzy moduły
z zakładkami w pasku skracają — to konsekwencja reguł odchudzania z addendum §7, decyzja świadoma,
nie usterka. Krok wizualny musi ją potwierdzić skracaniem + tooltipem.

## 6. Kontrola negatywna — test potrafi pójść na czerwono

Zielony test nic nie dowodzi, dopóki nie pokaże się, że umie paść. Mutacja: wydłużenie etykiety
zakładki `Modele/Wyniki` w `predictionAdapter` o 21 znaków (rośnie `viewNavigationPx`).

```
FAIL … leaves room for the artifact name at 1280 px in every module (no overlap)
AssertionError: prediction: fixed 1185px, name gets 95px = 12 chars (target 60):
                expected false to be true
Tests  3 failed | 77 passed (80)
```

Test zaczerwienił się z **dokładnym, diagnostycznym komunikatem** (ile pikseli, ile znaków, który
moduł). Mutacja cofnięta, 80/80 przywrócone. Estymator nie jest atrapą.

Zastrzeżenie z AP-09 podtrzymane: estymator **nie jest testem renderowania**. „Brak nakładania"
udowodni wyłącznie realny zrzut przy 1280 px, robiony przez wykonawcę zanim właściciel zobaczy ekran
(`CLAUDE.md` reguła 7). Estymator to tani bezpiecznik w CI, nie odbiór wizualny.

## 7. Regresja całego `src/services/finance` po rozstrzygnięciu

```
cd server && npx vitest run src/services/finance
  Test Files  12 passed | 9 skipped (21)
       Tests  253 passed | 103 skipped (356)
```

**Zero czerwonych.** 103 pominięte i 9 pominiętych plików to pakiety wymagające realnego
PostgreSQL — bez `RUN_DB_TESTS=1` pomijają się jawnie (nie są cichą atrapą). Ten pakiet
(`workspace/`) jest czystą logiką i nie wymaga bazy.

Różnica względem „350 testów" z raportu Valuation Advisora (356) wynika z innego stanu pakietu
`workspace/` w chwili tamtego pomiaru oraz z tego, że tamta sesja miała podniesiony własny
efemeryczny klaster PG.

## 8. Stan poboczny — zgłoszony, nie naprawiany

- **`lineageService.ts:177` TS2322 NADAL ISTNIEJE** na tej gałęzi:
  `Type '{ ok: false; code: "LINEAGE_CYCLE_REJECTED" | "ASSUMPTION_SNAPSHOT_HASH_REQUIRED" | "ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN"; message: string; }' is not assignable to type 'InsertEdgeResult'`.
  Poza allowlistą tego zadania (`canonical/**`); naprawa miała iść równolegle w innym worktree
  i tutaj jeszcze nie wylądowała. To jedyny błąd `tsc` dotyczący tego pliku.
- W trakcie sesji w drzewie roboczym pojawił się **nieśledzony** plik
  `server/migrations/20260810_finance_v3_d01c_real_company_integrity_fix.sql` (znacznik 09:21),
  zapisany przez równoległą sesję do tego samego worktree. **Nietknięty i niescommitowany** —
  poza allowlistą. Uwaga: to ten sam mechanizm współdzielonego drzewa, który wywołał rozbieżność
  opisaną w §3.

## 9. Nauka operacyjna

Dwie sesje pracujące w **jednym worktree** mierzą sobie nawzajem pliki nieśledzone. Regresja
całego poddrzewa uruchomiona przez sesję B złapie pliki sesji A w połowie edycji i zaraportuje
awarię, której nie ma w żadnym commicie. Zanim ogłosi się rozbieżność raportów za sprzeczność:
uruchomić test na HEAD, porównać **nazwę** padającego testu z nazwą w kodzie (rozjazd nazwy
zdradza pomiar wersji pośredniej) i sprawdzić `--stat` podejrzanego commita.
