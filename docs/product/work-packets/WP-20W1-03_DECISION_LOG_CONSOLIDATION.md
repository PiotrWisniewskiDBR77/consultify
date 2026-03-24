# WP-20W1-03 — Decision Log Consolidation

> Status: Complete
> Wave: 20W-1 (Registry, decision and packet convergence)
> Type: Manager-owned governance packet
> Date: 2026-03-23

---

## 1. Objective

Validate all 94 wave-level decisions + 5 program-control decisions against the 20-wave program. Confirm which remain valid, which need amendment, and which are superseded.

---

## 2. Decision inventory

| Source | Count | ID range |
|--------|------:|----------|
| Wave 1 decisions | 26 | D1–D26 |
| Wave 2 decisions | 12 | W2-1–W2-12 |
| Wave 3 decisions | 11 | W3-1–W3-11 |
| Wave 4 decisions | 10 | W4-1–W4-10 |
| Wave 5 decisions | 11 | W5-1–W5-11 |
| Wave 6 decisions | 13 | W6-1–W6-13 |
| Wave 7 decisions | 11 | W7-1–W7-11 |
| Program control | 5 | PC-1–PC-5 |
| **Total** | **99** | |

---

## 3. Validity assessment

### 3.1 Program control decisions

| ID | Summary | Status under 20-wave |
|----|---------|---------------------|
| PC-1 | Wave 8 (Mobile, Edukacja) frozen | **VALID** — 20-wave program §9 confirms these are deferred |
| PC-2 | First 3 code targets (ContextSnapshot → ExecutionSpine → CollaborationRoom) | **VALID as historical** — sequence was executed; no forward constraint |
| PC-3 | Hybrid implementation mode (manager specs + worker primitives) | **VALID** — operating model unchanged |
| PC-4 | Build phase conditional approval (integration → deployment → UI wiring) | **VALID** — integration gate passed; deployment and UI wiring remain gated |
| PC-5 | 20-wave program is primary operational authority | **VALID** — current governing decision |

### 3.2 Wave 1 decisions (D1–D26) → Maps to 20-wave Waves 2-8

All 26 Wave 1 decisions concern AI core, multiplayer, PM sync, and tool governance architecture. These map directly to 20-wave Waves 2-8.

**Assessment**: All **VALID**. These are foundational architecture decisions that the 20-wave program builds upon, not contradicts.

Key decisions by 20-wave mapping:
- D1-D4, D10-D12 → Wave 2 (context/identity) + Wave 3 (retrieval)
- D5-D6, D16-D17 → Wave 7 (multiplayer) + Wave 8 (version/replay)
- D7-D9, D18 → Wave 12 (PM sync)
- D13-D15, D19-D22 → Wave 4 (execution) + Wave 5 (tool governance)
- D23-D26 → Wave 6 (trust/provenance)

### 3.3 Wave 2 decisions (W2-1–W2-12) → Maps to 20-wave Wave 9

All 12 Wave 2 decisions concern Chat↔execution integration, knowledge retrieval, and Prompt OS runtime.

**Assessment**: All **VALID**. Direct foundation for 20-wave Wave 9 (Chat, Prompt OS, Knowledge integration proof).

Notable:
- W2-2 (ChatActionProposal alignment) — deferred full merge to W3 (old numbering) = still open, maps to 20-wave Wave 4 or 9
- W2-7 (budget_hint advisory) — deferred detail, remains advisory
- W2-11 (canary % deferred) — still deferred, maps to 20-wave Wave 9

### 3.4 Wave 3 decisions (W3-1–W3-11) → Maps to 20-wave Waves 10-11

All 11 Wave 3 decisions concern source truth, planning continuity, WBS, and execution visibility.

**Assessment**: All **VALID**. Direct foundation for 20-wave Waves 10 (source truth) and 11 (planning/execution visibility).

Notable:
- W3-5 (material change thresholds TBD) — still TBD, must be resolved in 20-wave Wave 11
- W3-9 (Results handoff events) — maps to 20-wave Wave 17

### 3.5 Wave 4 decisions (W4-1–W4-10) → Maps to 20-wave Waves 13-16

All 10 Wave 4 decisions concern workspace collaboration tools (Whiteboard, Table, Notebook, Idea).

**Assessment**: All **VALID**. Direct foundation for 20-wave Waves 13-16 (workspace collaboration).

Notable:
- W4-3 (Notebook operational versioning, not full publishing) — still valid scope boundary
- W4-4 (block-locking first, CRDT later) — still valid implementation approach
- W4-8 (CRDT vs OT deferred) — still deferred

### 3.6 Wave 5 decisions (W5-1–W5-11) → Maps to 20-wave Wave 12

All 11 Wave 5 decisions concern PM sync auth, replay/dead-letter, operator surfaces.

**Assessment**: All **VALID**. Direct foundation for 20-wave Wave 12 (PM sync + operator recovery).

### 3.7 Wave 6 decisions (W6-1–W6-13) → Maps to 20-wave Waves 17-19

All 13 Wave 6 decisions concern outputs (reports/presentations), results/ROI, and finance integration.

**Assessment**: All **VALID**. Direct foundation for 20-wave Waves 17 (results), 18 (finance), and 19 (reports/presentations).

### 3.8 Wave 7 decisions (W7-1–W7-11) → Maps to 20-wave Wave 20

All 11 Wave 7 decisions concern MyWork roof, Tools, Landing, Org/Admin, Superadmin.

**Assessment**: All **VALID**. Direct foundation for 20-wave Wave 20 (roof closure).

Notable:
- W7-9 (ANNA LP contract) — deferred canonical doc creation, still pending
- W7-10 (SUPERADMIN_V8_SSOT.md) — deferred, still pending

---

## 4. Consolidated status

| Category | Total | Valid | Superseded | Needs amendment |
|----------|------:|------:|-----------:|----------------:|
| Program control | 5 | 5 | 0 | 0 |
| Wave 1 (AI/MP/PM/Trust) | 26 | 26 | 0 | 0 |
| Wave 2 (Chat/Knowledge/Prompt) | 12 | 12 | 0 | 0 |
| Wave 3 (Source/Planning/Exec) | 11 | 11 | 0 | 0 |
| Wave 4 (Workspace collab) | 10 | 10 | 0 | 0 |
| Wave 5 (PM sync/Operator) | 11 | 11 | 0 | 0 |
| Wave 6 (Outputs/Results/Finance) | 13 | 13 | 0 | 0 |
| Wave 7 (Roof/Tools/Landing) | 11 | 11 | 0 | 0 |
| **Total** | **99** | **99** | **0** | **0** |

---

## 5. Open items carried forward

These decisions explicitly deferred detail that must be resolved in specific 20-wave waves:

| Original decision | Deferred item | Resolve in 20-wave |
|-------------------|---------------|---------------------|
| W2-2 | ChatActionProposal ↔ ActionProposal full merge | Wave 4 or 9 |
| W2-7 | `budget_hint` protocol detail | Wave 9 |
| W2-11 | Canary % and targeting detail | Wave 9 |
| W3-5 | Material change thresholds (numeric) | Wave 11 |
| W4-3 | Notebook full publishing suite | Wave 16 |
| W4-8 | CRDT vs OT choice | Wave 13-16 (when revisited) |
| W5-3 | Degraded ladder per-connector tuning | Wave 12 |
| W6-4 | Recurring presentations detail | Wave 19 |
| W6-9 | Unreconciled delta thresholds (numeric) | Wave 17 or 18 |
| W7-9 | ANNA LP contract canonical doc | Wave 20 |
| W7-10 | SUPERADMIN_V8_SSOT.md delivery | Wave 20 |

---

## 6. Conclusion

All 99 decisions remain valid under the 20-wave program. No decision conflicts with the new wave structure. The 20-wave program builds on top of these decisions — it does not contradict them.

11 deferred items are tracked and assigned to specific 20-wave waves for resolution.
