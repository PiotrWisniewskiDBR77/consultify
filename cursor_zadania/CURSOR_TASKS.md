# 🎯 ZADANIA DLA CURSOR - Refactoring Consultify

## 📋 Informacje Ogólne

**Master Plan (LOKALNY)**: `cursor_zadania/MASTER_PLAN.md` ← **AKTUALIZUJ TUTAJ!**  
**Progress Report**: `cursor_zadania/PROGRESS_REPORT.md` ← **RAPORTUJ TUTAJ!**

**WAŻNE**: Po ukończeniu każdego zadania **MUSISZ** oznaczyć odpowiednie checkboxy w `cursor_zadania/MASTER_PLAN.md` jako `[x]`.

---

## 🚀 BATCH 1: TypeScript Error Resolution (Priorytet P0)

### Cel
Naprawić wszystkie błędy TypeScript w plikach views i components

### Zakres
- **Pliki**: `views/*.tsx`, `components/**/*.tsx`
- **Błędy**: ~700+ błędów TypeScript
- **Czas**: 4-6 godzin

### Instrukcje

1. **Uruchom type-check**:
```bash
npm run type-check 2>&1 | tee typescript_errors.log
```

2. **Priorytetyzacja błędów**:
   - **P0 (Krytyczne)**: Type mismatches w props, missing properties
   - **P1 (Wysokie)**: Implicit any, undefined checks
   - **P2 (Średnie)**: Type assertions, optional chaining

3. **Naprawa błędów** (przykłady):

**Problem**: Type mismatch
```typescript
// ❌ Przed
<Component status={project.status} />

// ✅ Po
<Component status={project.status as ProjectStatus} />
```

**Problem**: Missing properties
```typescript
// ❌ Przed
const data = { name, description };

// ✅ Po
const data = { name, description, status: 'active' as const };
```

**Problem**: Possibly undefined
```typescript
// ❌ Przed
module.name.toLowerCase()

// ✅ Po
module.name?.toLowerCase() ?? ''
```

4. **Weryfikacja**:
```bash
npm run type-check
# Cel: 0 errors
```

5. **Aktualizacja Master Planu**:
Oznacz w `refactoring_master_plan.md`:
```markdown
- [x] Rozwiązanie wszystkich 700+ błędów TS
```

### Pliki do naprawy (priorytet):
1. `views/admin/ProjectDetailsView.tsx`
2. `views/FullInitiativesView.tsx`
3. `views/FullRoadmapView.tsx`
4. `views/KnowledgeBaseView.tsx`
5. `views/superadmin/AIConfigurationView.tsx`
6. `views/superadmin/LLMManagementView.tsx`
7. `components/AIUsageIndicator.tsx`
8. `components/assessment/AssessmentAxisWorkspace.tsx`
9. `components/assessment/InitiativesTable.tsx`
10. `components/assessment/maps/DBR77LeanMap.tsx`

---

## 🧪 BATCH 2: Test Coverage Improvement (Priorytet P1)

### Cel
Przywrócić wyłączone testy i zwiększyć coverage do 70%

### Zakres
- **Testy**: ~100+ wyłączonych testów
- **Coverage**: 50% → 70%
- **Czas**: 6-8 godzin

### Instrukcje

1. **Znajdź wyłączone testy**:
```bash
grep -r "describe.skip\|test.skip\|it.skip" server/tests --include="*.test.ts" --include="*.test.js"
```

2. **Przywróć testy** (usuń `.skip`):
```typescript
// ❌ Przed
describe.skip('ServiceName', () => {

// ✅ Po
describe('ServiceName', () => {
```

3. **Napraw failing tests**:
   - Zaktualizuj mocks
   - Popraw assertions
   - Dodaj missing setup

4. **Dodaj brakujące testy**:
```typescript
describe('NewFeature', () => {
  it('should handle success case', async () => {
    // Arrange
    const input = { ... };
    
    // Act
    const result = await service.method(input);
    
    // Assert
    expect(result).toBeDefined();
  });

  it('should handle error case', async () => {
    // Test error handling
  });
});
```

5. **Weryfikacja**:
```bash
npm run test:coverage
# Cel: 70%+ coverage
```

6. **Aktualizacja Master Planu**:
```markdown
- [x] Przywrócenie ~100+ wyłączonych testów
- [x] Testy dla wszystkich services
```

---

## 📝 BATCH 3: Code Quality & Documentation (Priorytet P1)

### Cel
Dodać JSDoc, poprawić ESLint warnings

### Zakres
- **JSDoc**: Wszystkie public APIs
- **ESLint**: Zero warnings
- **Czas**: 4-5 godzin

### Instrukcje

1. **Dodaj JSDoc do services**:
```typescript
/**
 * Creates a new project with the given parameters
 * @param {Object} params - Project creation parameters
 * @param {string} params.name - Project name
 * @param {string} params.organizationId - Organization ID
 * @returns {Promise<Project>} Created project
 * @throws {Error} If validation fails
 */
async createProject(params: CreateProjectParams): Promise<Project> {
  // ...
}
```

2. **Napraw ESLint warnings**:
```bash
npm run lint -- --fix
```

3. **Ręczna naprawa**:
   - Unused variables → remove or prefix with `_`
   - Missing dependencies → add to useEffect deps
   - Console.log → remove or use proper logging

4. **Weryfikacja**:
```bash
npm run lint
# Cel: 0 warnings
```

5. **Aktualizacja Master Planu**:
```markdown
- [x] JSDoc dla wszystkich public APIs
- [x] ESLint strict rules
```

---

## 🔧 BATCH 4: Database Query Optimization (Priorytet P1)

### Cel
Zidentyfikować i naprawić N+1 queries

### Zakres
- **Queries**: Optymalizacja slow queries
- **Indexes**: Dodanie missing indexes
- **Czas**: 3-4 godziny

### Instrukcje

1. **Znajdź N+1 queries**:
```bash
# Szukaj pętli z queries
grep -r "for.*await.*db\." server/routes --include="*.js" -A 5
```

2. **Napraw N+1** (przykład):
```javascript
// ❌ Przed (N+1)
const projects = await db.all('SELECT * FROM projects');
for (const project of projects) {
  project.members = await db.all('SELECT * FROM members WHERE project_id = ?', project.id);
}

// ✅ Po (JOIN)
const projects = await db.all(`
  SELECT p.*, 
         GROUP_CONCAT(m.user_id) as member_ids
  FROM projects p
  LEFT JOIN members m ON p.id = m.project_id
  GROUP BY p.id
`);
```

3. **Dodaj indexes**:
```sql
-- Sprawdź missing indexes
CREATE INDEX IF NOT EXISTS idx_members_project_id ON members(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_initiative_id ON tasks(initiative_id);
```

4. **Weryfikacja**:
```bash
# Test performance
time npm run test:integration
```

5. **Aktualizacja Master Planu**:
```markdown
- [x] Optimize slow queries
- [x] Add missing indexes
```

---

## 📊 Progress Tracking

### Batch Status
- [ ] BATCH 1: TypeScript Errors (P0)
- [ ] BATCH 2: Test Coverage (P1)
- [ ] BATCH 3: Code Quality (P1)
- [ ] BATCH 4: Database Optimization (P1)

### Reporting
Po każdym batchu, stwórz raport:
```
BATCH X COMPLETED
- Naprawione: X błędów/testów
- Czas: X godzin
- Problemy: [lista jeśli były]
- Next: BATCH Y
```

---

## 🚨 Ważne Zasady

1. **Zawsze commituj po każdym batchu**
2. **Testuj przed commitem**: `npm run test && npm run type-check`
3. **Aktualizuj Master Plan** po każdym zadaniu
4. **Zgłaszaj blokery** jeśli coś nie działa
5. **Nie rób breaking changes** bez konsultacji

---

## 📞 Kontakt

Jeśli masz pytania lub blokery:
- Sprawdź Master Plan: `refactoring_master_plan.md`
- Sprawdź raporty audytu w `.gemini/antigravity/brain/`
- Pytaj Antigravity lub Codex

**Powodzenia!** 🚀
