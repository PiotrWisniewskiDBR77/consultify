# 05. Ocena — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

19 ekranów, 9 z Twoją uwagą, 6 realnych defektów — najwięcej otwartych spraw obok Wyników. Macierz DRD: pokazywałeś ją 5×; naprawiona w prezentacji i edytorze, ale EKRAN RAPORTU nadal rysuje odrzuconą tabelę z angielskimi kolumnami. Struktura raportu (ASS-2): prototyp 21 stron zaakceptowany 03.09 („fantastyczny”), silnik NIE zbudowany. Fałszywe „kompletność 100%” przy 7/39 odpowiedziach — naprawione.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Artefakty wyjściowe oceny (zakładka Wyniki oceny) | `VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED` | ON od dziś |
| Eksport raportu oceny do DOCX | `VITE_ASSESSMENT_DOCX_ENABLED` | ON od dziś |
| Widok raportu oceny | `—` | ON od 27.08 (DEC-148) |
| Macierz DRD właściciela 9×7 w prezentacji i edytorze | `—` | na stagingu TAK (7e262a2b9c, 81b1d9669f); EKRAN RAPORTU nadal rysuje odrzuconą tabelę — patrz sekcja B |

## A. Zatwierdzone obrazy — 19 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `assessment-artifacts-restart` | Wnioski z oceny | A | ok |  | `evidence/grafika/132-noc-wywiad-ocena/assessment-artifacts-restart__PRZED__light.png` |
| `assessment-five-surfaces` | Wybierak metodyk | A | ok | Niestety, tutaj tabela preview nie trzyma się opisanego standardu. | `evidence/grafika/20-tabele-szerokosc/assessment-five-surfaces__PRZED__light.png` |
| `assessment-initiatives-panel` | Panel inicjatyw | A | ok |  | `evidence/grafika/132-noc-wywiad-ocena/assessment-initiatives-panel__PRZED__light.png` |
| `assessment-initiatives-table` | Tablica inicjatyw strategicznych | A | ok | No, już to jest po prostu pełna tabela na pełną szerokość, a to wygląda, jakby to był jakiś raport w raporcie albo nie wiem co, nie? To ma być normalna tabela inicjatyw. Na koniec inicjatywy, na koniec każdej oceny, czy na koniec assessmentu, to są po prostu drafty inicjatywy, a normalnie w tabeli i | `evidence/grafika/20-tabele-szerokosc/assessment-initiatives-table__PRZED__light.png` |
| `assessment-list` | Lista ocen | A | ok | To samo rozumiem, że to ma być tabela na całą szerokość ekranu, a nie jakaś fragmentaryczna. | `evidence/grafika/20-tabele-szerokosc/assessment-list__PRZED__light.png` |
| `assessment-menu3-status-chips` | Biblioteka metodyk — chipy | A | ok |  | `evidence/grafika/132-noc-wywiad-ocena/assessment-menu3-status-chips__PRZED__light.png` |
| `assessment-presentation-view` | Prezentacja z oceny (9 slajdow) | A | ok | Ciagle nie wiem dlaczego nie uzywsz mojej maciezy DRD - nie mam juz siły serio !! moja maciez jest serio ładna - juz ja znalazłęśc przeciez  (zobacz mam to na ekranie Macierz oceny DRD — obszary x poziomy) | `evidence/grafika/132-noc-wywiad-ocena/assessment-presentation-view__PRZED__light.png` |
| `assessment-quality-review-panel` | Ocena i pokrycie dowodami | A | ok | Znowu taki wniosek: taka tabela jest możliwa, tylko pamiętaj, że w asesmencie mamy macierz odpowiedzi i ona jest ważna, bo jest narzędziem. To nie jest tylko prezentacja, to jest narzędzie, które sprawia, że wchodzimy w interakcję. Nie wiem, czy to, co mi tu pokazujesz, ma zastąpić macierz. Jeśli ta | `evidence/grafika/20-tabele-szerokosc/assessment-quality-review-panel__PO__light.png` |
| `assessment-report-contract` | Kontrakt raportu z oceny | A | ok |  | `evidence/grafika/132-noc-wywiad-ocena/assessment-report-contract__PRZED__light.png` |
| `assessment-reports-panel` | Panel raportow | A | ok | No, to jest normalna tabela na pełną szerokość, jak rozumiem. | `evidence/grafika/20-tabele-szerokosc/assessment-reports-panel__PRZED__light.png` |
| `assessment-reports-table` | Tabela raportow | A | ok |  | `evidence/grafika/20-tabele-szerokosc/assessment-reports-table__PO__light.png` |
| `drd-library-entry` | Biblioteka DRD | A | ok | Znowu dałeś mi coś bez analizy własnej. Tutaj nie ma żadnego podglądu; z całą pewnością kolumny nie są wystarczające. To nie jest dobra statystyka tego, co powinno być w tej tabeli. Do powtórki. | `evidence/grafika/20-tabele-szerokosc/drd-library-entry__PRZED__light.png` |
| `method-workspace` | Diagnostyka gotowosci | A | ok |  | `evidence/grafika/132-noc-wywiad-ocena/method-workspace__PRZED__light.png` |
| `assessment-manage-panel` | Panel zarządzania oceną | B | ok |  | `evidence/grafika/132-noc-wywiad-ocena/assessment-manage-panel__PRZED__light.png` |
| `assessment-output-report` | Raport z oceny | B | ok | No dobra, i teraz tak: jeśli chodzi o raporty z oceny, trochę to pomieszaliśmy, nie? Audyt i oceny to dwie różne historie. Oceny mają swój framework i raporty. Jeżeli chodzi o DRD, mamy konkretną formułę, w której znajdują się wszystkie poszczególne osie. Dla każdej osi określony jest obszar anality | `evidence/grafika/132-noc-wywiad-ocena/assessment-output-report__PRZED__light.png` |
| `drd-macierz-oceny` | Macierz oceny DRD — obszary x poziomy | B | ok |  | `evidence/grafika/132-noc-wywiad-ocena/drd-macierz-oceny__PRZED__light.png` |
| `siri-workspace` | Warsztat SIRI | B | ok | Ty, nie wiesz, co rozumiem, że okej, więc zobaczymy, jak to będzie, jak to wyjdzie. Ja nie znam Sir, więc trudno mi to ocenić. | `evidence/grafika/132-noc-wywiad-ocena/siri-workspace__PRZED__light.png` |
| `assessment-matryca` | Matryca oceny | C | — |  | `evidence/grafika/99-macierz-realna/assessment-matryca__PRZED__light.png` |
| `siri-tier` | Poziomy SIRI | C | — |  | `evidence/grafika/132-noc-wywiad-ocena/siri-tier__PRZED__light.png` |

Bez Twojej decyzji (2): `siri-tier`, `assessment-matryca`.

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B1. Zatwierdzony komponent ≠ komponent realnego użytkownika (audyt przewodów 03.09)

| Ekran | Werdykt | Co jest inaczej | Stan dziś |
|---|---|---|---|
| `assessment-initiatives-table` | ROZJAZD | — | komponent z odbioru jest martwy; realny ekran używa StandardTable — porównać wzrokiem |
| `assessment-list` | REPLIKA | Harness nie importuje `AssessmentHub` w ogóle. | do sprawdzenia na żywo jutro |
| `assessment-reports-table` | ROZJAZD | — | komponent z odbioru jest martwy; realny ekran używa StandardTable — porównać wzrokiem |
| `drd-library-entry` | REPLIKA | Harness nie importuje żadnego Hub/ekranu-właściciela. | do sprawdzenia na żywo jutro |

### B2. Przyrząd pokazał kompozycję, której w produkcie nie ma (audyt przyrządu 01.09)

| Ekran | Kategoria | Co dokładał / zmieniał przyrząd | Ocena, którą dałeś |
|---|---|---|---|
| `assessment-matryca` | Kategoria 1 | `<TopBar>` + `<ArtifactRightPanel>` wokół `DRDMatrixSession` | C |
| `siri-tier` | Kategoria 4 | własny widok nad `siriTierView.ts` | C |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `drd-library-entry`: Kolumna Zaktualizowano pokazuje date w formacie amerykanskim — defekt wspolnej warstwy tabel, dotyka calej aplikacji
- `assessment-list`: Kolumna Aktualizacja ucina naglowek i daty — szerokosc kolumn przy siedmiu kolumnach, defekt wspolnego silnika tabel, nie tego ekranu
- `assessment-reports-panel`: Obudowa ekranu po angielsku — inny komponent niz tabela raportow
- `assessment-presentation-view`: Podtytul slajdu 6 („Assessment of digital transformation across core business processes”) pozostaje po angielsku mimo ze reszta slajdu (tytul, etykiety osi, stopka) jest po polsku — drobna niespojnosc jezykowa, nie blokujaca.
- `assessment-initiatives-table`: Obudowa ekranu po angielsku
- `siri-workspace`: Napis Help content unavailable po angielsku
- `siri-workspace`: Nazwy wymiarow po angielsku — to standardowa terminologia SIRI, nie defekt tlumaczenia
- `siri-workspace`: KOREKTA 2026-08-30: pierwotnie oceniony na D jako nierenderujacy sie. Blad pomiaru, nie produktu — ten ekran ma WLASNE wejscie (plik .html), a mierzylismy go tylko wspolna droga ?screen=.
- `assessment-initiatives-panel`: Caly ekran po angielsku
- `assessment-initiatives-panel`: Blad w konsoli: zdublowany klucz EXECUTING
- `assessment-manage-panel`: Caly ekran po angielsku — 884 linie bez ani jednego klucza tlumaczen. Nie naprawiam pojedynczo, to osobne zadanie
- `siri-tier`: Prawie w calosci po angielsku, z surowymi parametrami obliczen. To narzedzie wewnetrzne — nie pokazywac klientowi
- `siri-tier`: KOREKTA 2026-08-30: pierwotnie oceniony na D jako nierenderujacy sie. Blad pomiaru, nie produktu — ten ekran ma WLASNE wejscie (plik .html), a mierzylismy go tylko wspolna droga ?screen=.
- `siri-tier`: ★ POMIAR 2026-09-01 (naprawa parytetu, Kategoria 4 audytu przyrządu): grep -rn "siriTierView|runSiriTier|siriTierAvailability" src/ server/src/ → poza własnym plikiem i testami wyłącznie DWA komentarze w `siriHttpSessionRuntime.ts` (101, 397), z których drugi mówi wprost, że runtime tego NIE woła. Ż
- `siri-tier`: ZBUDOWANY, ALE NIEPODŁĄCZONY: logika (`siriAdapter.prioritise` / `siriPrioritisation.ts`) i testy są gotowe; brakuje widoku w produkcie i wejścia do niego (osobny ekran po zamrożeniu sesji, wg ASSESSMENT_KB_SIRI.md §4 nie wolno go zlać z formularzem Band) — czyli więcej niż jeden przewód: widok + po
- `assessment-matryca`: Zgloszone do naprawy narzedzia
- `drd-macierz-oceny`: TRESC KOMOREK NADAL KLAMIE — 23 z 63 komorek osi 1 falszywych, kolumna 1F to siedem razy MES, 1A poziom 7 pokazuje CRM
- `drd-macierz-oceny`: ETYKIETY WIERSZY ZMYSLONE — macierz ma wlasna drabine zamiast drabiny z metodyki wlasciciela
- `drd-macierz-oceny`: CALOSC PO ANGIELSKU — nazwy poziomow i obszarow nie maja polskich wariantow w danych

### B4. Macierz DRD — dlaczego widzisz ją piąty raz

- Kanon: `docs/program/grafika/MACIERZ_TRESC_KOMOREK.md` (9 obszarów × 7 poziomów, treść z Twojej książki).
- Naprawione 01.09 w PREZENTACJI (`7e262a2b9c`) i EDYTORZE (`81b1d9669f`) — oba na stagingu.
- NIE naprawione: ekran RAPORTU, `src/components/assessment/report/AssessmentReportContractView.tsx:143` rysuje `AreaMatrixTable` z kolumnami Area / Current level / Target level / Gap / Evidence state.
- Miejsca rysujące macierz w kodzie: `AreaMatrixTable`, `EmbeddedMatrix`, `DRDMatrixSession`, `DRDMatrixReadOnly`, `slides.tsx`. Naprawa = jedna siatka (`DRDMatrixGrid`) we wszystkich naraz.
- Pytanie do Ciebie jutro: w Raporcie pełna siatka 9×7 z treścią komórek, czy siatka z zaznaczonym poziomem obecnym i docelowym per obszar?

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 9 w tym module (6 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `assessment-five-surfaces` | „Niestety, tutaj tabela preview nie trzyma się opisanego standardu." | 2026-08-30 | DO_NAPRAWY | Podglad trzyma standard: naglowek jak w pozostalych, szerokosc z kanonu zamiast wpisanej na sztywno (bylo w-400px, ktorego kanon zakazuje).  |
| `assessment-initiatives-table` | „No, już to jest po prostu pełna tabela na pełną szerokość, a to wygląda, jakby to był jakiś raport w raporcie albo nie wiem co, nie? To ma być normalna tabela inicjatyw. Na koniec inicjatywy, na koniec każdej oceny, czy na koniec assessmentu, to są po prostu  | 2026-08-30 | DO_NAPRAWY | Caly ekran po polsku: Tablica inicjatyw strategicznych, priorytety Krytyczny/Wysoki/Sredni/Niski, Nieprzypisany, naglowki kolumn. Pelna szer |
| `assessment-output-report` | „No dobra, i teraz tak: jeśli chodzi o raporty z oceny, trochę to pomieszaliśmy, nie? Audyt i oceny to dwie różne historie. Oceny mają swój framework i raporty. Jeżeli chodzi o DRD, mamy konkretną formułę, w której znajdują się wszystkie poszczególne osie. Dla | 2026-08-30 | DO_NAPRAWY | Raport ma teraz TWOJA strukture: 1. Jak prowadzono badanie (z prawdziwa proza z danych: ile obszarow objeto, ile z dowodem, kompletnosc dowo |
| `assessment-presentation-view` | „Ciagle nie wiem dlaczego nie uzywsz mojej maciezy DRD - nie mam juz siły serio !! moja maciez jest serio ładna - juz ja znalazłęśc przeciez (zobacz mam to na ekranie Macierz oceny DRD — obszary x poziomy)" | 2026-09-01 | DO_NAPRAWY | MACIERZ JEST. Slajd z macierzy osi: kolumny to 9 obszarow, wiersze to 7 poziomow, kropka stan obecny, kolko cel, pod spodem Aktualny/Docelow |
| `assessment-quality-review-panel` | „Znowu taki wniosek: taka tabela jest możliwa, tylko pamiętaj, że w asesmencie mamy macierz odpowiedzi i ona jest ważna, bo jest narzędziem. To nie jest tylko prezentacja, to jest narzędzie, które sprawia, że wchodzimy w interakcję. Nie wiem, czy to, co mi tu  | 2026-08-30 | DO_NAPRAWY | Panel mowi teraz WPROST, czym jest: 'To nie jest macierz oceny i jej nie zastepuje. Ponizsza tabela jest odczytem jej wyniku, zwinietym do s |
| `drd-library-entry` | „Znowu dałeś mi coś bez analizy własnej. Tutaj nie ma żadnego podglądu; z całą pewnością kolumny nie są wystarczające. To nie jest dobra statystyka tego, co powinno być w tej tabeli. Do powtórki." | 2026-08-30 | DO_NAPRAWY | Do powtorki zrobione. Byly cztery generyczne kolumny i klik wiersza nie robil nic. Teraz szesc realnych kolumn (Typ, Nazwa, Status, Postep z |
| `assessment-list` | „To samo rozumiem, że to ma być tabela na całą szerokość ekranu, a nie jakaś fragmentaryczna." | 2026-08-30 | ZROBIONE | POTWIERDZONE bez zmian: tabela jest na cala szerokosc w obu motywach. Twoja uwaga dotyczyla nieaktualnego stanu — waska ramka byla wina stan |
| `assessment-reports-panel` | „No, to jest normalna tabela na pełną szerokość, jak rozumiem." | 2026-08-30 | BACKLOG | Caly ekran po polsku: Raporty, Nowy raport, statusy (Wygenerowany, W przegladzie, Zatwierdzony, Szkic, Wyslany na zewnatrz), naglowki kolumn |
| `siri-workspace` | „Ty, nie wiesz, co rozumiem, że okej, więc zobaczymy, jak to będzie, jak to wyjdzie. Ja nie znam Sir, więc trudno mi to ocenić." | 2026-08-30 | BACKLOG | — |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / SERVER_NOT_MEASURED`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-04_ASSESSMENT-20260903-reszta.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, 
   G19 |`IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY`| data=2026-09-04, sha=2a7273e087, mianownik pokryty=1 z 30 wg `G19_INWENTARZ_OBOWIAZKOW_20260903.md` sekcja R2, przypadek „Day 360 G19 04 Assessment cross-org record isolation through ApiGateway denies a foreign organization whi
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY` (podniesione dyzurem 360 po scaleniu); P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/
```

### C4. Odłożone do fali 2 Twoją decyzją 03.09 (nie zobaczysz ich jutro i to nie jest defekt)

- `DEC-2026-09-03-364`: Przebudowa całego narzędzia sesji Oceny (menu, wywiad, warsztat, formularz/lista/macierz jako osobne tryby) (koszt: DUŻE, wzajemnie zależne (7 z 10 zależy od pozycji 4 i 6); moduł 47 127 linii)
- `DEC-2026-09-03-365`: Karty pytań z kolorem poziomu, stopniowym rozwijaniem i licznikiem odpowiedzi/pytań (koszt: DUŻE (prototyp) + ŚREDNIE, zależne od R-1)
- `DEC-2026-09-03-368`: Trzy karty Wnioski/Raporty/Inicjatywy pod Oceną, wzorem Narzędzi (koszt: DUŻE — kopiuje wzorzec z modułu zamrożonego `DEC-238`)
- `DEC-2026-09-03-369`: Uprawnienia zespołu z etapowymi zatwierdzeniami; model kredytów raportu; komentarze ludzkie i doradca AI przy Macierzy/Raporcie (koszt: DUŻE (023 — nowy model uprawnień); 027/028 — 0 linii dopóki nie ma modelu komerc)

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Ocenę → lista sesji → kliknij realną sesję klienta → otwórz zakładkę
Raportów → sprawdź kolumnę Status przy realnym raporcie → otwórz jeden raport → z kebaba wybierz
jedną akcję.

**Co się zmieniło od 22–23.08**: kolumna Status w Raportach Oceny była **pusta dla każdego
realnego raportu** (harness pokazywał martwy komponent) — teraz pokazuje prawdziwy status;
podobny martwy komponent usunięty z zakładki Inicjatyw Oceny; dostępność klawiaturowa i kontrast
doprowadzone do zera błędów.

**Czego NIE zgłaszaj**: nowa struktura raportu końcowego (wstęp→osie→wnioski→podsumowanie) — w
budowie osobnym torem, jeszcze nie na stagingu; nowy zestaw kolumn biblioteki DRD — przyjęty
kierunek, jeszcze nie zbudowany; przebudowa całego narzędzia sesji (menu/wywiad/warsztat/
macierz jako osobne tryby); karty pytań z kolorem poziomu; trzy karty Wnioski/Raporty/
Inicjatywy pod Oceną; uprawnienia zespołu i komentarze przy Macierzy — wszystko odłożone.

**Pytania (TAK/NIE)**:
- Kolumna Status przy realnym raporcie pokazuje wartość (nie jest pusta)?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
