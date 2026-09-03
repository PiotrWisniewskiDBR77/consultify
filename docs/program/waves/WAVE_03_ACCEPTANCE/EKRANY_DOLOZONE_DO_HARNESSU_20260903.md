# Ekrany dołożone do harnessu dev-render — 2026-09-03

Dyżur: "dziewięć ekranów bez wpisu w harnessie" (zlecenie nadzorcy, marker
worktree `9feb14565b`, gałąź `agent/harness-ekrany-20260903`).

## Kontekst

Zlecenie wskazywało dziewięć ekranów produkcyjnych bez wpisu w
`dev-render/main.tsx`: `DecisionsPanelContent`, `CanonicalInitiativeRegister`,
`KpiQueueView`, `MyTasksListContent`, `ResultsInitiativesView`,
`ResultsKpiReportsView`, `ResultsReportingEnterpriseViews`, `FocusView`,
`ReportsHub`. Zlecenie samo zastrzegało: "Jeśli lista jest inna niż moja —
pracuj na swojej i napisz to."

## K1 — weryfikacja listy (wynik inny niż zlecenie)

Sprawdzenie każdego z dziewięciu dało wynik **inny niż punkt wyjścia**:
tylko **trzy** naprawdę wymagały nowego wpisu, jeden był już efektywnie
pokryty (pod inną nazwą), a **pięć okazało się nieosiągalnych**.

### Wymagały wpisu (3) — DODANE

| Ekran | Plik komponentu | Wołacz/trasa produkcyjna |
|---|---|---|
| `DecisionsPanelContent` | `src/components/MyWork/DecisionsPanelContent.tsx` | `MyWorkHub.tsx:135` import, `:4202` mount (zakładka Decyzje, `/my-work/decisions`) |
| `MyTasksListContent` | `src/components/MyWork/MyTasksListContent.tsx` | `MyWorkHub.tsx:159` import, `:4093` mount (zakładka Zadania, `/my-work/tasks`) |
| `ReportsHub` | `src/components/Reports/Management/ReportsHub.tsx` | `AppRoutes.tsx` lazy import `ManagementReportsHub`, trasa `/reports/management` (`ROUTES.REPORTS.MANAGEMENT`, `routeConfig.ts:125`) |

### Już efektywnie pokryty — BEZ nowego wpisu (1)

**`CanonicalInitiativeRegister`** (`src/components/Initiatives/CanonicalInitiativeRegister.tsx`).
Grep po literalnej nazwie komponentu w `dev-render/` faktycznie nic nie
zwracał — ale ekran `dev-render/screens/inicjatywy-lista.tsx` (zarejestrowany
w `main.tsx` jako `inicjatywy-lista`) montuje realny `<InitiativesHub>`, a
`InitiativesHub`'s domyślny `viewMode` to `'table'`
(`DEFAULT_INITIATIVES_VIEW_MODE = 'table'`,
`src/components/Initiatives/initiativesViewDefaults.ts:1`) — co renderuje
DOKŁADNIE `<CanonicalInitiativeRegister>` (`InitiativesHub.tsx:1932`).
Ekran jest więc już mierzony pod bramką G06, tylko pod etykietą niezwiązaną
z nazwą komponentu (ten sam wzorzec odkrywalności, jaki `inicjatywy-lista.tsx`
sam opisuje we własnym komentarzu nagłówkowym z 2026-08-30). **Nie dodano
duplikatu** — zmiana nazwy istniejącego wpisu jest poza zakresem tego
dyżuru (ryzyko złamania innych odwołań/pomiarów do klucza `inicjatywy-lista`).

### Nieosiągalne — bez wpisu (5)

Cztery pliki są **fizycznie usunięte z `src/`** (nie tylko wyłączone flagą):

| Ekran | Status |
|---|---|
| `KpiQueueView` | usunięty w commicie `57e96bb5e9` ("chore(results): warstwa 5 — 19 węzłów drzewa"), 2026-09-02, jako martwy kod osierocony po usunięciu ResultsHub |
| `ResultsInitiativesView` | usunięty w tym samym commicie |
| `ResultsKpiReportsView` | usunięty w tym samym commicie |
| `ResultsReportingEnterpriseViews` | usunięty w tym samym commicie |

`git log --all --diff-filter=D` potwierdza usunięcie; commit jest przodkiem
HEAD tego worktree (`git merge-base --is-ancestor` = TAK). Pliki nie
istnieją NIGDZIE w drzewie — zero ścieżki do dodania wpisu harnessu dla
czegoś, czego nie ma.

Piąty — **`FocusView`** (`src/components/MyWork/Focus/FocusView.tsx`) —
istnieje w `src/`, ale jest **martwy w praktyce**: `MyWorkHub.tsx:190-192`
go leniwie importuje (`const FocusView = lazyWithRetry(...)`), lecz **żadne
miejsce w `src/` go nie renderuje** (`grep -rn "<FocusView" src/` = 0
trafień; dla porównania `<HomeView` z tego samego bloku lazy-importów DAJE
trafienie na linii 3982). Komentarz w kodzie to potwierdza wprost
(`MyWorkHub.tsx:4292`: "Focus tools should not leak across tabs (legacy —
kept for FocusView if reused)"). To wzorzec z pamięci programu "Wołacz
istnieje ≠ renderuje się" — wołacz (import) jest żywy, ale komponent nigdy
nie trafia na ekran użytkownika. Ekran nieosiągalny nie potrzebuje wpisu w
harnessie.

## K2 — wzorzec

Przeczytane ekrany referencyjne: `partner-portal.tsx` (12 wpisów w
rejestrze, wariant przez `?wariant=`, `window.fetch` stub scoped po
substringach URL), `mywork-inbox.tsx`/`mywork-calendar.tsx` (montują REALNY
`<MyWorkHub>` w `<AppProviders>`, `useNavigate` + `replace:true` zamiast
`<Route>` — bo `parseMyWorkPathIntent()` w hubie czyta `location.pathname`
bezpośrednio), `inicjatywy-lista.tsx` (montuje REALNY `<InitiativesHub>`,
`AppProviders` już owija `BrowserRouter`), `decision-record.tsx`/
`karta-task.tsx` (podmiana metod na singletonie `Api`/`V8*Api` zamiast
przechwytywania na poziomie `window.fetch`, gdy wywołanie idzie przez
metodę bezpośrednio, nie przez `Api.get`).

Wspólny mechanizm: (1) `seedRealisticSession()` (`dev-render/mocks/seedStore.ts`)
odblokowuje pełne drzewo providerów (`currentUser.id = 'user-piotr-demo'`);
(2) mock kładzie się NA KONKRETNYCH metodach wywoływanych przez komponent,
sprawdzonych w źródle (nie jeden uniwersalny kształt `window.fetch`); (3)
rejestr w `main.tsx`: `const XScreen = React.lazy(() => import('./screens/x'))`
+ wpis w obiekcie `SCREENS` z `label`/`render`.

## K3 — dołożone wpisy (commit po każdym)

1. `dev-render/screens/mywork-decisions.tsx` → klucz `mywork-decisions`
   (commit `a7abcee705`)
2. `dev-render/screens/mywork-tasks.tsx` → klucz `mywork-tasks`
   (commit `2ba1fb989f`)
3. `dev-render/screens/reports-hub-management.tsx` → klucz
   `reports-hub-management` (commit `49f2e1498e`)

### `mywork-decisions` — DecisionsPanelContent

Montuje `<MyWorkHub>` na `/my-work/decisions`. Mockuje `Api.getDecisions`
(8 decyzji), `Api.getUsers` (4 osoby), `Api.getDecision`/`Api.get('.../brief')`
(dla podglądu po kliku w wiersz) — kontrakt z interfejsu `Decision`
zweryfikowanego w źródle (`DecisionsPanelContent.tsx:137-167`). Łagodzi
znany przelotowy montaż `<InboxContent>` (fallback-tab przy świeżym wejściu
na inną zakładkę — udokumentowany już w `mywork-calendar.tsx`) mockiem
`V8MyWorkApi.getCanonicalInboxTable/Stats/materializeCanonicalInbox`.

Dane atrapowe: 8 decyzji z uniwersum demo Zenit/Grupa Termika/NordFarm/
Bielmar/Kolej Wschodnia (zespół Piotr/Anna/Marek/Kasia), pokrywające
statusy PENDING/ESCALATED/DEFERRED/APPROVED/REJECTED, wszystkie priorytety,
typy (GO_NO_GO/BUDGET_APPROVAL/SCOPE_CHANGE/…), oraz obie strony liczników
zakładki ("Moje do decyzji" / "Moje prośby").

### `mywork-tasks` — MyTasksListContent

Montuje `<MyWorkHub>` na `/my-work/tasks`. Mockuje `Api.getPersonalTasks`
(8 zadań), `Api.getDataContext` (kontrakt `DataContextSummary`,
`services/api.ts:647`), `Api.get('/my-work/focus/state')`. To osobny ekran
od istniejących `karta-task.tsx`/`karta-task-pelna.tsx`, które montują
pojedynczą KARTĘ zadania i celowo zwracają `Api.getPersonalTasks = async ()
=> []` — nie pokrywają widoku LISTY.

Dane atrapowe: 8 zadań z tego samego uniwersum demo, statusy todo/
in_progress/review/blocked/done, wszystkie priorytety, terminy
przeterminowany/dziś/jutro/przyszły, assignee dla każdej z 4 osób zespołu.

### `reports-hub-management` — ReportsHub

Montuje `<ReportsHub>` bezpośrednio w `<AppProviders>` (moduł nie jest
zakładką huba, tylko własną trasą `/reports/management`). Mockuje `Api.get`
rozróżniając URL (`/history`, `/templates`, `/schedules`) na trzy oddzielne,
poprawnie ukształtowane koperty axios-like — kontrakt z `loadData()`
(`ReportsHub.tsx:172-193`).

Dane atrapowe: 6 raportów historycznych pokrywających wszystkie 5 typów
(`TEAM_MEETING`/`TEAM_WEEKLY`/`STEERING_COMMITTEE`/`PORTFOLIO_HEALTH`/`RAID`)
i wszystkie 4 statusy (`DRAFT`/`FINAL`/`APPROVED`/`ARCHIVED`), 2 szablony,
1 aktywny harmonogram.

## K4 — dowód renderowania

Zrzuty kanonicznym `scripts/dev/grafika-zrzuty.mjs` (Playwright, port 5312,
`--faza=PO`, klik domyślny w pierwszy wiersz przed zrzutem — otworzył
podgląd na wszystkich trzech ekranach, więc para light/dark pokazuje też
działający `PreviewPane`).

Ścieżki (lokalne, poza repo — `evidence/.gitignore`):
`/private/tmp/ag-harness-ekrany/evidence/grafika/harness-ekrany-20260903/`
- `mywork-decisions__PO__pl__1440__{light,dark}.png`
- `mywork-tasks__PO__pl__1440__{light,dark}.png`
- `reports-hub-management__PO__pl__1440__{light,dark}.png`

Kontrola par (próg luminancji 150, próg procentu różnych pikseli — para
identyczna/pusty biały kadr byłaby defektem):

| Ekran | różnica luminancji | % różnych pikseli |
|---|---|---|
| `mywork-decisions` | 218.3 | 99.98% |
| `mywork-tasks` | 220.0 | 99.98% |
| `reports-hub-management` | 221.3 | 100.0% |

Wszystkie trzy dalece powyżej progu 150 i blisko 100% różnych pikseli —
pary NIE są identyczne ani pustymi kadrami. 6/6 zrzutów wykonanych, **0
błędów konsoli**, **0 żądań 4xx/5xx** z atrapy (na świeżej karcie
przeglądarki — pierwsza karta w sesji przeglądarki pokazywała skumulowane
błędy z WCZEŚNIEJSZYCH nawigacji tej samej karty, nie z tego ekranu;
potwierdzone przez otwarcie nowej karty i powtórzenie pomiaru).

## Realne znaleziska produktu wykryte przy okazji

1. **`FocusView` — wołacz bez renderu.** `MyWorkHub.tsx:190-192` importuje
   leniwie `FocusView`, ale nic go nie renderuje (`grep "<FocusView" src/`
   = 0). Komentarz w kodzie (linia 4292) sam nazywa go "legacy — kept for
   FocusView if reused". Do rozstrzygnięcia przez właściciela: usunąć martwy
   import, czy dokończyć podłączenie.
2. **`CanonicalInitiativeRegister` nieodkrywalny po nazwie.** Ekran istnieje
   i jest mierzony (`inicjatywy-lista`), ale nazwa klucza/etykiety w rejestrze
   nie wspomina komponentu — dokładnie ten kształt awarii, który
   `inicjatywy-lista.tsx` sam opisuje w swoim nagłówku dla INNEGO ekranu
   sprzed tego dyżuru. Wart rozważenia: dopisanie aliasu/etykiety z nazwą
   komponentu przy następnej okazji dotykania tego pliku (poza zakresem
   tego dyżuru — zero zmian w `src/`, a zmiana nazwy klucza w `main.tsx`
   mogłaby złamać istniejące odwołania).
3. **Cztery pliki `Results/*` usunięte 2026-09-02, dzień przed tym
   zleceniem** (`57e96bb5e9`) — zlecenie oryginalne (sformułowane wcześniej)
   wskazywało je jako "żywe ekrany bez wpisu", ale były już martwym kodem w
   chwili zlecenia. Potwierdza zasadę programu "audyty starzeją się w ~3
   dni" — tu starzały się w mniej niż jeden dzień.
4. **`ReportsHub` ma niezlokalizowane etykiety zakładek** ("Reports" /
   "Templates" / "Schedules" / "Automation" / "New Report" widoczne po
   angielsku na polskim ekranie, mimo `&lang=pl`) — prawdopodobna dziura
   i18n w komponencie, nie w atrapie (reszta ekranu, w tym treść wierszy i
   panel podglądu, jest poprawnie po polsku). Nie naprawiane w tym dyżurze
   (zero zmian w `src/`), zapisane jako znalezisko.

## Commity (bez push)

```
a7abcee705  dev-render: dodaj wpis dla DecisionsPanelContent (mywork-decisions)
2ba1fb989f  dev-render: dodaj wpis dla MyTasksListContent (mywork-tasks)
49f2e1498e  dev-render: dodaj wpis dla ReportsHub (reports-hub-management)
```

Gałąź: `agent/harness-ekrany-20260903`, worktree
`/private/tmp/ag-harness-ekrany`, marker bazowy `9feb14565b`.

## Nie zdążono / poza zakresem

Wszystkie trzy ekrany wymagające wpisu (priorytet: `DecisionsPanelContent`
→ `MyTasksListContent` → `ReportsHub`) zostały dołożone i zweryfikowane w
tym dyżurze — lista wejściowa (9 pozycji) została w pełni rozstrzygnięta
(3 dodane, 1 już pokryty, 5 nieosiągalnych). Nie pozostało nic do zrobienia
z oryginalnej listy.
