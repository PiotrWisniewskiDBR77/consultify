# IRIS — Granice Produktu (Out-of-scope)

Data: 2026-03-03  
Wersja: 1.0  
Cel: jasno określić, czym IRIS nie jest i czego nie robi, aby chronić projekt przed nierealnymi oczekiwaniami.

---

## 1) IRIS nie jest systemem sterowania maszynami (OT Control)

IRIS **nie**:

- steruje PLC/SCADA w czasie rzeczywistym,
- nie zastępuje DCS/SCADA/HMI,
- nie jest warstwą safety/instrumented system (SIS),
- nie odpowiada za funkcje krytyczne dla bezpieczeństwa maszyn.

IRIS **może** integrować się z systemami OT na poziomie danych i zdarzeń (IoT ingest, alerty, metryki), ale **nie przejmuje roli sterowania**.

---

## 2) IRIS nie “wdraża fizycznie” automatyzacji/robotów

IRIS **nie**:

- nie projektuje i nie instaluje robotów/automatyki,
- nie realizuje fizycznych modernizacji linii,
- nie zastępuje integratora automatyki.

IRIS **wspiera** decyzje i egzekucję (inicjatywy, zadania, KPI), ale realizacja fizyczna jest po stronie klienta i/lub jego dostawców.

---

## 3) IRIS nie zastępuje ERP (i nie jest pełnym systemem finansowo-księgowym)

IRIS **nie**:

- nie jest księgowością, systemem faktur i podatków,
- nie zastępuje ERP w obszarze finansów, zakupów czy pełnego MDM,
- nie przejmuje polityk controllingu i rozliczeń kosztów.

IRIS może dostarczać dane operacyjne do ERP/BI lub pobierać dane z ERP (integracje kontraktowe), ale nie jest “ERP killer”.

---

## 4) IRIS nie jest “narzędziem BI tylko do raportów”

IRIS **nie** powstał po to, żeby generować wyłącznie raporty i dashboardy.

Wartość IRIS polega na zamknięciu pętli:

- dane → rekomendacje → inicjatywy → zadania (SLA) → KPI → decyzje → iteracja.

---

## 5) IRIS nie zastępuje fizycznego BHP i działań compliance “w terenie”

IRIS **nie**:

- nie przeprowadza fizycznych kontroli BHP,
- nie zastępuje inspektora BHP ani działań terenowych,
- nie bierze odpowiedzialności za bezpieczeństwo operacyjne w zakładzie.

IRIS może wspierać procesy (zadania, audyt, checklisty, raporty), ale nie zastąpi obowiązków prawnych i fizycznych.

---

## 6) IRIS nie gwarantuje efektu biznesowego “bez klienta”

IRIS **nie** jest usługą “zróbcie to za nas”.

Warunkiem efektu jest:

- zaangażowanie ownerów procesów,
- wykonanie zadań i decyzji,
- dostarczenie i walidacja danych po stronie klienta.

IRIS i DBR77 dostarczają narzędzie, metodę oraz wsparcie, ale **nie mogą zastąpić operacji klienta**.

---

## 7) IRIS nie jest narzędziem do wszystkiego naraz

IRIS ma moduły i roadmapę, ale wdrożenie powinno być etapowe:

- start od 1–2 procesów krytycznych,
- dopiero potem rozszerzenie (kolejne moduły, integracje, AI).

Próba wdrożenia “pełnego enterprise” bez priorytetów zwykle kończy się over-scope.

---

## 8) Typowe “out-of-scope” (lista)

Poniższe obszary są poza standardowym zakresem produktu (chyba że osobno uzgodnione):

- pełne wdrożenie i utrzymanie infrastruktury klienta (On-Prem) bez udziału klienta,
- pełny re-engineering procesów w całej organizacji (program transformacji bez governance),
- custom development “na zamówienie” bez zgodności z kontraktami i standardami IRIS,
- pełna integracja ze wszystkimi systemami (ERP/SCADA/WMS/MES) jako warunek startu,
- manualna weryfikacja danych przez DBR77 jako stała usługa (data stewarding jako outsourcing).

