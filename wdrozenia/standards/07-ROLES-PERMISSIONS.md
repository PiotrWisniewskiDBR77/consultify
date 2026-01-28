# 👥 Role i Uprawnienia (kanoniczne)

## Cel

Definicja ról operacyjnych w systemie, ich odpowiedzialności i uprawnień do podejmowania decyzji gate'owych w lifecycle inicjatywy.

## Źródła

- Kanon ról (Account Type + Project Role): `src/types/core.ts`
- Statusy: `wdrozenia/standards/03-STATUS-WORKFLOW.md`
- Jedno rozumienie + delegacje: `wdrozenia/workflows/01-ROLES-AND-ASSUMPTIONS.md`

---

## Uwaga: 2 poziomy ról (żeby nie mieszać pojęć)
W systemie rozróżniamy:
- **Account Type (organizacja)**: Owner/Admin/User — zarządzanie tenantem i ustawieniami.
- **Project Role (projekt)**: role procesowe w obrębie projektu (PM, Sponsor, Initiative Owner itd.).

W tym dokumencie opisujemy **role operacyjne procesu** (workflow), które mogą być mapowane na `ProjectRole` w kodzie.

## Role operacyjne (8 ról)

### 1️⃣ Admin

| Aspekt | Opis |
|--------|------|
| **Odpowiedzialność** | Konfiguracja systemu: role, polityki, progi, override'y |
| **Może technicznie** | Wykonać każdą akcję |
| **Ale biznesowo** | NIE jest aktorem procesu biznesowego |
| **Gate decisions** | ❌ Nie podejmuje decyzji gate'owych |

```typescript
permissions: ['system.*', 'config.*', 'users.*', 'audit.view']
```

---

### 2️⃣ Consultant

| Aspekt | Opis |
|--------|------|
| **Odpowiedzialność** | Praca merytoryczna na narzędziach i assessmentach |
| **Co robi** | Tworzy treść, analizy, propozycje |
| **Ograniczenie** | **NIGDY** nie podejmuje decyzji gate'owych |
| **Nie może** | Przesuwać inicjatywy dalej samodzielnie |
| **Gate decisions** | ❌ Żadne |

```typescript
permissions: [
  'tools.create', 'tools.edit', 'tools.view',
  'assessment.create', 'assessment.edit', 'assessment.view',
  'initiative.create', 'initiative.edit', 'initiative.view',
  // BRAK: 'initiative.promote', 'initiative.approve', etc.
]
```

---

### 3️⃣ Initiative Owner

| Aspekt | Opis |
|--------|------|
| **Odpowiedzialność** | Operacyjny właściciel inicjatywy |
| **Co robi** | Realizacja, taski, zgłaszanie problemów, gotowość do kolejnych etapów |
| **Gate decisions** | `BLOCK`, `COMPLETE` (operacyjne) |

```typescript
permissions: [
  'initiative.edit', 'initiative.view',
  'initiative.block', 'initiative.complete',
  'task.create', 'task.edit', 'task.assign',
  'decision.request',
]
```

---

### 4️⃣ Project Sponsor

| Aspekt | Opis |
|--------|------|
| **Odpowiedzialność** | Właściciel biznesowy inicjatywy |
| **Co robi** | Odpowiada za sens biznesowy, budżet, priorytet |
| **Może** | Promować, odblokowywać, eskalować |
| **Gate decisions** | `PROMOTE`, `ACCEPT`, `REJECT`, `UNBLOCK` |

```typescript
permissions: [
  'initiative.view', 'initiative.edit',
  'initiative.promote', 'initiative.accept', 'initiative.reject',
  'initiative.unblock', 'initiative.escalate',
  'decision.approve', 'decision.reject',
]
```

---

### 5️⃣ PMO (Project Management Office)

| Aspekt | Opis |
|--------|------|
| **Odpowiedzialność** | Harmonogram, roadmapa, start i zamknięcie realizacji |
| **Co robi** | Strażnik porządku wykonawczego |
| **Gate decisions** | `START_PLANNING`, `SCHEDULE`, `START`, `START_TRACKING`, `CANCEL` |

```typescript
permissions: [
  'initiative.*', // pełny dostęp do inicjatyw
  'roadmap.edit', 'roadmap.schedule',
  'execution.start', 'execution.close',
  'report.generate', 'report.view',
  'decision.view',
]
```

---

### 6️⃣ Steering Committee

| Aspekt | Opis |
|--------|------|
| **Odpowiedzialność** | Organ decyzyjny najwyższego szczebla |
| **Co robi** | Zatwierdza inicjatywy strategiczne, rozwiązuje konflikty i eskalacje |
| **Gate decisions** | `APPROVE`, `UNBLOCK` (eskalacje), `CANCEL` |

```typescript
permissions: [
  'initiative.approve', 'initiative.cancel',
  'initiative.unblock', // dla eskalacji
  'decision.approve', 'decision.reject', 'decision.escalate',
  'report.view', 'portfolio.view',
]
```

---

### 7️⃣ Team Member

| Aspekt | Opis |
|--------|------|
| **Odpowiedzialność** | Członek zespołu realizującego taski |
| **Co robi** | Wykonuje przypisane zadania |
| **Ograniczenie** | NIE podejmuje decyzji procesowych |
| **Gate decisions** | ❌ Żadne |

```typescript
permissions: [
  'task.view', 'task.update_status', 'task.comment',
  'initiative.view',
]
```

---

### 8️⃣ Business Owner

| Aspekt | Opis |
|--------|------|
| **Odpowiedzialność** | Właściciel efektów biznesowych |
| **Co robi** | Odpowiada za pomiar i tracking korzyści |
| **Gate decisions** | `START_TRACKING`, `CLOSE_TRACKING` |

```typescript
permissions: [
  'benefits.create', 'benefits.edit', 'benefits.view',
  'initiative.start_tracking', 'initiative.close_tracking',
  'kpi.create', 'kpi.edit', 'kpi.measure',
]
```

---

## Macierz Gate Decisions × Role

| Gate | Admin | Consultant | Init. Owner | Sponsor | PMO | Steering | Team | Business |
|------|:-----:|:----------:|:-----------:|:-------:|:---:|:--------:|:----:|:--------:|
| PROMOTE | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ACCEPT | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| REJECT | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| START_PLANNING | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| APPROVE | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| SCHEDULE | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| START | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| BLOCK | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| UNBLOCK | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| COMPLETE | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| START_TRACKING | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| CANCEL | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

---

## Macierz Moduł × Role (widoczność)

| Moduł | Admin | Consultant | Init. Owner | Sponsor | PMO | Steering | Team | Business |
|-------|:-----:|:----------:|:-----------:|:-------:|:---:|:--------:|:----:|:--------:|
| Tools | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ | ❌ | ❌ |
| Assessment | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ | ❌ | ❌ |
| Initiatives | ✅ | 👁️ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| Execution | ✅ | 👁️ | ✅ | 👁️ | ✅ | 👁️ | ✅ | 👁️ |
| Benefits | ✅ | ❌ | 👁️ | 👁️ | ✅ | 👁️ | ❌ | ✅ |
| Reporting | ✅ | 👁️ | 👁️ | ✅ | ✅ | ✅ | ❌ | 👁️ |
| Admin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Legenda: ✅ = pełny dostęp, 👁️ = tylko odczyt, ❌ = brak dostępu

---

## Delegacje ról (gdy projekt jest „mniejszy”)
Nie wszystkie projekty mają wszystkie role. Żeby workflow zawsze działał (zawsze jest decydent), obowiązuje kanon delegacji:

- jeśli brak **PMO** → obowiązki przejmuje **Project Manager**
- jeśli brak **Steering Committee** → strategiczne `APPROVE/CANCEL` przejmuje **Sponsor / Project Executive**
- jeśli brak **Business Owner** → tracking korzyści robi **Sponsor** (albo PMO/PM), ale musi być wskazany owner KPI
- jeśli brak **Reviewer** → review artefaktów robi **Project Manager**

Szczegóły i mapowanie terminologii: `wdrozenia/workflows/01-ROLES-AND-ASSUMPTIONS.md`

## Kluczowe zasady

### 1. Consultant NIGDY nie decyduje

```typescript
// ❌ ZABRONIONE
if (user.role === 'CONSULTANT') {
  throw new ForbiddenError('Consultant cannot execute gate decisions');
}
```

### 2. Admin to rola techniczna, nie biznesowa

```typescript
// Admin może wszystko technicznie, ale NIE powinien wykonywać gate'ów
// Audit log powinien flagować: "Admin override - requires justification"
```

### 3. Eskalacja zmienia decydenta

```typescript
// Normalnie: Project Sponsor decyduje o UNBLOCK
// Po eskalacji: Steering Committee decyduje
if (decision.escalationLevel === 'red') {
  requiredRole = 'STEERING_COMMITTEE';
}
```

---

## Implementacja w UI

### Przycisk gate'a

```tsx
<Button
  onClick={handleGate}
  disabled={!canExecuteGate(user.role, gateType)}
>
  {gateLabel}
</Button>

// Helper
function canExecuteGate(role: Role, gate: GateType): boolean {
  return GATE_PERMISSIONS[gate].includes(role);
}
```

### Walidacja backend

```typescript
// middleware/gateAuthorization.ts
export function requireGatePermission(gate: GateType) {
  return (req, res, next) => {
    const userRole = req.user.role;
    if (!GATE_PERMISSIONS[gate].includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role ${userRole} cannot execute gate ${gate}`,
        requiredRoles: GATE_PERMISSIONS[gate],
      });
    }
    next();
  };
}
```

---

## Typy TypeScript

```typescript
// types/roles.ts

export type Role =
  | 'ADMIN'
  | 'CONSULTANT'
  | 'INITIATIVE_OWNER'
  | 'PROJECT_SPONSOR'
  | 'PMO'
  | 'STEERING_COMMITTEE'
  | 'TEAM_MEMBER'
  | 'BUSINESS_OWNER';

export type GateType =
  | 'PROMOTE'
  | 'ACCEPT'
  | 'REJECT'
  | 'START_PLANNING'
  | 'APPROVE'
  | 'SCHEDULE'
  | 'START'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'COMPLETE'
  | 'START_TRACKING'
  | 'CANCEL';

export const GATE_PERMISSIONS: Record<GateType, Role[]> = {
  PROMOTE: ['PROJECT_SPONSOR'],
  ACCEPT: ['PROJECT_SPONSOR', 'STEERING_COMMITTEE'],
  REJECT: ['PROJECT_SPONSOR', 'STEERING_COMMITTEE'],
  START_PLANNING: ['PMO'],
  APPROVE: ['STEERING_COMMITTEE'],
  SCHEDULE: ['PMO'],
  START: ['PMO'],
  BLOCK: ['INITIATIVE_OWNER', 'PMO'],
  UNBLOCK: ['PROJECT_SPONSOR', 'STEERING_COMMITTEE'],
  COMPLETE: ['INITIATIVE_OWNER', 'PMO'],
  START_TRACKING: ['BUSINESS_OWNER'],
  CANCEL: ['PMO', 'STEERING_COMMITTEE'],
};
```

---

## Historia zmian

| Data | Zmiana | Autor |
|------|--------|-------|
| 2026-01-26 | Utworzenie dokumentu - 8 ról, macierz gate'ów | Agent |

---

## Powiązane dokumenty

- Status Workflow: `wdrozenia/standards/03-STATUS-WORKFLOW.md`
- RBAC Permissions: `wdrozenia/standards/05-RBAC-PERMISSIONS.md`
- Encja Decision: `wdrozenia/standards/entities/02-DECISION.md`
