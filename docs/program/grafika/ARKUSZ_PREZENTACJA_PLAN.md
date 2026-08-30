---
doc_id: grafika-arkusz-prezentacja-plan
status: draft
owner: piotr
truth_type: plan
established: 2026-08-30
dotyczy: sheet-artifact, excele-prawy-panel-standard, excele-edytowalna-siatka, deck-artifact
---

# Arkusz i Prezentacja — co jest, czego nie ma, ile co kosztuje

Właściciel poprosił o plan przed budową. To jest ta jedna kartka.

## Najważniejsze zdanie

**Narzędzie Excelowe ISTNIEJE i jest kompletne — 2408 linii kodu, z serwerem, wersjonowaniem
i cofaniem. Jest wyłączone.** To ósmy raz w tym repo, kiedy rzecz uznana za brakującą okazuje
się zbudowana i pozbawiona wejścia. „Dorobić Excela" to nie budowa od zera — to włączenie
i doprowadzenie do standardu.

To samo dotyczy edycji slajdów: pasek `Nowy slajd · Pole tekstowe · Obraz · Motyw` istnieje
i pojawia się dokładnie wtedy, gdy włączymy tę samą flagę.

## Stan faktyczny

| Ekran | Co JEST | Czego NIE MA | Za flagą? |
| --- | --- | --- | --- |
| `sheet-artifact` | Pełny warsztat: pasek narzędzi u góry, pasek formuły, zakładki arkuszy z lewej, wpisywanie wartości i formuł, przeliczanie cross-sheet, waluta/procent/liczba, pogrubienie/kursywa/wyrównanie, wstaw/usuń wiersz i kolumnę, znajdź i zamień, cofnij/ponów, zamroź nagłówki, powiększenie, eksport XLSX | Prawy panel — **usunięty do zera** w tym trybie (`rightRailTools={[]}`); nagłówki wierszy/kolumn nie wyglądają na klikalne; połowa narzędzi schowana pod „Więcej" | **TAK — domyślnie WYŁĄCZONY** (`ff_artifactStudio` + `ff_spreadsheetStudioV2`, obie muszą być ON) |
| `excele-edytowalna-siatka` | To samo co wyżej — ten sam komponent, inny model danych (NPV/IRR) | To samo co wyżej | TAK, ta sama para flag |
| `excele-prawy-panel-standard` | To samo co wyżej | Przy WŁĄCZONYM warsztacie szyna ikon po prawej **znika** — ekran przestaje być o tym, o czym miał być | TAK, ta sama para flag |
| `deck-artifact` | Edycja slajdów działa BEZ flagi: klik w blok → edycja w miejscu, usuń/duplikuj/przesuń, przeciąganie ramek, wstawianie bloków, dodawanie slajdów. Za flagą dochodzi pasek `Nowy slajd · Pole tekstowe · Obraz · Motyw` | Bez flagi: brak paska narzędzi u góry (nie widać, że da się edytować) i prawy panel Teresy zjada ~500 px szerokości slajdu | Edycja: NIE. Pasek narzędzi: **TAK** (`ff_artifactStudio` + `ff_presentationStudioV2`) |

**Uwaga o demo:** na `demo.consultify.ai` zmienna `VITE_DEMO_ACCEPTANCE` jest ustawiona
(potwierdzone przez właściciela, DEC-2026-08-28-216), a ona włącza tę parę flag z pominięciem
wszystkiego. Czyli **na demo warsztat prawdopodobnie JEST już widoczny** — a uwagi właściciela
pochodzą ze zrzutów z harnessu, gdzie do 30.08 był wyłączony. To trzeba potwierdzić na żywym
demo przed zaplanowaniem czegokolwiek innego.

## Pomiar „jednej trzeciej ekranu" (kadr 1440 × 900)

| Wariant | Co stoi u góry | Pierwszy wiersz tabeli | Zużyte na górę | Zostaje na tabelę |
| --- | --- | --- | --- | --- |
| Arkusz **dziś** (warsztat OFF) | pasek „Zadanie ukończone 0/8" + Powtórz/Remix (53 px) · okruszki „Tabele / Przestrzeń robocza" · wiersz z nazwą pliku · zdanie „Skoroszyt … — 3 arkuszy." · dwie duże karty „Arkusze 3" i „Format XLSX" · pasek formuły | **350 px** | **38,9 %** | 550 px (61 %) |
| Arkusz **z warsztatem** (ON) | pasek tytułu + eksport (56 px) · pasek narzędzi (48 px) · pasek formuły (49 px) | **153 px** | **17,0 %** | 747 px (83 %) |

Właściciel powiedział „jedna trzecia". Zmierzone: **38,9 %** — czyli zaniżył.
Samo włączenie warsztatu odzyskuje **197 px**, ponad połowę straty.

### Co konkretnie stoi w tych 350 px i co z tym zrobić

| Element | Wysokość | Werdykt |
| --- | --- | --- |
| Pasek postępu „Zadanie ukończone 0/8" + Powtórz/Remix | 53 px | **Wyrzucić z arkusza.** To pasek generatora AI, nie arkusza. W trybie warsztatu już go nie ma. |
| Okruszki „Tabele / Przestrzeń robocza" | ~50 px | **Scalić** z paskiem tytułu (warsztat już tak robi: `Wróć do Materiałów › Arkusze › Nazwa`). |
| Wiersz z nazwą pliku + ikona pobierania | ~50 px | **Scalić** z tym samym paskiem tytułu. |
| Zdanie „Skoroszyt … — 3 arkuszy." | ~65 px | **Do prawego panelu** (sekcja Właściwości). Zero wartości u góry. |
| Karty „Arkusze 3" i „Format XLSX" | ~85 px | **Do prawego panelu.** To metadane, nie narzędzia. Liczba arkuszy i tak jest widoczna z zakładek. |
| Pasek formuły | ~47 px | **ZOSTAJE u góry.** To jest Excel. |
| Pasek narzędzi | — | **DOŁOŻYĆ u góry** — to jest „małe menu potencjalnych funkcjonalności", o które prosił właściciel. |

## Rozbicie na kawałki

| # | Kawałek | Co daje właścicielowi | Tor | Koszt |
| --- | --- | --- | --- | --- |
| K1 | Włączyć warsztat arkusza i prezentacji domyślnie (po akcepcie na zrzutach) | Excel i pasek edycji prezentacji stają się widoczne; górna jedna trzecia znika sama | grafika (decyzja) + funkcje (flaga) | **mały** |
| K2 | Przywrócić prawy panel w trybie warsztatu (dziś `rightRailTools={[]}` w arkuszu, prezentacji i Wordzie) | Właściciel odzyskuje panel, o który prosi — i jest gdzie przenieść metadane z góry | grafika | **średni** |
| K3 | Przenieść metadane (liczba arkuszy, format, opis, źródło) z góry do prawego panelu | Zabiera resztę zmarnowanej góry; tabela od samej góry jak w Excelu | grafika | **mały** |
| K4 | Nagłówki wierszy i kolumn mają WYGLĄDAĆ na klikalne (kursor, podświetlenie, kontur zaznaczenia) | Dopiero wtedy da się trafić w „Wstaw kolumnę" — dziś polecenie istnieje, ale nikt go nie znajduje | grafika | **mały** |
| K5 | Wyciągnąć waluta/procent/wstaw kolumnę spod „Więcej" na widoczny pasek | Właściciel widzi Excela, a nie trzy przyciski i wielokropek | grafika | **mały** |
| K6 | Optymistyczny podgląd edycji komórki (dziś warsztat czeka na odpowiedź serwera i przy błędzie nic się nie dzieje — bez komunikatu) | Wpisanie liczby daje natychmiastowy efekt zamiast ciszy | funkcje | **średni** |
| K7 | Prezentacja: zawęzić prawy panel Teresy (dziś ~500 px zjada slajd) | Slajd wraca do rozmiaru, przy którym da się pracować | grafika | **mały** |
| K8 | Głębsza edycja arkusza: scalanie komórek, obramowania, kolory tła, szerokość kolumn, wykresy, tabele przestawne | Pełne podobieństwo do Excela | funkcje | **duży** — i **wymaga decyzji o zakresie** |
| K9 | Prezentacja: bogatsza edycja bloku (kolory, czcionki, warstwy, wyrównanie do siatki) | Pełne podobieństwo do PowerPointa | funkcje | **duży** — i **wymaga decyzji o zakresie** |

## Rekomendowana kolejność

1. **Sprawdzić, co widać na żywym demo** — jeśli `VITE_DEMO_ACCEPTANCE` już włączyło warsztat,
   połowa tego planu jest wykonana i właściciel oglądał zrzuty z nieaktualnego stanu.
2. **K1** — bo to jedna zmiana, która sama załatwia „nie mam narzędzia Excelowego",
   „nie widzę gdzie edytować" i połowę „jednej trzeciej ekranu".
3. **K2 + K3** — bo prawy panel musi wrócić, ZANIM przeniesiemy do niego zawartość z góry.
4. **K4 + K5** — bo najtańsze co można zrobić, a bez nich połowa istniejącego Excela
   pozostaje nieodkrywalna.
5. **K7** — jedna liczba w kodzie, a właściciel narzeka na to wprost.
6. **K6** — pierwsza rzecz, która wymaga realnej pracy mechaniki.
7. **K8 / K9** — dopiero po decyzji właściciela o zakresie (patrz niżej).

## Tanie i natychmiastowe

K1, K3, K4, K5, K7. Wszystkie są **przestawieniem tego, co już istnieje** — nie budową.

## Wymaga decyzji właściciela, nie mojego przeczucia

**Jak głęboki ma być Excel?** Trzy poziomy, rosnąco:

- **Poziom 1 (JEST):** wpisywanie wartości i formuł, przeliczanie, waluta/procent/liczba,
  pogrubienie/kursywa/wyrównanie, wstaw i usuń wiersz/kolumnę, arkusze, znajdź i zamień, cofnij.
- **Poziom 2 (NIE MA, koszt średni/duży):** scalanie komórek, obramowania, kolory tła,
  szerokość kolumn, zamrażanie dowolnego zakresu, formatowanie warunkowe.
- **Poziom 3 (NIE MA, koszt duży):** wykresy, tabele przestawne, walidacja danych, makra.

To samo pytanie dla prezentacji. **Nie zgaduję za właściciela** — poziom 1 może już wystarczyć
do pracy doradczej, a poziom 3 to osobny program, nie kawałek.

## Czego NIE udowodniłem

Harness dev-render nie ma backendu, a warsztat zapisuje zmiany przez
`POST /api/workbook/:id/commands` (harness stubuje tylko `Api.get`
i `Api.updateWorkbookCell`). Dlatego **wpisanie wartości w komórkę na zrzucie
nie kończy się widoczną zmianą** — trafia w 404 i warsztat po cichu nic nie robi.
Kod ścieżki zapisu przeczytałem do serwera włącznie i jest kompletny, ale
**„edycja komórki działa u klienta" pozostaje nieudowodniona** do czasu kliknięcia
tego na demo albo dorobienia stubu poleceń w harnessie. Cisza przy błędzie to
osobny defekt — kawałek K6.

## Dowody

Zrzuty: `evidence/grafika/108-arkusz-prezentacja-plan/` (warsztat ON, oba motywy)
i `evidence/grafika/108-arkusz-prezentacja-plan-STUDIO-OFF/` (stan dzisiejszy).
Dowód interaktywny, że polecenia Excela realnie się wywołują:
`evidence/grafika/108-arkusz-prezentacja-plan/DOWOD__menu3-wiecej-kolumna.png`.

Kod, plik:linia:
- warsztat arkusza — `src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio.tsx:148`
  (2408 linii), montowany w `src/components/AIChat/KimiWorkspace/ExceleView.tsx:514-520`
- siatka z paskiem formuły — `src/components/AIChat/KimiWorkspace/EditableSpreadsheetGrid.tsx:704`
- lista poleceń Excela — `src/components/AIChat/KimiWorkspace/spreadsheetArtifactCommands.ts:206-316`
- silnik mutacji po stronie serwera — `server/src/services/workbook/workbookMutationEngine.ts:428-437`,
  trasa `server/src/routes/workbook.routes.ts:1832`, montaż `server/src/Gateway.ts:612`
- flaga fail-closed (domyślnie OFF) — `src/utils/artifactStudioFlags.ts:119-134`
- obejście przez środowisko demo — `src/utils/demoAcceptanceProfile.ts:27-32`
- prawy panel wyzerowany w trybie warsztatu — `SpreadsheetArtifactStudio.tsx:2020`,
  `src/components/Presentations/DeckBuilder/DeckBuilderMelsView.tsx:381`,
  `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:3549`
- edycja slajdu bez flagi — `src/components/Presentations/DeckBuilder/CardCanvas.tsx:138`
- edycja Worda bez flagi — `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:3337`
