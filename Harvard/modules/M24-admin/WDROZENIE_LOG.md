# M24 — Panel Administratora — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | **FAZA 4-deep API (Fala 17)** | S1/S2/S3/S4 — admin API scenarios | `a26c119d7a` | **S1 GET /admin/people PASS** (57 members, typy OK). **S1 GET /admin/overview PASS**. **S2 GET /admin/iam/policy PASS** (booleans poprawne). **S2 GET /admin/iam/assignments PASS**. **S3 GET /admin/security/collaboration/billing PASS**. **Wszystkie GETs 200 PASS — brak bigint issues** (flagOn() używany poprawnie, is_active=INTEGER OK). **WRITE 500 → BUG-M24-01 KRYTYCZNY**: `adminAuditService.logAction()` INSERT zawierał `risk_level` — kolumna nie istnieje w `admin_audit_logs` schema (PG 42703) → **blokowało 18 write-endpointów** (PUT /security, PUT /iam/policy, PUT /collaboration, POST /access-codes, POST /people, itd.) → **naprawione** (`adminAuditService.ts:61` — `risk_level` i parametr usunięte z INSERT). Po naprawie: wszystkie write-ścieżki odblokowane. S4 access-codes GET PASS (typy int OK). | ZROBIONE (API-deep, krytyczny bug write zablokowanie naprawiony) |
