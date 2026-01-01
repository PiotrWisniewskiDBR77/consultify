# Human-in-the-Loop (HITL) Learning System

## Overview

The HITL Learning System is an intelligent approval workflow that learns from user decisions and automatically handles similar actions in the future. It transforms repetitive approval tasks into a self-learning system that respects user preferences while maintaining human oversight.

```
┌──────────────────────────────────────────────────────────────────┐
│                     AI Action Request                             │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Pattern Matching                                │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ Generate       │→ │ Find Matching  │→ │ Calculate        │   │
│  │ Signature      │  │ Pattern        │  │ Confidence       │   │
│  └────────────────┘  └────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            Pattern Found           No Pattern
            Auto-Apply ON           or Manual
                    │                   │
                    ▼                   ▼
        ┌───────────────────┐  ┌───────────────────┐
        │  Auto-Decision    │  │  Human Review     │
        │  (>90% confidence)│  │  (Pending Queue)  │
        └───────────────────┘  └───────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │           Pattern Learning               │
        │  Record decision, update confidence      │
        └──────────────────────────────────────────┘
```

## Key Features

### 1. Approval Pattern Learning
- **Automatic pattern detection** - System generates signatures from action types and payload structures
- **Confidence-based decisions** - More consistent decisions = higher confidence = more automation
- **Risk-aware thresholds** - Different thresholds for LOW, MEDIUM, HIGH risk actions

### 2. Voice-First Approvals
- **Natural language commands** - "Approve", "Reject", "Skip", "Details"
- **Polish and English** - Full support for bilingual commands
- **Learning commands** - "Always approve this", "Zawsze akceptuj takie"
- **Audio feedback** - Voice responses confirm actions

### 3. Chat-Integrated Workflow
- **Inline approval buttons** - Approve/reject directly in chat
- **Pending notifications** - AI mentions pending actions in conversations
- **Context awareness** - Pattern info shown with each action

### 4. Settings Management
- **Pattern overview** - View all learned patterns
- **Auto-apply toggle** - Enable/disable per pattern
- **Pattern deletion** - "Forget" unwanted patterns
- **Statistics dashboard** - Track approval history

## Architecture

### Database Schema

```sql
CREATE TABLE ai_approval_patterns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    action_type TEXT NOT NULL,           -- e.g., 'CREATE_DRAFT_TASK'
    action_signature TEXT NOT NULL,       -- SHA256 hash of normalized payload
    payload_template TEXT,                -- JSON of normalized payload structure
    decision TEXT NOT NULL,               -- 'APPROVED' or 'REJECTED'
    decision_count INTEGER DEFAULT 1,     -- Number of consistent decisions
    last_decision_at DATETIME,
    auto_apply INTEGER DEFAULT 0,         -- User opted for automation
    confidence_threshold REAL DEFAULT 0.9,
    risk_level TEXT DEFAULT 'LOW',
    created_at DATETIME,
    updated_at DATETIME,
    UNIQUE(user_id, action_type, action_signature)
);
```

### Services

| Service | File | Purpose |
|---------|------|---------|
| ApprovalPatternService | `server/services/approvalPatternService.js` | Pattern generation, matching, confidence calculation |
| VoiceCommandParser | `server/services/voiceCommandParser.js` | Parse voice commands for approvals |
| AIActionExecutor | `server/services/aiActionExecutor.js` | Execute actions with pattern learning integration |
| AIContextBuilder | `server/services/aiContextBuilder.js` | Include pending approvals in AI context |

### Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| useVoiceApproval | `hooks/useVoiceApproval.ts` | Voice approval workflow hook |
| InlineApprovalButtons | `components/AIChat/InlineApprovalButtons.tsx` | Inline approve/reject buttons |
| PendingApprovalsNotice | `components/AIChat/InlineApprovalButtons.tsx` | Chat notification of pending actions |
| ApprovalPatternManager | `components/settings/ApprovalPatternManager.tsx` | Settings UI for pattern management |

## Voice Commands

### English Commands

| Command | Action |
|---------|--------|
| `approve` / `ok` / `yes` | Approve current action |
| `reject [reason]` | Reject with optional reason |
| `skip` / `next` / `later` | Skip to next action |
| `details` / `more` / `info` | Get action details |
| `always approve this` | Enable auto-approve for pattern |
| `always reject this` | Enable auto-reject for pattern |
| `list pending` | Show pending actions count |
| `help` | Show available commands |

### Polish Commands (Komendy Polskie)

| Komenda | Akcja |
|---------|-------|
| `akceptuj` / `tak` | Zatwierdź bieżącą akcję |
| `odrzuć [powód]` | Odrzuć z opcjonalnym powodem |
| `pomiń` / `później` | Przejdź do następnej akcji |
| `szczegóły` / `więcej` | Pokaż szczegóły akcji |
| `zawsze akceptuj takie` | Włącz auto-akceptację dla wzorca |
| `zawsze odrzucaj takie` | Włącz auto-odrzucenie dla wzorca |
| `pokaż oczekujące` | Pokaż liczbę oczekujących akcji |
| `pomoc` | Pokaż dostępne komendy |

## Confidence Calculation

The system calculates confidence based on:

1. **Historical Decisions** (base confidence):
   - 1 decision: 50%
   - 2 decisions: 75%
   - 3 decisions: 90%
   - 5+ decisions: 95%

2. **Payload Similarity** (Jaccard index):
   - Compare normalized payload structures
   - Higher similarity = higher confidence

3. **Recency Factor**:
   - Within 7 days: 100%
   - Within 30 days: 95%
   - Within 90 days: 85%
   - Older: 70%

### Auto-Decision Thresholds

| Confidence | Risk Level | Behavior |
|------------|------------|----------|
| ≥95% | LOW | Auto-approve/reject |
| ≥90% | LOW | Auto with notification |
| ≥90% | MEDIUM | Highlighted for quick review |
| Any | HIGH | Always manual review |

## API Endpoints

### Patterns

```
GET  /api/ai/patterns              - Get user's patterns
GET  /api/ai/patterns/stats        - Get pattern statistics
PATCH /api/ai/patterns/:id/auto-apply - Toggle auto-apply
DELETE /api/ai/patterns/:id        - Delete pattern
```

### Actions

```
GET  /api/ai/actions/pending       - Get pending actions with pattern info
POST /api/ai/actions/:id/approve   - Approve with optional alwaysApprove
POST /api/ai/actions/:id/reject    - Reject with reason and optional alwaysReject
```

## Usage Examples

### JavaScript - Approve with Learning

```javascript
// Approve and enable auto-apply for similar actions
const response = await api.post(`/ai/actions/${actionId}/approve`, {
    alwaysApprove: true
});

if (response.data.patternLearned) {
    console.log('Pattern learned! Similar actions will be auto-approved.');
}
```

### React - Voice Approval Hook

```typescript
import { useVoiceApproval } from '../hooks/useVoiceApproval';

function ApprovalWidget() {
    const {
        pendingActions,
        currentAction,
        voiceState,
        startListening,
        approveCurrentAction,
        rejectCurrentAction
    } = useVoiceApproval({
        language: 'pl',
        onApprovalCommand: (result) => {
            toast.success(result.message);
        }
    });

    return (
        <div>
            <p>Pending: {pendingActions.length}</p>
            {currentAction && (
                <button onClick={() => startListening()}>
                    🎤 Voice Approve
                </button>
            )}
        </div>
    );
}
```

### Voice Workflow Example

```
User: [clicks mic] "akceptuj"
AI: "Zatwierdzono. Wzorzec zapamiętany."

User: [clicks mic] "zawsze akceptuj takie"
AI: "Będę automatycznie akceptować podobne akcje w przyszłości."

User: [clicks mic] "ile mam do zatwierdzenia?"
AI: "Masz 3 akcji oczekujących."
```

## Testing

### Run Tests

```bash
node scripts/tests/test_approval_patterns.cjs
```

### Test Coverage

- Signature generation (same structure = same signature)
- Confidence calculation (more decisions = higher confidence)
- Voice command parsing (EN/PL commands)
- Auto-decision thresholds (HIGH risk never auto-decides)
- Voice response generation (bilingual)
- Payload normalization (volatile fields excluded)

## Auto-Repair

### Run Repair Script

```bash
node scripts/repair/repair_approval_patterns.cjs
```

### What It Fixes

- Creates missing database table
- Deletes orphaned patterns (user/org deleted)
- Cleans old unused patterns (>180 days, <3 decisions, not auto-apply)
- Fixes invalid decision/risk_level values
- Rebuilds corrupted indexes

## Security Considerations

1. **User Isolation** - Patterns are per-user, no cross-user learning
2. **Organization Scope** - Patterns tied to organization
3. **HIGH Risk Protection** - HIGH risk actions always require manual review
4. **Audit Trail** - All decisions logged in ai_audit_logs

## Best Practices

1. **Start Manual** - Let the system learn from your first few decisions
2. **Review Patterns** - Periodically check learned patterns in settings
3. **Use Auto-Apply Wisely** - Only for truly repetitive, low-risk actions
4. **Voice Commands** - Use "zawsze akceptuj takie" for frequently approved actions
5. **Delete When Needed** - Remove patterns that no longer apply

## Future Enhancements

- [ ] Cross-organization pattern sharing (opt-in)
- [ ] Time-based patterns (e.g., "approve budget requests only on Fridays")
- [ ] Team-level patterns
- [ ] ML-based pattern suggestions
- [ ] Batch approval by pattern type


