# R4 — zrzuty i STOP merytoryczny

### STOP — R4
Rodzaj: MERYTORYCZNY
Powód: para PRZED/PO jest bajtowo identyczna, ponieważ zmiany R3 dotyczą etykiet portfolio-priority i risk-uncertainty oraz pozostałych komunikatów kompletności, a wskazany ekran harnessu renderuje wyłącznie pięć kafli dynamic-swot, które były już poprawione przed markerem.
Licencja, którą sprawdziłem: B.1 ekran harnessu — zapis warunkowy; nie zmieniono harnessu, bo nie wolno użyć zmiany przyrządu zamiast dowodu produktu.
Dowód: oba JSON-y pokazują 5/5 polskich kafli i 0 angielskich rdzeni; SHA-256 PRZED i PO jest identyczne per motyw: light `7a6d381c310a0caefa7fa55e3ac0cb7dea590d942790de064be6eaf8e6f9167b`, dark `198bcd4605d1b0a3879ae197a99ebfc0380612e2a39fa2f96931db2bbb91ca0e`.
Co dostarczyłem ZAMIAST zmiany: cztery wymagane kadry, JSON-y z tekstami pięciu kafli, sumy kontrolne i celowany test renderu 8/8 PASS.
Co zrobiłbym, gdyby zapadła decyzja X: po dostarczeniu licencjonowanego ekranu portfolio-priority/risk-uncertainty wykonałbym parę pokazującą zmienione etykiety. Nie rozszerzam sam harnessu, bo byłaby to zmiana przyrządu bez wskazanego kontraktu produktu.
Rekomendacja dla nadzorcy: odbierać R3 przez diff, ratchet i testy; R4 pozostawić NOT_PROVEN wizualnie dla dwóch zmienionych typów narzędzia.
Stan: R1–R3 zacommitowane; R4 dowodowo częściowy.
Czy kontynuowałem pozostałe pozycje: TAK — §0.5 nakazuje kontynuować po STOP merytorycznym pozycji.

Kadr PO pokazuje jednocześnie polskie drzewo po lewej i polskie kafle obok. Łańcuch harnessu montuje realny ToolDocumentView i computeDynamicSwotPhaseSummaries, ale nie montuje gałęzi portfolio-priority ani risk-uncertainty zmienionych w R3 — to granica dowodu.
