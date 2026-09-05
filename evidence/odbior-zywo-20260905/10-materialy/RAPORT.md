# Odbiór na żywo 05.09 — pakiet 10 · Materiały (36 ekranów)

## Liczby
- **ZGODNY: 23**
- **RÓŻNI SIĘ: 8**
- **NIE DOTARŁEM: 5**
- Zrzutów w katalogu: 32 (cztery ekrany dzielą zrzut z ekranem sąsiednim, bo to ten sam stan aplikacji; `b2-template-gallery` bez zrzutu).

## Różnice (jedno zdanie każda)
1. **sheet-artifact** — układ arkusza zgodny w całości, ale pasek formatowania ma dziś IKONY ($ % B, wstaw/usuń wiersz i kolumnę, #) zamiast słów („Waluta, Procent, Pogrubienie…") z zatwierdzonego kadru; to realizacja prośby właściciela z sąsiedniego ekranu.
2. **excele-prawy-panel-standard** — prawy panel to rozwinięty akordeon (AKCJE/WŁAŚCIWOŚCI/POWIĄZANIA/ŹRÓDŁA/KOMENTARZE/HISTORIA), zgodny ze zrzutem PO z 01.09 wskazanym w opisie, ale wskazany „obraz zatwierdzony" z 30.08 pokazuje jeszcze stary warsztat „Zadanie ukończone 0/8" — referencja jest przeterminowana; dodatkowo pasek ikon zamiast słów.
3. **excele-edytowalna-siatka** — siatka jest realna i edytowalna, ale (jak wyżej) pasek ma ikony zamiast słów, a wskazany obraz z 30.08 pokazuje nieistniejący już warsztat.
4. **document-studio-resume-error** — komunikat i przycisk te same, ale karta jest teraz wyśrodkowana w pionie, z ikoną i nagłówkiem „Nie ma tu dokumentu" (to wprost uwaga właściciela „napisz to ładniej, wyśrodkuj").
5. **document-studio-template-resolve-error** — analogicznie ładniejsza, wyśrodkowana karta z ikoną; PONADTO blokada włącza się dopiero z parametrem `entry=template` — przy samym `?templateArtifactId=<nieistniejący>` aplikacja pokazuje zwykłą bramę „Jak chcesz zacząć dokument?" i blokada nie działa.
6. **report-artifact** — treść raportu jest w całości po polsku i uczciwa, ale aplikacja renderuje go w edytorze Document Studio, a nie jako gotową kartę raportu z pigułką statusu, paskiem KPI, tabelą RAG i benchmarkiem, jak na zatwierdzonym obrazie (takiego dokumentu jak na obrazie nie ma w danych właściciela).
7. **document-studio-ai-teresa** — ścieżka „Z AI" jest w działającej aplikacji WYŁĄCZONA (bez `?ff_zai_teresa=1` wchodzi stary formularz, mimo `VITE_ZAI_TERESA_ENABLED=true` w `.env.local`), a po wymuszeniu flagi prawy panel to inny komponent (pole „JAKI DOKUMENT MAM NAPISAĆ?" + dwa przyciski) niż czat Teresy z obrazu.
8. **document-studio-menu-pliku** — menu „Plik" otwiera się w drzewie DOM z poprawnym kompletem pozycji, ale NIE JEST WIDOCZNE ani klikalne: dropdown (260×208 px, opacity 1, z-index 40) siedzi wewnątrz przodka z `overflow:auto` w pasku nagłówka, który go przycina.

## Nie dotarłem (z powodem)
1. **document-studio-save-as-template** — pozycja „Zrób z tego wzorzec" istnieje, ale leży w niewidocznym/przyciętym menu „Plik" (jak wyżej); automat odmówił kliknięcia jako elementu zasłoniętego.
2. **report-builder-library-template** — modal „Nowy raport z wzorca" jest nieosiągalny: „Użyj wzorca" kończy się 403 „Nie masz dostępu do tego wzorca" — i dla wzorca systemowego (Raport diagnostyczny DRD), i dla własnego, ZATWIERDZONEGO wzorca organizacji (Board Control Template — DBR77).
3. **document-studio-blocks-i18n** — zatwierdzony obraz to wyłącznie dev-render trzech komponentów (DocTableBlock/DocKpiStrip/DocChartBlock) w stanie pustym; w aplikacji taki ekran nie istnieje, a wywołanie tych stanów wymagałoby wstawienia pustych bloków do realnego dokumentu (zakaz edycji).
4. **document-studio-streaming-honesty-n3** — stan „plan przed pisaniem" powstaje dopiero po uruchomieniu generacji AI, czego zabrania instrukcja.
5. **b2-template-gallery** — wspólna sesja właściciela wygasła o ~07:33 (odświeżenie tokenu → 401, przekierowanie na /login), a zalogować się może tylko właściciel; ekran leży poza menu Materiałów (Moja praca → Idee → kanwa).

## Dodatkowe obserwacje spoza listy ekranów (warte decyzji)
- **Martwy przewód „Edytuj" w Bibliotece wzorców**: kebab → „Edytuj" ustawia w adresie `editWorkbookTemplateId=<id>`, ale w `src/` nie ma ani jednego czytelnika tego parametru (jedynie producent `artifactNavigation.ts:135` i test) — builder nigdy się nie otwiera, użytkownik zostaje na liście.
- **Liczniki statusów w zakładce „Dokumenty" są zerowe**: chip „Wszystkie 79" obok „Szkic 0 / Gotowy 0 / Wyeksportowany 0 / Zarchiwizowany 0", podczas gdy każdy widoczny wiersz ma status „Szkic".
- **Pierwszy dokument z listy „Dokumenty" nie otwiera się**: wiersz 1 („Analizę dla rynku polskiego tylko", autor Justyna) prowadzi do 404 i ekranu „Nie ma tu dokumentu".
- **Język interfejsu przełącza się losowo między wczytaniami** (ten sam ekran raz po polsku, raz po angielsku, przy tym samym koncie) — widoczne m.in. na Bibliotece wzorców i Kreatorze szablonów dokumentów; przy angielskim renderze pojawiają się etykiety mieszane („Purpose (wymagane)").
- **Sposób dojścia do kreatora wzorców jest dziś dłuższy niż w opisach**: „Nowy wzorzec" → format → tryb; ścieżki Word i Prezentacja prowadzą do Architekta szablonów, a stary kreator wizard→builder zostaje tylko dla formatu Arkusz (świadoma decyzja z 2026-07-24 udokumentowana w kodzie).
- **Zatwierdzone obrazy 30.08 dla dwóch ekranów Excela są przeterminowane** (pokazują warsztat „Zadanie ukończone 0/8", którego produkt już nie ma) i **dwie pary obrazów są duplikatami** (`excele-engine-reveal` = `excele-jeden-widok-recent`; `excele-prawy-panel-standard` = `excele-edytowalna-siatka`).

## Czas i trudności
Przejście zajęło ok. 2 h 45 min (04:40–07:35). Najtrudniejsze: (1) ścieżki do kreatorów wzorców i „Z AI" są dziś inne niż w opisach `gdzie` i wymagały czytania kodu, żeby odróżnić defekt od przebudowy; (2) losowy przeskok języka PL/EN psuł selektory i wymagał podwójnych wariantów kliknięć; (3) zakaz tworzenia rekordów — kreator wzorców udało się otworzyć dopiero po sprawdzeniu w kodzie, że „Utwórz i edytuj" działa wyłącznie w pamięci; (4) katalog roboczy `/private/tmp/odbior-zywo-skrypty/10-materialy` zniknął w trakcie pracy (dysk 100%), trzeba było odtworzyć skrypt; (5) na koniec wygasła wspólna sesja i ostatni ekran został niesprawdzony.
