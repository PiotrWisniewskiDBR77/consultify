# Initiatives v3 — InitiativeLevel, Templates, Completeness & Gates (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** zdefiniować kanoniczną filozofię PMO dla inicjatyw:  
> - jak InitiativeLevel mapuje się na template,  
> - jakie sekcje i pola są widoczne/wymagane na danym etapie,  
> - jak działa completeness + gate readiness,  
> - jak bezpiecznie “rosną” inicjatywy (upgrade template / dołożenie sekcji) bez chaosu.

## 0) Powiązane SSOT (MUST)

- N‑mode management (templates + completeness + AI): `docs/product/NMODE_MANAGEMENT_V3.md`
- Gate DoD (normatywne): `docs/product/GATE_DEFINITION_OF_DONE.md`
- Traceability sources: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- UI canon:
  - Presentation modes: `docs/ui-standards/01-shell-layout/presentation-modes.md`
  - Artifact shell: `docs/ui-standards/01-shell-layout/artifact-shell-future-standard.md`
  - Initiative sections canon: `docs/ui-standards/02-components/initiative-sections.md`
- Implementation (as‑is): Initiative templates system doc: `wdrozenia/modules/initiatives/initiative-templates-system.md`

---

## 1) PMO philosophy (intent)

Initiative w Consultinity to nie “ładna karta”, tylko **jednostka zarządzania projektem**:

- ma charter (po co / co zmieniamy),
- ma governance (kto decyduje),
- ma plan (tasks/milestones/timeline),
- ma ryzyka (RAID),
- ma mierniki (KPI) i tracking wartości (Results),
- przechodzi przez gates, które są **systemowo egzekwowane**.

Kluczowa zasada: **poziom złożoności inicjatywy rośnie wraz z ryzykiem i wagą**, a nie od startu.

---

## 2) InitiativeLevel = template-driven “garnitur” (MUST)

### 2.1 Definicja

**InitiativeLevel** to wybór “garnituru” dla inicjatywy: zestawu sekcji, pól, gate’ów i wymagań jakości.

W v3 InitiativeLevel jest realizowany przez **Initiative Template Level** (as‑is):

- `quick_win`
- `standard`
- `enterprise`
- `full_charter`

> W UI możemy mówić “mała vs duża” (skrót), ale w danych to musi być stabilny enum poziomu.

### 2.2 Mapowanie (kanon)

| InitiativeLevel | Po co | Governance | Konsekwencja |
|---|---|---|---|
| **quick_win** | szybka inicjatywa / pomysł do wdrożenia | minimalna | mało sekcji, mało required, brak ciężkich gate’ów |
| **standard** | normalny projekt operacyjny | standard approval | dochodzą RAID/milestones/impact; required rośnie |
| **enterprise** | strategiczna transformacja | pełne gates + RACI | decyzje, gates, zależności, zasoby, readiness |
| **full_charter** | case inwestycyjny | steering committee | KPI+finanse+benefits tracking jako obowiązek |

---

## 3) Sekcje: widoczność i porównywalność (MUST)

### 3.1 Kanoniczny katalog sekcji

Kanon kolejności i semantyki Initiative N‑mode jest w `docs/ui-standards/02-components/initiative-sections.md`.

### 3.2 Widoczność sekcji per level (garnitur)

Template definiuje `visibleSections` (mapa). W skrócie:

- **quick_win**: max ~3–6 sekcji “dowiezieniowych” (plan + owner + minimal charter)
- **standard**: ~10–12 sekcji (problem/target/scope + RAID + milestones + impact)
- **enterprise**: ~16–18 sekcji (governance + decisions + gates + dependencies + resources)
- **full_charter**: 20+ sekcji (investment case + KPI/benefits + pełny readiness)

**MUST:** użytkownik zawsze widzi, “co jest w garniturze”, a brakujące elementy są widoczne jako missing items.

---

## 4) Required fields/sections per etap + gates (MUST)

### 4.1 Źródła reguł required

Required items wynikają z 3 warstw:

1) **Gate DoD** (normatywne): `GATE_DEFINITION_OF_DONE.md`  
2) **Template**: `requiredFields`, `validationRules`, `gateConfig`  
3) **Kontekst**: status, role, source type (tool/assessment/manual)

### 4.2 Minimalny kontrakt per gate (v3)

Poniżej nie jest komplet polityki gates (SSOT jest w `GATE_DEFINITION_OF_DONE.md`), tylko *jak to mapujemy na UI completeness*.

**Przykład (krytyczne):**

- `DRAFT → PENDING_REVIEW`:
  - source traceability istnieje
  - minimum: title + summary/problem statement
  - quick_win może to przejść bez pełnych analiz
- `REVIEW → PROMOTED` (Go/No‑Go):
  - musi być owner + sensowny charter + ryzyka/unknowns (w zależności od level)
- `PLANNING/SCHEDULED/EXECUTING`:
  - rośnie wymaganie: plan/timeline/milestones/resources/decisions
- `START_TRACKING`:
  - KPI/ROI readiness (Results contract) — szczególnie dla wyższych leveli

**MUST:** gate readiness jest liczony przez backend i blokuje akcje statusu, jeśli missing items są krytyczne.

---

## 5) Completeness pill (MUST)

UI zawsze pokazuje:

- `completeness_score` (0–100)
- `missing_items[]` (lista braków)
- `gate_readiness` (ready/blocked/warning)

Zasady:

- brak = nie jest “czerwony border”, tylko jawna checklista braków,
- klik w missing item przenosi do sekcji/pola,
- locked user widzi braki, ale nie może edytować (prosi ownera).

SSOT: `NMODE_MANAGEMENT_V3.md` + `V3-K01`.

---

## 6) Upgrade level / dołożenie sekcji w trakcie pracy (MUST)

To domyka Twój scenariusz: “na etapie zatwierdzania okazuje się, że trzeba finansów”.

### 6.1 Upgrade template (primary path)

Jeśli inicjatywa rośnie:

`quick_win → standard → enterprise → full_charter`

Zmiana level:

- dodaje sekcje do left nav,
- podbija required/completeness,
- zmienia gate readiness (więcej wymagań).

### 6.2 Enable section override (secondary path)

Jeśli potrzebujemy 1 sekcji bez pełnego upgrade:

- UI pozwala włączyć sekcję jako “override” na tej inicjatywie,
- override jest jawny i audytowalny (nie zmienia globalnego template’u),
- required/completeness może uwzględnić tę sekcję, jeśli gate policy tego wymaga.

**Zasada PMO:** upgrade jest preferowany, override jest wyjątkiem (żeby nie tworzyć “śnieżynek”).

---

## 7) KPI per level i powiązanie z Results (MUST)

Poziom inicjatywy wpływa na obowiązek KPI/ROI:

- quick_win: KPI opcjonalne lub minimalne (1 KPI) — zależnie od polityki org
- standard: KPI zwykle wymagane przed tracking
- enterprise/full_charter: KPI + financial/benefits tracking jest **obowiązkowe** (wymuszone przez required/gates)

**Kanon:** KPI z inicjatywy agregują się do Results (SSOT: Results tasks w programie).

---

## 8) AI assist w inicjatywie (propose→accept)

AI może:

- proponować uzupełnienia braków (charter, risks, KPI suggestions, milestones draft),
- wskazywać missing items i linkować do sekcji,
- nigdy nie zmienia statusu/gate (nie aprobuje).

---

## 9) Task extraction (dla V3‑F01)

Z tego SSOT bezpośrednio wynikają taski:

1) **Level pill + template binding**: inicjatywa ma level; level steruje `visibleSections`
2) **Required/completeness per status** (minimal R0): missing list + completeness pill
3) **Gate readiness**: blokuje krytyczne status actions (z jasnym komunikatem)
4) **Upgrade level / enable section**: standardowy sposób dołożenia sekcji w trakcie pracy
5) **PMO baseline**: sekcje i pola są spójne z PMO logiką (charter→plan→governance→tracking)

