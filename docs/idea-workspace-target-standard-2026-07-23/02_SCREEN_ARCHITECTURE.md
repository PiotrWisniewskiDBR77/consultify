# 02 — Architektura ekranu

## Warstwy ekranu

Każdy widok Idea Workspace składa się z tych samych warstw:

1. Menu 1 — cały obiekt Idea.
2. Menu 3 — aktualna reprezentacja.
3. Lewy rail — narzędzia edycji.
4. Obszar roboczy — canvas albo tabela.
5. Prawy panel — informacje, inspekcja, powiązania, komentarze, historia.
6. Floating toolbar — działania na zaznaczeniu.
7. Menu kontekstowe — prawy klik na tle, elemencie, krawędzi, lane/frame, wierszu, kolumnie, komórce.
8. Prawy dolny narożnik — zoom, fit, minimap, przełącznik reprezentacji.

## Rozdział odpowiedzialności

| Warstwa | Odpowiada za | Nie może zawierać |
|---|---|---|
| Menu 1 | nazwa Idea, status, zapis, Teresa, Convert, kebab globalny | narzędzia edycji elementów, Delete selected, dodawanie węzłów |
| Menu 3 | najważniejsze akcje aktualnego widoku | globalny Convert, reprezentacje, akcje innego narzędzia |
| Lewy rail | szybka edycja i tworzenie w aktualnym widoku | globalne akcje, Export, Convert, historia wersji |
| Prawy panel | przegląd, inspekcja, relacje, komentarze, historia | przełącznik widoków, martwe zakładki, globalny trash |
| Floating toolbar | akcje na zaznaczeniu | ustawienia całego workspace, niezwiązane AI |
| Context menu | akcje wynikające z miejsca kliknięcia | pełna nawigacja systemu, funkcje bez handlera |
| Prawy dolny narożnik | nawigacja po przestrzeni | dodawanie elementów, AI, Convert |

## Układ wizualny

Menu 1 i Menu 3 mają być pełnoszerokościowymi, jasnymi, spokojnymi warstwami systemowymi.

Lewy rail jest pionowy, wąski, ikonowy, z tooltipami. Nie pokazuje tekstowych buttonów, chyba że rozwija popover.

Prawy panel jest jasnym, zaokrąglonym komponentem systemowym. Nie może wyglądać jak ciężki techniczny sidebar. Musi mieć:

- stałą szerokość,
- jasne tło,
- delikatne obramowanie,
- zaokrąglenie,
- odstęp od krawędzi i od obszaru roboczego,
- własny scroll tylko wewnątrz panelu,
- aktywną zakładkę,
- możliwość zamknięcia.

Obszar roboczy ma ciemniejsze lub neutralne tło, na którym panele systemowe są czytelnie odróżnione.

## Przewijanie

- Menu 1 i Menu 3 pozostają nieruchome.
- Lewy rail pozostaje nieruchomy.
- Prawy panel pozostaje nieruchomy.
- Przewija się wyłącznie obszar roboczy albo wewnętrzna zawartość tabeli/canvasu.
- Panel rozmowy Teresa może zawęzić obszar roboczy, ale nie zastępuje prawego panelu.

## Stany wspólne

Każda akcja musi obsługiwać:

- enabled
- disabled z powodem
- loading
- success
- error
- empty state
- permission denied
- offline / reconnecting

Nie wolno zostawiać cichego kliknięcia bez reakcji.

## Tooltipy

Każdy przycisk ikonowy musi mieć tooltip:

- nazwa funkcji,
- scope, gdy nie jest oczywisty,
- skrót klawiaturowy, jeżeli istnieje,
- powód disabled, jeżeli akcja jest niedostępna.

Przykłady:

- `Auto-layout current process`
- `Delete selected elements`
- `Ask AI about selected node`
- `Convert whole Idea`
- `Convert selected rows`

## Empty states

Jeżeli widok jest pusty:

- Menu 3 pokazuje tylko akcje, które mogą stworzyć pierwszy element.
- Export jest disabled z powodem `Nothing to export`.
- Convert jest disabled z powodem `Add content before converting`.
- Prawy panel Przegląd pokazuje brief i rekomendowany pierwszy krok.
- AI może działać jako `Start with AI`, ale wynik musi być proposal/preview.

