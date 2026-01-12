# USER STATE MACHINE
## Formal Definition of User Mental & System States

This document defines the ONLY valid user states in the system.
States are mutually exclusive.
Transitions are explicit.
No implicit upgrades are allowed.

---

## STATE LIST

- ANON
- DEMO_SESSION
- TRIAL_TRUSTED
- ORG_CREATOR
- ORG_MEMBER
- TEAM_COLLAB
- ECOSYSTEM_NODE

---

## STATE: ANON

Description:
Public, anonymous visitor.

System permissions:
- view public narrative
- see category framing
- no interaction

System restrictions:
- no data input
- no AI interaction
- no personalization

Allowed transition:
ANON → DEMO_SESSION

---

## STATE: DEMO_SESSION

Description:
Logged-in user, exploring the system in session mode.

Entry conditions:
- OAuth or email login
- no organization
- no stored data

System permissions:
- read-only access
- reference data only
- temporary session context

AI mode:
- narrator
- explainer
- guide

Restrictions:
- no real data
- no persistence
- no decision ownership

Allowed transitions:
DEMO_SESSION → TRIAL_TRUSTED
DEMO_SESSION → ANON (logout)

---

## STATE: TRIAL_TRUSTED

Description:
User has consciously requested access to act.

Entry conditions:
- invitation code OR
- referral OR
- consultant invite OR
- team invite

System permissions:
- limited actions
- no organization yet
- trial constraints active

AI mode:
- cautious guide
- method validator

Restrictions:
- no full system access
- no team features
- no benchmarks

Allowed transitions:
TRIAL_TRUSTED → ORG_CREATOR

---

## STATE: ORG_CREATOR

Description:
User creates a decision-making space.

Entry conditions:
- explicit decision to create organization

System permissions:
- create organization
- define role and context

AI mode:
- context builder
- structure setter

Restrictions:
- no delegation yet
- no benchmarking

Allowed transitions:
ORG_CREATOR → ORG_MEMBER

---

## STATE: ORG_MEMBER

Description:
User operates inside an organization.

System permissions:
- work on DRD
- store data
- persistent memory active

AI mode:
- thinking partner
- analytical guide

Allowed transitions:
ORG_MEMBER → TEAM_COLLAB

---

## STATE: TEAM_COLLAB

Description:
Multiple perspectives actively involved.

System permissions:
- invite users
- comment
- discuss
- co-create axes

AI mode:
- facilitator
- synthesis agent

Allowed transitions:
TEAM_COLLAB → ECOSYSTEM_NODE

---

## STATE: ECOSYSTEM_NODE

Description:
Organization participates in ecosystem-level intelligence.

System permissions:
- benchmarks
- referrals
- consultant mode
- AI reviews

AI mode:
- meta-analyst
- pattern recognizer

---

## GLOBAL RULE

If a feature cannot be assigned to exactly one state,
it must not exist.
