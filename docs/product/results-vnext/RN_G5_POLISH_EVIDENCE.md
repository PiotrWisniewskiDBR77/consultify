# RN-G5 polish2 — dowody (2026-08-12)

Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g5-polish2`, gałąź `rn-g5-polish2`,
baza `35a1dee6c03b66907219b5b645e4e3ecb267f80a`.

## Zadanie 1 — kebab: pozycja destrukcyjna disabled wygląda na aktywną

**Status: ESKALOWANE, NIE naprawione w tym pakiecie** — przyczyna leży w
`src/components/shared/RowActionsMenu.tsx`, poza allowlistą tego zadania
(`src/components/standard/**` i `src/components/shared/**` — zakaz
dotykania, „eskaluj zamiast naprawiać"). Zgłoszenie: `spawn_task`
"Fix disabled-danger kebab item still reading as active" (task_1832bda3).

### Co zweryfikowano w `ResultsVNextLegacyArchivePanel.tsx` (allowlista, OK)
- `destructive: { label: 'Usuń'/'Delete', note: readOnlyReason }` — brak
  `onClick`, więc `StandardTable.buildSections` (linia ~318-334, poza
  allowlistą, ale kod już poprawny) liczy `disabled: !d.onClick` = `true`
  i `description: d.note`.
- Powód (D06) JEST podany: „Archiwum tylko do odczytu — brak zapisów w tej
  powierzchni." / „Read-only archive — no writes are possible on this
  surface." — potwierdzone testem i zrzutem.
- `disabled` (atrybut HTML) i `aria-disabled="true"` SĄ ustawione poprawnie.

### Zmierzony problem (real DOM, `getComputedStyle`, harness = realny komponent produkcyjny)
Panel bg light `rgb(248,250,252)`, panel bg dark `rgb(21,33,59)`.

| Pozycja | Motyw | Kolor tekstu (computed) | opacity | Kontrast złożony vs tło |
|---|---|---|---|---|
| Usuń (disabled, danger) | light | `rgb(193,4,47)` | 0.45 | **2.40:1** |
| Edytuj (disabled, neutral) | light | `rgb(15,23,42)` | 0.45 | 2.91:1 |
| Usuń — ENABLED referencja | light | `rgb(193,4,47)` | 1 | 6.03:1 |
| Usuń (disabled, danger) | dark | `rgb(237,85,65)` | 0.45 | **1.84:1** |
| Edytuj (disabled, neutral) | dark | `rgb(244,247,251)` | 0.45 | 4.10:1 |

Paradoks: matematycznie pozycja „Usuń" disabled ma NIŻSZY kontrast wobec tła
niż „Edytuj" disabled w obu motywach — a mimo to na zrzutach czytelnie
wygląda jak aktywna, czerwona pozycja obok wyraźnie wygaszonych szarych.
Czerwony odcień (hue) przetrwa 45% opacity znacznie lepiej percepcyjnie niż
neutralny szary, mimo niższego kontrastu w liczbach. Root cause:
`RowActionsMenu.tsx` stosuje `disabled:opacity-45` JEDNAKOWO dla każdego
wariantu, a `variantStyles.danger` (`text-danger-600 dark:text-danger-400`)
nie zmienia koloru na wygaszony/neutralny dla stanu disabled.

### Zrzuty (realny komponent, realny klik na kebab)
- `task1-kebab-pl-light.png` — 1440×900, jasny, kliknięty kebab pierwszego
  wiersza → widoczne „Usuń" jaskrawe różowo-czerwone, „Edytuj"/„Archiwizuj"
  wyraźnie wyszarzone.
- `task1-kebab-pl-dark.png` — 1440×900, ciemny, ten sam efekt.

(pliki w `docs/qa/screens/rn-g5-polish-2026-08-12/`, wygenerowane
`dev-render/shot.mjs` na realnym komponencie
`ResultsVNextLegacyArchivePanel`, mock danych z
`dev-render/screens/results-vnext-legacy-archive.tsx`)

## Zadanie 2 — surowy `err.message` backendu renderuje się użytkownikowi

**Status: NAPRAWIONE.**

### Nowy plik
`src/components/ResultsVNext/shared/errorMessage.ts` —
`toUserFacingErrorMessage(err, isPolish)`: 401/403 → ogólny komunikat D06
(bezpieczeństwo — nie ujawnia obiektu); `TypeError`/`status===0` → komunikat
sieciowy; reszta → ogólny „nie udało się, spróbuj ponownie". Surowy `err`
loguje się do `console.error` (telemetria) — NIGDY na ekran.

### Pełna lista wystąpień (`grep -rn "err instanceof Error ? err.message"`) i co się z nimi stało

| Plik:linia (PRZED) | Zamienione na |
|---|---|
| `ResultsKpiRegistryPage.tsx:485,549,565,586` | `toUserFacingErrorMessage(err, isPolish)` |
| `roi/RoiCaseDecisionWorkspace.tsx:61,75` | j.w. |
| `roi/ResultsRoiHub.tsx:187,198,233,272,304` | j.w. |
| `roi/RoiCaseModelWorkspace.tsx:282` (`messageOf` helper, 8 miejsc użycia) | `messageOf = (err) => toUserFacingErrorMessage(err, isPolish)` |
| `roi/RoiCaseLearnWorkspace.tsx:80` (`messageOf`, 7 miejsc użycia) | j.w. |
| `roi/RoiCaseRealizeValueWorkspace.tsx:104` (`messageOf`, 9 miejsc użycia) | j.w. |
| `kpiMeasurements/ResultsKpiMeasurementsPanel.tsx:84` (`errMessage`, moduł-poziom, 5 wywołań) | `errMessage(err, isPolish)` — dodano parametr, bo funkcja jest POZA komponentem (`isPolish` to prop, nie closure) |
| `okr/OkrCarryForwardDialog.tsx:92` | `toUserFacingErrorMessage(err, isPolish)` |
| `okr/OkrKeyResultsView.tsx:88,158,183` | j.w. |
| `okr/OkrAlignmentsView.tsx:82,100,113,283` | j.w. |
| `okr/OkrProgramsPage.tsx:95,138,146` | j.w. |
| `okr/OkrSupportView.tsx:116,151,188,439` | j.w. |
| `okr/OkrSetOverviewView.tsx:90` | j.w. |
| `okr/OkrObjectivesView.tsx:91,150,175` | j.w. |
| `okr/OkrCyclesPage.tsx:99,120,240` | j.w. |
| `okr/ResultsOkrHub.tsx:135` | j.w. |
| `okr/OkrHistoryView.tsx:49` | j.w. |
| `okr/OkrCheckInsView.tsx:87,121,143` | j.w. |
| `kpiTool/KpiToolPage.tsx:240,300,316,741,808` | j.w. |
| `kpiScorecards/ResultsKpiScorecardDetailPage.tsx:148,165,175,195` | j.w. |
| `kpiTool/KpiDeviationCaseSubview.tsx:209` (`loadCase`) | `toUserFacingErrorMessage(err, isPolish)` |
| `legacy/ResultsVNextLegacyArchivePanel.tsx` (wariant: `err instanceof LegacyArchiveApiError ? err.message : ...`) | `toUserFacingErrorMessage(err, isPolish)` — Task 1 file, ta sama wada |

### DWA świadome wyjątki (nie zamienione, uzasadnienie w kodzie)
1. **`kpiTool/kpiDeviationApi.ts` `deviationErrorDetail` + `KpiDeviationCaseSubview.tsx` `run()` (linia ~274)** —
   ten plik ma WŁASNY, udokumentowany w nagłówku kontrakt: odrzucenie
   maker-checker (`NOT_PLAN_REQUIRED`, samo-zatwierdzenie…) ma być pokazane
   **verbatim** — to nie jest ABAC-deny, tylko reguła biznesowa, użytkownik
   ma prawo poznać treść. Naprawiono TYLKO fallback (brak payloadu z
   serwera → dawniej surowy JS/network error): dodano flagę
   `isServerMessage` w `DeviationCaseErrorDetail`; `run()` pokazuje
   `detail.message` verbatim WYŁĄCZNIE gdy `isServerMessage`, inaczej
   `toUserFacingErrorMessage`.
2. **`okr/OkrReviewReflectionView.tsx` — 3 z 4 miejsc (linie 138, 167, 185)** —
   nagłówek pliku wprost mówi: błąd bramki Close jest „the honest source of
   truth, surfaced verbatim on failure rather than guessed" (klient nie zna
   `reflectionRequiredForClose` bez endpointu). Naprawiono TYLKO 1 miejsce
   (linia ~102, `load()` — zwykłe ładowanie listy, bez związku z regułą
   bramki). Pozostałe 3 (`run()`, request-changes, carry-forward) to zapisane
   świadomie business-rule surfacing, tożsame uzasadnienie jak (1) —
   NIEZMIENIONE, bo zamiana na ogólny komunikat usunęłaby jedyny sposób,
   w jaki użytkownik dowiaduje się DLACZEGO akcja jest zablokowana.

### Zrzuty (realny komponent, realny fetch 500, harness = `dev-render/screens/results-vnext-legacy-archive.tsx?state=error`)
8 kombinacji PL/EN × light/dark × 1440/1280 w
`docs/qa/screens/rn-g5-polish-2026-08-12/task2-error-*.png`:
- PL/light/1440: „Nie udało się wykonać tej operacji. Spróbuj ponownie."
- EN/light/1440: „Something went wrong completing this action. Please try again."
- PL/dark/1280, EN/dark/1280, PL/dark/1440, PL/light/1280, EN/light/1280,
  EN/dark/1440 — wszystkie potwierdzone identycznym wzorcem, retry-CTA
  obecny w każdej.
- Żadna z 8 nie zawiera "Internal server error" ani innego surowego tekstu
  backendu.

### Retry
Kliknięcie „Spróbuj ponownie"/„Try again" ponawia `listLegacyArchiveIndex`
(potwierdzone w przeglądarce: druga pozycja `[ResultsVNext] request failed`
w konsoli po kliknięciu; oraz testem jednostkowym
`retry (Spróbuj ponownie) faktycznie ponawia wywołanie`).

## Testy

`tests/resultsVnext/shared/errorMessage.test.ts` — 8/8 passed (funkcja
czysta: PL/EN, D06 401/403 generic, network TypeError/status 0, non-Error
thrown, telemetria console.error).

`tests/components/ResultsVNext/ResultsVNextLegacyArchivePanel.test.tsx` —
5/5 passed (realny komponent, mock TYLKO `listLegacyArchiveIndex`):
- błąd 500 → NIE renderuje "Internal server error", renderuje komunikat
  tłumaczalny + retry
- retry faktycznie ponawia wywołanie (drugi call mocka)
- błąd 403 → ogólny komunikat D06, nie ujawnia szczegółu backendu
- kebab „Usuń" na wierszu tylko-do-odczytu: disabled + aria-disabled + powód
- klik disabled „Usuń" nic nie robi

### Kontrola negatywna (oba pliki testowe)
`errorMessage.test.ts`: zepsuto 2 asercje (oczekiwany string podmieniony na
fałszywy, `console.error` argument-match podmieniony) → 2/8 czerwone z
poprawnym komunikatem różnicy → cofnięto → 8/8 zielone.

`ResultsVNextLegacyArchivePanel.test.tsx`: zepsuto 2 asercje (`getByText`
tekst-widmo zamiast prawdziwego komunikatu; `.not.toBeDisabled()` zamiast
`.toBeDisabled()`) → 2/5 czerwone (drugie z realnym zrzutem DOM w output,
pokazującym że element FAKTYCZNIE jest disabled) → cofnięto → 5/5 zielone.

## Bramki

| Bramka | Wynik |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` | patrz sekcja niżej — uruchomione z pełnym logiem |
| `npx vite build` | patrz sekcja niżej |
| `scripts/check-list-canon.sh` | **exit 0** — dług SPADŁ 409→408 (nie wzrósł) |
| `scripts/check-artefakt.sh` | **exit 0** |
| `grep -rn "window\.(prompt|confirm|alert)(" src/components/ResultsVNext/` | 1 trafienie, W KOMENTARZU (`OkrCarryForwardDialog.tsx:4` — opisuje co kod ZASTĘPUJE), zero realnych wywołań |
| `git diff --check` | czyste, exit 0 |

## Czego to NIE dowodzi
- Że wizualny problem kebaba (Zadanie 1) jest naprawiony — jest tylko
  ZMIERZONY i ESKALOWANY; realna naprawa wymaga zmiany w
  `src/components/shared/RowActionsMenu.tsx`, poza allowlistą tej sesji.
- Że WSZYSTKIE ~60 miejsc `err.message` w całym ResultsVNext mają identyczną
  jakość komunikatu biznesowego — 2 pliki (4 miejsca łącznie) świadomie
  zostawiają server-authored business-rule text verbatim, bo ich własna
  dokumentacja mówi że to zamierzone; to inny kompromis niż "zero raw
  backend text", udokumentowany osobno.
- Że retry/error UI wygląda dobrze na urządzeniach mobilnych — nie badano
  (poza zakresem zadania, który mówił 1440/1280).
- Że kontrast 2.40:1/1.84:1 disabled-danger jest zgodny z jakimkolwiek
  formalnym progiem WCAG — WCAG 1.4.3 wyłącza "inactive UI components" z
  wymogu kontrastu; problem tu jest PERCEPCYJNY (hue-salience), nie prawny.
