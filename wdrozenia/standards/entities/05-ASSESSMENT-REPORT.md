# ✅ Standard encji: Assessment Report

## Rola w systemie
Assessment Report to **formalny artefakt oceny** (DRD/SIRI/…), który:
- agreguje wyniki, luki (gaps) i evidence w formie zarządczo‑czytelnej,
- jest wymaganym krokiem jakości przed zatwierdzeniem assessmentu,
- jest wejściem do inicjatyw (generowanie) oraz źródłem do raportów zarządczych.

> Assessment Report ≠ management report z modułu Reports.  
> Assessment Report to artefakt *Discovery* (FAZA 1).

## Kontekst (powiązane moduły)
- Assessment (źródło)
- Interview (opcjonalny kontekst wejściowy)
- Initiatives (inicjatywy wygenerowane z assessmentu)
- Decisions (gates + audit)
- Economics (ROI/NPV/IRR/Payback jako plan finansowy)
- Reporting (read-only konsumuje wyniki)
- My Work / Notifications (inbox approval)

---

## Lifecycle (statusy Assessment Report)
Raport ma własny lifecycle, niezależny od samego assessmentu (choć sprzęgnięty bramkami).

- `DRAFT`
  - raport wytworzony/odświeżany w toku pracy,
  - może być regenerowany po zmianach scoringu/importu.
- `IN_REVIEW`
  - wysłany do odbioru jakości (kompletność evidence + spójność wniosków).
- `SENT_BACK`
  - reviewer odsyła do korekty z powodem + checklistą braków.
- `APPROVED`
  - raport zaakceptowany jako snapshot,
  - jest podstawą zatwierdzenia assessmentu oraz generowania inicjatyw.
- `SUPERSEDED` (opcjonalnie)
  - raport zastąpiony nowszą wersją po zmianach w assessment.

### Dozwolone przejścia
```
DRAFT → IN_REVIEW → APPROVED
  ↑        ↓
  └── SENT_BACK
```

---

## Sprzęgnięcie z lifecycle Assessment (kanon)
Assessment (jako encja) ma swój lifecycle (np. `DRAFT → IN_REVIEW → AWAITING_APPROVAL → APPROVED`), ale:

- **Assessment nie może przejść do `APPROVED` bez `Assessment Report = APPROVED`.**
- **Generate initiatives** jest dozwolone dopiero gdy:
  - Assessment = `APPROVED`
  - Assessment Report = `APPROVED`
  - DoD (completion/confidence) spełnione.

---

## Gate decisions (bramki) i egzekucja
Raport i assessment są kontrolowane decyzjami (encja `Decision`):

1) **REQUEST_REVIEW**
- dotyczy assessmentu (przejście do review), inicjowane przez autora/lead.

2) **APPROVE_REPORT**
- przejście reportu: `IN_REVIEW → APPROVED` (lub `SENT_BACK`)
- owner: PMO/Owner wg polityki projektu.

3) **APPROVE_ASSESSMENT**
- zatwierdza assessment po zaakceptowaniu reportu.

4) **GENERATE_INITIATIVES**
- uruchamia generowanie inicjatyw z zatwierdzonego assessmentu.

> **Zasada kanoniczna**: gate ma ownera, due date, audit trail oraz blokuje workflow aż do outcome.

---

## Stałe elementy Assessment Report (minimum)

### 1) Header / Metadata
- organization / project
- framework (DRD/SIRI/… + wersja)
- autorzy (assessment owner, report reviewer)
- status reportu + wersja (np. `v2`)
- daty: created, last updated, approvedAt
- link do assessmentu + link do inicjatyw batch (jeśli wygenerowano)

### 2) Executive Summary (dla Steering/PMO)
- 3–7 kluczowych wniosków (co jest największą luką),
- 3–7 rekomendowanych kierunków działań (nie „task list”, tylko obszary),
- ryzyka/ograniczenia (np. brak danych w wybranych obszarach).

### 3) Scores Overview
- overall score,
- rozbicie per oś/wymiar (tabela + heatmap),
- benchmark (jeśli dostępny) + odchylenia.

### 4) Gaps & Priority Areas
- current vs target,
- top gaps (np. top 5–10),
- priorytetyzacja luk (impact, feasibility, urgency) – przynajmniej heurystycznie.

### 5) Evidence & Data Quality
- źródła evidence (import PDF, odpowiedzi, linki),
- braki danych (data gaps),
- confidence i uzasadnienie (quality notes).

### 6) Interview Context (opcjonalnie)
- syntetyczne „fakty i kontekst” z Interview, jeśli włączone,
- wyraźne odróżnienie faktów od interpretacji.

### 7) Implications / RAID-lite
- risks, assumptions, issues, dependencies istotne dla transformacji.

### 8) Decisions & Audit
- request review / approve report / approve assessment: kto, kiedy, komentarz,
- log wersji i zmian kluczowych.

### 9) Initiatives Generation Summary (jeśli dotyczy)
- metoda priorytetyzacji, count, batchId,
- link do inicjatyw (DRAFT) i mapowanie gaps → initiatives.

### 10) Export
- PDF (min) + ewentualnie „share link”.

---

## Wersjonowanie i niezmienność (kanon)
- `APPROVED` oznacza snapshot:
  - zmiany w scoringu / imporcie po approval wymagają nowej wersji reportu,
  - stara wersja zostaje w historii (audit).
- `SUPERSEDED` dla wersji zastąpionych (opcjonalnie).

---

## UI/UX – gdzie i jak pokazywać Assessment Report
### Assessment (główne)
- zakładka „Report” w module hub:
  - `DRAFT`: generate/refresh + podgląd,
  - `IN_REVIEW`: komentarze review + checklisty,
  - `SENT_BACK`: lista braków + linki do miejsc w assessment,
  - `APPROVED`: read-only report + przycisk approval assessment (jeśli jeszcze nie zatwierdzony).

### My Work
- „Assessment reports awaiting approval” (dla reviewerów),
- „Assessment report sent back” (dla autora).

### Reporting (zarządcze)
- sekcja „Discovery evidence / Assessments” – link do reportu i wyników.

---

## Powiadomienia (kanon)
- report submitted → reviewer,
- sent back → autor,
- report approved → PMO/Owner + osoby śledzące,
- assessment approved → PMO/Steering (wg polityki),
- initiatives generated → autor + PMO + sponsor/owner.

---

## Testy / DoD (Assessment Report)
- min. 1 test E2E: assessment scored → report submitted → sent back → resubmit → report approved → assessment approved → initiatives generated
- walidacje backend: RBAC + blokady workflow + audit trail.

