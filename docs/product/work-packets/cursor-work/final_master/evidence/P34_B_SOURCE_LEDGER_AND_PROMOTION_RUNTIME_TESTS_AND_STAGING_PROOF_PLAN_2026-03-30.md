# P34-B Evidence — Source ledger + promotion workflow (private→org) + no-leak security regressions
Date: 2026-03-30  
Packet: **P34-B**  
State: evidence-first plan (tests + staging proof script) — implement next

## Context pack (max 5, SSOT order)
1. Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
2. Contract (P34): `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_34_MADROSC_CZATA_2026-03-29.md` (see §8.1 P34-B)
3. P34 SSOTs: `docs/product/KNOWLEDGE_RAG_V8_SSOT.md` + `docs/product/KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
4. Knowledge base gateway routes: `server/src/routes/v8/knowledge-base.routes.ts`
5. Consumer surfaces (must not bypass gateway): Chat/Teresa/Anna (per contract §2.3.1)

---

## Automated tests (run locally)

### Existing baseline (keep green)

```bash
npx vitest run \
  server/src/routes/v8/__tests__/public-anna.routes.test.ts \
  tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts
```

### P34-B additions (to be implemented in this packet)

```bash
npx vitest run \
  tests/integration/routes/p34b-knowledge-policy-ledger-and-promotion.sqlite.integration.test.ts \
  tests/integration/security/p34b-no-private-leakage.sqlite.integration.test.ts
```

Expected (P34-B):
- **Source ledger** is returned for grounded answers:
  - `used_sources[]` enumerates only sources actually used.
  - `blocked_sources[]` is present when scoping blocks classes of sources, but does **not** enumerate private objects the caller shouldn’t know exist.
- **Honest degraded modes**:
  - “no sources found” → explicit marker + safe next steps (no fabricated citations).
  - “no access” → refusal UX (outcome + high-level reason + next action).
- **Promotion workflow**:
  - private → org requires submission + review + approval (no silent promotion).
  - provenance is preserved across promotion (who/when/why).
- **No bypass**:
  - consumers cannot retrieve outside the gateway (assert by contract boundaries / route usage).
- **Security regressions**:
  - no cross-user private leakage,
  - no cross-tenant leakage,
  - no secrets enumeration via “blocked source list”.

---

## Staging proof script (runtime checklist)

Environment prerequisites:
- Org with at least two users:
  - `User A` (member) with private items
  - `User B` (admin/owner) to approve promotion
- A minimal KB item that exists privately for `User A` and is not yet shared to org.

### A) Source ledger — private-only query

1. As `User A`, ask a question that matches only `User A` private knowledge.
2. Confirm:
   - answer is grounded,
   - `used_sources[]` references only `User A` private sources,
   - `blocked_sources[]` (if present) does not leak any identifiers of other users’ private items.

### B) Source ledger — org-only query (no private leakage)

1. Ask a question that matches only org-shared knowledge.
2. Confirm:
   - `used_sources[]` references org corpus,
   - no `User A` private source appears.

### C) Mixed query — explicit scope resolution (allowed vs blocked)

1. Ask a query that would match both private and org, plus some blocked class (e.g. other-user private).
2. Confirm:
   - system uses allowed scopes,
   - blocked scopes are indicated at a high level (category), without enumerating forbidden objects,
   - no overclaim if evidence is partial.

### D) Promotion workflow (private → org) — governed review

1. As `User A`, submit a private item for org promotion.
2. As `User B`, review and approve the promotion.
3. Confirm provenance fields reflect the approval (reviewer + timestamp).

### E) Post-promotion retrieval + ledger correctness

1. Re-run an org query that should now match the promoted item.
2. Confirm:
   - promoted content is retrievable from org scope,
   - `used_sources[]` shows the promoted item in org corpus,
   - provenance is present/auditable.

### F) Honest degraded path (no sources / no access)

1. Ask a query with **no sources** in allowed scope → confirm explicit “no sources” marker.
2. Ask a query that requires **blocked** scope → confirm refusal UX and safe alternatives.

Capture:
- short screen recording for A–F, plus at least one JSON snippet showing `used_sources[]` / `blocked_sources[]` shape.

---

## Rollback posture (P34-B scope)
- Disable org retrieval + promotion (feature flag / config) while keeping private-only retrieval safe.
- No destructive data operations; promoted items remain stored but can be excluded by policy.

---

## Known limits (explicit, for honesty)
- This packet proves v1 ledger + promotion + security regressions; evaluation harness / operator observability is P34-C.

