# Weryfikacja rodziny "podgląd nie sięga do dołu" — 2026-09-03 (dyżur 48)

Zlecenie: dokończyć rodzinę TableWithPreviewLayout/PreviewPaneShell (rejestr
`REJESTR_PODGLAD_RODZINA_20260902.md`) — dla każdej z 6 zmierzonych luk
rozstrzygnąć produkt/przyrząd i naprawić wzorcem `flex-1 min-h-0`.

Marker startowy: `26d905569a`. Worktree: `/private/tmp/ag-podglad-48`,
branch `agent/podglad-48-20260903`, port 5308.

## Wynik K1 — co REALNIE zostało do zrobienia: NIC z sześciu

Między rejestrem z 02.09 a startem tego dyżuru (ten sam marker `26d905569a`)
wszystkie 6 pozycji z luką zostało już naprawionych commitem
`1381442787` ("fix(podglad): dolozyc flex-1 min-h-0 wokol TableWithPreviewLayout
(Capacity/Plan/ChatSignals)") + towarzyszącymi poprawkami hostów harnessu
(`finance-hub.tsx`, `vault-safes-table.tsx`, `execution-report-day11.tsx` —
`min-h-screen`/`80vh` → `h-screen`/`100vh`). Ten dyżur był więc **weryfikacją
kanonicznym przyrządem**, nie naprawą — zero zmian w `src/`.

## K2/K4 — rozstrzygnięcie produkt/przyrząd + pomiar PRZED(rejestr 02.09)/PO(dziś)

| pozycja | rejestr 02.09 | dziś (`--wysokosc`, port 5308) | rozstrzygnięcie |
| --- | ---: | ---: | --- |
| FinanceHub.tsx | 263 px LUKA | **0 px OK** | PRZYRZĄD — host `dev-render/screens/finance-hub.tsx` miał `min-h-screen` (tylko `min-height`); poprawiony na `h-screen`. Zero zmian w `FinanceHub.tsx`. |
| VaultSafesTable.tsx | 200 px LUKA | **0 px OK** | PRZYRZĄD — host `vault-safes-table.tsx` miał `80vh` (mniejszy niż pełny viewport); poprawiony na `100vh`. Zero zmian w `VaultSafesTable.tsx`/`ClientDocumentsVault.tsx`. |
| ExecutionReportsSurface.tsx (trasa samodzielna) | 216 px LUKA | **0 px OK** | PRZYRZĄD — host `execution-report-day11.tsx` miał `min-h-screen p-4`; poprawiony na `h-screen p-4`. Zero zmian w `ExecutionReportsSurface.tsx` (który już mierzył 0 px przez realną trasę Menu 1). |
| CapacityScenarioSurface.tsx | 67 px LUKA | **0 px OK** | PRODUKT — `<section>` miał tylko `p-4` (zero flex/h-full); dołożono `flex h-full min-h-0 flex-col` + owinięcie `TableWithPreviewLayout` w `<div className="flex-1 min-h-0">`. |
| PlanScenarioSurface.tsx | 92 px LUKA | **0 px OK** | PRODUKT — `TableWithPreviewLayout` owinięty w `<div className="flex-1 min-h-0">`, wzorcem `ExecutionResourcesSurface.tsx:418-437`. |
| ChatSignalsFeed.tsx | 58 px LUKA | **58 px "LUKA" — ale NIE defekt, patrz niżej** | Owinięty poprawnie (`flex-1 min-h-0`), ale przyrząd mierzy realną, zamierzoną przestrzeń przycisku paginacji "Pokaż starsze" — patrz K2b. |

Pomiar źródłowy dzisiejszy (dwa uruchomienia, drugie na rozgrzanym Vite —
pierwsze dało 5 fałszywych "BRAK PANELU" na `execution-tab-resources`,
`execution-tab-work`, `agent-hub` przez zimny start kompilacji, nie przez
defekt — zniknęły przy drugim przelocie):

```
node scripts/dev/measure-preview-canon.mjs --port=5308 --wysokosc
Zmierzonych ekranow: 19. Panel NIE siega do dolu na: 1 (ChatSignalsFeed — patrz K2b).
```

## K2b — ChatSignalsFeed: przyrząd mówi prawdę o liczbie, ale liczba nie jest defektem

Inspekcja DOM (`javascript_tool`, viewport 1600×1000, po kliknięciu wiersza):
korzeń `ChatSignalsFeed` (`flex h-full min-h-0 flex-col`) ma **3 dzieci**
w kolumnie flex, nie 2:

1. pasek filtrów/chipów — 105 px,
2. `<div className="flex-1 min-h-0"><TableWithPreviewLayout>...` — 787 px
   (poprawnie rozciągnięty flex-growem),
3. `<button className="m-3 ...">{t('chatSignals.action.loadMore')}</button>`
   — 34 px + 24 px marginesów = 58 px, renderowany **warunkowo, gdy
   `feed.nextCursor` jest ustawiony** (`ChatSignalsFeed.tsx:394-401`, "Pokaż
   starsze").

105 + 787 + 58 = 950 px = dokładnie wysokość korzenia. Layout jest
matematycznie poprawny — cała wysokość jest rozliczona, nic się nie zapada.
Przycisk paginacji to TRZECI, realny element listy (nie stopka poza
kanonem), więc karta podglądu (prawa kolumna) kończy się w tym samym
miejscu co tabela (lewa kolumna) — dokładnie NAD przyciskiem, symetrycznie.
Zrzut (`evidence/grafika/podglad-48-20260903/chat-signals-feed__PO__pl__1600__{light,dark}.png`)
potwierdza to okiem: panel i tabela kończą się równo, przycisk "Pokaż
starsze" zajmuje pełną szerokość poniżej obu kolumn — dokładnie jak w
`FinanceHub`/innych ekranach z akcją zbiorczą pod tabelą.

**Wniosek: to NIE jest rodzina "podgląd nie sięga do dołu".** Kanoniczny
przyrząd mierzy odległość od `wrapper.bottom` do dołu WIDOKU (pomniejszonego
o padding), a nie do dołu WŁASNEGO KONTENERA FLEX, więc nie odróżnia
"zapadniętego layoutu" od "layoutu z legalnym trzecim elementem pod spodem".
To jest różnica od poprzednich 5 pozycji: tam żadnego trzeciego elementu nie
było, brakowało tylko `flex-1 min-h-0`. Zero zmian w `ChatSignalsFeed.tsx`
— nie ma czego naprawiać. Nie modyfikowałem przyrządu (dopisanie wyjątku dla
trzeciego elementu wymagałoby ogólnej reguły dla WSZYSTKICH ekranów z
przyciskiem pod tabelą — poza zakresem jednego dyżuru, opisuję zamiast
improwizować).

## K2c — ResultsVNextRegistryShell: nadal NIEMIERZALNY, ponownie ręcznie potwierdzony zdrowy

`grep -n data-preview-pane src/components/ResultsVNext/ResultsVNextRegistryShell.tsx`
= pusto (bez zmian od 02.09). Ręczna inspekcja `<aside>` dziś (domain=kpi,
viewport 1600×1000, po kliknięciu wiersza): `bottom: 1000`, `innerHeight:
1000`, **gap: 0 px**. Zgodne z ręcznym pomiarem z 02.09. Nie dopisywałem
`data-preview-pane` do pliku — poprzedni dyżur świadomie zostawił to poza
zakresem ("naprawa"), a ten dyżur miał naprawiać WYŁĄCZNIE wzorcem
`flex-1 min-h-0`, nie dokładać znaczników pomiarowych do plików produktu.
Zostawiam nietknięte, opisane po raz drugi.

## K2d — AgentHubShell: BRAK PANELU nie z tej rodziny

Przy pierwszym przelocie `agent-hub` też pokazał "BRAK PANELU" i NIE
zniknęło przy drugim (rozgrzanym) przelocie. Ręczna inspekcja: ekran
pokazuje `Nie udało się wczytać transformacji / HTTP 404 Not Found` zamiast
tabeli — to atrapa/fixture harnessu (brakujący mock endpointu), zero
wierszy do kliknięcia, więc podgląd nie ma czego otworzyć. Nie jest to
defekt wysokości `TableWithPreviewLayout` — poza zakresem tego dyżuru
(dane harnessu, nie layout). Nie naprawiałem.

## K3 — naprawa: brak (nic nie wymagało zmiany)

Zero commitów zmieniających `src/` lub `dev-render/`. Cała rodzina z 02.09
(6 pozycji z luką) była już zamknięta przed startem tego dyżuru.

## K5 — zrzuty

`evidence/grafika/podglad-48-20260903/` (light+dark, 1600×1000, viewport
kanoniczny pomiaru wysokości):

- `chat-signals-feed__PO__pl__1600__{light,dark}.png`
- `finance-hub__PO__pl__1600__{light,dark}.png`
- `vault-safes-table__PO__pl__1600__{light,dark}.png`
- `capacity-advisor-a3__PO__pl__1600__{light,dark}.png`
- `plan-scenario-d1__PO__pl__1600__{light,dark}.png`

Kontrola pary (różnica luminancji, próg 150 — `scripts/dev/lib/meanLuma.mjs`):

| ekran | light | dark | różnica |
| --- | ---: | ---: | ---: |
| chat-signals-feed | 247.7 | 24.5 | 223.2 |
| finance-hub | 247.8 | 24.1 | 223.7 |
| vault-safes-table | 249.1 | 20.3 | 228.8 |
| capacity-advisor-a3 | 247.0 | 22.5 | 224.5 |
| plan-scenario-d1 | 247.2 | 23.9 | 223.3 |

Wszystkie pary >> progu 150 — brak "duplikatu zamiast motywu" (kształt 13).

## K6 — regresja metodą A/B

Nie dotyczy w klasycznym sensie — nie zmieniłem żadnego pliku `src/`, więc
nie ma czego cofać/porównywać stash-em. Jedyna zmiana to ten rejestr +
katalog `evidence/`. `git status --short` w worktree przed commitem: same
nowe pliki dokumentacji/dowodów, zero modyfikacji istniejących plików kodu.

## Co zostało NIETKNIĘTE i dlaczego (z rejestru 02.09, nadal aktualne)

- **13 plików martwego kodu** (12 `*Queue.tsx` w `src/components/MyWork/` +
  `BenefitsHub.tsx`) — dziś ponownie zweryfikowane grepem: nadal zero
  wołających poza sobą i testem-dowodem emerytury. Nie usuwałem (inny
  dyżur).
- **7 ekranów bez wejścia w harnessie** (`CanonicalInitiativeRegister`,
  `DecisionsPanelContent`, `ResultsInitiativesView`/`ResultsKpiReportsView`/
  `ResultsReportingEnterpriseViews`, `FocusView`, `ReportsHub`,
  `KpiQueueView`, `MyTasksListContent`) — sprawdzone dziś: `dev-render/main.tsx`
  nadal ich nie montuje. Dołożenie ekranu (dane atrapy + wejście) to więcej
  niż opakowanie `flex-1 min-h-0` — zostawiam, zgodnie z zasadą "jeśli
  wymaga czegoś więcej niż opakowania, zostaw i opisz".
- **`ResultsVNextRegistryShell`** — brak `data-preview-pane`, patrz K2c.
- **`ChatSignalsFeed` 58 px** — nie defekt, patrz K2b; przyrząd nie
  modyfikowany.
- **`AgentHubShell` BRAK PANELU** — fixture 404, nie layout; patrz K2d.

## Commity

1. `agent/podglad-48-20260903` — ten rejestr + `evidence/grafika/podglad-48-20260903/`
   (dowody zrzutów; zero zmian w `src/`/`dev-render/`/w narzędziach pomiaru).
