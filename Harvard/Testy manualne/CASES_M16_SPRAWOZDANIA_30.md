# CASES — M16 Finanse · Sprawozdania finansowe · 30 bogatych case'ów testowych

> **Moduł:** M16 Finanse — zakładka Sprawozdania (`/finance?tab=statements`)
> **Główny plik:** `src/components/Economics/FinanceHub.tsx` (~2437 lin.) + katalog `src/components/Finance/`
> **Data:** 2026-06-25
> **Autor:** sesja projektowa (czytanie kodu, bez uruchamiania serwerów/testów)

---

## Legenda znaczników

- **[IMPORT]** — przepływ importu pliku (Excel/PDF/CSV) przez `FinancialStatementImportWizard`.
- **[DB]** — utrwalenie w tabeli (`financial_statement_packs`, `financial_statements`, `financial_statement_values`).
- **[EXPORT]** — produkuje pobierany plik lub artefakt do eksportu.
- **[V8]** — wywołanie przez `V8FinanceApi` (endpoint `/api/v8/finance/...`).
- **[LEGACY]** — automatyczny fallback do `/api/finance/...` po 400/404/405/501 z V8.
- **[CROSS-MODULE]** — powiązanie z innymi zakładkami (Models, Analysis) lub modułami.
- **[PACK]** — operacje na `FinancialStatementPackWorkspace` (pakiet P&L+BS+CF).

**Zasada E2E (każdy case z persystencją):** każda zmiana → żądanie HTTP odnotowane w Network → hard-refresh strony = stan identyczny. UI-zmiana bez żądania = FAIL.

---

## Spis 30 case'ów

### A. Import i tworzenie sprawozdań (MC-16S-01 … MC-16S-06)
- **MC-16S-01** · Import Excel (.xlsx) — tryb smart AI, automatyczne wykrycie P&L+BS+CF
- **MC-16S-02** · Ręczne tworzenie sprawozdania (manual create) — formularz metadanych
- **MC-16S-03** · Import PDF z OCR — 4-krokowy wizard (Upload→Detect→Map→Confirm)
- **MC-16S-04** · Import CSV — fallback detect + manualna korekcja mapowania linii
- **MC-16S-05** · Import z błędnym formatem — walidacja typu pliku + graceful error
- **MC-16S-06** · Import z ostrzeżeniami ekstrakcji — readiness „recoverable", naprawa mapowania

### B. Zarządzanie pakietami (Statement Packs) (MC-16S-07 … MC-16S-12)
- **MC-16S-07** · Tworzenie pakietu i widok FinancialStatementPackWorkspace
- **MC-16S-08** · Dodanie P&L + BS + CF do pakietu — completeness label P&L / BS / CF
- **MC-16S-09** · Walidacje pakietu — zakładka pack validations, fail/warning badges
- **MC-16S-10** · Readiness Ring i score pakietu — wskaźnik 0-100
- **MC-16S-11** · Edycja nazwy podmiotu (entity name) pakietu — PATCH metadanych
- **MC-16S-12** · Usunięcie sprawozdania z pakietu — DELETE + odświeżenie listy

### C. Praca z danymi (MC-16S-13 … MC-16S-18)
- **MC-16S-13** · Widok P&L — hierarchia pozycji, wcięcia poziomów, wiersze total/subtotal
- **MC-16S-14** · Widok BS — struktury aktywów/pasywów, aggregation level 1/2/3
- **MC-16S-15** · Widok CF — przepływy operacyjne/inwestycyjne/finansowe
- **MC-16S-16** · Przełączanie między P&L / BS / CF w pakiecie
- **MC-16S-17** · Porównanie okresów (YoY) — dwie kolumny + delta %
- **MC-16S-18** · Eksport danych finansowych (ExportToOutputDialog)

### D. Statusy i workflow (MC-16S-19 … MC-16S-24)
- **MC-16S-19** · Cykl statusów sprawozdania DRAFT → REVIEW → APPROVED
- **MC-16S-20** · Archiwizacja sprawozdania
- **MC-16S-21** · Filtrowanie listy po statusie (Ready / Recovery Queue / Rejected)
- **MC-16S-22** · Wyszukiwanie sprawozdania po nazwie podmiotu
- **MC-16S-23** · Sortowanie listy po dacie aktualizacji
- **MC-16S-24** · Masowa zmiana statusu (bulk status update)

### E. Integracja cross-module (MC-16S-25 … MC-16S-28)
- **MC-16S-25** · Tworzenie Modelu z pakietu sprawozdań (→ zakładka Models)
- **MC-16S-26** · Tworzenie Analizy z pakietu sprawozdań (→ zakładka Analysis)
- **MC-16S-27** · Widok powiązanych modeli w panelu preview sprawozdania
- **MC-16S-28** · Izolacja cross-org — sprawozdanie org A niewidoczne z org B

### F. Błędy i edge cases (MC-16S-29 … MC-16S-30)
- **MC-16S-29** · Scenariusz fallback V8 → legacy (symulacja 404 z V8)
- **MC-16S-30** · Pusta organizacja — brak sprawozdań, empty state

---

# A. Import i tworzenie sprawozdań

---

### MC-16S-01 · Import Excel (.xlsx) — tryb smart AI, automatyczne wykrycie P&L+BS+CF · [IMPORT] [DB] [V8]

**Co się dzieje**
Konsultant Apator S.A. wchodzi na `/finance?tab=statements` i klika „Import" / „Wgraj i analizuj". Otwiera się `FinancialStatementImportWizard` w kroku 1 (Upload). Konsultant przeciąga plik `Apator_SprawozdanieRoczne_2023.xlsx` (roczne sprawozdanie zawierające P&L + BS + CF na trzech arkuszach) na strefę dropzone lub klika „Wgraj i analizuj". Backend wywołuje `uploadAndAnalyzeWithFallback` → `V8FinanceApi.uploadAndAnalyzeStatement` → POST multipart `/api/v8/finance/statements/upload-and-analyze`. Jeśli backend zwraca `mode: 'smart'` z `analysis`, wizard pomija kroki Detect i Map i przeskakuje bezpośrednio do kroku Confirm (Krok 3 w wariancie smart). Konsultant widzi zieloną kartę „Dokument przeanalizowany przez AI" z listą znalezionych sekcji (P&L: 42 pozycje, BS: 38 pozycji, CF: 21 pozycji), podmiotem „Apator S.A.", okresem „2023", walutą PLN, skalą „thousands". Klika „Gotowe — przejdź do przeglądu".

**Efekty pracy**
Nowy rekord `financial_statement_packs` + 3 rekordy `financial_statements` (P&L/BS/CF) w DB. Sprawdź Network → `POST /api/v8/finance/statements/upload-and-analyze` → response 200 z `{ mode: 'smart', statementPackId, statements: [...], analysis: {...} }`. Po kliknięciu „Gotowe" callback `onComplete(statementPackId)` zamyka wizard. Na liście sprawozdań pojawia się nowy pakiet „Apator S.A. — 2023" ze statusem DRAFT i completeness label `P&L / BS / CF`. Po hard-refresh strony — pakiet przetrwa.

**Grafika**
Wizard 3-kroków w wariancie smart (etykiety: „Wgraj" → „Analiza AI" → „Gotowe"). Strefa dropzone z ikoną Upload, po wybraniu pliku — karta z nazwą pliku i rozmiarem w KB. Karta confirm: zielony nagłówek z CheckCircle2, sekcja „Znalezione sekcje" z badge P&L/BS/CF i liczbą pozycji, siatka metadanych (Podmiot, Okres, Waluta, Skala, Łącznie pozycji, Plik źródłowy). Przycisk „Gotowe" w kolorze emerald.

**Funkcjonalność**
`FinancialStatementImportWizard.tsx` (`handleUpload`, `uploadAndAnalyzeWithFallback`, krok `'confirm'` + `smartAnalysis`), `V8FinanceApi.uploadAndAnalyzeStatement` → `/api/v8/finance/statements/upload-and-analyze`, `trackFunnelEvent('financial_statement_import_started')`.

---

### MC-16S-02 · Ręczne tworzenie sprawozdania (manual create) — formularz metadanych · [DB] [V8]

**Co się dzieje**
Konsultant VTS Group nie ma pliku do importu — chce stworzyć pusty pakiet ręcznie i wypełnić dane później. Na liście sprawozdań klika „Nowe sprawozdanie" / „+" (CTA w topbarze). Otwiera się modal lub formularz z polami: Nazwa podmiotu (wpisuje: „VTS Group sp. z o.o."), Typ (PACK), Okres od (2024-01-01), Okres do (2024-12-31), Etykieta okresu (wpisuje: „2024-FY"), Waluta (PLN), Skala (thousands). Klika „Utwórz". Backend wywołuje `POST /api/v8/finance/statement-packs` z body `{ entity_name, period_start, period_end, period_label, currency, scaling }`. Konsultant widzi nowy wiersz w tabeli ze statusem DRAFT i completeness `—P&L / —BS / —CF` (brak sekcji).

**Efekty pracy**
Nowy rekord `financial_statement_packs` w DB z `readiness_status: 'pending'`. Sprawdź Network → `POST /api/v8/finance/statement-packs` → response 201 z `{ id, entity_name, period_label, ... }`. Na liście: wiersz „VTS Group sp. z o.o." z etykietą „2024-FY", status DRAFT, completeness `—P&L / —BS / —CF`. Po hard-refresh strony — pakiet przetrwa.

**Grafika**
Modal tworzenia pakietu z polami formularza (entity_name, period_start, period_end, period_label, currency, scaling). Przycisk „Utwórz" aktywny po wypełnieniu wymaganych pól. Po zamknięciu modala nowy wiersz w `FilterableTable` z kolumnami: Typ (ikona FileText + kod PACK), Nazwa, Kompletność, Okres, Waluta, Status (pill DRAFT = szary), Data aktualizacji.

**Funkcjonalność**
`FinanceHub.tsx` (handler `showImportWizard` lub dedykowany modal), `V8FinanceApi.createStatementPack` → `POST /api/v8/finance/statement-packs`, `loadStatements()` po zakończeniu.

---

### MC-16S-03 · Import PDF z OCR — 4-krokowy wizard (Upload → Detect → Map → Confirm) · [IMPORT] [DB] [V8]

**Co się dzieje**
Konsultant Elkomtech S.A. wgrywa skan rocznego raportu `Elkomtech_2023_skan.pdf` (format: skany stron, wymaga OCR). Backend analizuje dokument — ponieważ OCR jest mniej pewny, zwraca `mode: 'fallback'`, a nie `'smart'`. Wizard przechodzi do kroku 2 (Detect): konsultant widzi wykryte metadane — Typ: P&L, Pewność: 58%, Język: PL, Skala: thousands, Okres: puste (konsultant wpisuje „2023"). Klika „Wyodrębnij linie finansowe" (`handleExtract`) → backend kolejno: `POST /detect` → `POST /extract` → `POST /map` → zwraca lista linii z mapowaniem. Wizard przechodzi do kroku 3 (Map & Correct): konsultant widzi tabelę `FinancialStatementMappingEditor` z 47 liniami — 39 auto-mapped (zielony), 8 unmapped (szary). Poprawia 3 linie z błędnym mapowaniem przez dropdown wyboru canonical line. Klika „Zapisz i waliduj" → `PUT /api/v8/finance/statements/:id/values`. Krok 4 (Confirm) pokazuje readiness `'ready'` — zielona karta. Klika „Potwierdź i zapisz" → `POST /api/v8/finance/statements/:id/confirm`.

**Efekty pracy**
Rekord `financial_statements` (P&L) w DB ze statusem `confirmed`. Sprawdź Network: sekwencja `POST /detect` → `POST /extract` → `POST /map` → `GET /canonical-lines` → `PUT /values` → `POST /confirm`. Response `confirm` → 200. Na liście paczek: nowy wpis z completeness `P&L / —BS / —CF`. Po hard-refresh strony — sprawozdanie przetrwa. `trackFunnelEvent('financial_statement_import_completed')` odnotowany.

**Grafika**
Wizard 4-kroków (Upload, Detect, Map & Correct, Confirm) z paskiem postępu — ukończone kroki z zieloną ikonką Check. Krok Detect: siatka 2x2 z polami (Typ, Pewność/Język, Okres, Waluta), badge confidence color-coded (żółty 58%). Krok Map: nagłówek „Zmapowane linie: 39/47", `FinancialStatementMappingEditor` z wierszami (originalLabel | wartość | badge confidence | dropdown canonical line). Krok Confirm: zielona karta readiness `'ready'` z ChevronUp.

**Funkcjonalność**
`FinancialStatementImportWizard.tsx` kroki `'upload'` → `'detect'` → `'map'` → `'confirm'`, `detectStatementWithFallback`, `extractStatementWithFallback`, `mapStatementWithFallback`, `getCanonicalLinesWithFallback`, `saveStatementValuesWithFallback`, `confirmStatementWithFallback`.

---

### MC-16S-04 · Import CSV — fallback detect + manualna korekcja mapowania · [IMPORT] [DB] [V8]

**Co się dzieje**
Konsultant importuje plik `cash_flow_2024Q1.csv` z przepływami pieniężnymi Apator w formacie eksportu z systemu FK. Backend analizuje plik CSV — zwraca `mode: 'fallback'` z wykryciem: Typ P&L (błąd — to CF), Pewność 40%, Waluta PLN. Konsultant w kroku Detect ręcznie poprawia Typ na „CF" (Cash Flow) przez dropdown i Okres na „2024-Q1". Klika „Wyodrębnij linie finansowe". W kroku Map widzi 31 linii, z których 12 jest `unmapped` (backend nie rozpoznał niestandardowych etykiet FK). Konsultant iteruje przez unmapped linie i przypisuje każdej canonical line z dropdownu (np. „Przepływy z działalności operacyjnej" → `CF_OPERATING_TOTAL`). Po zmapowaniu 28/31 linii (3 nieistotne pozycje niefinansowe oznaczył `isNonFinancial`) klika „Zapisz i waliduj". Readiness: `'recoverable'` — żółta karta z listą ostrzeżeń. Klika wstecz, poprawia ostatnią pozycję, ponownie zapisuje → readiness `'ready'`.

**Efekty pracy**
Sprawozdanie CF w DB. Sprawdź Network → sekwencja PUT `/values` z 31 obiektami (28 mapped, 3 `isNonFinancial: true`) → response 200 z `{ validation: { status: 'warnings', messages: [...] }, readiness: { readinessStatus: 'recoverable', ... } }`. Po poprawce → PUT `/values` ponownie → readiness `'ready'`. POST `/confirm` → 200. Completeness: `—P&L / —BS / CF`.

**Grafika**
Krok Detect: badge confidence 40% w czerwieni. Krok Map: licznik „28/31 mapped", wiersze unmapped wyróżnione szarym tłem, dropdown canonical line z wyszukiwaniem. Krok Confirm (recoverable): żółta karta z ikoną AlertTriangle, lista ostrzeżeń (np. „Suma kontrolna CF nie bilansuje się"), readiness reason codes jako pill-badge.

**Funkcjonalność**
`FinancialStatementImportWizard.tsx`, `handleValueChange` + `handleCanonicalChange` (manualna korekcja), `setMappedValues`, `saveStatementValuesWithFallback` (dwie iteracje), walidacja readiness states: `'pending'` → `'recoverable'` → `'ready'`.

---

### MC-16S-05 · Import z błędnym formatem pliku — walidacja i graceful error · [IMPORT]

**Co się dzieje**
Konsultant próbuje zaimportować plik Word `Raport_zarzadu_2023.docx` przez strefę dropzone wizarda. Wizard sprawdza typ pliku — `.docx` nie należy do `ACCEPTED_TYPES` (`application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv`) ani do `ACCEPTED_EXTS` (`['.pdf', '.xlsx', '.xls', '.csv']`). Pokazuje błąd „Supported formats: PDF, XLSX, XLS, CSV". Konsultant próbuje także upuścić plik `.txt` — ten sam komunikat błędu. Następnie próbuje zaimportować plik `.xlsx` o rozmiarze 50MB (bardzo duży raport korporacyjny) i sprawdza, czy backend zwraca sensowny błąd lub timeout. Na koniec konsultant testuje plik `.csv` o prawidłowym rozszerzeniu, ale z uszkodzoną zawartością (obcięty CSV) — sprawdza toast błędu bez white-screen aplikacji.

**Efekty pracy**
Brak żadnego żądania HTTP do backendu przy walidacji formatu pliku (błąd czysto frontendowy). Sprawdź Network → brak `POST /upload-and-analyze`. Błąd `.docx`: komunikat inline w strefie dropzone. Błąd pliku uszkodzonego: toast błędu na ekranie z treścią z backendu (`e?.response?.data?.error` lub `e?.message`), wizard pozostaje w kroku Upload, aplikacja działa dalej (brak crash). Brak nowego rekordu w DB.

**Grafika**
Strefa dropzone: baner błędu z ikoną AlertTriangle i tekstem „Supported formats: PDF, XLSX, XLS, CSV". Plik wybrany: karta z nazwą pliku widoczna, ikona X do usunięcia. Toast błędu backend (jeśli plik uszkodzony): czerwony toast z treścią wyjątku. Przycisk „Wgraj i analizuj" pozostaje nieaktywny (`disabled:opacity-50`) przy braku pliku.

**Funkcjonalność**
`FinancialStatementImportWizard.tsx` (`handleDrop` — walidacja `ACCEPTED_TYPES` + `ACCEPTED_EXTS`, `setError`), `handleUpload` → `uploadAndAnalyzeWithFallback` → błąd backendu → `setError(e?.response?.data?.error || e?.message)`.

---

### MC-16S-06 · Import z ostrzeżeniami ekstrakcji — readiness „recoverable", naprawa mapowania · [IMPORT] [DB] [V8]

**Co się dzieje**
Konsultant importuje plik `BS_VTS_2023_niestandardowy.xlsx` — bilans VTS Group ze specyficzną strukturą korporacyjną (wiele poziomów grupowania, niestandardowe nazwy). Backend zwraca `mode: 'fallback'`, extraction diagnostics zawiera ostrzeżenia: `["Kolumna porównawcza nie znaleziona", "5 wierszy pominiętych (puste komórki)"]`. W kroku Map konsultant widzi panel ostrzeżeń ekstrakcji (żółty baner) nad tabelą mapowania. 15 z 62 linii ma `mappingTier: 'review_required'` (żółta ikona). Konsultant przegląda te linie i ręcznie przypisuje canonical IDs. Po zapisaniu wynik to readiness `'recoverable'` — karta żółta z listą reason codes. Konsultant klika wstecz do Map i poprawia jeszcze 3 pozycje. Ponowne zapisanie → readiness `'ready'`. Potwierdza i zapisuje.

**Efekty pracy**
Sprawozdanie BS w DB ze wszystkimi liniami zmapowanymi (opcja powrotu z Confirm do Map jest używana dwukrotnie). Sprawdź Network → `PUT /values` → response z `validation.messages` zawierającymi ostrzeżenia i `readiness.readinessStatus: 'recoverable'`, potem ponownie `PUT /values` → `readiness.readinessStatus: 'ready'` → `POST /confirm` → 200. `extractionDiagnostics.warnings` wyświetlone w UI.

**Grafika**
Krok Map: żółty baner ostrzeżeń (header „Ostrzeżenia ekstrakcji" + lista), licznik mapped `47/62`. Wiersze z `mappingTier: 'review_required'` mogą mieć ikony AlterTriangle. Krok Confirm (recoverable): żółta karta z listą `validation.messages`, badge reason codes (np. `BS_BALANCE_MISMATCH`, `LOW_CONFIDENCE_MAPPING`), przycisk „Potwierdź i zapisz" nieaktywny. Po poprawie: zielona karta, przycisk aktywny.

**Funkcjonalność**
`FinancialStatementImportWizard.tsx` (`extractionDiagnostics.warnings` w UI, `readinessStatus: 'recoverable'` → cofnięcie do kroku `'map'` → ponowny `handleSaveMapping`), `setReadiness`, `isReadyForConfirm = readiness?.readinessStatus === 'ready'`.

---

# B. Zarządzanie pakietami (Statement Packs)

---

### MC-16S-07 · Tworzenie pakietu i widok FinancialStatementPackWorkspace · [PACK] [DB] [V8]

**Co się dzieje**
Po zaimportowaniu sprawozdania (MC-16S-01) konsultant klika na pakiet „Apator S.A. — 2023" w liście sprawozdań. Otwiera się `FinancialStatementPackWorkspace` — główny workspace pakietu. Komponent pobiera szczegóły pakietu: `V8FinanceApi.getStatementPack(statementPackId)` → `GET /api/v8/finance/statement-packs/:id`. Konsultant widzi nagłówek pakietu z: ReadinessRing (wskaźnik kołowy score%), nazwą podmiotu „Apator S.A.", etykietą okresu „2023", walutą PLN, skalą thousands, liczbą dokumentów. Zakładki P&L / BS / CF w header barze — aktywna P&L (niebieskie tło). Panel boczny (side panel) z listą plików źródłowych.

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statement-packs/:id` → response 200 z `{ pack: { id, entity_name, period_label, currency, scaling, pack_readiness_status, pack_readiness_score, statements: [...], validations: [...] } }`. Komponent renderuje bez błędów. Nie ma żadnych nowych zapisów w DB (read-only).

**Grafika**
`FinancialStatementPackWorkspace` — layout 2-kolumnowy (tabela główna + panel boczny). Header bar z: ReadinessRing (SVG gauge), nazwa/status pill, metadane meta (okres/waluta/skala/liczba dok.), przyciski „Model" i „Analiza" (gdy `isWorkable`). Tabs P&L/BS/CF z licznikiem mapped/total jako badge. Panel boczny: lista „Pliki źródłowe" z każdym plikiem jako karta (ikona FileText, typ badge, status dot, progress bar mapped/total).

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`loadPack` → `V8FinanceApi.getStatementPack`, `mapPackDetailToRow`, `ReadinessRing`, `statementsByType`, `sourceFiles`), render nagłówka + tabs + side panel.

---

### MC-16S-08 · Dodanie P&L + BS + CF do pakietu — completeness label · [PACK] [DB] [V8]

**Co się dzieje**
Konsultant ma pakiet „VTS Group sp. z o.o. — 2024-FY" z kompletności `—P&L / —BS / —CF` (stworzony w MC-16S-02). Klika w workspace pakietu przycisk „Dodaj plik" (side panel) → otwiera się wizard importu z `onAddFile(packId)`. Importuje kolejno trzy pliki: najpierw P&L (`vts_pl_2024.xlsx`), potem BS (`vts_bs_2024.xlsx`), a na koniec CF (`vts_cf_2024.xlsx`). Po każdym imporcie workspace przeładowuje listę plików źródłowych (side panel) i aktualizuje tabs P&L/BS/CF. Po trzecim imporcie completeness zmienia się na `P&L / BS / CF`. Konsultant weryfikuje, że badge na każdej zakładce pokazuje liczbę zmapowanych linii.

**Efekty pracy**
3 nowe rekordy `financial_statements` powiązane z `statement_pack_id` pakietu. Sprawdź Network → `POST /upload-and-analyze` (lub sekwencja detect/extract/map/confirm) ×3 → po każdym `GET /statement-packs/:id` odświeża pakiet. Na UI: completeness label ewoluuje `P&L / —BS / —CF` → `P&L / BS / —CF` → `P&L / BS / CF`. Badge na zakładce np. P&L: `42/42` (fully mapped). Po hard-refresh strony — wszystkie 3 sekcje przetrwają.

**Grafika**
Tabs `['P&L', 'BS', 'CF']` — nieaktywne tabs bez dokumentu pokazują napis „brak" (szary kursywą). Po dodaniu dokumentu tab staje się klikalny z badge `N/T`. Każdy plik w side panelu: `{ typ, status dot (kolor readiness), progress bar (mapped/total) }`. Completeness label w tabeli głównej.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`onAddFile`, `loadPack` po każdym imporcie, `statementsByType`, zakładki P&L/BS/CF z `hasDocument` guard), `FinancialStatementImportWizard.tsx` z `onComplete` callback.

---

### MC-16S-09 · Walidacje pakietu — zakładka pack validations, fail/warning badges · [PACK] [V8]

**Co się dzieje**
Konsultant otwiera workspace pakietu „VTS Group sp. z o.o. — 2024-FY" z kompletnym zestawem P&L+BS+CF. W header barze widzi liczniki błędów i ostrzeżeń obok chevron-togglera (np. „2" w czerwonym badge, „3" w żółtym). Klika toggle → rozwija się panel walidacji (`showValidations: true`). Widzi listę `StatementValidationBadges` z walidacjami: `BS_BALANCE_MISMATCH` (fail — „Bilans nie bilansuje się: aktywa 1 250 000 PLN ≠ pasywa 1 234 500 PLN"), `CF_SIGN_MISMATCH` (warning — „Przepływ z działalności inwestycyjnej — nieoczekiwany znak"), `PL_REVENUE_SANITY` (pass). Weryfikuje, że `failCount` i `warnCount` w nagłówku odpowiadają liczbie elementów w panelu.

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statement-packs/:id` → response `{ pack: { validations: [{ check_code, check_name, severity, status, expected_value, actual_value, difference, message }] } }`. `mapValidation` konwertuje `check_code`/`check_name` (snake_case → camelCase). `failCount` = liczba walidacji ze `status: 'fail'`. Żadne nowe zapisy w DB (read-only). Toggle chowa/pokazuje panel (state `showValidations`).

**Grafika**
Header bar: ikony failure badge (czerwony `bg-danger-100`) i warning badge (żółty `bg-amber-100`) z liczbą. Panel walidacji: `StatementValidationBadges` — lista elementów z kodem walidacji, statusem (fail/warning/pass), expected vs actual, różnica, wiadomość. Chevron wskazuje stan toggle. `StatementValidationBadges.tsx` (56 lin.) — prosty rendering listy.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`packValidations`, `failCount`, `warnCount`, `showValidations` toggle, `StatementValidationBadges`), `mapValidation(validation, 'pack')`, `FinancialStatementPackWorkspace.tsx:686-761`.

---

### MC-16S-10 · Readiness Ring i score pakietu — wskaźnik kołowy 0-100 · [PACK] [V8]

**Co się dzieje**
Konsultant porównuje dwa pakiety: „Apator S.A. — 2023" (kompletny, P&L+BS+CF, wszystkie linie zmapowane, walidacje pass) ze score `0.87` (87%) i „VTS Group — 2024-Q1" (niekompletny, tylko P&L, 60% linii zmapowanych, walidacje fail) ze score `0.34` (34%). Otwiera każdy workspace i obserwuje `ReadinessRing` — mały okrąg SVG w nagłówku z liczbą w środku. Apator: zielona linia (emerald) + liczba 87. VTS: czerwona linia (danger) + liczba 34. Sprawdza progr na pasku CSS w okręgu (strokeDashoffset zmienia się proporcjonalnie). Klika przycisk „Przelicz" (RotateCcw) w side panelu → `loadPack` + `loadStatement` + `loadAnalytics`.

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statement-packs/:id` → `{ pack: { pack_readiness_score: 0.87, pack_readiness_status: 'ready', pack_quality_summary: '...' } }`. `ReadinessRing` renderuje `pct = Math.round(score * 100)`. Kolor: `pct >= 80` → emerald; `pct >= 50` → amber; `< 50` → danger. Przycisk Przelicz → ponowne `loadPack` + `loadStatement(selectedStatement.id)` + `loadAnalytics(selectedStatement.id, aggregationLevel)`.

**Grafika**
`ReadinessRing` (SVG 32×32): zewnętrzny szary okrąg + kolorowa wypełniona łuk (SVG strokeDashoffset). Liczba wycentrowana (`text-[8px] font-bold`). Wskaźnik zmienia kolor przy różnych progach. Header pakietu: Ring + entity name + status pill + metadane.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`ReadinessRing` komponent, `packRow.readinessScore`, funkcja odświeżenia z przyciskiem Przelicz: `loadPack` + `loadStatement` + `loadAnalytics`), `mapPackDetailToRow` (mapuje `pack_readiness_score`).

---

### MC-16S-11 · Edycja nazwy podmiotu (entity name) pakietu — PATCH metadanych · [PACK] [DB] [V8]

**Co się dzieje**
Konsultant zauważa, że pakiet „VTS Group" powinien mieć pełną nazwę „VTS Group S.A." Klika kebab-menu (⋮) przy wierszu w tabeli lub przycisk edycji w workspace pakietu. Otwiera formularz edycji metadanych pakietu: zmienia pole `entity_name` z „VTS Group" na „VTS Group S.A." i pole `period_label` z „2024-Q1" na „2024-01". Klika „Zapisz". Backend: `PATCH /api/v8/finance/statement-packs/:id` z body `{ entity_name: 'VTS Group S.A.', period_label: '2024-01' }`. Lista sprawozdań odświeża się — nowa nazwa widoczna w wierszu.

**Efekty pracy**
Zaktualizowany rekord `financial_statement_packs` w DB (`entity_name`, `period_label`). Sprawdź Network → `PATCH /api/v8/finance/statement-packs/:id` → response 200 z zaktualizowanymi polami. Lista sprawozdań po `loadStatements()` pokazuje nową nazwę. Po hard-refresh strony — zmiana przetrwa.

**Grafika**
Modal edycji metadanych: pola `entity_name`, `period_start`, `period_end`, `period_label`, `currency`, `scaling`. Przycisk „Zapisz". Toast sukcesu po zapisaniu. Wiersz w tabeli: kolumna Nazwa aktualizuje się na „VTS Group S.A.".

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` lub `useFinanceRowActions.tsx` (akcja edycji metadanych), `V8FinanceApi.updateStatementPack` → `PATCH /api/v8/finance/statement-packs/:id`, `loadStatements()` po zakończeniu.

---

### MC-16S-12 · Usunięcie sprawozdania z pakietu — DELETE + odświeżenie listy · [DB] [V8]

**Co się dzieje**
Konsultant chce usunąć błędnie zaimportowane sprawozdanie „Elkomtech — 2022-test" (stworzony przez przypadek). W tabeli sprawozdań klika kebab-menu przy tym pakiecie → akcja „Usuń". Pojawia się dialog potwierdzenia „Czy na pewno chcesz usunąć ten pakiet sprawozdań? Ta operacja jest nieodwracalna." Konsultant potwierdza → `DELETE /api/finance-statements/packs/:id` (przez `Api.delete` — path wskazuje na legacy API według `useFinanceRowActions.ts:132`). Lista sprawozdań odświeża się — pakiet zniknął. Konsultant sprawdza, że po reloadzie pakiet nie powraca.

**Efekty pracy**
Wiersz `financial_statement_packs` (i kaskadowo `financial_statements` + `financial_statement_values`) usunięty z DB. Sprawdź Network → `DELETE /api/finance-statements/packs/:id` → response 200 z `{ success: true }` (lub 204). Lista: wiersz „Elkomtech — 2022-test" zniknął. Toast „Pakiet usunięty". Po hard-refresh strony — pakiet nie powraca.

**Grafika**
Kebab menu (⋮) przy wierszu z opcją „Usuń" (czerwony label z ikoną Trash). Dialog potwierdzenia z tekstem ostrzeżenia. Toast sukcesu. Lista pusta lub pomniejszona o jeden wiersz.

**Funkcjonalność**
`useFinanceRowActions.ts` (row action `'delete'`, `Api.delete('/api/finance-statements/packs/:id')` — linia ~132), `loadStatements()` po zakończeniu, dialog potwierdzenia.

---

# C. Praca z danymi

---

### MC-16S-13 · Widok P&L — hierarchia pozycji, wcięcia poziomów, wiersze total/subtotal · [PACK] [V8]

**Co się dzieje**
Konsultant Apator S.A. otwiera pakiet „Apator — 2023" i klika zakładkę P&L. Komponent ładuje `V8FinanceApi.getStatement(statementId)` → `GET /api/v8/finance/statements/:id`, a następnie `getStatementAnalyticsWithFallback(statementId, 2)` → `GET /api/v8/finance/statements/:id/analytics?level=2`. Tabela `CanonicalStatementTable` renderuje hierarchię: poziom 1 (bez wcięcia) — kategorie główne jak „Przychody netto ze sprzedaży" i „Zysk (strata) na działalności operacyjnej"; poziom 2 (wcięcie `pl-5`) — podkategorie; poziom 3 (wcięcie `pl-10`) — szczegółowe linie. Wiersze `isTotal: true` mają pogrubioną czcionkę i ciemniejsze tło `bg-slate-100/80`. Wiersze `isSubtotal: true` mają `font-semibold`. Konsultant klika jeden wiersz (np. „Przychody netto ze sprzedaży produktów" wartość 450 234 000 PLN) → side panel pokazuje szczegóły pozycji (`StatementExplainPanel`).

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statements/:id` → response z `{ statement: { values: [...], validationLedger: [...] } }` → `GET /api/v8/finance/statements/:id/analytics?level=2` → response `{ periods: [{label, index}], rows: [{id, lineName, lineNamePl, value, aggregationLevel, isTotal, isSubtotal, ...}] }`. Kliknięcie wiersza → `setSelectedValueId(row.id)` + `setSelectedExplain(row.explain)` → side panel otwiera `StatementExplainPanel`. Żadnych zapisów do DB.

**Grafika**
`CanonicalStatementTable` — 2-kolumnowa (jedna kolumna wartości, jeśli jeden okres), nagłówek sticky z etykietą okresu. Wcięcia: poziom 1 = `pl-0`, poziom 2 = `pl-5` z pionową kreską `h-3.5 w-px`, poziom 3 = `pl-10`. Wiersz total: `border-t-2 border-b-2` + `bg-slate-100/80`. Zaznaczony wiersz: `bg-blue-50/90`. Side panel: `StatementExplainPanel` z detalami pozycji.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`loadStatement`, `loadAnalytics`, `CanonicalStatementTable`, `StatementExplainPanel`, `mapStatementDetail`, `aggregationLevel: 2`), `CanonicalStatementTable.tsx` (hierarchia poziomów, `aggregationLevel`, `isTotal`, `isSubtotal`, wcięcia CSS).

---

### MC-16S-14 · Widok BS — struktura aktywów/pasywów, aggregation level 1/2/3 · [PACK] [V8]

**Co się dzieje**
Konsultant otwiera zakładkę BS (Bilans) pakietu „Apator — 2023". Widzi pełną strukturę bilansu: Aktywa → Aktywa trwałe (poziom 1) → Rzeczowe aktywa trwałe (poziom 2) → maszyny/urządzenia/środki transportu (poziom 3). Pasywa → Kapitał własny (poziom 1) → etc. Domyślnie `aggregationLevel = 2` — widoczne poziomy 1 i 2. Konsultant zmienia poziom agregacji przełącznikiem `[1] [2] [3]` w header barze: klika „1" → tabela ogranicza się do pozycji `aggregationLevel <= 1` (tylko sumy główne — 12 wierszy zamiast 38). Klika „3" → widoczne wszystkie pozycje łącznie z detalem (38 wierszy). Klika „2" → powrót do widoku domyślnego. Weryfikuje, że po każdej zmianie poziomu leci nowe żądanie `GET /analytics?level=N`.

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statements/:id/analytics?level=1` → response z `rows` (12 wierszy), potem `?level=3` → `rows` (38 wierszy), potem `?level=2` → `rows` (domyślne 25 wierszy). Każda zmiana `aggregationLevel` → `loadAnalytics(selectedStatement.id, level)` → `setAnalyticsRows` + `setAnalyticsPeriods`. Żadnych zapisów do DB.

**Grafika**
Tabela BS z hierarchią: Aktwa Trwałe (bold, total), Środki Trwałe (indented), budynki/maszyny (deep indent). Przełącznik aggregation: trzy przyciski `[1] [2] [3]` — aktywny niebieski, pozostałe szare. Skeleton loading podczas ładowania nowego poziomu.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`aggregationLevel` state, `useEffect` na `aggregationLevel` → `loadAnalytics(selectedStatement.id, aggregationLevel)`, `getStatementAnalyticsWithFallback` → `V8FinanceApi.getStatementAnalytics(statementId, { level })`).

---

### MC-16S-15 · Widok CF — przepływy operacyjne/inwestycyjne/finansowe · [PACK] [V8]

**Co się dzieje**
Konsultant klika zakładkę CF (Cash Flow) w pakiecie „VTS Group — 2024-FY". Tabela ładuje analitykę dla sprawozdania CF. Widoczna struktura: Przepływy z działalności operacyjnej (suma: 87 450 tys. PLN), Przepływy z działalności inwestycyjnej (suma: -23 100 tys. PLN — wartość ujemna), Przepływy z działalności finansowej (suma: -45 200 tys. PLN), Zmiana netto środków pieniężnych (+19 150 tys. PLN). Konsultant klika wiersz „Amortyzacja" (poziom 2 pod Operacyjnymi) → side panel pokazuje `StatementExplainPanel` z: wartość, mapowanie canonical (CF_DEPRECIATION), origen (auto), confidence %, source page/row z oryginalnego pliku, evidence JSON. Klika przycisk „Szczegóły" w panelu bocznym aby przełączyć z trybu lista-pliki na tryb explain.

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statements/:id/analytics?level=2` → response z wierszami CF, w tym wartości ujemne (sign convention per CF). Kliknięcie wiersza → `onSelectRow` → `setSelectedExplain(row.explain)` → side panel przechodzi z listy plików do `StatementExplainPanel`. Brak zapisów do DB.

**Grafika**
Tabela CF: wartości ujemne w tej samej czcionce (tabular-nums), brak automatycznego formatowania koloru dla ujemnych. `StatementExplainPanel.tsx` (486 lin.) — sekcje: mapowanie (canonical line code + label), origin (source/computed), confidence badge, source page/row, evidence JSON. Panel boczny toggle: `showSidePanel` true/false.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (zakładka CF: `statementsByType.get('CF')`, `loadStatement` + `loadAnalytics`, `onSelectRow` → `setSelectedExplain`), `StatementExplainPanel.tsx` (render detalów pozycji), `CanonicalStatementTable.tsx` (render wartości).

---

### MC-16S-16 · Przełączanie między P&L / BS / CF w pakiecie · [PACK] [V8]

**Co się dzieje**
Konsultant ma otwarty pakiet „Apator — 2023" z aktywną zakładką P&L. Klika BS → `setActiveTab('BS')` → `useEffect` na `selectedStatement?.id` → `loadStatement(bsStatementId)` + `loadAnalytics(bsStatementId, 2)`. Tabela ładuje bilans. Konsultant klika CF → analogicznie. Wraca do P&L. Sprawdza, że przy każdym przełączeniu: (a) skeleton loading widoczny podczas żądania, (b) zaznaczony wiersz i explain panel czyszczą się (`setSelectedValueId(null)`, `setSelectedExplain(null)`), (c) aggregation level resetuje się do 2 (`setAggregationLevel(2)`), (d) leci nowe żądanie do backendu. Testuje próbę kliknięcia zakładki bez dokumentu (np. BS gdy pakiet ma tylko P&L) → zakładka disabled, klik ignorowany.

**Efekty pracy**
Sprawdź Network → przy każdym przełączeniu: `GET /statements/:newId` + `GET /statements/:newId/analytics?level=2`. Żaden stan z poprzedniej zakładki nie przecieka (selected row = null, explain panel = null). Zakładka bez dokumentu: atrybut `aria-disabled: true`, `disabled`, kursor domyślny.

**Grafika**
Tabs w header barze: aktywna zakładka `bg-blue-600 text-white shadow-sm`, nieaktywna `hover:bg-slate-100`. Zakładka bez dokumentu: szary kolor, napis „brak" kursywą. Skeleton rows 8× widoczny podczas ładowania nowej zakładki.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`activeTab` state, `setActiveTab`, `useEffect` na `selectedStatement?.id` → `setAggregationLevel(2)` + `setSelectedValueId(null)` + `loadStatement` + `loadAnalytics`), tabs z `disabled={!hasDocument}`.

---

### MC-16S-17 · Porównanie okresów (YoY) — dwie kolumny + delta % · [PACK] [V8]

**Co się dzieje**
Konsultant ma pakiet „Apator — 2023" i importuje do niego drugi plik P&L dla porównania „Apator — P&L 2022 (porównanie)". Analytics endpoint zwraca `periods: [{ label: '2023', index: 0 }, { label: '2022', index: 1 }]` (dwa okresy). `CanonicalStatementTable` wykrywa `hasTwoPeriods = true` (gdy `periods.length >= 2`) i renderuje 4-kolumnową siatkę: Pozycja | 2022 (starszy) | 2023 (nowszy) | Δ%. Konsultant przegląda wiersz „Przychody netto ze sprzedaży": 2022 = 380 120 tys. PLN | 2023 = 450 234 tys. PLN | Δ% = +18.4% (zielona strzałka ArrowUpRight). Wiersz „Koszty sprzedaży": 2022 = 45 000 | 2023 = 52 300 | Δ% = +16.2% (strzałka w górę). Wiersz „Zysk (strata) netto": sprawdza, czy delta ujemna renderuje czerwony ArrowDownRight.

**Efekty pracy**
Sprawdź Network → `GET /analytics?level=2` → response `{ periods: [{label:'2023',index:0},{label:'2022',index:1}], rows: [{..., periodValues: [{value:450234}, {value:380120}]}] }`. `computeDelta(newerValue, olderValue)` → oblicza `pct = (450234-380120)/|380120| * 100 = +18.44%`. Wynik roundowany do 1 miejsce po przecinku: „+18.4%". Brak zapisów do DB.

**Grafika**
`CanonicalStatementTable` w trybie 4-kolumnowym: `grid-cols-[minmax(200px,3fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(60px,0.5fr)]`. Nagłówki: „Pozycja | 2022 | 2023 | %". Wartości: `font-mono tabular-nums`. Delta: `ArrowUpRight` (zielony) lub `ArrowDownRight` (czerwony) + tekst „+18.4%". Currency bar: „Waluta: PLN". Starszy okres (2022) w szarszym kolorze `text-slate-500`, nowszy (2023) w `text-slate-900`.

**Funkcjonalność**
`CanonicalStatementTable.tsx` (`hasTwoPeriods = periods.length >= 2`, `olderPeriod = visiblePeriods[1]`, `newerPeriod = visiblePeriods[0]`, `computeDelta`, `periodValues[0].value` vs `periodValues[1].value`, ArrowUpRight/ArrowDownRight z `lucide-react`).

---

### MC-16S-18 · Eksport danych finansowych (ExportToOutputDialog) · [EXPORT] [CROSS-MODULE]

**Co się dzieje**
Konsultant VTS Group chce wyeksportować wyniki analizy finansowej do raportu dla zarządu. W preview (lub workspace) analizy finansowej powiązanej z pakietem sprawozdań klika „Eksportuj" → otwiera się `ExportToOutputDialog`. Konsultant wybiera typ wyjścia: „Raport" (Report). Przełącza opcję „Użyj szablonu" → dropdown wyboru szablonu ładuje `GET /report-builder/templates?sourceType=FINANCIAL_ANALYSIS`. Wypełnia: Cel raportu „Wyniki finansowe VTS Group 2024 dla Rady Nadzorczej", Odbiorca „Rada Nadzorcza", Język PL. Klika „Eksportuj". Backend: `exportFinancialAnalysis(analysisId, { outputType, templateId, briefGoal, briefAudience, briefLanguage })`. Po zakończeniu toast sukcesu z linkiem do wygenerowanego raportu.

**Efekty pracy**
Sprawdź Network → `GET /report-builder/templates?sourceType=FINANCIAL_ANALYSIS` → lista szablonów. `POST` do endpointu eksportu → response z `ExportResult`. `trackFunnelEvent` dla eksportu. Dialog zamyka się po `onExportComplete(result)`. Wygenerowany raport dostępny w Outputs (M17).

**Grafika**
`ExportToOutputDialog` (571 lin.) — modal z AnimatePresence/motion. Trzy opcje output type jako karty z `hover:ring-2`: „Raport" (FileText), „Prezentacja" (Presentation), „Inicjatywy" (GitBranch). Dropdown szablonów (gdy `useTemplate: true`). Pola brief: Cel, Odbiorca, Język (PL/EN), Format, Zakres. Przycisk „Eksportuj" z Loader2 podczas generowania.

**Funkcjonalność**
`ExportToOutputDialog.tsx` (`fetchTemplates`, `fetchInitiativeProposals`, `exportFinancialAnalysis` z `@/services/financeExportService`), `V8FinanceApi.getInitiativeProposals` (z fallback), `trackFunnelEvent`.

---

# D. Statusy i workflow

---

### MC-16S-19 · Cykl statusów sprawozdania DRAFT → REVIEW → APPROVED · [DB] [V8]

**Co się dzieje**
Konsultant ma pakiet „Elkomtech — 2023-FY" w statusie DRAFT. W tabeli sprawozdań klika kebab-menu (⋮) przy wierszu → akcja „Prześlij do przeglądu" → status zmienia się na REVIEW (żółty pill). Następnie (po weryfikacji przez menedżera) klika „Zatwierdź" → status zmienia się na APPROVED (zielony pill). Sprawdza, że po zatwierdzeniu pakiet pojawia się w filtrze „Ready Statements" (`focusStatementQueue('APPROVED')`). Klika status-counter w header barze „Ready" → filtr aktywowany → tabela pokazuje tylko APPROVED pakiety. Sprawdza też edge: próba akcji „Zatwierdź" na pakiecie już APPROVED → przycisk disabled lub akcja zablokowana (`row.status !== 'APPROVED'` guard w `useFinanceRowActions`).

**Efekty pracy**
Sprawdź Network → zmiana DRAFT → REVIEW: `POST /api/finance-statements/:id/confirm` lub `PATCH /api/v8/finance/statement-packs/:id` z `{ status: 'review' }` → response 200. Zmiana REVIEW → APPROVED: analogiczne żądanie. Status pill zmienia kolor: DRAFT szary → REVIEW żółty → APPROVED zielony. `loadStatements()` po każdej zmianie. Po hard-refresh strony — nowy status przetrwa.

**Grafika**
Status pill w tabeli: DRAFT = `bg-slate-100 text-slate-600`, REVIEW = `bg-amber-50 text-amber-700`, APPROVED = `bg-emerald-50 text-emerald-700`. Header komendy: status-count pills `{ ready: N, recovery: N, rejected: N }`. Przycisk „Zatwierdź" disabled dla już zatwierdzonego pakietu.

**Funkcjonalność**
`useFinanceRowActions.ts` (akcje workflow, guard `row.status !== 'APPROVED'`), `FinanceHub.tsx` (`focusStatementQueue` → `setActiveFilters` z `column: 'status'`), statusy: `APPROVED`/`REVIEW`/`DRAFT` maphowane z `pack_readiness_status: 'ready'/'recoverable'/'pending'`.

---

### MC-16S-20 · Archiwizacja sprawozdania · [DB] [V8]

**Co się dzieje**
Konsultant chce usunąć stare sprawozdanie „Apator — 2021-FY" z widoku roboczego bez trwałego usuwania. W kebab-menu klika „Archiwizuj". Backend (lub FE) zmienia status pakietu na `archived`. Pakiet znika z domyślnego widoku listy (filtrowanej na aktywne). Konsultant sprawdza, że po aktywacji filtra „Zarchiwizowane" pakiet jest widoczny. Sprawdza też, że zarchiwizowanego pakietu nie można wybrać jako źródła dla nowych analiz (`readyStatementRows` filtruje przez `isWorkable` = `readinessStatus === 'ready'`).

**Efekty pracy**
Sprawdź Network → `PATCH /api/v8/finance/statement-packs/:id` z `{ status: 'archived' }` lub dedykowany endpoint archiwizacji → response 200. Lista sprawozdań po odświeżeniu nie zawiera zarchiwizowanego pakietu w domyślnym widoku. `readyStatementRows` (`useMemo` filtrujący `isWorkable`) nie zawiera zarchiwizowanego pakietu.

**Grafika**
Kebab menu: akcja „Archiwizuj" (id: `'archive'`, label: `t('common.archive', 'Archiwizuj')`) — `useFinanceRowActions.ts:317`. Toast „Sprawozdanie zarchiwizowane". Filtr statusów: ewentualny chip „Zarchiwizowane" do widoku archiwalnych.

**Funkcjonalność**
`useFinanceRowActions.ts` (akcja archiwizacji: linia ~317), `PATCH` endpoint, `loadStatements()` po zakończeniu, `readyStatementRows = statementRows.filter(s => s.isWorkable)` — wyklucza zarchiwizowane.

---

### MC-16S-21 · Filtrowanie listy po statusie (Ready / Recovery Queue / Rejected) · [V8]

**Co się dzieje**
Konsultant ma listę 12 pakietów sprawozdań w różnych statusach: 5 APPROVED, 4 REVIEW, 3 DRAFT. W header barze widzi status-counters: „5 Ready | 4 Recovery | 3 Rejected". Klika chip „Ready" → `focusStatementQueue('APPROVED')` → `setActiveFilters([{ id: 'status-APPROVED', column: 'status', value: 'APPROVED' }])`. Tabela pokazuje 5 wierszy. Klika chip „Recovery" → filtr zmienia się na REVIEW → 4 wiersze. Klika „Rejected" → 3 wiersze, i widzi puste-state message „Rejected Imports is empty..." jeśli 3 wynosi 0. Konsultant klika „Wszystkie" (czyści filtr) → powrót do 12 wierszy. Sprawdza chip w Command Row: aktywny chip ma inny styl (`MENU_3_CHIP_ACTIVE`).

**Efekty pracy**
Żadnych żądań do backendu — filtrowanie jest klienckie (`filteredRows` z `useFinanceData` stosuje `activeFilters`). Sprawdź Network → brak nowych żądań przy klikaniu chipów. `activeFilters` w state zmienia się → `filteredRows` ulega przeliczeniu → tabela re-renderuje. Po wyczyszczeniu filtra → powrót do pełnej listy.

**Grafika**
Command Row w FinanceHub: chips statusów z kolorowymi dot-wskaźnikami (`MENU_3_CHIP_ACTIVE` / `MENU_3_CHIP_INACTIVE`). Aktywny chip: `bg-blue-600 text-white` lub wyróżniony styl. Liczba przy chipie odpowiada statusCount. Empty state: `EmptyStateInline` z konkretną wiadomością dla każdego filtra statusu.

**Funkcjonalność**
`FinanceHub.tsx` (`focusStatementQueue`, `activeFilters` state, `statusCounts` z `useFinanceData`, `emptyMessage` per status filtr), `useFinanceData.ts` (filtrowanie `filteredRows` po `activeFilters`), `MENU_3_CHIP_ACTIVE/INACTIVE` constants.

---

### MC-16S-22 · Wyszukiwanie sprawozdania po nazwie podmiotu · [V8]

**Co się dzieje**
Konsultant ma 20 pakietów sprawozdań z różnych firm. Wpisuje „Apator" w pole wyszukiwania w topbarze. `searchQuery` state aktualizuje się → `useFinanceData(activeTab, searchQuery, activeFilters)` przelicza `filteredRows` — pozostają tylko pakiety, których `title` lub `entityName` zawiera „Apator" (3 wyniki: Apator 2021, 2022, 2023). Konsultant wpisuje „VTS" → 2 wyniki. Wpisuje „xyz123" → 0 wyników → empty state „Brak sprawozdań spełniających kryteria". Czyści pole → powrót do 20 wyników. Sprawdza też wyszukiwanie z URL params: `initiativeName` z search params automatycznie ustawia `searchQuery` (`useEffect` z `searchParams.get('initiativeName')`).

**Efekty pracy**
Filtrowanie klienckie — żadnych nowych żądań HTTP przy wpisywaniu. `filteredRows` = `rowsForActiveTab.filter(row => matches(row, searchQuery))`. Empty state z wiadomością dla braku wyników. URL params cross-module: `/finance?tab=statements&initiativeName=Apator` → automatyczne wyszukiwanie.

**Grafika**
Topbar wyszukiwarki (Input z ikoną Search). Tabela filtruje się na żywo. Zero-wyniki: `EmptyStateInline` lub wiadomość z `emptyMessage`. Pole wyszukiwarki z X do czyszczenia.

**Funkcjonalność**
`FinanceHub.tsx` (`searchQuery` state, `useFinanceData(activeTab, searchQuery, activeFilters)`), `useEffect` URL params (`initiativeName` → `setSearchQuery`), `useFinanceData.ts` (filtrowanie `filteredRows`).

---

### MC-16S-23 · Sortowanie listy po dacie aktualizacji · [V8]

**Co się dzieje**
Konsultant chce zobaczyć najnowsze sprawozdania na górze. Klika nagłówek kolumny „Data aktualizacji" (`updatedAt`, `sortable: true`) → `FilterableTable` sortuje malejąco (najnowsze pierwsze). Klika ponownie → rosnąco (najstarsze pierwsze). Sprawdza, że kolejność wierszy odpowiada wartościom `updatedAt` w tabeli. Testuje też, że sort działa poprawnie z aktywnym filtrem statusu (np. sort + filtr APPROVED — tylko APPROVED pakiety, posortowane po dacie). Konsultant weryfikuje, że sort jest czysto klientowy (brak nowych żądań HTTP).

**Efekty pracy**
Sortowanie klienckie (`FilterableTable` z `sortable: true`). Sprawdź Network → brak żądań przy sortowaniu. Wiersze przetasowane wg `updatedAt` (string ISO → sort chronologiczny). Kombinacja sort + filtr działa poprawnie.

**Grafika**
Nagłówek kolumny „Data aktualizacji" z ikonką sort (strzałka w górę/dół, zmiana kierunku po kliknięciu). Wiersze tabeli przesortowane. Ostatnio zaimportowany pakiet pojawia się na górze przy sortowaniu malejącym.

**Funkcjonalność**
`FinanceHub.tsx` (kolumna `baseUpdatedCol` z `sortable: true`), `FilterableTable` (logika sortowania klientowego), kolumna `updatedAt` w `FinanceStatementRow` (mapowana z `statement.updated_at || statement.created_at`).

---

### MC-16S-24 · Masowa zmiana statusu (bulk status update) · [DB] [V8]

**Co się dzieje**
Konsultant ma 6 pakietów sprawozdań w statusie DRAFT po imporcie testowym i chce je masowo zatwierdzić. Zaznacza checkboxy przy wszystkich 6 wierszach (multi-select w `FilterableTable`). Pojawia się bulk action toolbar z opcją „Zatwierdź zaznaczone" i „Archiwizuj zaznaczone". Klika „Zatwierdź zaznaczone" → pojawia się dialog potwierdzenia (6 pakietów). Potwierdza → iteracja przez zaznaczone IDs → dla każdego `PATCH` lub `POST /confirm`. Po zakończeniu: 6 pakietów zmienia status na APPROVED, lista odświeżona. Sprawdza, że przy błędzie jednego z 6 pakietów (np. pakiet niepełny) Toast pokazuje „5 zatwierdzonych, 1 błąd" zamiast cicho pomijać.

**Efekty pracy**
6 żądań HTTP (lub jedno batch endpoint jeśli istnieje) → 6 pakietów APPROVED w DB. Sprawdź Network → seria żądań statusów lub batch endpoint. `loadStatements()` po zakończeniu. Toast zbiorczy z wynikiem. Po hard-refresh strony — wszystkie 6 pakietów APPROVED.

**Grafika**
Multi-select checkboxy w `FilterableTable`. Bulk action toolbar (pojawia się po zaznaczeniu ≥1 wiersza): liczba zaznaczonych, przycisk „Zatwierdź" i „Archiwizuj". Dialog potwierdzenia. Toast z wynikiem (sukces/częściowy błąd).

**Funkcjonalność**
`FilterableTable` (multi-select), `useFinanceRowActions.ts` (bulk action handler), serial/parallel `PATCH` lub `POST /confirm` dla każdego ID, `loadStatements()` refresh.

---

# E. Integracja cross-module

---

### MC-16S-25 · Tworzenie Modelu z pakietu sprawozdań (→ zakładka Models) · [CROSS-MODULE] [DB] [V8]

**Co się dzieje**
Konsultant ma pakiet „Apator S.A. — 2023" ze statusem APPROVED i `isWorkable: true`. W workspace pakietu (`FinancialStatementPackWorkspace`) widzi przycisk „Model" (ikona Calculator) w nagłówku. Klika go → `onCreateModelFromPack(packRow)` → `handleCreateModelFromStatement(row)` → ustawia `createModelSourceStatementPackId = row.id` i `showCreateModelModal = true`. Przełącza się na zakładkę Models i otwiera `CreateModelModal` z prefill źródłem (statementPackId). Konsultant wpisuje nazwę modelu „Apator 2023 — Model bazowy" i zatwierdza. Backend: `POST /api/v8/finance/models` z `{ statement_pack_id: packId, name: 'Apator 2023 — Model bazowy' }`. Konsultant przechodzi do zakładki Models i widzi nowy model powiązany z pakietem.

**Efekty pracy**
Nowy rekord `financial_models` w DB z `statement_pack_id` wskazującym na pakiet. Sprawdź Network → `POST /api/v8/finance/models` → response 201 z `{ model: { id, name, statement_pack_id, ... } }`. Zakładka Models: nowy wiersz „Apator 2023 — Model bazowy". Przycisk „Model" w workspace widoczny tylko gdy `isWorkable: true` (`packRow.status === 'APPROVED'` lub `readinessStatus === 'ready'`).

**Grafika**
Przycisk „Model" (Calculator icon) w header barze workspace — `inline-flex items-center gap-1 rounded-lg border`. Widoczny tylko gdy `onCreateModelFromPack && packRow.isWorkable`. `CreateModelModal` — modal z polem Nazwa, źródłem (statementPackId prefill). Po zapisaniu: przejście do zakładki Models.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`onCreateModelFromPack` prop), `FinanceHub.tsx` (`handleCreateModelFromStatement` → `setCreateModelSourceStatementPackId` + `setShowCreateModelModal`), `CreateModelModal` → `POST /api/v8/finance/models`, `loadModels()`.

---

### MC-16S-26 · Tworzenie Analizy z pakietu sprawozdań (→ zakładka Analysis) · [CROSS-MODULE] [DB] [V8]

**Co się dzieje**
Konsultant w workspace pakietu „VTS Group — 2024-FY" klika „Analiza" (BarChart3 icon). `onCreateAnalysisFromPack(packRow)` → `handleCreateAnalysisFromStatements(row)` → ustawia `analysisSourceStatementPackId = row.id` i `analysisInitialTitle = buildAnalyzeTitle(row.entityName, 'analiza')` → „VTS Group sp. z o.o. analiza". Otwiera `CreateAnalysisModal` na zakładce Analysis z prefill tytułem i `sourceStatementPackId`. Konsultant wybiera typ analizy „Kompleksowa" i zatwierdza. Backend: `POST /api/v8/finance/analyses` z body zawierającym `statement_pack_id`. Analiza tworzona i powiązana z pakietem. Konsultant przechodzi do zakładki Analysis i widzi nową analizę.

**Efekty pracy**
Nowy rekord `financial_analyses` w DB powiązany z `statement_pack_id`. Sprawdź Network → `POST /api/v8/finance/analyses` → response 201. Zakładka Analysis: nowy wiersz. Przycisk „Analiza" widoczny tylko gdy `packRow.isWorkable`. `buildAnalyzeTitle` buduje tytuł: `entityName + suffix` (jeśli entity nie jest pustą).

**Grafika**
Przycisk „Analiza" (BarChart3 icon) w header barze workspace. `CreateAnalysisModal` z prefill: tytuł „VTS Group sp. z o.o. analiza", source pack. Typ analizy dropdown (comprehensive/investment_case). Po zapisaniu: przejście do zakładki Analysis.

**Funkcjonalność**
`FinancialStatementPackWorkspace.tsx` (`onCreateAnalysisFromPack` prop), `FinanceHub.tsx` (`handleCreateAnalysisFromStatements`, `buildAnalyzeTitle`, `analysisInitialTitle`, `analysisSourceStatementPackId`), `CreateAnalysisModal` → `V8FinanceApi.createAnalysis` → `POST /api/v8/finance/analyses`.

---

### MC-16S-27 · Widok powiązanych modeli w panelu preview sprawozdania · [CROSS-MODULE] [V8]

**Co się dzieje**
Konsultant klika na pakiet „Apator — 2023" w tabeli sprawozdań (single-click → select, nie open). Otwiera się panel preview po prawej stronie (layout `TableWithPreviewLayout`). W preview widzi: nagłówek pakietu (nazwa, status, completeness), sekcję wskaźników (ratios z `statementPreviewRatios` — np. ROE, ROA, Marża brutto), sekcję powiązanych modeli (lista modeli stworzonych z tego pakietu z linkami). Klika „Otwórz pełny widok" → `handleOpenFull(row)` → otwiera `FinancialStatementPackWorkspace` jako dokument w `openDocuments`. Sprawdza breadcrumb dokumentów i możliwość zamknięcia.

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statements/:statementId/ratios` → response z wskaźnikami (`statementPreviewRatios`). Preview body renderuje ratios + powiązane modele. Kliknięcie „Otwórz pełny widok" → `setOpenDocuments(prev => [...prev, doc])` + `setActiveDocumentId(row.id)`. Zakładka dokumentu z nazwą pakietu pojawia się w `openDocuments` strip.

**Grafika**
`TableWithPreviewLayout` — split view: tabela (lewo) + preview panel (prawo). Preview: karty wskaźników finansowych (ROE %, ROA %, Marża operacyjna %), sekcja powiązanych modeli z listą, przyciski footer „Model" + „Analiza" + „Otwórz". `OpenDocument` strip (tabs otwartych dokumentów) w górze.

**Funkcjonalność**
`FinanceHub.tsx` (`useFinancePreview` → `renderPreviewBody` + `renderPreviewFooter`, `statementPreviewRatios` z `useFinanceSelection`), `useFinanceSelection.tsx` (`loadStatementRatios` → `V8FinanceApi.getStatementRatios`), `TableWithPreviewLayout`, `useModuleOpenDocuments`.

---

### MC-16S-28 · Izolacja cross-org — sprawozdanie org A niewidoczne z org B · [DB] [V8]

**Co się dzieje**
Administrator konsultant zalogowany jako user org „VTS Group" przełącza organizację na „Apator S.A." (lub loguje się jako inny user). Wywołuje `GET /api/v8/finance/statements` → backend zwraca wyłącznie pakiety powiązane z `organization_id = Apator`. Sprawozdania VTS Group nie pojawiają się na liście. Konsultant próbuje bezpośrednio otworzyć URL pakietu VTS: `/finance/statements/{vtsPakietId}` → backend zwraca 403 lub 404 (brak dostępu). Weryfikuje w Network: żadna odpowiedź nie zawiera danych finansowych obcej organizacji. Sprawdza też, że po powrocie do VTS Group własne pakiety są widoczne.

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statements` dla Apator → brak wierszy VTS Group w odpowiedzi. Bezpośredni URL VTS pakietu → 403 lub 404 z backendu. Brak wycieku danych między organizacjami. Po powrocie do VTS Group: własne pakiety widoczne. Izolacja realizowana na poziomie middleware `organization_id` w bazie danych.

**Grafika**
Lista sprawozdań po zmianie orga: puste lub inne pakiety (Apator). Error state w `FinancialStatementPackWorkspace`: karta błędu „Pakiet sprawozdań nie znaleziony" z przyciskiem „Ponów". Toast ewentualny 403.

**Funkcjonalność**
Backend middleware (`organization_id` guard), `V8FinanceApi.getStatements()` + `getStatementPack()` — filtrowanie po org z JWT/session, `FinancialStatementPackWorkspace.tsx` (error state: `<div className="flex flex-col items-center...">`), `useAppStore` (`currentOrganization`).

---

# F. Błędy i edge cases

---

### MC-16S-29 · Scenariusz fallback V8 → legacy (symulacja 404 z V8) · [V8] [LEGACY]

**Co się dzieje**
Konsultant pracuje na środowisku, gdzie endpoint V8 `/api/v8/finance/statements` zwraca 404 (np. organizacja nie jest v8-enabled lub v8 router nie jest zamontowany). System automatycznie wykrywa to przez `shouldFallbackToLegacyFinance(error)` — sprawdza: `error.response?.status` ∈ `[400, 404, 405, 501]`. Ustawia `useLegacyFinanceMode: true`. Wszystkie kolejne wywołania używają legacy endpointów: `GET /api/finance/statements` zamiast V8. Konsultant importuje sprawozdanie — fallback w `uploadAndAnalyzeWithFallback`: jeśli V8 rzuci 404, wywołuje `Api.postMultipart('/api/finance-statements/upload-and-analyze', formData)`. Konsultant weryfikuje, że UX jest identyczny (brak widocznego degradacji poza ewentualnym bannerem `FinanceDegradedBanner`).

**Efekty pracy**
Sprawdź Network → przy 404 z V8: żądanie do `/api/v8/finance/statements` → 404, następnie żądanie do `/api/finance/statements` → 200. `useLegacyFinanceMode = true` w stanie FinanceHub (zmieniony przez `setUseLegacyFinanceMode(true)` w `loadV8Dashboard`). `FinanceDegradedBanner` może pojawić się w UI. Wszystkie dane wczytane z legacy API działają normalnie.

**Grafika**
Ewentualny `FinanceDegradedBanner` — baner informacyjny (amber) o trybie legacy. Poza tym UX identyczny. Network: widoczna para żądań — V8 (404) + legacy (200).

**Funkcjonalność**
`shouldFallbackToLegacyFinance` (plik `src/services/api/v8/finance.ts`), wszystkie `*WithFallback` funkcje w `FinancialStatementImportWizard.tsx` i `FinancialStatementPackWorkspace.tsx`, `useLegacyFinanceMode` state w `FinanceHub.tsx`, `FinanceDegradedBanner.tsx`.

---

### MC-16S-30 · Pusta organizacja — brak sprawozdań, empty state · [V8]

**Co się dzieje**
Konsultant loguje się jako nowy user świeżo zarejestrowanej organizacji „DBR77 Test Sp. z o.o." (zero danych finansowych). Wchodzi na `/finance?tab=statements`. `loadStatements()` → `GET /api/v8/finance/statements` → response 200 z `{ statements: [], count: 0 }`. Lista sprawozdań pusta. Konsultant widzi `EmptyStateInline` z wiadomością „No statements in the current view. Ready items go to the working set...". Klika chip „Ready" → empty state zmienia wiadomość na „No ready statements in the working set. Imports that are not ready stay in Recovery Queue or Rejected Imports." Klika chip „Recovery" → wiadomość zmienia się na „Recovery Queue is empty. Imports that still need remap, re-validation, or scale fixes will appear here." Sprawdza każdy z 3 filtrów statusu pod kątem dedykowanych wiadomości. Sprawdza też V8 Dashboard: `v8Dashboard = null` lub pusty (organizacja bez danych).

**Efekty pracy**
Sprawdź Network → `GET /api/v8/finance/statements` → response `{ statements: [], count: 0 }`. `statementRows = []`. `filteredRows = []`. `emptyMessage` zmienia się dynamicznie z `activeFilters`. `statements.length = 0` → count w tab header = 0. V8 Dashboard: `GET /api/v8/finance/dashboard` → pusty lub 204.

**Grafika**
`EmptyStateInline` komponent: ikona FileText (lub dedykowana), tekst opisowy z instrukcją (co zrobić dalej: zaimportuj pierwsze sprawozdanie). Przycisk CTA „Import" aktywny. Tabs: licznik `statements.length = 0`. Status chips w Command Row: `{ 0 Ready | 0 Recovery | 0 Rejected }`. Filtrowanie statusem zmienia empty message.

**Funkcjonalność**
`FinanceHub.tsx` (`emptyMessage` useMemo z 4 wariantami dla `statements`, `useFinanceData` → `statements: []`, `filteredRows: []`), `EmptyStateInline` z `src/components/shared/NModeBlocks/EmptyStateInline.tsx`, `loadStatements` → `GET /api/v8/finance/statements` (lub legacy fallback → `GET /api/finance/statements`).

---

## Macierz pokrycia funkcji → case'y

| Obszar funkcji | Case'y |
|---|---|
| Import Excel smart AI (mode: 'smart') | MC-16S-01 |
| Ręczne tworzenie pakietu (formularz metadanych) | MC-16S-02 |
| Import PDF 4-krokowy wizard (detect/extract/map/confirm) | MC-16S-03 |
| Import CSV + manualna korekcja mapowania | MC-16S-04 |
| Walidacja formatu pliku + graceful error | MC-16S-05 |
| Import z ostrzeżeniami, readiness 'recoverable' → naprawa | MC-16S-06 |
| FinancialStatementPackWorkspace — widok pakietu | MC-16S-07 |
| Dodawanie P&L/BS/CF do pakietu, completeness label | MC-16S-08 |
| Walidacje pakietu (StatementValidationBadges, fail/warn counts) | MC-16S-09 |
| ReadinessRing, pack_readiness_score, przycisk Przelicz | MC-16S-10 |
| Edycja metadanych pakietu (entity_name, period_label) | MC-16S-11 |
| Usunięcie pakietu (DELETE) | MC-16S-12 |
| Widok P&L — hierarchia, wcięcia, isTotal/isSubtotal | MC-16S-13 |
| Widok BS — aggregation level 1/2/3 | MC-16S-14 |
| Widok CF — przepływy + StatementExplainPanel | MC-16S-15 |
| Przełączanie zakładek P&L/BS/CF | MC-16S-16 |
| Porównanie okresów YoY (hasTwoPeriods, computeDelta) | MC-16S-17 |
| Eksport do Output (ExportToOutputDialog) | MC-16S-18 |
| Cykl statusów DRAFT → REVIEW → APPROVED | MC-16S-19 |
| Archiwizacja sprawozdania | MC-16S-20 |
| Filtrowanie po statusie (focusStatementQueue) | MC-16S-21 |
| Wyszukiwanie po nazwie podmiotu | MC-16S-22 |
| Sortowanie po dacie aktualizacji | MC-16S-23 |
| Masowa zmiana statusu (bulk actions) | MC-16S-24 |
| Tworzenie Modelu z pakietu (cross-module → Models) | MC-16S-25 |
| Tworzenie Analizy z pakietu (cross-module → Analysis) | MC-16S-26 |
| Preview panel ze wskaźnikami + powiązane modele | MC-16S-27 |
| Izolacja cross-org (brak wycieku danych) | MC-16S-28 |
| Fallback V8 → legacy (shouldFallbackToLegacyFinance) | MC-16S-29 |
| Pusta organizacja — empty state, dedykowane wiadomości | MC-16S-30 |

---

## Uwagi metodyczne

- **E2E jako wymóg:** każdy case z persystencją musi pokazać żądanie HTTP w Network + przeżyć hard-refresh. UI-zmiana bez żądania = FAIL.
- **V8 vs Legacy:** wizard (`FinancialStatementImportWizard.tsx`) i workspace (`FinancialStatementPackWorkspace.tsx`) mają pełne `*WithFallback` wrappery — testuj oba ścieżki (MC-16S-29).
- **Tryb smart vs. fallback importu:** jeśli backend zwraca `mode: 'smart'`, wizard ma 3 kroki (MC-16S-01); jeśli `mode: 'fallback'`, ma 4 kroki (MC-16S-03/04). Weryfikuj który tryb aktywny na środowisku testowym.
- **isWorkable guard:** przyciski „Model" i „Analiza" w workspace pojawiają się wyłącznie gdy `packRow.isWorkable = readinessStatus === 'ready'` (MC-16S-25/26). Testuj scenariusz gdy pakiet nie jest gotowy.
- **aggregationLevel:** każda zmiana poziomu agregacji (1/2/3) strzela nowe żądanie do backendu — weryfikuj w Network (MC-16S-14).
- **hasTwoPeriods:** `CanonicalStatementTable` przełącza się na 4-kolumnowy layout YoY automatycznie gdy analytics zwraca ≥2 periods — nie ma ręcznego przełącznika (MC-16S-17).
- **Cross-org izolacja:** MC-16S-28 jest kluczowym testem bezpieczeństwa — 403/404 z backendu dla obcej org, zero wycieku danych.
- **Firmy i dane realistyczne:** PLN, VTS Group, Apator S.A., Elkomtech S.A. (prod) — sprawozdania w tysiącach PLN, okresy 2023-FY / 2024-Q1.
