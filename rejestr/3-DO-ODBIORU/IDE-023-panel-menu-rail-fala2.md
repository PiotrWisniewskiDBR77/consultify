---
id: IDE-023
tytul: FALA 2 — panel wygląda kartowo, menu krawędzi/komórki wszędzie, przełącznik w rogu, Menu 1 krzyczy o konflikcie
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Standard docelowy Idea Workspace — P2-1/4/5/6, P3-7/8, K2"
utworzone: 2026-07-24
ekran: processflow-canvas
wysokosc: 900
klik: "Zmiany za flagami są opisane niżej — wymagają render-verify na wolnym porcie. Bez flag: prawy klik na połączeniu w Przepływie i na komórce w Tabeli daje menu; minimapa w rogu to ikona, nie napis."
---

## 1. CO DOSZŁO W TEJ FALI

**Widoczne od razu, bez flag:**
- **Menu krawędzi wszędzie** — prawy klik na połączeniu daje menu w Mapie, Tablicy i Przepływie (wcześniej martwy w Tablicy i Przepływie). „Usuń połączenie" realnie kasuje.
- **Menu komórki w Tabeli** — prawy klik na komórce daje własne menu (kopiuj wartość, wklej, rozwiń, wyczyść), nie menu wiersza.
- **Minimapa jako ikona** w prawym dolnym rogu, nie napis „Mini mapa".
- **Menu 1 przy konflikcie** — gdy wersje się rozjadą, pasek pokazuje jawny czerwony alert zamiast przygaszonego napisu. Chroni przed cichą stratą.
- **Tłumaczenia** — zniknęły surowe identyfikatory (`collaboration.*`), tory to „Tor N" po polsku, poprawione diakrytyki.

**Za flagami (do render-verify na wolnym porcie, potem akcept):**
- **Panel wygląda kartowo** (`?ff_ideaPanelVisual=1`) — to odpowiedź na „wsiowo": płaskie rzędy → wyniesione karty, wersalikowe nagłówki, odstępy. Funkcje bez zmian.
- **Przełącznik reprezentacji w prawym dolnym rogu** (`?ff_ideaSwitcherBottomRight` w rejestrze flag) — zdjęty z lewego railа (decyzja D2).
- **Tabela: data-rail** (`?ff_tableDataRail=1`) — bez trybu kursora, Szablonów, Importu (pojęcia płótna/Menu 3, nie miejsce railа).

## 2. JAK ODEBRAĆ

Bez flag: w Przepływie kliknij prawym na strzałkę między krokami — menu z „Usuń połączenie", „Odwróć kierunek", „Warunek". W Tabeli kliknij prawym na komórkę — menu komórki. Spójrz w prawy dolny róg — minimapa to ikona.

Za flagami: render-verify robi nadzorca sesji przed pokazaniem Ci (reguła #7 — nie jesteś pierwszym testerem). Panel kartowy zobaczysz do akceptu na czysto.

## 3. WERYFIKACJA WYKONANA PRZED ODDANIEM

- Menu krawędzi PF: 9 pozycji, „Usuń" kasuje — zmierzone renderem.
- Menu komórki Tabeli: otwiera się, zero błędów konsoli — zmierzone.
- Panel: treść identyczna OFF vs ON (funkcje nietknięte), oba motywy, zero crimsona w CTA.
- Przełącznik w rogu: 4 przyciski, zdjęty z railа, zero nakładania na kontrolki zoom.
- Data-rail: ON usuwa canvasowe sloty z Tabeli, OFF bez zmian.
- Kontrola typów całego projektu: 0 błędów. Strażnik rejestru: zielony. Regresja 4 reprezentacje: bez nowych defektów.
