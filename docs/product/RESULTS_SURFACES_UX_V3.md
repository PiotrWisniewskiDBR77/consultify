# Rezultaty v3 — UX surfaces, filtry, drill‑down, trendy (V3‑H03) (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** opisać UX modułu **Rezultaty** w R1: spójne surfaces, filtry, segmentacja, trendy i drill‑down do inicjatyw.  
> Bez zmiany sensu R0: R1 to “lepsza nawigacja + trendy + segmentacja”, nie przebudowa danych.

## 0) Powiązane SSOT (MUST)

- Results core (KPI + ROI mental model): `docs/product/RESULTS_V3.md`
- ROI tracking contract: `docs/product/ROI_TRACKING_CONTRACT_V3.md`
- UI:
  - App Table Standard: `docs/ui-standards/03-modules/app-table-standard.md`
  - Module Hub standard: `docs/ui-standards/03-modules/module-hub-standard.md`
- Initiatives templates/completeness:
  - `docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md`
  - `docs/product/NMODE_MANAGEMENT_V3.md`

---

## 1) Navigation: 3 zakładki (Twoja intencja “3 przyciski”)

W Rezultatach w hubie są 3 taby:

1) **Mierniki (KPI)** — tabela KPI + detail KPI (time‑series)
2) **Raporty KPI** — tabela raportów + detail raportu + plany naprawcze
3) **ROI** — tabela analiz ROI + detail ROI (plan vs realized + historia)

Jednocześnie w narracji produktu trzymamy 2 “surfaces”:

- **Operational** = (Mierniki + Raporty KPI)  
- **ROI** = ROI

---

## 2) Wspólne filtry (MUST)

Wszystkie 3 taby używają tego samego zestawu filtrów (tam gdzie ma sens):

- `Project`
- `Owner`
- `InitiativeLevel`
- `InitiativeStatus` (dla rekordów powiązanych z inicjatywami)
- `Period` (month/quarter) — wpływa na trendy i “needs entry”
- `Search`

**MUST:** filtry są spójne w top barze zgodnie z `app-table-standard.md`.

---

## 3) Operational (KPI) — trendy + segmentacja (R1)

### 3.1 Trend resolution (default)

Default: **monthly** (bo w większości organizacji KPI są raportowane co miesiąc).  
Jeśli KPI ma `frequency=QUARTERLY`, UI agreguje i pokazuje kwartały.

### 3.2 Drill‑down (kanon)

Z KPI user może wejść w 2 kierunki:

- **Open KPI** → KPI detail (historia, wpisy, trend)
- **Contributing initiatives** → lista inicjatyw z mappingu KPI↔initiative → “Open initiative”

**MUST:** oba kierunki są dostępne (bo raz user chce edytować dane KPI, a raz zrozumieć “kto dowozi”).

### 3.3 Segmentacja (R1)

R1 ma minimum:

- “Below target” (filtr)
- sort po największym odchyleniu (delta do target)
- “Needs entry” (brak wpisu za ostatni okres wg cadence)

---

## 4) KPI Reports — “niedowiezione” → przyczyny + plan naprawczy (R1)

Raport KPI to snapshot okresu + komentarz + (opcjonalnie) plan naprawczy.

R1 minimum:

- user tworzy raport i wybiera KPI
- dla KPI `below_target` w raporcie pojawia się sekcja:
  - **Dlaczego nie dowiezione?** (structured)
  - **Plan naprawczy** (lista działań, owner, termin)
- raport linkuje do inicjatyw (przez KPI mapping)

**MUST:** dla metryk (KPI) “post factum” jeszcze można działać — raporty mają prowadzić do napraw.

---

## 5) ROI — odchylenia plan vs realized + statusy (R1)

R1 w ROI to:

- tabela analiz ROI z filtrami
- widok detail: plan vs realized + historia wpisów
- ranking inicjatyw z największym odchyleniem (delta)

Tu “plan naprawczy” jest opcjonalny (często to już rozliczenie), ale nadal:

- można dodać komentarz “co poszło nie tak”
- można linkować do decyzji/wniosków (governance)

---

## 6) AI insights (opcjonalnie, ale bez wpływu na “prawdę”)

AI może proponować:

- “insights” (anomalie, skoki, brak danych),
- sugestie pytań do ownera,
- draft tekstu do raportu.

**MUST:** AI nie zmienia danych KPI/ROI, nie tworzy issue detection i nie “zamyka” tematów.

---

## 7) DoD — V3‑H03 (R1/P1)

- Rezultaty mają 3 taby: KPI / KPI Reports / ROI.
- Wspólne filtry działają identycznie, a drill‑down prowadzi do KPI/ROI detail i/lub inicjatyw.
- Są trendy (minimum: wykres + lista wpisów) i segmentacja (below target / needs entry / największe odchylenia).

