# EPIC-B2: AI as Method Explainer, Not Assistant

| Field | Value |
|-------|-------|
| **Epic ID** | EPIC-B2 |
| **Phase** | B — Demo Session |
| **User State** | `DEMO_SESSION` |
| **Priority** | HIGH |

---

## Intent

AI must demonstrate **discipline**, not intelligence.

---

## System Requirements

### MUST
- [ ] Force AI into **explanation-only mode**
- [ ] Prevent AI from **asking questions**

### MUST NOT
- [ ] Personalize explanations
- [ ] Suggest actions

---

## Acceptance Criteria

| Criteria | Pass Condition |
|----------|----------------|
| AI **never requests input** | ✅ |
| AI **explains limits explicitly** | ✅ |

---

## AI Mode

```
MODE: NARRATOR
ALLOWED: explain, describe, clarify
BLOCKED: ask, suggest, personalize, act
```
