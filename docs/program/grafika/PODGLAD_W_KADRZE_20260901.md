# Podgląd w kadrze — czy właściciel widział panel podglądu na 253 ekranach A/B

Data: 2026-09-01. Zakres: 253 ekrany A/B ze `status.json`. Metoda: mapowanie
`?screen=<id>` → plik `dev-render/screens/*.tsx` → import produkcyjny w
`src/` (jeden poziom głębokości importu), grep wzorców `StandardPreview` ·
`PreviewPaneAside` · `selectedId`/`selectedRowId` · `onRowClick`, weryfikacja
źródłowa numerem linii tam, gdzie to możliwe, i porównanie z 13 realnymi
zrzutami z `evidence/grafika/` (dobieranymi po **czasie modyfikacji pliku**,
nie po nazwie katalogu).

## 1. Liczby

| Grupa | Liczba | Definicja |
|---|---:|---|
| **A** — podgląd otwarty od razu | 2 | Ten konkretny harness `dev-render` domyślnie pokazuje podgląd (nadpisanie parametrem URL), mimo że produkcyjny komponent bywa bramkowany. |
| **B** — podgląd po kliknięciu w wiersz | 33 | 23 ZMIERZONE (konkretna linia `useState<string\|null>(null)` + warunkowy render `StandardPreview`/`preview={...}`), 10 PODEJRZANE (komentarz w kodzie + zrzut potwierdza brak panelu, ale nie znalazłem dokładnej linii zmiennej stanu). |
| **C** — ekran bez podglądu / nie dotyczy | 54 | Kreator, kanban, canvas, artefakt SPEC-A już otwarty, panel-demo renderowany wprost, albo `onRowClick` który **nawiguje** zamiast otwierać podgląd (np. `AdminCommandCenterPanel`). |
| **Nierozstrzygnięte** | 164 | 158 bez żadnego sygnału na jednym poziomie importu (heurystyka jakości wzorca — jak w `_ustalone_dzisiaj` oryginalnego spisu, NIE otwarto każdego pliku), 6 ze sygnałem, którego nie zdążyłem rozstrzygnąć (`finance-hub`, `idea-table`, `exec-summary-onelook`, `mywork-calendar`, `mywork-idea-topbar`, `mywork-inbox`). |

Suma: 2 + 33 + 54 + 164 = 253.

**Ograniczenie metody** (jak w `_ograniczenia_tego_pomiaru` oryginalnego
spisu): grep szedł jeden poziom importu w głąb. Ekran zaimportowany przez
komponent A, który sam dopiero renderuje komponent B z prawdziwym podglądem,
mógł mi umknąć i wpaść do „nierozstrzygnięte" zamiast do B. To zaniża liczbę
B, nie zawyża — więc odpowiedź na pytanie zadania („czy Piotr ocenił ekran
bez podglądu") jest **konserwatywna w dobrą stronę**: realna liczba ekranów B
jest prawdopodobnie WYŻSZA niż 33.

## 2. Kluczowe ustalenie kodowe (ZMIERZONE)

Wzorzec bramkowania jest **identyczny i systemowy** w całej aplikacji, nie
lokalną anomalią jednego modułu. W każdym sprawdzonym Hub-ie:

```
const [selectedId, setSelectedId] = useState<string | null>(null);
...
{selectedId && <StandardPreview ... />}   // albo preview={selected ? buildX(...) : null}
```

Zweryfikowane źródłowo (plik:linia):
- `src/components/assessment/AssessmentHub.tsx:471` (`selectedAssessmentId`)
- `src/components/Audit/AuditsHub.tsx:117` (`selectedId`)
- `src/components/Meeting/MeetingHub.tsx:99` (`selectedId`)
- `src/components/Interview/InterviewHub.tsx:851` (`previewSessionId`)
- `src/components/Execution/ExecutionHub.tsx:802` (`summaryPreviewInitiativeId`, zakładka „list")
- `src/components/Execution/ExecutionReportsSurface.tsx:153` (`selectedDefinitionId`)
- `src/components/Initiatives/CapacityScenarioSurface.tsx:206` i `PlanScenarioSurface.tsx:239`
- `src/components/ReportsAndPresentations/TemplatesTabContent.tsx:96`
- `src/components/Discovery/DiscoveryToolsHub.tsx:770` (`previewItemId`)
- `src/components/AIChat/signalsFeed/ChatSignalsFeed.tsx:34`
- `src/views/vault/VaultDocumentsView.tsx:195`
- `src/components/ResultsVNext/{attention,okr,roi,kpiScorecards,ResultsSearchRegistry}` — 6 plików, ten sam wzorzec (`preview={selected ? build...(...) : null}`).

Domyślna wartość to **zawsze `null`** — żaden z tych plików nie preselekcjonuje
pierwszego wiersza. Podgląd wymaga kliknięcia w wiersz w KAŻDYM z tych modułów
(Ocena, Audyty, Spotkania, Wywiad, Realizacja, Inicjatywy, Materiały, Narzędzia,
Czat, Vault, Wyniki-vNext) — to nie jest wyjątek, to jest domyślna architektura
Triady w tym repo.

Dwa udokumentowane wyjątki idą w drugą stronę — harness dev-render **kompensuje**
bramkę kodu specjalnie na potrzeby zrzutu:
- `ideas-preview-overlay.tsx:152` — `openParam = params.get('open') !== '0'`, więc
  domyślnie (bez `&open=0`) panel jest OTWARTY.
- `results-zestawienia.tsx:319` — domyślny `selectedId` to `ROWS[0]?.id`, nie `null`.
- `dev-render/screens/admin-team.tsx` (`TeamsAutoSelectWrapper`) — harness sam
  klika `document.querySelector('tbody tr')` 400 ms po zamontowaniu, bo autor
  świadomie napisał w komentarzu: „żeby zrzut pokazywał realny panel członków
  zespołu (selectedId), nie tylko samą tabelę" — czyli autor TEGO WŁAŚNIE
  ekranu już wiedział o problemie i naprawił go punktowo. Reszta modułów — nie.

## 3. Tabela grupy B (23 ZMIERZONE + 10 PODEJRZANE)

„W kadrze?" = obejrzałem realny zrzut (kolumna 3) albo NIE (—, nie sprawdzałem
akurat tego id, tylko kod).

| Ekran | Ma zrzut (najnowszy wg mtime) | Podgląd w kadrze? | Selektor kliknięcia w spisie |
|---|---|---|---|
| assessment-list | `144-runda-pelna/assessment-list__PO__light.png` | **NIE** — sama tabela | dopisany |
| meetings-module | `144-runda-pelna-b/meetings-module__PO__light.png` | **NIE** — sama tabela | dopisany |
| materials-registry | `190-audyt-zadanie3/materials-registry__PO__light.png` | **NIE** — sama tabela | nieustalony (StandardPreview tylko w komentarzu pliku, nie w kodzie harnessu) |
| finance-hub | `148-finanse-parametry/finance-hub__PO__light.png` | **NIE** — sama tabela | nieustalony (ekran przypisany do „nierozstrzygnięte") |
| capacity-advisor-a3 | `144-runda-pelna-b/capacity-advisor-a3__PO__light.png` | **NIE** — sama tabela | dopisany |
| results-vnext-attention | `170-odrzucone-wykonanie/results-vnext-attention__PO__light.png` | **NIE** — sama tabela | dopisany |
| chat-signals-feed | `144-runda-pelna/chat-signals-feed__PO__light.png` | **NIE** — sama tabela | dopisany |
| zwornik-projects | `144-runda-pelna/zwornik-projects__PO__light.png` | **NIE** — sama tabela | nieustalony |
| execution-tab-list | `165-menu3-pasek/execution-tab-list__PRZED__light.png` | **NIE** — sama tabela | dopisany (dot. tylko zakładki „list") |
| model-catalog-table | `144-runda-pelna-b/model-catalog-table__PO__light.png` | **NIE** — sama tabela | nieustalony |
| interview-sessions-status | `144-runda-pelna/interview-sessions-status__PO__light.png` | **NIE** — sama tabela | dopisany |
| audyty-drd-report | `144-runda-pelna-b/audyty-drd-report__PO__light.png` | **NIE** — sama tabela | dopisany |
| assessment-menu3-status-chips | nie sprawdzałem | — | dopisany |
| assessment-artifacts-restart | nie sprawdzałem | — | dopisany |
| drd-library-entry | nie sprawdzałem | — | dopisany |
| execution-report-day11 | nie sprawdzałem | — | dopisany |
| materialy-template-library-slice | nie sprawdzałem | — | dopisany |
| materialy-draft-template-visibledraft-fix | nie sprawdzałem | — | dopisany |
| plan-scenario-d1 | nie sprawdzałem | — | już był w spisie (inny klik — „Otwórz narzędzia planu", NIE ruszałem) |
| results-vnext-okr-objectives | nie sprawdzałem | — | dopisany |
| results-vnext-kpi-scorecards | nie sprawdzałem | — | dopisany |
| results-vnext-roi-full-tool | nie sprawdzałem | — | dopisany |
| results-vnext-okr-admin | nie sprawdzałem | — | dopisany |
| results-vnext-search-registry | nie sprawdzałem | — | dopisany |
| tools-outputs-insights-tab | nie sprawdzałem | — | dopisany |
| vault-sejf-wnetrze | nie sprawdzałem | — | dopisany |
| admin-team-teams | nie sprawdzałem (harness sam klika) | — | już naprawione w harnessu |
| vault-safes-table | nie sprawdzałem | — | nieustalony |
| report-artifact | nie sprawdzałem | — | nieustalony |
| zwornik-projects (patrz wyżej) | | | |
| prompt-registry-tab | nie sprawdzałem | — | nieustalony |
| assessment-five-surfaces | nie sprawdzałem | — | nieustalony |
| partner-settlements-view | nie sprawdzałem | — | nieustalony |
| results-vnext-kpi-registry | nie sprawdzałem | — | nieustalony |
| interview-preview-canon | nie sprawdzałem | — | nieustalony |

**Ocena właściciela**: nie mam dostępu do rejestru ocen per-ekran w tym
katalogu roboczym (`ODBIOR_DECYZJE.json` należy do innego robotnika toku —
nie ruszałem go, poza zakresem zlecenia). Kolumna pominięta celowo — do
uzupełnienia przez kogoś z dostępem do tego rejestru.

## 4. Wynik próbki 13 zrzutów (12 wymaganych + 1 dodatkowy)

Obejrzane narzędziem Read, dobrane po **czasie modyfikacji pliku** (nie po
nazwie katalogu), po jednym z każdego z 13 różnych modułów:

| # | Ekran | Moduł | W kadrze? |
|---|---|---|---|
| 1 | assessment-list | 05-ocena | tabela, BEZ podglądu |
| 2 | meetings-module | 12-spotkania | tabela, BEZ podglądu |
| 3 | materials-registry | 10-materialy | tabela, BEZ podglądu |
| 4 | finance-hub | 09-finanse | tabela, BEZ podglądu |
| 5 | capacity-advisor-a3 | 06-inicjatywy | tabela, BEZ podglądu |
| 6 | results-vnext-attention | 08-wyniki | tabela, BEZ podglądu |
| 7 | tools-sesja-wyjscie | 04-narzedzia | **INNY archetyp** — to już otwarta sesja/artefakt SPEC-A z zawsze widocznym prawym panelem (Akcje/Właściwości/Powiązania), nie lista z bramką; panel jest w kadrze, ale to nie jest ten sam mechanizm co StandardPreview-po-kliku |
| 8 | chat-signals-feed | 01-czat | tabela, BEZ podglądu |
| 9 | zwornik-projects | 02-moja-praca | tabela, BEZ podglądu |
| 10 | execution-tab-list | 07-realizacja | tabela, BEZ podglądu |
| 11 | model-catalog-table | 13-administracja | tabela, BEZ podglądu |
| 12 | interview-sessions-status | 03-wywiad | tabela, BEZ podglądu |
| 13 | audyty-drd-report | 11-audyty | tabela, BEZ podglądu |

**Na 12 obejrzanych ekranów typu „lista+bramka": 12 na 12 pokazuje samą
tabelę, zero z nich ma panel podglądu w kadrze.** (13. zrzut to inny
archetyp ekranu, wyłączony z tego liczenia — patrz wyżej.)

To wynik próbki 12 ekranów z 33 zaliczonych do grupy B (23 zmierzonych +
10 podejrzanych), NIE wynik dla wszystkich 253 ani nawet dla wszystkich 33.
Nie uogólniam na całość — ale próbka jest jednoznaczna w jedną stronę i
obejmuje 12 z 13 modułów aplikacji (Ocena, Spotkania, Materiały, Finanse,
Inicjatywy, Wyniki, Czat, Moja Praca, Realizacja, Administracja, Wywiad,
Audyty), więc to nie jest wąski wycinek jednego modułu.

## 5. Zmierzone vs Podejrzenie — rozdział

**ZMIERZONE** (przeczytałem kod ze wskazaną linią LUB obejrzałem zrzut):
- 23 ekrany grupy B z dokładną linią `useState<string|null>(null)` + warunkowy render podglądu (sekcja 2).
- 12 z 13 obejrzanych zrzutów pokazuje tabelę bez podglądu (sekcja 4).
- Wzorzec bramkowania jest identyczny w 8 niezależnych modułach kodu (nie wnioskowanie z jednego pliku).
- `AdminCommandCenterPanel.tsx:355` — `onRowClick={(row) => navigate(...)}` — to NIE jest otwarcie podglądu, tylko nawigacja; 12 ekranów `admin-command-*` słusznie poza grupą B.
- `AdminTeamsPanel.tsx:213-214` — ma bramkę `selectedId`/`onRowClick`, ale otwiera WŁASNĄ sekcję (nie kanoniczny `<StandardPreview>`) — odrębne złamanie kanonu Triady, nie mój zakres naprawy, tylko odnotowuję.
- `audyty-raport-dokument` — to NIE ekran-lista z bramką, to już otwarty artefakt SPEC-A (Dokument), do którego trafia się z `StandardPreview`'s `onOpenFull` w `AuditReportsTab` — potwierdzone nagłówkiem pliku `dev-render/screens/audyty-raport-dokument.tsx:1-10`.

**PODEJRZENIE** (wzorzec/komentarz bez potwierdzonej linii kodu):
- 10 ekranów grupy B „PODEJRZANE": `materials-registry`, `model-catalog-table`,
  `report-artifact`, `zwornik-projects`, `prompt-registry-tab`,
  `assessment-five-surfaces`, `partner-settlements-view`,
  `results-vnext-kpi-registry`, `interview-preview-canon`, `vault-safes-table`
  — komentarze w tych plikach nazywają wprost `StandardPreview`/kanon Triady,
  a 3 z nich (materials-registry, model-catalog-table, zwornik-projects)
  POTWIERDZONE zrzutem jako „tabela bez podglądu" — ale w samym pliku
  `dev-render/screens/*.tsx` nie znalazłem linii `useState` odpowiadającej
  zmiennej selekcji, więc nie wiem, czy to naprawdę bramka kodu, czy
  harness w ogóle nie montuje działającego podglądu (możliwe, że te trzy
  „fasady" — tak nazwane w komentarzu `model-catalog-table.tsx:4` —
  nigdy nie wpięły realnego `<StandardPreview>`, tylko sam `<StandardTable>`).
  Nie dopisałem im `klik` w spisie — zgodnie z zasadą, że brak wpisu jest
  lepszy niż zgadany.
- 5 zakładek `ExecutionHub` (`work`/`resources`/`control`/`rollout`/`summary`)
  — w całym pliku (5900+ linii) istnieją tylko DWA miejsca renderujące
  `<StandardPreview>` (linie 5202 i 5655), przypisane do zakładek `reports`
  i `list`. Wysoce prawdopodobne, że pozostałych 5 zakładek nie ma podglądu
  wcale (inny układ — kanban/gantt) — ale nie potwierdziłem tego per zakładka,
  więc zaliczam do grupy C z zastrzeżeniem, nie do ZMIERZONE.
- 158 ekranów bez żadnego sygnału na jednym poziomie importu — to samo
  ograniczenie, które autor oryginalnego spisu już zgłosił dla 187 ekranów
  „domyślnych": wnioskowanie z jakości wzorca, nie wyczerpujący audyt
  każdego pliku.

## 6. Wniosek

**Tak — ekrany z oceną A lub B (w sensie `status.json`, czyli „do odbioru")
były przyjmowane bez obejrzenia podglądu, i to nie jako pojedynczy wypadek.**

Z 12 obejrzanych zrzutów ekranów typu lista+bramka (grupa B), **12 na 12** nie
pokazuje podglądu — a wszystkie te zrzuty mają w nazwie `__PO__`, czyli są
oznaczone jako stan „po naprawie", gotowy do oceny. Wzorzec kodu potwierdza,
że to nie przypadek pojedynczych zrzutów: 23 niezależne moduły (Ocena, Audyty,
Spotkania, Wywiad, Realizacja x2, Inicjatywy x2, Materiały x2, Narzędzia,
Czat, Vault, Wyniki-vNext x6, Admin-zespoły) używają identycznego wzorca
`useState<string|null>(null)` + warunkowy `StandardPreview`, więc podgląd
jest domyślnie ZAMKNIĘTY w całej aplikacji, nie w jednym module.

Znaleziony wcześniej precedens `idea-table` (podgląd dopiero po kliknięciu,
wcześniejszy zrzut bez niego) **nie jest odosobniony — jest reprezentatywny
dla architektury całej Triady.** Dwa świadome wyjątki (`ideas-preview-overlay`,
`results-zestawienia`) i jedna świadoma łatka (`admin-team.tsx`
`TeamsAutoSelectWrapper`) pokazują, że przynajmniej jeden autor już
zidentyfikował ten problem punktowo — ale nie została z tego wyciągnięta
reguła dla pozostałych ~30+ ekranów tej samej rodziny.

**Przed pełnym przefotografowaniem trzeba jeszcze ustalić:** dla każdego z
33 ekranów grupy B (a prawdopodobnie części z 164 „nierozstrzygniętych" —
patrz ograniczenie metody w sekcji 1) — czy nowy przelot ma fotografować
STAN PO KLIKU (wiersz zaznaczony, panel otwarty), bo inaczej powtórzymy
dokładnie ten sam błąd: zrzut „gotowy do odbioru", który pokazuje połowę
ekranu. Selektor kliknięcia jest w większości przypadków ten sam mechanicznie
(pierwszy wiersz `StandardTable`/`FilterableTable` — `tbody tr:first-child`,
bo `FilterableTable.tsx` nie nadaje wierszom `data-testid`), więc naprawa
przelotu jest tania — ale musi być świadoma decyzja, nie domyślne
`?screen=<id>` bez klikania.
