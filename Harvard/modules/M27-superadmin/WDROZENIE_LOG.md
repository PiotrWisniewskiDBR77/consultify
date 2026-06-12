# M27 — SuperAdmin — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M27-01/02/03/08: bigint strings w getOrganizations/getDashboardStats/getSystemAnalytics/getUsageByOrg | `a8c250ec72` | Number() wraps; dashboard counts numeric | ✅ |
| 2026-06-12 | Fala-18 | BUG-M27-04/05: analytics-superadmin bigint + is_active=1 na boolean | `a8c250ec72` | flagOn() + Number(); metrics list+stats poprawne | ✅ |
| 2026-06-12 | Fala-18 | BUG-M27-06/07: flagOn dla approval_workflows.is_active + predictive_models.is_active + access_codes | `a8c250ec72` | Workflows/models/codes is_active bool | ✅ |
| 2026-06-12 | Fala-18 | BUG-M27-09: system_health_alerts CREATE TABLE condition→operator | `a8c250ec72` | CREATE TABLE używa operator; INSERT działa | ✅ |
