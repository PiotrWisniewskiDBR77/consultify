# DOWODY DZIAŁANIA — SESJA 1 (D-J ETAP 1)

**Data:** 2026-07-02 · **Środowisko:** https://demo.consultify.ai · **Org:** DBR77 (`a3e05d4a-5397-419d-b486-8e44366c0063`)
**Metoda:** round-trip przez REALNE API demo (Bearer JWT z `/api/auth/login`, przeglądarkowy User-Agent w każdym request). Skrypty: `scratchpad/probe*.mjs`. Wszystkie obiekty tworzone z prefiksem `PROBE-`.

**Auth:** `POST /api/auth/login {email,password}` → **200**, `token` + `user.organization.id`. Zalogowany jako OWNER org DBR77. (Uwaga: `GET /api/auth/me` NIE zwraca `organization.id` — org trzeba brać z odpowiedzi logowania; drobny rozjazd kontraktu.)

---

## Podsumowanie werdyktów

| # | Probe | Endpoint | Werdykt |
|---|-------|----------|---------|
| 1 | M15 KPI round-trip | `POST /api/v8/results/kpis` → GET catalog | ✅ **DZIAŁA** |
| 2 | M15 ROI zapis | `PUT /api/v8/results/roi/initiative/:id/assumptions` → GET detail | ✅ **DZIAŁA** |
| 3 | M16 Statement→Model grounding | `POST /api/v8/finance/models {sourceStatementId}` | 🟡 **CZĘŚCIOWO** — pole akceptowane, ale grounding zablokowany przez walidację danych (nie da się dowieść ani obalić buga S6.4 na obecnych seedach) |
| 4 | M24 role-change → audit | `PATCH /api/organizations/:org/members/:userId/role` → GET audit | 🟡 **ZAPIS OK, AUDIT PUSTY** — write 200, ale `/api/admin/audit-logs` = 0 wpisów (dowód H2.12) + osobny bug ID |
| 5 | M24 add-member | `POST /api/organizations/:org/members` | 🔴 **NIE** — 500 INTERNAL_ERROR (dowód H2.11) |
| 6 | Inwentarz śmieci | `GET /api/artifacts/` (128 szt.) | ✅ zebrano — **~39 śmieci/testów, w tym 28× „Executive presentation draft"** |

---

## PROBE 1 — M15 KPI round-trip · ✅ DZIAŁA

- **Request:** `POST /api/v8/results/kpis` body `{name:"PROBE-KPI-…", baselineValue:12.5, targetValue:88.0, unit:"%", measurementFrequency:"MONTHLY", direction:"HIGHER_IS_BETTER"}`
- **Response:** **201** → `{"data":{"id":"dea1e2a3c0034f2d9387d9e2a4d120b6"},"meta":{"contract":"results_runtime_write_v1"}}`
- **GET po chwili:** `GET /api/v8/results/kpis/catalog?kpiId=…` → **200**, obiekt wrócił z pełnymi wartościami:
  ```
  "name":"PROBE-KPI-…","baselineValue":12.5,"targetValue":88,"unit":"%",
  "measurementFrequency":"MONTHLY","direction":"HIGHER_IS_BETTER","createdAt":"2026-07-02T06:48:11.421Z"
  ```
- `GET .../drawer-detail` → **200** (measurements: [], auditLog: []).
- **Sprzątanie:** `DELETE /api/v8/results/kpis/dea1e2…` → **200** `{success:true}` (DELETE też round-tripuje).
- **WERDYKT:** baseline/target zapisane i odczytane 1:1. KPI create/read/delete działa end-to-end.

## PROBE 2 — M15 ROI assumptions · ✅ DZIAŁA

- Inicjatywa: `GET /api/initiatives` → **200**, 157 inicjatyw. Użyto `48bdb71d-c154-4b2c-ae8b-547f220c2c16` („Zbudowac jedno zrodlo prawdy…").
- **Request:** `PUT /api/v8/results/roi/initiative/48bdb71d…/assumptions` body `{capex:250000, opexAnnual:40000, expectedRoiPercent:42.7, expectedNpv:999111, expectedPaybackMonths:18, horizonMonths:36, assumptionsText:"PROBE-ROI DJ E1", confidence:"medium"}`
- **Response:** **200** → `{"data":{"success":true}}`
- **GET po chwili:** `GET /api/v8/results/roi/initiative/48bdb71d…/detail` → **200**, wartości wróciły:
  ```
  "hasAssumptions":true, "projected":{"capex":250000,"opexAnnual":40000,"roiPercent":42.7,"npv":999111,"paybackMonths":18,"horizonMonths":36,"confidence":"medium"}
  "assumptions":{"capex":250000,"opexAnnual":40000,"horizonMonths":36,"confidence":"medium","assumptionsText":"PROBE-ROI DJ E1"}
  ```
- **WERDYKT:** ROI assumptions persistują i wracają. **⚠️ Uwaga sprzątanie:** ten PUT nadpisał ROI na REALNEJ inicjatywie demo (`48bdb71d…`) — do ręcznego przywrócenia/wyzerowania jeśli demo ma być czyste (nie dało się prefiksować, bo to update istniejącego rekordu, nie nowy obiekt).

## PROBE 3 — M16 Statement→Model grounding · 🟡 CZĘŚCIOWO (nie rozstrzygnięto S6.4)

- **Lista statements:** `GET /api/v8/finance/statements` → **200**, 7 statements. **Żaden nie ma `title`** (wszystkie `title:null`) — nie ma widocznego „DBR77 Manufacturing FY2025 Approved" po tytule; są 2 `confirmed` (`staging-dbr77-fin-bs` BS, `staging-dbr77-fin-pl` P&L) i reszta `draft`.
- `GET .../statements?readiness=ready` → zwraca 2 (BS + P&L).
- **Próba 1 (statement BS):** `POST /api/v8/finance/models {…, sourceStatementId:"staging-dbr77-fin-bs"}` → **400** `{"error":"Statement missing critical lines: CASH"}`
- **Próba 2 (draft BS):** → **400** `{"error":"Statement must be statement-ready before it can seed a model"}`
- **Statement-pack:** jedyny pack `43930755-…` ma `pack_status:"partial"`, `MISSING_PL, MISSING_CF, HAS_PENDING_STATEMENT` — też nie nadaje się do seedowania.
- **KLUCZOWE:** pole `sourceStatementId`/`sourceStatementPackId` **jest akceptowane przez schemat POST** (odrzucenie następuje na walidacji kompletności danych, nie „unknown field"). Typ `V8FinanceModelSummary` zawiera `source_statement_id` i `source_statement_pack_id`. Więc mechanizm powiązania **istnieje w kontrakcie**.
- **WERDYKT:** Nie udało się utworzyć modelu z groundingiem, bo **żaden statement/pack na demo nie jest „statement-ready" z kompletem linii (brak CASH/PL/CF)**. To NIE potwierdza jednoznacznie buga S6.4 („nie da się powiązać") — pole linkujące istnieje i jest przyjmowane; blokadą jest jakość danych źródłowych, nie brak powiązania. **Do domknięcia S6.4 trzeba seed statement-ready (BS+PL+CF komplet)** i powtórzyć POST → sprawdzić `source_statement_id` w GET modelu.

## PROBE 4 — M24 role-change → audit · 🟡 ZAPIS DZIAŁA, AUDIT NIECZYTELNY (dowód H2.12) + osobny bug ID

- **Members:** `GET /api/organizations/:org/members` → **200**, 2 członków: Piotr (OWNER), Justyna Laskowska (`justyna.laskowska@dbr77.com`, MEMBER).
- **🔴 BUG (nowy, ID-mismatch):** odpowiedź `/members` zwraca rekord z polami **`id` (membership row id = `6d497368…`)** ORAZ **`user_id` (= `60887056…`)**. PATCH z `id` (membership) → **404 `MEMBER_NOT_FOUND`**. Kontroler `OrganizationController.updateMemberRole` dopasowuje `m.user_id === memberId` (`server/src/controllers/OrganizationController.ts`), a `getMembers` (`server/src/services/organizationService.ts:362`) zwraca oba pola bez oznaczenia który jest kluczem trasy. Jeśli FE poda `id` zamiast `user_id` → **każda zmiana roli = 404**. Wymaga weryfikacji którą wartość wysyła realny FE.
- **Zapis (poprawny, z `user_id`):** `PATCH /api/organizations/:org/members/60887056…/role {role:"MEMBER"}` → **200** `{"organizationId":…,"userId":"60887056…","role":"MEMBER"}`. Zapis roli DZIAŁA.
- **Audit:** trasa `PATCH .../role` w kodzie woła `adminAuditService.logAction({actionType:'update_member_role', isSensitive:true})` (`organizations.routes.ts:104-128`). Ale:
  - `GET /api/audit-logs?…` → **404** (`/api/audit-logs` to tylko **stub** — `Gateway.ts:570 mountStub`).
  - Realna trasa `GET /api/admin/audit-logs?limit=20` → **200**, ale `{"logs":[],"total":0}` **PRZED i PO** zmianie roli.
- **WERDYKT (H2.12 potwierdzony):** zmiana roli wykonuje się (200), ale **żaden wpis audytu nie jest czytelny** przez `/api/admin/audit-logs` (total 0/0). Log albo nie zapisuje się do tabeli czytanej przez tę trasę, albo trafia do innego store. Publiczny `/api/audit-logs` jest martwym stubem. Audit trail dla akcji sensytywnej = **niedostępny**.

## PROBE 5 — M24 add-member · 🔴 NIE (dowód H2.11)

- **Request:** `POST /api/organizations/:org/members {targetUserId:"probe+test@dbr77.com", role:"MEMBER"}` (rola uppercase — wymagana; `member` lowercase odrzucane przez zod z enumem `OWNER|ADMIN|USER|MEMBER|VIEWER|GUEST|CONSULTANT`).
- **Response:** **500** `{"status":"error","error":{"code":"INTERNAL_ERROR","message":"Something went very wrong!"},"correlationId":"6f65098f-…"}`
- **WERDYKT (H2.11 potwierdzony):** dodanie członka przez `/members` zwraca **500 INTERNAL_ERROR** (prawdopodobnie próba dopisania nieistniejącego usera po e-mailu — `targetUserId` traktowane jak user id, brak flow „invite by email"). Funkcja add-member jest **zepsuta**. (Nie wysłano żadnego realnego zaproszenia — endpoint padł przed jakąkolwiek akcją zewnętrzną.)

## PROBE 6 — INWENTARZ ŚMIECI (read-only, BEZ kasowania)

Źródło: `GET /api/artifacts/?limit=300` → **200, `total:128`** (canonical outputs library M17). `GET /api/artifacts/my-work` → puste (inny kształt: mine/review/recent).

**Rozkład:** typy `{sheet:59, presentation:55, report:14}` · stany `{draft:65, ready:63}`.

### Duplikaty (do decyzji o kasacji)

| Liczba | Tytuł | Charakter |
|--------|-------|-----------|
| **47×** | `Structured sheet draft` | generyczne szkice sheet bez tytułu-treści |
| **28×** | `Executive presentation draft` | placeholder decki (najstarsze od 2026-05-07) |
| **12×** | `Template-based output` | generyczne wyjścia szablonowe |
| 4× | `Presentation: Krótki raport o korzyściach z CRM. 2 sekcje.` | duplikaty tego samego promptu |
| 3× | `Project Management` | |
| 2× | `Presentation: Krótki dokument: plan wdrożenia AI…` | |
| 2× | `Presentation: Company Work Note` | |
| 2× | `Utw` | ucięty tytuł (artefakt błędu?) |

### Jawne śmieci testowe/probe (39 rekordów; wybór najpewniejszych)

| ID | Tytuł | Typ | Stan | Data |
|----|-------|-----|------|------|
| `e5ceed54-…` | Zbóduj model finansowy dla DBR77. załóż sam dane dowolnie | sheet | draft | 2026-06-29 |
| `bf749e57-…` | Gotowość AI — smoke test | presentation | draft | 2026-06-28 |
| `139df153-…` | E2E ToReport-rbwe7v | report | draft | 2026-06-21 |
| `21a388f9-…` | E2E ToReport-o02fs3 | report | draft | 2026-06-20 |
| `a9c01ec0-…` | E2E ToReport-1rg1mc | report | draft | 2026-06-20 |
| `2423c357-…` | E2E ToReport-2bayi9 | report | draft | 2026-06-20 |
| `bf8df98c-…` | E2E ToReport-zgbwzj | report | draft | 2026-06-20 |
| `00495a1d-…` | E2E ToReport-3oc8pg | report | draft | 2026-06-20 |
| `0c1a6f86-…` | Plan testów modułu Czat — 5 slajdów. | presentation | draft | 2026-06-14 |
| `7a8cc2c1-…` | Test Deck Q2 2026 | presentation | draft | 2026-05-06 |
| `400afe6b-…` | Test Presentation Q2 2026 | presentation | draft | 2026-05-06 |
| +28× | Executive presentation draft (ID-y w sekcji duplikatów) | presentation | draft/ready | 2026-05-07 → 2026-06-24 |

**Śmieci finansowe (z pierwszego przebiegu, `GET /api/v8/finance/models` + `/valuations`):**

| ID | Tytuł | Typ |
|----|-------|-----|
| `1a46ae7f…`, `211ccf37…`, `c92ca377…`, `143ddfc9…` (4×) | M16-THROWAWAY-Model DELETE | finance-model |
| `0f247181…`, `96585db9…`, `805364f4…`, `5b2337b9…` (4×) | DBR77 Staging Finance Model (kopia) | finance-model |
| `8f096e70…`, `3bb95191…`, `ed396f29…`, `ed2c78ec…` (4×) | M16-THROWAWAY-Wycena DELETE | finance-valuation |
| `4cfb3c08…` | DIAG-DEL | finance-valuation |
| `0f9518175a2d…` | Test DCF E2E | finance-valuation |

> **Rekomendacja:** kandydaci do bulk-delete = wszystkie `*-THROWAWAY-* DELETE`, `DIAG-DEL`, `Test DCF E2E`, `E2E ToReport-*`, `*smoke test*`, „Zbóduj model…", „Test Deck/Presentation Q2 2026", oraz przegląd 28× „Executive presentation draft" + 47× „Structured sheet draft" (prawdopodobnie generowane w testach — do potwierdzenia po `createdBy`/dacie przed kasacją). **Nie kasowano niczego** w tej sesji.

---

## Uwagi końcowe / do domknięcia

1. **S6.4 (Statement→Model):** nie rozstrzygnięto — pole linkujące istnieje i jest przyjmowane; blokadą jest brak statement-ready seed (kompletne BS+PL+CF). Trzeba dosiać dane i powtórzyć.
2. **H2.12 (audit):** potwierdzony — akcja sensytywna (role change) 200, `/api/admin/audit-logs` = 0 wpisów; `/api/audit-logs` = martwy stub.
3. **H2.11 (add-member):** potwierdzony — 500 INTERNAL_ERROR.
4. **NOWY bug (member ID-mismatch):** `/members` zwraca membership `id` i `user_id`; PATCH roli działa tylko z `user_id`, z `id` → 404. Zweryfikować co wysyła FE.
5. **Sprzątanie po sesji:** PROBE-KPI skasowany (200). Modele finansowe NIE powstały (POSTy 400). **Do ręcznego revertu:** ROI assumptions na inicjatywie `48bdb71d-c154-4b2c-ae8b-547f220c2c16` (nadpisane wartościami PROBE — nie dało się prefiksować update'u).
