## Smoke checklist — Finance V3 (dev/staging)

Zakres: `FinanceHub` + `FinancialModelWorkspace (T054)` + podstawowe integracje (wycena deep-link, eksport).

### A) Finance Hub (Module Hub standard)

- [ ] Otwórz `Economics → Finance` (hub).
- [ ] Tabs: **Modele / Analiza / Predykcja / Wycena** widoczne i działają.
- [ ] Search działa (filtruje listę).
- [ ] View mode: `table` ↔ `grid` przełącza bez crasha.
- [ ] Klik w wiersz w tabeli pokazuje preview; double-click otwiera full view.
- [ ] Command row “status pills” przełącza filtry (Wszystkie/Draft/Review/Approved).
- [ ] “Import PDF” (na tab Models) otwiera wizard i da się go zamknąć.
- [ ] Empty state: przy braku danych, komunikat jest poprawny per tab i nie ma błędów w konsoli.
- [ ] i18n: przełącz język aplikacji PL/EN i sprawdź, że krytyczne etykiety nie są “na twardo” w złym języku.

### B) T054 — Financial Model Workspace

#### B1) Create model
- [ ] New model: utwórz model (name, start date, horizon, granularity, currency) → pojawia się na liście.
- [ ] Select model: po kliknięciu model ładuje się (brak błędów).

#### B2) Inputs & assumptions
- [ ] Zmień 2 pola w “Initial Balance Sheet” i kliknij Save → po refresh nie wracają stare wartości.

#### B3) Events
- [ ] Dodaj event typu `revenue` (monthly, start date) → event widoczny na liście.
- [ ] Dodaj event typu `cogs` lub `opex` → event widoczny.
- [ ] Usuń event → znika, model nadal działa.

#### B4) Compute → Outputs
- [ ] Kliknij Compute → ładuje outputs (P&L/BS/CF) i validations.
- [ ] Outputs: przełącz P&L/BS/CF, tabela się renderuje i ma wartości.

#### B5) Validations → Approve
- [ ] Wejdź w Validation tab, sprawdź summary (Total/Passed/Failed/Warnings).
- [ ] Jeśli fail=0, kliknij Approve → status zmienia się na approved i w UI jest “Approved”.
- [ ] Dodaj/zmień event po approve → model wraca do draft (wymagane).

### C) Deep-link do wyceny

- [ ] W headerze modelu kliknij “Wycen model” → przejście do `Economics?tab=valuation...` otwiera modal tworzenia wyceny z prefill source.

### D) Export (SSOT FINANCE_EXPORT_V3)

- [ ] Kliknij Export w workspace (jeśli dostępne) → musi otworzyć wizard (nie tworzyć artefaktu “magicznie”).
- [ ] Sprawdź, że output ma “Open source” i metadane traceability (source snapshot/run).

