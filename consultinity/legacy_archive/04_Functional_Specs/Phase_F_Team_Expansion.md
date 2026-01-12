# Phase F – Team Expansion (Inside Growth) Functional Specification

---

## 1. Purpose of Phase F

Phase F is **growth from decision need**, not from marketing. The system itself signals when a decision requires more perspectives, triggering organic team expansion.

**What Phase F is:**
- Decision-triggered team invitations
- AI-facilitated multi-perspective collaboration
- Natural growth through genuine need

**What Phase F is not:**
- A marketing-driven user acquisition funnel
- Forced team requirements
- Social pressure to invite

---

## 2. Entry Conditions

| Trigger | Source | Context |
|---------|--------|---------|
| AHA moment detected | Phase E complete | User ready to act |
| Complex decision identified | AI analysis | Decision needs perspectives |
| User attempts action requiring approval | RBAC check | Governance signal |

---

## 3. AI-Triggered Expansion Signals

The AI detects when decisions would benefit from additional perspectives:

### Signal Detection Logic

| Signal | Detection Method | AI Response |
|--------|-----------------|-------------|
| **High-impact decision** | AI analyzes initiative scope | *"This initiative affects multiple departments. Consider inviting stakeholders for broader input."* |
| **Conflicting priorities** | Multiple objectives detected | *"I notice potential trade-offs here. A second perspective might help clarify priorities."* |
| **Resource allocation** | Budget/FTE decisions | *"Resource decisions often benefit from finance and HR perspectives."* |
| **Cultural change** | Change management signals | *"Cultural initiatives succeed with diverse voices. Who else should weigh in?"* |

### Signal Timing

- Signals appear **after** Phase E is complete
- Maximum 1 signal per session (anti-spam)
- User can dismiss signals permanently for a decision

---

## 4. Invitation Flow

### Step-by-Step

| Step | Action | AI Behavior |
|------|--------|-------------|
| 1 | AI suggests team expansion | Non-pushy recommendation |
| 2 | User clicks "Invite Team" | Opens invitation modal |
| 3 | User enters 1-3 email addresses | System validates format |
| 4 | Invitations sent | Email with context preview |
| 5 | Invitee accepts | Joins organization with MEMBER role |

### Invitation Constraints

- **Recommended invites**: 2-3 people
- **Maximum invites** (Trial): 3 total
- **Maximum invites** (Paid): Unlimited
- **Role assigned**: MEMBER (can be promoted later)

---

## 5. Multi-Perspective Collaboration

### What Invitees See

New members receive:
1. Organization context summary (AI-generated)
2. Current initiatives overview
3. Specific decision they were invited to contribute to

### AI Facilitation

AI helps integrate new perspectives:
> *"[New Member] has joined. They're reviewing the [Initiative] decision. I'll help synthesize their input with existing perspectives."*

### Difference Surfacing

When perspectives differ, AI highlights constructively:
> *"I notice [Member A] prioritizes speed while [Member B] emphasizes risk mitigation. Both are valid — here's how they might be reconciled..."*

---

## 6. AI Behavior Summary

| Role | Behavior |
|------|----------|
| **Signal Generator** | Detects decisions needing perspectives |
| **Invitation Facilitator** | Guides invitation process |
| **Perspective Synthesizer** | Integrates multiple viewpoints |
| **Conflict Navigator** | Surfaces differences constructively |

### What AI Does NOT Do
- Pressure users to invite
- Spam with invitation reminders
- Favor one perspective over another
- Make decisions for the group

---

## 7. Success Metrics (Internal)

| Metric | Target | Purpose |
|--------|--------|---------|
| Invitation acceptance rate | > 70% | Quality of invitations |
| Active contributors | 2+ per org | Team adoption |
| Decision quality (AI-assessed) | N/A | Long-term value tracking |
| Time to first team activity | < 48h | Engagement speed |

---

## 8. Exit Conditions (Phase F Active)

Phase F is an ongoing state, not a one-time event. The system "lives" when:
- [x] At least 2 active members in organization
- [x] Collaborative activity detected (comments, votes, edits)
- [x] AI is facilitating multi-perspective discussions

---

## 9. Phase Boundaries

- **Hand-off from Phase E**: Conversion nudge offers team invitation
- **Parallel with Phase E**: Some users may invite before onboarding complete
- **Hand-off to Phase G**: Organic growth signals trigger ecosystem participation

---

## 10. Acceptance Criteria

- [ ] AI signals are non-intrusive (dismissible, max 1/session)
- [ ] Invitations include decision context
- [ ] New members see organization summary
- [ ] AI synthesizes differing perspectives
- [ ] Trial limits enforced (max 3 invites)

---

*Prepared by Antigravity – 2025-12-21*
