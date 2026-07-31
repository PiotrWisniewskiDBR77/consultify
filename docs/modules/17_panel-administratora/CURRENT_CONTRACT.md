---
module_id: MODULE_ADMIN_PANEL
truth_type: product-target
status: canonical
owner: product-security
last_reviewed: 2026-07-30
---

# Admin Panel — aktualny kontrakt funkcjonalny

## Cel i granica

Admin Panel jest control plane organizacji: członkowie, role, polityki,
konfiguracja, bezpieczeństwo i operacje tenantowe. `/superadmin/*` jest osobną
płaszczyzną operatora platformy i nie należy do standardowego Admin Panel.

## Funkcje

| ID | Funkcja | Stan |
| --- | --- | --- |
| `ADM-F-001` | Członkowie, zaproszenia i role | AS-IS |
| `ADM-F-002` | Polityki i konfiguracja organizacji | AS-IS / partial |
| `ADM-F-003` | AI, modele, limity i feature flags | partial |
| `ADM-F-004` | Bezpieczeństwo, audyt i incydenty tenantowe | partial |
| `ADM-F-005` | Integracje i lifecycle organizacji | partial |

## Governance

Każda akcja administracyjna wymaga uwierzytelnienia, capability, scope
organizacji, walidacji i wpisu audytowego. Operacje destrukcyjne wymagają
potwierdzenia oraz — tam gdzie możliwe — okresu odzyskania. AI może objaśniać
ustawienia, ale nie wykonuje krytycznej mutacji bez jawnej zgody.

## AS-IS

`/admin/*` jest aktywną, chronioną powierzchnią tenantową. Moduł ma status
`real + security_critical`. Repozytorium zawiera także rozbudowany SuperAdmin,
co historycznie powodowało mieszanie zakresów. W szerokim teście wykryto
niezależną regresję dostępności akcji w widoku incydentów SuperAdmin; nie jest
ona dowodem awarii Admin Panel, ale pozostaje długiem jakości control plane.

## TO-BE i luki

Jednoznaczna macierz capabilities, pełny audit trail, bezpieczne zaproszenia,
jawne skutki ustawień i wyraźne rozdzielenie tenant admin od platform operator.

- zweryfikować wszystkie trasy i guardy Admin/SuperAdmin;
- scalić macierz ról, capability i polityk;
- potwierdzić audyt każdej krytycznej mutacji;
- przetestować utratę dostępu, ostatniego admina i lifecycle organizacji;
- naprawić regresje testów control plane przed oceną `A`.

Ocena: `B`, obszar krytyczny bezpieczeństwa. Dowody: `STATUS.md`, `CODEMAP.md`,
`ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md` i guardy tras/API.
