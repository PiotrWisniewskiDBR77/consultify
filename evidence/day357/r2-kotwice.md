# Dyżur 357 — R2: znaczenia SHA i kotwice zdań

## `1c4b5a5635`

Pomiar na markerze przed poprawką: trzy trafienia, dwa znaczenia.

- wiersz 16: sporny znacznik wersji stagingu podany przez nadzorcę, zestawiony z `fb6547b7d0`;
- wiersz 65: commit usuwający martwe poddrzewo Czatu;
- wiersz 389: ten sam commit usuwający martwe poddrzewo Czatu, przywołany w tabeli.

Werdykt H3: **potwierdzona**. Poprawka nazywa oba znaczenia w samych zdaniach; nie wybiera prawdziwego SHA stagingu, nie usuwa `fb6547b7d0` i zachowuje informację o braku weryfikacji stagingu.

## „zobaczysz” / „widoczne”

Na markerze komenda `grep -c 'zobaczysz\|widoczne'` zwróciła **9**. Po R1 zwraca **10**, ponieważ prawdziwe ostrzeżenie o starym panelu zostało zapisane zarówno w sekcji modułu, jak i w tabeli. To jawna korekta mianownika, nie zniknięcie ani podmiana zdania.

| Wiersz po R1 | Skrót zdania | Kotwica plik:linia lub SHA? | Ocena |
| ---: | --- | --- | --- |
| 93 | bez flagi nadal zobaczysz stary panel | TAK | Źródło na następnym wierszu: `ideaNotebookRightPanelPrototypeFlag.ts:1,27` i bramka `IdeaNotebookRightPanelPrototype.tsx:97`. |
| 139 | bez decyzji zobaczysz pięć etapów SWOT | TAK | SHA `937f2d3193` na wierszu 140. |
| 219 | OKR i ROI są widoczne niezależnie od przełącznika | NIE | Dług: brak SHA lub `plik:linia` w tym twierdzeniu. Nie ustalono w tym dyżurze, że jest fałszywe. |
| 369 | warianty kart Decyzji niewidoczne przy OFF | TAK | SHA `e25eb19b64` na wierszu 370. |
| 389 | preferencja Czatu widoczna po redeployu | TAK | SHA `15309dd3a6` w zdaniu. |
| 390 | jedna żywa ścieżka Czatu widoczna po redeployu | TAK | SHA `1c4b5a5635` w zdaniu, teraz jawnie nazwany jako commit usuwający martwe poddrzewo. |
| 391 | przy OFF zobaczysz stary panel Idei/Notatnika | TAK | SHA `660482d485` oraz `ideaNotebookRightPanelPrototypeFlag.ts:1,27` i `IdeaNotebookRightPanelPrototype.tsx:97`. |
| 392 | kontrakt menu Interview widoczny po redeployu | TAK | SHA `924ebd3c7a` w zdaniu. |
| 393 | siedem etapów SWOT niewidoczne przy OFF | TAK | SHA `937f2d3193` w zdaniu. |
| 402 | flagi Wyników/Finansów/Organizacji/kreatora mogą być niewidoczne | NIE | Dług: data włączenia nie jest kotwicą `plik:linia` ani SHA. Nie ustalono w tym dyżurze, że zdanie jest fałszywe. |

Werdykt H4: **potwierdzona na markerze** — było 9 trafień i nie wszystkie miały kotwicę. Po poprawce R1 mianownik wynosi 10; bez kotwic pozostają dwa twierdzenia (wiersze 219 i 402 po R1).
