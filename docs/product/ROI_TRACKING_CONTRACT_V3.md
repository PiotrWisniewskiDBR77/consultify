# ROI Contract v3 — Assumptions vs Realized, Cadence, Ownership, Locking (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** zdefiniować kanoniczny kontrakt ROI (plan vs realized) jako **governance artefact**:  
> (1) model danych i UI, (2) cadence/ownership, (3) blokady i audyt (bez edycji post‑factum),  
> (4) statusy i integracja z gate’ami oraz inicjatywami.

## 0) Powiązane SSOT (MUST)

- Economic Analysis policy (required fields + gate enforcement): `docs/product/ECONOMIC_ANALYSIS_POLICY.md`
- Gate DoD (status transitions): `docs/product/GATE_DEFINITION_OF_DONE.md`
- Results module (KPI table + tracking mental model): `docs/product/RESULTS_V3.md`
- Operating Model (Results/Benefits w osi pracy): `docs/product/OPERATING_MODEL_V3.md`
- N‑mode templates/completeness: `docs/product/NMODE_MANAGEMENT_V3.md`
- Financial Analysis module (inwestycyjna / wyceny — referencja): `docs/product/FINANCIAL_ANALYSIS_V3.md`

---

## 1) Intent (dlaczego ROI jest osobnym kontraktem)

ROI bez rozdziału **plan vs realized** jest deklaracją. V3 wymaga:

- utrwalenia baseline (plan/assumptions) w formie audytowalnej,
- cyklicznego wpisywania realized (manual w R0),
- historii wpisów i odchyleń,
- mechaniki “nie da się cofnąć w czasie bez śladu”.

**MUST:** ROI Tracking to nie “excel w UI” — to **artefakt governance**.

---

## 2) Artefakt: Economic Analysis (ROI Card)

W systemie ROI jest reprezentowane przez **Economic Analysis** powiązaną z inicjatywą (primary path).

### 2.1 Dwa scenariusze tworzenia

1) **Z inicjatywy (primary):** Initiative → sekcja “Economic analysis / ROI” → CTA “Dodaj analizę”.  
2) **Globalnie (secondary):** Rezultaty → ROI → CTA “Dodaj analizę” (do eksperymentu), z opcją przypięcia do inicjatywy.

**MUST:** jeśli analiza jest użyta w decyzji/gate, musi być przypięta do inicjatywy (traceability).

---

## 3) Plan (assumptions) vs Realized (tracking) — kanon

### 3.1 Plan = assumptions baseline (snapshot)

Plan (assumptions) to zestaw pól opisujących przewidywany efekt i koszty:

- CAPEX / OPEX (z rozbiciem na pozycje),
- expected benefits (z rozbiciem: cost saving / revenue / risk),
- harmonogram efektów (kiedy zaczyna działać),
- waluta, owner, założenia tekstowe, ryzyka ekonomiczne.

**MUST:** Plan może być edytowany tylko do momentu **finalizacji**.

### 3.2 Realized = wpisy okresowe (time-series)

Realized to cykliczne wpisy w czasie (manual R0):

- okres (miesiąc/kwartał),
- rzeczywiste koszty (CAPEX/OPEX),
- rzeczywiste korzyści (benefits),
- komentarz + evidence (opcjonalnie),
- autor + timestamp.

**MUST:** wpis realized jest **nieedytowalny**. Korekty robi się przez:

- nowy wpis korygujący (delta) albo
- “reversal entry” (jawny audit trail).

---

## 4) Cadence + ownership (R0)

### 4.1 Cadence

Każda analiza ma `cadence`:

- `MONTHLY` (default) lub `QUARTERLY`

oraz `period_anchor` (np. kalendarzowy miesiąc/kwartał).

### 4.2 Ownership / accountability

**MUST:** jedna osoba/rola jest accountable za wpisy realized:

- `benefits_owner` (domyślnie Business Owner inicjatywy) — odpowiada za realizację efektów,
- `finance_reviewer` (opcjonalnie w R0, wymagane w wyższych template’ach v3+) — zatwierdza rozliczenie.

Docelowo (v4+): kaskadowe przypisywanie / delegowanie per linia kosztu/benefitu.

---

## 5) Locking, approvals, governance (Twoja intencja)

### 5.1 Statusy karty (kanon)

`EconomicAnalysisStatus`:

- `DRAFT` — edytowalna; nieużywalna do gate APPROVE
- `FINAL` — **locked baseline** (assumptions); używalna do gate’ów
- `TRACKING` — baseline locked; można dopisywać realized entries
- `RECONCILED` — rozliczona (po zamknięciu inicjatywy / po okresie tracking)
- `AMENDED` — zmiany wymagające re‑finalizacji (governed change)

> Minimalnie w `ECONOMIC_ANALYSIS_POLICY.md` istnieje `DRAFT/FINAL`. Ten SSOT rozszerza kontrakt na tracking.

### 5.2 Finalizacja (approval/lock)

Finalizacja:

- tworzy snapshot baseline (assumptions),
- blokuje edycję planu,
- zapisuje: kto/kiedy sfinalizował + wersję.

**MUST:** po `FINAL` nie wolno “po cichu” zmieniać:

- CAPEX/OPEX, benefits, target metrics, założeń,
- sposobu liczenia / parametrów (np. discount rate).

### 5.3 Governed change (gdy zmienia się budżet/scope/benefits)

Jeśli zmiana dotyczy budżetu, scope lub benefits:

- analiza przechodzi w `AMENDED`,
- wymagany jest nowy snapshot `FINAL` (wersjonowanie),
- wcześniejsze wersje pozostają do porównania (audit).

Gate referencja: `ECONOMIC_ANALYSIS_POLICY.md` + `GATE_DEFINITION_OF_DONE.md`.

---

## 6) UI contract (R0)

### 6.1 Lista analiz ROI (Rezultaty → ROI)

Tabela (App Table Standard) pokazuje:

- name / initiative link
- status (`DRAFT/FINAL/TRACKING/RECONCILED/AMENDED`)
- owner
- createdAt / updatedAt
- “Needs entry” (jeśli brak wpisu za ostatni okres wg cadence)
- quick KPI: payback + ROI% (z baseline i z realized-to-date)

### 6.2 Karta analizy (detail)

Układ (minimum):

- **Summary** (baseline + realized-to-date + delta)
- **Assumptions (Plan)** — read-only po finalizacji
- **Realized entries** — lista wpisów + CTA “Dodaj wpis”
- **Conclusions** — pole opisowe + rekomendacja (manual; AI może proponować)

**MUST:** statusy i blokady są widoczne; user rozumie czemu nie może edytować planu.

---

## 7) Calculations (R0 scope)

R0 wymaga minimalnie:

- ROI% (na bazie benefits vs costs)
- payback period (miesiące)

Opcjonalnie (jeśli podamy `discount_rate`):

- NPV
- IRR

**MUST:** brak discount rate nie blokuje R0 (ale UI jasno komunikuje “NPV/IRR not computed”).

---

## 8) Data contract (logiczne)

### 8.1 Economic analysis header

`economic_analysis`:

- `id`
- `initiative_id?`
- `title`
- `currency`
- `status` (jw.)
- `cadence` (`MONTHLY|QUARTERLY`)
- `benefits_owner_user_id?`
- `finance_reviewer_user_id?`
- `discount_rate?`
- `assumptions_text`
- `risks_text?`
- `finalized_at?`, `finalized_by?`, `version`

### 8.2 Plan (baseline) lines

`economic_analysis_plan_lines`:

- `analysis_id`
- `type` = `CAPEX|OPEX|BENEFIT`
- `category` (enum/tekst)
- `amount` (numeric)
- `timing` (opcjonalnie: start/end lub rozkład)
- `notes?`

### 8.3 Realized entries (immutable)

`economic_analysis_realized_entries`:

- `id`
- `analysis_id`
- `period_key` (np. `2026-02` / `2026-Q1`)
- `capex_actual?`
- `opex_actual?`
- `benefit_actual?`
- `note?`
- `entered_by`, `entered_at`
- `entry_type` = `NORMAL|CORRECTION|REVERSAL`

---

## 9) Definition of Done — V3‑H02 (R0/P0)

- Z inicjatywy można utworzyć Economic Analysis (ROI card) i sfinalizować (lock).
- Są dwa widoki: Plan (assumptions) oraz Realized (wpisy okresowe) + historia wpisów.
- Realized entries są nieedytowalne; korekty mają audit trail.
- UI pokazuje odchylenie plan vs realized oraz status “needs entry”.
- Gate APPROVE respektuje `ECONOMIC_ANALYSIS_POLICY.md` (FINAL required, jeśli wymagane).

