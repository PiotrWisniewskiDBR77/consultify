# F-M1 — pomiar PRZED (baza: `origin/staging`, SHA `fb6f73e5aedc14e49be2a53e1bb335d4ed7dccf1`)

Metoda: naiwny grep słów ze stop-listy (§10) na `src/components/Finance/**` +
`src/components/Economics/**` daje 300+ trafień, w większości fałszywych
(słowa "Draft"/"Approved"/"Delete"/"Status" jako identyfikatory kodu,
komentarze, i angielskie wartości domyślne `t('klucz', 'English default')`,
które są POPRAWNYM zachowaniem dla locale `en`). Poniższa lista to wynik
ręcznej weryfikacji: dla każdego trafienia sprawdzono (a) czy string trafia
faktycznie na ekran nieopakowany w `t()`, i (b) czy komponent ma REALNEGO
importera (grep w `src/`), zgodnie z Golden Rule 1 CLAUDE.md.

## A. Raw string literal w JSX (nigdy nie przechodzi przez `t()`)

| # | Plik:linia | Tekst | Realny caller? |
|---|---|---|---|
| 1-21 | `src/components/Economics/FinanceValuePanelsSurface.tsx:80-100` | mapa `LABELS` — 21 angielskich nazw paneli | TAK — renderowane w `FinanceHub.tsx` (za flagą `isFinanceValuePanelsEnabled`) |
| 22 | `FinanceValuePanelsSurface.tsx:116` | `aria-label="Valuation analysis panels"` | j.w. |
| 23 | `FinanceValuePanelsSurface.tsx:131` | `"Loading panel…"` | j.w. |
| 24 | `src/components/Finance/StatementValidationBadges.tsx:41` | `aria-label="Validation results"` | TAK — `FinancialStatementPackWorkspace.tsx` |
| 25 | `src/components/Economics/charts/DistributionHistogram.tsx:78` | `aria-label="NPV distribution histogram — no data"` | TAK — `MonteCarloNpvPanel.tsx` |
| 26 | `DistributionHistogram.tsx:93` | `aria-label="NPV distribution histogram"` | j.w. |
| 27 | `src/components/Economics/FinancePreviewPanel.tsx:583` | `{statement.readinessStatus \|\| 'pending'}` — surowy kod backendu (`pending`/`recoverable`/`ready`/`rejected`) wypisany wprost | TAK — panel podglądu w `FinanceHub.tsx` |

## B. Klucze `t()` bez wpisu w `pl` (spadają na angielski default)

| Klucz | Domyślny (EN) tekst w kodzie | Plik |
|---|---|---|
| `common.status.draft`/`.review`/`.approved` | Draft / In Review / Approved | `FinanceHub.tsx:1602-1606` — **kolizja strukturalna**: `common.status` jest już STRINGIEM `"Status"` (używanym w 5 innych modułach), więc `common.status.draft` nigdy nie może się rozwiązać, niezależnie od tego, co dopiszemy do `pl.json` |
| `finance.blocked` | "Access to the Finance module is restricted…" | `FinanceHub.tsx:4079` |
| `finance.model.manualModeNotice` | "No source statement — historical lines…" | `CreateModelModal.tsx:270` |
| `finance.model.seededFromManualBaseline` | "Manual / prepared baseline" | `FinancialModelWorkspace.tsx:1113` |
| `finance.model.manualBaselineHint` | "This model uses a manually prepared baseline…" | `FinancialModelWorkspace.tsx:1118` |

(5 kluczy, nie 7 z pierwotnego szacunku F1 §3 — dwa z domniemanych siedmiu,
`finance.blocked` i `manualModeNotice`, były wcześniej liczone osobno w tej
samej piątce; realna, zmierzona liczba brakujących kluczy pl = **5**.)

## C. Klucze z angielską/hybrydową treścią w `pl` (zweryfikowane, nie zgadywane)

| Klucz | Wartość w `pl` (PRZED) |
|---|---|
| `finance.toast.statementConfirmed` | "Statement potwierdzony" |
| `finance.m16.sensitivity.addDriver` | "+ driver" |
| `finance.model.valuateModel` | "Wycen model" |

(F1 §3 szacował 17 takich kluczy; pełny skan `t(klucz, default)` w obu
katalogach — patrz `scan3.mjs` w scratchpadzie — znalazł tylko te 3 GENUINE
przypadki. Reszta domniemanych 17 to angielskie zapożyczenia identyczne w
obu językach: "Status", "Import", "Model", "Plan", "KPI", "Delta", "Min",
"ROE", "Reset" — już poprawnie po polsku, fałszywy alarm audytu F0.)

## D. Kody enum renderowane bez pełnego pokrycia resolvera

- `statusChip.*` (współdzielony resolver `EntityStatusChip`/`statusChipLabel`,
  używany przez kolumnę STATUS w `FinanceHub.tsx`): brakowało 5 wpisów —
  `recoverable`, `needs_changes`, `ready_for_review`, `superseded`,
  `invalidated` — czyli 5 z 8 wartości `BusinessVersionStatus` + 1 z 4
  wartości readiness. Bez wpisu funkcja spada na mechaniczną humanizację
  (`"ready_for_review"` → `"Ready for review"`) — poprawna gramatycznie
  angielszczyzna widoczna w polskim UI, nie surowy kod.
- `statementReadinessCopy.ts` (`REASON_COPY`, 14 realnych kodów z
  `financialStatementPackService.ts` `reasonCodes.push`): brakowało 5 —
  `INVALID_PERIOD_COUNT`, `INVALID_MEMBER_COUNT`, `MISSING_PERIOD_STATEMENT`,
  `INCONSISTENT_ENTITY`, `INCONSISTENT_SOURCE`. Bez wpisu funkcja i tak NIE
  pokazuje surowego kodu (fallback: zdanie ogólne "wymaga przeglądu"), więc
  to nie jest naruszenie §4, ale traci precyzję komunikatu.

## E. Znalezisko poza zakresem naprawy — martwy kod (zero realnych importerów)

Zweryfikowano `grep -rln <ComponentName> src` poza własnym plikiem i własnym
`Economics/index.ts` (który sam nie ma importerów):

- `src/components/Economics/EvidencePanel.tsx` — 0 importerów
- `src/components/Economics/ExcelImportWizard.tsx` — 0 importerów
- `src/components/Economics/VersionHistoryPanel.tsx` — 0 importerów

Te trzy pliki wymieniał F1 §11 jako cele (m.in. "Delete", "Select category
(optional)", "Nazwa analysis", "Historia version") i faktycznie zawierają
dziesiątki nieopakowanych, częściowo hybrydowych angielsko-polskich napisów
("Nadaj name importowanej analysesie", "Typ file"). Nie są jednak
osiągalne z żadnej realnej trasy — `Economics/index.ts` je re-eksportuje,
ale nic w `src/` nie importuje z tego barrelu te trzy nazwy. Zgodnie z
CLAUDE.md Golden Rule 1 ("weryfikuj realny caller") ich naprawa NIE wchodzi
do tej paczki — zerowy efekt dla użytkownika, realne ryzyko: dodatkowe
150+ linii zmian w kodzie, który nigdy się nie renderuje. Zostawione jako
osobne znalezisko dla właściciela (czy usunąć, czy podłączyć).
