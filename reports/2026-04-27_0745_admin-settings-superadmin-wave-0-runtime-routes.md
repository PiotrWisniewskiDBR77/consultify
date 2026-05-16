# Wave 0 Admin/Settings/SuperAdmin Report

## Environment
- URL: `https://demo.consultify.ai`
- Gate: `Wave 0 - Runtime, Auth and Route Truth`

## W0-S1 - SuperAdmin Login and Overview
- **Persona:** SuperAdmin/operator (piotr.wisniewski@dbr77.com)
- **Requested URL:** `/superadmin/overview`
- **Final URL:** `https://demo.consultify.ai/chat`
- **Visible title:** Consultify
- **Body snippet:** `? Help Center Feedback Documents Zgłoś błąd 77 AI Chat Data Model Piotr Wiśniewski OWNER · DBR77 PW`
- **Screenshot/Evidence:** Confirmed via headless browser test.
- **Result:** FAIL - Route hijacked to `/chat`.

## W0-S2 - SuperAdmin Route Matrix
- **Persona:** SuperAdmin/operator (piotr.wisniewski@dbr77.com)

| Requested URL | Final URL | Result |
|---|---|---|
| `/superadmin/customers` | `https://demo.consultify.ai/chat` | FAIL - Hijacked to `/chat` |
| `/superadmin/system` | `https://demo.consultify.ai/chat` | FAIL - Hijacked to `/chat` |
| `/superadmin/content` | `https://demo.consultify.ai/chat` | FAIL - Hijacked to `/chat` |
| `/superadmin/security` | `https://demo.consultify.ai/chat` | FAIL - Hijacked to `/chat` |
| `/superadmin/revenue` | `https://demo.consultify.ai/chat` | FAIL - Hijacked to `/chat` |
| `/superadmin/analytics` | `https://demo.consultify.ai/chat` | FAIL - Hijacked to `/chat` |

## W0-S3 - Tenant Admin Login and Command Center
- **Persona:** Tenant Admin (admin@dbr77.com)
- **Requested URL:** `/admin/overview`
- **Final URL:** `https://demo.consultify.ai/admin/overview`
- **Visible title:** Consultify
- **Body snippet:** `? Help Center Feedback Documents Zgłoś błąd 77 Admin Panel Overview Data Model Admin DBR77 SUPERADMIN`
- **Screenshot/Evidence:** Confirmed via headless browser test.
- **Result:** PASS

## W0-S4 - Tenant Admin Route Matrix
- **Persona:** Tenant Admin (admin@dbr77.com)

| Requested URL | Final URL | Result |
|---|---|---|
| `/admin/overview` | `https://demo.consultify.ai/admin/overview` | PASS |
| `/admin/people` | `https://demo.consultify.ai/admin/people` | PASS |
| `/admin/security` | `https://demo.consultify.ai/admin/security` | PASS |
| `/admin/audit` | `https://demo.consultify.ai/admin/audit` | PASS |
| `/admin/billing` | `https://demo.consultify.ai/admin/billing` | PASS |

## W0-S5 - Settings Route Matrix
- **Persona:** Tenant Admin (admin@dbr77.com)

| Requested URL | Final URL | Result |
|---|---|---|
| `/settings/profile` | `https://demo.consultify.ai/settings/profile` | PASS |
| `/settings/security` | `https://demo.consultify.ai/settings/security-dashboard` | PASS (Intentional redirect) |
| `/settings/auth-access` | `https://demo.consultify.ai/settings/auth-access` | PASS |
| `/settings/api-keys` | `https://demo.consultify.ai/settings/api-keys` | PASS |
| `/settings/privacy` | `https://demo.consultify.ai/settings/privacy` | PASS |
| `/settings/settings-history`| `https://demo.consultify.ai/settings/settings-history` | PASS |

## W0-S6 - Hard Refresh Persistence
- **Persona:** SuperAdmin/operator
- **Action:** Refresh `/superadmin/analytics`
- **Final URL:** `https://demo.consultify.ai/chat`
- **Result:** FAIL - Hijacked to `/chat`

- **Persona:** Tenant Admin
- **Action:** Refresh `/settings/settings-history`
- **Final URL:** `https://demo.consultify.ai/settings/settings-history`
- **Result:** PASS

## Final Decision
**BLOCKED**

**Reasoning:**
- SuperAdmin cannot access any SuperAdmin surface despite valid credentials. All `/superadmin/*` routes forcefully redirect to `/chat`.
- The Tenant Admin role works perfectly across `/admin` and `/settings` and handles hard refreshes without issue.

**Suggested Owner:** Auth/Routing Team (Check `SuperAdmin` role condition in Route Guard, it is falling back to default route).
