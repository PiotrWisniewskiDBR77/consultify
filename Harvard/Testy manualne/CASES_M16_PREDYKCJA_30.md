# CASES — M16 Finanse · Zakładka Predykcja (Budget vs Actual) · 30 bogatych case'ów testowych

> **Moduł:** M16 Finanse — zakładka Predykcja (`/finance?tab=prediction`)
> **Główne pliki:** `src/components/Economics/FinanceHub.tsx` (~2437 lin.) + `src/components/Benefits/BudgetWorkspace.tsx` (1112 lin.)
> **Panele:** `CreateBudgetModal.tsx`, `VarianceBridgePanel.tsx`
> **Inwentarz funkcji (SSOT):** `Harvard/AUDYT_M16-AUDYT-2026-06-24.md`
> **Cel paczki:** 30 realistycznych scenariuszy pracy konsultanta (VTS Group Q1 2024, Apator ICT capex) eksplorujących PEŁNE możliwości zakładki Predykcja — tworzenie budżetów, aktuale, scenariusze, Variance Bridge Panel, AI Teresa, eksport i cross-linki.
> **Data:** 2026-06-25
> **Autor:** sesja projektowa (czytanie kodu, bez uruchamiania serwerów/testów)

---

## Legenda znaczników

- **[DB]** — utrwalenie w tabeli (`budgets`, `budget_lines`, `budget_scenarios`, `budget_initiative_links`). Weryfikuj GET po POST.
- **[FLAG]** — wymaga flagi feature (`ff_varianceBridge=1` jako URL param lub `localStorage['ff.fin_variance_bridge']='1'`). Bez flagi komponent niewidoczny.
- **[V8]** — endpoint `/api/v8/finance/value/variance-bridge`; wymaga bramki v8 org.
- **[REAL-AI]** — wymaga żywego LLM (Teresa). Weryfikuj żądanie w Network + realność odpowiedzi.
- **[EXPORT]** — produkuje plik lub przejście do Outputs (ExportToOutputDialog); sprawdź artefakt / stan docelowy.

**Zasada E2E (każdy case z modyfikacją danych):** każda zmiana → żądanie HTTP widoczne w Network → 200/201 → reload strony = stan identyczny. UI-zmiana bez żądania = FAIL.

---

## Spis 30 case'ów

### A. Tworzenie budżetów / prognoz (MC-16P-01 … MC-16P-06)
- **MC-16P-01** · Tworzenie budżetu ręcznego „VTS Group Budżet 2024"
- **MC-16P-02** · Tworzenie budżetu z modelu finansowego (source_model_id)
- **MC-16P-03** · Edycja nazwy i okresu istniejącego budżetu
- **MC-16P-04** · Usuwanie budżetu (DELETE) i weryfikacja zniknięcia z listy
- **MC-16P-05** · Tworzenie budżetu kwartalnego Q1 2024 (granularity: quarterly)
- **MC-16P-06** · Tworzenie budżetu rocznego PLN na cały rok 2024

### B. Aktuale vs Budżet (MC-16P-07 … MC-16P-12)
- **MC-16P-07** · Edycja linii budżetowej — wpisanie wartości aktualnych Q1
- **MC-16P-08** · Widok tabeli porównawczej budżet vs wykonanie
- **MC-16P-09** · Wyliczenie wariancji procentowej — przychód korzystny vs niekorzystny
- **MC-16P-10** · Wielookresowe wprowadzanie aktualnych (Q1 + Q2)
- **MC-16P-11** · Zatwierdzenie budżetu (Approve) i zmiana statusu
- **MC-16P-12** · Pusty stan — brak linii budżetowych

### C. Scenariusze (MC-16P-13 … MC-16P-17)
- **MC-16P-13** · Widok scenariusza bazowego (base)
- **MC-16P-14** · Generowanie prognoz scenariusza optymistycznego (+20%)
- **MC-16P-15** · Generowanie prognoz scenariusza konserwatywnego (−15%)
- **MC-16P-16** · Przełączanie aktywnego scenariusza w podglądzie
- **MC-16P-17** · Porównanie scenariuszy side-by-side w zakładce Scenario Comparison

### D. Variance Bridge Panel (MC-16P-18 … MC-16P-25)
- **MC-16P-18** · Aktywacja flagi `ff_varianceBridge=1` — panel pojawia się pod tabelą
- **MC-16P-19** · Pusty stan panelu — `data-testid="variance-empty"` bez linii
- **MC-16P-20** · Dodanie 2 linii przychodowych + 1 linii kosztowej (plan/wykonanie)
- **MC-16P-21** · Wywołanie POST /variance-bridge i render waterfall
- **MC-16P-22** · Słupki zielone (F korzystne) i czerwone (U niekorzystne) w waterfall
- **MC-16P-23** · KPI-strip: `data-testid="variance-total"` z wariancją netto
- **MC-16P-24** · Liczniki F: n / U: n — favorable count i unfavorable count
- **MC-16P-25** · Fail-soft przy błędzie API — panel degraduje, widok nie crashuje

### E. Predykcja AI (MC-16P-26 … MC-16P-28)
- **MC-16P-26** · Kontekst Teresy AI dla predykcji — „Jak poprawić marżę operacyjną?"
- **MC-16P-27** · Potwierdzenie linii budżetowych przez AI (Confirm with AI)
- **MC-16P-28** · Teresa identyfikuje przychód odstający — outlier wariancji

### F. Eksport i integracja (MC-16P-29 … MC-16P-30)
- **MC-16P-29** · Eksport budżetu przez ExportToOutputDialog
- **MC-16P-30** · Cross-link: nawigacja do zakładki Wycena z budżetem jako źródłem

---

# A. Tworzenie budżetów / prognoz

---

### MC-16P-01 · Tworzenie budżetu ręcznego „VTS Group Budżet 2024" · [Tworzenie / formularz] [DB]

**Co się dzieje**
Konsultant otwiera `/finance?tab=prediction` w kontekście VTS Group. Zakładka Predykcja wyświetla pustą listę budżetów lub istniejące wpisy. Klika przycisk `+ New scenario` (CTA topbara, `finance.cta.newScenario`) → otwiera się `CreateBudgetModal`. Wypełnia formularz: nazwa „VTS Group Budżet 2024", okres od `2024-01`, okres do `2024-12`, granulacja „Miesięczna" (`monthly`), waluta PLN. Klika „Utwórz" i czeka na toast sukcesu (`finance.toast.budgetCreated`). Następnie reloaduje stronę i sprawdza, czy budżet widoczny jest na liście z poprawnymi metadanymi: nazwa, okres, granulacja.

**Efekty pracy**
`POST /api/economics/budgets` z body `{ title: "VTS Group Budżet 2024", periodStart: "2024-01", periodEnd: "2024-12", granularity: "monthly", currency: "PLN" }` → 201 `{ success: true, budget: { id, ... } }`. Nowy rekord w tabeli `budgets` (org-scoped). Wiersz pojawia się w `GET /api/economics/budgets` (response pole `budgets[]`). Reload → budżet na liście, tytuł + okres poprawne.

**Grafika**
`CreateBudgetModal` — modal z polami: Nazwa (input text), Okres od/do (input month), Granulacja (select: Miesięczna/Kwartalna/Roczna), Waluta. Przycisk „Utwórz" (disabled podczas loadu). Toast sukcesu zielony z tekstem „Budżet utworzony". Lista predykcji w tabeli głównej FinanceHub — nowy wiersz z ikoną budżetu (`TrendingUp`) i podtypem `budget`.

**Funkcjonalność**
`CreateBudgetModal.tsx` (`POST /api/economics/budgets`, `createBudgetSchema`), `FinanceHub.tsx` (`setShowPredictionCreateModal`, `refreshFinanceTruth(['prediction'])`), `budgetingSvc.createBudget`. Walidacja: brak nazwy → disable przycisku, za długa nazwa (>300 znaków) → błąd. Network: zakładka Network → `POST /economics/budgets` 201.

---

### MC-16P-02 · Tworzenie budżetu z modelu finansowego (source_model_id) · [Tworzenie / seed z modelu] [DB]

**Co się dzieje**
Konsultant ma istniejący model finansowy Apator z zakładki Modele. Przechodzi do zakładki Predykcja i tworzy nowy budżet, tym razem wybierając z pola „Model źródłowy" jeden z dostępnych modeli finansowych (np. „Apator ICT Model 2024"). W `CreateBudgetModal` wpisuje tytuł „Apator ICT Budżet Q1-Q4 2024", wypełnia okres od `2024-01` do `2024-12`, granulacja kwartalna, waluta PLN. Jeśli dostępny jest selektor modelu (`source_model_id`), wybiera go. Klika „Utwórz". Otwiera nowo utworzony budżet i weryfikuje, czy linie budżetowe zostały pre-wypełnione danymi z modelu — liczba linii > 0.

**Efekty pracy**
`POST /api/economics/budgets` z opcjonalnym polem `projectId` lub `source_model_id` (zależnie od implementacji) → 201. Rekord w `budgets`. Budżet posiadający linie (`budget_lines`) pre-seedowane z modelu źródłowego → `GET /api/economics/budgets/:id` zwraca `lines[]` niepuste. Reload → linie zachowane.

**Grafika**
Modal `CreateBudgetModal` z dodatkowym polem selectora modelu (jeśli obecny) lub pola opisu linkującego. Po utworzeniu — `BudgetWorkspace` pokazuje zakładkę Inputs z tabelą linii P&L i CF zamiast pustej listy. Liczba linii widoczna w nagłówku sekcji.

**Funkcjonalność**
`CreateBudgetModal.tsx` + `budgetingSvc.createBudget` (serwer: `economics.routes.ts:2519`), `BudgetWorkspace.tsx` (`fetchBudgets` → `selectBudget` → ładuje `lines`). Weryfikacja: Network `POST /economics/budgets` 201, następnie `GET /economics/budgets/:id` → `lines` niepuste.

---

### MC-16P-03 · Edycja nazwy i okresu istniejącego budżetu · [Tworzenie / edycja] [DB]

**Co się dzieje**
Konsultant otwiera istniejący budżet „VTS Group Budżet 2024" z listy predykcji. W `BudgetWorkspace` klika kebab-menu (⋮) w nagłówku lub w wierszu tabeli → wybiera „Edytuj". Zmienia tytuł na „VTS Group Budżet 2024 — rewizja Q2", sprawdza, czy pole okresu też jest edytowalne. Zapisuje zmiany. Weryfikuje w Network `PATCH /api/economics/budgets/:id` (lub odpowiednik). Reloaduje stronę i potwierdza, że zmieniony tytuł jest widoczny na liście predykcji i w nagłówku BudgetWorkspace.

**Efekty pracy**
`PATCH /api/economics/budgets/:id` z body `{ title: "VTS Group Budżet 2024 — rewizja Q2" }` → 200 `{ success: true }`. Rekord w `budgets` zaktualizowany. `GET /api/economics/budgets` po reloadzie → zmieniony tytuł. Weryfikacja: brak duplikatu wiersza na liście (optymistyczny UI nie może tworzyć dubbla).

**Grafika**
Kebab-menu kontekstowe (⋮) w wierszu tabeli FinanceHub z opcją „Edytuj" / inline-edit pola tytułu. Modal lub inline-field tytułu z przyciskiem Zapisz. Toast sukcesu. Zaktualizowany tytuł w wierszu listy predykcji.

**Funkcjonalność**
`FinanceHub.tsx` (kebab row actions dla `kind === 'prediction'`), `PATCH /api/economics/budgets/:id` lub inline update. `economics.routes.ts` (analogicznie do wzorca PATCH dla modeli). Network: `PATCH /economics/budgets/:id` 200.

---

### MC-16P-04 · Usuwanie budżetu (DELETE) i weryfikacja zniknięcia z listy · [Tworzenie / usunięcie] [DB]

**Co się dzieje**
Konsultant tworzy testowy budżet „Budżet do usunięcia 2024" (jak w MC-16P-01), zapamiętuje jego ID w Network. Następnie w wierszu listy predykcji klika kebab-menu (⋮) → „Usuń" → pojawia się dialog potwierdzenia (aby uniknąć przypadkowego usunięcia). Potwierdza usunięcie. Weryfikuje w Network `DELETE /api/economics/budgets/:id` → 200. Sprawdza, że wiersz znikł z listy natychmiast (optimistic) i po reloadzie. Weryfikuje, że powiązane `budget_lines` i `budget_scenarios` również zostały usunięte (nie ma osieroconych rekordów — serwer kasuje kaskadowo).

**Efekty pracy**
`DELETE /api/economics/budgets/:id` → 200 (serwer wykonuje `DELETE FROM budget_lines WHERE budget_id = ?`, `DELETE FROM budget_scenarios WHERE budget_id = ?`, `DELETE FROM budgets WHERE id = ?`, `economics.routes.ts:2614–2629`). Lista predykcji po reloadzie — budżetu brak. Kaskadowe usunięcie linii i scenariuszy potwierdzone przez brak danych przy próbie `GET /economics/budgets/:id` (404).

**Grafika**
Kebab-menu z opcją „Usuń" (ikona kosza). Dialog potwierdzenia z ostrzeżeniem „Tej akcji nie można cofnąć". Wiersz znika z listy po potwierdzeniu. Toast sukcesu „Budżet usunięty".

**Funkcjonalność**
`FinanceHub.tsx` (kebab delete action dla `kind === 'prediction'`), `DELETE /api/economics/budgets/:id` (`economics.routes.ts:2614`), kaskadowe usunięcie w serwisie. Network: `DELETE /economics/budgets/:id` 200, następnie `GET /economics/budgets` → bez usuniętego ID.

---

### MC-16P-05 · Tworzenie budżetu kwartalnego Q1 2024 (granularity: quarterly) · [Tworzenie / kwartały] [DB]

**Co się dzieje**
Konsultant tworzy budżet dedykowany jednemu kwartałowi: „VTS Group Q1 2024 — Analiza niedoboru przychodu". Ustawia okres od `2024-01` do `2024-03`, granulację „Kwartalna" (`quarterly`), walutę PLN. Po utworzeniu otwiera budżet i sprawdza, czy kolumny projekcji w tabeli Projections odzwierciedlają granulację kwartalną (jedna kolumna „Q1 2024" zamiast 12 miesięcy). Weryfikuje, że linie P&L i CF można edytować dla jednego okresu kwartalnego. Sprawdza edge case: błędny zakres dat (od > do) → oczekiwany błąd walidacji bez crashu.

**Efekty pracy**
`POST /api/economics/budgets` z `{ granularity: "quarterly", periodStart: "2024-01", periodEnd: "2024-03" }` → 201. Budżet w `budgets` z granulacją kwartalną. `GET /economics/budgets/:id` → `lines[]` z jednym periods entry. Reload → poprawna granulacja zachowana. Błędny zakres → 400 lub walidacja FE.

**Grafika**
Formularz `CreateBudgetModal` z selectem Granulacja = „Kwartalna". Po otwarciu budżetu — tabela Projections z kolumną „2024-Q1". Jeden okres w projekcjach zamiast dwunastu. Select granulacji wyraźnie pokazuje aktywną opcję.

**Funkcjonalność**
`CreateBudgetModal.tsx` (granularity select), `budgetingSvc.createBudget`, `BudgetWorkspace.tsx` (tabela projections renderuje `selected?.projections?.periods`). `economics.routes.ts:2519`. Walidacja: `periodStart ≤ periodEnd`.

---

### MC-16P-06 · Tworzenie budżetu rocznego PLN na cały rok 2024 · [Tworzenie / roczny] [DB]

**Co się dzieje**
Konsultant tworzy budżet roczny dla Apator: „Apator ICT Capex Budżet 2024". Ustawia okres od `2024-01` do `2024-12`, granulację „Roczna" (`annual`), walutę PLN. Po utworzeniu otwiera budżet, przechodzi do zakładki Inputs i dodaje ręcznie linie budżetowe: przychód planowany 8 500 000 PLN, koszty ICT capex planowane 3 200 000 PLN. Każdą linię edytuje przez tabelę linii (`PUT /api/economics/budgets/:id/lines/:lineId`). Sprawdza, że wartości są poprawnie zapisywane i widoczne po reloadzie. Testuje edge: wpisanie wartości ujemnej (−100 000) w przychód → weryfikuje, czy system przyjmuje lub odrzuca.

**Efekty pracy**
`POST /api/economics/budgets` z `{ granularity: "annual", periodStart: "2024-01", periodEnd: "2024-12", currency: "PLN" }` → 201. Edycja linii: `PUT /api/economics/budgets/:budgetId/lines/:lineId` z `{ plannedValue: 8500000 }` → 200. Reload → wartości 8 500 000 i 3 200 000 widoczne w tabeli Inputs.

**Grafika**
Tabela Inputs (`BudgetWorkspace`, zakładka `inputs`) z wierszami linii P&L i CF. Każda komórka edytowalna inline (kliknięcie → input numeryczny). Kolumna „Plan" z wartościami PLN. Kolumna „Wykonanie" pusta (do wypełnienia w MC-16P-07).

**Funkcjonalność**
`BudgetWorkspace.tsx` (`renderLineTable`, inline update linii, `PUT /api/economics/budgets/:budgetId/lines/:lineId`), `updateBudgetLineSchema` (`economics.routes.ts:2554`). Network: `PUT /economics/budgets/:id/lines/:lineId` 200.

---

# B. Aktuale vs Budżet

---

### MC-16P-07 · Edycja linii budżetowej — wpisanie wartości aktualnych Q1 · [Aktuale / edycja] [DB]

**Co się dzieje**
Konsultant otwiera budżet „VTS Group Q1 2024" i przechodzi do zakładki Inputs. Widzi tabelę z liniami P&L: wiersz „Przychód ze sprzedaży" (plan 1 200 000 PLN), wiersz „Koszty operacyjne" (plan 800 000 PLN). W kolumnie „Wykonanie" (actual) klika na komórkę wiersza „Przychód ze sprzedaży" i wpisuje 980 000 PLN (niedobór 220 000 PLN vs plan). Dla wiersza „Koszty operacyjne" wpisuje 850 000 PLN (przekroczenie 50 000 PLN vs plan). Naciska Enter lub klika poza komórkę. Weryfikuje w Network `PUT /api/economics/budgets/:id/lines/:lineId` dla każdej zmiany → 200.

**Efekty pracy**
Dwie linie zaktualizowane: `{ actualValue: 980000 }` i `{ actualValue: 850000 }` przez `PUT /api/economics/budgets/:budgetId/lines/:lineId` (`economics.routes.ts:2554`). Rekord w `budget_lines` zaktualizowany. Reload → wartości aktualnych widoczne w tabeli. Wariancja wyliczalna: przychód Δ = −220 000 (niekorzystna U), koszt Δ = +50 000 (niekorzystna U bo jest kosztem).

**Grafika**
Tabela Inputs z kolumnami: Linia | Plan | Wykonanie | Wariancja. Komórki kolumny „Wykonanie" edytowalne inline — po kliknięciu zamienia się w `<input type="number">`. Wariancja wyliczana i kolorowana: wartość ujemna/przekroczenie → czerwona, korzystna → zielona. Tooltip z opisem linii (driver hint lub KPI hint wg BudgetWorkspace.tsx).

**Funkcjonalność**
`BudgetWorkspace.tsx` (`saveLine`, `PUT /economics/budgets/:budgetId/lines/:lineId`, `updateBudgetLine`), `updateBudgetLineSchema`. Wariancja: `actual - plan` wyliczana kliencko lub serwerowo. Network: `PUT` 200 dla każdej linii.

---

### MC-16P-08 · Widok tabeli porównawczej budżet vs wykonanie · [Aktuale / widok] [DB]

**Co się dzieje**
Po uzupełnieniu aktualnych (MC-16P-07) konsultant przegląda pełne zestawienie w tabeli Inputs. Tabela pokazuje dla każdej linii: plan, wykonanie, wariancję kwotową i wariancję procentową. Konsultant przełącza między zakładką Inputs a Projections, weryfikując spójność danych. Następnie w tabeli głównej FinanceHub (lista predykcji) klika na budżet VTS Group Q1 2024 — w panelu podglądu (preview) powinny być widoczne kluczowe KPI budżetu: łączny plan, łączne wykonanie, łączna wariancja. Sprawdza, czy reload strony przywraca identyczny widok tabelaryczny bez utraty danych.

**Efekty pracy**
`GET /api/economics/budgets/:id` → `{ ...budget, lines: [...], scenarios: [...] }` (economics.routes.ts:2541). Tabela renderuje linie z `lines[]`. Wariancja = actual − plan (klienckо w `BudgetWorkspace`). Panel preview w FinanceHub ładuje dane budżetu przy zaznaczeniu wiersza (`activeDocumentId`, `isBudgetPrediction = true`). Reload → tożsama tabela.

**Grafika**
`BudgetWorkspace.tsx` z zakładkami: Inputs / Projections / Scenario Comparison / Initiatives. Zakładka Inputs: tabela linii P&L (`plLines`) i CF (`cfLines`) z kolumnami Plan / Wykonanie / Δ / Δ%. Panel preview w FinanceHub (prawa kolumna) gdy wiersz budżetu zaznaczony — miniaturka KPI lub opis.

**Funkcjonalność**
`BudgetWorkspace.tsx` (zakładki `inputs`/`projections`/`scenarios`/`initiatives`, `plLines` = `lines.filter(l => l.statementType === 'P&L')`, `cfLines`), `FinanceHub.tsx` (`isBudgetPrediction`, `<BudgetWorkspace initialBudgetId={...}/>`). Network: `GET /economics/budgets/:id` 200.

---

### MC-16P-09 · Wyliczenie wariancji procentowej — przychód korzystny vs niekorzystny · [Aktuale / wariancja]

**Co się dzieje**
Konsultant weryfikuje logikę kwalifikacji wariancji dla dwóch typów linii: przychodowej i kosztowej. Dla linii „Przychód Q1": plan 1 200 000, actual 980 000 → wariancja = −220 000 (−18,3%) → NIEKORZYSTNA (U) bo przychód poniżej planu. Dla linii „Koszty ICT capex Apator": plan 3 200 000, actual 2 900 000 → wariancja = −300 000 (−9,4%) → KORZYSTNA (F) bo koszty poniżej planu (zaoszczędzono). Sprawdza, że UI koloruje poprawnie: wariancja przychodowa ujemna = czerwona, wariancja kosztowa ujemna = zielona. Weryfikuje tooltip lub opis wyjaśniający kierunek wariancji.

**Efekty pracy**
Kolumna wariancji renderuje wartości liczbowe z prawidłowym znakiem i kolorem zależnym od `isCost` flagi linii. Reguła: dla przychodu (isCost=false): actual > plan → F (zielona); actual < plan → U (czerwona). Dla kosztu (isCost=true): actual < plan → F (zielona); actual > plan → U (czerwona). Brak żądania HTTP dla samego widoku wariancji — wyliczana kliencko.

**Grafika**
Tabela Inputs z kolumnami Wariancja kwotowo (np. „−220 000 zł") i Wariancja % (np. „−18,3%"). Komórka F (korzystna) → tekst/tło zielone (emerald). Komórka U (niekorzystna) → tekst/tło czerwone (rose). Ewentualny tooltip „Poniżej planu — niekorzystne" lub „Poniżej planu — oszczędność". Brak crashu przy `plan = 0` (dzielenie przez zero).

**Funkcjonalność**
`BudgetWorkspace.tsx` (kalkulacja wariancji inline, kolory warunkowe), logika `isCost` z modelu linii. Edge: `plan = 0` → Δ% = N/A lub „—" zamiast Infinity.

---

### MC-16P-10 · Wielookresowe wprowadzanie aktualnych (Q1 + Q2) · [Aktuale / multi-okres] [DB]

**Co się dzieje**
Konsultant pracuje z budżetem rocznym „Apator ICT Capex Budżet 2024" (MC-16P-06, granulacja monthly, 12 kolumn). Po zamknięciu Q1 (marzec 2024) uzupełnia aktuale dla miesięcy 2024-01, 2024-02, 2024-03 w kolumnach projekcji. Następnie przechodzi do Q2 i uzupełnia 2024-04, 2024-05, 2024-06. Dla każdego miesiąca wpisuje wartości różniące się od planu o ±5–15%. Po wypełnieniu 6 miesięcy weryfikuje, że tabela Projections pokazuje poprawne wartości per okres, suma YTD aktualizuje się na bieżąco. Reload → wszystkie wartości zachowane.

**Efekty pracy**
Serie `PUT /api/economics/budgets/:budgetId/lines/:lineId` z wartościami per-miesiąc → 200 każde. Rekord `budget_lines` zaktualizowany w bazie. `GET /economics/budgets/:id` → `lines[].projections.lines[lineCode][period]` zawiera faktyczne wartości. Suma YTD: suma wartości za 6 miesięcy poprawna.

**Grafika**
Tabela Projections (`BudgetWorkspace`, zakładka `projections`) z kolumnami: Linia | 2024-01 | 2024-02 | ... | 2024-12. Komórki periodu edytowalne. YTD aggregate row na dole lub w nagłówku. Scrollowanie poziome tabeli dla 12 kolumn.

**Funkcjonalność**
`BudgetWorkspace.tsx` (`activeScenario?.projections?.lines?.[line.lineCode]?.[p]`, zakładka `projections`), `PUT /economics/budgets/:budgetId/lines/:lineId` per linia. Network: 6+ żądań PUT, każde 200.

---

### MC-16P-11 · Zatwierdzenie budżetu (Approve) i zmiana statusu · [Aktuale / zatwierdzenie] [DB]

**Co się dzieje**
Konsultant kończy uzupełnianie danych budżetu Q1 i chce go formalnie zatwierdzić. W `BudgetWorkspace` klika przycisk „Approve" (`finance.budget.approve`). Weryfikuje w Network `POST /api/economics/budgets/:id/approve` → 200 `{ success: true }`. Sprawdza, że status budżetu zmienił się na `approved` — wiersz na liście predykcji ma badge statusu „approved" (kolor niebieski wg `SCENARIO_COLORS: approved = 'bg-blue-500/10 text-blue-600'`). Reload → status zachowany. Próbuje edytować linię po zatwierdzeniu — sprawdza, czy jest blokada (pola readonly lub przycisk disabled).

**Efekty pracy**
`POST /api/economics/budgets/:id/approve` (`economics.routes.ts:2599`) → rekord w `budgets` z `status = 'approved'`. Funnel event `budget_approved` (trackFunnelEvent). Toast `finance.budget.approved`. Lista odświeżona (`fetchBudgets`). Reload → status `approved` widoczny. Ewentualna blokada edycji linii po zatwierdzeniu.

**Grafika**
Przycisk „Approve" w nagłówku `BudgetWorkspace` (niebieski, obok „Generate Projections"). Po zatwierdzeniu — badge `approved` na wierszu listy predykcji (niebieski chip). Toast sukcesu.

**Funkcjonalność**
`BudgetWorkspace.tsx` (`approveBudget`, `POST /economics/budgets/:id/approve`), `SCENARIO_COLORS.approved`, `trackFunnelEvent('budget_approved')`. Network: `POST /economics/budgets/:id/approve` 200.

---

### MC-16P-12 · Pusty stan — brak linii budżetowych · [Aktuale / empty state]

**Co się dzieje**
Konsultant tworzy nowy budżet bez żadnych linii (CreateBudgetModal → Utwórz, bez dodawania linii). Otwiera go w `BudgetWorkspace`. Weryfikuje, że stan pusty jest obsługiwany elegancko: zakładka Inputs pokazuje komunikat zachęcający do dodania pierwszej linii (lub importu z dokumentu), zakładka Projections pokazuje komunikat „Kliknij Generate Projections aby wyliczyć" (`finance.budget.noProjections`). Sprawdza, że kliknięcie „Generate Projections" przy braku scenariuszy nie crashuje, tylko wyświetla odpowiedni komunikat. Weryfikuje brak białego ekranu i konsoli bez błędów JS.

**Efekty pracy**
`GET /api/economics/budgets/:id` → `{ lines: [], scenarios: [] }`. `BudgetWorkspace` renderuje się bez crash — empty state komunikaty widoczne. `generateProjections` z `scenarios.length === 0` → return early bez żądania HTTP (warunek: `if (!selected || scenarios.length === 0) return`). Konsola bez wyjątków.

**Grafika**
`BudgetWorkspace` zakładka Inputs — komunikat „Brak budżetów" (`finance.budget.noBudgets`) lub pusta tabela. Zakładka Projections — tekst `finance.budget.noProjections`. Przycisk Generate Projections: disabled lub aktywny z obsługą error-state. Brak spinnerów wiecznych.

**Funkcjonalność**
`BudgetWorkspace.tsx` (`budgets.length === 0` branch linia 509, `scenarios.length === 0` guard w `generateProjections:195`). Warunek early-return zapobiega crashowi.

---

# C. Scenariusze

---

### MC-16P-13 · Widok scenariusza bazowego (base) · [Scenariusze / base] [DB]

**Co się dzieje**
Konsultant otwiera budżet z co najmniej jednym scenariuszem bazowym (base). Po utworzeniu budżetu serwer powinien automatycznie stworzyć trzy scenariusze: base, optimistic, conservative. Konsultant przechodzi do zakładki Scenario Comparison w `BudgetWorkspace` i weryfikuje istnienie scenariusza „Base" z metrykami. Sprawdza pola: Revenue (Przychód), Net Income (Zysk netto). Klika na scenariusz base → staje się aktywny (`isActive = 1` w `budget_scenarios`). Reload → scenariusz base pozostaje aktywny.

**Efekty pracy**
`GET /api/economics/budgets/:id` → `scenarios[{ scenarioType: 'base', isActive: true, projections: {...} }]`. `baseScenario` = `scenarios.find(s => s.scenarioType === 'base')`. Aktywacja base: `POST /api/economics/budgets/:budgetId/scenarios/:scenarioId/project` lub analogicznie (`economics.routes.ts:2567`). Reload → base aktywny.

**Grafika**
`BudgetWorkspace` zakładka `scenarios`: trzy karty scenariuszy (`scenarios.map(sc => ...)`) z kolorami (`SCENARIO_COLORS`). Base: biała/neutralna karta. Każda karta pokazuje: Revenue (suma P&L), Net Income. Aktywny scenariusz — wyróżnienie ramką / badge „Active".

**Funkcjonalność**
`BudgetWorkspace.tsx` (`activeTab === 'scenarios'`, `scenarios.map(sc)`, `SCENARIO_COLORS`, `baseScenario`, `isBase = sc.scenarioType === 'base'`). `GET /economics/budgets/:id` (economics.routes.ts:2541). Network: `GET /economics/budgets/:id` 200.

---

### MC-16P-14 · Generowanie prognoz scenariusza optymistycznego (+20%) · [Scenariusze / optimistic] [DB]

**Co się dzieje**
Konsultant chce zbadać optymistyczny scenariusz wzrostu dla VTS Group. Po otwarciu budżetu klika „Generate Projections" (`finance.budget.project`). Serwer iteruje przez scenariusze [base, optimistic, conservative] i dla każdego wywołuje projekcję. Scenariusz optymistyczny (optimistic) zakłada wzrost o +20% vs base (logika `applyScenarioAdjustments`). Konsultant weryfikuje w Network `POST /api/economics/budgets/:budgetId/scenarios/:scenarioId/project` dla scenariusza optimistic → 200. W zakładce Scenario Comparison widzi kartę „Optimistic" z Revenue wyższym o ~20% vs base. Sprawdza toast sukcesu `finance.budget.projected`.

**Efekty pracy**
Seria `POST /api/economics/budgets/:budgetId/scenarios/:scenarioId/project` dla każdego scenariusza → 200 (economics.routes.ts:2567). Rekord w `budget_scenarios` z `projections` zawierającymi wyliczone wartości. `GET /economics/budgets/:id` → `scenarios[{ scenarioType: 'optimistic', projections: {...} }]` z wartościami ~+20% vs base. Toast `finance.budget.projected`.

**Grafika**
Karta „Optimistic" w zakładce Scenario Comparison — wyróżniony kolor (np. zielona ramka). Pole Revenue wyższe niż Base. Różnica percentagowa vs base widoczna w tabeli porównawczej (`finance.budget.scenarioDiff`). Loader/spinner podczas generowania projekcji (sekwencyjna iteracja przez scenariusze).

**Funkcjonalność**
`BudgetWorkspace.tsx` (`generateProjections`, iteracja `for (const sc of scenarios)`, `POST .../scenarios/${sc.id}/project`), serwis `budgetingSvc.generateScenarioProjections`. Network: trzy `POST` żądania projekcji (base, optimistic, conservative) → każde 200.

---

### MC-16P-15 · Generowanie prognoz scenariusza konserwatywnego (−15%) · [Scenariusze / conservative] [DB]

**Co się dzieje**
Kontynuacja MC-16P-14. Konsultant analizuje scenariusz konserwatywny — zakładający niższy wzrost lub spadek o −15% vs base (na potrzeby stress-testów VTS Group Q1 2024). Po wygenerowaniu projekcji (MC-16P-14) klika kartę „Conservative" w zakładce Scenario Comparison. Weryfikuje, że Revenue jest niższe o ~15% vs base. Porównuje Net Income dla trzech scenariuszy obok siebie w tabeli porównawczej. Odnotowuje, że scenariusz conservative powinien zawsze dać najniższy wynik — sprawdza poprawność kolejności (Conservative < Base < Optimistic).

**Efekty pracy**
`budget_scenarios` z `scenarioType = 'conservative'` zawiera `projections` z wartościami ~−15% vs base. Tabela porównawcza w UI: Conservative < Base < Optimistic dla Revenue i Net Income. Reload → wszystkie trzy scenariusze zachowane.

**Grafika**
Karta „Conservative" z czerwoną/neutralną ramką (`SCENARIO_COLORS.conservative`). Tabela porównawcza: nagłówki [Metric | Base | Optimistic | Conservative], wiersze Revenue / Net Income z wartościami PLN. Wartości Conservative najniższe — ewentualne czerwone kolorowanie.

**Funkcjonalność**
`BudgetWorkspace.tsx` (`activeTab === 'scenarios'`, tabela porównawcza: `scenarios.map(sc)` w wierszach tabeli `finance.budget.scenarioDiff`). Serwis `applyScenarioAdjustments` (economics.routes.ts:1073-1076). Network: `GET /economics/budgets/:id` po projekcjach.

---

### MC-16P-16 · Przełączanie aktywnego scenariusza w podglądzie · [Scenariusze / aktywacja] [DB]

**Co się dzieje**
Konsultant chce zobaczyć projekcje dla różnych scenariuszy z perspektywy „co-jeśli". W zakładce Scenario Comparison klika kartę „Optimistic" by ją aktywować (jeśli taki przycisk/akcja istnieje). Następnie wraca do zakładki Projections — tabela powinna teraz pokazywać wartości scenariusza optymistycznego, nie bazowego. Przełącza na „Conservative" i obserwuje zmianę wartości w Projections. Weryfikuje, że aktywny scenariusz jest persystowany w `activeScenario` state lub DB. Reload → ostatnio aktywny scenariusz pozostaje widoczny.

**Efekty pracy**
`BudgetWorkspace` `activeScenario = scenarios.find(s => s.isActive) || scenarios[0]` — zmiana aktywnego scenariusza może wymagać żądania lub jest tylko kliencka. Tabela Projections renderuje `activeScenario?.projections?.lines?.[line.lineCode]?.[p]`. Zmiana visible=aktywny scenariusz → tabela pokazuje inne liczby.

**Grafika**
Karta aktywna w Scenario Comparison — wyróżniona (ramka, badge „Active"). Zakładka Projections po przełączeniu — nagłówek tablicy wskazuje aktywny scenariusz. Animacja/flash przy zmianie wartości.

**Funkcjonalność**
`BudgetWorkspace.tsx` (`activeScenario`, `scenarios.find(s => s.isActive)`, `activeScenario?.projections`). Ewentualne `POST /budgets/:budgetId/scenarios/:scenarioId/adjustments` przy zmianie aktywnego. Network: obserwuj czy leci żądanie przy aktywacji.

---

### MC-16P-17 · Porównanie scenariuszy side-by-side w zakładce Scenario Comparison · [Scenariusze / porównanie]

**Co się dzieje**
Konsultant przygotowuje prezentację dla zarządu VTS Group pokazującą trzy warianty wyników finansowych Q1 2024. Otwiera zakładkę Scenario Comparison w `BudgetWorkspace` — widzi tabelę porównawczą `finance.budget.scenarioDiff` z wierszami metryk (Revenue, Net Income) i kolumnami [Base | Optimistic | Conservative]. Analizuje różnice: optymistyczny pokazuje Revenue 1 440 000 PLN (+20% vs base 1 200 000), konserwatywny 1 020 000 (−15%). Sprawdza, że base jest oznaczony jako punkt referencyjny. Weryfikuje, że tabela jest czytelna: różnice procentowe vs base wyliczone. Odnotowuje brak kolumny „Actual" w tym widoku (Actual jest w Inputs, nie Scenarios).

**Efekty pracy**
Tabela porównawcza renderowana kliencko z danych `scenarios` załadowanych przez `GET /economics/budgets/:id`. Metryki: Revenue = suma linii P&L + koszty wyliczone, Net Income = Revenue − koszty. Brak żądań HTTP w tym kroku — pure view. Konsola bez błędów.

**Grafika**
`BudgetWorkspace` zakładka `scenarios` — dolna sekcja `scenarios.length > 0` renderuje tabelę porównawczą: `<table>` z `<th>` per scenariusz. Wiersze: Revenue (`finance.budget.totalRevenue`), Net Income (`finance.budget.netIncome`). Wartości PLN sformatowane. Karty scenariuszy nad tabelą z summary.

**Funkcjonalność**
`BudgetWorkspace.tsx` (`activeTab === 'scenarios'`, tabela `scenarios.length > 0`: linia 733, `scenarios.map(sc)` w `<td>`, `isBase` wyróżnienie). Kalkulacja Net Income jako derived value.

---

# D. Variance Bridge Panel

---

### MC-16P-18 · Aktywacja flagi `ff_varianceBridge=1` — panel pojawia się pod tabelą · [FLAG]

**Co się dzieje**
Domyślnie `VarianceBridgePanel` jest ukryty (flaga OFF). Konsultant aktywuje flagę poprzez URL: nawiguje do `/finance?tab=prediction&ff_varianceBridge=1`. Weryfikuje, że pod główną tabelą predykcji (gdy zakładka `prediction` aktywna) pojawia się ramka panelu „Budżet vs wykonanie (variance bridge)" z `data-testid="variance-bridge-panel"`. Następnie testuje aktywację przez localStorage: DevTools → Application → Local Storage → dodaje klucz `ff.fin_variance_bridge` = `1` → reload → panel widoczny bez parametru URL. Sprawdza, że bez flagi panel NIE jest renderowany (inspect DOM — brak `data-testid="variance-bridge-panel"`).

**Efekty pracy**
`isFinanceFlagEnabled('varianceBridge')` zwraca `true` gdy URL param `ff_varianceBridge=1` lub `localStorage['ff.fin_variance_bridge'] = '1'`. `_showVariance = true && activeTab === 'prediction'` → `<VarianceBridgePanel />` renderuje się. Brak flagi → `_showVariance = false` → panel absent z DOM.

**Grafika**
Panel pod tabelą predykcji: biała karta z nagłówkiem „Budżet vs wykonanie (variance bridge)", zawartość `data-testid="variance-empty"` (pusty stan gdy brak linii). Bez flagi — panel niewidoczny. Inspect Element potwierdza obecność/brak `data-testid="variance-bridge-panel"`.

**Funkcjonalność**
`FinanceHub.tsx` (`_showVariance = isFinanceFlagEnabled('varianceBridge') && activeTab === 'prediction'`, linia 2112), `financeFeatureFlags.ts` (`readQuery('ff_varianceBridge')`, `readLocalStorage('ff.fin_variance_bridge')`, `readEnv('VITE_FIN_VARIANCE_BRIDGE_ENABLED')`). Kolejność: URL param → localStorage → env.

---

### MC-16P-19 · Pusty stan panelu — `data-testid="variance-empty"` bez linii · [FLAG]

**Co się dzieje**
Konsultant aktywuje flagę `ff_varianceBridge=1` (jak w MC-16P-18). `VarianceBridgePanel` renderuje się z `lines = undefined` (domyślnie, bo FinanceHub przekazuje `<VarianceBridgePanel />` bez props, linia 2122). Weryfikuje, że element `data-testid="variance-empty"` istnieje w DOM z tekstem „Brak danych budżetowych — dodaj pozycje plan/wykonanie". Sprawdza `data-testid="variance-bridge-panel"` obecny. Sprawdza, że `loading = false`, `failed = false`, brak requestu HTTP do `/variance-bridge` (brak `lines` → wczesny return w `useEffect`). Konsola bez błędów.

**Efekty pracy**
`VarianceBridgePanel` z `lines = undefined` → `hasLines = false` → `useEffect` wczśnie zwraca (linia 73-79 VarianceBridgePanel.tsx) bez wywołania `fetcher`. Brak żądania `POST /variance-bridge` w Network. DOM: `data-testid="variance-empty"` visible, `data-testid="variance-total"` ABSENT.

**Grafika**
Panel z nagłówkiem „Budżet vs wykonanie (variance bridge)" → wewnątrz szary tekst „Brak danych budżetowych — dodaj pozycje plan/wykonanie". Brak KPI-strip, brak wykresu waterfall. Ramka panelu widoczna.

**Funkcjonalność**
`VarianceBridgePanel.tsx` (`!hasLines` branch, `data-testid="variance-empty"`, linia 121-128). `useEffect` guard: `if (!hasLines) { setData(null); ... return; }`.

---

### MC-16P-20 · Dodanie 2 linii przychodowych + 1 linii kosztowej (plan/wykonanie) · [FLAG] [V8]

**Co się dzieje**
Konsultant (wciąż z aktywną flagą `ff_varianceBridge=1`) chce skonstruować analizę wariancji ręcznie. W środowisku testowym `VarianceBridgePanel` jest wywoływany z prop `lines` (lub konsultant edytuje dane budżetu tak by panel je odebrał). Definiuje trzy linie wariancji dla VTS Group Q1 2024: (1) Przychód ze sprzedaży: plan 1 200 000, actual 980 000, isCost: false; (2) Przychód z usług: plan 400 000, actual 420 000, isCost: false; (3) Koszty operacyjne: plan 800 000, actual 850 000, isCost: true. Weryfikuje, że po przekazaniu `lines` panel nie pokazuje już stanu `variance-empty`, lecz stan ładowania `variance-busy`.

**Efekty pracy**
`hasLines = true` (3 linie nie-puste) → `useEffect` uruchamia `load()` → `setLoading(true)` → `data-testid="variance-busy"` visible podczas fetch. Linie: `[{ label: 'Przychód ze sprzedaży', plan: 1200000, actual: 980000, isCost: false }, { label: 'Przychód z usług', plan: 400000, actual: 420000, isCost: false }, { label: 'Koszty operacyjne', plan: 800000, actual: 850000, isCost: true }]`. `data-testid="variance-empty"` ABSENT.

**Grafika**
Panel przejściowo pokazuje `data-testid="variance-busy"` z tekstem „Ładowanie analizy wariancji…". Po załadowaniu → zastąpione przez KPI-strip + waterfall. Trzy linie przekazane do fetcher.

**Funkcjonalność**
`VarianceBridgePanel.tsx` (`hasLines = Array.isArray(lines) && lines.length > 0`, `useEffect` zależny od `[lines, fetcher, hasLines]`). Fetcher domyślny: `defaultFetcher` → `Api.post('/api/v8/finance/value/variance-bridge', { lines })`.

---

### MC-16P-21 · Wywołanie POST /variance-bridge i render waterfall · [FLAG] [V8] [DB]

**Co się dzieje**
Kontynuacja MC-16P-20. Fetcher wywołuje `POST /api/v8/finance/value/variance-bridge` z body `{ lines: [...3 linie...] }`. Konsultant obserwuje w Network to żądanie i weryfikuje: (a) metodę POST, (b) URL `/api/v8/finance/value/variance-bridge`, (c) body JSON z polem `lines[]`, (d) odpowiedź 200 ze strukturą `{ data: { steps: [...], totalVariance: -230000 } }` (lub `{ steps, totalVariance }` bezpośrednio). Po odpowiedzi `loading = false`, `data = { steps, totalVariance }` → panel renderuje `<FinanceWaterfall steps={data.steps} />` oraz KPI-strip. Sprawdza `data-testid="variance-waterfall"` w DOM.

**Efekty pracy**
Network: `POST /api/v8/finance/value/variance-bridge` 200, body `{ lines: [3] }`, response `{ steps: [...], totalVariance: -230000 }`. totalVariance: suma wariancji = (980000−1200000) + (420000−400000) + (−(850000−800000)) = −220000 + 20000 − 50000 = −250000 (netto niekorzystne). `data-testid="variance-waterfall"` w DOM. `<FinanceWaterfall>` renderuje svg/divy waterfall.

**Grafika**
Panel po załadowaniu: KPI-strip (3 kafelki) + wykres waterfall poniżej. `data-testid="variance-waterfall"` wraps `<FinanceWaterfall>`. Waterfall: słupki kolejno: start (baseline przychód plan), add/subtract per linia, total. Oś Y: wartości PLN.

**Funkcjonalność**
`VarianceBridgePanel.tsx` (`defaultFetcher`, `Api.post('/api/v8/finance/value/variance-bridge', { lines })`), `financeValueRoutes.ts` (linia 138: `POST /variance-bridge`, serwis `varianceBridge(lines)`), `budgetVarianceService.js`. Network: `POST /v8/finance/value/variance-bridge` 200.

---

### MC-16P-22 · Słupki zielone (F korzystne) i czerwone (U niekorzystne) w waterfall · [FLAG] [V8]

**Co się dzieje**
Po renderowaniu wykresu waterfall (MC-16P-21) konsultant analizuje kolorowanie słupków dla 3 linii VTS Group Q1 2024: (1) Przychód ze sprzedaży: actual 980 000 < plan 1 200 000 → wariancja −220 000 → niekorzystna U → słupek CZERWONY (decrease). (2) Przychód z usług: actual 420 000 > plan 400 000 → wariancja +20 000 → korzystna F → słupek ZIELONY (increase). (3) Koszty operacyjne: actual 850 000 > plan 800 000 → koszt przekroczony → niekorzystna U → słupek CZERWONY (decrease). Weryfikuje, że `FinanceWaterfall` koloruje step `kind === 'increase'` na zielono (emerald) i `kind === 'decrease'` na czerwono (rose). Sprawdza ostatni słupek „Total variance" i jego kolor.

**Efekty pracy**
`data.steps` z `/variance-bridge`: step Przychód ze sprzedaży `kind: 'decrease'` (−220 000), step Przychód z usług `kind: 'increase'` (+20 000), step Koszty operacyjne `kind: 'decrease'` (−50 000 netto). `lineSteps.filter(s => s.kind === 'increase')` → 1 (Przychód z usług). `lineSteps.filter(s => s.kind === 'decrease')` → 2 (Przychód ze sprzedaży + Koszty). `totalVariance` = −250 000 → niekorzystna łącznie.

**Grafika**
Wykres `<FinanceWaterfall>`: słupek start (szary/niebieski baseline), 3 słupki per linia (czerwony, zielony, czerwony), słupek total (czerwony bo negative). Legenda: zielony = F korzystne, czerwony = U niekorzystne. Etykiety linii nad słupkami.

**Funkcjonalność**
`FinanceWaterfall.tsx` (renderuje steps z `kind === 'increase'` → emerald, `kind === 'decrease'` → rose). `VarianceBridgePanel.tsx` (`lineSteps = data.steps.filter(s => s.kind === 'increase' || s.kind === 'decrease')`).

---

### MC-16P-23 · KPI-strip: `data-testid="variance-total"` z wariancją netto · [FLAG] [V8]

**Co się dzieje**
Konsultant weryfikuje KPI-strip nad wykresem waterfall w `VarianceBridgePanel`. Widzi trzy kafelki: (1) Wariancja netto z `data-testid="variance-total"`, (2) Korzystne z `data-testid="variance-favorable"`, (3) Niekorzystne z `data-testid="variance-unfavorable"`. Sprawdza wartość `data-testid="variance-total"` — powinna wynosić `−250k` (−250 000 PLN sformatowane przez `fmtSigned`). Weryfikuje kolor kafelka Wariancja netto: `totalVariance < 0` → klasa `text-rose-600` (czerwona). Następnie testuje scenariusz z `totalVariance > 0` (np. zmieniając linie) → kafelek staje się zielony (`text-emerald-600`). Sprawdza `totalVariance = 0` → kolor neutralny (`text-slate-600`).

**Efekty pracy**
`data-testid="variance-total"` z wartością sformatowaną przez `fmtSigned(-250000)` = `"−250.0k"`. Kolor: `totalVariance < 0 → 'text-rose-600'`. `data-testid="variance-favorable"` = 1. `data-testid="variance-unfavorable"` = 2. Reload z tymi samymi `lines` → identyczne wartości.

**Grafika**
KPI-strip: 3 kafelki w row (`grid-cols-3`). Kafelek 1 „Wariancja netto": wartość „−250.0k" czerwona. Kafelek 2 „Korzystne": wartość „1" zielona (emerald). Kafelek 3 „Niekorzystne": wartość „2" czerwona (rose). Każdy kafelek: mała etykieta uppercase + duża liczba font-semibold.

**Funkcjonalność**
`VarianceBridgePanel.tsx` (`fmtSigned(totalVariance)`, `totalColor`, `data-testid="variance-total"`, `data-testid="variance-favorable"`, `data-testid="variance-unfavorable"`). `fmtSigned`: abs ≥ 1 000 000 → `M`, ≥ 1 000 → `k`, else → raw.

---

### MC-16P-24 · Liczniki F: n / U: n — favorable count i unfavorable count · [FLAG] [V8]

**Co się dzieje**
Konsultant rozszerza zestaw linii wariancji do 5 pozycji: 2 korzystne (F) i 3 niekorzystne (U), aby sprawdzić poprawność liczników. Zestaw Apator ICT Q1 2024: (1) Przychód ICT: plan 1 200 000, actual 1 380 000, isCost: false → F (actual > plan, revenue). (2) Licencje oprogramowania: plan 200 000, actual 180 000, isCost: true → F (actual < plan, cost). (3) Capex hardware: plan 3 200 000, actual 3 900 000, isCost: true → U (przekroczenie). (4) Koszty konsultantów: plan 400 000, actual 460 000, isCost: true → U (przekroczenie). (5) Koszty szkoleń: plan 150 000, actual 170 000, isCost: true → U (przekroczenie). Weryfikuje `data-testid="variance-favorable"` = 2 i `data-testid="variance-unfavorable"` = 3.

**Efekty pracy**
`POST /variance-bridge` z 5 liniami → response `steps` z 5 step obiektami (plus start/total). `lineSteps.filter(s => s.kind === 'increase' && s.value > 0).length` = 2 (F). `lineSteps.filter(s => s.kind === 'decrease').length` = 3 (U). `data-testid="variance-favorable"` = 2. `data-testid="variance-unfavorable"` = 3. Waterfall: 2 zielone + 3 czerwone słupki.

**Grafika**
KPI-strip: Korzystne = „2" (emerald), Niekorzystne = „3" (rose). Waterfall: 5 słupków per linia: zielony, zielony, czerwony, czerwony, czerwony. Słupek total czerwony (netto niekorzystne). Etykiety linii czytelne pod słupkami.

**Funkcjonalność**
`VarianceBridgePanel.tsx` (`favorable = lineSteps.filter(s => s.kind === 'increase' && s.value > 0).length`, `unfavorable = lineSteps.filter(s => s.kind === 'decrease').length`). `budgetVarianceService.varianceBridge` po stronie serwera (financeValueRoutes.ts:145).

---

### MC-16P-25 · Fail-soft przy błędzie API — panel degraduje, widok nie crashuje · [FLAG] [V8]

**Co się dzieje**
Konsultant symuluje błąd API `/variance-bridge` by zweryfikować mechanizm fail-soft (wzór M14 ExecutionIntelligencePanel). Metody symulacji: (a) DevTools → Network → Block request URL `/variance-bridge` → odświeżenie z aktywnymi liniami; (b) wyłączenie połączenia sieciowego. Panel powinien: złapać wyjątek w bloku `try/catch` `load()`, ustawić `failed = true`, wyrenderować `data-testid="variance-failed"` z tekstem „Analiza wariancji niedostępna chwilowo — widok działa normalnie". Weryfikuje, że reszta FinanceHub (tabela predykcji, nawigacja zakładek) działa bez przerwy. Konsola: odnotuj ewentualny log błędu, ale brak JS crash.

**Efekty pracy**
`catch` w `load()` (VarianceBridgePanel.tsx) → `setData(null)`, `setFailed(true)`. `data-testid="variance-failed"` renderuje się. `data-testid="variance-waterfall"` ABSENT. `data-testid="variance-total"` ABSENT. FinanceHub: tabela predykcji renderuje się normalnie — `VarianceBridgePanel` jest additive (wrap w `div.flex-col`), nie blokuje głównego widoku.

**Grafika**
Panel z nagłówkiem „Budżet vs wykonanie (variance bridge)" → wewnątrz szary tekst „Analiza wariancji niedostępna chwilowo — widok działa normalnie" (`data-testid="variance-failed"`). Bez KPI-strip, bez wykresu. Tabela FinanceHub widoczna i działająca powyżej panelu.

**Funkcjonalność**
`VarianceBridgePanel.tsx` (`catch → setFailed(true)`, `if (failed)` branch, `data-testid="variance-failed"`, linia ~109-115). Fail-soft = comment w pliku: „Fail-soft (wzór M14 ExecutionIntelligencePanel): błąd ładowania degraduje do cichego komunikatu, nigdy nie blokuje widoku."

---

# E. Predykcja AI

---

### MC-16P-26 · Kontekst Teresy AI dla predykcji — „Jak poprawić marżę operacyjną?" · [REAL-AI]

**Co się dzieje**
Konsultant otwiera zakładkę Predykcja i zaznacza budżet VTS Group Q1 2024 na liście. W panelu podglądu (lub w chat Teresy) klika „Ask Teresa" (ikona AI w prawym górnym rogu FinanceHub lub przycisk w previewFooter). Teresa otrzymuje kontekst modułu przez `buildFinanceTeresaPrompt(activeTab, t)` (FinanceHub.tsx:1544-1545) — prompt określony dla zakładki `prediction`/`models`. Konsultant wpisuje pytanie: „Analiza budżetu VTS Group Q1 2024 — jak poprawić marżę operacyjną przy obecnym niedoborze przychodu 220 000 PLN?". Weryfikuje w Network żądanie do endpointu chat/LLM i realność odpowiedzi (zmienna między uruchomieniami, nie statyczna).

**Efekty pracy**
`teresaPrompt = buildFinanceTeresaPrompt('prediction', t)` (financeModelLabels.ts:56 `isModel = kind === 'models' || kind === 'prediction'`). Chat Teresa: żądanie do backend LLM endpoint z kontekstem finansowym. Odpowiedź: realne rekomendacje dot. marży operacyjnej (nie hardcoded). Brak crashu. Reload nie usuwa historii chat (persystowana per org).

**Grafika**
Chat Teresa w bocznym panelu lub canvas. Kontekst modułu widoczny jako system prompt (niewidoczny dla konsultanta, ale weryfikowalny w Network payload). Odpowiedź AI ze strumieniowanym tekstem (SSE). Możliwe sugestie: optymalizacja mix sprzedaży, redukcja kosztów operacyjnych, inicjatywy wzrostu.

**Funkcjonalność**
`FinanceHub.tsx` (`teresaPrompt`, `buildFinanceTeresaPrompt`, `openChatWithContext`), `financeModelLabels.ts` (prompt dla `prediction`). `[REAL-AI]` — LLM live. Network: żądanie do AI endpoint z `teresaPrompt` w body.

---

### MC-16P-27 · Potwierdzenie linii budżetowych przez AI (Confirm with AI) · [REAL-AI]

**Co się dzieje**
Konsultant wypełnił linie budżetowe budżetu Apator 2024 (plan Revenue 8 500 000 PLN, Capex ICT 3 200 000 PLN) i chce zwalidować założenia przed wygenerowaniem projekcji. Klika przycisk „Confirm with AI" (`finance.budget.confirmWithAI`, BudgetWorkspace.tsx:584). System buduje prompt: `"Review and validate the following budget assumptions for 'Apator ICT Capex Budżet 2024': Period: 2024-01 → 2024-12, Granularity: annual, Budget lines: [lista linii]. Please: 1. Validate reasonableness... 2. Flag risks... 3. Suggest improvements... 4. Confirm if ready."` i wysyła do Teresy przez `navigate(...)` lub `openChatWithContext`. Weryfikuje, że prompt jest faktycznie przekazany i odpowiedź AI zawiera realną ocenę założeń.

**Efekty pracy**
`confirmWithAI` w `BudgetWorkspace.tsx` (linia 570-584): buduje `linesSummary` z `lines`, komponuje string prompt, wywołuje `navigate(...)` lub otwiera chat. Żądanie do backend LLM widoczne w Network z pełnym promptem budżetowym. Odpowiedź AI: walidacja założeń, lista ryzyk, sugestie ulepszeń — realna, nie statyczna. `[REAL-AI]`.

**Grafika**
Przycisk „Confirm with AI" w nagłówku BudgetWorkspace (obok Approve). Panel chat/canvas otwiera się z wypełnionym kontekstem budżetu. Streaming odpowiedzi Teresy. Ewentualny badge „AI validation pending" przed odpowiedzią.

**Funkcjonalność**
`BudgetWorkspace.tsx` (`confirmWithAI`, `linesSummary`, prompt budowy linia 570-584). `openChatWithContext` lub `navigate` z promptem. `[REAL-AI]`. Network: żądanie chat z promptem walidacyjnym.

---

### MC-16P-28 · Teresa identyfikuje outlier wariancji · [REAL-AI]

**Co się dzieje**
Konsultant ma budżet z 8 liniami, z których jedna (Capex hardware Apator) wykazuje wariancję −21,9% (plan 3 200 000, actual 3 900 000 PLN = przekroczenie o 700 000 PLN). Otwiera chat Teresy z kontekstem zakładki Predykcja i pyta: „Który wiersz budżetowy wykazuje największe odchylenie od planu i jak je wyjaśnić?". Teresa (REAL LLM, z kontekstem danych budżetu jeśli jest on przekazany przez `teresaPrompt`) wskazuje linię Capex hardware jako outlier z najwyższym odchyleniem bezwzględnym. Jeśli Teresa nie ma dostępu do surowych danych (tylko kontekst prompt), weryfikuje, że odpowiedź jest kontekstualna i nie jest statycznym fallback. Odnotowuje granicę możliwości: brak real-time data injection → Teresa działa na podstawie promptu (nie live DB).

**Efekty pracy**
Pytanie do LLM → odpowiedź identyfikuje linię z największym odchyleniem (na podstawie danych w promptcie). Jeśli `teresaPrompt` nie zawiera danych budżetowych per linia → Teresa odpowie ogólnie (nie może znać konkretnych liczb) → to jest known limitation. Test: weryfikacja, że odpowiedź jest sensowna i nie crashuje. `[REAL-AI]`.

**Grafika**
Chat panel z Teresą. Pytanie konsultanta widoczne. Odpowiedź streamowana — jeśli dane dostępne w promptcie: konkretna odpowiedź z liczbami. Jeśli brak danych w prompcie: ogólne rekomendacje metodyczne (jak zidentyfikować outlier). Brak „Sorry, I can't help" — graceful.

**Funkcjonalność**
`buildFinanceTeresaPrompt` (financeModelLabels.ts), chat LLM endpoint, `[REAL-AI]`. Known limitation: prompt może nie zawierać surowych danych liczbowych — odnotować jako gap produktowy.

---

# F. Eksport i integracja

---

### MC-16P-29 · Eksport budżetu przez ExportToOutputDialog · [EXPORT]

**Co się dzieje**
Konsultant chce wyeksportować budżet VTS Group Q1 2024 do formatu nadającego się do raportu. W tabeli predykcji zaznacza wiersz budżetu → w kebab-menu (⋮) lub w previewFooter klika akcję eksportu → otwiera się `ExportToOutputDialog` (FinanceHub.tsx:2419-2428). Dialog jest wypełniony `analysisId = getBudgetRawId(budgetContext.id)`, `analysisTitle = budgetContext.title`, `sourceType = 'budget'`. Konsultant wybiera format (np. Word/Excel/PDF/Deck) i klika „Eksportuj". Weryfikuje żądanie eksportu w Network. Sprawdza, że dialog zamyka się po sukcesie (`setExportDialogOpen(false)`) i pojawia się toast sukcesu lub nawigacja do Outputs M17.

**Efekty pracy**
`ExportToOutputDialog` otwiera się z prawidłowymi props (`analysisId`, `analysisTitle`, `sourceType: 'budget'`). Żądanie eksportu do serwisu eksportu finansowego (`exportFinancialAnalysis` z `financeExportService`, `ExportToOutputDialog.tsx:15`). Response: plik lub artefakt w M17 Outputs. Toast sukcesu. Dialog zamknięty. Network: żądanie do `/api/.../export` lub analogicznego endpointu → 200.

**Grafika**
`ExportToOutputDialog` (Finance/ExportToOutputDialog.tsx, 571 lin.) — modal z tytułem budżetu, wyborem formatu (select), opcjonalnym formatem briefu, przyciskiem „Eksportuj". Loader podczas eksportu. Toast sukcesu zielony. Ewentualna nawigacja do M17 Outputs po sukcesie.

**Funkcjonalność**
`FinanceHub.tsx` (`exportDialogOpen`, `exportTarget`, kebab action predykcji: `setExportTarget({ id, title, sourceType: 'budget' })`), `ExportToOutputDialog.tsx` (`exportFinancialAnalysis`, `financeExportService`). Network: obserwuj żądanie eksportu i response.

---

### MC-16P-30 · Cross-link: nawigacja do zakładki Wycena z budżetem jako źródłem · [EXPORT]

**Co się dzieje**
Konsultant chce przejść od budżetu do wyceny przedsiębiorstwa — standardowy workflow strategiczny po zamknięciu roku. W `BudgetWorkspace` przy otwartym budżecie Apator ICT 2024 klika przycisk „Wycen budżet" (`finance.budget.valuate`, BudgetWorkspace.tsx:588). System wywołuje `navigate('/economics?tab=valuation&createFrom=budget&sourceId=<budgetId>')`. Konsultant weryfikuje: (a) nawigacja do zakładki Wycena, (b) URL zawiera `tab=valuation&createFrom=budget&sourceId=...`, (c) `CreateValuationModal` lub formularz wyceny jest pre-wypełniony z powiązaniem do budżetu źródłowego. Sprawdza `FinanceHub.tsx:733` logikę `createFrom === 'budget'`.

**Efekty pracy**
`navigate('/economics?tab=valuation&createFrom=budget&sourceId=${selected.id}')` (BudgetWorkspace.tsx:588). URL po nawigacji: `/finance?tab=valuation&createFrom=budget&sourceId=<id>` lub `/economics?tab=valuation&...`. `FinanceHub.tsx:733`: `if (createFrom && tab === 'valuation')` → logika pre-fill. Zakładka Wycena aktywna (`activeTab === 'valuation'`). Brak crashu przy braku `createFrom` guard.

**Grafika**
Przycisk „Wycen budżet" w nagłówku `BudgetWorkspace` (obok Approve, Confirm with AI). Po kliknięciu: nawigacja do zakładki Wycena z aktywnym stanem. URL w pasku adresu z parametrami. Ewentualny modal wyceny z pre-wypełnionym tytułem opartym na tytule budżetu. Tab Wycena aktywna (wyróżniony w navbarze zakładek).

**Funkcjonalność**
`BudgetWorkspace.tsx` (`navigate('/economics?tab=valuation&createFrom=budget&sourceId=${selected.id}')`, linia 588), `FinanceHub.tsx` (`createFrom`, `tab === 'valuation'` logika linia 733), `useSearchParams`. Cross-module: budżet M16 Predykcja → Wycena M16 Valuation.

---

## Macierz pokrycia funkcji → case'y

| Obszar funkcji | Case'y |
|---|---|
| Tworzenie budżetu (ręczny, z modelu, kwartalny, roczny) | MC-16P-01, 02, 05, 06 |
| Edycja budżetu (tytuł/okres) | MC-16P-03 |
| Usuwanie budżetu (DELETE + kaskada) | MC-16P-04 |
| Wprowadzanie aktualnych (linie P&L, CF) | MC-16P-07, 10 |
| Widok tabeli budżet vs wykonanie | MC-16P-08 |
| Wyliczenie wariancji (F/U, % , kolorowanie) | MC-16P-09 |
| Zatwierdzenie budżetu (Approve, status `approved`) | MC-16P-11 |
| Pusty stan budżetu (empty state) | MC-16P-12 |
| Scenariusze (base, optimistic, conservative) | MC-16P-13, 14, 15 |
| Aktywacja scenariusza + porównanie side-by-side | MC-16P-16, 17 |
| Aktywacja flagi `ff_varianceBridge` | MC-16P-18 |
| Variance Bridge Panel — empty state | MC-16P-19 |
| Variance Bridge Panel — linie plan/actual | MC-16P-20 |
| POST /variance-bridge + waterfall render | MC-16P-21 |
| Kolorowanie słupków F/U w waterfall | MC-16P-22 |
| KPI-strip `variance-total` | MC-16P-23 |
| Liczniki F: n / U: n | MC-16P-24 |
| Fail-soft na błąd API (bez crashu) | MC-16P-25 |
| Teresa AI — kontekst predykcji | MC-16P-26 |
| Teresa AI — Confirm with AI | MC-16P-27 |
| Teresa AI — outlier wariancji | MC-16P-28 |
| Eksport przez ExportToOutputDialog | MC-16P-29 |
| Cross-link budżet → Wycena | MC-16P-30 |

---

## Uwagi metodyczne

- **E2E jako wymóg:** każdy case z modyfikacją danych (`POST`/`PUT`/`DELETE`) musi pokazać żądanie HTTP w zakładce Network → odpowiedni kod statusu → reload = identyczny stan. UI-zmiana bez żądania = FAIL.
- **Flaga [FLAG]:** MC-16P-18 do MC-16P-25 wymagają URL param `ff_varianceBridge=1` lub localStorage `ff.fin_variance_bridge = 1`. Bez flagi `VarianceBridgePanel` nie jest renderowany (sprawdzone: `isFinanceFlagEnabled('varianceBridge')`, `financeFeatureFlags.ts`).
- **[V8]:** endpoint `/api/v8/finance/value/variance-bridge` wymaga bramki v8 org (`isV8FinanceEnabled`). Na orgu bez v8 → 403 lub 404. Weryfikuj na orgu z włączoną bramką v8.
- **[REAL-AI]:** MC-16P-26, 27, 28 wymagają live LLM (Teresa). Odpowiedzi zmienne między uruchomieniami — NIGDY nie weryfikuj statyczną treścią, tylko: (a) brak crashu, (b) żądanie LLM widoczne w Network, (c) realność/kontekstualność odpowiedzi.
- **PLN i liczby realistyczne:** przypadki używają liczb z warsztatu: VTS Group (przychód 1 200 000 / actual 980 000), Apator ICT (capex plan 3 200 000 / actual 3 900 000). Wariant MC-16P-24 poszerza do 5 linii.
- **Known gap do odnotowania (NIE jako FAIL):** `VarianceBridgePanel` renderowany bez `lines` prop (FinanceHub.tsx:2122 `<VarianceBridgePanel />`), co oznacza panel zawsze w stanie `variance-empty` dopóki nie zostanie podłączony do linii budżetu. To jest gap integracyjny — panel istnieje jako biblioteczny komponent bez drucika z `BudgetWorkspace`.
- **Bezpieczeństwo:** budżety są org-scoped (`organization_id` w `budgets`). Konsultant z org B NIE powinien widzieć budżetów org A. Weryfikować cross-org reject przy próbie `GET /economics/budgets/:id` cudzego budżetu → 404.
