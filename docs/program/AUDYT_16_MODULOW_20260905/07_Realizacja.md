# 07. Realizacja — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

11 ekranów, 1 decyzja „poprawka” otwarta (zakładka Zasoby), 1 realny defekt. Menu raportowania Realizacji i wysokość podglądu były w Twoich uwagach — sprawdzić na żywo jutro.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Flagi Realizacji (korzyści, gantt, etapy, podsumowanie) | `executionFeatureFlags` | ON poza produkcją publiczną (bez zmian dziś) |
| Inteligencja raportów Realizacji | `execReportsIntelligence` | OFF (bez decyzji) |

## A. Zatwierdzone obrazy — 11 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `execution-report-day11` | Raport inteligencji pracy | A | ok |  | `evidence/grafika/134-noc-inicjatywy-wyniki/execution-report-day11__PRZED__light.png` |
| `execution-tab-control` | Zakładka „Sterowanie” | A | ok | Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno | `evidence/grafika/uwagi-zrobione-20260902/UW-06-02__execution-tab-control__light.png` |
| `execution-tab-resources` | Zakładka „Zasoby” | A | poprawka | Zobacz, karta podglądu w tym momencie nie zajmuje całej wysokości, jaką mogłaby mieć. Karta podglądu powinna być tak wysoka, jak tabela. Tabela, prawda, powinna być nieco bliżej trzeciego menu, ponieważ ta przestrzeń nie jest regulaminowa, nie jest kanonicznie wysoka. Generalnie karta podglądu musi  | `evidence/grafika/216-poprawione-dzis/mini-execution-tab-resources__PO__light.png` |
| `execution-tab-work` | Zakładka „Praca” | A | ok | Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno | `evidence/grafika/uwagi-zrobione-20260902/UW-06-01__execution-tab-work__light.png` |
| `exe-002-004-ui-audit` | Audyt kregoslupa realizacji | B | ok | Trzeci raz dajesz mi tę kartę do akceptacji. | `evidence/grafika/134-noc-inicjatywy-wyniki/exe-002-004-ui-audit__PRZED__light.png` |
| `execution-tab-list` | Zakładka „Realizacje” | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-execution-tab-list__PO__light.png` |
| `execution-tab-rollout` | „Rollout” (chromeless, deep-link) | B | ok | tutaj wcale te słowa pomiędzy tabelą a menu 3 nie sa potrzebne | `evidence/grafika/uwagi-zrobione-20260902/UW-06-03__execution-tab-rollout__light.png` |
| `execution-tab-summary` | „Summary one-look” (chromeless, za flagą summaryOneLook) | B | ok |  | `evidence/grafika/217-trzy-rodziny/execution-tab-summary__PO__light.png` |
| `execution-tab-people_change` | „People & Change” (chromeless, z Action Center) | C | — |  | `evidence/grafika/145-execution-taby/execution-tab-people_change__PO__light.png` |
| `execution-change-signals` | Sygnaly zmiany w realizacji | D | — |  | `evidence/grafika/134-noc-inicjatywy-wyniki/execution-change-signals__BRAK-EKRANU__light.png` |
| `execution-export-prezentacja` | Eksport realizacji do prezentacji | D | — |  | `evidence/grafika/134-noc-inicjatywy-wyniki/execution-export-prezentacja__BRAK-EKRANU__light.png` |

Bez Twojej decyzji (3): `execution-export-prezentacja`, `execution-change-signals`, `execution-tab-people_change`.

Decyzje „nie” / „poprawka”: `execution-tab-resources` = poprawka — Zobacz, karta podglądu w tym momencie nie zajmuje całej wysokości, jaką mogłaby mieć. Karta podglądu powinna być tak wysoka, jak tabela. Tabela, prawda, powinna być nieco bliżej trzeciego menu, poniew

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `exe-002-004-ui-audit`: Status w pasku tozsamosci to zwykly tekst zamiast pigulki — kanon artefaktow wymaga pigulki. Komponent wspoldzielony przez caly modul, za szeroki promien razenia na jeden ekran
- `execution-export-prezentacja`: Ekran harnessu wyrejestrowany, plik zostaje
- `execution-change-signals`: Ekran harnessu wyrejestrowany, plik zostaje
- `execution-tab-list`: Statusy 'Scheduled'/'Blocked' po angielsku obok polskiego 'W realizacji' (STATUS_METADATA, src/services/initiativeLifecycle.ts ~198-217).
- `execution-tab-rollout`: RolloutTab.tsx:987 — błąd sieci gasi całą zakładkę zanim zadziała ścieżka degradacji (zob. zgłoszenie #12 do toru funkcji).
- `execution-tab-summary`: Flaga ma komentarz „Default OFF do akceptu Piotra”, a logika (executionFeatureFlags.ts:115) włącza ją wszędzie poza public-prod — sprzeczność typu DEC-317, DO WYJAŚNIENIA z właścicielem (zob. zgłoszenie #11 do toru funkcji).
- `execution-tab-people_change`: Banner 'V8 is not enabled' po angielsku + zera.
- `execution-tab-people_change`: Etykiety ITEMS/CRITICAL/ISSUES/BLOCKED po angielsku (ExecutionManagementView.tsx:322).

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 5 w tym module (1 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `exe-002-004-ui-audit` | „Trzeci raz dajesz mi tę kartę do akceptacji." | 2026-08-30 | DO_NAPRAWY | — |
| `execution-tab-control` | „Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno" | 2026-09-01 | ZROBIONE | — |
| `execution-tab-resources` | „Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno" | 2026-09-01 | ZROBIONE | Liczby odmieniają się po polsku („1 dzień", „2 dni", „5 dni"), a tabela nie jest już sztucznie zwężana ani zasłaniana przez przypiętą kolumn |
| `execution-tab-rollout` | „tutaj wcale te słowa pomiędzy tabelą a menu 3 nie sa potrzebne" | 2026-09-01 | ZROBIONE | — |
| `execution-tab-work` | „Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno" | 2026-09-01 | ZROBIONE | — |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`NOT_MEASURED / RED_LEGACY_1_CONFIRMED`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-06_EXECUTION-20260903.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evidenc
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `85dfe6c3e2` (02.09 18
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-06_EXECUTION.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Realizację → z rozwijanego pola „Wybierz realizację” wybierz pozycję → sprawdź
czy nazwa jest czytelna (nazwa inicjatywy, nie ciąg znaków) → otwórz realny przypadek → z kebaba
wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: rozwijane pole „Wybierz realizację” pokazywało surowy
identyfikator techniczny — teraz pokazuje nazwę inicjatywy; dostępność doprowadzona do zera
błędów.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Pole „Wybierz realizację” pokazuje czytelne nazwy, nie ciągi liter/cyfr?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/06_EXECUTION/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
