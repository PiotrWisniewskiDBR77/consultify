# 10. Materiały — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

42 ekrany, 15 z uwagą, 7 realnych defektów. Od dziś włączone: Studio, galeria szablonów, cykl życia szablonu, Tabele i Prezentacje Mels, cztery flagi Tabel, „Z AI”. Tor Word w studio zostaje wyłączony (zabiera prawy pasek). Generatory szablonów „nie wiem, po co on jest” — 4 uwagi bez rozstrzygnięcia. Brak narzędzi edycji arkusza i prezentacji — 6 uwag, do zaplanowania.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Studio artefaktów: tor Prezentacje i Arkusz | `—` | ON od 30.08 |
| Studio artefaktów: tor Word (dokument) | `VITE_DOCUMENT_STUDIO_V2` | OFF celowo — włączenie zabiera Wordowi prawy pasek ikon (DocumentStudioDocumentPanel:2019/3205) |
| Studio (widok /studio) | `VITE_STUDIO_ENABLED` | ON od dziś |
| Galeria szablonów | `VITE_GALERIA_SZABLONOW_ENABLED` | ON od dziś |
| Cykl życia szablonu | `VITE_TEMPLATE_LIFECYCLE` | ON od dziś |
| Tabele i Prezentacje w powłoce Mels | `VITE_MELS_TABELE, VITE_MELS_PREZENTACJE` | ON od dziś |
| Tabele: konwersje, formularz, QA, pakiet źródeł | `VITE_TABELE_*` | ON od dziś (4 flagi) |
| „Z AI” — Teresa z boku zamiast formularza (Twoja wizja 27.07, N11–N13) | `VITE_ZAI_TERESA_ENABLED` | ON od dziś |
| Excel, 3 tryby, Architekt Deck, czytnik klienta, edytor szablonu Word | `—` | ON od 22.07 |

## A. Zatwierdzone obrazy — 42 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `b2-template-gallery` | Galeria szablonow mapy mysli | A | ok |  | `evidence/grafika/136-noc-materialy/b2-template-gallery__PRZED__light.png` |
| `deck-artifact` | Deck (szesc slajdow) | A | ok | Dobrze, jeśli chodzi o układ graficzny – pełna zgoda, ekran jest super. Do przepracowania mamy prawy panel. Nie, i nie widzę nigdzie, gdzie mogę edytować, nie? Czyli narzędzia do edycji ręcznej też nie widzę. Podobnie, zresztą, jak w Excelu. | `evidence/grafika/136-noc-materialy/deck-artifact__PRZED__light.png` |
| `document-artifact` | Dokument doradczy (pelny widok) | A | ok |  | `evidence/grafika/28-prawy-pas-rozwozenie/document-artifact__PRZED__light.png` |
| `document-studio-blocks-i18n` | Studio — puste stany blokow | A | ok |  | `evidence/grafika/136-noc-materialy/document-studio-blocks-i18n__PRZED__light.png` |
| `document-studio-context-chip` | Studio — chip kontekstu | A | ok |  | `evidence/grafika/136-noc-materialy/document-studio-context-chip__PRZED__light.png` |
| `document-studio-menu-pliku` | Studio — menu Plik | A | ok |  | `evidence/grafika/136-noc-materialy/document-studio-menu-pliku__PRZED__light.png` |
| `document-studio-nowy-dokument-martwe-przyciski` | Studio — nowy dokument | A | ok |  | `evidence/grafika/136-noc-materialy/document-studio-nowy-dokument-martwe-przyciski__PRZED__light.png` |
| `document-studio-resume-error` | Blad — nie znaleziono dokumentu | A | ok | Napisz to ładniej, wyśrodkuj na ekranie. | `evidence/grafika/grafika-tor-audit-20260830/document-studio-resume-error__PRZED__light.png` |
| `document-studio-save-as-template` | Studio — zrob z tego wzorzec | A | ok |  | `evidence/grafika/136-noc-materialy/document-studio-save-as-template__PRZED__light.png` |
| `document-studio-template-resolve-error` | Blad — nie znaleziono wzorca | A | ok | Napisz to jakoś ładniej na środku ekranu, z ładniejszą grafiką. | `evidence/grafika/grafika-tor-audit-20260830/document-studio-template-resolve-error__PRZED__light.png` |
| `excele-edytowalna-siatka` | Excel — edytowalna siatka | A | ok | Znacznie lepiej jest - zamienmy teraz słowa na typowe dla excela ikony - kazdy chyba juz na swiecie je zna. i bedziemy blisko | `evidence/grafika/grafika-tor-audit-20260830/excele-edytowalna-siatka__PRZED__light.png` |
| `excele-engine-reveal` | Excel — silnik bez serwera | A | ok |  | `evidence/grafika/grafika-tor-audit-20260830/excele-engine-reveal__PRZED__light.png` |
| `excele-jeden-widok-materialy` | Excel — arkusze w Materialach | A | ok |  | `evidence/grafika/grafika-tor-audit-20260830/excele-jeden-widok-materialy__PRZED__light.png` |
| `excele-jeden-widok-pusty` | Excel — stan pusty | A | ok |  | `evidence/grafika/grafika-tor-audit-20260830/excele-jeden-widok-pusty__PRZED__light.png` |
| `excele-jeden-widok-recent` | Excel — strona glowna | A | ok | Nie rozumiem, po co to ma być tutaj w ogóle, nie? Jak otwieramy arkusz, to pierwsze – nowy – to pierwsze, co on nas pyta, czy chcemy otworzyć go z szablonów, czy otworzyć go jako czysty, czy otworzyć go z teresą. To omawialiśmy. I teraz, jeśli wybierzemy któryś z tych przycisków, uruchamia się odpow | `evidence/grafika/grafika-tor-audit-20260830/excele-jeden-widok-recent__PRZED__light.png` |
| `excele-prawy-panel-standard` | Excel — prawy panel | A | ok | To już zgłaszałem, tak? Tutaj musimy usunąć więcej niepotrzebnego panelu, aby tabela zajmowała całą centralną część ekranu. No i wielki problem polega na tym, że nie mam tutaj w ogóle narzędzia Excelowego. Zmiany, jakbym chciał zmienić coś w tych tabelach, jak w Excelu, jakbym chciał nim pracować, t | `evidence/grafika/grafika-tor-audit-20260830/excele-prawy-panel-standard__PRZED__light.png` |
| `excele-reopen-verify` | Excel — blad generowania | A | ok |  | `evidence/grafika/grafika-tor-audit-20260830/excele-reopen-verify__PRZED__light.png` |
| `gen-deck-content-hints` | Kreator szablonow prezentacji | A | ok | Samo, nie wiem, po co on w ogóle jest. | `evidence/grafika/grafika-tor-audit-20260830/gen-deck-content-hints__PRZED__light.png` |
| `gen-word-content-hints` | Kreator szablonow dokumentow | A | ok | Wiem, do czego ten ekran miałby służyć. Znowu, gdy mamy generator do wyboru, wybieramy „generuj tabelę template”, otwiera się generator szablonów, a potem mamy je w liście szablonów. Widzimy, po co jest ten ekran. | `evidence/grafika/grafika-tor-audit-20260830/gen-word-content-hints__PRZED__light.png` |
| `materialy-draft-template-visibledraft-fix` | Szkic szablonu | A | ok |  | `evidence/grafika/136-noc-materialy/materialy-draft-template-visibledraft-fix__PRZED__light.png` |
| `materialy-launcher` | Nowy material | A | ok | Magicznie jest w porządku, tylko mogłoby być trochę bardziej seksowne. | `evidence/grafika/136-noc-materialy/materialy-launcher__PRZED__light.png` |
| `materialy-template-library-slice` | Biblioteka wzorcow | A | ok |  | `evidence/grafika/136-noc-materialy/materialy-template-library-slice__PRZED__light.png` |
| `prezentacje-template-states` | Prezentacje — trzy stany szablonu | A | ok | nie otwiera mi sie nic :( | `evidence/grafika/grafika-tor-audit-20260830/prezentacje-template-states__PRZED__light.png` |
| `report-artifact` | Raport dla komitetu sterujacego | A | ok |  | `evidence/grafika/grafika-tor-audit-20260830/report-artifact__PRZED__light.png` |
| `sheet-artifact` | Arkusz (podgląd) | A | ok | Tutaj mamy niestety trochę do poprawy. Słuchaj, tak jak tabela w Excelu, sama tabela powinna zaczynać się od samej góry, więc powinniśmy mieć małe menu potencjalnych funkcjonalności. Poniżej powinniśmy mieć już tylko nazwę kolumn i samą tabelę. Teraz, jedna trzecia ekranu jest zużyta zupełnie niepot | `evidence/grafika/136-noc-materialy/sheet-artifact__PRZED__light.png` |
| `template-builder-deck` | Kreator szablonu Deck | A | ok |  | `evidence/grafika/136-noc-materialy/template-builder-deck__PRZED__light.png` |
| `template-builder-doc` | Kreator szablonu Word | A | ok | To jest super!!!!!!! proste i czytelne - brawo | `evidence/grafika/31-prawy-pas-template/template-builder-doc__PRZED__light.png` |
| `template-builder-table` | Kreator szablonu Excel | A | ok |  | `evidence/grafika/136-noc-materialy/template-builder-table__PRZED__light.png` |
| `template-create-wizard` | Kreator szablonu — krok 1 z 3 | A | ok |  | `evidence/grafika/136-noc-materialy/template-create-wizard__PRZED__light.png` |
| `word-intake-uselm-default` | Generuj bez szablonu | A | ok | Też można poprawić grafiki, nie? W wielu miejscach można poprawić je na ładniejszy styl, troszeczkę. Przyciski, żeby były zgodne ze standardem. Wiem, że to nie jest super ważne, ale nic tu nie poprawiłeś. | `evidence/grafika/grafika-tor-audit-20260830/word-intake-uselm-default__PRZED__light.png` |
| `word-quality-badge` | Word — ocena jakosci | A | ok |  | `evidence/grafika/136-noc-materialy/word-quality-badge__PRZED__light.png` |
| `document-studio-ai-teresa` | Studio — z Teresa | B | ok |  | `evidence/grafika/136-noc-materialy/document-studio-ai-teresa__PRZED__light.png` |
| `document-studio-streaming-honesty-n3` | Studio — plan przed pisaniem | B | ok |  | `evidence/grafika/136-noc-materialy/document-studio-streaming-honesty-n3__PRZED__light.png` |
| `materials-registry` | Rejestr wspolny Materialow | B | ok |  | `evidence/grafika/grafika-tor-audit-20260830/materials-registry__PRZED__light.png` |
| `report-builder-library-template` | Nowy raport z wzorca | B | ok |  | `evidence/grafika/grafika-tor-audit-20260830/report-builder-library-template__PRZED__light.png` |
| `template-library-new-entry` | Biblioteka wzorcow — nowy szablon | B | ok | No, tak jak rozumiem, to jest normalna tabela, bo przecież to jest po prostu tabela, w której mamy w menu funkcję pod tytułem „wzorzec”, czyli template. To jest normalna tabela, ale już przyciski – przycisk dodawania, … | `evidence/grafika/136-noc-materialy/template-library-new-entry__PRZED__light.png` |
| `deck-quality-badge` | Deck — ocena jakosci | C | ok |  | `evidence/grafika/136-noc-materialy/deck-quality-badge__PRZED__light.png` |
| `insight-artifact` | Wniosek z wywiadu | C | — |  | `evidence/grafika/grafika-tor-audit-20260830/insight-artifact__PRZED__light.png` |
| `report-builder-block-types` | Rodzaje blokow raportu | C | — |  | `evidence/grafika/grafika-tor-audit-20260830/report-builder-block-types__PRZED__light.png` |
| `report-builder-templates` | Szablony raportow | C | — |  | `evidence/grafika/grafika-tor-audit-20260830/report-builder-templates__PRZED__light.png` |
| `document-studio-m1-share-primary` | Studio — udostepnianie | D | — |  | `evidence/grafika/136-noc-materialy/document-studio-m1-share-primary__PRZED__light.png` |
| `gen-excel-templates-tab` | Szablony skoroszytow | D | nie | To samo nie wiem, po co on jest. | `evidence/grafika/grafika-tor-audit-20260830/gen-excel-templates-tab__PRZED__light.png` |

Bez Twojej decyzji (4): `report-builder-block-types`, `report-builder-templates`, `insight-artifact`, `document-studio-m1-share-primary`.

Decyzje „nie” / „poprawka”: `gen-excel-templates-tab` = nie — To samo nie wiem, po co on jest. 

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B2. Przyrząd pokazał kompozycję, której w produkcie nie ma (audyt przyrządu 01.09)

| Ekran | Kategoria | Co dokładał / zmieniał przyrząd | Ocena, którą dałeś |
|---|---|---|---|
| `document-studio-context-chip` | Kategoria 2 | `max-w-4xl` (896 px) | **A** |
| `word-intake-uselm-default` | Kategoria 2 | `max-w-2xl` (672 px) | **A** |
| `report-artifact` | Kategoria 2 | `max-w-3xl` (768 px) | **A** |
| `materials-registry` | Kategoria 2 | `max-w-[1400px]` | **B** |
| `deck-quality-badge` | Kategoria 4 | `ResultStep` z `PresentationWizard`, a kreator jest w `AppRoutes.tsx:257` opisany jako „redirect-only, unimported" | **A** |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `template-library-new-entry`: Pasek w tle za modalem to nadal uproszczony dev-render (nie realny StandardModuleBar), z widoczną etykietą harnessu 'flaga templateBuilder: ON' w kadrze — sam modal kreatora jest realny i poprawny.
- `document-studio-resume-error`: PUSTKA ZAMIERZONA: Stan bledu — komunikat JEST trescia.
- `document-studio-template-resolve-error`: PUSTKA ZAMIERZONA: Stan bledu — komunikat JEST trescia.
- `deck-artifact`: Cienka crimsonowa smuga krazaca wokol pola pisania — USTALONE: to swiadoma ozdoba CHAT-OWN-012 (obrot 12 s, tylko gdy pole puste i nieaktywne). Na nieruchomym zrzucie wyglada jak rysa. Kolor to crimson #85182F przy 55% — kolizja z zasada, ze crimson jest tylko dla semantyki krytycznej. DECYZJA WLASC
- `deck-quality-badge`: ★ POMIAR 2026-09-01 (naprawa parytetu, Kategoria 4 audytu przyrządu): harness montuje `ResultStep`, którego JEDYNYM wołaczem jest `PresentationWizard.tsx:323`; sam `PresentationWizard` nie ma w src/ ANI JEDNEGO importu, a trasa `/presentations/wizard` jest redirect-only (AppRoutes.tsx:2741). Ten kon
- `deck-quality-badge`: MARTWY DUBLET ŻYWEJ FUNKCJI (nie brak funkcji): sama odznaka jakości decka JEST w produkcie — `DeckBuilder.tsx:1930-1959` renderuje „Jakość: N ostrzeżeń" + wynik krytyka, a DeckBuilder stoi na żywej trasie (AppRoutes.tsx:252, lazy). Właściciel oceniał kopię z wycofanego kreatora.
- `deck-quality-badge`: DO ZROBIENIA W TORZE GRAFIKI: przepiąć ekran na `DeckBuilder` (żywa ścieżka), nie na kreator. Do tego czasu nie pokazujemy.
- `excele-reopen-verify`: PUSTKA ZAMIERZONA: Stan bledu — komunikat JEST trescia.
- `excele-jeden-widok-pusty`: PUSTKA ZAMIERZONA: Dowod, ze pusty arkusz to klikalna siatka, a nie zaslepka.
- `template-create-wizard`: PUSTKA ZAMIERZONA: Formularz startowy — puste pole nazwy jest jego trescia.
- `materialy-launcher`: PUSTKA ZAMIERZONA: Modal wyboru formatu — z natury zwiezly.
- `document-studio-blocks-i18n`: PUSTKA ZAMIERZONA: Ekran ISTNIEJE po to, zeby pokazac puste stany po polsku. Pustka to jego temat.
- `gen-excel-templates-tab`: Zdjete z odbioru 2026-08-30, potwierdzone 2026-09-01 (ANALIZA_ODRZUCONE_20260901.md §1) — nie duplikuj wiecej
- `gen-excel-templates-tab`: KODU NIE RUSZAMY: skasowanie komponentu zabiloby kreator szablonow arkusza
- `word-quality-badge`: PUSTKA ZAMIERZONA: Przed uruchomieniem kontroli jakosci nie ma czego pokazac.
- `excele-edytowalna-siatka`: Mechanika 'Zadanie ukończone' obok '0/8 kroków' przy ponownym otwarciu zapisanego pliku — nie widoczna na tym zrzucie (inny przepływ), nie zweryfikowana w tej rundzie.
- `report-builder-library-template`: Cztery napisy przybite po angielsku w realnym komponencie
- `materials-registry`: Kolumna ZRODLO nadal surowa — slownik otwarty, wymaga decyzji o pelnej liscie
- `document-studio-streaming-honesty-n3`: Nie sprawdzono zachowania w trakcie pisania na zywo, tylko stan poczatkowy
- `document-studio-ai-teresa`: Cienka crimsonowa smuga krazaca wokol pola pisania — USTALONE: to swiadoma ozdoba CHAT-OWN-012 (obrot 12 s, tylko gdy pole puste i nieaktywne). Na nieruchomym zrzucie wyglada jak rysa. Kolor to crimson #85182F przy 55% — kolizja z zasada, ze crimson jest tylko dla semantyki krytycznej. DECYZJA WLASC
- `report-builder-block-types`: Caly komponent bez ani jednego klucza tlumaczen — nie pojedynczy napis, tylko brak lokalizacji ekranu
- `report-builder-templates`: Brak lokalizacji calego komponentu
- `report-builder-templates`: Kolumna SEKCJE pokazuje 0 bez wyjasnienia
- `insight-artifact`: Streszczenie, kluczowe ustalenia, tematy i ryzyka to nie cytaty, tylko wygenerowana tresc — cala po angielsku
- `insight-artifact`: Zdublowany cytat z poczwornym cudzyslowem
- `document-studio-m1-share-primary`: Zdublowany ekran testowy, nie brak funkcji

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 15 w tym module (7 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `deck-artifact` | „Dobrze, jeśli chodzi o układ graficzny – pełna zgoda, ekran jest super. Do przepracowania mamy prawy panel. Nie, i nie widzę nigdzie, gdzie mogę edytować, nie? Czyli narzędzia do edycji ręcznej też nie widzę. Podobnie, zresztą, jak w Excelu." | 2026-08-30 | DO_NAPRAWY | ZNALEZIONA PRAWDZIWA PRZYCZYNA 'nie widze gdzie edytowac': klik w blok — czyli pierwszy naturalny ruch — KASOWAL z ekranu wszystkie narzedzi |
| `document-studio-resume-error` | „Napisz to ładniej, wyśrodkuj na ekranie." | 2026-08-30 | DO_NAPRAWY | Komunikat wysrodkowany na ekranie, z ikona, tytulem i wyjasnieniem osobno — jak prosiles. // Kliknięcie w szablon nie wywraca już całego ekranu na czerwony komunikat awarii. Szablony z niepełnymi ustawieniami otwierają się normalnie. |
| `document-studio-template-resolve-error` | „Napisz to jakoś ładniej na środku ekranu, z ładniejszą grafiką." | 2026-08-30 | DO_NAPRAWY | To samo: wysrodkowane, z ikona i tytulem, zamiast surowego napisu. // Kliknięcie w szablon nie wywraca już całego ekranu na czerwony komunikat awarii. Szablony z niepełnymi ustawieniami otwierają się normalnie. |
| `excele-jeden-widok-recent` | „Nie rozumiem, po co to ma być tutaj w ogóle, nie? Jak otwieramy arkusz, to pierwsze – nowy – to pierwsze, co on nas pyta, czy chcemy otworzyć go z szablonów, czy otworzyć go jako czysty, czy otworzyć go z teresą. To omawialiśmy. I teraz, jeśli wybierzemy któr | 2026-08-30 | DO_NAPRAWY | — |
| `excele-prawy-panel-standard` | „To już zgłaszałem, tak? Tutaj musimy usunąć więcej niepotrzebnego panelu, aby tabela zajmowała całą centralną część ekranu. No i wielki problem polega na tym, że nie mam tutaj w ogóle narzędzia Excelowego. Zmiany, jakbym chciał zmienić coś w tych tabelach, ja | 2026-08-30 | DO_NAPRAWY | — |
| `sheet-artifact` | „Tutaj mamy niestety trochę do poprawy. Słuchaj, tak jak tabela w Excelu, sama tabela powinna zaczynać się od samej góry, więc powinniśmy mieć małe menu potencjalnych funkcjonalności. Poniżej powinniśmy mieć już tylko nazwę kolumn i samą tabelę. Teraz, jedna t | 2026-08-30 | DO_NAPRAWY | — |
| `word-intake-uselm-default` | „Też można poprawić grafiki, nie? W wielu miejscach można poprawić je na ładniejszy styl, troszeczkę. Przyciski, żeby były zgodne ze standardem. Wiem, że to nie jest super ważne, ale nic tu nie poprawiłeś." | 2026-08-30 | DO_NAPRAWY | Przyciski wg standardu, dwie sekcje (BRIEF, FORMAT I ODBIORCY) zamiast jednego ciagu, czerwona gwiazdka zastapiona neutralnym (wymagane). Pr // Kliknięcie w szablon nie wywraca już całego ekranu na czerwony komunikat awarii. Szablony z niepełnymi ustawieniami otwierają się normalnie. |
| `excele-edytowalna-siatka` | „Znacznie lepiej jest - zamienmy teraz słowa na typowe dla excela ikony - kazdy chyba juz na swiecie je zna. i bedziemy blisko" | 2026-09-01 | ZROBIONE | Pełny warsztat arkusza istnieje za wyłączoną flagą — pierwszy raz wyrenderowany. Widać pasek formuły, arkusze, waluta i procent. Dodawania k |
| `gen-deck-content-hints` | „Samo, nie wiem, po co on w ogóle jest." | 2026-08-30 | ZROBIONE | ZBADANE: JEDYNE wejscie do tworzenia szablonow prezentacji, zapis wprost do bazy szablonow. Nie zdjete z tego samego powodu. |
| `gen-word-content-hints` | „Wiem, do czego ten ekran miałby służyć. Znowu, gdy mamy generator do wyboru, wybieramy „generuj tabelę template”, otwiera się generator szablonów, a potem mamy je w liście szablonów. Widzimy, po co jest ten ekran." | 2026-08-30 | ZROBIONE | ZBADANE przed zdjeciem: to NIE jest zbedny ekran — to JEDYNE wejscie do tworzenia szablonow dokumentu, z mostem do Biblioteki wzorcow. Zdjec // Kliknięcie w szablon nie wywraca już całego ekranu na czerwony komunikat awarii. Szablony z niepełnymi ustawieniami otwierają się normalnie. |
| `prezentacje-template-states` | „nie otwiera mi sie nic :(" | 2026-09-01 | ZROBIONE | ZBADANE: to nie osobny ekran, tylko stany bledu GLOWNEGO generatora prezentacji — tego, ktorym robisz kazda prezentacje. Zdjecie usunęloby o // Trzy stany blokujace ISTNIEJA i wygladaja poprawnie — nie pokazywaly sie, bo adres w moim rejestrze byl niepelny (brakowalo identyfikatora s |
| `gen-excel-templates-tab` | „To samo nie wiem, po co on jest." | 2026-08-30 | BACKLOG | ZDJETE z odbioru — jako jedyne z czterech okazalo sie duplikatem: ten sam komponent zyje w dwoch innych miejscach, a flaga byla juz domyslni |
| `materialy-launcher` | „Magicznie jest w porządku, tylko mogłoby być trochę bardziej seksowne." | 2026-08-30 | BACKLOG | Okno jest zwarte: tytul i pytanie razem, trzy kafle rownej wagi, strzalka w jednej linii z nazwa. Zniknela dziura w srodku kafla i skoki cie |
| `template-builder-doc` | „To jest super!!!!!!! proste i czytelne - brawo" | 2026-08-30 | BACKLOG | Sprawdziliśmy, czy wpiąć ten ekran we wspólny system prawego pasa. NIE wpinamy — pogorszyłoby go. Zostaje tak, jak go pochwaliłeś. |
| `template-library-new-entry` | „No, tak jak rozumiem, to jest normalna tabela, bo przecież to jest po prostu tabela, w której mamy w menu funkcję pod tytułem „wzorzec”, czyli template. To jest normalna tabela, ale już przyciski – przycisk dodawania, …" | 2026-08-30 | BACKLOG | Droga: Materialy, zakladka Biblioteka wzorcow, przycisk Nowy szablon w prawym gornym rogu. Przycisk sprawdzony — jest w prawym rogu i ma kan |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / RED_LEGACY_2`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-11_MATERIALS-20260903-reszta.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `4d402fcfc8` (02.09 18
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-11_MATERIALS.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Materiały → otwórz bibliotekę → kliknij realny dokument/arkusz/prezentację z
listy → otwórz podgląd → z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: dostępność doprowadzona do zera błędów; naprawiony język w
kreatorze szablonów i powłoce warsztatów metodyk (wcześniej po angielsku mimo ustawienia PL).

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Podgląd realnego materiału otwiera się poprawnie, treść czytelna?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/11_MATERIALS/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
