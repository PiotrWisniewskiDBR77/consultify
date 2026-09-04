# CODEX DAY 342 — PANEL IDEI I NOTATNIKA: PODLACZENIE

Stan: W TOKU. Baza: `74c07919cea7ab55dc9fde5fbd911f7f955ed425`.

## Start i rozbieznosc tipa

`df -h /` przed materializacja: `50Gi` wolne. Porty `6378` i `5518`: brak procesu
nasluchujacego. Kontener `cx-day342-pg`: nie istnial.

Wynik markera, doslownie:

```text
74c07919ce docs(rejestr): sekcja N — decyzje wlasciciela DEC-388..391 (szablon nie tnie karty, silnik raportu po pomiarze, narrator zostaje, kontrakt czatu obowiazuje)
MARKER OK
```

Tip `github-backup/grafika/m03-20260902` byl nowszy (`52a041a910`), ale worktree
powstal dokladnie z markera. Sanity, doslownie:

```text
74c07919cea7ab55dc9fde5fbd911f7f955ed425
```

`git status --short | head -3` nie wypisal nic.

## R1 — pomiar warstw, tresci i kanonu

### Osiagalnosc przed

| Plik | Klasyfikacja przed | Przewidywana po | Zywy konsument |
| --- | --- | --- | --- |
| `IdeaNotebookRightPanelPrototype.tsx` | `harness-only` | `app` | NIE przed, TAK po przewodzie |
| `ideaNotebookRightPanelPrototypeFlag.ts` | `harness-only` | `app` | NIE przed, TAK po przewodzie |
| `IdeaContextPanel.tsx` | `app` | `app` | TAK |
| `NotebookContextPanel.tsx` | `app` | `app` | TAK |
| `NotebookRightRail.tsx` | `app` | `app` | TAK |
| `IdeaRightPanel.tsx` | `app` | `app` | TAK |
| `ArtifactRightPanel.tsx` | `app` | `app` | TAK |

`reachability-from-root.mjs`: `app 3044`, `harness-only 30`, `test-only 1017`,
`unreachable 719`. Grep prototypu/flagi zwrocil dokladnie cztery pliki:
prototyp, flage, test i `dev-render/main.tsx`; zero produkcyjnego wolacza.

### Cztery warstwy dzis

| Warstwa | Stan | Dowod |
| --- | --- | --- |
| 1. plik istnieje | TAK | `wc -l ...IdeaNotebookRightPanelPrototype.tsx` -> `86` |
| 2. jest importowany | TAK, tylko harness/test | grep czterech sciezek |
| 3. render na realnym ekranie | NIE | reachability `harness-only`; zero wolacza produkcyjnego |
| 4. dociera do uzytkownika | NIEUDOWODNIONE / NIE | brak produkcyjnego wolacza i brak kadru realnego ekranu ON |

### Inwentarz tresci

- Idee: `IdeaContextPanel` niesie backlinki, artefakty, inicjatywy, luki assessmentu,
  insighty, KPI, podobne idee, notatki, zrodla/dowody i akcje wstawienia na canvas.
  `IdeaRightPanel` sklada realne Akcje, Wlasciwosci (`IdeaWorkspaceTools`), Powiazania
  (`IdeaContextPanel`), Komentarze i Historie/Terese.
- Notatnik: `NotebookContextPanel` niesie realne Ideas, Initiatives, Tasks, Decisions,
  Notes i operacje powiazan. `NotebookRightRail` sklada szesc sekcji kanonu, realne
  akcje eksport/share/historia wersji, governance, powiazania i wejscie do Teresy.
- Prototyp przed dyzurem umie szesc sekcji i stany loading/error/empty, ale ma tylko
  dwie akcje, dwie atrapy wlasciwosci (`Anna Kowalska`, `Szkic`) i cztery puste stany.
  Nie jest nastepca zadnej z powyzszych tresci. Linie: `86` wobec `1289 + 867 + 1037`.

### Kanon

Rozstrzygniecie: prototyp nalezy do SPEC-A, bo importuje i renderuje
`ArtifactRightPanel`; nie importuje `PreviewPaneShell`. Zgadza sie to z
`ARTIFACT_ANATOMY_STANDARD.md` §10.2 pkt 3: prawy panel artefaktu jest akordeonem
o szesciu sekcjach w stalej kolejnosci. Nie dotykam obu plikow kanonu.

Wymaga plikow przekrojowych: **NIE** — R1 zmienia tylko ten raport.

## R2 — pierwszenstwo flag i definicja podlaczenia

### Tabela pierwszenstwa

| Flaga | Plik | Miejsce | Default | ON | OFF | Obejscie profilem |
| --- | --- | --- | --- | --- | --- | --- |
| `ff_artifact_right_rail` | `artifactRightRailFlag.ts` | Idee i Notatnik | OFF | wspolna szyna `ArtifactRightRail` | dalsza powloka | NIE |
| `ff_idea_notebook_right_panel_prototype` | `ideaNotebookRightPanelPrototypeFlag.ts` | przewod Idei/Notatnika | OFF | wspolna powloka z realnymi sekcjami | dzisiejszy DOM | NIE |
| `ENABLE_NOTEBOOK_SPEC_A_SHELL` | `notebookSpecAShellFlag.ts` | Notatnik | ON | dzisiejszy `ArtifactRightPanel` | legacy rail | NIE |
| `ff_ideaPanel6Sections` | `ideaPanel6SectionsFlag.ts` | tresc/nawigacja Idei | ON | szesc sekcji tresci | dawny uklad | NIE |
| `ideaDetailsInPanelFlag` | `ideaDetailsInPanelFlag.ts` | detal elementu Idei | OFF | detal w panelu | dawny drawer | TAK: demo acceptance zwraca true |
| `artifactStudioFlags` | `artifactStudioFlags.ts` | studia dokumentow/deck/sheet | fail-closed | nie steruje tym miejscem | nie steruje | profil dotyczy innych lanes |
| `orgRedesignFlag` | `orgRedesignFlag.ts` | redesign organizacji | OFF | nie steruje tym miejscem | nie steruje | NIE |

Tym miejscem w Ideach rzadzi najpierw `artifactRightRailFlag`; flaga prototypu jest
podrzedna i dziala dopiero w galezi bez szyny. Trescia Idei nadal rzadzi
`ideaPanel6SectionsFlag`, a osadzeniem detalu `ideaDetailsInPanelFlag`.

Tym miejscem w Notatniku rzadzi najpierw `artifactRightRailFlag`; gdy jest OFF,
flaga prototypu wybiera wspolna powloke z realnymi sekcjami, a gdy ona tez jest OFF,
`notebookSpecAShellFlag` wybiera obecny SPEC-A albo legacy. Nie powstaje nowa flaga.

### Definicja podlaczenia przed kodem

- OFF: Idee i Notatnik renderuja dokladnie dzisiejsze galezie i dzisiejszy DOM.
- ON / Idee: wspolna powloka prototypu renderuje komplet realnych sekcji zbudowanych
  przez `IdeaRightPanel`, bez atrap i bez usuwania tresci.
- ON / Notatnik: ta sama powloka renderuje komplet `specASections` zbudowany przez
  `NotebookRightRail`; akcje i handlery pozostaja te same.
- Flaga konkurencyjna `artifactRightRailFlag=ON` wygrywa i zachowuje obecna szynę.

Bilans wymagany przed kodem: celem ON jest **100% sekcji i 100% dzisiejszej tresci
przekazanej przez hosta**; brakujacych sekcji: `0`. Nie wolno uzyc atrapy prototypu
(`255-262` znakow) zamiast dzisiejszych ekranow (`761-1344`). Prawdziwy bilans znakow
zostanie zmierzony na kadrach R5.

Kanon: **SPEC-A, §10.2 pkt 3**, nie `PreviewPaneShell`.

Wymaga plikow przekrojowych: **NIE** — R2 zmienia tylko ten raport.

Decyzja R2 zostala zamrozona przed pierwsza zmiana kodu produktu; implementacja R3
ma realizowac powyzsza kolejnosc bez zmiany wartosci domyslnej zadnej flagi.

## Korekty wobec instrukcji

Na etapie R1/R2 brak rozbieznosci liczbowych. Zbiorcza komenda weryfikacyjna miala
exit 1, poniewaz grep `ArtifactRightPanel|PreviewPaneShell` znalazl w prototypie tylko
`ArtifactRightPanel`; jest to oczekiwany dowod wyboru kanonu, nie awaria pomiaru.

## Twierdzenia niezweryfikowane

- Warstwa 4 po zmianie, parytet bajtowy OFF i bilans znakow ON czekaja na R5.
- Akceptacja wlasciciela i gotowosc do wlaczenia flagi nie sa dowiedzione.

## R3 — przewod

Implementacja przekazuje realne tablice sekcji z `IdeaRightPanel` i
`NotebookRightRail` do istniejacej powloki prototypu. Kolejnosc jest jawna:
`artifactRightRailFlag` wygrywa; dopiero potem flaga prototypu; w Notatniku
`notebookSpecAShellFlag` rozstrzyga tylko wtedy, gdy prototyp jest OFF.

Pakiet `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run
src/components/MyWork/prototypes/__tests__ src/components/MyWork/notebook/__tests__
--retry=0`: 16 plikow / 88 testow PASS przed dopisaniem kontraktow; po zmianie
pelny wynik JSON jest w `day342-r3-green.json`. Pulapki Z33(a-d) nie dotycza:
testy sa czysto DOM/jednostkowe, nie montuja Gateway ani bazy. Pulapka (e) jest
neutralizowana asercja DOM na produkcyjnych komponentach, nie samym harnessem.

Nowe kontrakty:

1. OFF zachowuje realny panel Idei bez powloki prototypu.
2. ON montuje powloke i realne sekcje Idei w produkcyjnym `IdeaRightPanel`.
3. `artifactRightRailFlag=ON` wygrywa nad prototypem.
4. ON montuje powloke oraz realny tytul, wlasciciela i sekcje Notatnika.

Dowod mutacyjny defaultu: po zmianie fallbacku flagi `false -> true` czerwone byly
dokladnie trzy testy OFF: dwa istniejace kontrakty gate oraz nowy kontrakt OFF
produkcyjnego `IdeaRightPanel`. Po `cp` plik flagi nie ma diffu.

Dowod mutacyjny przewodu: po zastapieniu gate w `IdeaRightPanel` przez `currentPanel`
czerwony byl dokladnie test `renders the shared shell with real Idea sections in the
production component when ON`; exit 1. Po `cp` przewod wrocil, `git diff --check`
jest czysty. W zmienionych plikach nie ma `primary-*`.

`npx tsc --noEmit --pretty false` nie zakonczyl sie w 150 s i zostal przerwany;
nie raportuje go jako PASS ani FAIL.

Wymaga plikow przekrojowych: **NIE** — diff R3 obejmuje tylko licencjonowany prototyp,
punkty montazu Idei/Notatnika i ich testy.

## R4 — trwalosc i zimny odczyt

Stan: **n/d z dowodem**. Komenda `rg -n
"localStorage|sessionStorage|fetch\\(|Api\\.|db(Get|Run|All)|INSERT|UPDATE|DELETE|persist|save"
IdeaNotebookRightPanelPrototype.tsx ArtifactRightPanel.tsx` zwrocila `BRAK ZAPISU W
POWLOCE`. Rozwiniecie sekcji jest lokalnym `useState<Set<string>>`; przewod nie
dodaje zapisu szerokosci, zakladki ani sekcji. Realne akcje hostow zachowuja swoje
istniejace handlery, ale R3 nie zmienia ich kontraktu trwałości.

Wymaga plikow przekrojowych: **NIE** — R4 zmienia tylko raport i nie wymaga migracji.

## R5 — kadry z realnego ekranu

Werdykt: **PARTIAL 2/4 ekranow**. Pierwszy przelot ujawnil, ze
`PrototypeHarness` przy ON podmienial caly ekran na samotny prototyp z atrapami
`Anna Kowalska`/`Szkic`. W ramach waskiej licencji R5 usunalem te podmiane;
harness zawsze montuje realny ekran, a flage konsumuje produkcyjny host.

| Ekran / motyw | SHA OFF | SHA ON | Para | luma OFF/ON | tekst OFF/ON |
| --- | --- | --- | --- | --- | --- |
| ideas-teresa / light | `3d6c4560b987` | `bfa23543d96a` | ROZNE | 249.25/249.33 | 761/783 |
| ideas-teresa / dark | `a5b436ebb84f` | `58fefdb6578f` | ROZNE | 31.66/31.45 | 761/783 |
| notebook-rail / light | `a22dad923967` | `9fd24ab83647` | ROZNE | 249.62/249.70 | 934/944 |
| notebook-rail / dark | `636f56f2e4d9` | `06a3edc25de0` | ROZNE | 30.51/30.17 | 934/944 |
| centrum-mysli / light | `a162d4591d6c` | `a162d4591d6c` | **IDENTYCZNE** | 247.29/247.29 | 1092/1092 |
| centrum-mysli / dark | `8ef1bcf344e2` | `8ef1bcf344e2` | **IDENTYCZNE** | 27.11/27.11 | 1092/1092 |
| inspector-lekki / light | `765d80f4631f` | `765d80f4631f` | **IDENTYCZNE** | 249.12/249.12 | 1344/1344 |
| inspector-lekki / dark | `75e08833ab30` | `75e08833ab30` | **IDENTYCZNE** | 18.88/18.88 | 1344/1344 |

Pelne SHA i JSON: `/private/tmp/cx-day342-panel-idei-podlaczenie-artefakty/{off,on}-real-pl`.
Dodatkowe ON EN light/dark dla `ideas-teresa-panel` i
`mywork-notebook-rail-speca`: `on-real-en` (4/4 wykonane).

Obejrzane kadry: `ideas-teresa-panel` pokazuje mape po lewej i wspolny panel z
realnymi Wlasciwosciami, Powiazaniami, Zrodlami, Komentarzami i Historia po prawej;
`mywork-notebook-rail-speca` pokazuje centrum dokumentu oraz realne metadane,
governance i powiazania. `notatnik-centrum-mysli` pozostaje ekranem notatki +
makiety rozmowy Teresy bez produkcyjnego `NotebookRightRail`; `inspector-lekki`
pozostaje inspektorem elementu, nie hostem panelu artefaktu. Ostatnie dwa prawidlowo
pozostaly identyczne i nie sa dowodem warstwy 4.

Rozwijanie nie skrocilo tekstu (`sekcjeCofniete=[]`). Light/dark sa mechanicznie
rozne; wszystkie dark maja luma 18.88-31.66, light 247.29-249.70. Ekran Notatnika
raportuje 9 bledow konsoli w obu stanach i motywach; pozostale 0. Nie maskuje tego.

### Bramki i §18.1

- `check-artefakt`: PASS, 8 wobec baseline 9.
- `check-list-canon`: PASS, 368 wobec baseline 368.
- `check-focus-canon --ci`: PASS, 61 plikow/169 naruszen bez wzrostu.
- §18.1 panel: kolejnosc sekcji, tokeny `c-*`, zero nowego crimsona, widoczny
  fokus, Tab i Esc: PASS w zakresie panelu. Menu 1, canvas AI, generator i streaming:
  n/d, nie sa produktem przewodu. Pelna warstwa 4: PARTIAL 2/4.

Wymaga plikow przekrojowych: **NIE** — `dev-render/main.tsx` ma waska licencje R5;
usunieto tylko podmiane realnego ekranu na izolowany prototyp. Kanonicznego skryptu
zrzutow i macierzy nie zmieniono.

### Cztery pytania dyzuru 302

1. Historia / AI razem: **NIE, rozstrzygniete** przez nowszy kanon: Historia bez AI.
2. Akcje domyslnie rozwiniete w obu kontekstach: **TAK, rozstrzygniete w kodzie**.
3. Ponizej 1280 px zawsze drawer: **NIE ROZSTRZYGNIETE**; brak pomiaru breakpointu.
4. Lokalne podgrupy Powiazan w jednej sekcji: **TAK, zachowane** przez przekazanie
   realnych sekcji hostow bez splaszczania.

Flaga konczy dyzur domyslnie **OFF**. Do decyzji wlasciciela nadaja sie w tej
kolejnosci kadry ON: ideas-teresa light, notebook-rail light, potem ich pary dark
i EN. Dwa identyczne ekrany nie sa materialem do akceptacji wlaczenia.
