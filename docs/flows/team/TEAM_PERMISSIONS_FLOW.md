# FLOW-TEAM-001: Team & Permissions Management

> **ID:** FLOW-TEAM-001 | **Status:** ✅ Complete | **Priority:** HIGH

## Overview

| Metryka                  | Wartość |
| ------------------------ | ------- |
| **Kompletność**          | 80%     |
| **Zidentyfikowane luki** | 4       |
| **Priorytet naprawy**    | MEDIUM  |

## Purpose

Zarządzanie zespołami, członkami, zaproszeniami, rolami i uprawnieniami w organizacji. System RBAC kontrolujący dostęp do funkcji.

## Triggers

| Trigger           | Opis                             |
| ----------------- | -------------------------------- |
| Team Creation     | Admin tworzy nowy zespół         |
| Member Invitation | Admin zaprasza użytkownika       |
| Invitation Accept | Użytkownik akceptuje zaproszenie |
| Role Change       | Zmiana roli użytkownika          |
| Permission Check  | System sprawdza uprawnienia      |

## Outcomes

- Zespoły są utworzone z odpowiednimi leadami
- Użytkownicy są zaproszeni i dołączają do zespołów
- Role i uprawnienia są przypisane
- Access control działa poprawnie

## Actors

| Aktor      | Rola                               |
| ---------- | ---------------------------------- |
| Admin      | Zarządza zespołami i zaproszeniami |
| Team Lead  | Zarządza członkami swojego zespołu |
| Member     | Członek zespołu                    |
| System     | Sprawdza uprawnienia               |
| SuperAdmin | Konfiguruje role i permissions     |

## Involved Modules

### Frontend

| Komponent         | Lokalizacja             | Odpowiedzialność         |
| ----------------- | ----------------------- | ------------------------ |
| TeamManagement    | `src/views/settings/`   | Team CRUD UI             |
| InvitationModal   | `src/components/`       | Invite member modal      |
| MembersTable      | `src/components/`       | Lista członków           |
| RoleSelector      | `src/components/`       | Wybór roli               |
| PermissionsMatrix | `src/views/superadmin/` | Konfiguracja permissions |

### Backend

| Serwis/Route          | Lokalizacja                                            | Odpowiedzialność      |
| --------------------- | ------------------------------------------------------ | --------------------- |
| teams.routes.ts       | `server/src/routes/organization/teams.routes.ts`       | Team CRUD             |
| invitations.routes.ts | `server/src/routes/organization/invitations.routes.ts` | Invitation flow       |
| InvitationController  | `server/src/controllers/InvitationController.ts`       | Invitation logic      |
| InvitationService     | `server/src/services/invitationService.ts`             | Invitation operations |
| rbacService           | `server/src/services/rbacService.ts`                   | RBAC logic            |
| permissionService     | `server/src/services/permissionService.ts`             | Permission checks     |

### Database

| Tabela             | Opis                         |
| ------------------ | ---------------------------- |
| `teams`            | Definicje zespołów           |
| `team_members`     | Członkowie zespołów          |
| `users`            | Użytkownicy z rolami         |
| `invitations`      | Zaproszenia pending          |
| `roles`            | Definicje ról                |
| `permissions`      | Definicje uprawnień          |
| `role_permissions` | Mapowanie rola → permissions |

## Sequence Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Admin     │     │   Teams     │     │ Invitation  │     │    Email     │     │ Database │
│             │     │   Routes    │     │  Service    │     │   Service    │     │          │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬───────┘     └────┬─────┘
       │                   │                   │                   │                  │
       │ POST /teams       │                   │                   │                  │
       │──────────────────>│   createTeam()    │                   │                  │
       │                   │───────────────────────────────INSERT team──────────────>│
       │<──────────────────────────────────────────────────team created              │
       │                   │                   │                   │                  │
       │ POST /invitations │                   │                   │                  │
       │──────────────────>│───────────────────>│   generate token │                  │
       │                   │                   │───────INSERT invite────────────────>│
       │                   │                   │   sendInviteEmail │                  │
       │                   │                   │──────────────────>│   [send email]  │
       │<───────────────────────────invitation sent                │                  │
       │                   │                   │                   │                  │
┌──────┴──────┐            │                   │                   │                  │
│  Invitee    │            │                   │                   │                  │
└──────┬──────┘            │                   │                   │                  │
       │ POST /accept      │                   │                   │                  │
       │──────────────────>│──────────────────>│   validateToken   │                  │
       │                   │                   │───────SELECT invite────────────────>│
       │                   │                   │   createUser/addMember              │
       │                   │                   │───────INSERT/UPDATE────────────────>│
       │<─────────────────────────────────────────user created, token returned       │
       │                   │                   │                   │                  │
```

## Integration Points

### 1. Team → RBAC

- **Type:** Permission Check
- **Status:** ✅ Working
- **Details:** Team membership affects permissions

### 2. Invitation → Email

- **Type:** Notification
- **Status:** ✅ Working
- **Details:** Email sent on invitation

### 3. Team → Billing

- **Type:** Data Check
- **Status:** ⚠️ Partial
- **Details:** Seat limits should be checked

### 4. Invitation → Cleanup

- **Type:** Background Job
- **Status:** ⚠️ Partial
- **Details:** Expired invitations cleanup exists but not comprehensive

---

## Gap Analysis

### GAP-TEAM-001: Invitation expiry nie jest enforced przy accept

| Atrybut              | Wartość                                |
| -------------------- | -------------------------------------- |
| **Priorytet**        | MEDIUM                                 |
| **Szacowany effort** | 1h                                     |
| **Wpływ**            | Stare zaproszenia mogą być akceptowane |

**Problem:** Choć zaproszenia mają `expires_at`, ten warunek nie jest zawsze sprawdzany przy akceptacji. Użytkownik może użyć starego linka.

**Rozwiązanie:**

```typescript
// W InvitationController.acceptInvitation
async function acceptInvitation(token: string): Promise<void> {
  const invitation = await db.get(`SELECT * FROM invitations WHERE token = ?`, [token]);

  if (!invitation) {
    throw new Error('Invalid invitation');
  }

  // GAP-TEAM-001: Enforce expiry
  if (new Date(invitation.expires_at) < new Date()) {
    throw new Error('Invitation has expired');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Invitation is no longer valid');
  }

  // ... continue with acceptance
}
```

**Pliki do modyfikacji:**

- `server/src/controllers/InvitationController.ts`

---

### GAP-TEAM-002: Brak bulk invite

| Atrybut              | Wartość                                |
| -------------------- | -------------------------------------- |
| **Priorytet**        | LOW                                    |
| **Szacowany effort** | 3h                                     |
| **Wpływ**            | UX - admini muszą zapraszać pojedynczo |

**Problem:** Brak możliwości zaproszenia wielu użytkowników naraz (CSV import, multiple emails).

**Rozwiązanie:**

```typescript
// POST /api/invitations/bulk
interface BulkInviteRequest {
  emails: string[]; // lub
  csvData: string; // CSV z email,role,team
  defaultRole?: string;
  defaultTeamId?: string;
}

async function bulkInvite(req: BulkInviteRequest): Promise<{
  successful: string[];
  failed: Array<{ email: string; error: string }>;
}> {
  const results = { successful: [], failed: [] };

  for (const email of req.emails) {
    try {
      await invitationService.create({
        email,
        role: req.defaultRole,
        teamId: req.defaultTeamId,
      });
      results.successful.push(email);
    } catch (err) {
      results.failed.push({ email, error: err.message });
    }
  }

  return results;
}
```

**Pliki do modyfikacji:**

- `server/src/routes/organization/invitations.routes.ts`
- `server/src/controllers/InvitationController.ts`
- Frontend: `src/components/BulkInviteModal.tsx` (NEW)

---

### GAP-TEAM-003: Permission inheritance potrzebuje refinement

| Atrybut              | Wartość                                            |
| -------------------- | -------------------------------------------------- |
| **Priorytet**        | MEDIUM                                             |
| **Szacowany effort** | 4h                                                 |
| **Wpływ**            | Nieoczekiwane permissions w niektórych przypadkach |

**Problem:** Hierarchia permissions (org → team → project) nie jest zawsze respektowana:

- Team lead permissions nie są jasno zdefiniowane
- Project-level permissions mogą override team permissions niespodziewanie
- Brak audit trail dla permission changes

**Rozwiązanie:**

1. Zdefiniować jasną hierarchię: Organization → Team → Project
2. Implementować permission inheritance:

```typescript
// server/src/services/permissionInheritanceService.ts
async function getEffectivePermissions(
  userId: string,
  context: { orgId: string; teamId?: string; projectId?: string }
): Promise<Permission[]> {
  // 1. Get org-level permissions from user role
  const orgPermissions = await getOrgPermissions(userId, context.orgId);

  // 2. Get team-level permissions (if applicable)
  let teamPermissions: Permission[] = [];
  if (context.teamId) {
    teamPermissions = await getTeamPermissions(userId, context.teamId);
  }

  // 3. Get project-level permissions (if applicable)
  let projectPermissions: Permission[] = [];
  if (context.projectId) {
    projectPermissions = await getProjectPermissions(userId, context.projectId);
  }

  // 4. Merge with inheritance rules
  return mergePermissions(orgPermissions, teamPermissions, projectPermissions);
}
```

**Pliki do modyfikacji:**

- `server/src/services/permissionInheritanceService.ts` (NEW)
- `server/src/services/permissionService.ts`
- `server/src/middleware/rbac.middleware.ts`

---

### GAP-TEAM-004: Brak seat limit enforcement przy invite

| Atrybut              | Wartość                                                 |
| -------------------- | ------------------------------------------------------- |
| **Priorytet**        | HIGH                                                    |
| **Szacowany effort** | 2h                                                      |
| **Wpływ**            | Billing - organizacje mogą przekroczyć limit bez opłaty |

**Problem:** Przy wysyłaniu zaproszenia nie jest sprawdzane czy organizacja ma wolne seats w planie.

**Rozwiązanie:**

```typescript
// W InvitationService.createInvitation
async function createInvitation(data: CreateInvitationData): Promise<Invitation> {
  // GAP-TEAM-004: Check seat limits
  const seatCheck = await seatManagementService.canAddMember(data.organizationId);

  if (!seatCheck.allowed) {
    throw new Error(
      `Seat limit reached (${seatCheck.used}/${seatCheck.limit}). Please upgrade your plan.`
    );
  }

  // Count pending invitations as well
  const pendingCount = await db.get(
    `SELECT COUNT(*) as count FROM invitations 
         WHERE organization_id = ? AND status = 'pending'`,
    [data.organizationId]
  );

  if (seatCheck.used + pendingCount.count >= seatCheck.limit) {
    throw new Error('Including pending invitations, you would exceed your seat limit.');
  }

  // ... continue creating invitation
}
```

**Pliki do modyfikacji:**

- `server/src/services/invitationService.ts`
- `server/src/services/seatManagementService.ts` - ensure proper counting

---

## Summary

| Kategoria           | Count |
| ------------------- | ----- |
| **Total Gaps**      | 4     |
| **HIGH Priority**   | 1     |
| **MEDIUM Priority** | 2     |
| **LOW Priority**    | 1     |
| **Total Effort**    | ~10h  |

## RBAC Features Status

| Feature              | Status | Notes                |
| -------------------- | ------ | -------------------- |
| Team CRUD            | ✅     | Working              |
| Member management    | ✅     | Add/remove members   |
| Invitation flow      | ✅     | Send, accept, cancel |
| Role assignment      | ✅     | Basic roles          |
| Permission checks    | ✅     | Middleware working   |
| Invitation expiry    | ⚠️     | GAP-TEAM-001         |
| Bulk invite          | ❌     | GAP-TEAM-002         |
| Permission hierarchy | ⚠️     | GAP-TEAM-003         |
| Seat enforcement     | ❌     | GAP-TEAM-004         |

## Recommendations

1. **Immediate:** GAP-TEAM-004 - seat limit enforcement (billing impact)
2. **Short-term:** GAP-TEAM-001 - invitation expiry (security)
3. **Medium-term:** GAP-TEAM-003 - permission hierarchy refinement
4. **Later:** GAP-TEAM-002 - bulk invite (UX improvement)

## Related Flows

- FLOW-SECURITY-001: Auth & Sessions (user authentication)
- FLOW-AUTH-001: User Onboarding (new user from invitation)
- FLOW-BILLING-001: Subscription Lifecycle (seat limits)
