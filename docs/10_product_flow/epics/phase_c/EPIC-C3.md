# EPIC-C3: Conscious Intent Confirmation

| Field | Value |
|-------|-------|
| **Epic ID** | EPIC-C3 |
| **Phase** | C — Trial Entry |
| **User State** | `TRIAL_TRUSTED` |
| **Priority** | HIGH |

---

## Intent

Progression requires **explicit consent**.

---

## System Requirements

### MUST
- [ ] Require a **deliberate confirmation step**
- [ ] Make intent clear before transition

### MUST NOT
- [ ] Auto-transition users
- [ ] Infer consent from inaction

---

## Acceptance Criteria

| Criteria | Pass Condition |
|----------|----------------|
| **No auto-transition** possible | ✅ |
| User actively chooses to proceed | ✅ |

---

## Confirmation Flow

```
User Intent → Explicit Confirm → State Transition
                    ↓
              "I want to work on my organization"
```
