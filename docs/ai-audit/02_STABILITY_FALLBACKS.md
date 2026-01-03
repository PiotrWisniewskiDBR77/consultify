# Audyt Stabilności: Fallback Mechanisms - Enterprise Audit Report

**Data audytu:** 2025-01-02  
**Status:** ✅ Analiza zakończona

---

## 1. Executive Summary

System implementuje **inteligentne mechanizmy fallback** na wielu poziomach:
1. **Provider-level fallback** - automatyczne przełączanie między providerami LLM
2. **Tier-based fallback chains** - różne łańcuchy dla różnych poziomów jakości
3. **Budget-aware downgrade** - automatyczne przełączanie na tańsze modele przy przekroczeniu budżetu
4. **Health-aware routing** - unikanie niezdrowych providerów

**Ogólna ocena:** ⚠️ **Działa, ale wymaga konsolidacji i ulepszeń**

---

## 2. Analiza Implementacji

### 2.1 LLM Fallback Service (llmFallbackService.js)

**Lokalizacja:** `server/services/llmFallbackService.js`

**Charakterystyka:**
- ✅ **Multi-provider fallback chains** - różne łańcuchy dla różnych tierów
- ✅ **Network connectivity monitoring** - sprawdza dostępność providerów co 60s
- ✅ **Circuit breaker integration** - sprawdza stan circuit breaker przed użyciem
- ✅ **Health tracking** - śledzi zdrowie każdego providera
- ✅ **Graceful degradation** - zwraca informacyjne komunikaty przy całkowitej awarii
- ⚠️ **Duplikacja fallback chains** - zdefiniowane również w `modelRouter.js`

**Fallback Chains:**
```javascript
const FALLBACK_CHAINS = {
    BUDGET: ['deepseek-chat', 'qwen-turbo', 'gpt-4o-mini', 'gemini-1.5-flash'],
    STANDARD: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'deepseek-chat'],
    PREMIUM: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'o1-preview'],
    REASONING: ['o1-preview', 'o1', 'claude-3-opus', 'gpt-4o'],
    VISION: ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet'],
    CODING: ['deepseek-coder', 'gpt-4o', 'claude-3-5-sonnet']
};
```

**Status:** ✅ **Działa poprawnie**

---

### 2.2 Model Router (ai/modelRouter.js)

**Lokalizacja:** `server/services/ai/modelRouter.js`

**Charakterystyka:**
- ✅ **Dynamic tier-based selection** - wybór modelu na podstawie tieru
- ✅ **Round-robin selection** - równomierne rozłożenie obciążenia
- ✅ **Cross-tier fallback** - fallback między tierami gdy wszystkie modele w tierze zawodzą
- ✅ **Health-aware routing** - unika niezdrowych providerów
- ⚠️ **Duplikacja fallback chains** - zdefiniowane również w `llmFallbackService.js`

**Tier Hierarchy:**
```javascript
const TIER_HIERARCHY = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];
const TIER_FALLBACK_CHAINS = {
    'BUDGET': ['gpt-4o-mini', 'deepseek-chat', 'gemini-1.5-flash', 'qwen-turbo'],
    'STANDARD': ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet', 'command-r-plus'],
    'PREMIUM': ['gpt-4o', 'claude-3-opus', 'gemini-1.5-pro', 'meta/llama-3.1-405b-instruct'],
    'REASONING': ['o1-preview', 'gpt-4o', 'deepseek-chat', 'claude-3-opus']
};
```

**Status:** ✅ **Działa poprawnie, ale duplikacja wymaga rozwiązania**

---

### 2.3 Cost Control Service - Automatic Downgrade

**Lokalizacja:** `server/services/aiCostControlService.js`

**Charakterystyka:**
- ✅ **Budget tracking** - śledzi użycie na poziomie global/tenant/project
- ✅ **shouldDowngrade flag** - wskazuje kiedy należy downgrade'ować (≥80% użycia)
- ✅ **getTierForBudget()** - zwraca odpowiedni tier na podstawie budżetu
- ⚠️ **Brak automatycznego downgrade** - funkcja istnieje, ale nie jest używana automatycznie
- ⚠️ **Logowanie downgrade** - `was_downgraded` w `ai_usage_log`, ale nie jest automatycznie ustawiane

**Logika Downgrade:**
```javascript
getTierForBudget: (budgetStatus, preferredCategory) => {
    const baseTier = CATEGORY_TIER_PREFERENCE[preferredCategory] || 2;
    
    if (!budgetStatus.shouldDowngrade) {
        return baseTier;
    }
    
    const percentUsed = budgetStatus.percentUsed || 0;
    
    if (percentUsed >= 95) {
        return 3; // Force budget tier
    } else if (percentUsed >= 90) {
        return Math.min(3, baseTier + 1);
    } else if (percentUsed >= 80) {
        return Math.min(3, baseTier);
    }
    
    return baseTier;
}
```

**Status:** ⚠️ **Częściowo zaimplementowane - wymaga integracji**

---

## 3. Testy Funkcjonalności

### 3.1 Test: Fallback Chain - Premium → Standard → Budget

**Scenariusz:** OpenAI (PREMIUM) zwraca błąd → fallback do Standard → fallback do Budget

**Wynik:**
- ✅ `llmFallbackService.executeWithFallback()` próbuje kolejnych providerów w chain
- ✅ Sprawdza circuit breaker status przed każdą próbą
- ✅ Sprawdza health status przed każdą próbą
- ✅ Zwraca informację o użytym fallback (`usedFallback: true`)

**Kod:**
```javascript
// llmFallbackService.js - executeWithFallback()
while (attempt < maxRetries) {
    providerInfo = await this.selectFallbackProvider(
        effectiveTier,
        null,
        { failedProviders, multiModel: aiConfig.multiModel }
    );
    
    const result = await llmCallFn(providerInfo);
    return { success: true, usedFallback: attempt > 1, ... };
}
```

**Status:** ✅ **Pass**

---

### 3.2 Test: Automatic Downgrade przy Przekroczeniu Budżetu

**Scenariusz:** Org z budżetem $1000/mo osiąga 80% użycia → automatyczny downgrade

**Wynik:**
- ⚠️ **`shouldDowngrade` jest ustawiane** gdy `percentUsed >= 80`
- ⚠️ **`getTierForBudget()` zwraca niższy tier** na podstawie użycia
- ❌ **Brak automatycznego użycia** - funkcja nie jest wywoływana automatycznie w `aiOrchestrator` lub `modelRouter`
- ❌ **Brak logowania downgrade** - `was_downgraded` nie jest ustawiane

**Kod:**
```javascript
// aiCostControlService.js - checkBudget()
shouldDowngrade: percentUsed >= 80, // Start downgrading at 80%

// getTierForBudget() - zwraca tier, ale nie jest używane automatycznie
```

**Status:** ⚠️ **Partial - wymaga integracji**

---

### 3.3 Test: Quality Preservation przy Fallback

**Scenariusz:** Czy fallback nie powoduje drastycznego spadku jakości?

**Wynik:**
- ✅ **Tier-based fallback** - fallback pozostaje w tym samym tierze jeśli możliwe
- ✅ **Cross-tier fallback** - tylko gdy wszystkie modele w tierze zawodzą
- ⚠️ **Brak metryk jakości** - nie ma śledzenia jakości odpowiedzi po fallback

**Status:** ⚠️ **Działa, ale brak metryk jakości**

---

### 3.4 Test: User Notification o Zmianie Modelu

**Scenariusz:** Czy użytkownik jest informowany o zmianie modelu?

**Wynik:**
- ⚠️ **Brak automatycznego powiadomienia** - użytkownik nie jest informowany o fallback
- ⚠️ **Metadata w odpowiedzi** - `usedFallback: true` jest zwracane, ale nie jest wyświetlane w UI
- ❌ **Brak komunikatu** - brak informacji dla użytkownika o zmianie modelu

**Status:** ❌ **Fail - wymaga implementacji**

---

## 4. Integracja z Systemem

### 4.1 Użycie w aiOrchestrator.js

**Weryfikacja:**
- ⚠️ **Brak bezpośredniego użycia** - `aiOrchestrator` nie używa `llmFallbackService` bezpośrednio
- ⚠️ **Brak użycia `getTierForBudget()`** - downgrade nie jest automatyczny
- ✅ **Model selection** - używa `modelRouter` do wyboru modelu

**Status:** ⚠️ **Wymaga integracji**

---

### 4.2 Użycie w aiPipeline.js

**Weryfikacja:**
- ⚠️ **Wymaga sprawdzenia** - należy zweryfikować czy `aiPipeline` używa fallback mechanisms

**Status:** ⚠️ **Do weryfikacji**

---

## 5. Health Monitoring

### 5.1 Provider Health Checks

**Implementacja:**
- ✅ **Automatic health checks** - co 60s (`startHealthMonitoring()`)
- ✅ **Connectivity checks** - sprawdza dostępność endpointów
- ✅ **Latency tracking** - śledzi opóźnienia
- ✅ **Circuit breaker integration** - aktualizuje circuit breaker state

**Kod:**
```javascript
// llmFallbackService.js - checkAllProviders()
async checkAllProviders() {
    const providers = await this.getActiveProviders();
    
    for (const provider of providers) {
        const status = await this.checkProviderConnectivity(providerType);
        providerHealth.set(providerType, { ...status, lastCheck: Date.now() });
        
        // Update circuit breaker if healthy
        if (status.available) {
            const breaker = CircuitBreakerService.getBreaker(`llm-${providerType}`);
            if (breaker.state === 'OPEN') {
                breaker.state = 'HALF_OPEN'; // Force retry
            }
        }
    }
}
```

**Status:** ✅ **Działa poprawnie**

---

### 5.2 Health-Aware Routing

**Implementacja:**
- ✅ **Health check przed użyciem** - `selectFallbackProvider()` sprawdza health
- ✅ **Skip unhealthy providers** - pomija providerów z `available: false`
- ✅ **Circuit breaker check** - pomija providerów z circuit breaker OPEN

**Status:** ✅ **Działa poprawnie**

---

## 6. Findings i Problemy

### 6.1 Critical Issues

**Brak:**
- ❌ **Automatyczny downgrade** - `getTierForBudget()` nie jest używane automatycznie
- ❌ **User notification** - brak powiadomień o zmianie modelu
- ❌ **Quality metrics** - brak śledzenia jakości po fallback

**Status:** ❌ **Blocker przed Enterprise Deployment**

---

### 6.2 Medium Issues

**Problemy:**
- ⚠️ **Duplikacja fallback chains** - zdefiniowane w `llmFallbackService.js` i `modelRouter.js`
- ⚠️ **Brak konsolidacji** - dwa różne serwisy robią podobne rzeczy
- ⚠️ **Brak logowania downgrade** - `was_downgraded` nie jest automatycznie ustawiane

**Status:** ⚠️ **Wymaga poprawy**

---

### 6.3 Low Issues

**Usprawnienia:**
- 💡 **Fallback analytics** - dashboard pokazujący częstotliwość fallbacków
- 💡 **Quality comparison** - porównanie jakości odpowiedzi między modelami
- 💡 **Custom fallback chains** - możliwość konfiguracji per-organization

**Status:** 💡 **Nice to have**

---

## 7. Testy Manualne

### 7.1 Test: Symulacja Awarii OpenAI

**Kroki:**
1. Wywołanie AI z nieprawidłowym API key OpenAI
2. Obserwacja fallback do następnego providera

**Wynik:**
- ✅ Fallback działa automatycznie
- ⚠️ Użytkownik nie jest informowany o zmianie

**Status:** ⚠️ **Partial Pass**

---

### 7.2 Test: Symulacja Przekroczenia Budżetu

**Kroki:**
1. Ustawienie budżetu $100 dla org
2. Wykonanie wielu wywołań AI do osiągnięcia 80% użycia
3. Obserwacja automatycznego downgrade

**Wynik:**
- ❌ **Downgrade nie działa automatycznie** - `getTierForBudget()` nie jest wywoływane
- ⚠️ `shouldDowngrade` jest ustawiane, ale nie jest używane

**Status:** ❌ **Fail**

---

### 7.3 Test: Fallback Chain Exhaustion

**Kroki:**
1. Symulacja awarii wszystkich providerów w fallback chain
2. Obserwacja graceful degradation

**Wynik:**
- ✅ **Graceful degradation** - zwraca informacyjny komunikat
- ✅ **PMO functions continue** - core funkcje PMO działają dalej

**Status:** ✅ **Pass**

---

## 8. Kryteria Sukcesu - Ocena

| Kryterium | Status | Uwagi |
|-----------|--------|-------|
| ✅ Fallback działa automatycznie | ✅ Pass | Działa dla provider failures |
| ⚠️ Użytkownik jest informowany o zmianie modelu | ⚠️ Warning | Metadata zwracane, ale nie wyświetlane |
| ⚠️ Jakość odpowiedzi pozostaje akceptowalna | ⚠️ Warning | Działa, ale brak metryk jakości |
| ❌ Automatic downgrade przy przekroczeniu budżetu | ❌ Fail | Funkcja istnieje, ale nie jest używana |

**Ogólna ocena:** ⚠️ **60/100** - Działa częściowo, wymaga integracji automatycznego downgrade

---

## 9. Rekomendacje

### P0 (Blocker przed Enterprise Deployment)

1. **Zintegruj automatyczny downgrade**
   - Wywołaj `getTierForBudget()` w `aiOrchestrator` przed wyborem modelu
   - Użyj zwróconego tieru do wyboru modelu przez `modelRouter`
   - Ustaw `was_downgraded: true` w `logUsage()` gdy tier został downgrade'owany

2. **Dodaj user notification o zmianie modelu**
   - Wyświetl komunikat w UI gdy `usedFallback: true`
   - Informuj użytkownika o downgrade modelu przy przekroczeniu budżetu
   - Dodaj badge/indicator pokazujący aktualnie używany model

3. **Konsoliduj fallback chains**
   - Wybierz jedno źródło prawdy (np. `modelRouter.js`)
   - Usuń duplikację z `llmFallbackService.js`
   - Użyj `modelRouter` jako głównego źródła fallback chains

### P1 (Critical)

4. **Dodaj quality metrics**
   - Śledź jakość odpowiedzi po fallback
   - Porównuj jakość między modelami
   - Alert gdy jakość spada poniżej threshold

5. **Ulepsz logowanie downgrade**
   - Automatycznie ustawiaj `was_downgraded` w `logUsage()`
   - Dodaj `downgrade_reason` (budget, circuit_breaker, health_check)
   - Dashboard pokazujący częstotliwość downgrade'ów

### P2 (Important)

6. **Dodaj fallback analytics**
   - Dashboard z metrykami fallback frequency
   - Wykresy pokazujące które providerzy najczęściej zawodzą
   - Alerty gdy fallback frequency przekracza threshold

7. **Custom fallback chains per organization**
   - Pozwól organizacjom konfigurować własne fallback chains
   - Priority-based selection per organization
   - A/B testing różnych chains

---

## 10. Test Cases do Implementacji

### Test Case 1: Automatic Downgrade Integration
```javascript
it('should automatically downgrade tier when budget exceeds 80%', async () => {
    // Set budget to $100
    await AICostControlService.setTenantBudget('org-1', 100);
    
    // Simulate 80% usage
    await AICostControlService._updateBudgetUsage('org-1', null, 80);
    
    // Check budget
    const budgetStatus = await AICostControlService.checkBudget('org-1', null, 1);
    expect(budgetStatus.shouldDowngrade).toBe(true);
    
    // Get tier for budget
    const tier = AICostControlService.getTierForBudget(budgetStatus, 'REASONING');
    expect(tier).toBeGreaterThan(1); // Should be downgraded from premium
    
    // Verify modelRouter uses downgraded tier
    const model = await modelRouter.select({ 
        tier: TIER_HIERARCHY[tier - 1], 
        organizationId: 'org-1' 
    });
    expect(model.tier).toBe('STANDARD'); // Or BUDGET depending on tier
});
```

### Test Case 2: User Notification
```javascript
it('should notify user when fallback is used', async () => {
    const result = await llmFallbackService.executeWithFallback(
        mockLLMCall,
        { tier: 'PREMIUM', initialProvider: { modelId: 'gpt-4o' } }
    );
    
    expect(result.usedFallback).toBe(true);
    expect(result.provider).not.toBe('gpt-4o');
    
    // Verify UI receives notification
    expect(mockUINotification).toHaveBeenCalledWith({
        type: 'MODEL_FALLBACK',
        originalModel: 'gpt-4o',
        fallbackModel: result.provider,
        reason: 'CIRCUIT_BREAKER_OPEN'
    });
});
```

### Test Case 3: Fallback Chain Exhaustion
```javascript
it('should return graceful degradation when all providers fail', async () => {
    // Mock all providers to fail
    mockLLMCall.mockRejectedValue(new Error('Service unavailable'));
    
    const result = await llmFallbackService.executeWithFallback(
        mockLLMCall,
        { tier: 'PREMIUM', maxRetries: 3 }
    );
    
    expect(result.success).toBe(false);
    expect(result.gracefulDegradation).toBeDefined();
    expect(result.gracefulDegradation.message).toContain('temporarily unavailable');
});
```

---

**Następny krok:** Task 2.3 - Stress Testing & Latency Analysis


