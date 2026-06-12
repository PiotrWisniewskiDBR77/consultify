# M26 — Portal Partnerski — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M26-01: DECIMAL bigint strings w partnerCommissionService (grossAmount/commissionRate/commissionAmount) | `a8c250ec72` | Number() wraps; commission amounts numeric | ✅ |
| 2026-06-12 | Fala-18 | BUG-M26-02: COUNT bigint strings w partnerReferralService analytics | `a8c250ec72` | Number() wraps; clicks/signups/trials numeric | ✅ |
| 2026-06-12 | Fala-18 | BUG-M26-03: SQLite date('now','start of month') → PG DATE_TRUNC | `a8c250ec72` | Monthly revenue filters działają na PG | ✅ |
| 2026-06-12 | Fala-18 | BUG-M26-04/06: gross_amount.toFixed crash + licenseDiscountPercent string | `a8c250ec72` | Number() guards; license discount numeric | ✅ |
