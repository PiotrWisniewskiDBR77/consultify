# 🟡 TS-AGENT 3: AI Services

## 📋 MISJA

Naprawić **~152 błędów TypeScript** w serwisach AI.

**Szacowany czas:** 1-1.5h

---

## 📁 PLIKI DO NAPRAWY (10 plików)

| Plik                                                | Błędy    |
| --------------------------------------------------- | -------- |
| `server/src/ai/simulationEngine.ts`                 | 34       |
| `server/src/models/megatrend.ts`                    | 22       |
| `server/src/ai/policyEngine.ts`                     | 18       |
| `server/src/ai/asyncJobService.ts`                  | 18       |
| `server/src/controllers/ai/AIPromptsController.ts`  | 17       |
| `server/src/controllers/ai/AITrainingController.ts` | 16       |
| `server/src/ai/signalEngine.ts`                     | 10       |
| `server/src/services/ai/aiPipeline.ts`              | 6        |
| `server/src/ai/recommendationEngine.ts`             | 6        |
| `server/src/ai/actionExecutionAdapter.ts`           | 5        |
| **SUMA**                                            | **~152** |

---

## 🔍 SPRAWDŹ BŁĘDY

```bash
# Błędy AI
npm run type-check 2>&1 | grep "/ai/" | head -30

# Konkretny plik
npm run type-check 2>&1 | grep "simulationEngine"
```

---

## 📝 STRATEGIA NAPRAWY

### Krok 1: Utwórz plik typów AI

```typescript
// server/src/types/ai.types.ts

export interface AiJob {
  id: string;
  type: 'chat' | 'analysis' | 'recommendation' | 'action';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: Record<string, unknown>;
  result?: Record<string, unknown>;
  attempts: number;
  correlation_id?: string;
  organization_id: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  enabled: boolean;
  priority: number;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in';
  value: unknown;
}

export interface PolicyAction {
  type: 'allow' | 'deny' | 'require_approval' | 'notify';
  params?: Record<string, unknown>;
}

export interface SimulationInput {
  scenario: string;
  parameters: Record<string, unknown>;
  constraints?: SimulationConstraint[];
}

export interface SimulationResult {
  id: string;
  scenario: string;
  outcomes: SimulationOutcome[];
  confidence: number;
  created_at: string;
}

export interface SimulationOutcome {
  metric: string;
  baseline: number;
  projected: number;
  delta: number;
  confidence: number;
}

export interface SimulationConstraint {
  type: 'budget' | 'time' | 'resource';
  value: number;
  unit: string;
}

export interface Recommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  actions: RecommendedAction[];
}

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}
```

### Krok 2: Typuj wyniki z bazy

```typescript
// ❌ PRZED:
const rules = await db.all('SELECT * FROM policy_rules');
rules.forEach((r) => console.log(r.name)); // Error

// ✅ PO:
import { PolicyRule } from '../types/ai.types';

const rules = await new Promise<PolicyRule[]>((resolve, reject) => {
  db.all<PolicyRule>('SELECT * FROM policy_rules WHERE enabled = 1', [], (err, rows) =>
    err ? reject(err) : resolve(rows || [])
  );
});
rules.forEach((r) => console.log(r.name)); // OK
```

### Krok 3: Typuj Promise<void>

```typescript
// ❌ PRZED:
new Promise((resolve) => {
  resolve(); // Error: Expected 1 argument
});

// ✅ PO:
new Promise<void>((resolve) => {
  resolve();
});
```

---

## 🎯 WZORZEC DLA AI SERVICE

```typescript
/**
 * [ServiceName] - AI Service
 */
import { getDatabase } from '../database/Database';
import { AiJob, PolicyRule, SimulationResult } from '../types/ai.types';

const db = getDatabase();

class PolicyEngine {
  private rules: PolicyRule[] = [];

  async loadRules(organizationId: string): Promise<PolicyRule[]> {
    return new Promise<PolicyRule[]>((resolve, reject) => {
      db.all<PolicyRule>(
        `SELECT * FROM policy_rules 
                 WHERE organization_id = ? AND enabled = 1
                 ORDER BY priority DESC`,
        [organizationId],
        (err, rows) => {
          if (err) reject(err);
          else {
            this.rules = rows || [];
            resolve(this.rules);
          }
        }
      );
    });
  }

  async evaluate(context: Record<string, unknown>): Promise<PolicyAction[]> {
    const applicableRules = this.rules.filter((rule) =>
      this.matchesConditions(rule.conditions, context)
    );

    return applicableRules.flatMap((rule) => rule.actions);
  }

  private matchesConditions(
    conditions: PolicyCondition[],
    context: Record<string, unknown>
  ): boolean {
    return conditions.every((cond) => {
      const value = context[cond.field];
      switch (cond.operator) {
        case 'eq':
          return value === cond.value;
        case 'ne':
          return value !== cond.value;
        case 'gt':
          return (value as number) > (cond.value as number);
        case 'lt':
          return (value as number) < (cond.value as number);
        case 'contains':
          return String(value).includes(String(cond.value));
        case 'in':
          return (cond.value as unknown[]).includes(value);
        default:
          return false;
      }
    });
  }
}

export default new PolicyEngine();
```

---

## ✅ KOLEJNOŚĆ NAPRAWY

1. **Utwórz `server/src/types/ai.types.ts`** z interfejsami
2. **simulationEngine.ts** (34) - najważniejszy
3. **megatrend.ts** (22)
4. **policyEngine.ts** (18)
5. **asyncJobService.ts** (18)
6. Pozostałe

---

## ✅ WERYFIKACJA

```bash
# Po naprawie:
npm run type-check 2>&1 | grep "/ai/\|aiPipeline\|megatrend" | wc -l

# Cel: 0 błędów
```
