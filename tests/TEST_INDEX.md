# Indeks Testów - Szybki Przewodnik

## 📊 Statystyki Testów

| Poziom | Zaimplementowane | Do Utworzenia | Status |
|--------|------------------|---------------|--------|
| **Poziom 1: Unit** | ~144 | ~50+ | 🟡 74% |
| **Poziom 2: Component** | ~52 | ~150+ | 🟡 26% |
| **Poziom 3: Integration** | ~44 | ~80+ | 🟡 35% |
| **Poziom 4: E2E** | ~5 | ~20+ | 🟡 20% |
| **Poziom 5: Performance** | ~4 | ~12+ | 🟡 25% |
| **Backend** | ~3 | ~5+ | 🟡 38% |
| **RAZEM** | **~252** | **~317+** | **🟡 44%** |

## 🎯 Priorytety Implementacji

### 🔴 Krytyczne (Wysoki Priorytet)
- [ ] `tests/components/ErrorBoundary.test.tsx` ✅ (istnieje)
- [ ] `tests/components/auth/MFAChallenge.test.tsx`
- [ ] `tests/components/auth/MFASetup.test.tsx`
- [ ] `tests/integration/routes/auth.test.js`
- [ ] `tests/integration/routes/billing.test.js`
- [ ] `tests/unit/backend/middleware/authMiddleware.test.js` ✅ (istnieje)
- [ ] `tests/unit/backend/middleware/rbac.test.js`
- [ ] `tests/unit/backend/middleware/permissionMiddleware.test.js`
- [ ] `tests/e2e/security.spec.ts`

### 🟠 Ważne (Średni Priorytet)
- [ ] `tests/components/AIAnalyticsDashboard.test.tsx`
- [ ] `tests/components/FullPilotWorkspace.test.tsx`
- [ ] `tests/components/FullRolloutWorkspace.test.tsx`
- [ ] `tests/integration/routes/ai.test.js`
- [ ] `tests/integration/routes/projects.test.js` ✅ (istnieje)
- [ ] `tests/integration/routes/initiatives.test.js` ✅ (istnieje)
- [ ] `tests/unit/backend/aiPlaybookService.test.js`
- [ ] `tests/unit/backend/asyncJobService.test.js`
- [ ] `tests/e2e/initiatives.spec.ts`
- [ ] `tests/e2e/aiPlaybooks.spec.ts`

### 🟡 Pomocnicze (Niski Priorytet)
- [ ] `tests/components/Onboarding/OnboardingWizard.test.tsx`
- [ ] `tests/components/Help/HelpContent.test.tsx`
- [ ] `tests/components/settings/*.test.tsx`
- [ ] `tests/integration/routes/settings.test.js`
- [ ] `tests/integration/routes/help.test.js`

## 📁 Struktura Katalogów

```
tests/
├── unit/                    # Poziom 1: Unit Tests
│   ├── backend/            # Backend services
│   │   ├── middleware/     # Middleware tests
│   │   └── *.test.js      # Service tests
│   ├── hooks/             # React hooks
│   └── *.test.ts          # Frontend services
│
├── components/             # Poziom 2: Component Tests
│   ├── Admin/             # Admin components
│   ├── ai/                # AI components
│   ├── assessment/        # Assessment components
│   ├── auth/              # Auth components
│   ├── billing/           # Billing components
│   └── *.test.tsx         # Component tests
│
├── integration/            # Poziom 3: Integration Tests
│   ├── routes/            # Route integration tests
│   ├── backend/           # Backend integration
│   └── *.test.js          # Integration tests
│
├── e2e/                    # Poziom 4: E2E Tests
│   └── *.spec.ts          # E2E test specs
│
├── performance/            # Poziom 5: Performance Tests
│   └── *.test.js          # Performance tests
│
├── backend/                # Backend Tests
│   └── *.test.js          # Backend-specific tests
│
├── helpers/                # Test Helpers
│   └── dbHelper.cjs       # Database helper
│
├── fixtures/               # Test Fixtures
│   └── testData.js        # Test data
│
└── utils/                  # Test Utilities
    └── testUtils.js       # Test utilities
```

## 🔍 Szybkie Wyszukiwanie

### Komponenty bez Testów
```bash
# Znajdź komponenty bez testów
find components -name "*.tsx" -not -name "*.test.tsx" | while read f; do
  test_file="tests/components/$(basename $f .tsx).test.tsx"
  [ ! -f "$test_file" ] && echo "Brakuje: $test_file"
done
```

### Serwisy bez Testów
```bash
# Znajdź serwisy bez testów
find server/services -name "*.js" -not -name "*.test.js" | while read f; do
  test_file="tests/unit/backend/$(basename $f .js).test.js"
  [ ! -f "$test_file" ] && echo "Brakuje: $test_file"
done
```

### Trasy bez Testów
```bash
# Znajdź trasy bez testów
find server/routes -name "*.js" -not -name "*.test.js" | while read f; do
  test_file="tests/integration/routes/$(basename $f .js).test.js"
  [ ! -f "$test_file" ] && echo "Brakuje: $test_file"
done
```

## 📝 Szablony Testów

### Unit Test - Backend Service
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initTestDb, cleanTables } from '../../helpers/dbHelper.cjs';

describe('ServiceName', () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(async () => {
    await cleanTables();
  });

  it('should do something', async () => {
    // Test implementation
  });
});
```

### Component Test
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComponentName from '@/components/ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Integration Test - Route
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server/index.js';

describe('POST /api/route', () => {
  it('should handle request', async () => {
    const response = await request(app)
      .post('/api/route')
      .send({ data: 'test' });
    
    expect(response.status).toBe(200);
  });
});
```

### E2E Test
```typescript
import { test, expect } from '@playwright/test';

test('should complete user flow', async ({ page }) => {
  await page.goto('/');
  await page.click('button');
  await expect(page.locator('text=Success')).toBeVisible();
});
```

## 🚀 Uruchamianie Testów

```bash
# Wszystkie testy
npm run test:all

# Konkretny poziom
npm run test:unit
npm run test:component
npm run test:integration
npm run test:e2e
npm run test:performance

# Z pokryciem
npm run test:coverage

# Konkretny plik
npm run test:unit -- tests/unit/backend/service.test.js
```

## 📚 Dokumentacja

- [TEST_STRUCTURE_COMPLETE.md](./TEST_STRUCTURE_COMPLETE.md) - Pełna struktura testów
- [README.md](./README.md) - Quick start guide
- [README_COMPREHENSIVE.md](./README_COMPREHENSIVE.md) - Kompletna dokumentacja
- [SUMMARY.md](./SUMMARY.md) - Podsumowanie

## ✅ Checklist Implementacji

### Faza 1: Krytyczne Komponenty
- [ ] ErrorBoundary ✅
- [ ] Auth components
- [ ] Billing components
- [ ] Security middleware

### Faza 2: Główne Komponenty
- [ ] Dashboard components
- [ ] Workspace components
- [ ] Modal components
- [ ] Form components

### Faza 3: Serwisy
- [ ] AI services
- [ ] Database services
- [ ] API services
- [ ] Integration services

### Faza 4: Trasy
- [ ] Auth routes
- [ ] API routes
- [ ] Admin routes
- [ ] Integration routes

### Faza 5: E2E
- [ ] User flows
- [ ] Critical paths
- [ ] Error scenarios
- [ ] Performance scenarios

---

**Ostatnia aktualizacja**: 2024-12-27
**Status**: W trakcie implementacji

---

## 📁 Szablony Testów

Dostępne szablony w `tests/templates/`:

| Szablon | Opis | Użycie |
|---------|------|--------|
| `middleware.test.template.js` | Test middleware Express | Security, RBAC, Guards |
| `component.test.template.tsx` | Test komponentu React | Komponenty UI |
| `route.integration.test.template.js` | Test integracyjny tras API | REST endpoints |
| `e2e.test.template.ts` | Test E2E Playwright | User flows |
| `hook.test.template.ts` | Test hooka React | Custom hooks |

## 📚 Dokumentacja Rozszerzona

- [TEST_COVERAGE_EXPANSION_PLAN.md](../docs/testing/TEST_COVERAGE_EXPANSION_PLAN.md) - Pełny plan pokrycia
- [TEST_PROGRESS_TRACKER.md](../docs/testing/TEST_PROGRESS_TRACKER.md) - Tracker postępu





