# Agent 3: Prawdziwe testy (Real Tests)

**Rola:** Napisanie prawdziwych testów P0 — import z src/server, testowanie rzeczywistego zachowania.

**Priorytet:** TRZECI — może startować równolegle z Agent 2 (po zakończeniu Agent 1).

---

## Zasady (OBOWIĄZKOWE)

1. **Importuj** z `src/` lub `server/src/` — nie twórz lokalnych obiektów do asercji
2. **Testuj zachowanie** — wywołuj funkcje, sprawdzaj wyniki
3. **Używaj prawdziwej bazy** w integration (SQLite in-memory lub test DB)
4. **NIE** `expect(true).toBe(true)` ani `expect(localObj.prop).toBe(...)` na obiekcie stworzonym w teście

---

## Zadania (w kolejności)

### Zadanie 3.1: L1 Unit — authMiddleware

**Plik do naprawy/utworzenia:** `tests/unit/backend/middleware/authMiddleware.test.ts` (lub .js)

**Cel:** Testować `server/src/middleware/authMiddleware` — weryfikacja tokena, odrzucenie expired/invalid.

**Wzorzec:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { verifyToken, authMiddleware } from '@/server/src/middleware/authMiddleware';

describe('authMiddleware', () => {
  it('should reject missing Authorization header', async () => {
    const req = { headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject invalid token format', async () => {
    const req = { headers: { authorization: 'InvalidFormat' } } as any;
    // ... test
  });

  it('should accept valid token and set req.user', async () => {
    // Użyj JWT.sign z testowym payloadem
    // Wywołaj middleware
    // expect(req.user).toBeDefined()
  });
});
```

**Minimum:** 3 testy (missing, invalid, valid).

---

### Zadanie 3.2: L1 Unit — accessPolicyService (lub billingService)

**Plik:** `tests/unit/backend/accessPolicyService.test.ts` LUB `tests/unit/backend/services/billingService.test.ts`

**Cel:** Importować serwis, wywołać metodę z prawdziwymi parametrami, sprawdzić wynik.

**Wzorzec:**

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { AccessPolicyService } from '@/server/src/services/accessPolicyService';
// lub
import { BillingService } from '@/server/src/services/billingService';

describe('AccessPolicyService', () => {
  it('should check user permission for resource', async () => {
    const result = await AccessPolicyService.canAccess(userId, resourceId, 'read');
    expect(typeof result).toBe('boolean');
    // Konkretna asercja w zależności od API
  });
});
```

**Minimum:** 2 testy na wybrany serwis.

---

### Zadanie 3.3: L2 Component — Auth/Login

**Plik:** `tests/components/auth/LoginForm.test.tsx` LUB istniejący w `tests/components/auth/`

**Cel:** Importować komponent z `src/components/auth/`, renderować, testować interakcje.

**Wzorzec:**

```typescript
import { render, screen, userEvent } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm'; // dostosuj ścieżkę

describe('LoginForm', () => {
  it('should render email and password fields', () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('should call onSubmit with credentials on submit', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'test@test.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: /login|zaloguj/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@test.com' }));
  });
});
```

**Minimum:** 2 testy.

---

### Zadanie 3.4: L3 Integration — POST /api/auth/login

**Plik:** `tests/integration/auth.test.ts` (lub auth.test.js)

**Cel:** supertest + prawdziwy app, request do `/api/auth/login`, sprawdzenie statusu i body.

**Wzorzec:**

```typescript
import request from 'supertest';
import { app } from '../../server/src/index'; // dostosuj import

describe('POST /api/auth/login', () => {
  it('should return 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('should return 200 and token for valid credentials', async () => {
    // Użyj seedowanego użytkownika (np. demo@legolex.com)
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@legolex.com', password: 'Demo123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
```

**Minimum:** 2 testy (401, 200).

**Uwaga:** Sprawdź czy `server/src/index` eksportuje `app`. Może być `default` lub named export.

---

### Zadanie 3.5: L5 Security — SQL Injection

**Plik:** `tests/security/sql-injection.test.js` (lub .ts)

**Cel:** Wysłać payload SQLi do endpointu, sprawdzić że nie wykonuje się (400/500, nie 200 z danymi).

**Wzorzec:**

```javascript
import request from 'supertest';
import { app } from '../../server/src/index.js';

describe('SQL Injection prevention', () => {
  it('should reject SQLi in login email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: "admin'--", password: 'x' });
    expect(res.status).not.toBe(200);
    expect(res.body).not.toHaveProperty('token');
  });

  it('should reject SQLi in query param', async () => {
    const res = await request(app).get('/api/projects?id=1; DROP TABLE users--');
    expect(res.status).toBeLessThan(500);
  });
});
```

**Minimum:** 2 testy.

---

## Kryteria ukończenia (Agent 3)

- [ ] L1: authMiddleware — min. 3 testy, import z server
- [ ] L1: accessPolicyService LUB billingService — min. 2 testy
- [ ] L2: Komponent Auth/Login — min. 2 testy, import z src
- [ ] L3: POST /api/auth/login — min. 2 testy, supertest
- [ ] L5: SQL Injection — min. 2 testy
- [ ] Wszystkie nowe testy przechodzą: `npm run test:unit` + `npm run test:integration` + `npm run test:security`
- [ ] `npm run test:quality-check` — autentyczność ≥ 25% (lub wyższy próg po naprawach)

---

## Raportowanie

```
AGENT 3 - RAPORT UKOŃCZENIA
Data: [DATA]
- authMiddleware: [N] testów
- accessPolicy/billing: [N] testów
- Component Auth: [N] testów
- Integration auth: [N] testów
- Security SQLi: [N] testów
- test:quality-check autentyczność: [X]%
- Problemy: [OPIS LUB BRAK]
```

---

## Uwagi

- Jeśli plik już istnieje i ma placeholdery — **zastąp** je prawdziwymi testami, nie dodawaj obok
- Sprawdź `tests/setup.ts` — mocks mogą wymagać konfiguracji dla integration (MOCK_DB=false)
- Wzorcowe testy: `tests/integration/auth.test.js` (jeśli istnieje i jest prawdziwy)
