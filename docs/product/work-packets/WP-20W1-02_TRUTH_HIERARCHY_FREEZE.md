# WP-20W1-02 — Truth Hierarchy Freeze

> Status: Complete
> Wave: 20W-1 (Registry, decision and packet convergence)
> Type: Manager-owned governance packet
> Date: 2026-03-23

---

## 1. Objective

Freeze the canonical truth hierarchy for the 20-wave program. Define which documents govern what, in what order of precedence, and how conflicts are resolved.

---

## 2. Frozen truth hierarchy

The following hierarchy is binding for all 20 waves. Higher-numbered tiers override lower-numbered tiers only within their scope.

### Tier 0 — Program authority

| Document | Role |
|----------|------|
| `V8_FINAL_20_WAVE_IMPLEMENTATION_CLOSURE_PROGRAM.md` | **Primary operational authority** — defines wave scope, sequence, closure criteria |
| `V8_IMPLEMENTATION_MASTER_PROGRAM.md` | **Foundational context** — defines truth hierarchy, operating model, anti-fragmentation rules |
| `AGENT_PROGRAM_OPERATING_MODEL_V8.md` | **Operating model** — defines manager/worker roles, packet sizing, escalation rules |

Conflict rule: If `V8_FINAL_20_WAVE_IMPLEMENTATION_CLOSURE_PROGRAM.md` and `V8_IMPLEMENTATION_MASTER_PROGRAM.md` disagree on wave scope or sequence, the 20-wave program governs.

### Tier 1 — Module SSOTs

| Pattern | Role |
|---------|------|
| `*_V8_SSOT.md` | Module-level source of truth — defines what the module IS |
| `*_V8_BENCHMARK.md` | Module-level benchmark — defines what the module SHOULD BE |
| `*_V8_READINESS_AUDIT.md` | Module-level audit — defines what is MISSING |

Conflict rule: SSOTs define product truth. The 20-wave program defines implementation sequence. Neither overrides the other — they govern different dimensions.

### Tier 2 — Domain runtime and implementation docs

| Pattern | Role |
|---------|------|
| `*_RUNTIME_V8.md` | Domain-specific runtime definitions |
| `*_IMPLEMENTATION_*.md` | Implementation plans and backlogs |
| `*_CLOSURE_PROGRAM_V8.md` | Domain-specific closure programs |

Conflict rule: Runtime docs define HOW a domain works. If a runtime doc contradicts an SSOT, the SSOT governs product truth; the runtime doc governs implementation approach.

### Tier 3 — Program control and decisions

| Document | Role |
|----------|------|
| `DECISION_LOG_PROGRAM_CONTROL.md` | Program-level decisions (PC-1 through PC-5+) |
| `DECISION_LOG_WAVE_*.md` | Wave-specific decisions (from prior 7-wave cycle) |
| `IMPLEMENTATION_CONTROL_BOARD.md` | Implementation progress tracking |

Conflict rule: Decisions in `DECISION_LOG_PROGRAM_CONTROL.md` override wave-level decisions if they conflict. All prior wave decisions (94 total) remain valid unless explicitly superseded by a PC-level decision.

### Tier 4 — Work packets

| Pattern | Role |
|---------|------|
| `WP-20WX-NN_*.md` | 20-wave work packets (new) |
| `WP-WX-*-NN_*.md` | Prior 7-wave work packets (foundational reference) |

Conflict rule: 20-wave packets govern forward work. Prior packets are reference material — they do not block or override new packets.

### Tier 5 — Build-phase deliverables

| Document | Role |
|----------|------|
| `V8_INTEGRATION_TEST_PROGRAM.md` | Integration test strategy |
| `V8_DEPLOYMENT_READINESS_PLAN.md` | Deployment strategy |
| `V8_UI_WIRING_QUEUE.md` | UI wiring prioritization |

Conflict rule: These remain valid operational references. They may need updating as the 20-wave program progresses, but updates require explicit manager approval.

---

## 3. Registry reference

The full document registry is maintained in `docs/product/DOCUMENTATION_REGISTRY.md`. This truth hierarchy freeze does not replace the registry — it defines the **precedence rules** that the registry does not.

---

## 4. Frozen rules

1. **No new canonical document may be created without manager approval** during the 20-wave program.
2. **No existing SSOT may be modified by a worker agent** — only by source-of-truth chat or manager with explicit escalation.
3. **All work packets must reference their governing SSOT** in the context pack section.
4. **Decision logs are append-only** — no retroactive modification of prior decisions.
5. **The 20-wave sequence is binding** — waves may not be reordered without source-of-truth chat approval.
6. **Wave 1 must close before any Wave 2+ implementation begins** — this is the governance gate.

---

## 5. Validity

This truth hierarchy freeze is effective immediately and remains in force for the duration of the 20-wave program. It may only be amended by a `PC-*` decision in `DECISION_LOG_PROGRAM_CONTROL.md`.

Ratified by: Decision PC-5 (2026-03-23).
