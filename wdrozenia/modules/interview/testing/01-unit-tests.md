# Interview – Testy

## Status: ✅ ZAIMPLEMENTOWANE (E2E)

**E2E Tests:** `tests/e2e/interview.spec.ts`

---

## 📋 Pokrycie Testami

### E2E Tests (Playwright)

| Test                   | Opis                                | Status |
| ---------------------- | ----------------------------------- | ------ |
| Display interview view | Sprawdza czy widok się ładuje       | ✅     |
| Show 5 categories      | Sprawdza 5 kategorii w sidebar      | ✅     |
| Show 4 tabs            | Questions, Notes, Evidence, Summary | ✅     |
| Start new session      | Tworzenie nowej sesji               | ✅     |
| Switch categories      | Przełączanie między kategoriami     | ✅     |
| Switch tabs            | Przełączanie między tabami          | ✅     |
| Display questions      | Task-list style pytania             | ✅     |
| Company Facts panel    | Panel faktów o firmie               | ✅     |
| Progress indicator     | Wskaźnik postępu                    | ✅     |
| Add custom question    | Dodawanie pytań                     | ✅     |
| History tab            | Historia sesji                      | ✅     |
| Complete interview     | Zakończenie wywiadu                 | ✅     |

### API Tests (E2E)

| Test                        | Opis                                   | Status |
| --------------------------- | -------------------------------------- | ------ |
| Create session via API      | POST /interview/sessions               | ✅     |
| Get organization context    | GET /interview/context                 | ✅     |
| Add question via API        | POST /interview/sessions/:id/questions | ✅     |
| Update question with answer | PATCH /interview/questions/:id         | ✅     |
| Create note via API         | POST /interview/sessions/:id/notes     | ✅     |

---

## 🧪 Przykładowe Testy

### UI Test - 5 Categories

```typescript
test('should show 5 interview categories', async ({ page }) => {
  await page.goto('/interview');

  const categories = ['Strategy', 'Operations', 'Digital', 'People', 'Finance'];

  for (const category of categories) {
    await expect(page.locator(`text=${category}`).first()).toBeVisible();
  }
});
```

### UI Test - 4 Tabs

```typescript
test('should show 4 tabs', async ({ page }) => {
  await page.goto('/interview');
  await page.waitForSelector('text=Strategy');

  const tabs = ['Questions', 'Notes', 'Evidence', 'Summary'];

  for (const tab of tabs) {
    await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
  }
});
```

### API Test - Create Session

```typescript
test('should create interview session via API', async ({ request }) => {
  const loginResponse = await request.post('/api/auth/login', {
    data: { email: 'test@example.com', password: 'test' },
  });

  const { token } = await loginResponse.json();

  const sessionResponse = await request.post('/api/interview/sessions', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Test Interview Session' },
  });

  expect(sessionResponse.ok()).toBeTruthy();
  const session = await sessionResponse.json();
  expect(session.id).toBeDefined();
  expect(session.status).toBe('active');
});
```

### API Test - Update Question

```typescript
test('should update question with answer and status', async ({ request }) => {
  // ... setup ...

  const updateResponse = await request.patch(`/api/interview/questions/${question.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      answerText: 'We have issues with manual processes.',
      status: 'answered',
      confidenceScore: 4,
      tags: ['risk', 'priority'],
    },
  });

  expect(updateResponse.ok()).toBeTruthy();
  const updated = await updateResponse.json();
  expect(updated.status).toBe('answered');
  expect(updated.confidenceScore).toBe(4);
});
```

---

## 📊 Krytyczna Ścieżka (E2E)

```
1. Login
   ↓
2. Navigate to /interview
   ↓
3. Create new session
   ↓
4. Answer questions (all categories)
   ↓
5. Add notes
   ↓
6. Upload evidence
   ↓
7. Generate summary
   ↓
8. Export context to Tools/Assessment
```

---

## 🔧 Uruchomienie Testów

```bash
# Wszystkie testy E2E Interview
npx playwright test tests/e2e/interview.spec.ts

# Z UI (headed mode)
npx playwright test tests/e2e/interview.spec.ts --headed

# Konkretny test
npx playwright test tests/e2e/interview.spec.ts -g "should show 5 categories"

# Debug mode
npx playwright test tests/e2e/interview.spec.ts --debug
```

---

## 📝 Unit Tests (TODO - opcjonalne)

Obecnie moduł Interview ma pełne pokrycie E2E. Unit testy mogą być dodane dla:

| Komponent                 | Testy                            |
| ------------------------- | -------------------------------- |
| `InterviewController`     | Walidacja payloadów, permissions |
| `InterviewInsightService` | Generowanie promptów, parsing    |
| `QuestionCard`            | Renderowanie, status changes     |
| `TemplateBuilder`         | Walidacja formularza             |

### Przykład Unit Test (do dodania)

```typescript
// tests/unit/interview/InterviewController.test.ts
describe('InterviewController', () => {
  describe('createSession', () => {
    it('should require name', async () => {
      const req = mockRequest({ body: {} });
      const res = mockResponse();

      await InterviewController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
    });

    it('should create session with valid data', async () => {
      const req = mockRequest({
        body: { name: 'Test Session' },
        user: { id: 'user-1', organizationId: 'org-1' },
      });
      const res = mockResponse();

      await InterviewController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Session', status: 'active' })
      );
    });
  });
});
```

---

## ✅ Weryfikacja

- [x] E2E testy UI działają
- [x] E2E testy API działają
- [x] Krytyczna ścieżka pokryta
- [ ] Unit testy (opcjonalne)
- [ ] Coverage report
