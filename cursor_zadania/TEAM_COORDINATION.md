# 📋 TEAM COORDINATION - Refactoring Consultify

## 🎯 Podział Odpowiedzialności

### 🤖 **CURSOR** - Implementation & Fixes
**Specjalizacja**: Masowe zmiany, naprawa błędów, testy

**Zadania**:
- ✅ TypeScript Error Resolution (~700 błędów)
- ✅ Test Coverage Improvement (50% → 70%)
- ✅ Code Quality & JSDoc
- ✅ Database Query Optimization

**Pliki**: `CURSOR_TASKS.md`

---

### 🔧 **CODEX** - Architecture & Refactoring
**Specjalizacja**: Refactoring architektury, wzorce projektowe

**Zadania**:
- ✅ Service Layer Refactoring
- ✅ CQRS Pattern Implementation
- ✅ Event-Driven Architecture
- ✅ Connection Pooling

**Pliki**: `CODEX_TASKS.md`

---

### 🏛️ **ANTIGRAVITY** - Strategy & Shared Libraries
**Specjalizacja**: Strategia, shared packages, fork preparation

**Zadania**:
- ✅ Shared Core Library Extraction
- ✅ Database Optimization Strategy
- ✅ API Gateway Pattern
- ✅ Fork Documentation

**Pliki**: `ANTIGRAVITY_TASKS.md`

---

## 📅 Timeline & Coordination

### Week 1: Foundation
- **Cursor**: TypeScript errors (BATCH 1)
- **Codex**: Service refactoring (BATCH 1)
- **Antigravity**: Nx monorepo setup (BATCH 1)

### Week 2: Quality & Architecture
- **Cursor**: Test coverage (BATCH 2)
- **Codex**: CQRS implementation (BATCH 2)
- **Antigravity**: Database optimization (BATCH 2)

### Week 3: Integration
- **Cursor**: Code quality (BATCH 3)
- **Codex**: Event-driven (BATCH 3)
- **Antigravity**: API Gateway (BATCH 3)

### Week 4: Finalization
- **Cursor**: DB optimization (BATCH 4)
- **Codex**: Connection pooling (BATCH 4)
- **Antigravity**: Fork documentation (BATCH 4)

---

## 🔄 Synchronization Points

### Daily Standup (Async)
Każdy agent raportuje:
```
AGENT: [Cursor/Codex/Antigravity]
BATCH: X
STATUS: [In Progress/Completed/Blocked]
COMPLETED: [lista zadań]
BLOCKERS: [jeśli są]
NEXT: [następne zadanie]
```

### Master Plan Updates
**WAŻNE**: Każdy agent **MUSI** aktualizować Master Plan po ukończeniu zadania!

Lokalizacja: `/Users/piotrwisniewski/.gemini/antigravity/brain/658d69d2-2532-40ab-b8fb-afc9d441319b/refactoring_master_plan.md`

---

## 🚨 Conflict Resolution

### Jeśli dwa agenty pracują na tym samym pliku:
1. **Komunikacja**: Zgłoś w daily standup
2. **Priorytet**: P0 > P1 > P2
3. **Koordynacja**: Podziel plik na sekcje
4. **Merge**: Ostatni commit wygrywa (z review)

### Jeśli bloker:
1. **Zgłoś**: W daily standup
2. **Eskaluj**: Do Antigravity (koordynator)
3. **Workaround**: Przejdź do następnego zadania

---

## ✅ Definition of Done

Zadanie jest ukończone gdy:
- [ ] Kod działa (npm run dev)
- [ ] Testy przechodzą (npm run test)
- [ ] TypeScript check OK (npm run type-check)
- [ ] ESLint clean (npm run lint)
- [ ] Dokumentacja zaktualizowana
- [ ] Master Plan zaktualizowany
- [ ] Commit z opisem

---

## 📊 Progress Dashboard

### Overall Progress
- **Faza 0**: ✅ UKOŃCZONA (160h)
- **Faza 1**: 🔄 W TRAKCIE (480h)
  - TypeScript Migration: ✅ 100%
  - Service Refactoring: 🔄 30%
  - Database Optimization: 🔄 20%
  - Shared Libraries: 🔄 10%

### Team Velocity
- **Cursor**: 4 batches (16-20h)
- **Codex**: 4 batches (22-28h)
- **Antigravity**: 4 batches (30-35h)
- **Total**: ~70h (Week 1-4)

---

## 🎯 Success Metrics

### Code Quality
- TypeScript errors: 700 → 0
- Test coverage: 50% → 70%
- ESLint warnings: ? → 0

### Architecture
- Services refactored: 0 → 4
- Shared packages: 0 → 6
- CQRS implemented: 0 → 100%

### Performance
- N+1 queries: ? → 0
- Missing indexes: ? → 0
- Connection pooling: ❌ → ✅

---

## 📞 Communication

### Channels
- **Master Plan**: Source of truth
- **Task Files**: Individual assignments
- **Daily Standups**: Progress updates
- **Blockers**: Immediate escalation

### Best Practices
1. **Over-communicate**: Better too much than too little
2. **Update Master Plan**: After every task
3. **Document decisions**: In ADRs
4. **Ask questions**: No stupid questions
5. **Help each other**: Team success > individual

---

**Let's build something amazing together!** 🚀
