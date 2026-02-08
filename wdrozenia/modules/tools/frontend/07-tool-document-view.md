# Tools - ToolDocumentView (Canonical Document View)

## Cel
Kompleksowa dokumentacja kanonicznego widoku narzędzia strategicznego (`ToolDocumentView`), który zastępuje starsze `ToolWorkspace` i zapewnia spójny UI/UX zgodny z Golden Standard (Task/Initiative).

## Źródła
- Kod: `src/components/DiscoveryTools/ToolDocumentView.tsx`
- Kod: `src/components/DiscoveryTools/ToolCanvas.tsx`
- Kod: `src/components/DiscoveryTools/toolCompletion.ts`
- Kod: `src/store/useToolStore.ts`
- Standard: `wdrozenia/UI_UX_GOLDEN_STANDARD.md`
- Referencja: `src/components/MyWork/TaskDetailView.tsx` (golden standard)

---

## Architektura

### Dwukolumnowy layout (Golden Standard)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [← Back] [Tool Badge] [Session Name................] [Save] [Watch] [More] │
│  Step 1 > Step 2 > Step 3 > Step 4                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────┐  ┌───────────────────────┐  │
│  │  LEFT COLUMN (Content/Merit)             │  │  RIGHT COLUMN         │  │
│  │                                           │  │  (Control/Management) │  │
│  │  1. Context                                │  │  1. Control           │  │
│  │  2. Tool Content (Steps)                  │  │  2. DoD Checklist     │  │
│  │  3. Analysis & Correlations               │  │  3. AI Configuration │  │
│  │  4. Summary & Key Findings                │  │  4. Gate Decisions    │  │
│  │  5. Comments                               │  │  5. Generated Init.    │  │
│  │  6. Activity Log                           │  │  6. Team/Permissions   │  │
│  │                                           │  │                       │  │
│  │  [Previous] [Next]                        │  │                       │  │
│  └───────────────────────────────────────────┘  └───────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Header

### Elementy headeru

| Element | Opis | Lokalizacja |
|---------|------|-------------|
| **Back button** | Powrót do hub | Lewy górny róg |
| **Tool Badge** | Badge z nazwą narzędzia (np. "SWT", "PTR") | Obok przycisku Back |
| **Session Name** | Nazwa sesji (edytowalna) | Środek headeru |
| **Status Frame** | Ramka statusu (DRAFT/REVIEW/APPROVED) | Przed przyciskiem Save |
| **Save button** | Zapis zmian (auto-save indicator) | Prawy górny róg |
| **Watch/Unwatch** | Subskrypcja powiadomień | Obok Save |
| **More menu** | Menu kontekstowe (3 dots) | Prawy górny róg |

### Step Progress Pills (klikalne)

```typescript
// Header - Step navigation pills
<div className="flex items-center gap-2 px-6 py-2 bg-slate-50 dark:bg-navy-900 border-b">
  {steps.map((step, idx) => (
    <button
      key={step.id}
      onClick={() => setCurrentStep(step.id)}
      className={`
        px-4 py-1.5 rounded-lg text-sm font-medium transition-all
        ${currentStep === step.id
          ? 'bg-primary-500 text-white shadow-sm'
          : step.status === 'completed'
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          : step.status === 'in_progress'
          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }
      `}
    >
      {idx + 1}. {isPolish ? step.namePl : step.name}
      {step.status === 'completed' && <Check className="w-3 h-3 ml-1.5 inline" />}
    </button>
  ))}
</div>
```

**Zachowanie:**
- Kliknięcie na pill przełącza aktywny krok
- Wizualne oznaczenie: completed (zielony), in_progress (żółty), pending (szary)
- Checkmark dla ukończonych kroków

---

## Lewa kolumna (Content/Merit)

### 1. Context (CollapsibleSection)

**Zawartość:**
- Strategic goal (cel strategiczny)
- Scope (zakres)
- Timeframe (horyzont czasowy)
- Industry/Geographic scope (dla Porter)

**AI Integration:**
- Przycisk "Generate with AI" obok każdego pola
- Micro-suggestions przy edycji

```typescript
<CollapsibleSection
  title={isPolish ? 'Kontekst strategiczny' : 'Strategic Context'}
  defaultCollapsed={false}
  icon={<Target className="w-4 h-4" />}
>
  <div className="space-y-4">
    <div>
      <label>Goal</label>
      <textarea
        value={context.goal}
        onChange={(e) => updateContext('goal', e.target.value)}
        placeholder="Define strategic goal..."
      />
      <button onClick={() => generateWithAI('goal')}>
        <Wand2 /> Generate with AI
      </button>
    </div>
    {/* Scope, Timeframe... */}
  </div>
</CollapsibleSection>
```

### 2. Tool Content (ToolCanvas)

**Renderowanie:**
- Używa komponentu `ToolCanvas` z `showContextPanel={false}`
- Dynamiczne renderowanie treści w zależności od `toolType` i `currentStep`
- Wszystkie sekcje są collapsible (domyślnie zwinięte przy pierwszym wejściu)

**Step-based navigation:**
```typescript
// Left column - Tool content
<ToolCanvas
  toolType={toolType}
  currentStep={currentStep}
  inputData={currentSession?.inputData}
  onUpdate={(stepId, data) => {
    updateStepData(stepId, data);
  }}
  showContextPanel={false} // Right panel handled by ToolDocumentView
/>
```

**Przykładowe kroki dla SWOT:**
1. **Step 1: Context** - Definicja celu, zakresu, horyzontu
2. **Step 2: Strengths** - Lista mocnych stron
3. **Step 3: Weaknesses** - Lista słabych stron
4. **Step 4: Opportunities** - Lista szans
5. **Step 5: Threats** - Lista zagrożeń
6. **Step 6: Correlations** - Korelacje S-O, W-O, S-T, W-T
7. **Step 7: Review** - Podsumowanie i weryfikacja

### 3. Analysis & Correlations

**Zawartość:**
- AI-generated correlations (dla SWOT)
- Force analysis (dla Porter)
- Growth path analysis (dla Ansoff)
- Risk scenarios (dla Risk & Uncertainty)

**AI Integration:**
- Przycisk "Generate correlations" / "Analyze forces"
- Wyświetlanie confidence score dla każdej korelacji

### 4. Summary & Key Findings

**Zawartość:**
- Key insights (lista 3-7 kluczowych obserwacji)
- Recommended initiatives (preview przed generowaniem)
- Risk summary

**AI Integration:**
- Przycisk "Generate summary" - AI tworzy podsumowanie na podstawie wszystkich danych

### 5. Comments

**Komponent:** `CommentsSection` (shared z Task/Initiative)

**Funkcjonalności:**
- Dodawanie komentarzy
- Like/Unlike komentarzy
- Usuwanie własnych komentarzy
- AI-generated comments (przycisk "Generate AI comment")

```typescript
<CommentsSection
  comments={comments}
  onAddComment={async (text) => {
    const newComment = await Api.addToolComment(toolSessionId, text);
    setComments([...comments, newComment]);
  }}
  onDeleteComment={async (commentId) => {
    await Api.deleteToolComment(toolSessionId, commentId);
    setComments(comments.filter(c => c.id !== commentId));
  }}
  onLikeComment={async (commentId) => {
    await Api.likeToolComment(toolSessionId, commentId);
    // Update local state
  }}
  onGenerateAIComment={async () => {
    setIsGeneratingAIComment(true);
    const aiComment = await useToolAI.generateComment(toolSessionId);
    // Add to comments
    setIsGeneratingAIComment(false);
  }}
  isGeneratingAI={isGeneratingAIComment}
/>
```

### 6. Activity Log

**Zawartość:**
- Historia zmian statusu
- Kto i kiedy wykonał akcję
- Gate decisions (REQUEST_REVIEW, APPROVE, GENERATE)

**Format:**
```
[2026-01-27 14:30] John Smith requested review
[2026-01-27 16:45] Anna Kowalska approved tool
[2026-01-27 18:00] System generated 5 initiatives
```

### Navigation buttons (Previous/Next)

```typescript
// Bottom of left column
<div className="flex items-center justify-between pt-6 border-t">
  <button
    onClick={prevStep}
    disabled={currentStepIndex === 0}
    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
  >
    <ChevronLeft className="w-4 h-4 mr-2" />
    Previous
  </button>
  
  <div className="text-sm text-slate-500">
    Step {currentStepIndex + 1} of {steps.length}
  </div>
  
  <button
    onClick={nextStep}
    disabled={!canAdvanceStep()}
    className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
  >
    Next
    <ChevronRight className="w-4 h-4 ml-2" />
  </button>
</div>
```

**Logika `canAdvanceStep()`:**
- Sprawdza czy aktualny krok ma wymagane dane
- Dla kroków required: wymaga wypełnienia przed przejściem
- Dla kroków optional: pozwala przejść dalej

---

## Prawa kolumna (Control/Management)

### 1. Control Panel

**Zawartość:**
- **Status Badge** - DRAFT / REVIEW / APPROVED / COMPLETED
- **Progress Bar** - completion_percent (0-100%)
- **Confidence Indicator** - confidence_avg (1-5, gwiazdki)
- **Session Info** - Created by, Created at, Last updated
- **Quick Actions:**
  - Request Review (tylko DRAFT, wymaga DoD)
  - Approve (tylko REVIEW, wymaga roli)
  - Generate Initiatives (tylko APPROVED)

```typescript
<CollapsibleSection
  title={isPolish ? 'Sterowanie' : 'Control'}
  defaultCollapsed={false}
  icon={<Settings className="w-4 h-4" />}
>
  {/* Status */}
  <div className="flex items-center gap-2 mb-4">
    <StatusBadge status={toolStatus} />
    <span className="text-sm text-slate-500">{toolStatus}</span>
  </div>
  
  {/* Progress */}
  <div className="mb-4">
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm font-medium">Progress</span>
      <span className="text-sm text-slate-500">{completionPercent}%</span>
    </div>
    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all ${
          completionPercent >= 100 ? 'bg-emerald-500' : 'bg-primary-500'
        }`}
        style={{ width: `${completionPercent}%` }}
      />
    </div>
  </div>
  
  {/* Confidence */}
  <div className="mb-4">
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm font-medium">Confidence</span>
      <span className="text-sm text-slate-500">{confidenceAvg.toFixed(1)}/5</span>
    </div>
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= confidenceAvg
              ? 'text-amber-400 fill-amber-400'
              : 'text-slate-300'
          }`}
        />
      ))}
    </div>
  </div>
  
  {/* Quick Actions */}
  <div className="space-y-2">
    {toolStatus === 'DRAFT' && canRequestReview && (
      <button
        onClick={handleRequestReview}
        disabled={!isDoDAchieved}
        className="w-full px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
      >
        Request Review
      </button>
    )}
    {toolStatus === 'REVIEW' && canApprove && (
      <button
        onClick={handleApprove}
        className="w-full px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
      >
        Approve
      </button>
    )}
    {toolStatus === 'APPROVED' && canGenerate && (
      <button
        onClick={() => setShowGenerateModal(true)}
        className="w-full px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600"
      >
        <Sparkles className="w-4 h-4 mr-2 inline" />
        Generate Initiatives
      </button>
    )}
  </div>
</CollapsibleSection>
```

### 2. DoD Checklist

**Komponent:** Dynamicznie generowany przez `computeToolCompletionItems()`

**Zawartość:**
- Lista kryteriów DoD specyficznych dla typu narzędzia
- Checkmark dla spełnionych kryteriów
- Link "Go to section" dla każdego kryterium (scroll do sekcji w lewej kolumnie)

```typescript
const completionItems = useMemo(
  () => computeToolCompletionItems(toolType, currentSession?.inputData, isPolish),
  [toolType, currentSession?.inputData, isPolish]
);

<CollapsibleSection
  title={isPolish ? 'Definition of Done' : 'DoD Checklist'}
  defaultCollapsed={false}
  icon={<CheckCircle2 className="w-4 h-4" />}
>
  <div className="space-y-2">
    {completionItems.map((item, idx) => (
      <div
        key={idx}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
        onClick={() => {
          if (item.anchorId) {
            document.getElementById(item.anchorId)?.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      >
        {item.done ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300" />
        )}
        <span className={`text-sm ${item.done ? 'text-slate-700' : 'text-slate-400'}`}>
          {item.label}
        </span>
        {item.anchorId && (
          <ExternalLink className="w-3 h-3 ml-auto text-slate-400" />
        )}
      </div>
    ))}
  </div>
</CollapsibleSection>
```

**Przykładowe kryteria dla SWOT:**
- ✓ Strategic goal defined
- ✓ Items: Strengths
- ✓ Items: Weaknesses
- ○ Items: Opportunities (brakuje)
- ○ Items: Threats (brakuje)
- ○ Correlations generated (brakuje)

### 3. AI Configuration

**Zawartość:**
- **Methodology** - Wybrana metodologia generowania inicjatyw
- **Count** - Liczba inicjatyw do wygenerowania (3-7)
- **Context Options:**
  - ☑ Include AI chat context
  - ☑ Include organization profile
  - ☑ Include recent initiatives

**Zachowanie:**
- Tylko widoczne gdy status = APPROVED
- Przycisk "Configure" otwiera `GenerateInitiativesModal`

### 4. Gate Decisions

**Zawartość:**
- Lista wszystkich gate decisions dla sesji
- Status każdej decyzji (PENDING / APPROVED / REJECTED)
- Owner, due date, komentarze

```typescript
<CollapsibleSection
  title={isPolish ? 'Decyzje bramkowe' : 'Gate Decisions'}
  defaultCollapsed={false}
  icon={<CheckCircle2 className="w-4 h-4" />}
>
  <div className="space-y-3">
    {decisions.map((decision) => (
      <div
        key={decision.decision_id}
        className="p-3 rounded-lg border border-slate-200"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">{decision.decision_type}</span>
          <StatusBadge status={decision.status} />
        </div>
        {decision.owner_name && (
          <div className="text-xs text-slate-500">
            Owner: {decision.owner_name}
          </div>
        )}
        {decision.due_date && (
          <div className="text-xs text-slate-500">
            Due: {formatDate(decision.due_date)}
          </div>
        )}
      </div>
    ))}
  </div>
</CollapsibleSection>
```

**Typy decyzji:**
- `REQUEST_REVIEW` - Wysłanie do review
- `APPROVE_TOOL` - Zatwierdzenie narzędzia
- `GENERATE_INITIATIVES` - Generowanie inicjatyw

### 5. Generated Initiatives

**Zawartość:**
- Lista inicjatyw wygenerowanych z tego narzędzia
- Status każdej inicjatywy (DRAFT / IN_PROGRESS / etc.)
- Link do pełnego widoku inicjatywy

```typescript
<CollapsibleSection
  title={isPolish ? 'Wygenerowane inicjatywy' : 'Generated Initiatives'}
  defaultCollapsed={false}
  icon={<Sparkles className="w-4 h-4" />}
>
  {generatedInitiatives.length === 0 ? (
    <p className="text-sm text-slate-500">
      {isPolish ? 'Brak wygenerowanych inicjatyw' : 'No initiatives generated yet'}
    </p>
  ) : (
    <div className="space-y-2">
      {generatedInitiatives.map((initiative) => (
        <div
          key={initiative.id}
          className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
          onClick={() => onOpenInitiative?.(initiative.id)}
        >
          <div className="font-medium text-sm truncate">{initiative.title}</div>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={initiative.status} />
            <span className="text-xs text-slate-500">{initiative.category}</span>
            <span className="text-xs text-slate-500">{initiative.priority}</span>
          </div>
        </div>
      ))}
    </div>
  )}
</CollapsibleSection>
```

### 6. Team / Permissions

**Zawartość:**
- **Created by** - Autor sesji
- **Permissions:**
  - Can edit
  - Can request review
  - Can approve
  - Can generate initiatives
- **Watchers** - Lista osób śledzących (opcjonalnie)

---

## Step-based Workflow

### Definicja kroków (useToolStore)

```typescript
// useToolStore.ts
export interface StepDefinition {
  id: string;
  name: string;
  namePl: string;
  description: string;
  descriptionPl: string;
  required: boolean;
  aiAssisted: boolean;
}

// Przykład dla SWOT
const SWOT_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Context',
    namePl: 'Kontekst',
    description: 'Define strategic goal, scope, and timeframe',
    descriptionPl: 'Zdefiniuj cel strategiczny, zakres i horyzont czasowy',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'strengths',
    name: 'Strengths',
    namePl: 'Mocne strony',
    description: 'Identify organizational strengths',
    descriptionPl: 'Zidentyfikuj mocne strony organizacji',
    required: true,
    aiAssisted: true,
  },
  // ... pozostałe kroki
];
```

### Status kroków

```typescript
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

// Obliczanie statusu z answers
function computeStepStatusFromAnswers(
  toolType: ToolType,
  stepId: string,
  answers: any
): StepStatus {
  // Logika sprawdzająca czy krok ma dane
  if (hasStepData(toolType, stepId, answers)) {
    return 'completed';
  }
  if (isStepInProgress(toolType, stepId, answers)) {
    return 'in_progress';
  }
  return 'pending';
}
```

### Nawigacja między krokami

```typescript
// useToolStore actions
const nextStep = () => {
  const currentIdx = steps.findIndex(s => s.id === currentStep);
  if (currentIdx < steps.length - 1 && canAdvanceStep()) {
    setCurrentStep(steps[currentIdx + 1].id);
  }
};

const prevStep = () => {
  const currentIdx = steps.findIndex(s => s.id === currentStep);
  if (currentIdx > 0) {
    setCurrentStep(steps[currentIdx - 1].id);
  }
};

const canAdvanceStep = (): boolean => {
  const step = steps.find(s => s.id === currentStep);
  if (!step?.required) return true;
  
  // Sprawdź czy wymagane dane są wypełnione
  return hasStepData(toolType, currentStep, currentSession?.inputData);
};
```

---

## Hydration z API (hydrateSessionFromApi)

### Problem
Gdy użytkownik otwiera istniejącą sesję, dane z backendu (`answers_json`) muszą być poprawnie załadowane do store i ustawione jako `currentStep` oraz statusy kroków.

### Rozwiązanie

```typescript
// useToolStore.ts
const hydrateSessionFromApi = (
  sessionData: {
    id: string;
    tool_type: ToolType;
    answers_json: any;
    status: string;
    completion_percent: number;
    confidence_avg: number;
  }
) => {
  const toolType = sessionData.tool_type;
  const answers = sessionData.answers_json || {};
  
  // Określ aktualny krok na podstawie answers
  const currentStepId = determineCurrentStep(toolType, answers);
  
  // Oblicz statusy wszystkich kroków
  const stepsWithStatus = getStepsForTool(toolType).map(step => ({
    ...step,
    status: computeStepStatusFromAnswers(toolType, step.id, answers),
  }));
  
  // Zaktualizuj store
  set({
    currentSession: {
      id: sessionData.id,
      toolType,
      inputData: answers,
      currentStep: currentStepId,
      steps: stepsWithStatus,
    },
    toolStatus: sessionData.status,
    completionPercent: sessionData.completion_percent,
    confidenceAvg: sessionData.confidence_avg,
  });
};
```

### Użycie w ToolDocumentView

```typescript
// ToolDocumentView.tsx - fetchAll
const fetchAll = async () => {
  if (!sessionId) return;
  
  try {
    const session = await Api.getToolSession(sessionId);
    
    // Hydrate store z danych API
    hydrateSessionFromApi({
      id: session.id,
      tool_type: session.tool_type,
      answers_json: session.answers_json,
      status: session.status,
      completion_percent: session.completion_percent,
      confidence_avg: session.confidence_avg,
    });
    
    // Pobierz dodatkowe dane
    const [initiatives, decisions, comments] = await Promise.all([
      Api.getToolGeneratedInitiatives(sessionId),
      Api.getToolDecisions(sessionId),
      Api.getToolComments(sessionId),
    ]);
    
    setGeneratedInitiatives(initiatives);
    setDecisions(decisions);
    setComments(comments);
  } catch (error) {
    toast.error('Failed to load tool session');
  }
};
```

---

## Tool Completion Logic (toolCompletion.ts)

### computeToolReviewGaps()

Zwraca listę brakujących elementów (gaps) dla review.

```typescript
export function computeToolReviewGaps(
  toolType: ToolType,
  inputData: unknown,
  isPolish: boolean
): string[] {
  // Zwraca np.:
  // ["Missing: Opportunities", "Missing: Threats", "Missing correlations"]
}
```

**Użycie:**
- W `ToolReviewPanel` - wyświetlanie braków
- W `Request Review Modal` - lista co trzeba uzupełnić
- W `DoD Checklist` - komunikaty o brakujących elementach

### computeToolCompletionItems()

Zwraca listę kryteriów DoD z statusem done/not done.

```typescript
export function computeToolCompletionItems(
  toolType: ToolType,
  inputData: unknown,
  isPolish: boolean
): ToolCompletionItem[] {
  // Zwraca np.:
  // [
  //   { label: "Strategic goal defined", done: true, anchorId: "tool-content" },
  //   { label: "Items: Strengths", done: true, anchorId: "tool-content" },
  //   { label: "Items: Opportunities", done: false, anchorId: "tool-content" },
  // ]
}
```

**Użycie:**
- W prawym panelu `DoD Checklist` - lista z checkmarkami
- W `Request Review` - weryfikacja przed wysłaniem

---

## Auto-save

### Mechanizm

```typescript
// ToolDocumentView.tsx
useEffect(() => {
  if (!currentSession || !sessionId) return;
  
  const timeout = setTimeout(async () => {
    try {
      // Oblicz completion i confidence
      const completionPercent = calculateCompletion(
        currentSession.inputData,
        toolType
      );
      const confidenceAvg = calculateConfidence(
        completionPercent,
        currentSession.inputData
      );
      
      // Zapisz do API
      await Api.updateToolSession(sessionId, {
        answers: currentSession.inputData,
        completion_percent: completionPercent,
        confidence_avg: confidenceAvg,
      });
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, 1500); // Debounce 1.5s
  
  return () => clearTimeout(timeout);
}, [currentSession, sessionId, toolType]);
```

### Wskaźnik zapisu

```typescript
// Header - Save button
<button
  onClick={handleManualSave}
  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
>
  <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
  {isSaving ? 'Saving...' : lastSaved ? `Saved ${formatTime(lastSaved)}` : 'Save'}
</button>
```

---

## Status Workflow

### Przejścia statusów

```
DRAFT → REVIEW → APPROVED → COMPLETED
  ↑        ↓
  └── SENT_BACK
```

### Warunki przejść

| Przejście | Warunek | Blokada |
|-----------|---------|---------|
| DRAFT → REVIEW | DoD spełnione (completion >= 100%, confidence >= 3) | Brak DoD → przycisk disabled |
| REVIEW → APPROVED | Decyzja APPROVE_TOOL zaakceptowana | Brak decyzji → przycisk disabled |
| APPROVED → GENERATE | Decyzja GENERATE_INITIATIVES | Brak decyzji → przycisk disabled |
| REVIEW → DRAFT | Decyzja SEND_BACK | Zawsze możliwe (dla reviewerów) |

### Wizualne oznaczenia

```typescript
const STATUS_CONFIG = {
  DRAFT: { color: 'slate', icon: FileText },
  REVIEW: { color: 'amber', icon: Clock },
  APPROVED: { color: 'emerald', icon: CheckCircle2 },
  COMPLETED: { color: 'blue', icon: CheckCircle2 },
};
```

---

## Integracja z Initiatives

### Generowanie inicjatyw

1. **Modal:** `GenerateInitiativesModal` otwiera się po kliknięciu "Generate Initiatives"
2. **Konfiguracja:** Użytkownik wybiera metodologię, count (3-7), context options
3. **API Call:** `POST /api/tools/:id/generate-initiatives`
4. **Response:** Lista inicjatyw w statusie DRAFT
5. **Update UI:** Lista inicjatyw pojawia się w prawym panelu "Generated Initiatives"

### Linkowanie

- Każda inicjatywa ma `source_type='tool'` i `source_id=<tool_session_id>`
- W `InitiativeDocumentView` wyświetlany jest link "Generated from: SWOT Analysis - Q1 2026"
- W `ToolDocumentView` każda inicjatywa ma link do pełnego widoku

---

## Responsywność

### Breakpoints

| Breakpoint | Layout | Zmiany |
|------------|--------|--------|
| Desktop (>1280px) | 2-kolumnowy | Pełny layout |
| Tablet (768-1280px) | 1-kolumnowy | Prawy panel jako bottom sheet |
| Mobile (<768px) | 1-kolumnowy | Wszystkie sekcje collapsible, simplified header |

### Mobile-specific

- Step pills scrollują poziomo
- Prawy panel otwiera się jako bottom sheet
- Navigation buttons (Previous/Next) sticky na dole ekranu

---

## Pliki źródłowe

### Frontend
- `src/components/DiscoveryTools/ToolDocumentView.tsx` (~1500 linii)
- `src/components/DiscoveryTools/ToolCanvas.tsx` (~400 linii)
- `src/components/DiscoveryTools/toolCompletion.ts` (~220 linii)
- `src/components/DiscoveryTools/GenerateInitiativesModal.tsx` (~350 linii)

### Store
- `src/store/useToolStore.ts` (~1400 linii)

### Backend
- `server/src/controllers/ToolController.ts` (~1000 linii)
- `server/src/routes/tools.routes.ts` (~100 linii)

---

## Testy

### Unit tests
- `tests/unit/frontend/ToolDocumentView.test.tsx` - renderowanie, nawigacja kroków
- `tests/unit/frontend/toolCompletion.test.ts` - logika DoD

### E2E tests
- `tests/e2e/tools-document-view.spec.ts` - pełny flow DRAFT → REVIEW → APPROVED → GENERATE

---

## Metryki sukcesu

| Metryka | Target | Obecny |
|---------|--------|--------|
| Czas ładowania sesji | < 500ms | ~300ms |
| Czas auto-save | < 200ms | ~150ms |
| Czas przełączania kroków | < 100ms | ~50ms |
| User satisfaction | > 4.5/5 | TBD |

---

## Nice-to-have (P2/P3)

### P2
- **Go to section** z DoD checklist - scroll do odpowiedniej sekcji w lewej kolumnie
- **Team section** - wyświetlanie owner/reviewer z opisami ról
- **Traceability** - sekcja pokazująca źródło narzędzia (assessment, interview)

### P3
- **Version history** - historia zmian sesji
- **Collaborative editing** - real-time sync między użytkownikami
- **Export to PDF** - eksport pełnej analizy
