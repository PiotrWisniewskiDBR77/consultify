# 09. Finanse — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

16 ekranów, 4 z uwagą, 2 realne defekty. Dziś włączone 5 paneli wyceny (zrzuty z 01.09 są, Twojej decyzji nie ma). Cztery panele ocenione jako osobne kartki są w produkcie jedną wspólną szufladą — to przyrząd, nie produkt. „Brak przycisku dodawania założeń” — przycisk był, wyłączona była flaga.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| 6 paneli Finansów: komentarze, porównanie, eksport/import, pochodzenie, zapisane widoki, pakiet sprawozdań v2 (A2) | `—` | ON od 03.09 (DEC-348) + 11 wpisów w bazie stagingu dla DBR77 wszystkie włączone |
| 5 paneli wyceny: opcje realne, granica efektywna, wrażliwość, Monte Carlo, scenariusze | `VITE_FINANCE_VALUE_PANELS` | ON od dziś; zrzuty z 01.09 istnieją, Twojej decyzji w rejestrze brak |
| Suity M16, wersjonowanie modelu, koszyk EV | `—` | ON od 16.07 |

## A. Zatwierdzone obrazy — 16 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `finance-analysis-workspace` | Analiza | A | ok | Nie mam jak tego zatwierdzić, nic tu nie widać, nic z tego nie można wyciągnąć. | `evidence/grafika/92-ostatnia-kolumna/finance-analysis-workspace__PRZED__light.png` |
| `finance-baseline-workspace` | Baza porownania | A | poprawka | dalej nie mam przycisku dodawania założeń i mozlwosći usuwania lini | `evidence/grafika/135-noc-finanse-admin/finance-baseline-workspace__PO__light.png` |
| `finance-comments-panel` | Komentarze | A | ok |  | `evidence/grafika/121-przeglad-calosci/finance-comments-panel__PO__light.png` |
| `finance-hub` | WEJSCIE do Finansow — piec zakladek | A | ok |  | `evidence/grafika/17-finanse-wejscie/finance-hub__valuation__PO__light.png` |
| `finance-lineage-navigator` | Nawigator pochodzenia | A | ok |  | `evidence/grafika/121-przeglad-calosci/finance-lineage-navigator__PO__light.png` |
| `finance-model-workspace` | Model finansowy | A | ok |  | `evidence/grafika/09-finanse/finance-model-workspace__PRZED__light.png` |
| `finance-saved-views-panel` | Zapisane widoki | A | ok |  | `evidence/grafika/121-przeglad-calosci/finance-saved-views-panel__PO__light.png` |
| `finance-workspace-bar` | Pasek tozsamosci | A | ok |  | `evidence/grafika/121-przeglad-calosci/finance-workspace-bar__PO__light.png` |
| `finance-compare-panel` | Porownanie okresow | B | ok | A moze całą szerokość dostpenego ekranu wykrzystajmy | `evidence/grafika/126-jezyk-kolor-daty/finance-compare-panel__PRZED__light.png` |
| `finance-export-import-panel` | Eksport i import | B | ok |  | `evidence/grafika/126-jezyk-kolor-daty/finance-export-import-panel__PRZED__light.png` |
| `finance-prediction-workspace` | Prognoza | B | ok |  | `evidence/grafika/121-przeglad-calosci/finance-prediction-workspace__PO__light.png` |
| `finance-statement-pack-workspace-v2` | Pakiet sprawozdan | B | ok |  | `evidence/grafika/121-przeglad-calosci/finance-statement-pack-workspace-v2__PO__light.png` |
| `finance-valuation-workspace` | Wycena | B | ok | Dobrze, słuchaj, to jak merytorycznie pewnie wygląda, to dobrze. Popracuj trochę nad grafiką. Zobacz, przyciski u góry są po prostu słowami, nie przyciskami okrągłymi. Popraw je graficznie, żeby wyglądały tak jak reszta naszego dokumentu. Układ merytoryczny i przepływ informacji są super. | `evidence/grafika/121-przeglad-calosci/finance-valuation-workspace__PO__light.png` |
| `finance-value-panels` | Panele wartosci | C | — |  | `evidence/grafika/09-finanse/finance-value-panels__PRZED__light__empty.png` |
| `finance-focus-mode` | Tryb skupienia (diagnostyka) | D | — |  | `evidence/grafika/09-finanse/finance-focus-mode__PRZED__light__autofocus.png` |
| `finance-id-bridge` | Most identyfikatorow (diagnostyka) | D | — |  | `evidence/grafika/09-finanse/finance-id-bridge__PRZED__light.png` |

Bez Twojej decyzji (3): `finance-value-panels`, `finance-id-bridge`, `finance-focus-mode`.

Decyzje „nie” / „poprawka”: `finance-baseline-workspace` = poprawka — dalej nie mam przycisku dodawania założeń i mozlwosći usuwania lini

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B1. Zatwierdzony komponent ≠ komponent realnego użytkownika (audyt przewodów 03.09)

| Ekran | Werdykt | Co jest inaczej | Stan dziś |
|---|---|---|---|
| `finance-comments-panel` | WARUNKOWY | src/hooks/useFinanceCommentsFlag.ts: `defaultValue: false` — flaga domyślnie OFF na develop. | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `finance-compare-panel` | WARUNKOWY | src/hooks/useFinanceCompareFlag.ts: `defaultValue: false` — flaga domyślnie OFF na develop. | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `finance-export-import-panel` | WARUNKOWY | src/hooks/useFinanceExportImportFlag.ts: `defaultValue: false` — flaga domyślnie OFF na develop. | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `finance-lineage-navigator` | WARUNKOWY | src/hooks/useFinanceLineageNavigatorFlag.ts: `defaultValue: false` — flaga domyślnie OFF na develop. | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `finance-saved-views-panel` | WARUNKOWY | src/hooks/useFinanceSavedViewsFlag.ts: `defaultValue: false` — flaga domyślnie OFF na develop. | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `finance-statement-pack-workspace-v2` | WARUNKOWY | src/hooks/useFinanceStatementPackWorkspaceV2Flag.ts:33 `defaultValue: false`. | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |

### B2. Przyrząd pokazał kompozycję, której w produkcie nie ma (audyt przyrządu 01.09)

| Ekran | Kategoria | Co dokładał / zmieniał przyrząd | Ocena, którą dałeś |
|---|---|---|---|
| `finance-comments-panel` | Kategoria 2 | `max-w-xl` (576 px) | **A** |
| `finance-lineage-navigator` | Kategoria 2 | `max-w-xl` | **A** |
| `finance-saved-views-panel` | Kategoria 2 | `max-w-md` (448 px) | **A** |
| `finance-export-import-panel` | Kategoria 2 | `max-w-md` | **B** |
| `finance-value-panels` | Kategoria 4 | `DriverPlannerPanel`, `ValueOfficePanel` — zero wołaczy | C |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `finance-lineage-navigator`: Wzorcowy przyklad prawa liczby — zero zawsze z wyjasnieniem
- `finance-workspace-bar`: PUSTKA ZAMIERZONA: Pasek pelny; cialo ekranu to swiadoma zaslepka poza zakresem pakietu.
- `finance-hub`: Surowe kody typow w kolumnach: Investment_case, base/opt/cons, DCF_FCFF, Prediction, STM
- `finance-analysis-workspace`: Wartości wskaźników bez znaku procenta w części wierszy — brak metadanych jednostki w danych, nie do naprawy w wyglądzie.
- `finance-export-import-panel`: 'Choose File' to natywna kontrolka przegladarki — nieprzetlumaczalna bez wlasnego uploadera
- `finance-model-workspace`: Pozostałe etykiety pól (PRZYCHODY (REVENUE), KOSZT WŁASNY SPRZEDAŻY (COGS) itd.) są dwujęzyczne celowo — akronim w nawiasie, nie surowy enum.
- `finance-statement-pack-workspace-v2`: Liczba przy etykiecie 'skala: tysiace' wyglada jak znany wzorzec podwojenia jednostki — dane makietowe, nie zweryfikowane wobec zywej bazy
- `finance-compare-panel`: Kody pozycji w kolumnie wymiarow — dane makietowe
- `finance-prediction-workspace`: Nazwy scenariuszy po angielsku — ustalony zargon finansowy, spojny w calym module
- `finance-valuation-workspace`: Glowna kwota wyceny BEZ WALUTY — kontrakt danych nie niesie tego pola. Zgloszone do toru funkcji, nie zmyslam waluty
- `finance-baseline-workspace`: Ujemna gotówka w scenie fundinggap poprawnie czerwona (semantyka krytyczna — alarm, nie ozdoba).
- `finance-baseline-workspace`: ZGLOSZENIE WLASCICIELA 01.09 (niezaadresowane): „przyciski w menu tej karty sa kazdy inne, nie wyglada dobrze” + brak przycisku dodawania kolejnych zalozen. Na zrzucie kontrolnym z dzisiaj (evidence/grafika/171-pojedyncze/finance-baseline-workspace__DOWOD-braku-defektu__*) naglowek ma faktycznie roz
- `finance-value-panels`: Osie wykresu i etykiety po angielsku — to dane makietowe harnessu, komponenty sa jezykowo neutralne. Wymaga polskich danych makietowych, nie zmiany kodu.
- `finance-value-panels`: ★ POMIAR 2026-09-01 (naprawa parytetu, Kategoria 4 audytu przyrządu): SIEDEM montowanych paneli (`DriverPlannerPanel`, `ValueOfficePanel`, `EfficientFrontierPanel`, `MonteCarloNpvPanel`, `RealOptionsPanel`, `ScenarioComputePanel`, `WhatIfSensitivityPanel`) ma po ZERO wołaczy JSX w src/ — grep "<Nazw
- `finance-value-panels`: ZBUDOWANE, ALE NIEPODŁĄCZONE (nie martwe): backend istnieje i zna te panele z nazwy — `server/src/routes/v8/financeValueDemoAllowlist.ts:113,121` wpisuje `ValueOfficePanel.tsx:98/112` jako `productionCaller`. Brakuje jednego przewodu po stronie UI: zakładki/gniazda w `FinanceHub` + przekazania fetch
- `finance-value-panels`: KOREKTA wcześniejszego powodu: „osie wykresu po angielsku, wymaga polskich danych makietowych" opisywało objaw, nie przyczynę — przyczyną jest brak wołacza, więc to nie jest ekran produktu.
- `finance-id-bridge`: Nie pokazuje sie jako ekran produktu
- `finance-focus-mode`: Nie pokazuje sie jako ekran produktu

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 4 w tym module (2 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `finance-baseline-workspace` | „dalej nie mam przycisku dodawania założeń i mozlwosći usuwania lini" | 2026-09-01 | DO_NAPRAWY | — |
| `finance-valuation-workspace` | „Dobrze, słuchaj, to jak merytorycznie pewnie wygląda, to dobrze. Popracuj trochę nad grafiką. Zobacz, przyciski u góry są po prostu słowami, nie przyciskami okrągłymi. Popraw je graficznie, żeby wyglądały tak jak reszta naszego dokumentu. Układ merytoryczny i | 2026-08-30 | DO_NAPRAWY | Przyciski u gory sa teraz okraglymi pigulkami z ramka, jak w reszcie aplikacji — aktywny krok widoczny od razu. Uklad merytoryczny bez zmian |
| `finance-analysis-workspace` | „Nie mam jak tego zatwierdzić, nic tu nie widać, nic z tego nie można wyciągnąć." | 2026-08-30 | ZROBIONE | Pelna tabela wskaznikow z danymi — wczesniej ogladales pusty wariant. Dodatkowo wszystkie 11 kolumn widocznych, ostatnia nie jest juz ucinan |
| `finance-compare-panel` | „A moze całą szerokość dostpenego ekranu wykrzystajmy" | 2026-09-01 | ZROBIONE | Ogladales pusty wariant. Z parametrem widac panel porownania. |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / RED_LEGACY_1`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-10_FINANCE-20260903-reszta.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `ev
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `97c8293786` (02.09 18
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-10_FINANCE.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Finanse → otwórz realny projekt/case z listy → sprawdź czy widzisz panele:
komentarze, porównanie, eksport/import, nawigator pochodzenia danych, zapisane widoki → otwórz
pakiet sprawozdań.

**Co się zmieniło od 22–23.08**: włączyłeś 03.09 wieczorem sześć paneli tej rodziny — robotnik
jeszcze kończy wdrożenie przełącznika (patrz „Czego NIE zgłaszaj” na górze dokumentu);
dostępność doprowadzona do zera błędów.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Widzisz przynajmniej część z sześciu paneli (komentarze/porównanie/eksport/nawigator/zapisane
  widoki/pakiet sprawozdań)?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/10_FINANCE/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
