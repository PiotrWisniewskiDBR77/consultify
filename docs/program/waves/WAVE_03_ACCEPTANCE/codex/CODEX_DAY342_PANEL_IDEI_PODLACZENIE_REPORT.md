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
