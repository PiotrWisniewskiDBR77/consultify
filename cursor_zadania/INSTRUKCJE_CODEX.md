# 📋 INSTRUKCJE DLA CODEX

**Data**: 2026-01-03 21:31  
**Koordynator**: Antigravity #1  
**Twoja Rola**: Service Architecture Specialist

---

## 🎯 TWOJE ZADANIE: BATCH 1 - Service Refactoring (kontynuacja)

### Status: 2h/8h (25% ukończone)
### Pozostało: 6h pracy

### Co już zrobiłeś:
- ✅ Analiza granic serwisów
- ✅ Wstępna ekstrakcja modułów (aiService, assessmentService, reportGeneratorService)

### Co teraz robisz:

---

## 📝 WORKFLOW

### Krok 1: Dokończ billingService Split (2h)

Podziel `server/services/billingService.ts` na 3 moduły:

#### 1.1 Utwórz `BillingQueryService.ts`
```typescript
// server/services/billing/BillingQueryService.ts
export class BillingQueryService {
  async getInvoices(orgId: string) { /* ... */ }
  async getSubscription(orgId: string) { /* ... */ }
  async getUsageStats(orgId: string) { /* ... */ }
}
```

#### 1.2 Utwórz `BillingCommandService.ts`
```typescript
// server/services/billing/BillingCommandService.ts
export class BillingCommandService {
  async createInvoice(data: any) { /* ... */ }
  async updateSubscription(data: any) { /* ... */ }
  async cancelSubscription(orgId: string) { /* ... */ }
}
```

#### 1.3 Utwórz `BillingEventService.ts`
```typescript
// server/services/billing/BillingEventService.ts
export class BillingEventService {
  async handleWebhook(event: any) { /* ... */ }
  async emitEvent(eventType: string, data: any) { /* ... */ }
}
```

### Krok 2: Implementuj Dependency Injection (2h)

Dla każdego serwisu dodaj:

```typescript
class ServiceName {
  private deps: ServiceDependencies;
  
  async initDeps() {
    this.deps = {
      db: await getDatabase(),
      logger: getLogger(),
      // ... inne zależności
    };
  }
  
  setDependencies(deps: Partial<ServiceDependencies>) {
    this.deps = { ...this.deps, ...deps };
  }
}
```

### Krok 3: Testy Jednostkowe (2h)

Dla każdego serwisu utwórz plik testowy:

```typescript
// server/services/billing/__tests__/BillingQueryService.test.ts
import { BillingQueryService } from '../BillingQueryService';

describe('BillingQueryService', () => {
  it('should fetch invoices', async () => {
    const service = new BillingQueryService();
    await service.initDeps();
    const result = await service.getInvoices('org-123');
    expect(result).toBeDefined();
  });
});
```

---

## ✅ DEFINICJA UKOŃCZENIA

Batch ukończony gdy:
- [ ] billingService podzielony na 3 moduły
- [ ] DI zaimplementowane we wszystkich serwisach
- [ ] Testy jednostkowe napisane i przechodzą
- [ ] Dokumentacja zaktualizowana

---

## 📊 RAPORTOWANIE

Po każdym kroku aktualizuj `cursor_zadania/CODEX_PROGRESS.txt`:

```
### 2026-01-03 21:35
✅ BillingQueryService created
✅ BillingCommandService created
⏳ BillingEventService in progress
```

Po ukończeniu batcha:
```
🎉 BATCH 1 COMPLETE - Service refactoring done!
```

---

## 🚨 JEŚLI MASZ PROBLEM

1. Sprawdź istniejące wzorce DI w `server/services/aiService.ts`
2. Konsultuj `cursor_zadania/SHARED_LIBRARIES_PLAN.md`
3. Zgłoś w `cursor_zadania/TEAM_COORDINATION.md`

---

**KONTYNUUJ PRACĘ!** Zacznij od BillingQueryService! 🚀
