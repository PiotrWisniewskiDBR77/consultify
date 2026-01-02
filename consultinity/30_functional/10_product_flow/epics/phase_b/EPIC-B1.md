# EPIC-B1: Full System Visibility Without Consequence

| Field | Value |
|-------|-------|
| **Epic ID** | EPIC-B1 |
| **Phase** | B — Demo Session |
| **User State** | `DEMO_SESSION` |
| **Priority** | CRITICAL |

---

## Intent

This epic exists to prove **transparency and structural completeness** without asking for trust yet.

---

## User Context

User wants to see **"what's really there"** without commitment.

---

## System Requirements

### MUST
- [ ] Expose **full system structure**
- [ ] Clearly label all data as **reference/demo**
- [ ] Block any **write or save actions**

### MUST NOT
- [ ] Allow personalization
- [ ] Allow progression by accident

---

## AI Behavior

> **AI = Narrator only.**

AI explains, observes, but does not interact or collect input.

---

## Acceptance Criteria

| Criteria | Pass Condition |
|----------|----------------|
| User can explore **indefinitely** without creating state | ✅ |
| **No persistent objects** exist after logout | ✅ |

---

## Failure Modes

| Mode | Description |
|------|-------------|
| ❌ Accidental Data Creation | Any persistent state |
| ❌ Implicit Onboarding | Progression without consent |
