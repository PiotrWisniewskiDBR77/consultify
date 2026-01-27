# Tools - Request Review Flow (UI)

## Cel
Opisac UI flow request-review (modal/panel, wybor ownera decyzji, due date, confirm).

## Status
W audycie wskazano braki typu "owner selection UI" jako nice-to-have - tu je opisujemy jako standard docelowy.

## Zrodla
- Kod: `src/components/DiscoveryTools/ToolWorkspace.tsx` (linie 392-415, 562-628)
- Kod: `src/components/DiscoveryTools/ToolHeader.tsx`

---

## Flow diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [DRAFT] ─────────────────────────────────────────────────────────────────► │
│      │                                                                      │
│      │  1. User fills in tool sections                                      │
│      │  2. Completion checker shows progress (0% → 100%)                    │
│      │  3. Confidence builds as detail increases (1 → 5)                    │
│      │  4. When DoD met → "Request Review" button activates                 │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Request Review Button                                               │   │
│  │                                                                      │   │
│  │  Conditions:                                                         │   │
│  │  ✓ completionReady = true (gaps.length === 0)                       │   │
│  │  ✓ canRequestReview permission (ADMIN, PM, SUPERADMIN)              │   │
│  │  ✓ status === 'DRAFT'                                               │   │
│  │                                                                      │   │
│  │  Visual states:                                                      │   │
│  │  • Disabled (gray): DoD not met or no permission                    │   │
│  │  • Enabled (primary): Ready to request                              │   │
│  │  • Loading (spinner): Request in progress                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│      │                                                                      │
│      │  User clicks "Request Review"                                        │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Request Review Modal                                                │   │
│  │                                                                      │   │
│  │  Elements:                                                           │   │
│  │  1. DoD status (gaps or "All criteria met")                         │   │
│  │  2. Due date picker (default: +7 days)                              │   │
│  │  3. Priority selector (Low/Medium/High/Critical)                    │   │
│  │  4. Comment field (optional)                                        │   │
│  │  5. Cancel / Send to review buttons                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│      │                                                                      │
│      │  User fills form and clicks "Send to review"                         │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  API Call                                                            │   │
│  │                                                                      │   │
│  │  POST /api/tools/:toolId/request-review                             │   │
│  │  {                                                                   │   │
│  │    dueDate: "2026-02-05",                                           │   │
│  │    priority: "high",                                                │   │
│  │    comment: "Ready for strategic review"                            │   │
│  │  }                                                                   │   │
│  │                                                                      │   │
│  │  Response: { id, status: "REVIEW", decisionId }                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│      │                                                                      │
│      │  Success → Update UI                                                 │
│      │                                                                      │
│      ▼                                                                      │
│  [REVIEW] ◄────────────────────────────────────────────────────────────────│
│      │                                                                      │
│      │  UI changes:                                                         │
│      │  • Status badge: DRAFT → REVIEW                                     │
│      │  • Canvas → Review Panel                                            │
│      │  • Toast: "Review requested"                                        │
│      │  • Notification sent to reviewers                                   │
│      │                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Request Review Button

### Lokalizacja
`ToolHeader.tsx` - gorny pasek workspace

### Stany przycisku

| Stan | Warunek | Wyglad | Akcja |
|------|---------|--------|-------|
| Disabled | DoD not met | Gray, cursor-not-allowed | Tooltip z gaps |
| Disabled | No permission | Gray, cursor-not-allowed | Tooltip z info |
| Enabled | Ready | Primary color, shadow | Opens modal |
| Loading | Request in progress | Spinner, disabled | None |
| Success | Request sent | Hidden (status changed) | None |

### Kod
```typescript
// ToolHeader.tsx
interface RequestReviewButtonProps {
  canRequestReview: boolean;
  completionReady: boolean;
  gaps: string[];
  isLoading: boolean;
  onRequestReview: () => void;
  isPolish: boolean;
}

const RequestReviewButton: React.FC<RequestReviewButtonProps> = ({
  canRequestReview,
  completionReady,
  gaps,
  isLoading,
  onRequestReview,
  isPolish
}) => {
  const isDisabled = !canRequestReview || !completionReady || isLoading;
  
  const getTooltipContent = () => {
    if (!canRequestReview) {
      return isPolish 
        ? 'Brak uprawnien do wysylania do review' 
        : 'No permission to request review';
    }
    if (!completionReady) {
      return isPolish
        ? `Brakuje: ${gaps.join(', ')}`
        : `Missing: ${gaps.join(', ')}`;
    }
    return isPolish ? 'Wyslij do review' : 'Send for review';
  };
  
  return (
    <Tooltip content={getTooltipContent()}>
      <button
        onClick={onRequestReview}
        disabled={isDisabled}
        className={`
          px-4 py-2 rounded-lg text-sm font-medium transition-all
          flex items-center gap-2
          ${isDisabled
            ? 'bg-slate-200 dark:bg-navy-800 text-slate-400 cursor-not-allowed'
            : 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow'
          }
        `}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {isPolish ? 'Wysylanie...' : 'Sending...'}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {isPolish ? 'Request review' : 'Request review'}
          </>
        )}
      </button>
    </Tooltip>
  );
};
```

### Warunki aktywnosci
```typescript
// ToolWorkspace.tsx
const canRequestReviewButton = useMemo(() => {
  return (
    completionReady &&                           // DoD met
    toolPermissions.canRequestReview !== false && // Has permission
    toolStatus === 'DRAFT'                       // Correct status
  );
}, [completionReady, toolPermissions, toolStatus]);
```

---

## Request Review Modal

### Struktura
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Request Review                                                         [X] │
│  Verify completeness and send for approval                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DoD Status                                                          │   │
│  │                                                                      │   │
│  │  ✅ All criteria met                                                 │   │
│  │                                                                      │   │
│  │  ✓ Completion: 100%                                                  │   │
│  │  ✓ Confidence: 4.2/5                                                 │   │
│  │  ✓ Strategic context defined                                         │   │
│  │  ✓ Strengths: 5 items                                                │   │
│  │  ✓ Weaknesses: 3 items                                               │   │
│  │  ✓ Opportunities: 4 items                                            │   │
│  │  ✓ Threats: 2 items                                                  │   │
│  │  ✓ Correlations: 8 created                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Review Settings                                                            │
│                                                                             │
│  Due date *                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ February 5, 2026                                                [📅] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  Review should be completed by this date                                    │
│                                                                             │
│  Priority                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ Low    ○ Medium    ● High    ○ Critical                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  │ Low      │ Standard review, no urgency                              │   │
│  │ Medium   │ Normal priority, review within due date                  │   │
│  │ High     │ Important, prioritize review                             │   │
│  │ Critical │ Urgent, requires immediate attention                     │   │
│                                                                             │
│  Comment (optional)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SWOT analysis complete for Manufacturing Division.                   │   │
│  │                                                                      │   │
│  │ Key findings:                                                        │   │
│  │ - Strong brand recognition and experienced workforce                 │   │
│  │ - Opportunities in APAC market expansion                             │   │
│  │ - Risk mitigation strategies recommended                             │   │
│  │                                                                      │   │
│  │ Ready for strategic review and initiative generation.                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  0/1000 characters                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Cancel]                                              [Send to Review →]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Kod
```typescript
// ToolWorkspace.tsx
interface RequestReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RequestReviewData) => Promise<void>;
  gaps: string[];
  completionPercent: number;
  confidenceAvg: number;
  isPolish: boolean;
  toolName: string;
}

const RequestReviewModal: React.FC<RequestReviewModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  gaps,
  completionPercent,
  confidenceAvg,
  isPolish,
  toolName
}) => {
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  });
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({ dueDate, priority, comment });
      onClose();
    } catch (error) {
      // Error handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-navy-900 p-6 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {isPolish ? 'Request review' : 'Request review'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {isPolish 
                  ? 'Sprawdz kompletnosc i wyslij do zatwierdzenia' 
                  : 'Verify completeness and send for approval'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* DoD Status */}
          <DoDStatusCard 
            gaps={gaps}
            completionPercent={completionPercent}
            confidenceAvg={confidenceAvg}
            isPolish={isPolish}
          />
          
          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {isPolish ? 'Termin review' : 'Due date'} *
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 
                         dark:border-navy-600 dark:bg-navy-800
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              {isPolish 
                ? 'Review powinien byc zakonczony do tej daty' 
                : 'Review should be completed by this date'}
            </p>
          </div>
          
          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {isPolish ? 'Priorytet' : 'Priority'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${priority === p
                      ? getPriorityStyle(p, true)
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 hover:bg-slate-200'
                    }
                  `}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {getPriorityDescription(priority, isPolish)}
            </p>
          </div>
          
          {/* Comment */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {isPolish ? 'Komentarz (opcjonalny)' : 'Comment (optional)'}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder={isPolish 
                ? 'Dodaj kontekst lub uwagi dla reviewera...' 
                : 'Add context or notes for the reviewer...'}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 
                         dark:border-navy-600 dark:bg-navy-800 resize-none
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-slate-500 mt-1 text-right">
              {comment.length}/1000
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-navy-900 p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium
                       bg-slate-100 hover:bg-slate-200 dark:bg-navy-800
                       transition-colors"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || gaps.length > 0}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              flex items-center gap-2 transition-all
              ${gaps.length > 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm'
              }
            `}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isPolish ? 'Wysylanie...' : 'Sending...'}
              </>
            ) : (
              <>
                {isPolish ? 'Wyslij do review' : 'Send to review'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions
const getPriorityStyle = (priority: string, selected: boolean): string => {
  if (!selected) return '';
  switch (priority) {
    case 'low': return 'bg-slate-500 text-white';
    case 'medium': return 'bg-blue-500 text-white';
    case 'high': return 'bg-amber-500 text-white';
    case 'critical': return 'bg-red-500 text-white';
    default: return 'bg-primary-500 text-white';
  }
};

const getPriorityDescription = (priority: string, isPolish: boolean): string => {
  const descriptions = {
    low: isPolish ? 'Standardowy review, bez pilnosci' : 'Standard review, no urgency',
    medium: isPolish ? 'Normalny priorytet, review w terminie' : 'Normal priority, review within due date',
    high: isPolish ? 'Wazne, priorytetowy review' : 'Important, prioritize review',
    critical: isPolish ? 'Pilne, wymaga natychmiastowej uwagi' : 'Urgent, requires immediate attention'
  };
  return descriptions[priority] || '';
};
```

---

## API Call

```typescript
const handleConfirmRequestReview = async () => {
  if (!toolSessionId) return;
  
  setIsRequestingReview(true);
  
  try {
    const result = await Api.requestToolReview(toolSessionId, {
      dueDate: reviewDueDate || undefined,
      priority: reviewPriority,
      comment: reviewComment || undefined
    });
    
    // Update local state
    setToolStatus(result.status || 'REVIEW');
    
    // Show success toast
    toast.success(isPolish ? 'Wyslano do review' : 'Review requested');
    
    // Refresh session data
    await refreshToolSession();
    
    // Close modal
    setShowRequestReviewModal(false);
    
    // Track analytics
    analytics.track('tool_review_requested', {
      toolId: toolSessionId,
      toolType,
      priority: reviewPriority,
      hasDueDate: !!reviewDueDate,
      hasComment: !!reviewComment
    });
    
  } catch (err: any) {
    const errorMessage = err?.response?.data?.error || err?.message || 'Failed to request review';
    toast.error(errorMessage);
    
    // Log error for debugging
    console.error('Request review failed:', err);
  } finally {
    setIsRequestingReview(false);
  }
};
```

---

## Po wyslaniu do review

1. Status zmienia sie na `REVIEW`
2. Modal zamyka sie
3. Toast "Review requested"
4. UI przechodzi do `ToolReviewPanel`
5. Notyfikacja wysylana do reviewerow

```typescript
// ToolWorkspace.tsx
{toolStatus === 'REVIEW' ? (
  <ToolReviewPanel
    toolType={toolType}
    session={currentSession}
    gaps={reviewGaps}
    onApprove={handleApprove}
    onSendBack={handleSendBack}
    onConfigureGenerate={() => setShowGenerateModal(true)}
    decisions={toolDecisions}
    canApprove={toolPermissions.canApproveTool !== false}
    canGenerate={toolPermissions.canGenerate !== false}
    reviewRequestedAt={currentSession?.reviewRequestedAt}
    reviewRequestedBy={currentSession?.reviewRequestedBy}
    isPolish={isPolish}
  />
) : (
  <ToolCanvas 
    toolType={toolType}
    session={currentSession}
    onUpdate={handleSessionUpdate}
    isPolish={isPolish}
  />
)}
```

---

## Nice-to-have (P2)

### Decision Owner Selection
Obecnie backend przyjmuje `decisionOwnerId`, ale UI nie ma selektora.

Docelowo:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Reviewer                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 👤 Anna Kowalska (PMO Director)                                 [▼] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Available reviewers:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 👤 Anna Kowalska          PMO Director        Available             │   │
│  │ 👤 Jan Nowak              CTO                 Available             │   │
│  │ 👤 Maria Wisniewska       Strategy Lead       On leave until Feb 1  │   │
│  │ 👤 Piotr Kowalczyk        Operations Head     Available             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Checklist DoD
Zamiast prostego "No gaps" / "Gaps: ...", interaktywna lista z progress:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DoD Checklist                                                              │
│                                                                             │
│  Overall: 85% complete                                                      │
│  ████████████████░░░░                                                       │
│                                                                             │
│  ✓ Strategic context defined                           ████████████ 100%   │
│  ✓ Strengths identified (5/2 min)                      ████████████ 100%   │
│  ✓ Weaknesses identified (3/2 min)                     ████████████ 100%   │
│  ○ Opportunities identified (1/2 min)                  ██████░░░░░░ 50%    │
│  ○ Threats identified (0/2 min)                        ░░░░░░░░░░░░ 0%     │
│  ○ Correlations created (1/3 min)                      ████░░░░░░░░ 33%    │
│                                                                             │
│  [Complete missing items to enable review]                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Przykladowe scenariusze

### Scenariusz 1: Sukces - pelne dane
```
User: Klika "Request Review"
Modal: Otwiera sie z DoD status "All criteria met"
User: Wybiera due date: Feb 5, priority: High
User: Dodaje komentarz: "Ready for strategic review"
User: Klika "Send to review"
System: POST /api/tools/:id/request-review
Response: { status: "REVIEW", decisionId: "dec-001" }
UI: Toast "Review requested", status badge zmienia sie na REVIEW
```

### Scenariusz 2: Blad - DoD niespelnione
```
User: Klika "Request Review" (przycisk aktywny przez blad)
Modal: Otwiera sie z DoD status "Missing criteria"
UI: Przycisk "Send to review" jest disabled
User: Widzi liste brakow: "Add 1 more opportunity, Add 2 threats"
User: Klika "Cancel" i wraca do edycji
```

### Scenariusz 3: Blad serwera
```
User: Klika "Send to review"
System: POST /api/tools/:id/request-review
Server: 500 Internal Server Error
UI: Toast "Failed to request review. Please try again."
Modal: Pozostaje otwarty, przycisk wraca do stanu enabled
```

---

## Pliki zrodlowe

- `src/components/DiscoveryTools/ToolWorkspace.tsx`
- `src/components/DiscoveryTools/ToolHeader.tsx`
- `src/services/api.ts` (metoda `requestToolReview`)
