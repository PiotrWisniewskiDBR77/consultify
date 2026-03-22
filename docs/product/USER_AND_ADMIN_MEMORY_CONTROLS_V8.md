# User And Admin Memory Controls v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac widoczne kontrole usera i admina dla pamieci w `Chat`, `Teresa` i agent flows, tak aby memory semantics nie pozostaly tylko architektura, ale staly sie realnym kontraktem produktu.

---

## 1. Why this document exists

`Memory lifecycle`, `tenant bootstrap` i `chat memory` sa juz opisane architektonicznie.

Brakuje jednak jednej rzeczy:

- jakie kontrole widzi user,
- jakie kontrole widzi admin,
- co da sie wlaczyc, ograniczyc, zablokowac lub usunac,
- jak Teresa i agent work maja respektowac te ustawienia.

Bez tego memory pozostaje zbyt niewidzialne.

---

## 2. Inherited truth

This document inherits:

- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md`
- `AI_TENANT_MEMORY_BOOTSTRAP_AND_ASSIGNMENT_V8.md`
- `TERESA_ASSISTANT_CONTRACT_V8.md`
- `CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`

Rule:

`memory rules are not complete until user and admin can understand and control them`

---

## 3. Control surfaces

There must be three control surfaces:

1. `user memory controls`
2. `tenant admin memory controls`
3. `operator visibility controls`

These are different concerns and must not be merged into one ambiguous settings area.

---

## 4. User memory controls

Users should be able to understand and control:

- whether personalization is active
- whether current session may affect future personalization
- whether private mode is active
- what personal durable memory exists
- how to edit or remove key remembered facts

User-facing controls should include:

- `private_mode`
- `personal_memory_on_or_off`
- `review_my_memory`
- `delete_memory_item`
- `forget_recent_session_effect`

---

## 5. Teresa-specific user controls

In Teresa-guided work, the user should additionally understand:

- whether Teresa is using only current context or also durable memory
- whether the current session is voice or text only
- whether remembered context may shape future help

Important:

- voice mode must not imply stronger memory rights
- user should be able to reduce or isolate memory effect for guided work

---

## 6. Tenant admin controls

Tenant admin should be able to control:

- whether user personalization is allowed
- whether org memory is enabled
- whether Teresa may read org memory by default
- whether durable memory writes require stronger policy
- retention defaults for chat and guided assistant flows

Admin-facing controls should include:

- `allow_user_personalization`
- `allow_org_memory`
- `assistant_org_memory_access_policy`
- `durable_memory_write_policy`
- `retention_policy_ref`

---

## 7. Operator visibility

Operators and support may need to see:

- whether a memory policy blocked behavior
- whether context was session-only or durable
- whether stale or restricted memory was excluded

They should not automatically see:

- raw private durable memory content without policy allowance
- private mode content beyond documented support rules

Rule:

`support visibility should explain memory behavior, not bypass memory privacy`

---

## 8. Canonical control objects

## 8.1 `UserMemoryPreference`

Fields:

- `user_ref`
- `personalization_enabled`
- `private_mode_default`
- `allow_session_promotion`
- `last_updated_at`

## 8.2 `TenantMemoryControlPolicy`

Fields:

- `tenant_ref`
- `user_memory_policy`
- `org_memory_policy`
- `assistant_access_policy`
- `retention_policy_ref`
- `review_required_for_promotion`

## 8.3 `MemoryAccessExplanation`

Fields:

- `assistant_ref`
- `session_ref`
- `used_memory_layers[]`
- `blocked_memory_layers[]`
- `explanation_summary`

---

## 9. Delete and forget behavior

The product must distinguish:

- deleting durable memory item
- clearing session memory
- disabling future learning or promotion
- removing derived or promoted summaries where policy requires cascade

Deleting one thing must not silently leave derived memory artifacts active if policy says they should cascade.

---

## 10. UI promises

Users should never need to guess:

- whether Teresa remembers this later
- whether private mode affects current behavior
- whether org memory is shaping the answer
- whether disabling memory means no future promotion or no current context

The UI must explain at least the baseline truth, even if deeper admin details live elsewhere.

---

## 11. Risks and anti-patterns

- private mode over-promises zero memory without proof
- Teresa uses durable memory without visible explanation
- users cannot delete or inspect remembered material
- admins can enable org memory but not understand assistant impact
- support explains behavior using hidden memory semantics users cannot inspect

---

## 12. Acceptance criteria

- user and admin memory controls are explicit product surfaces
- Teresa behavior can be explained in terms of visible memory policy
- delete, forget and disable semantics are distinct
- private, session and org memory no longer rely only on architecture docs
