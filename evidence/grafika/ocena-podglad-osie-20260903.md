# Ocena — podgląd procesu (ASM-OWN-005) i nawigacja osi w Wywiadzie (ASM-OWN-020) — dyżur agent/ocena-podglad-osie-20260903

Zlecenie: `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` wiersz 14
(`ASM-OWN-005`) i wiersz 16 (`ASM-OWN-020`), obie oznaczone **TERAZ (0,5 dnia)
/ DEFEKT**. Źródło uwag:
`docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md`.

Środowisko: worktree `/private/tmp/ag-ocena-podglad`
(`agent/ocena-podglad-osie-20260903`, HEAD `96982ed24f`), harness dev-render
na porcie **5428**. Zero zmian w `src/` — oba pomiary wyszły **OBALONE**
(patrz uzasadnienie niżej), więc commit nie powstał.

## ASM-OWN-005 — „podgląd procesu jest niższy niż kanon”

### Cytat właściciela (`ASM-OWN-005`, `OWNER_FEEDBACK_REGISTER.md:334-338`)

> Natomiast niestety nie zatwierdzone. Zobacz to, preview jest niezgodny
> swoją wielkością z kartami preview, które mamy ustalone. Karta preview jest
> od góry do dołu ekranu, to znaczy od menu trzeciego do dołu ekranu.

Trasa właściciela: `/assessment/overview?tab=processes`, SHA `ca9ef20646`
(2026-08-23 06:05) — ten SHA jest przodkiem obecnego HEAD (`96982ed24f`).

### Kanon (zmierzony w kodzie)

`git grep -n "data-preview-pane|previewHeight|calc(100vh"` →
`src/components/shared/PreviewPane/PreviewPaneAside.tsx` (wrapper podglądu,
szerokość z `PREVIEW_PANE_WIDTH`, `data-preview-pane`) +
`src/components/shared/TableWithPreviewLayout.tsx` (`h-full flex
overflow-hidden` na kontenerze tabela+podgląd). Referencja poprawnego wzorca
(`InitiativesHub.tsx:2434-2435`):

```
<div className="flex h-full min-h-0 flex-col overflow-hidden">
  <div className="min-h-0 flex-1 overflow-hidden">{renderContent()}</div>
</div>
```

`AssessmentHub.tsx:2649` ma **jeden** div: `className="h-full min-h-0
overflow-hidden space-y-3"` — komentarz nad nim (dodany 2026-07-20,
`git blame`) mówi `min-h-0 flex-1 overflow-hidden`, ale klasa `flex-1` została
zgubiona commitem `fa1daa426e5` (2026-08-23 09:33 — **PO** SHA z uwagi
właściciela) na rzecz `h-full`. To rozjazd między komentarzem a kodem, ale —
zmierzone niżej — **nie powoduje realnej luki**, bo rodzic tego diva
(`StandardModuleBar.tsx:518`: `<div className="flex-1 min-h-0
overflow-auto">{children}</div>`) sam ma zdefiniowaną wysokość z flexboksa, a
procent `h-full` liczy się od niej poprawnie nawet bez `flex` na dziecku.

### Pomiar PRZED (Playwright, realny `<AssessmentHub>`, harness
`assessment-list` = `AssessmentHub initialTab="processes"`, ten sam komponent
co `/assessment?tab=processes` — patrz nagłówek
`dev-render/screens/assessment-list.tsx`)

Metoda: `getBoundingClientRect()` na `[data-preview-pane]` po kliku w
pierwszy wiersz tabeli, porównane do dołu okna i do dołu paska Menu 3
(`overflow-x-auto.whitespace-nowrap`).

| Ekran / zakładka | Viewport | dół podglądu vs dół okna | dół okna − dół podglądu | góra podglądu vs dół Menu 3 |
| --- | --- | --- | --- | --- |
| assessment-list (Procesy) | 1440×900 | 900 = 900 | **0 px** | 13 px (padding kanoniczny `PreviewPaneAside p-3`) |
| assessment-list (Procesy) | 1024×768 | 768 = 768 | **0 px** | 13 px |
| assessment-reports-table (Raporty) | 1440×900 | 900 = 900 | **0 px** | 13 px |
| assessment-reports-table (Raporty) | 1024×768 | 768 = 768 | **0 px** | 13 px |
| assessment-initiatives-table (Inicjatywy) | 1440×900 | 900 = 900 | **0 px** | 13 px |
| assessment-initiatives-table (Inicjatywy) | 1024×768 | 768 = 768 | **0 px** | 13 px |

13 px do Menu 3 to standardowy padding `PreviewPaneAside` (`p-3` = 12 px +
1 px zaokrąglenia), **identyczny wzorzec co wszędzie indziej** (Materiały,
Inicjatywy) — nie jest luką kanonu, jest jej częścią.

Zrzuty (obejrzane, Read):
`evidence/grafika/ocena-podglad-osie-20260903/assessment-list__PRZED__pl__1440__{light,dark}.png`
— podgląd „Segment Manufacturing — DRD Light" sięga wizualnie od paska
chipów Menu 3 do samego dołu ekranu, na równi z tabelą po lewej. Bez luki.

### Rodzina (3 zakładki tej samej powłoki, ten sam wrapper `AssessmentHub.tsx:2649`)

`processes`/`list`, `reports`, `initiatives` dzielą DOKŁADNIE ten sam
zewnętrzny div i ten sam wzorzec `<div className="h-full flex
overflow-hidden">…<PreviewPaneAside><StandardPreview>` — zmierzone wszystkie
trzy, wszystkie 0 px. `library`/`outputs` nie mają podglądu bocznego w tym
kształcie (inny kontrakt, poza zakresem `ASM-OWN-005`, który dotyczy
literalnie zakładki „Procesy").

### Kontrola pułapki harnessu (03.09 precedens: „263 px" w Finansach)

Łańcuch przodków sprawdzony: `dev-render/mocks/assessmentHubHarness.tsx`
montuje **realny** `<AssessmentHub>` w **realnym** `<AppProviders>`, owinięty
w `<div style={{height:'100vh',overflow:'hidden'}}>`. Realna trasa
(`src/routes/AppRoutes.tsx:2274-2301`, `<MainLayout breadcrumbs=… noPadding>`)
buduje ten sam łańcuch flex/`min-h-0`/`overflow` aż do miejsca montowania
route'a: `MainLayout.tsx:450` `flex-1 overflow-hidden … flex min-h-0` →
`MainLayout.tsx:456` `flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto`.
Harness i produkt dają ten sam kształt kontenera nadrzędnego — brak przesłanki
„to tylko przyrząd kłamie".

### Werdykt ASM-OWN-005: **OBALONE (nie odtwarza się na HEAD `96982ed24f`)**

Zmierzona luka = 0 px ± tolerancja identyczna z resztą aplikacji, na 3
zakładkach rodziny, 2 viewportach, 2 motywach (zrzuty). Defekt z SHA
`ca9ef20646` (06:05, 2026-08-23) już nie występuje — commit `fa1daa426e5`
tego samego dnia (09:33) zmienił klasę `flex-1`→`h-full` (rozjazd z
komentarzem, ale bez efektu wizualnego) i/lub inne poprawki po drodze
naprawiły realny problem. **Zero zmian w kodzie produktu** — zmiana klasy na
`min-h-0 flex-1 overflow-hidden` (zgodnie z komentarzem/InitiativesHub) była
rozważona, ale odrzucona: nie ma obserwowalnego efektu, a restrukturyzacja
jednego diva w dwa (jak w InitiativesHub) niosłaby ryzyko regresji bez
żadnej korzyści pomiarowej. Rekomendacja: DEC do rejestru „obalone pomiarem
03.09, kod bez zmian", ewentualnie osobny drobny porządek (dopasowanie klasy
do komentarza) jako czysto kosmetyczny dług, nie P0/P1.

## ASM-OWN-020 — „nawigacja po osiach dubluje się w Wywiadzie na poziomie 3"

### Cytat kryteriów (`OWNER_FEEDBACK_REGISTER.md:1341-1352`)

> The two-stage left navigator defined by `ASM-OWN-016` is the sole axis and
> area selection surface. Interview Level 3 remains available only for
> mode-specific working controls on the left and the common AI/save/status
> controls on the right.

- `ASM-NODUPE-AC-001` — brak pełnoszerokiego paska/selektora osi.
- `ASM-NODUPE-AC-002` — lewy dwuetapowy nawigator to jedyne źródło prawdy.
- `ASM-NODUPE-AC-003` — usunięcie duplikatu NIE może zabrać nawigacji
  klawiaturą, deep linków, kontekstu lokalizacji ani linkowania do Macierzy.

Trasa właściciela: `/assessment/drd/1113db5d-…`, SHA `bcfb01483a3`
(2026-08-23).

### Ustalenie architektury (kod, nie zgadywanie)

`src/views/AssessmentSessionEditorView.tsx:114-121`
(`shouldMountDrdMethodWorkspace`) — dla `framework === 'drd'` **zawsze**
zwraca `true` (bez flagi) od commitu `28cc3d65acf` (**2026-08-19**, 4 dni
PRZED SHA z uwagi właściciela). Linia 1751: ten warunek jest sprawdzany
PRZED jakimkolwiek renderem legacy `DRDForm`/`DRDAssessmentEditor`
(`renderEditor()`), więc dla `/assessment/drd/:id` legacy ścieżka z
pełnoszerokim paskiem 7 zakładek osi (`DRDForm.tsx:401-430`, „Axis Tabs") jest
od 2026-08-19 **martwym kodem** — potwierdzone też testem
`tests/components/assessment/AssessmentSessionEditorView.canonical-drd.test.tsx`
(„mounts Method Core before legacy loading and never calls a legacy reader or
writer") i grepem: `<DRDForm`/`<DRDAssessmentEditor` mają dokładnie jedno
miejsce montowania w całym `src/` — to nieosiągalne wywołanie.

Żywy komponent: `DrdMethodWorkspaceScreen` → `MethodWorkspaceShell`
(`ZAKAZ WŁASNEJ POWŁOKI` — montuje kanoniczną powłokę) →
`MethodNavigator` (lewy, POJEDYNCZY `role="tree"`, pojedynczo-rozwijalne
drzewo grup — dokładnie ten wzorzec, który rejestr C1 z 03.09 nazwał
„celowo pojedynczo-rozwijalne drzewo osi DRD — nie defekt", więc zostaje) +
`InterviewFocusPanel` (środek, breadcrumb „Ścieżka pytania" jako zwykłe
`<span>`, nie link/przycisk).

### Pomiar (Playwright, harness `drd-http-workspace` = realny
`DrdHttpMethodWorkspaceScreen`, dane realnego DRD Method Pack — 7 prawdziwych
osi, `stage=inprogress`)

Policzono `[role="tablist"]`, `[role="tree"]` oraz literalne wystąpienia
każdej z 7 nazw osi jako WŁASNY tekst liścia DOM (bez zagnieżdżeń):

| Widok | Motyw | `tablist` | `tree` | „Procesy Cyfrowe" | pozostałe 6 osi (każda) |
| --- | --- | --- | --- | --- | --- |
| interview | light | 1 | 1 | **2** | 1 |
| interview | dark | 1 | 1 | **2** | 1 |
| split | light | 1 | 1 | **2** | 1 |
| split | dark | 1 | 1 | **2** | 1 |
| matrix | light | 1 | 1 | 1 | 1 |
| matrix | dark | 1 | 1 | 1 | 1 |

Jedno dodatkowe wystąpienie „Procesy Cyfrowe" w widoku interview/split to
breadcrumb `InterviewFocusPanel.tsx:101` „Procesy Cyfrowe / Procesy
Sprzedaży / Poziom 3" — **niekliknalne `<span>`**, nie selektor. To dokładnie
„current-location context", który `ASM-NODUPE-AC-003` każe ZACHOWAĆ. Pojawia
się TYLKO dla aktywnej osi (stąd pozostałe 6 osi liczą 1× — sam wpis w
drzewie), więc nie jest to drugi, równoległy selektor osi — jest to
kontekstowy okruszek nad aktualnym pytaniem.

`[role="tablist"]` = 1 to przełącznik Wywiad/Macierz/Raport
(`MethodWorkspaceShell.tsx:117-119`), nie selektor osi.

Zrzuty (obejrzane, Read):
`evidence/grafika/ocena-podglad-osie-20260903/drd-http-workspace__PRZED__pl__1440__{light,dark}.png`
(`?screen=drd-http-workspace&stage=inprogress&view=interview`) — widać
JEDEN lewy nawigator drzewny (grupa „Procesy Cyfrowe" rozwinięta, 6 innych
grup zwinięte: Produkty Cyfrowe, Cyfrowe Modele Biznesowe, Zarządzanie
Danymi, Kultura Transformacji, Cyberbezpieczeństwo, Dojrzałość AI), JEDEN
pasek zakładek Wywiad/Macierz/Raport, JEDEN breadcrumb. Brak pełnoszerokiego
paska z 7 nazwami osi.

### Werdykt ASM-OWN-020: **OBALONE (nie odtwarza się na HEAD `96982ed24f`)**

Pełnoszeroki duplikat nawigacji osi, który widział właściciel 2026-08-23,
pochodził z legacy `DRDForm`/`DRDAssessmentEditor` — ta ścieżka jest martwa
dla `/assessment/drd/:id` od 2026-08-19 (4 dni PRZED jego zrzutem; commit
`28cc3d65acf` „feat(assessment): cut over mounted DRD to method core").
Obecny żywy komponent (`MethodWorkspaceShell`/`MethodNavigator`) ma jeden
selektor osi (lewe drzewo) + jeden niekliknalny breadcrumb kontekstu, zgodnie
z `ASM-NODUPE-AC-001/002/003`. **Zero zmian w kodzie produktu.**

## Bezpieczniki

- `bash scripts/check-list-canon.sh` → zielony (pełny skan repo, fallback z
  pustego stagingu: 157 plików, naruszeń 368, baseline 368 — dług nie
  rośnie, zero NOWYCH naruszeń).
- a11y: `--a11y=1` na zrzucie `assessment-list` → 3 istniejące ostrzeżenia
  (niepowiązane z tym dyżurem, nie nowe — ten sam ekran bez zmian kodu).
- Zero commitów (brak zmian w `src/`) — worktree
  `/private/tmp/ag-ocena-podglad` do posprzątania (`git worktree remove`) po
  odbiorze tego meldunku.

## Czego NIE zrobiono

- Nie zmieniono klasy `h-full`→`flex-1` w `AssessmentHub.tsx:2649` mimo
  rozjazdu z komentarzem — brak obserwowalnego efektu, ryzyko regresji bez
  korzyści.
- Nie budowano prototypu „kompaktowego dwuetapowego nawigatora"
  z `ASM-OWN-016` — to osobna, odłożona rodzina (R-1, „PO BRAMKACH" w
  `DECYZJE_WLASCICIELA_P0P1_20260904.md`), poza zakresem tego dyżuru
  (`ASM-OWN-020`/R-3, „usuwamy dwa zbędne elementy" — element już usunięty
  wcześniej, nie przez tę sesję).
- Nie testowano `siri`/`adma`/`cmmi`/`lean` frameworków — `ASM-OWN-020`
  dotyczy literalnie 7 osi DRD.
