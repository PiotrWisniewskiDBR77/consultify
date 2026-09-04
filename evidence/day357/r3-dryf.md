# Dyżur 357 — R3: dryf od odświeżenia pakietu

## Mianowniki

- ostatni commit pakietu: `2d74ea1d754f239f56e868839a469395a3f9922a`;
- pierwszy commit pakietu: `c950ede1219e0b95adeda5328a99d1e6ee51f87d`;
- od ostatniego: **11 scaleń, 17 plików produktu**;
- od pierwszego: **102 scalenia, 337 plików produktu**.

Werdykt H5: **potwierdzona**. Liczba `49/171` nie opisuje żadnego z tych punktów odniesienia.

## Przegląd pełnej listy 17 plików

| # | Plik | Czy zmienia treść pakietu? | Ocena wpływu na to, co zobaczy właściciel |
| ---: | --- | --- | --- |
| 1 | `server/src/services/report/__tests__/day346.fullSession39.gateway.pg.test.ts` | NIE | Nowy test dowodowy pełnej sesji 39/39; nie jest kodem renderowanym właścicielowi. |
| 2 | `server/src/services/report/drdReportModel.ts` | NIE | Liczy kompletność tylko z odpowiedzi faktycznych, nie z celów; nie przeczy opisowi ekranu Oceny ani odłożonej nowej strukturze raportu. |
| 3 | `src/components/DiscoveryTools/ToolDocumentView.tsx` | NIE | Dodaje widoczne kafle faz i plakietkę gotowości SWOT oraz synchronizuje wybór sekcji; liczba kroków nadal pochodzi z `getStepDefinitions()` (`:312`) i respektuje flagę w `useToolStore.ts:2780-2792`, więc ostrzeżenie o pięciu etapach przy OFF pozostaje prawdziwe. |
| 4 | `src/components/DiscoveryTools/toolCompletion.ts` | NIE | Lokalizuje etykiety faz SWOT; nie zmienia kontraktu pięć/siedem etapów opisanego w pakiecie. |
| 5 | `src/components/Initiatives/InitiativeDocumentView.tsx` | NIE | Zastępuje bezpośredni odczyt env trojwarstwową flagą; default pozostaje OFF, zgodnie z pakietem. |
| 6 | `src/components/Initiatives/sections/initiativeCardContract.ts` | NIE | Dodaje dziewięć deskryptorów i jawne mapowanie 24 pozycji, ale konsument pozostaje za flagą default OFF; pakiet już ostrzega o możliwych 6/24. |
| 7 | `src/components/MyWork/notebook/NotebookRightRail.tsx` | NIE | Przekazuje etykietę dostępności do panelu za flagą; nie omija bramki i nie zmienia zachowania przy OFF. |
| 8 | `src/components/MyWork/notebook/notebookSpecAShellFlag.ts` | NIE | Zmienia technikę odczytu env na statyczną, bez zmiany wartości domyślnej. |
| 9 | `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | NIE po poprawce R1 | Ujednolica szerokość, strukturę i etykietę panelu, ale bramka `:97` nadal zwraca `legacy` przy OFF; R1 już skorygował fałszywą obietnicę widoczności. |
| 10 | `src/components/shared/ModuleHub/FilterableTable.tsx` | NIE | Wspólny plik: dodaje `tabIndex` wierszom posiadającym akcje (`:1565-1570`); wzmacnia opisaną dostępność, nie zmienia kroków ani oczekiwanego ekranu. |
| 11 | `src/components/shared/TableWithPreviewLayout.tsx` | NIE | Wspólny plik: po zamknięciu podglądu przywraca fokus do żywego otwieracza lub kontenera (`:223-233`); nie zmienia treści ani nawigacji opisanej w pakiecie. |
| 12 | `src/components/standard/IdeaRightPanel.tsx` | NIE | Przekazuje etykietę dostępności do prototypu, nadal wyłącznie przez tę samą bramkę. |
| 13 | `src/components/standard/StandardPreview.tsx` | NIE | Wspólny plik: zawsze renderuje sekcję relacji, także pustą (`:353-368`); jest to doprowadzenie podglądów do wspólnego kontraktu, bez sprzeczności z instrukcjami przelotu. |
| 14 | `src/services/report/drdReportModel.ts` | NIE | Frontowy odpowiednik poprawki kompletności: odpowiedź, a nie cel, liczy obszar jako oceniony; pakiet nie obiecuje odmiennego licznika. |
| 15 | `src/utils/artifactRightRailFlag.ts` | NIE | Statyczny odczyt env zamiast wyliczanego; default bez zmian i brak nowej obietnicy w pakiecie. |
| 16 | `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` | NIE po poprawce R1 | Statyczny odczyt env umożliwia poprawne podstawienie przez Vite, ale domyślna wartość pozostaje `false`; właśnie ten fakt opisuje R1. |
| 17 | `src/utils/initiativeSectionsCompleteFlag.ts` | NIE | Nowa trojwarstwowa flaga `ff_initiative_sections_complete`, jawnie fail-closed OFF (`:1,13-15,39`); potwierdza istniejące ostrzeżenie pakietu. |

Wniosek: przejrzano **17/17** plików. Żaden nie wymaga dodatkowej korekty pakietu poza poprawką R1 dotyczącą panelu Idei/Notatnika. Trzy pliki przekrojowe zmieniają zachowanie dostępności/kontraktu relacji, ale nie unieważniają żadnego kroku ani oczekiwania w pakiecie.

## Nienaruszalność G16

`diff evidence/day357/g16-przed.txt evidence/day357/g16-po.txt`:

```text
```

Wynik pusty (`exit 0`, plik wyniku ma 0 bajtów).

`git diff --name-only 29fcbd4de20ca26d2febc50d9455128cab47ffce..HEAD -- docs/program/waves/WAVE_03_ACCEPTANCE/modules/`:

```text
```

Wynik pusty (0 bajtów): żaden z 16 plików `MODULE_ACCEPTANCE.md` nie został zmieniony.
