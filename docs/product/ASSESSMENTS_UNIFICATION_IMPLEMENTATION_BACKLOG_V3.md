# Assessment Workbench Unification — Implementation Backlog v3 (SSOT-ready)

> **Cel:** wdrożyć ujednolicony sposób pracy i prezentacji dla **DRD / SIRI / ADMA** zgodnie z `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`.

## A) Common — Workbench standard (frontend)

### A1. Wspólne “evidence discipline” UI

- **Opis**: ujednolicić komponenty/UX dla evidence (link/attachment + status “needs evidence”).
- **AC**:
  - każdy tool ma spójny blok “Evidence & notes”,
  - status “unknown/needs evidence” jest widoczny w nawigacji,
  - export (report) zawiera listę braków dowodowych.

### A2. Common “chat coach mode” (system prompt + tool bindings)

- **Opis**: dodać tryb rozmowy “Assessment Coach” dla 3 tooli z propose→accept.
- **AC**:
  - agent potrafi przejść etapy: kickoff → scoring loop → consistency → initiatives → export,
  - agent używa tool‑scoped knowledge (toolSlug filter),
  - agent nigdy nie finalizuje score bez akceptacji użytkownika.

### A3. Common “video enablement” (help packs + anchors)

- **Opis**: dopiąć packi `help` tak, aby dało się nagrać filmy instruktażowe.
- **AC**:
  - każdy tool ma `knowledge/tool-kb/<tool>/help/v1/*.md`,
  - w SSOT `*_ASSESSMENT_PACK_V3.md` jest link binding do help pack.

---

## B) ADMA — canon vs runtime + initiatives

### B1. T1–T7 view in exports (report/deck)

- **Opis**: raport/deck ADMA pokazuje tabelę T1–T7 + FoF overlay.
- **AC**:
  - agregacja używa wag z `docs/product/ADMA_ASSESSMENT_PACK_V3.md` §1.4,
  - benchmark FoF jest warstwą porównawczą (nie wpływa na score),
  - export zawiera “Gap to FoF”.

### B2. Initiative generator binding (ADMA)

- **Opis**: generator inicjatyw używa packa `adma/initiatives`.
- **AC**:
  - inicjatywy są grupowane falami (0–6 / 6–18 / 18–36),
  - inicjatywy mają owner role + KPI outcome+leading,
  - jeśli brak dowodów → proponowany “evidence sprint”.

---

## C) SIRI — canon 16D vs runtime 8D

### C1. Jawna agregacja 16→8 (report/deck)

- **Opis**: dodać jawne mapowanie 16D→8D do raportu/decku (lub osobny appendix).
- **AC**:
  - raport pokazuje 8D (workbench) + opcjonalnie 16D (canon),
  - mapowanie jest wersjonowane (SSOT).

### C2. Priorytetyzacja (PM) jako 1-szy output

- **Opis**: ustandaryzować flow: assessment → PM → initiatives.
- **AC**:
  - PM jest widoczna w summary,
  - top 3–6 priorytetów jest eksportowane do raportu.

---

## D) DRD — unifikacja help/qbank + export

### D1. DRD help/qbank PL/EN kompletność

- **Opis**: utrzymać packi PL/EN dla QBank i help.
- **AC**:
  - min. PL jest wymagane; EN opcjonalnie,
  - packi są indexowane do RAG.

