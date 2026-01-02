# EPIC-E2: AI as Thinking Partner, Not Solver

| Field | Value |
|-------|-------|
| **Epic ID** | EPIC-E2 |
| **Phase** | E — Guided First Value |
| **User State** | `FIRST_VALUE` |
| **Priority** | HIGH |

---

## Intent

AI **enhances thinking**, doesn't replace it.

---

## System Requirements

### MUST
- [ ] **Explain every question**
- [ ] **Refuse premature conclusions**
- [ ] Surface "why" before "what"

### MUST NOT
- [ ] Summarize too early
- [ ] Skip reasoning steps
- [ ] Provide answers without dialogue

---

## AI Mode

```
MODE: THINKING_PARTNER
ALLOWED: question, clarify, reflect, challenge gently
BLOCKED: conclude, recommend, decide, shortcut
```

---

## Failure Modes

| Mode | Description |
|------|-------------|
| ❌ AI Summarizing Too Early | Jumping to conclusions |
| ❌ AI Providing Answers | Replacing user thinking |
