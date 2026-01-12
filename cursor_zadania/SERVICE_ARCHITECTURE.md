# 🏗️ SERVICE ARCHITECTURE UPDATE

**Date**: 2026-01-03 22:45  
**Agent**: Codex

---

## 1. Nowy podział `BillingService`

- `BillingQueryService` – wszystkie operacje odczytowe (`getPlans`, `getInvoices`, `getPay­mentMethods`, `getBillingAlerts`, `getTaxSettings`, `revenue stats`, itd.). Każda metoda pobiera `db` z kontenera zależności, wyniki mapowane bez duplikacji kodu.
- `BillingCommandService` – zapisy i mutacje (`createPlan`, `createSubscription`, `upsertOrgBilling`, `recordInvoice`, `addPaymentMethod`, `validateDiscountCode`, itd.). Wykorzystuje `BillingQueryService` do sprawdzania kontekstu (np. planów) oraz `BillingEventService` do emitowania zdarzeń.
- `BillingEventService` – prosty event emitter (`emitEvent`, `handleWebhook`) pozwalający podpiąć słuchaczy (np. webhooks lub dalszy przepływ danych).
- `BillingService` (fusion) – centralny punkt wywołań dla poprzedniego API. Inicjalizuje `BillingDependencyLoader`, dzieli logikę na warstwy i udostępnia dotychczasowe exporty (`createPlan`, `getInvoices`, `recordInvoice`, ...), więc zależne moduły nie musiały się zmieniać.

## 2. Dependency Injection

- `BillingDependencyLoader` (nowy) ładuje z `database/Database`, `uuid`, `stripe` i udostępnia `BillingServiceDependencies` (tylko `db`, `uuidv4`, `stripe`). Dzięki temu każdy moduł ma dostęp do jednej wersji zależności i można je nadpisać w testach.
- `setDependencies` w `BillingService` przekazano wprost do loadera, co pozwala testom na wstrzyknięcie mocków (np. `db` z `vi.fn()`).

## 3. Testy modułów

- Dodano unit testy dla `BillingQueryService` i `BillingCommandService`, które weryfikują podstawowe operacje (lista planów, `upsertOrgBilling`) przez podmianę `db` i `eventService`.

## 4. Eventy

- `BillingEventService` ma `EventEmitter`, dzięki któremu `BillingCommandService` może rejestrować i emitować zdarzenia (`billing.org.updated`, `billing.subscription.created`, itd.). W przyszłych iteracjach możemy podłączyć zewnętrzny event bus lub webhooki.

## 5. Co dalej

1. Dokończyć testy integracyjne na `BillingService`.
2. Zrefaktoryzować inne serwisy na podobną architekturę (np. `tokenBillingService.ts`).
3. Zaktualizować dokumentację API (np. `docs/api/BILLING_API.md`) po tym, jak udostępnimy eventy.
