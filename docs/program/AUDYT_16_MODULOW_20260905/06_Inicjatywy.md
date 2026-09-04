# 06. Inicjatywy — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

7 ekranów. Największy rozjazd programu był tu: zatwierdzałeś kartę na komponencie, którego realny rekord nie otwierał — naprawione, realny rekord otwiera zatwierdzoną kartę. Karta ma 24 sekcje po Twoim akcepcie z 04.09. Powłoka SPEC-A włączona od dziś. „Tworzy raport” w doradcy obciążenia — funkcji nie ma w kodzie, fala 2.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Karta inicjatywy 24 sekcje w 5 grupach (DEC-388/393) | `—` | ON od 04.09 po Twoim akcepcie |
| Powłoka SPEC-A karty inicjatywy | `VITE_VF1_INIT_SPECA` | ON od dziś |
| Most inicjatyw (Inicjatywy ↔ Pomysły) | `VITE_INITIATIVE_BRIDGE` | ON od dziś |
| Wspólny kontrakt kart 7 typów | `ff_initiativeCardContract` | OFF — DEC-387: naprawiony (kasował 20/24 sekcji), pozostałe 6 typów kart niesprawdzone |

## A. Zatwierdzone obrazy — 7 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `ev-football-field` | Wycena metoda koszykowa | A | ok |  | `evidence/grafika/134-noc-inicjatywy-wyniki/ev-football-field__PRZED__light.png` |
| `karta-initiative` | Karta inicjatywy | A | ok | Tutaj będę robił jeszcze więcej przeglądów, jak załadujesz je danymi. Natomiast na ten moment widzę, że nie ma przycisku AI w górnym pasku, który będzie odpowiadał za wypełnienie karty. Poza tym wygląda zajebiście. | `evidence/grafika/dec387-pomiar-zastany-ON/karta-initiative__PO__pl__1440__light.png` |
| `plan-scenario-d1` | Plan inicjatyw | A | ok | Tabela niestety dalej nie wygląda jak kompletna tabela. Tu jest większy problem. Problem polega na tym, że narzędzie otwiera tę wybraną linię jako tabelę poniżej tej tabeli. Ma ona otwierać konkretną kartę. W ogóle nie rozumiem, jak to działa. | `evidence/grafika/97-czternascie-kolumn/plan-scenario-d1__PRZED__light.png` |
| `capacity-advisor-a3` | Obciazenie zespolu | B | ok | Dobrze, to jeszcze raz, bo już to opisywałem wiele razy. Słuchaj, jest tak: tutaj powinna być tabela, w której mamy na dany moment stworzony raport, czyli przycisk „Tworzy raport”. Raport jest generowany na bieżąco, na konkretną chwilę.  Obecnie, albo po jego wygenerowaniu, w tym momencie tworzono j | `evidence/grafika/97-czternascie-kolumn/capacity-advisor-a3__PRZED__light.png` |
| `initiative-record` | Rekord inicjatywy | B | ok | Inicjatywę oceniałem już wcześniej, raz. Nie wiem, czemu to jest inna tabela inicjatyw. Czy to pomyłka, czy celowo – powinniśmy mieć jedną tabelę inicjatyw. | `evidence/grafika/134-noc-inicjatywy-wyniki/initiative-record__PRZED__light.png` |
| `inicjatywy-lista` | Lista inicjatyw | C | — |  | `evidence/grafika/134-noc-inicjatywy-wyniki/inicjatywy-lista__PRZED__light.png` |
| `initiatives-portfolio-analysis` | Analiza portfela | D | — |  | `evidence/grafika/134-noc-inicjatywy-wyniki/initiatives-portfolio-analysis__BRAK-EKRANU__light.png` |

Bez Twojej decyzji (2): `inicjatywy-lista`, `initiatives-portfolio-analysis`.

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B1. Zatwierdzony komponent ≠ komponent realnego użytkownika (audyt przewodów 03.09)

| Ekran | Werdykt | Co jest inaczej | Stan dziś |
|---|---|---|---|
| `exe-002-004-ui-audit` | ROZJAZD | InitiativesHub.tsx:768-770 `desiredSubType = isShowcaseInitiativeId(initiative.id) ? 'showcase' : 'canonical-runtime'`; linia 1694 `if (activeDoc?.subType === 'canonical-runtime') return <CanonicalInitiativeCardWorkspace .../>`; InitiativeDocumentView montowan | NAPRAWIONE — realny rekord otwiera zatwierdzoną kartę (InitiativesHub:768) |
| `initiative-record` | ROZJAZD | InitiativesHub.tsx:768-770 `desiredSubType = isShowcaseInitiativeId(initiative.id) ? 'showcase' : 'canonical-runtime'`; linia 1694 `if (activeDoc?.subType === 'canonical-runtime') return <CanonicalInitiativeCardWorkspace .../>`; InitiativeDocumentView montowan | NAPRAWIONE — realny rekord otwiera zatwierdzoną kartę (InitiativesHub:768) |
| `karta-initiative` | ROZJAZD | InitiativesHub.tsx:768-770 `desiredSubType = isShowcaseInitiativeId(initiative.id) ? 'showcase' : 'canonical-runtime'`; linia 1694 `if (activeDoc?.subType === 'canonical-runtime') return <CanonicalInitiativeCardWorkspace .../>`; InitiativeDocumentView montowan | NAPRAWIONE — realny rekord otwiera zatwierdzoną kartę (InitiativesHub:768) |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `inicjatywy-lista`: PROTOTYP do Twojej decyzji — zero zmian w tym, co widzi dzis uzytkownik.
- `capacity-advisor-a3`: Ucięcie w środku słowa pochodzi z luki we wspólnym mechanizmie klamrowania: text-overflow:ellipsis nie działa dla pojedynczego długiego słowa w wielolinijkowej, rosnącej komórce. Naprawa wymaga przeprojektowania komponentu współdzielonego przez dziesiątki ekranów (2026-09-02)
- `karta-initiative`: Zapisano bez daty i godziny
- `karta-initiative`: Nawigacja pokazuje liczbe pozycji, nie postep typu 6/9 jak we wzorcu
- `karta-initiative`: Brak przycisku glownego — przyczyna funkcjonalna (sciezka zapisu statusu rzuca wyjatkiem), nie graficzna
- `karta-initiative`: Zmiana czatu Teresy na przycisk wejscia NIE jest potwierdzona wizualnie na TYM zrzucie (tryb Podglad nie pokazuje AKCJI w ogole) — do ponownego sprawdzenia w trybie Edycji.
- `initiative-record`: Tresc danych demo po angielsku — nie ustalono, czy to defekt, czy wybor danych dla klienta miedzynarodowego
- `initiatives-portfolio-analysis`: To decyzja produktowa, nie kosmetyka — wymaga rozstrzygniecia wlasciciela

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 4 w tym module (3 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `capacity-advisor-a3` | „Dobrze, to jeszcze raz, bo już to opisywałem wiele razy. Słuchaj, jest tak: tutaj powinna być tabela, w której mamy na dany moment stworzony raport, czyli przycisk „Tworzy raport”. Raport jest generowany na bieżąco, na konkretną chwilę. Obecnie, albo po jego  | 2026-08-30 | DO_NAPRAWY | Szerokosc naprawiona: 10 kolumn zamiast 13, etykiety skrocone, zero ucinania. UWAGA: Twoja glowna uwaga (ma byc przycisk Tworz raport i rapo // PROSTUJE: rwanie wyrazow w polowie zniknelo, ale ekran NADAL nie przechodzi. Przy 1440 px cztery wartosci koncza sie wielokropkiem (Ogranicz |
| `initiative-record` | „Inicjatywę oceniałem już wcześniej, raz. Nie wiem, czemu to jest inna tabela inicjatyw. Czy to pomyłka, czy celowo – powinniśmy mieć jedną tabelę inicjatyw." | 2026-08-30 | DO_NAPRAWY | — |
| `karta-initiative` | „Tutaj będę robił jeszcze więcej przeglądów, jak załadujesz je danymi. Natomiast na ten moment widzę, że nie ma przycisku AI w górnym pasku, który będzie odpowiadał za wypełnienie karty. Poza tym wygląda zajebiście." | 2026-08-30 | DO_NAPRAWY | Hipoteza i wnioski wypełnione w wariancie &dane=pelne — sprawdzone, że treść realnie dochodzi do pola. // Przycisk 'Wypelnij z AI' jest w gornym pasku, obok 'Analizuj z AI'. WAZNE: panel AI z akcja 'Uzupelnij puste' ISTNIAL i byl podpiety do real |
| `plan-scenario-d1` | „Tabela niestety dalej nie wygląda jak kompletna tabela. Tu jest większy problem. Problem polega na tym, że narzędzie otwiera tę wybraną linię jako tabelę poniżej tej tabeli. Ma ona otwierać konkretną kartę. W ogóle nie rozumiem, jak to działa." | 2026-08-30 | ZROBIONE | Tabela ma teraz 10 kolumn zamiast 14 — zero ucinania, zadnego naglowka lamanego w srodku wyrazu. Usuniety duplikat: kolumna zbiorcza pokazyw |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`NOT_MEASURED / RED_LEGACY_1_CONFIRMED`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-05_INITIATIVES-20260903.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evide
   G19 |`IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY`| data=2026-09-04, sha=2a7273e087, mianownik pokryty=1 z 30 wg `G19_INWENTARZ_OBOWIAZKOW_20260903.md` sekcja R2, przypadek „Day 360 G19 05 Initiatives decision isolation through ApiGateway denies a foreign organization while the 
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY` (podniesione dyzurem 360 po scaleniu); P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/
```

### C4. Odłożone do fali 2 Twoją decyzją 03.09 (nie zobaczysz ich jutro i to nie jest defekt)

- `DEC-2026-09-03-355`: „Tworzy raport” w doradcy obciążenia zespołu (migawka zespołu) — funkcji nie ma w kodzie (koszt: DUŻE (nowa funkcja))
- `DEC-2026-09-03-378` (część): Kreator inicjatyw od jednego zdania założenia, z propozycją AI do poprawienia (koszt: DUŻE (nowa funkcja, prototyp))
- `DEC-2026-09-03-382`: Wspólny kreator inicjatyw z Narzędzi (rozszerzenie zakazu `DEC-238`) (koszt: DUŻE; poza MVP z mocy rozszerzonego `DEC-238`)

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Inicjatywy → kliknij REALNĄ inicjatywę z listy (nie „Showcase”) → sprawdź czy
otwiera się karta robocza inicjatywy z zadaniami/kamieniami milowymi, nie sam dokument → z
kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08 — to jest najważniejsza zmiana w całym pakiecie**: dokładnie tu
był problem, który uruchomił cały ten przelot. Realna inicjatywa otwierała inny komponent niż
ten, który zaakceptowałeś na zrzutach (dostawałeś dokument zamiast roboczej karty). Naprawione:
otwarcie realnej inicjatywy z listy pokazuje teraz dokładnie tę kartę, którą zaakceptowałeś.
Dodano też bezpiecznik w testach, żeby to się nie cofnęło. Dostępność doprowadzona do zera
błędów.

Kontrakty kart zachowujące komplet sekcji są scalone, ale pozostają za flagą domyślnie OFF
(`DEC-387`). Przy niepustym szablonie karta nadal może pokazać tylko 6 z 24 sekcji niezależnie
od tej flagi (`DEC-388`); to stan oczekiwany do decyzji/wdrożenia, nie nowy defekt przelotu.
(zdezaktualizowane przez `500ae7d68c` i `e25eb19b64` — kontrakty kart i pomiar 24 sekcji).

**Czego NIE zgłaszaj**: kreator inicjatywy od jednego zdania z propozycją AI — odłożony do fali 2.

**Pytania (TAK/NIE)**:
- Po kliknięciu w realną inicjatywę zobaczyłeś kartę roboczą (zadania, kamienie milowe), a nie
  goły dokument?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/05_INITIATIVES/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
