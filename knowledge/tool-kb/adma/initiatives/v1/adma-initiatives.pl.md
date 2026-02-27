---
tool_slug: adma
pack_type: initiatives
version: 1
language: pl
source_kind: tool_pack
source_name: "Consultify ADMA initiative patterns"
created_at: 2026-02-27
---

# ADMA — wzorce inicjatyw (gap → initiative patterns) v1 (PL)

## 0) Jak używać tego packa

Ten pack służy do generatora inicjatyw po ADMA:

- wejście: wyniki assessmentu (12 wymiarów: current/target + evidence) + agregacja do T1–T7,
- wyjście: lista inicjatyw “propose→accept”, pogrupowana w fale (0–6, 6–18, 18–36 miesięcy).

Reguły:

- **foundation przed value**: jeśli gap dotyczy danych/integracji/kompetencji/governance, najpierw inicjatywy fundamentów.
- **inicjatywa ma ownera i KPI**: outcome + leading.
- **evidence-aware**: jeśli braki dowodów → inicjatywa “evidence sprint / discovery” zamiast “wdrożenie”.

---

## 1) Katalog “foundation” (najczęstsze i obowiązkowe)

### FND-01 — Data & OT/IT integration baseline

- **Kiedy**: niski `data_collection` lub `production_it` lub duże rozjazdy opinii; brak SSOT danych.
- **Cel**: standard zbierania danych + integracja minimum (shopfloor→analytics).
- **Deliverables**: mapa źródeł danych, standard tagowania, pipeline, monitoring jakości danych.
- **KPI (outcome)**: % krytycznych maszyn/stanowisk z automatycznym zbiorem danych; data completeness.
- **KPI (leading)**: liczba źródeł wpiętych / sprint; % eventów z poprawnym timestamp.

### FND-02 — Digital governance & portfolio cadence

- **Kiedy**: niski `digital_strategy` lub `digital_culture`, brak rytuałów decyzji.
- **Cel**: governance transformacji (steerco, priorytety, standardy, architektura).
- **Deliverables**: model decyzyjny, rejestr inicjatyw, kryteria priorytetyzacji, RACI.
- **KPI**: czas decyzji inwestycyjnych, % inicjatyw z business case, % inicjatyw w “on-track”.

### FND-03 — Capability build (roles, skills, change)

- **Kiedy**: niski `digital_culture`, opór, brak ról (OT/IT/data/PO).
- **Cel**: matryca kompetencji + program szkoleniowy + role.
- **Deliverables**: role katalog (data owner, product owner), plan szkoleń, community of practice.
- **KPI**: % ról obsadzonych, % pracowników przeszkolonych, retencja kluczowych ról.

---

## 2) Wzorce inicjatyw per transformacje (T1–T7)

### T1 Advanced Manufacturing Technologies

- **Pattern**: “modernizacja krytycznych stanowisk + UR predykcyjne”
- **Kiedy**: niski `production_tech`, powtarzalne awarie, duże straty OEE.
- **Deliverables**: plan modernizacji, standardy UR, pilot PdM.
- **KPI**: MTBF↑, MTTR↓, OEE↑, koszt UR/rok↓.

### T2 Digital Factory

- **Pattern**: “digital thread shopfloor (MES/SCADA→analytics)”
- **Kiedy**: niski `production_it` i `data_collection`.
- **Deliverables**: minimal MES layer / execution visibility, alarmy, traceability.
- **KPI**: czas reakcji na odchylenie↓, scrap↓, FPY↑.

### T3 ECO Factory

- **Pattern**: “metering + energy per product + optimization loop”
- **Kiedy**: brak pomiaru energii i mediów, ESG reporting manualny.
- **Deliverables**: smart metering, dashboard, scenariusze oszczędności.
- **KPI**: kWh/szt↓, CO2e/szt↓, % automatycznych raportów↑.

### T4 End-to-end Customer Focused Engineering

- **Pattern**: “VOC→requirements→variant mgmt + PLM hygiene”
- **Kiedy**: niski `product_features` lub `product_data`.
- **Deliverables**: spójny BOM/variant mgmt, proces zmian, feedback loop z serwisu.
- **KPI**: time-to-change↓, reklamacje↓, NPI lead time↓.

### T5 Human Centred Organisation

- **Pattern**: “operating model + change system”
- **Kiedy**: niski `digital_culture`, brak rytuałów, chaos projektowy.
- **Deliverables**: operating model, rytuały, komunikacja, incentive alignment.
- **KPI**: adoption↑, % inicjatyw z ownerem↑, eNPS↑.

### T6 Smart Manufacturing

- **Pattern**: “closed-loop quality / scheduling optimization”
- **Kiedy**: niski `data_analytics`, decyzje ręczne, duża zmienność.
- **Deliverables**: modele predykcyjne, rekomendacje, wpięcie w proces decyzyjny.
- **KPI**: plan adherence↑, scrap↓, WIP↓.

### T7 Value Chain Oriented Open Factory

- **Pattern**: “visibility + integration suppliers/customers”
- **Kiedy**: niski `supply_visibility` i `supply_integration`.
- **Deliverables**: EDI/API, tracking, S&OP cadence, supplier collaboration.
- **KPI**: OTIF↑, inventory turns↑, expedite cost↓.

---

## 3) Wzorce “evidence sprint” (gdy brakuje dowodów)

### EVD-01 — Evidence sprint (2–4 tyg.)

- **Kiedy**: wiele wymiarów “unknown / needs evidence”.
- **Cel**: zebrać minimalny zestaw dowodów do score freeze + decyzji o priorytetach.
- **Deliverables**: repo dowodów, mapy systemów, quick audit notes, ustalone score.
- **KPI**: % wymiarów z evidence↑, czas do decyzji↓.

