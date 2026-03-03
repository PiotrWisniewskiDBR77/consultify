# Plan wdrożenia — moduł Tools (V2/V3)

> **Status:** kanoniczny plan wdrożeniowy (rekonstrukcja na podstawie istniejących speców w repo).  
> **Cel:** dostarczyć brakujący artefakt wskazywany w `wdrozenia/pakiet-wdrozeniowy.md`, tak aby dokumentacja wdrożenia była kompletna i weryfikowalna.

## 1) Źródła prawdy (w repo)

- **UI/UX + Hub**: `wdrozenia/modules/tools/frontend/01-hub-structure.md`
- **Backend API**:
  - lista endpointów: `wdrozenia/modules/tools/backend/01-api-list.md`
  - request review: `wdrozenia/modules/tools/backend/01-request-review.md`
  - approve: `wdrozenia/modules/tools/backend/02-approve.md`
  - generate initiatives: `wdrozenia/modules/tools/backend/03-generate-initiatives.md`
- **Testy**: `wdrozenia/modules/tools/testing/01-unit-tests.md`
- **SSOT V3 (kryteria)**:
  - `docs/product/TOOLS_CATALOG_V3.md`
  - `docs/product/V3_MODULE_VERIFICATION_MATRIX.md`
  - `docs/product/DOD_INVENTORY_V2_V3.md` (V3‑E01, V3‑E02, V3‑E03)

## 2) Zakres wdrożenia (co oznacza “Tools done”)

### 2.1 Workflow (core)

- Tool session lifecycle: **DRAFT → REVIEW → APPROVED → GENERATED**
- DoD gating przed review/approve/generate:
  - `completion_percent >= 100`
  - `confidence_avg >= 3`
- Decyzje i audyt:
  - zapis decision records (`decisions`) oraz `tool_decisions`
  - audit log eventy dla request-review/approve/send-back/generate

### 2.2 UI/UX (hub + workspace)

- **Jeden punkt wejścia “Tools”** (V3‑E01) z mental modelem:
  - **Library → Sessions → Outputs → Initiatives**
- Hub zgodny z ModuleHub standard (kanoniczne kontrolki: tabs, status filter, search, view modes).
- Workspace:
  - edycja sesji narzędzia
  - review panel + approve/send-back (role/permissions)
  - generate initiatives modal po approve

### 2.3 Outputs (V3)

- W Tools → Outputs widać **realne artefakty output** (min. report/deck) a nie tylko “APPROVED tool session” (V3‑E02).
- Output ma traceability `source_type/source_id` i akcję “Open source”.

## 3) Minimalne kryteria akceptacji (DoD)

### 3.1 Backend (API)

- CRUD sesji działa i ma tenant isolation.
- Request review blokuje brak DoD.
- Approve blokuje brak uprawnień i zły status.
- Generate initiatives:
  - blokada jeśli brak APPROVED
  - limit `count <= 7`
  - tworzy `tool_initiative_links` i batch

### 3.2 Frontend

- Hub działa bez “dead ends”:
  - tworzenie/otwieranie sesji
  - preview + open full
  - statusy i filtry spójne
- i18n: PL+EN dla copy w nowych ekranach modułu.
- locked/read-only: powierzchnie respektują blokady po APPROVED/GENERATED.

### 3.3 Testy

- Unit/Integration/E2E zgodnie z `wdrozenia/modules/tools/testing/01-unit-tests.md` (minimum: end‑to‑end Tools → Initiatives).

## 4) Backlog (jeśli wykryto luki w implementacji vs SSOT V3)

> Ten plan jest “żywy”: luki i taski domknięcia zapisujemy w `docs/product/V3_MODULE_VERIFICATION_MATRIX.md` oraz w backlogu eng.

- V3‑E02: Tools → Outputs jako realne artefakty (report/deck) + dynamic tabs open.
- i18n sweep dla Tools hub.

