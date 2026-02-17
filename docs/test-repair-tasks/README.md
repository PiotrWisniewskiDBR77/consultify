# 🔧 Test Repair Mission

## 📋 PRZEGLĄD

Projekt naprawy ~265+ fałszywych testów w Consultinity.

**Data:** 8 stycznia 2026  
**Deadline:** ASAP (prezentacja dla klienta)

---

## 🆕 PLAN 3 AGENTÓW + NADZÓR (2026-02-14)

**Nowy model:** 3 agenty + nadzór do pełnego sukcesu.

| Dokument                          | Opis                                                                  |
| --------------------------------- | --------------------------------------------------------------------- |
| **docs/TEST_REMEDIATION_PLAN.md** | Plan główny — 3 agenty, zależności, kryteria sukcesu                  |
| **AGENT-1-CLEANUP.md**            | Agent 1: Oczyszczenie (duplikaty, workflow)                           |
| **AGENT-2-INFRASTRUCTURE.md**     | Agent 2: Infrastruktura weryfikacji (quality-check, block-duplicates) |
| **AGENT-3-REAL-TESTS.md**         | Agent 3: Prawdziwe testy P0                                           |
| **SUPERVISOR-GUIDE.md**           | Przewodnik nadzorcy — checkpointy, weryfikacja                        |
| **PROMPT-FOR-3-AGENTS.md**        | Prompty do wklejenia dla agentów                                      |

**Kolejność:** Agent 1 → (Agent 2 + Agent 3 równolegle) → Weryfikacja końcowa.

---

## 🤖 DELEGACJA DO AGENTÓW (legacy 5-agent)

### Agent 1: Auth & Security (42 pliki)

📄 **Instrukcje:** `AGENT-1-AUTH-SECURITY.md`

- Testy autentykacji
- Testy bezpieczeństwa
- Middleware

### Agent 2: Backend & API (63 pliki)

📄 **Instrukcje:** `AGENT-2-BACKEND-API.md`

- Serwisy backendowe
- Utils
- Business logic

### Agent 3: Integration (80+ plików)

📄 **Instrukcje:** `AGENT-3-INTEGRATION.md`

- Testy integracyjne
- Testy route'ów
- Full flow scenarios

### Agent 4: Unit & Components (80+ plików)

📄 **Instrukcje:** `AGENT-4-UNIT-COMPONENTS.md`

- Komponenty React
- Hooks
- Store (Zustand)

### Agent 5: TypeScript & Critical Fixes (40 plików, 752 błędów)

📄 **Instrukcje:** `AGENT-5-TYPESCRIPT-CRITICAL.md`

- 🔴 **752 błędów TypeScript** (spadek z 766!)
- AI Services, Controllers, Routes
- Database & Middleware
- E2E testy (Playwright)

---

## 📦 PACZKI ZADAŃ - FAZA 2

### BATCH 2: Quick Fixes (15 min)

📄 **Instrukcje:** `BATCH-2-QUICK-FIXES.md`

- Ostatnie 7 fałszywych asercji `expect(true).toBe(true)`
- 4 pliki do naprawy

### BATCH 3: TypeScript Priority (2h)

📄 **Instrukcje:** `BATCH-3-TYPESCRIPT-PRIORITY.md`

- Top 10 plików z błędami TS
- Strategia naprawy
- Typy do dodania

---

## 🔴 AGENCI TYPESCRIPT (752 błędy → 4 agentów)

### TS-AGENT 1: SuperAdmin Controller (321 błędów)

📄 **Instrukcje:** `TS-AGENT-1-SUPERADMIN.md`

- 1 plik: `SuperAdminController.ts`
- Największy plik z błędami

### TS-AGENT 2: Routes (217 błędów)

📄 **Instrukcje:** `TS-AGENT-2-ROUTES.md`

- 8 plików routes
- superadmin.routes, ai-budgets, knowledge...

### TS-AGENT 3: AI Services (152 błędy)

📄 **Instrukcje:** `TS-AGENT-3-AI-SERVICES.md`

- 10 plików AI
- simulationEngine, policyEngine, asyncJobService...

### TS-AGENT 4: Middleware & Database (62 błędy)

📄 **Instrukcje:** `TS-AGENT-4-MIDDLEWARE.md`

- 8+ plików middleware i database
- quotaMiddleware, Database.ts, auth.middleware...

### 📊 Progress Report

📄 **Raport:** `PROGRESS-REPORT.md`

- Aktualny stan
- Metryki sukcesu
- Historia zmian

---

## 🗄️ DOSTĘP DO BAZY DANYCH

### Połączenie SQLite

```bash
# Bezpośrednie połączenie
sqlite3 server/consultinity.db

# Popularne komendy:
.tables                           # Lista tabel
.schema users                     # Schemat tabeli
SELECT * FROM users LIMIT 5;      # Pokaż użytkowników
SELECT * FROM organizations;       # Pokaż organizacje
```

### Pobranie danych testowych

```bash
# Demo user
sqlite3 server/consultinity.db "SELECT id, email, role FROM users WHERE email='demo@legolex.com';"

# Wszystkie tabele z liczbą rekordów
sqlite3 server/consultinity.db "SELECT name, (SELECT COUNT(*) FROM sqlite_master WHERE type='table') FROM sqlite_master WHERE type='table';"
```

### W kodzie Node.js

```javascript
import { getDatabase } from './server/src/database/Database.js';

const db = getDatabase();

// Query
db.get('SELECT * FROM users WHERE email = ?', ['demo@legolex.com'], (err, row) => {
  console.log(row);
});

// Insert
db.run('INSERT INTO users (id, email) VALUES (?, ?)', ['uuid', 'email'], (err) => {
  if (err) console.error(err);
});
```

---

## 🎯 PROBLEM: FAŁSZYWE TESTY

### Co to są fałszywe testy?

```javascript
// ❌ FAŁSZYWY - zawsze przechodzi, nic nie testuje
it('should login user', () => {
  expect(true).toBe(true);
});

// ❌ FAŁSZYWY - testuje stałą wartość
it('should have 4 steps', () => {
  const steps = ['a', 'b', 'c', 'd'];
  expect(steps.length).toBe(4);
});

// ❌ FAŁSZYWY - używa mocka który zwraca to co testuje
const mockService = { get: vi.fn().mockResolvedValue({ id: '123' }) };
it('should get by id', async () => {
  const result = await mockService.get('123');
  expect(result.id).toBe('123'); // Zawsze true!
});
```

### Jak naprawić?

```javascript
// ✅ PRAWDZIWY - faktycznie testuje API
it('should login user', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'demo@legolex.com', password: 'Demo123!' });

  expect(res.status).toBe(200);
  expect(res.body.token).toBeDefined();
});

// ✅ PRAWDZIWY - testuje prawdziwą logikę
it('should create project in database', async () => {
  const result = await ProjectService.create({
    name: 'Test',
    organizationId: testOrgId,
  });

  // Weryfikacja w bazie!
  const dbProject = await db.get('SELECT * FROM projects WHERE id = ?', [result.id]);
  expect(dbProject.name).toBe('Test');
});
```

---

## 🚀 KOMENDY DO TESTOWANIA

```bash
# Wszystkie testy
npm test

# Tylko unit testy
npm run test:unit

# Tylko integracyjne
npm run test:integration

# Konkretny plik
npm test -- tests/integration/auth.test.js

# Z verbose
npm test -- --reporter=verbose

# Tylko jeden test
npm test -- -t "should login user"
```

---

## 📊 RAPORTOWANIE POSTĘPU

Po naprawie testów, agent powinien:

1. Uruchomić testy w swoim obszarze
2. Zgłosić ile testów przechodzi / ile failuje
3. Oznaczyć zadanie jako ukończone

---

## 📞 WSPARCIE

- Wzorcowy test: `tests/integration/auth.test.js`
- Schema bazy: `server/src/database/schema/`
- API routes: `server/src/routes/`
- Dokumentacja: `docs/`
