# Admin Organization Module - Deep Analysis Report

**Data:** 2025-01-27  
**Moduły:** Profile & Branding, Ownership, Regional Settings, Fiscal Year, Data Hosting, Approved Domains

---

## 1. Przegląd Modułów

| Moduł              | Komponent                     | Status                    |
| ------------------ | ----------------------------- | ------------------------- |
| Profile & Branding | `OrganizationProfileView.tsx` | ❌ Backend STUB           |
| Ownership          | `OwnershipManagementView.tsx` | ❌ Brak endpointów        |
| Regional Settings  | `RegionalSettings.tsx`        | ⚠️ Sprawdzić              |
| Fiscal Year        | `FiscalYearSettings.tsx`      | ✅ Kontrolowany komponent |
| Data Hosting       | `DataHostingSettings.tsx`     | ✅ Kontrolowany komponent |
| Approved Domains   | `ApprovedDomainsSettings.tsx` | ⚠️ Wymaga callbacków      |

---

## 2. ❌ KRYTYCZNE PROBLEMY

### Problem 1: organization-profiles.routes.ts to STUB!

**Lokalizacja:** `server/src/routes/organization/organization-profiles.routes.ts`

```typescript
// BYŁ STUB:
router.use((req, res) => {
  logger.warn(`[organization-profiles] Route not implemented (stubbed)`);
  res.status(501).json({ error: 'Not implemented: Route handler missing' });
});
```

**Status:** ✅ NAPRAWIONE - Zaimplementowano pełne routy

---

### Problem 2: Brak endpointów dla Ownership

**Wymagane endpointy:**

- `GET /api/organizations/:orgId/ownership` - ❌ NIE ISTNIEJE
- `GET /api/organizations/:orgId/admins` - ⚠️ Sprawdzić
- `POST /api/organizations/:orgId/ownership/transfer` - ❌ NIE ISTNIEJE
- `POST /api/organizations/:orgId/ownership/accept-transfer` - ❌ NIE ISTNIEJE
- `POST /api/organizations/:orgId/ownership/cancel-transfer` - ❌ NIE ISTNIEJE
- `POST /api/organizations/:orgId/schedule-deletion` - ❌ NIE ISTNIEJE

**Status:** ⚠️ Wymaga implementacji

---

### Problem 3: branding.routes.ts to STUB!

**Lokalizacja:** `server/src/routes/organization/branding.routes.ts`

```typescript
// STUB:
router.use((req, res) => {
  logger.warn(`[branding] Route not implemented (stubbed)`);
  res.status(501).json({ error: 'Not implemented: Route handler missing' });
});
```

**Status:** ⚠️ Wymaga implementacji (opcjonalnie, logika przeniesiona do organization-profiles)

---

## 3. Analiza Komponentów

### Profile & Branding (OrganizationProfileView.tsx)

**Endpointy:**

- `GET /api/organization-profiles/:orgId` - ✅ NAPRAWIONE
- `PUT /api/organization-profiles/:orgId` - ✅ NAPRAWIONE
- `POST /api/organizations/:orgId/logo` - ✅ NAPRAWIONE
- `POST /api/organizations/:orgId/verify-domain` - ✅ NAPRAWIONE

**Tabele DB:**

- `organizations` - ✅ Istnieje
- `organization_profiles` - ✅ Istnieje (migracja 050)
- `organization_settings` - ✅ Istnieje

---

### Ownership (OwnershipManagementView.tsx)

**Wymagane tabele:**

- `organization_ownership` - ❓ Sprawdzić
- `ownership_transfer_requests` - ❓ Sprawdzić

**Status:** ❌ Wymaga implementacji backend

---

### Regional Settings (RegionalSettings.tsx)

**Endpointy:**

- `GET /settings/preferences/regional` - ⚠️ Sprawdzić
- `PUT /settings/preferences/regional` - ⚠️ Sprawdzić

---

### Fiscal Year, Data Hosting, Approved Domains

Są kontrolowanymi komponentami - otrzymują props `config`, `onChange`, `onSave` od rodzica.
Rodzic (prawdopodobnie `OrganizationModule.tsx`) musi obsłużyć persystencję.

---

## 4. Wykonane Naprawy

### ✅ organization-profiles.routes.ts - PEŁNA IMPLEMENTACJA

```typescript
// Nowe endpointy:
GET /api/organization-profiles/:orgId       // Pobierz profil
PUT /api/organization-profiles/:orgId       // Aktualizuj profil
POST /api/organizations/:orgId/logo         // Upload logo
POST /api/organizations/:orgId/verify-domain // Weryfikacja domeny
```

**Funkcjonalności:**

- Pobieranie profilu z `organizations`, `organization_profiles`, `organization_settings`
- Aktualizacja profilu z upsert do `organization_profiles`
- Przechowywanie ustawień branding w `organization_settings` (klucz: 'branding')
- Walidacja uprawnień (tylko ADMIN może edytować)
- Weryfikacja custom domain (symulowana)

---

## 5. Plan Naprawy - Pozostałe

### Priorytet 1 (Krytyczne):

1. [x] Zaimplementować organization-profiles routes
2. [ ] Zaimplementować ownership routes
3. [ ] Sprawdzić regional settings routes

### Priorytet 2 (Wysoki):

4. [ ] Utworzyć tabelę `ownership_transfer_requests` jeśli nie istnieje
5. [ ] Zaimplementować schedule-deletion

### Priorytet 3 (Średni):

6. [ ] Zweryfikować approved domains endpoint
7. [ ] Sprawdzić integrację fiscal year z backendem

---

## 6. Status Gotowości

| Obszar             | Status | Procent |
| ------------------ | ------ | ------- |
| Profile & Branding | ✅     | 95%     |
| Ownership          | ❌     | 20%     |
| Regional Settings  | ⚠️     | 70%     |
| Fiscal Year        | ✅     | 90%     |
| Data Hosting       | ✅     | 90%     |
| Approved Domains   | ⚠️     | 60%     |

**Ogólny status ORGANIZATION:** 🟡 **70%**

---

## 7. Połączenia z innymi modułami

### → Settings

- `RegionalSettings` używany też w `/settings`
- Wspólne endpointy `/settings/preferences/*`

### → SuperAdmin

- Brak bezpośrednich połączeń w analizowanych modułach
- SuperAdmin ma własne organizacje management

---

**Następne kroki:**

1. Implementacja ownership routes
2. Weryfikacja regional settings backend
3. Test end-to-end Profile & Branding

---

**Ostatnia aktualizacja:** 2025-01-27
