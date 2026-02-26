# Rezultaty (Results) v3 — KPI Table, Tracking, Reports, ROI (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** kanonicznie opisać moduł **Rezultaty** jako “dowód dowiezienia” po wdrożeniu:  
> (1) jedna tabela KPI, (2) tracking time‑series, (3) mapping KPI↔initiative, (4) cykliczne raportowanie KPI + plan naprawczy, (5) ROI plan vs realized (osobny task V3‑H02).

## 0) Powiązane SSOT (MUST)

- UI:
  - App Table Standard: `docs/ui-standards/03-modules/app-table-standard.md`
  - Module Hub standard: `docs/ui-standards/03-modules/module-hub-standard.md`
- Gates / governance:
  - Gate DoD policy: `docs/product/GATE_DEFINITION_OF_DONE.md`
  - N‑mode templates/completeness: `docs/product/NMODE_MANAGEMENT_V3.md`
- Initiatives PMO baseline:
  - Initiative levels/templates: `docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md`
- Program:
  - `docs/product/V3_IMPLEMENTATION_PROGRAM.md` → `V3-H01`, `V3-H02`, `V3-H03`

---

## 1) Problem & intent (konsultingowy sens modułu)

W consultingu “wdrożyliśmy” bez **tracking’u rezultatów** to klasyczna porażka (brak trwałości zmiany).

**Rezultaty** są miejscem, gdzie organizacja:

- definiuje *metryki sukcesu* (KPI),
- cyklicznie wpisuje/zbiera wartości (time‑series),
- widzi trend i status (on‑target / below),
- mapuje KPI do inicjatyw (attribution),
- robi cykliczne “performance review” KPI (raport + przyczyna + plan naprawczy),
- docelowo automatyzuje zbieranie danych (integracje / MCP‑IRIS).

---

## 2) Kanoniczny mental model (MUST)

**Rezultaty** (Module Hub) ma 3 główne zakładki (zgodnie z Twoją intencją “3 oddzielne przyciski”):

1) **Mierniki (KPI)** — biblioteka i tabela KPI (kanoniczna, jedna).  
2) **Raporty KPI** — cykliczne raporty z wybranych KPI (review + przyczyny + plan naprawczy).  
3) **ROI (Zwrot z inwestycji)** — analizy ROI plan vs realized (tracking po wdrożeniu).

> W opisie v3/H03 mówimy też o 2 “surfaces”:  
> **Operational** = (Mierniki + Raporty KPI), **ROI** = ROI.

W v3 roadmap:

- **V3‑H01 (R0/P0)**: KPI table core + time‑series manual + mapping KPI↔initiative  
- **V3‑H02 (R0/P0)**: ROI plan vs realized (tracking po wdrożeniu)  
- **V3‑H03 (R1/P1)**: widoki analityczne (operational analysis + ROI analysis)

---

## 3) V3‑H01 — KPI table jako core (R0/P0)

### 3.1 Jedna kanoniczna tabela KPI (App Table Standard)

Widok “KPI” jest **jedną tabelą** agregującą:

- KPI z inicjatyw (zdefiniowane w Initiative → KPI),
- KPI globalne (dodane przez PMO/Owner bez inicjatywy),
- KPI zmapowane do inicjatyw (attribution: 1 KPI ↔ N inicjatyw i odwrotnie).

**MUST (UI):**

- zgodność z `app-table-standard.md` (topbar `h-9`, search toggle, resizable columns, header filters, brak dodatkowych breadcrumbs),
- CTA primary: **“Dodaj miernik”**,
- akcja w wierszu: “Open initiative” (gdy jest mapping) oraz “Open KPI”.

### 3.2 CTA “Dodaj miernik” → wizard (dynamic tab/card)

Dodanie KPI nie jest inline w tabeli (żeby nie robić śmieciowych wpisów). CTA otwiera **dynamiczną kartę** (wizard), która prowadzi przez definicję metryki.

**Wizard (kanon, R0):**

1) **Definicja KPI**
   - nazwa (PL/EN), opis celu, obszar/typ (opcjonalnie),
   - jednostka (%, PLN, szt., h, …),
   - baseline (opcjonalnie) + target,
   - częstotliwość (weekly/monthly/quarterly) + “period anchor” (np. miesiąc kalendarzowy),
   - owner (osoba/rola).
2) **Źródło danych (3 tryby, R0 = manual)**
   - `MANUAL_ENTRY` (R0): wartości wpisywane przez usera,
   - `CONNECTOR` (v4+): podłączenie do źródła (BI/ERP/CRM/…),
   - `MCP_IRIS` (v4+): dane przez MCP z systemu plant operations (IRIS).
3) **Mapowanie do inicjatyw (attribution)**
   - wybór inicjatyw (multi‑select),
   - udział/attribution (opcjonalnie: % lub “informational link”),
   - jeśli KPI tworzone z inicjatywy → mapping domyślnie ustawiony.

**MUST:** AI może *proponować* parametry (np. unit/target/frequency), ale zapis = zawsze “propose→accept”.

### 3.3 Tracking time‑series (manual, R0)

Każdy KPI ma historię wartości w czasie.

**Zasada:** `current_value` jest pochodną **ostatniego wpisu** w time‑series dla danego KPI (lub ostatniego w danym oknie czasu).

**UI (R0):**

- KPI row → “Open KPI” → widok szczegółu KPI (history)
- CTA: “Dodaj wpis” (wartość za okres)
- lista wpisów (okres, value, komentarz, enteredBy, enteredAt)

**Wpis time‑series (R0):**

- period: np. `2026-02` (miesiąc) lub `2026-W08` (tydzień) lub `2026-Q1`,
- value: number,
- note (opcjonalnie),
- evidence (opcjonalnie): link/attachment (v4+ jeśli brak systemu załączników w tym miejscu).

### 3.4 Status KPI (on target / below)

Status wyliczany jest deterministycznie na bazie:

- target + direction (większe=lepiej / mniejsze=lepiej) + tolerancja (opcjonalnie),
- current value (z time‑series),
- opcjonalnie: trend (R1).

R0 minimum: **on_target / below_target / no_data**.

---

## 4) Mapping KPI ↔ Initiative (attribution) (R0)

### 4.1 Po co mapping?

Żeby “Rezultaty” nie były oderwane od pracy:

- KPI pokazują, *które inicjatywy* je dowożą,
- inicjatywa pokazuje, *które KPI* są jej obietnicą i obowiązkiem tracking’u,
- PMO może filtrować inicjatywy “below target”.

### 4.2 Zasady mappingu (MUST)

- 1 KPI może być przypięte do wielu inicjatyw (cross‑cutting KPI),
- 1 inicjatywa może mieć wiele KPI,
- mapping ma być jawny, audytowalny i edytowalny (z uprawnieniami),
- w R0 mapping jest **manual** (poza przypadkiem “create KPI from initiative”).

---

## 5) KPI Reports (cykliczne review) + plan naprawczy

To jest drugi filar opisany przez Ciebie: “lista metryk” vs “raporty z metryk”.

### 5.1 Zakres v3

- R0: KPI table + time‑series entry (bez wymuszonego raportowania)
- R1: KPI Reports jako osobny tab/widok + plan naprawczy

### 5.2 Kanoniczny model raportu KPI (R1)

Raport KPI to **snapshot** wybranych KPI dla okresu (np. miesiąc) + komentarz/wnioski.

Każdy KPI w raporcie ma:

- status (auto) + manualny komentarz,
- jeśli `below_target`: **“Dlaczego?”** + **“Plan naprawczy”**:
  - działania (lista),
  - owner,
  - due date,
  - link do inicjatywy lub utworzenie tasków (workflow naprawczy).

**MUST:** plan naprawczy nie jest tylko tekstem — powinien móc tworzyć/wiązać taski (nawet jeśli minimalnie w R1).

---

## 6) V3‑H02 — ROI plan vs realized (w tym samym module, ale osobny scope)

ROI tracking jest silnie powiązany z inicjatywą:

- w inicjatywie jest business case (capex/opex/benefits),
- w Rezultatach jest “realized” w czasie (manual entry R0),
- różnica plan vs realized jest widoczna i raportowalna.

Szczegóły: `V3‑H02` (SSOT robimy osobno, ale modułowo to jest ten sam “Results mental model”).

---

## 7) Kontrakty danych (logiczne, v3)

### 7.1 KPI (canonical)

`Kpi`:

- `id`
- `name`
- `description?`
- `unit`
- `baseline_value?`
- `target_value?`
- `direction` = `HIGHER_IS_BETTER | LOWER_IS_BETTER`
- `frequency` = `WEEKLY | MONTHLY | QUARTERLY`
- `owner_user_id?` / `owner_role?`
- `data_source_type` = `MANUAL_ENTRY | CONNECTOR | MCP_IRIS`
- `current_value?` (derived)
- `status` = `NO_DATA | ON_TARGET | BELOW_TARGET`
- `created_at`, `updated_at`

### 7.2 Time series

`KpiTimeSeriesPoint`:

- `id`
- `kpi_id`
- `period_key` (np. `2026-02`, `2026-W08`, `2026-Q1`)
- `value`
- `note?`
- `entered_by`
- `entered_at`

### 7.3 Mapping

`InitiativeKpiMapping`:

- `id`
- `initiative_id`
- `kpi_id`
- `attribution_weight?` (opcjonalnie)
- `created_at`, `created_by`

---

## 8) API/UI contract (minimalny)

Backend powinien zwracać do tabeli:

- listę KPI z polami do kolumn + `linkedInitiativesCount` + `lastPeriodKey?`,
- dla KPI detail: time‑series list (paginowana) + computed status.

**MUST:** brak danych nie crashuje UI (placeholder `—`), zgodnie z `app-table-standard.md`.

---

## 9) Analytics (events)

- `results_kpi_created` (source=initiative|global, dataSourceType)
- `results_kpi_updated`
- `results_kpi_mapping_updated`
- `results_kpi_value_recorded` (kpiId, periodKey)
- `results_kpi_opened`

---

## 10) Definition of Done (V3‑H01, R0)

- Jest jedna kanoniczna tabela KPI (App Table Standard).
- CTA “Dodaj miernik” otwiera wizard (dynamic card/tab) i tworzy KPI.
- KPI z inicjatyw pojawiają się w Rezultatach (agregacja) i mają mapping do inicjatywy.
- Jest manual time‑series: dodanie wpisu aktualizuje `current_value` i status.
- Mapping KPI↔initiative działa (z KPI i z inicjatywy).

