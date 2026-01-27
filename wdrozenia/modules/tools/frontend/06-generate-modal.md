# Tools - Generate Modal (UI)

## Cel
Specyfikacja modala generowania inicjatyw (count 3-7, metodyka, includeChatContext, preview).

## Zrodla
- Kod: `src/components/DiscoveryTools/GenerateInitiativesModal.tsx`
- `wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md`

---

## Kiedy sie otwiera

1. **Po zatwierdzeniu narzedzia** - automatycznie
```typescript
const handleApprove = async () => {
  try {
    const result = await Api.approveTool(toolSessionId);
    setToolStatus(result.status || 'APPROVED');
    setShowGenerateModal(true);  // Auto-open
    toast.success(isPolish ? 'Narzedzie zatwierdzone' : 'Tool approved');
  } catch (err) {
    toast.error(err?.message || 'Failed to approve');
  }
};
```

2. **Z Review Panel** - przycisk "Configure"
```typescript
<button 
  onClick={onConfigureGenerate}
  className="px-3 py-1.5 rounded-lg bg-primary-100 text-primary-700 
             hover:bg-primary-200 transition-colors"
>
  <Settings className="w-4 h-4 mr-1.5" />
  Configure
</button>
```

3. **Z Context Panel** - sekcja "Generate Initiatives"
```typescript
<button
  onClick={() => setShowGenerateModal(true)}
  disabled={toolStatus !== 'APPROVED'}
  className="w-full px-3 py-2 rounded-lg bg-primary-500 text-white
             hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400"
>
  <Sparkles className="w-4 h-4 mr-2" />
  Generate Initiatives
</button>
```

---

## Struktura modala

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Generate Initiatives                                                   [X] │
│  Create strategic initiatives from your analysis                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Number of Initiatives                                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                                   │
│  │  3  │ │  4  │ │ [5] │ │  6  │ │  7  │                                   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Custom (1-7)                                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  Generate between 1 and 7 initiatives                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Methodology                                                                │
│  Select the prioritization framework for generated initiatives              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ● Impact x Feasibility                                              │   │
│  │   Best for: Strategic planning, transformations                     │   │
│  │   Defaults: Strategy · P1 · Medium risk                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ Value x Effort                                                    │   │
│  │   Best for: Quick wins, operational improvements                    │   │
│  │   Defaults: Operations · P2 · Low risk                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ Risk/Compliance                                                   │   │
│  │   Best for: Compliance, risk mitigation                             │   │
│  │   Defaults: Process Auto · P1 · High risk                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ Customer/Market                                                   │   │
│  │   Best for: CX improvements, market expansion                       │   │
│  │   Defaults: Digital · P2 · Medium risk                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ Operational Efficiency                                            │   │
│  │   Best for: Cost reduction, process optimization                    │   │
│  │   Defaults: Operations · P2 · Low risk                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Context Options                                                            │
│                                                                             │
│  ☑ Include AI chat context                                                  │
│    Use recent chat history to improve initiative relevance                  │
│                                                                             │
│  ☐ Include organization profile                                             │
│    Add company context (industry, size, goals)                              │
│                                                                             │
│  ☐ Include recent initiatives                                               │
│    Reference existing initiatives to avoid duplicates                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Preview                                                                    │
│  Based on your selections, initiatives will have these defaults:            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Initiative 1 · Strategy · P1 · Medium risk                        │   │
│  │ • Initiative 2 · Strategy · P1 · Medium risk                        │   │
│  │ • Initiative 3 · Strategy · P1 · Medium risk                        │   │
│  │ • Initiative 4 · Strategy · P1 · Medium risk                        │   │
│  │ • Initiative 5 · Strategy · P1 · Medium risk                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Estimated generation time: ~5 seconds                                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Cancel]                                          [✨ Generate Drafts]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Elementy

### 1. Liczba inicjatyw (count)

**Predefiniowane wartosci:** 3, 4, 5, 6, 7

**Custom input:** 1-7 (walidacja)

```typescript
const [count, setCount] = useState(defaults.count);
const [customCount, setCustomCount] = useState('');

const finalCount = useMemo(() => {
  if (customCount !== '' && Number.isFinite(Number(customCount))) {
    return Math.min(7, Math.max(1, Number(customCount)));
  }
  return count;
}, [count, customCount]);

// Render
<div className="grid grid-cols-5 gap-2 mb-3">
  {[3, 4, 5, 6, 7].map((value) => (
    <button
      key={value}
      onClick={() => {
        setCount(value);
        setCustomCount('');
      }}
      className={`
        px-4 py-3 rounded-lg text-lg font-semibold transition-all
        ${count === value && customCount === ''
          ? 'bg-primary-500 text-white shadow-md'
          : 'bg-slate-100 dark:bg-navy-800 text-slate-600 hover:bg-slate-200'
        }
      `}
    >
      {value}
    </button>
  ))}
</div>

<input
  type="number"
  min={1}
  max={7}
  value={customCount}
  onChange={(e) => {
    setCustomCount(e.target.value);
    setCount(0);
  }}
  placeholder="Custom (1-7)"
  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 
             dark:border-navy-600 dark:bg-navy-800"
/>
```

### 2. Metodyka (methodologyId)

| ID | Label | Category | Priority | Risk | Best For |
|----|-------|----------|----------|------|----------|
| `impact-feasibility` | Impact x Feasibility | Strategy | P1 | Medium | Strategic planning, transformations |
| `value-effort` | Value x Effort | Operations | P2 | Low | Quick wins, operational improvements |
| `risk-compliance` | Risk/Compliance | Process Auto | P1 | High | Compliance, risk mitigation |
| `customer-market` | Customer/Market | Digital | P2 | Medium | CX improvements, market expansion |
| `operational-efficiency` | Operational Efficiency | Operations | P2 | Low | Cost reduction, process optimization |

```typescript
const METHODOLOGIES = [
  { 
    id: 'impact-feasibility', 
    label: 'Impact x Feasibility',
    description: 'Best for: Strategic planning, transformations',
    defaults: { category: 'Strategy', priority: 'P1', risk: 'Medium' }
  },
  { 
    id: 'value-effort', 
    label: 'Value x Effort',
    description: 'Best for: Quick wins, operational improvements',
    defaults: { category: 'Operations', priority: 'P2', risk: 'Low' }
  },
  { 
    id: 'risk-compliance', 
    label: 'Risk/Compliance',
    description: 'Best for: Compliance, risk mitigation',
    defaults: { category: 'Process Auto', priority: 'P1', risk: 'High' }
  },
  { 
    id: 'customer-market', 
    label: 'Customer/Market',
    description: 'Best for: CX improvements, market expansion',
    defaults: { category: 'Digital', priority: 'P2', risk: 'Medium' }
  },
  { 
    id: 'operational-efficiency', 
    label: 'Operational Efficiency',
    description: 'Best for: Cost reduction, process optimization',
    defaults: { category: 'Operations', priority: 'P2', risk: 'Low' }
  },
];

// Render
<div className="space-y-3">
  {METHODOLOGIES.map((method) => (
    <button
      key={method.id}
      onClick={() => setMethodologyId(method.id)}
      className={`
        w-full p-4 rounded-lg border-2 text-left transition-all
        ${methodologyId === method.id
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`
          w-5 h-5 rounded-full border-2 flex items-center justify-center
          ${methodologyId === method.id
            ? 'border-primary-500 bg-primary-500'
            : 'border-slate-300'
          }
        `}>
          {methodologyId === method.id && (
            <Check className="w-3 h-3 text-white" />
          )}
        </div>
        <div>
          <div className="font-medium">{method.label}</div>
          <div className="text-sm text-slate-500">{method.description}</div>
          <div className="text-xs text-slate-400 mt-1">
            Defaults: {method.defaults.category} · {method.defaults.priority} · {method.defaults.risk} risk
          </div>
        </div>
      </div>
    </button>
  ))}
</div>
```

### 3. Context Options

```typescript
const [includeChatContext, setIncludeChatContext] = useState(defaults.includeChatContext);
const [includeOrgProfile, setIncludeOrgProfile] = useState(true);
const [includeRecentInitiatives, setIncludeRecentInitiatives] = useState(true);

// Render
<div className="space-y-3">
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={includeChatContext}
      onChange={(e) => setIncludeChatContext(e.target.checked)}
      className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-500 
                 focus:ring-primary-500"
    />
    <div>
      <div className="font-medium">Include AI chat context</div>
      <div className="text-sm text-slate-500">
        Use recent chat history to improve initiative relevance
      </div>
    </div>
  </label>
  
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={includeOrgProfile}
      onChange={(e) => setIncludeOrgProfile(e.target.checked)}
      className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-500 
                 focus:ring-primary-500"
    />
    <div>
      <div className="font-medium">Include organization profile</div>
      <div className="text-sm text-slate-500">
        Add company context (industry, size, goals)
      </div>
    </div>
  </label>
  
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={includeRecentInitiatives}
      onChange={(e) => setIncludeRecentInitiatives(e.target.checked)}
      className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-500 
                 focus:ring-primary-500"
    />
    <div>
      <div className="font-medium">Include recent initiatives</div>
      <div className="text-sm text-slate-500">
        Reference existing initiatives to avoid duplicates
      </div>
    </div>
  </label>
</div>
```

### 4. Preview list

Pokazuje placeholdery z metadanymi metodyki:

```typescript
const selectedMethodology = METHODOLOGIES.find(m => m.id === methodologyId);
const previewMeta = selectedMethodology?.defaults || { 
  category: 'Strategy', 
  priority: 'P1', 
  risk: 'Medium' 
};

// Render
<div className="p-4 rounded-lg bg-slate-50 dark:bg-navy-800/50">
  <div className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wide">
    Preview
  </div>
  <div className="space-y-2">
    {Array.from({ length: finalCount }).map((_, idx) => (
      <div 
        key={idx}
        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
      >
        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 
                        flex items-center justify-center text-xs font-medium">
          {idx + 1}
        </div>
        <span>Initiative {idx + 1}</span>
        <span className="text-slate-400">·</span>
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
          getCategoryColor(previewMeta.category)
        }`}>
          {previewMeta.category}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
          getPriorityColor(previewMeta.priority)
        }`}>
          {previewMeta.priority}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
          getRiskColor(previewMeta.risk)
        }`}>
          {previewMeta.risk}
        </span>
      </div>
    ))}
  </div>
  <div className="text-xs text-slate-400 mt-3">
    Estimated generation time: ~{Math.ceil(finalCount * 1.2)} seconds
  </div>
</div>
```

---

## Walidacje

### Frontend
| Pole | Walidacja | Komunikat |
|------|-----------|-----------|
| `count` | 1-7 | "Count must be between 1 and 7" |
| `methodologyId` | required | "Please select a methodology" |

### Backend
| Warunek | Kod | Komunikat |
|---------|-----|-----------|
| count > 7 | 400 | "Initiative count exceeds limit 7" |
| count < 1 | 400 | "Initiative count must be at least 1" |
| Brak methodologyId | 400 | "methodologyId is required" |
| Status != APPROVED | 409 | "Tool session not approved" |
| Brak permission | 403 | "Permission denied" |

---

## API Call

```typescript
const handleGenerate = async () => {
  if (toolPermissions.canGenerate === false) {
    toast.error(isPolish ? 'Brak uprawnien' : 'Permission denied');
    return;
  }
  
  setIsGenerating(true);
  setGenerationProgress(0);
  
  try {
    // Start progress animation
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => Math.min(prev + 10, 90));
    }, 500);
    
    const result = await Api.generateToolInitiatives(toolSessionId, {
      methodologyId,
      count: finalCount,
      includeChatContext,
      includeOrgProfile,
      includeRecentInitiatives
    });
    
    clearInterval(progressInterval);
    setGenerationProgress(100);
    
    // Update state
    setGeneratedInitiatives(result.initiatives || []);
    
    // Close modal after short delay
    setTimeout(() => {
      setShowGenerateModal(false);
      toast.success(
        isPolish 
          ? `Wygenerowano ${result.initiatives?.length || 0} inicjatyw` 
          : `Generated ${result.initiatives?.length || 0} initiatives`
      );
    }, 500);
    
    // Track analytics
    analytics.track('initiatives_generated', {
      toolId: toolSessionId,
      toolType,
      methodologyId,
      count: result.initiatives?.length || 0,
      includeChatContext,
      processingTime: result.metadata?.processingTime
    });
    
  } catch (err: any) {
    const errorMessage = err?.response?.data?.error || err?.message || 'Failed to generate';
    toast.error(errorMessage);
    console.error('Generate initiatives failed:', err);
  } finally {
    setIsGenerating(false);
    setGenerationProgress(0);
  }
};
```

---

## Po wygenerowaniu

1. Modal zamyka sie z animacja
2. Toast "Generated X initiatives"
3. Lista `generatedInitiatives` aktualizuje sie
4. Inicjatywy widoczne w:
   - Context Panel (sekcja "Generated from this tool")
   - Zakladka "Initiatives" w DiscoveryToolsHub
   - Initiatives Hub (filtr: source = tool)

```typescript
// Context Panel - Generated section
<div className="mt-6">
  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
    Generated from this tool ({generatedInitiatives.length})
  </h4>
  
  {generatedInitiatives.length === 0 ? (
    <p className="text-sm text-slate-500">No initiatives generated yet</p>
  ) : (
    <div className="space-y-2">
      {generatedInitiatives.map((initiative) => (
        <div 
          key={initiative.id}
          className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800/50 
                     hover:bg-slate-100 cursor-pointer transition-colors"
          onClick={() => navigateToInitiative(initiative.id)}
        >
          <div className="font-medium text-sm truncate">{initiative.title}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              getStatusColor(initiative.status)
            }`}>
              {initiative.status}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              getCategoryColor(initiative.category)
            }`}>
              {initiative.category}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              getPriorityColor(initiative.priority)
            }`}>
              {initiative.priority}
            </span>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

---

## Stany

| Stan | UI | Akcje |
|------|-----|-------|
| Idle | Modal z formularzem | Configure, Generate |
| Generating | Progress bar, disabled inputs | Cancel (if supported) |
| Success | Modal zamkniety + toast | View initiatives |
| Error | Toast z bledem, modal otwarty | Retry |

### Generating state UI
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Generating Initiatives...                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │                         ✨                                           │   │
│  │                                                                      │   │
│  │              Analyzing your SWOT data...                             │   │
│  │                                                                      │   │
│  │              ████████████████░░░░░░░░░░░░ 65%                        │   │
│  │                                                                      │   │
│  │              Generating initiative 3 of 5                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  This may take up to 10 seconds...                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Przykladowe scenariusze

### Scenariusz 1: Sukces - generacja 5 inicjatyw
```
User: Otwiera modal po zatwierdzeniu narzedzia
User: Wybiera count: 5, methodology: Impact x Feasibility
User: Zaznacza "Include AI chat context"
User: Klika "Generate Drafts"
UI: Progress bar 0% -> 100%
System: POST /api/tools/:id/generate-initiatives
Response: { batchId, initiatives: [...5 items] }
UI: Toast "Generated 5 initiatives", modal zamyka sie
```

### Scenariusz 2: Blad - count > 7
```
User: Wpisuje custom count: 10
UI: Input pokazuje wartosc 7 (max)
User: Klika "Generate Drafts"
System: Walidacja frontend przepuszcza (count = 7)
```

### Scenariusz 3: Blad serwera
```
User: Klika "Generate Drafts"
System: POST /api/tools/:id/generate-initiatives
Server: 503 Service Unavailable (AI timeout)
UI: Toast "AI service temporarily unavailable. Please try again."
Modal: Pozostaje otwarty, przycisk wraca do enabled
```

---

## Pliki zrodlowe

- `src/components/DiscoveryTools/GenerateInitiativesModal.tsx`
- `src/components/DiscoveryTools/ToolWorkspace.tsx` (handleGenerate)
- `src/services/api.ts` (generateToolInitiatives)
