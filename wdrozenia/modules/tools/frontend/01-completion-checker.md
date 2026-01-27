# Tools - Completion Checker

## Cel
Zdefiniowac Definition of Done (DoD) narzedzia oraz UI "completion checker".

## Zrodla
- `wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md` (sekcja "Definition of Done (DoD)")
- Kod: `src/components/DiscoveryTools/ToolContextPanel.tsx`
- Kod: `src/components/DiscoveryTools/ToolWorkspace.tsx`

---

## Definition of Done (DoD)

### Kanon (minimum)
```typescript
const requireDoD = (session: ToolSessionRow): boolean => {
  return (session.completion_percent || 0) >= 100 
      && (session.confidence_avg || 0) >= 3;
};
```

| Kryterium | Wymagana wartosc | Opis | Waga |
|-----------|------------------|------|------|
| `completion_percent` | >= 100 | Wszystkie wymagane pola wypelnione | 60% |
| `confidence_avg` | >= 3 | Srednia pewnosc odpowiedzi (skala 1-5) | 40% |

### Rozszerzone kryteria per narzedzie

| Narzedzie | Wymagane sekcje | Min. elementow | Dodatkowe wymagania |
|-----------|-----------------|----------------|---------------------|
| Dynamic SWOT | Context, 4 quadrants, Correlations | S:2, W:2, O:2, T:2 | Min 3 korelacje |
| Market Forces | Context, 5 forces | 2 drivers per force | Industry defined |
| Growth Paths | Context, 4 quadrants | 1 option per quadrant | Timeframe set |
| Portfolio Priority | Context, Products | 4 products | Axes defined |
| Risk & Uncertainty | Context, Risks | 5 risks | Impact + probability |

---

## Completion Checker UI

### Lokalizacja
`ToolContextPanel.tsx` - prawy panel w workspace

### Wyglad
```
┌─────────────────────────────────────────┐
│  Completion                             │
│  ████████████████░░░░ 80%               │
│                                         │
│  Criteria:                              │
│  ─────────────────────────────────────  │
│                                         │
│  Context                                │
│  ✓ Goal defined                         │
│  ✓ Scope defined                        │
│  ✓ Timeframe set                        │
│                                         │
│  SWOT Items                             │
│  ✓ Strengths (5/2 min)      ████████    │
│  ✓ Weaknesses (3/2 min)     ██████      │
│  ○ Opportunities (1/2 min)  ██░░░░      │
│  ○ Threats (0/2 min)        ░░░░░░      │
│                                         │
│  Correlations                           │
│  ○ Correlations (0/3 min)   ░░░░░░      │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Confidence: 3.2/5                      │
│  ████████████░░░░░░░░                   │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Missing for Request Review:            │
│  • Add 1 more opportunity               │
│  • Add 2 threats                        │
│  • Create 3 correlations                │
│                                         │
└─────────────────────────────────────────┘
```

---

## Obliczanie completion_percent

### Dynamic SWOT
```typescript
const calculateSWOTCompletion = (data: SWOTData): number => {
  let score = 0;
  const weights = {
    context: 20,      // 20%
    strengths: 15,    // 15%
    weaknesses: 15,   // 15%
    opportunities: 15, // 15%
    threats: 15,      // 15%
    correlations: 20  // 20%
  };
  
  // Context (20%)
  if (data.context?.goal && data.context?.scope) {
    score += weights.context;
  } else if (data.context?.goal || data.context?.scope) {
    score += weights.context * 0.5;
  }
  
  // Quadrants (15% each, min 2 items)
  const quadrants = ['strengths', 'weaknesses', 'opportunities', 'threats'];
  quadrants.forEach(q => {
    const items = data.items?.filter(i => i.quadrant === q) || [];
    const count = items.length;
    if (count >= 2) {
      score += weights[q];
    } else if (count === 1) {
      score += weights[q] * 0.5;
    }
  });
  
  // Correlations (20%, min 3)
  const correlations = data.correlations?.length || 0;
  if (correlations >= 3) {
    score += weights.correlations;
  } else {
    score += weights.correlations * (correlations / 3);
  }
  
  return Math.round(score);
};
```

### Przykladowe obliczenia

| Scenariusz | Context | S | W | O | T | Corr | Score |
|------------|---------|---|---|---|---|------|-------|
| Pusty | 0 | 0 | 0 | 0 | 0 | 0 | 0% |
| Tylko context | 20 | 0 | 0 | 0 | 0 | 0 | 20% |
| Context + S,W | 20 | 15 | 15 | 0 | 0 | 0 | 50% |
| Context + S,W,O,T | 20 | 15 | 15 | 15 | 15 | 0 | 80% |
| Kompletny | 20 | 15 | 15 | 15 | 15 | 20 | 100% |
| Czesciowy S | 20 | 7.5 | 15 | 15 | 15 | 20 | 92.5% |

### Market Forces (Porter)
```typescript
const calculatePorterCompletion = (data: PorterData): number => {
  let score = 0;
  const weights = {
    context: 20,
    forcePerForce: 16 // 5 forces * 16% = 80%
  };
  
  // Context (20%)
  if (data.context?.industry && data.context?.geographicScope) {
    score += weights.context;
  }
  
  // 5 Forces (16% each, min 2 drivers)
  const forces = ['rivalry', 'newEntrants', 'substitutes', 'buyerPower', 'supplierPower'];
  forces.forEach(force => {
    const drivers = data.forces?.[force]?.drivers || [];
    if (drivers.length >= 2) {
      score += weights.forcePerForce;
    } else if (drivers.length === 1) {
      score += weights.forcePerForce * 0.5;
    }
  });
  
  return Math.round(score);
};
```

---

## Obliczanie confidence_avg

```typescript
const calculateConfidence = (
  completionPercent: number,
  itemCount: number,
  hasCorrelations: boolean,
  hasDetailedDescriptions: boolean
): number => {
  let confidence = 1; // Base confidence
  
  // Completion bonus (0-2 points)
  if (completionPercent >= 100) {
    confidence += 2;
  } else if (completionPercent >= 80) {
    confidence += 1.5;
  } else if (completionPercent >= 50) {
    confidence += 1;
  } else if (completionPercent >= 25) {
    confidence += 0.5;
  }
  
  // Item count bonus (0-1 point)
  if (itemCount >= 15) {
    confidence += 1;
  } else if (itemCount >= 10) {
    confidence += 0.5;
  }
  
  // Correlations bonus (0-0.5 point)
  if (hasCorrelations) {
    confidence += 0.5;
  }
  
  // Detailed descriptions bonus (0-0.5 point)
  if (hasDetailedDescriptions) {
    confidence += 0.5;
  }
  
  return Math.min(5, Math.max(1, confidence));
};
```

### Przykladowe obliczenia confidence

| Scenariusz | Completion | Items | Corr | Details | Confidence |
|------------|------------|-------|------|---------|------------|
| Pusty | 0% | 0 | No | No | 1.0 |
| Podstawowy | 50% | 5 | No | No | 2.0 |
| Sredni | 80% | 10 | Yes | No | 3.5 |
| Dobry | 100% | 12 | Yes | No | 4.0 |
| Pelny | 100% | 15 | Yes | Yes | 5.0 |

---

## Synchronizacja z backend

```typescript
// ToolWorkspace.tsx - auto-sync
useEffect(() => {
  const syncSession = async () => {
    if (!currentSession || !toolSessionId) return;
    
    const completionPercent = calculateCompletion(currentSession.inputData, toolType);
    const confidenceAvg = calculateConfidence(
      completionPercent,
      getItemCount(currentSession.inputData),
      hasCorrelations(currentSession.inputData),
      hasDetailedDescriptions(currentSession.inputData)
    );
    
    try {
      await Api.updateToolSession(toolSessionId, {
        answers: currentSession.inputData,
        completionPercent,
        confidenceAvg,
        contextSnapshot: {
          org: {
            name: currentOrganization?.name,
            industry: currentOrganization?.industry,
            size: currentOrganization?.size
          },
          chat: activeChatMessages.slice(-50).map((m) => ({ 
            role: m.role, 
            content: m.content 
          })),
          initiatives: recentInitiatives.slice(0, 10).map(i => ({
            id: i.id,
            title: i.title,
            status: i.status
          })),
        },
      });
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-sync failed:', error);
      toast.error('Failed to save changes');
    }
  };
  
  const timeout = setTimeout(syncSession, 1500);  // Debounce 1.5s
  return () => clearTimeout(timeout);
}, [currentSession, toolSessionId, currentOrganization, activeChatMessages, recentInitiatives]);
```

---

## Blokada Request Review

```typescript
// ToolHeader.tsx
interface ToolHeaderProps {
  canRequestReview: boolean;
  completionPercent: number;
  confidenceAvg: number;
  gaps: string[];
  onRequestReview: () => void;
}

const ToolHeader: React.FC<ToolHeaderProps> = ({
  canRequestReview,
  completionPercent,
  confidenceAvg,
  gaps,
  onRequestReview
}) => {
  const isDoDAchieved = completionPercent >= 100 && confidenceAvg >= 3;
  const buttonDisabled = !canRequestReview || !isDoDAchieved;
  
  return (
    <div className="flex items-center gap-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${
              completionPercent >= 100 ? 'bg-emerald-500' : 'bg-primary-500'
            }`}
            style={{ width: `${Math.min(100, completionPercent)}%` }}
          />
        </div>
        <span className="text-sm font-medium">{completionPercent}%</span>
      </div>
      
      {/* Confidence indicator */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star 
            key={star}
            className={`w-4 h-4 ${
              star <= confidenceAvg ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
            }`}
          />
        ))}
      </div>
      
      {/* Request Review button */}
      <Tooltip 
        content={
          buttonDisabled 
            ? `Missing: ${gaps.join(', ')}` 
            : 'Send for review'
        }
      >
        <button
          onClick={onRequestReview}
          disabled={buttonDisabled}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${buttonDisabled
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm'
            }
          `}
        >
          Request Review
        </button>
      </Tooltip>
    </div>
  );
};
```

---

## Request Review Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Request Review                                                         [X] │
│  Verify completeness before sending for approval                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DoD Status                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✅ All criteria met                                                 │   │
│  │                                                                      │   │
│  │  ✓ Completion: 100%                                                  │   │
│  │  ✓ Confidence: 4.2/5                                                 │   │
│  │  ✓ Context defined                                                   │   │
│  │  ✓ All quadrants populated                                           │   │
│  │  ✓ Correlations created                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  lub:                                                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Missing criteria                                                 │   │
│  │                                                                      │   │
│  │  ✓ Completion: 85%                                                   │   │
│  │  ✗ Confidence: 2.5/5 (min 3.0 required)                              │   │
│  │  ✓ Context defined                                                   │   │
│  │  ✗ Opportunities: 1/2 min                                            │   │
│  │  ✗ Threats: 0/2 min                                                  │   │
│  │  ✗ Correlations: 1/3 min                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Review Settings                                                            │
│                                                                             │
│  Due date                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ February 5, 2026                                                [📅] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Priority                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ High                                                            [▼] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ○ Low   ○ Medium   ● High   ○ Critical                                    │
│                                                                             │
│  Comment (optional)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Analysis complete. Key findings:                                     │   │
│  │ - Strong brand recognition identified                                │   │
│  │ - Market expansion opportunities in APAC                             │   │
│  │ - Risk mitigation strategies recommended                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Cancel]                                              [Send to Review →]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Gaps Display

### W Request Review Modal
```typescript
const GapsDisplay: React.FC<{ gaps: string[]; isPolish: boolean }> = ({ gaps, isPolish }) => {
  if (gaps.length === 0) {
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">
            {isPolish ? 'Wszystkie kryteria spelnione' : 'All criteria met'}
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-2 text-amber-700 mb-3">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-medium">
          {isPolish ? 'Brakujace kryteria' : 'Missing criteria'}
        </span>
      </div>
      <ul className="space-y-2">
        {gaps.map((gap, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm text-amber-800">
            <X className="w-4 h-4 text-amber-500" />
            {gap}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### Przykladowe gaps

| Narzedzie | Gap | Komunikat |
|-----------|-----|-----------|
| SWOT | Missing context | Strategic context not defined |
| SWOT | Missing strengths | Add at least 2 strengths |
| SWOT | Missing correlations | Create at least 3 correlations |
| Porter | Missing industry | Define target industry |
| Porter | Missing drivers | Add drivers for Supplier Power |
| Growth | Missing options | Add option for Market Development |
| BCG | Missing products | Add at least 4 products |
| Risk | Missing risks | Add at least 5 risks |

---

## Nice-to-have (P3)

### Tooltipy Confidence
Obecnie confidence wyswietlany jako liczba bez tooltip.
Docelowo: tooltip z uzasadnieniem, np.:

| Confidence | Tooltip |
|------------|---------|
| 5.0 | "Excellent: Complete analysis with detailed descriptions and correlations" |
| 4.0 | "Good: All sections complete with adequate detail" |
| 3.0 | "Acceptable: Minimum requirements met" |
| 2.0 | "Needs work: Some sections incomplete" |
| 1.0 | "Insufficient: Major sections missing" |

### Checklist DoD w Modal
Obecnie tylko lista gaps.
Docelowo: interaktywna checklist z progress dla kazdego kryterium:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DoD Checklist                                                              │
│                                                                             │
│  ✓ Strategic context defined                           ████████████ 100%   │
│    Goal: Identify strategic opportunities                                   │
│    Scope: European manufacturing facilities                                 │
│                                                                             │
│  ✓ Strengths identified (5/2 min)                      ████████████ 100%   │
│    Strong brand, Experienced workforce, Modern equipment...                 │
│                                                                             │
│  ✓ Weaknesses identified (3/2 min)                     ████████████ 100%   │
│    High costs, Limited automation, Legacy systems                           │
│                                                                             │
│  ○ Opportunities identified (1/2 min)                  ██████░░░░░░ 50%    │
│    Market expansion in Asia                                                 │
│    [+ Add opportunity]                                                      │
│                                                                             │
│  ○ Threats identified (0/2 min)                        ░░░░░░░░░░░░ 0%     │
│    No threats defined yet                                                   │
│    [+ Add threat]                                                           │
│                                                                             │
│  ○ Correlations created (1/3 min)                      ████░░░░░░░░ 33%    │
│    S1 → O1 (leverage)                                                       │
│    [+ Add correlation]                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pliki zrodlowe

- `src/components/DiscoveryTools/ToolContextPanel.tsx` (linie 134-161)
- `src/components/DiscoveryTools/ToolWorkspace.tsx` (linie 214-243, 392-415)
- `server/src/controllers/ToolController.ts` (linie 154-156 - requireDoD)
