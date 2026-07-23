---
id: IDE-016
tytul: NAPRAWA — przyciski Mapy myśli wisiały w Tablicy, Przepływie i Tabeli i nie robiły nic
typ: zadanie
waga: krytyczna
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Standard docelowy Idea Workspace — P1-1 (docs/standards/idea-workspace/12_BACKLOG_I_ODBIOR.md)"
utworzone: 2026-07-23
ekran: processflow-canvas
wysokosc: 900
klik: "Sprawdź drugi pasek: w Przepływie ma być „Dodaj kształt”, w Tablicy „Dodaj karteczkę”, w Tabeli „Dodaj wiersz”, w Mapie „Dodaj węzeł”. Każdy ma faktycznie coś dodać. Wyszarzone ikony w lewym pasku mają po najechaniu tłumaczyć, dlaczego są niedostępne."
---

## 1. PROBLEM

Wspólne powierzchnie — drugi pasek, popovery lewego paska, prawy panel — wystawiały akcje **Mapy myśli** we wszystkich czterech reprezentacjach. Obsługuje je jednak wyłącznie mechanizm zamontowany w samej Mapie. Poza Mapą kliknięcie nie robiło nic: bez komunikatu, bez błędu, bez śladu.

Skala: około **40 martwych pozycji na reprezentację** (popovery AI, Import/Eksport, Więcej), razy trzy reprezentacje. Do tego „Dodaj węzeł" w Tabeli i „AI rozwiń" wszędzie.

## 2. ROZWIĄZANIE

Każda widoczna akcja jest teraz **albo podłączona, albo niewidoczna, albo wyłączona z podanym powodem**.

Podłączone do realnych odpowiedników:
- „Dodaj…" zmienia się z reprezentacją: węzeł · karteczka · kształt · wiersz.
- „Auto-układ" w Przepływie dostał własny handler (wcześniej wołał mapowy).
- Popover AI jest teraz per reprezentacja. **Przy okazji odsłoniły się trzy akcje Tabeli**, które miały gotowe handlery i modale, ale żadna powierzchnia ich nie wystawiała — były niedostępne mimo że działały.

Wyłączone z powodem: tryb kursora, import/eksport z paska, „Więcej narzędzi" — tooltip mówi, że to własność Mapy myśli i gdzie szukać odpowiednika.

## 3. JAK ODEBRAĆ

Przejdź przez cztery reprezentacje i sprawdź drugi pasek — nazwa przycisku „Dodaj…" ma pasować do narzędzia i faktycznie coś dodawać. „AI rozwiń" ma być widoczne tylko w Mapie myśli.

W lewym pasku trzy ikony są celowo wyszarzone poza Mapą. Najedź na nie — mają powiedzieć dlaczego.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- Inwentarz wykonany przez `grep` realnych obsługujących, nie z dokumentacji — każda martwa akcja ma wskazany plik i linię.
- Render w działającej aplikacji (1440×900, cztery obiekty testowe): chip „Dodaj…" różny w każdej reprezentacji, „AI rozwiń" tylko w Mapie, trzy sloty paska wyszarzone z powodem, zero błędów konsoli.
- esbuild wszystkich zmienionych plików — czysty.

## 5. CZEGO TA NAPRAWA NIE ZAŁATWIA (jawnie)

To naprawa **punktowa, nie systemowa**. Nie ma jeszcze rejestru akcji z rozdziału 02 standardu, więc następna akcja Mapy dopisana do wspólnej powierzchni znów będzie martwa — nie ma strażnika ani testu, który by tego pilnował. Rejestr to osobna, duża pozycja.

Ubyła też afordancja: poza Mapą znika chip „AI rozwiń" i wiersz „Podsumuj AI / Rozwiń AI" w prawym panelu. To świadomy wybór — lepiej brak przycisku niż przycisk, który kłamie — ale wart twojej decyzji.
