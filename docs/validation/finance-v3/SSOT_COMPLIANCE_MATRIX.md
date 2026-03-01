## Finance V3 — SSOT compliance matrix (MUST/SHOULD)

Źródła SSOT:
- `docs/product/FINANCIAL_ANALYSIS_V3.md`
- `docs/product/FINANCE_EXPORT_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/product/REPORT_GENERATOR_V3.md`
- UI canon: `docs/ui-standards/03-modules/golden-standard-table-cards-preview-v3.md`

Legenda statusów:
- **PASS**: jest evidence + jest walidacja (test lub smoke) i przeszło
- **PARTIAL**: jest implementacja, ale brakuje części SSOT albo brakuje walidacji
- **GAP**: brak implementacji / niespójność specyfikacji

> Uwaga: ta macierz jest celowo “evidence-first”. Jeśli brak testu automatycznego, pole “Walidacja” kieruje do `SMOKE_CHECKLIST.md`.

---

### 1) Surface / UI canon — Finance Hub (Golden Standard Table+Cards+Preview)

| Wymaganie (SSOT / Canon) | Priorytet | Status | Evidence | Walidacja |
|---|---:|---|---|---|
| Module Hub: 4 taby + Table+Preview + Grid/Cards | MUST | PARTIAL | `src/components/Economics/FinanceHub.tsx` | `SMOKE_CHECKLIST.md` A |
| Table+Preview: select→preview, dblclick→full view, back-to-list | MUST | PARTIAL | `FinanceHub.tsx` (TableWithPreviewLayout + FilterableTable) | `SMOKE_CHECKLIST.md` A |
| i18n PL/EN dla krytycznych labeli | MUST | PARTIAL | `FinanceHub.tsx` + translation keys | `SMOKE_CHECKLIST.md` A |

---

### 2) T054 — Financial Modeling workspace (builder)

| Wymaganie | Priorytet | Status | Evidence | Walidacja |
|---|---:|---|---|---|
| Create model + list + open | MUST | PARTIAL | UI: `src/components/Finance/FinancialModelWorkspace.tsx` API: `POST/GET /api/financial-modeling/models` | `SMOKE_CHECKLIST.md` B1 + test unit (TBD) |
| Events CRUD (add/delete/update) | MUST | PARTIAL | UI: `FinancialModelWorkspace.tsx` API: `/models/:id/events`, `/events/:eventId` | `SMOKE_CHECKLIST.md` B3 + test unit (TBD) |
| Compute outputs + validations | MUST | PARTIAL | API: `POST /models/:id/compute`, service: `server/src/services/financialModelingService.ts` | test unit `financialModelingService.computeModel.test.ts` + `SMOKE_CHECKLIST.md` B4/B5 |
| Hard consistency checks: BS equation + cash tie-out | MUST | PASS | `financialModelingService.ts` validations: `BS_EQUATION`, `CASH_TIEOUT` | test unit `financialModelingService.computeModel.test.ts` |
| Approve blocked when failing validations | MUST | PARTIAL | UI disables approve when `fail>0`; API uses `approveModel()` | test unit (TBD) + `SMOKE_CHECKLIST.md` B5 |
| Po zmianie eventu: approved → draft | MUST | PARTIAL | `addEvent/updateEvent/deleteEvent` reset status in `financialModelingService.ts` | test unit (TBD) + `SMOKE_CHECKLIST.md` B5 |

---

### 3) SSOT deltas (najczęstsze luki vs `FINANCIAL_ANALYSIS_V3.md`)

| Wymaganie SSOT | Priorytet | Status | Co mamy teraz | Gap / co sprawdzić |
|---|---:|---|---|---|
| Internal compute resolution miesięczna niezależnie od granularności (rollups) | MUST | GAP | `generatePeriods()` zmienia krok (1/3/12) zależnie od `granularity` | zdecydować: (a) zmiana silnika na always-monthly + rollup, albo (b) uzasadnione odstępstwo w V3 scope T054 |
| “Zero-change model” baseline autopilot po imporcie | MUST | GAP | compute w UI jest disabled gdy brak events; brak baseline output bez eventów | dodać baseline compute bez eventów lub seedowanie z imported statements |
| Import PDF → normalize/map/validate pipeline | MUST | PARTIAL | Jest `FinancialStatementImportWizard` (entry w hubie), ale wymaga walidacji całej ścieżki | dodać osobną macierz/plan dla importu (poza T054) |

---

### 4) Export V3 (Report/Presentation/Initiatives + traceability)

| Wymaganie (`FINANCE_EXPORT_V3.md`) | Priorytet | Status | Evidence | Walidacja |
|---|---:|---|---|---|
| Export zawsze otwiera wizard (nigdy “magiczny output”) | MUST | PARTIAL | SSOT: `docs/product/FINANCE_EXPORT_V3.md`; UI: `ExportButton` w workspace (do zweryfikowania) | `SMOKE_CHECKLIST.md` D |
| 3 outputy: Report / Presentation / Initiatives | MUST | PARTIAL | SSOT; implementację trzeba potwierdzić w `ExportButton`/wizard | `SMOKE_CHECKLIST.md` D |
| Traceability: output ma “Open source” do snapshot/run (nie live view) | MUST | GAP | brak potwierdzonego snapshot/run artefaktu dla T054 export | zaprojektować “run/snapshot” dla finansów i wpiąć do Report Builder |
| Export do Initiatives jest propose→accept (nie auto-create) | MUST | GAP | SSOT to wymaga; brak potwierdzonej implementacji | zaprojektować flow + zgodność z traceability spec |

---

### 5) Traceability spec alignment (krytyczne ryzyko)

`SOURCE_TRACEABILITY_SPEC.md` mówi: inicjatywy mogą powstać **tylko** z `ToolSession` lub `AssessmentReport`.

| Obszar | Priorytet | Status | Wniosek walidacyjny |
|---|---:|---|---|
| Finance export → Initiatives | MUST | GAP | jeśli eksport z finansów ma tworzyć inicjatywy, musi powstać kanoniczny `ToolSession` (np. “FINANCIAL_ANALYSIS_RUN” lub “MYWORK seed → ToolSession”) i dopiero z niego inicjatywy, inaczej łamiemy kanon traceability |

