# DTO Registry (Canonical Interfaces)

**Last Updated:** 1 January 2026  
**Reference File:** `types.ts`  
**Standard:** Enterprise Data Contract v1.0

This registry defines the canonical Data Transfer Objects (DTOs) used for communication between the Consultinity frontend and backend. These structures are mandatory for all REST and WebSocket payloads.

---

## 1. Core PMO Objects

### `Initiative`
The central object for transformation tracking.
```typescript
interface Initiative {
  id: string;
  name: string;
  summary?: string;
  axis: AssessmentAxis; // processes, digitalProducts, etc.
  status: InitiativeStatus; // DRAFT, PLANNING, EXECUTING, etc.
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  progress: number; // 0-100
  budget: number;
  expectedRoi?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  projectId: string;
  ownerBusinessId: string;
  ownerExecutionId: string;
}
```

### `Task`
A granular unit of work within an initiative.
```typescript
interface Task {
  id: string;
  initiativeId: string;
  title: string;
  description?: string;
  status: TaskStatus; // TODO, IN_PROGRESS, BLOCKED, DONE
  assigneeId: string;
  dueDate?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}
```

---

## 2. Organization & Governance

### `OrganizationProfile`
Branding and regional identity of a tenant.
```typescript
interface OrganizationProfile {
  id: string;
  organizationId: string;
  logoUrl?: string;
  brandColor?: string;
  industry?: string;
  companySize: CompanySizeEnum;
  defaultTimezone: string;
  defaultLanguage: 'en' | 'pl' | 'de' | 'es' | 'ja' | 'ar';
}
```

### `ChangeRequest`
Formal request to modify Project Scope, Schedule, or Budget.
```typescript
interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  type: 'SCOPE' | 'SCHEDULE' | 'BUDGET';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  impactAnalysis: string;
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
  approvedBy?: string;
}
```

---

## 3. Data Transfer Standards
1. **Naming Convention**: All fields must use `camelCase`. Backend database fields in `snake_case` must be mapped to `camelCase` in the service layer before transmission.
2. **Date Format**: All timestamps must be transmitted as ISO-8601 strings (UTC).
3. **Optionality**: Use `?` for fields that may be null or undefined. Do not send "null" strings; omit the key or send `null`.
4. **Consistency**: Field names like `id` and `organizationId` are reserved and must use these exact strings across all DTOs for UUIDs.
