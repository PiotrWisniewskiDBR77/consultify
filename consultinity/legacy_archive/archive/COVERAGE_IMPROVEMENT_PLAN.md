# Plan Zwiększenia Pokrycia Kodu do 90%

## 📊 Obecny Stan
- **Statements**: 27.78% → Cel: 90%
- **Branches**: 18.79% → Cel: 90%
- **Functions**: 23.64% → Cel: 90%
- **Lines**: 29.19% → Cel: 90%

## 🎯 Strategia

### Faza 1: Optymalizacja Konfiguracji (Priorytet: Wysoki)
- Wykluczyć scripts i workers z coverage (narzędzia pomocnicze)
- Wykluczyć seed files (dane testowe)
- Skoncentrować się na kodzie produkcyjnym

### Faza 2: Routes (21.91% → 90%) (Priorytet: Wysoki)
**24 pliki routes wymagają testów**

Najważniejsze routes do przetestowania:
1. ✅ projects.js (67.56% - już dobrze pokryte)
2. ⚠️ auth.js (33.09% - wymaga rozszerzenia)
3. ⚠️ tasks.js (25.88% - wymaga rozszerzenia)
4. ⚠️ initiatives.js (26.54% - wymaga rozszerzenia)
5. ⚠️ analytics.js (29.03% - wymaga rozszerzenia)
6. ⚠️ billing.js (15.15% - wymaga testów)
7. ⚠️ tokenBilling.js (19.23% - wymaga testów)
8. ⚠️ llm.js (17.17% - wymaga testów)
9. ⚠️ ai.js (21.51% - wymaga testów)
10. ⚠️ knowledge.js (47.57% - wymaga rozszerzenia)
11. ⚠️ notifications.js (23.43% - wymaga testów)
12. ⚠️ users.js (21.42% - wymaga testów)
13. ⚠️ settings.js (15.94% - wymaga testów)
14. ⚠️ sessions.js (15.9% - wymaga testów)
15. ⚠️ teams.js (14.7% - wymaga testów)
16. ⚠️ feedback.js (22.22% - wymaga testów)
17. ⚠️ superadmin.js (17.15% - wymaga testów)
18. ⚠️ webhooks.js (17.24% - wymaga testów)
19. ⚠️ invitations.js (0% - wymaga testów)
20. ⚠️ access-control.js (11.37% - wymaga testów)
21. ⚠️ ai-training.js (18.75% - wymaga testów)
22. ⚠️ aiAsync.js (26.08% - wymaga testów)
23. ⚠️ sso.js (66.66% - wymaga rozszerzenia)

### Faza 3: Services (37.98% → 90%) (Priorytet: Wysoki)
**Najsłabiej pokryte services:**
1. ⚠️ realtimeService.js (4.58% - wymaga testów)
2. ⚠️ retentionPolicyService.js (21.87% - wymaga testów)
3. ⚠️ storageReconciliationService.js (16.66% - wymaga testów)
4. ⚠️ webhookService.js (0% - wymaga testów)
5. ⚠️ webSearchService.js (20% - wymaga testów)
6. ⚠️ financialService.js (5.71% - wymaga testów)
7. ⚠️ feedbackService.js (26.66% - wymaga rozszerzenia)
8. ⚠️ billingService.js (17.39% - wymaga rozszerzenia)
9. ⚠️ tokenBillingService.js (25.69% - wymaga rozszerzenia)
10. ⚠️ usageService.js (32.06% - wymaga rozszerzenia)
11. ⚠️ ragService.js (35.29% - wymaga rozszerzenia)
12. ⚠️ aiService.js (50.25% - wymaga rozszerzenia)
13. ✅ analyticsService.js (77.14% - dobrze pokryte)
14. ✅ knowledgeService.js (79.36% - dobrze pokryte)
15. ✅ storageService.js (43.58% - częściowo pokryte)
16. ✅ activityService.js (28% - częściowo pokryte)

### Faza 4: Middleware (53.5% → 90%) (Priorytet: Średni)
**Najsłabiej pokryte middleware:**
1. ⚠️ superAdminMiddleware.js (28.57% - wymaga testów)
2. ⚠️ quotaMiddleware.js (31.57% - wymaga testów)
3. ⚠️ adminMiddleware.js (15.62% - wymaga testów)
4. ✅ authMiddleware.js (78.78% - dobrze pokryte)
5. ✅ planLimits.js (64.28% - częściowo pokryte)
6. ✅ projectQuotaMiddleware.js (76.47% - dobrze pokryte)
7. ✅ auditLog.js (91.66% - bardzo dobrze pokryte)

### Faza 5: Frontend (Priorytet: Średni)
- Dodać testy dla brakujących komponentów
- Dodać testy dla hooks
- Dodać testy dla context

## 📝 Plan Działania

### Krok 1: Aktualizacja Konfiguracji
- [x] Wykluczyć scripts z coverage
- [x] Wykluczyć workers z coverage
- [x] Wykluczyć seed files z coverage

### Krok 2: Testy Routes (Priorytet)
- [ ] Utworzyć testy dla billing.js
- [ ] Utworzyć testy dla tokenBilling.js
- [ ] Utworzyć testy dla llm.js
- [ ] Utworzyć testy dla ai.js
- [ ] Utworzyć testy dla notifications.js
- [ ] Utworzyć testy dla users.js
- [ ] Utworzyć testy dla settings.js
- [ ] Utworzyć testy dla sessions.js
- [ ] Utworzyć testy dla teams.js
- [ ] Utworzyć testy dla feedback.js
- [ ] Utworzyć testy dla superadmin.js
- [ ] Utworzyć testy dla webhooks.js
- [ ] Utworzyć testy dla invitations.js
- [ ] Rozszerzyć testy dla auth.js
- [ ] Rozszerzyć testy dla tasks.js
- [ ] Rozszerzyć testy dla initiatives.js
- [ ] Rozszerzyć testy dla analytics.js
- [ ] Rozszerzyć testy dla knowledge.js

### Krok 3: Testy Services
- [ ] Utworzyć testy dla realtimeService.js
- [ ] Utworzyć testy dla webhookService.js
- [ ] Utworzyć testy dla webSearchService.js
- [ ] Rozszerzyć testy dla financialService.js
- [ ] Rozszerzyć testy dla feedbackService.js
- [ ] Rozszerzyć testy dla billingService.js
- [ ] Rozszerzyć testy dla tokenBillingService.js
- [ ] Rozszerzyć testy dla usageService.js
- [ ] Rozszerzyć testy dla ragService.js
- [ ] Rozszerzyć testy dla aiService.js

### Krok 4: Testy Middleware
- [ ] Utworzyć testy dla superAdminMiddleware.js
- [ ] Utworzyć testy dla quotaMiddleware.js
- [ ] Utworzyć testy dla adminMiddleware.js
- [ ] Rozszerzyć testy dla planLimits.js

### Krok 5: Weryfikacja
- [ ] Uruchomić testy z coverage
- [ ] Sprawdzić osiągnięcie 90% pokrycia
- [ ] Naprawić ewentualne problemy

## 🎯 Metryki Sukcesu
- ✅ Statements: ≥ 90%
- ✅ Branches: ≥ 90%
- ✅ Functions: ≥ 90%
- ✅ Lines: ≥ 90%

