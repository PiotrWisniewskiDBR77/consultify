# Decision Tab Fix - Visual Architecture

## Component Hierarchy

```
InitiativesHub (Assessment Module)
│
├── ModuleHub (layout shell)
│   │
│   ├── DynamicTabs (tab bar at top)
│   │   ├── Initiative Tab 1
│   │   ├── Decision Tab (NEW! ✅)
│   │   └── Task Tab (NEW! ✅)
│   │
│   └── renderContent() ← Routes to appropriate view
│       │
│       ├─→ InitiativeDocumentView (when type === 'initiative')
│       │   │
│       │   ├── NModeLayout (shell)
│       │   │   │
│       │   │   ├── Left Nav
│       │   │   │   ├── Overview
│       │   │   │   ├── Decisions ← User clicks here
│       │   │   │   ├── Resources
│       │   │   │   └── ...
│       │   │   │
│       │   │   └── Content Area
│       │   │       │
│       │   │       └── DecisionsSection
│       │   │           │
│       │   │           ├── Table with decisions
│       │   │           │   └── Row menu (⋮)
│       │   │           │       ├── Open decision ← User clicks
│       │   │           │       ├── Duplicate
│       │   │           │       └── Delete
│       │   │           │
│       │   │           └── onOpenDecision() callback
│       │   │               ↓
│       │   │               Calls InitiativeDocumentView.handleOpenDecisionArtifact()
│       │   │               ↓
│       │   │               Calls props.onOpenDecision(decisionId) ✅ NOW PASSED
│       │   │               ↓
│       │   │               Calls InitiativesHub.handleOpenDecision()
│       │   │               ↓
│       │   │               Creates OpenDocument { type: 'decision' }
│       │   │               ↓
│       │   │               Sets activeDocumentId = decisionId
│       │   │               ↓
│       │   │               renderContent() detects type === 'decision'
│       │   │               ↓
│       │   └─────────────→ Renders DecisionDetailView ✅
│       │
│       │
│       ├─→ DecisionDetailView (when type === 'decision') ← NEW! ✅
│       │   │
│       │   ├── Header (title, status, priority)
│       │   ├── Context/Description
│       │   ├── Decision details (type, owner, due date)
│       │   ├── Comments section
│       │   ├── Activity log
│       │   └── Attachments
│       │
│       │
│       └─→ TaskDetailView (when type === 'task') ← NEW! ✅
│           │
│           ├── Header (title, status, priority)
│           ├── Description
│           ├── Task details (assignee, due date)
│           ├── Comments section
│           ├── Activity log
│           └── Attachments
```

## Data Flow

### BEFORE (Broken - Redirected to MyWork)

```
User Action: Click "Open decision" from row menu
    ↓
DecisionsSection.onOpenDecision(decisionId)
    ↓
InitiativeContext.onOpenDecision(decisionId)
    ↓
InitiativeDocumentView.handleOpenDecisionArtifact(decisionId)
    ↓
if (onOpenDecision) { ... }  ← PROP WAS UNDEFINED ❌
    ↓
// Fallback executed ❌
setMyWorkIntent({ tab: 'decisions', open: { type: 'decision', id } })
setCurrentView(AppView.MY_WORK)
    ↓
❌ USER REDIRECTED TO MYWORK MODULE
```

### AFTER (Fixed - Opens in Assessment)

```
User Action: Click "Open decision" from row menu
    ↓
DecisionsSection.onOpenDecision(decisionId)
    ↓
InitiativeContext.onOpenDecision(decisionId)
    ↓
InitiativeDocumentView.handleOpenDecisionArtifact(decisionId)
    ↓
if (onOpenDecision) { ... }  ← PROP IS DEFINED ✅
    ↓
onOpenDecision(decisionId)  ← CALLS PARENT HANDLER ✅
    ↓
InitiativesHub.handleOpenDecision(decisionId)
    ↓
1. Fetch decision from API: GET /decisions/:id
2. Create OpenDocument: { id, name, type: 'decision', subType, status }
3. Add to openDocuments array
4. Set activeDocumentId = decisionId
    ↓
ModuleHub re-renders → renderContent() called
    ↓
renderContent() finds activeDoc.type === 'decision'
    ↓
Returns <DecisionDetailView decisionId={...} />
    ↓
✅ DECISION OPENS AS TAB IN ASSESSMENT MODULE
```

## OpenDocument State Management

```javascript
// State in InitiativesHub
const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

// Example state after user opens initiative and then a decision:
[
  {
    id: "init_123",
    name: "Automated Changeover Optimization",
    type: "initiative",
    subType: "operational",
    status: "EXECUTING"
  },
  {
    id: "dec_456",                    // ← NEW!
    name: "Approve Budget Allocation",  // ← NEW!
    type: "decision",                    // ← NEW!
    subType: "BUDGET_APPROVAL",          // ← NEW!
    status: "PENDING"                    // ← NEW!
  }
]

activeDocumentId = "dec_456"  // ← Points to decision
```

## Tab Bar Visualization

```
┌─────────────────────────────────────────────────────────────┐
│ Assessment Module                                           │
├─────────────────────────────────────────────────────────────┤
│  [List] [Initiative: Auto Changeover...] [Decision: Appr...×] │ ← Tabs
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ DecisionDetailView                                    │ │
│  │                                                       │ │
│  │ Title: Approve Budget Allocation                     │ │
│  │ Status: [Pending] Priority: High                     │ │
│  │                                                       │ │
│  │ Context:                                             │ │
│  │ We need board approval for Q2 budget allocation...  │ │
│  │                                                       │ │
│  │ ... more content ...                                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Props Flow

```typescript
// InitiativesHub → InitiativeDocumentView
<InitiativeDocumentView
  initiativeId={activeDocumentId}
  onBack={handleShowList}
  onStatusChange={() => fetchData(true)}
  sourceModule="initiatives"
  onOpenDecision={handleOpenDecision}  // ✅ NEW PROP
  onOpenTask={handleOpenTask}          // ✅ NEW PROP
/>

// InitiativesHub → DecisionDetailView
<DecisionDetailView
  decisionId={activeDocumentId}
  onClose={handleShowList}
  onSaved={() => fetchData(true)}
/>

// InitiativesHub → TaskDetailView
<TaskDetailView
  taskId={activeDocumentId}
  onClose={handleShowList}
  onSaved={() => fetchData(true)}
  onOpenDecision={handleOpenDecision}
/>
```

## Type Definitions

```typescript
// OpenDocument type (already existed in ModuleHub types)
export interface OpenDocument {
  id: string;
  type: 'assessment' | 'tool' | 'report' | 'initiative' | 'task' | 'decision';
  //                                                       ^^^^    ^^^^^^^^
  //                                                       These already existed!
  subType: string;
  name: string;
  status: ItemStatus;
  hasUnsavedChanges?: boolean;
}

// Handler signatures
type HandleOpenDecision = (decisionId: string) => Promise<void>;
type HandleOpenTask = (taskId: string) => Promise<void>;
```

## File Structure

```
src/
├── components/
│   ├── Initiatives/
│   │   ├── InitiativesHub.tsx ← MODIFIED (added handlers & routing)
│   │   ├── InitiativeDocumentView.tsx (already had the callback logic)
│   │   └── sections/
│   │       └── DecisionsSection.tsx (triggers onOpenDecision)
│   │
│   ├── MyWork/
│   │   ├── DecisionDetailView.tsx ← NOW USED IN ASSESSMENT ✅
│   │   └── TaskDetailView.tsx ← NOW USED IN ASSESSMENT ✅
│   │
│   └── shared/
│       └── ModuleHub/
│           ├── types.ts (defines OpenDocument)
│           ├── ModuleHub.tsx (renders tabs & content)
│           └── DynamicTabs.tsx (tab bar UI)
```

## Success Metrics

```
✅ Decision opens as tab in Assessment    (not redirect to MyWork)
✅ Tab appears in DynamicTabs component   (visual confirmation)
✅ DecisionDetailView renders correctly   (content loads)
✅ URL stays in /initiatives route        (no navigation away)
✅ Can open multiple decisions as tabs    (state management works)
✅ Can switch between tabs                (tab switching works)
✅ Can close tabs independently           (tab cleanup works)
✅ No console errors                      (no runtime errors)
```

## Testing Checkpoints

```
[ ] Step 1: Navigate to initiative ✓
[ ] Step 2: Go to Decisions tab ✓
[ ] Step 3: Create test decision ✓
[ ] Step 4: Click "Open decision" ✓
    └─→ [ ] Verify: Opens as tab in Assessment (CRITICAL!)
    └─→ [ ] Verify: URL stays in /initiatives
    └─→ [ ] Verify: DecisionDetailView renders
[ ] Step 5: Test duplicate ✓
[ ] Step 6: Test delete ✓
[ ] Step 7: Check console errors ✓
```

---

**Legend:**

- ✅ = Fixed/Working
- ❌ = Broken/Issue
- ← = Data/control flow direction
- └─→ = Conditional branch or result
