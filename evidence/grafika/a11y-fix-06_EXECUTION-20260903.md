# G06 — naprawa dostępności (axe), moduł 06_EXECUTION — 2026-09-03

Robotnik naprawczy programu odbioru G06. Worktree `/private/tmp/ag-fix-a11y-05-08`,
gałąź `agent/fix-a11y-05-08-20260903`, harness na porcie 5331.

## Wynik: PRZED → PO

| Ekran | PRZED (pl-1440, kadrów z realnym naruszeniem / 2) | PO (pl-1440) | PO (en-1024) |
|---|---|---|---|
| exec-summary-onelook | **1/2** | 0/2 | 0/2 |
| execution-report-day11 | **2/2** | 0/2 | 0/2 |
| execution-tab-control | 0/2 | 0/2 | 0/2 |
| execution-tab-list | **1/2** | 0/2 | 0/2 |
| execution-tab-resources | 0/2 | 0/2 | 0/2 |
| execution-tab-rollout | 0/2 | 0/2 | 0/2 |
| execution-tab-summary | 0/2 | 0/2 | 0/2 |
| execution-tab-work | 0/2 | 0/2 | 0/2 |
| **Razem (kadrów z naruszeniem / 16)** | **4/16** | **0/16** | **0/16** |

Jedna reguła realna w całym module: `color-contrast` (impact: `serious`,
łącznie 11 węzłów na 4 skażone kadry).

## Mapa: reguła → komponent → plik

Wszystkie cztery naruszenia sprowadzają się do JEDNEJ przyczyny: płaskie
sygnałowe tokeny (`text-c-danger` #e80538, `text-c-warning` #a3541c,
`text-c-text-muted` #64748b) renderowane na jasnych/tintowanych tłach.
Zmierzone niezależnie (relatywna luminancja WCAG): `text-c-danger` daje
tylko **4.66:1 nawet na czystej bieli** — każde stonowane tło (wiersz
tabeli, tintowany badge) zepchnie go poniżej progu 4,5:1.

- **`src/components/Execution/ExecutionSummaryOneLook.tsx`** — `riskBand()`/
  `decisionBand()` zwracały `text-c-danger` dla etykiety „Krytyczne"
  (4.08:1 na tle wiersza tabeli #f0f0f1) oraz `ownerName`/`context`
  (`text-c-text-muted`, 4.17:1 na tym samym tle).
- **`src/components/Execution/reports-intelligence/WorkIntelligenceReport.tsx`**
  — `SEVERITY_BADGE_CLASS.red`/`.amber`: badge „Krytyczne"/„Ostrzeżenie" na
  WŁASNYM 14%-owym tincie tła (`color-mix(...)`) — light 3.5:1 (red) /
  4.31:1 (amber), dark 4.0:1 (red).
- **`src/components/Execution/ExecutionHub.tsx`** — 2× identyczny badge
  „Zablokowane" (`bg-c-danger/10 text-c-danger`), 3.88:1.

## Naprawa

Naprawa LOKALNA per plik/użycie — bez zmiany globalnych `--c-danger`/
`--c-warning` (dziesiątki innych wywołań w aplikacji, poza zakresem tego
dyżuru):

- `text-c-danger` → `text-danger-700 dark:text-c-danger` (skala Tailwind,
  nie token CSS-var) — `danger-700` (#910A28) daje 6.9-8.1:1 na wszystkich
  trzech zmierzonych tłach light; `dark:text-c-danger` zostaje bo
  `#ed5565` już przechodzi na ciemnym tle (4.0:1 → nie, patrz niżej —
  `WorkIntelligenceReport` dark też wymagał zmiany).
- `WorkIntelligenceReport.tsx` dark: `text-danger-300` (#E0B2A7, 7.3:1 na
  ciemnym tle badge'a) — jedyne miejsce gdzie dark też był pod progiem
  (4.0:1 na WŁASNYM 14%-tincie, inaczej niż pozostałe dark-warianty).
- `text-c-warning` (amber badge, tylko light) → literal `text-[#8a4517]`
  (5.64:1 na tym tle) — brak gotowej skali `warning-700` w
  tailwind.config.js, więc wąski literal zamiast nowego globalnego tokenu.
- `text-c-text-muted` → `text-slate-600 dark:text-c-text-muted` (6.65:1) —
  identyczny wzorzec jak w naprawie 01-04 (`FilterableTable.tsx` i in.,
  commit `39dd82d301`). Trzecie wystąpienie tej samej klasy w tym samym
  pliku (karty kamieni milowych, tło `bg-c-surface` = biel) NIE zostało
  ruszone — zweryfikowane liczbowo, już przechodzi 4.76:1.

Wszystkie zamienniki zweryfikowane liczbowo (formuła WCAG relative
luminance) na DOKŁADNYCH parach fg/bg zmierzonych przez axe — nie
zgadywane. Zero zmiany layoutu (zrzut PO, `exec-summary-onelook` +
`execution-report-day11`, light+dark, 1440px) — tylko odcień
czerwieni/bursztynu/szarości nieco ciemniejszy.

Commit: **54d107e035** — `fix(a11y): 06_EXECUTION — color-contrast na
tokenach sygnalowych`.

## Komendy pomiaru

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5331 \
  --ekrany=exec-summary-onelook,execution-report-day11,execution-tab-control,execution-tab-list,execution-tab-resources,execution-tab-rollout,execution-tab-summary,execution-tab-work \
  --katalog=06-execution-przed --faza=PRZED --jezyk=pl --szerokosc=1440 \
  --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=<poza repo> --wynik-json=<poza repo>/wynik.json

# analogicznie --faza=PO --jezyk=pl --szerokosc=1440
# analogicznie --faza=PO --jezyk=en --szerokosc=1024
```

## Surowe dane (poza repo, nie commitowane — screenshoty)

- `/private/tmp/ag-fix-a11y-05-08-artefakty/06_EXECUTION/przed-pl-1440/`
- `/private/tmp/ag-fix-a11y-05-08-artefakty/06_EXECUTION/po-pl-1440/`
- `/private/tmp/ag-fix-a11y-05-08-artefakty/06_EXECUTION/po-en-1024/`

Selektory/html węzłów zdobyto osobnym diagnostycznym przelotem axe (nie
commitowanym, replikującym dokładnie tę samą sekwencję interakcji co
narzędzie kanoniczne), bo `grafika-zrzuty.mjs` zapisuje w `wynik.json`
tylko `id`/`impact`/liczbę węzłów.

## Konsola / błędy sieci

Brak błędów konsoli poza standardowym szumem 404 na `/api/**` (harness bez
backendu). Brak innych błędów HTTP.

## Co NIE zostało naprawione i dlaczego

Nic — moduł 06_EXECUTION ma 0 realnych naruszeń axe na wszystkich 8
ekranach, oba motywy, oba warianty język/szerokość (pl-1440, en-1024).
