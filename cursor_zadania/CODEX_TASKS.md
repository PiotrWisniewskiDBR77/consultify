# 🤖 ZADANIA DLA CODEX - Refactoring Consultify

## 📋 Informacje Ogólne

**Master Plan (LOKALNY)**: `cursor_zadania/MASTER_PLAN.md` ← **AKTUALIZUJ TUTAJ!**  
**Progress Report**: `cursor_zadania/PROGRESS_REPORT.md` ← **RAPORTUJ TUTAJ!**

**WAŻNE**: Po ukończeniu każdego zadania **MUSISZ** oznaczyć odpowiednie checkboxy w `cursor_zadania/MASTER_PLAN.md` jako `[x]`.

---

## 🏗️ BATCH 1: Service Layer Refactoring (Priorytet P0)

### Cel
Rozbić monolityczne serwisy na mniejsze, skoncentrowane moduły

### Zakres
- **Pliki**: `server/src/services/*.ts`
- **Pattern**: Extract focused modules
- **Czas**: 8-10 godzin

### Instrukcje

1. **Analiza dużych serwisów**:
```bash
# Znajdź duże pliki (>500 linii)
find server/src/services -name "*.ts" -exec wc -l {} \; | sort -rn | head -10
```

2. **Identyfikacja granic** (przykład: `aiService.ts`):
```
aiService.ts (1200 linii) →
  - aiOrchestrator.ts (pipeline, routing)
  - aiContextBuilder.ts (context management)
  - aiProviderManager.ts (provider handling)
  - aiTokenManager.ts (token tracking)
```

3. **Ekstrakcja modułu** (przykład):
```typescript
// ❌ Przed: aiService.ts (wszystko w jednym)
class AIService {
  async processRequest() { ... }
  async buildContext() { ... }
  async manageProviders() { ... }
  async trackTokens() { ... }
}

// ✅ Po: Rozdzielone moduły

// aiOrchestrator.ts
export class AIOrchestrator {
  constructor(
    private contextBuilder: AIContextBuilder,
    private providerManager: AIProviderManager,
    private tokenManager: AITokenManager
  ) {}
  
  async processRequest(input: AIRequest): Promise<AIResponse> {
    const context = await this.contextBuilder.build(input);
    const provider = this.providerManager.select(context);
    const response = await provider.generate(context);
    await this.tokenManager.track(response);
    return response;
  }
}

// aiContextBuilder.ts
export class AIContextBuilder {
  async build(input: AIRequest): Promise<AIContext> {
    // Context building logic
  }
}
```

4. **Dependency Injection**:
```typescript
// services/index.ts
export const createAIOrchestrator = async () => {
  const contextBuilder = new AIContextBuilder();
  const providerManager = new AIProviderManager();
  const tokenManager = new AITokenManager();
  
  return new AIOrchestrator(
    contextBuilder,
    providerManager,
    tokenManager
  );
};
```

5. **Weryfikacja**:
```bash
npm run test
npm run type-check
```

6. **Aktualizacja Master Planu**:
```markdown
- [x] Rozbicie monolitycznych serwisów na moduły
- [x] Implement dependency injection
```

### Serwisy do refaktoryzacji (priorytet):
1. `aiService.ts` → 4 moduły
2. `assessmentService.ts` → 3 moduły
3. `reportGeneratorService.ts` → 2 moduły
4. `billingService.ts` → 3 moduły

---

## 🎯 BATCH 2: CQRS Pattern Implementation (Priorytet P1)

### Cel
Wprowadzić CQRS dla złożonych operacji

### Zakres
- **Pattern**: Command Query Responsibility Segregation
- **Operacje**: Create, Update, Delete (Commands) vs Read (Queries)
- **Czas**: 6-8 godzin

### Instrukcje

1. **Identyfikacja operacji**:
```typescript
// Commands (modyfikują stan)
- createProject
- updateProject
- deleteProject

// Queries (tylko odczyt)
- getProject
- listProjects
- searchProjects
```

2. **Implementacja Commands**:
```typescript
// commands/CreateProjectCommand.ts
export interface CreateProjectCommand {
  name: string;
  organizationId: string;
  ownerId: string;
}

export class CreateProjectHandler {
  async execute(command: CreateProjectCommand): Promise<Project> {
    // Validation
    this.validate(command);
    
    // Business logic
    const project = await this.projectRepository.create(command);
    
    // Events
    await this.eventBus.publish(new ProjectCreatedEvent(project));
    
    return project;
  }
}
```

3. **Implementacja Queries**:
```typescript
// queries/GetProjectQuery.ts
export interface GetProjectQuery {
  projectId: string;
  userId: string;
}

export class GetProjectHandler {
  async execute(query: GetProjectQuery): Promise<Project> {
    // Authorization check
    await this.checkAccess(query.userId, query.projectId);
    
    // Fetch from read model (może być cached)
    return await this.projectReadModel.getById(query.projectId);
  }
}
```

4. **Command/Query Bus**:
```typescript
// infrastructure/CommandBus.ts
export class CommandBus {
  private handlers = new Map();
  
  register(commandType: string, handler: any) {
    this.handlers.set(commandType, handler);
  }
  
  async execute(command: any): Promise<any> {
    const handler = this.handlers.get(command.constructor.name);
    return await handler.execute(command);
  }
}
```

5. **Weryfikacja**:
```bash
npm run test:integration
```

6. **Aktualizacja Master Planu**:
```markdown
- [x] Identify command operations
- [x] Identify query operations
- [x] Implement CQRS for complex ops
```

---

## 📡 BATCH 3: Event-Driven Architecture (Priorytet P1)

### Cel
Implementacja event bus dla komunikacji między serwisami

### Zakres
- **Pattern**: Event-driven communication
- **Events**: Domain events
- **Czas**: 5-6 godzin

### Instrukcje

1. **Event Bus Implementation**:
```typescript
// infrastructure/EventBus.ts
export class EventBus {
  private listeners = new Map<string, Function[]>();
  
  subscribe(eventType: string, handler: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
  }
  
  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) || [];
    await Promise.all(handlers.map(h => h(event)));
  }
}
```

2. **Domain Events**:
```typescript
// events/ProjectEvents.ts
export class ProjectCreatedEvent {
  readonly type = 'project.created';
  
  constructor(
    public readonly projectId: string,
    public readonly organizationId: string,
    public readonly timestamp: Date = new Date()
  ) {}
}

export class ProjectUpdatedEvent {
  readonly type = 'project.updated';
  // ...
}
```

3. **Event Listeners**:
```typescript
// listeners/NotificationListener.ts
export class NotificationListener {
  async onProjectCreated(event: ProjectCreatedEvent) {
    await this.notificationService.send({
      type: 'project_created',
      projectId: event.projectId,
      recipients: await this.getProjectMembers(event.projectId)
    });
  }
}

// Setup
eventBus.subscribe('project.created', 
  (e) => notificationListener.onProjectCreated(e)
);
```

4. **Integration**:
```typescript
// W CommandHandler
async execute(command: CreateProjectCommand) {
  const project = await this.repository.create(command);
  
  // Publish event
  await this.eventBus.publish(
    new ProjectCreatedEvent(project.id, project.organizationId)
  );
  
  return project;
}
```

5. **Weryfikacja**:
```bash
npm run test:integration
```

6. **Aktualizacja Master Planu**:
```markdown
- [x] Design event bus
- [x] Implement event emitters
- [x] Add event listeners
- [x] Document event flows
```

---

## 🗄️ BATCH 4: Database Connection Pooling (Priorytet P0)

### Cel
Implementacja connection pooling dla PostgreSQL

### Zakres
- **Database**: PostgreSQL connection pooling
- **Library**: pg-pool
- **Czas**: 3-4 godziny

### Instrukcje

1. **Install dependencies**:
```bash
npm install pg pg-pool
npm install -D @types/pg
```

2. **Pool Configuration**:
```typescript
// database/pool.ts
import { Pool } from 'pg';

export const createPool = () => {
  return new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    
    // Pool settings
    max: 20,                    // Maximum connections
    min: 5,                     // Minimum connections
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Timeout for acquiring connection
  });
};

export const pool = createPool();
```

3. **Query Helper**:
```typescript
// database/query.ts
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  console.log('Executed query', { text, duration, rows: result.rowCount });
  return result;
};
```

4. **Transaction Support**:
```typescript
export const transaction = async (callback: (client: PoolClient) => Promise<any>) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

5. **Monitoring**:
```typescript
// Monitor pool health
setInterval(() => {
  console.log('Pool status:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 60000);
```

6. **Weryfikacja**:
```bash
npm run test:integration
# Check pool metrics
```

7. **Aktualizacja Master Planu**:
```markdown
- [x] Implement connection pooling
- [x] Configure pool settings
- [x] Add connection monitoring
```

---

## 📊 Progress Tracking

### Batch Status
- [ ] BATCH 1: Service Refactoring (P0)
- [ ] BATCH 2: CQRS Pattern (P1)
- [ ] BATCH 3: Event-Driven (P1)
- [ ] BATCH 4: Connection Pooling (P0)

### Reporting
Po każdym batchu, stwórz raport:
```
BATCH X COMPLETED
- Zrefaktorowane: X serwisów/modułów
- Czas: X godzin
- Problemy: [lista jeśli były]
- Next: BATCH Y
```

---

## 🚨 Ważne Zasady

1. **Backward Compatibility**: Nie łam istniejących API
2. **Tests First**: Napisz testy przed refaktorem
3. **Incremental**: Małe, atomowe commity
4. **Documentation**: Aktualizuj README dla każdego modułu
5. **Master Plan**: Oznaczaj ukończone zadania

---

## 📞 Kontakt

Jeśli masz pytania lub blokery:
- Sprawdź Master Plan: `refactoring_master_plan.md`
- Sprawdź Architecture Map: `ARCHITECTURE_MAP.md`
- Pytaj Antigravity lub Cursor

**Powodzenia!** 🚀
