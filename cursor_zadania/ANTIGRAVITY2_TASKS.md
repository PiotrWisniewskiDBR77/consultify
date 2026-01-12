# 🤖 ZADANIA DLA ANTIGRAVITY #2 - Refactoring Consultify

## 📋 Informacje Ogólne

**Master Plan (LOKALNY)**: `cursor_zadania/MASTER_PLAN.md` ← **AKTUALIZUJ TUTAJ!**  
**Progress Report**: `cursor_zadania/PROGRESS_REPORT.md` ← **RAPORTUJ TUTAJ!**

**Rola**: Nx Monorepo Setup, Shared Libraries Extraction, Fork Infrastructure

---

## 🏗️ BATCH 1: Nx Monorepo Setup (Priorytet P0)

### Cel
Utworzyć Nx monorepo i przygotować strukturę dla shared packages

### Czas: 4-6 godzin

### Instrukcje Krok po Kroku

#### 1.1 Inicjalizacja Nx Workspace
```bash
# Przejdź do parent directory
cd /Users/piotrwisniewski/Documents/Antygracity/DRD

# Utwórz nowy workspace
npx create-nx-workspace@latest consultify-monorepo \
  --preset=ts \
  --packageManager=npm \
  --nxCloud=false

cd consultify-monorepo
```

#### 1.2 Konfiguracja Workspace
```bash
# Zainstaluj potrzebne pluginy
npm install -D @nx/react @nx/node @nx/js

# Sprawdź strukturę
tree -L 2
```

#### 1.3 Utworzenie Shared Packages
```bash
# @shared/types
nx generate @nx/js:library shared-types \
  --directory=packages/shared-types \
  --importPath=@shared/types \
  --publishable=true

# @shared/utils
nx generate @nx/js:library shared-utils \
  --directory=packages/shared-utils \
  --importPath=@shared/utils \
  --publishable=true

# @shared/ai-core
nx generate @nx/js:library shared-ai-core \
  --directory=packages/shared-ai-core \
  --importPath=@shared/ai-core \
  --publishable=true

# @shared/auth
nx generate @nx/js:library shared-auth \
  --directory=packages/shared-auth \
  --importPath=@shared/auth \
  --publishable=true

# @shared/database
nx generate @nx/js:library shared-database \
  --directory=packages/shared-database \
  --importPath=@shared/database \
  --publishable=true

# @shared/ui
nx generate @nx/react:library shared-ui \
  --directory=packages/shared-ui \
  --importPath=@shared/ui \
  --publishable=true
```

#### 1.4 Weryfikacja
```bash
# Sprawdź czy wszystkie packages zostały utworzone
ls -la packages/

# Zbuduj wszystkie packages
nx run-many --target=build --all

# Sprawdź dependency graph
nx graph
```

#### 1.5 Aktualizacja Master Planu
Oznacz w `cursor_zadania/MASTER_PLAN.md`:
```markdown
- [x] Initialize Nx workspace
- [x] Configure build system
- [x] Set up package structure
```

---

## 📦 BATCH 2: Extract @shared/types (Priorytet P0)

### Cel
Wyekstrahować wspólne typy z types.ts do @shared/types

### Czas: 6-8 godzin

### Instrukcje

#### 2.1 Analiza types.ts
```bash
# Sprawdź rozmiar
wc -l /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/types.ts
# Output: 6728 lines

# Zidentyfikuj sekcje
grep "^export interface\|^export type\|^export enum" types.ts | head -50
```

#### 2.2 Kategorie do Ekstrakcji

**Core Types** (do @shared/types/core):
- User, Organization, Project
- Invoice, Subscription
- AppView, SessionMode, AuthStep

**PMO Types** (do @shared/types/pmo):
- Initiative, Task, Decision
- ProjectRole, UserRole
- InitiativeStatus, TaskStatus

**API Types** (do @shared/types/api):
- Request/Response interfaces
- Error types
- Pagination types

#### 2.3 Implementacja

Utwórz strukturę:
```typescript
// packages/shared-types/src/index.ts
export * from './core';
export * from './pmo';
export * from './api';

// packages/shared-types/src/core/index.ts
export * from './user.types';
export * from './organization.types';
export * from './project.types';
export * from './billing.types';

// packages/shared-types/src/core/user.types.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  // ... (skopiuj z types.ts)
}

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  USER = 'USER',
  // ...
}
```

#### 2.4 Ekstrakcja (przykład)
```bash
# Skopiuj User-related types
grep -A 50 "export interface User" /path/to/types.ts > packages/shared-types/src/core/user.types.ts

# Edytuj i oczyść
```

#### 2.5 Weryfikacja
```bash
# Zbuduj package
nx build shared-types

# Sprawdź exports
cat packages/shared-types/src/index.ts
```

#### 2.6 Aktualizacja Master Planu
```markdown
- [x] Extract common types
- [x] Typy, utils, constants → shared - implemented
```

---

## 🛠️ BATCH 3: Extract @shared/utils (Priorytet P1)

### Cel
Wyekstrahować utility functions do @shared/utils

### Czas: 4-5 godzin

### Instrukcje

#### 3.1 Znajdź Utils
```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify

# Znajdź wszystkie utils
find . -name "*utils*" -o -name "*helpers*" | grep -v node_modules
```

#### 3.2 Kategorie Utils

**Date Utils**:
```typescript
// packages/shared-utils/src/date.utils.ts
export const formatDate = (date: Date, format: string): string => {
  // Implementation
};

export const parseDate = (dateString: string): Date => {
  // Implementation
};
```

**String Utils**:
```typescript
// packages/shared-utils/src/string.utils.ts
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const slugify = (str: string): string => {
  // Implementation
};
```

**Validation Utils**:
```typescript
// packages/shared-utils/src/validation.utils.ts
export const isEmail = (email: string): boolean => {
  // Implementation
};

export const isUrl = (url: string): boolean => {
  // Implementation
};
```

#### 3.3 Implementacja
```bash
# Skopiuj utils z consultify
cp server/utils/*.ts packages/shared-utils/src/

# Edytuj i dostosuj imports
```

#### 3.4 Weryfikacja
```bash
nx build shared-utils
nx test shared-utils
```

#### 3.5 Aktualizacja Master Planu
```markdown
- [x] Extract common utils
```

---

## 🤖 BATCH 4: Extract @shared/ai-core (Priorytet P1)

### Cel
Wyekstrahować AI orchestration layer

### Czas: 8-10 godzin

### Instrukcje

#### 4.1 Analiza AI Services
```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify

# Znajdź AI services
find server/ai -name "*.js" -o -name "*.ts" | head -20
```

#### 4.2 Komponenty do Ekstrakcji

**AI Orchestrator**:
```typescript
// packages/shared-ai-core/src/orchestrator/index.ts
export class AIOrchestrator {
  constructor(
    private contextBuilder: ContextBuilder,
    private providerManager: ProviderManager,
    private tokenManager: TokenManager
  ) {}

  async processRequest(input: AIRequest): Promise<AIResponse> {
    // Implementation
  }
}
```

**Provider Manager** (12 providers):
```typescript
// packages/shared-ai-core/src/providers/index.ts
export class ProviderManager {
  private providers = new Map<string, AIProvider>();

  register(name: string, provider: AIProvider) {
    this.providers.set(name, provider);
  }

  select(context: AIContext): AIProvider {
    // Selection logic
  }
}
```

#### 4.3 Implementacja
```bash
# Skopiuj AI services
cp -r server/ai/* packages/shared-ai-core/src/

# Refaktoryzuj do class-based structure
```

#### 4.4 Weryfikacja
```bash
nx build shared-ai-core
nx test shared-ai-core
```

#### 4.5 Aktualizacja Master Planu
```markdown
- [x] Extract AI core
```

---

## 🔐 BATCH 5: Extract @shared/auth (Priorytet P2)

### Cel
Wyekstrahować authentication & authorization logic

### Czas: 4-5 godzin

### Instrukcje

#### 5.1 Komponenty Auth

**JWT Handler**:
```typescript
// packages/shared-auth/src/jwt.ts
export class JWTHandler {
  constructor(private secret: string) {}

  sign(payload: any, expiresIn: string): string {
    // Implementation
  }

  verify(token: string): any {
    // Implementation
  }
}
```

**Password Manager**:
```typescript
// packages/shared-auth/src/password.ts
export class PasswordManager {
  async hash(password: string): Promise<string> {
    // bcrypt implementation
  }

  async compare(password: string, hash: string): Promise<boolean> {
    // Implementation
  }
}
```

#### 5.2 Implementacja
```bash
# Skopiuj auth middleware
cp server/middleware/authMiddleware.js packages/shared-auth/src/

# Konwertuj do TypeScript i refaktoryzuj
```

#### 5.3 Aktualizacja Master Planu
```markdown
- [x] Extract auth core
```

---

## 📊 Progress Tracking

### Batch Status
- [ ] BATCH 1: Nx Monorepo Setup (P0)
- [ ] BATCH 2: Extract @shared/types (P0)
- [ ] BATCH 3: Extract @shared/utils (P1)
- [ ] BATCH 4: Extract @shared/ai-core (P1)
- [ ] BATCH 5: Extract @shared/auth (P2)

### Reporting
Po każdym batchu, zaktualizuj `PROGRESS_REPORT.md`:
```markdown
### ANTIGRAVITY #2 - [DATE]
- ✅ BATCH X completed
- Files created: [list]
- Time: X hours
- Next: BATCH Y
```

---

## 🚨 Ważne Zasady

1. **Nie łam istniejącego kodu** - to tylko ekstrakcja
2. **Testuj każdy package** przed przejściem dalej
3. **Dokumentuj exports** w README każdego package
4. **Aktualizuj Master Plan** po każdym batchu
5. **Commituj często** - małe, atomowe commity

---

## 📞 Koordynacja

**Synchronizuj się z Antigravity #1**:
- Antigravity #1 pracuje nad TypeScript errors
- Ty pracujesz nad shared libraries
- Spotkacie się przy integracji

**Pytania?**
- Sprawdź `SHARED_LIBRARIES_PLAN.md`
- Sprawdź `MASTER_PLAN.md`
- Pytaj w `TEAM_COORDINATION.md`

**Powodzenia!** 🚀
