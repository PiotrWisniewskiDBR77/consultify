# Acceptance ledgers — W1 first pass

Generated 2026-08-09 from two verified background-workflow extraction passes
(see `../15_FULL_EXECUTION_LAUNCH_MANIFEST_2026-08-09.md` sections 11/11.1 for
the process, including an integrity incident on the first pass and its fix).

All ledgers here are a **first-pass EPIC E0 draft**, not the final W1
deliverable required by document 14 section 6: rows carry `status =
NOT_IMPLEMENTED` throughout (correct for a program that has not built
anything yet), `implementation_path`/`test_ref`/`evidence_ref` are
intentionally blank, and per-row epic tagging is coarse where the source
document itself was not itemized by epic.

| File | Rows | Source |
| --- | --- | --- |
| `FUNCTIONAL_REQUIREMENT_COVERAGE.csv` | 833 | all 8 requirement-extraction clusters |
| `EPIC_DOD_COVERAGE.csv` | 110 | document 13 §2 (16 invariants) + document 14 §5 (DoD-A..L) |
| `API_EVENT_SCHEMA_COVERAGE.csv` | 57 | category = api / event |
| `SECURITY_RESILIENCE_MATRIX.csv` | 92 | category = security |
| `VISUAL_TRIADA_SPEC_A_LEDGER.csv` | 235 | category = ui |
| `RESPONSIVE_ACCESSIBILITY_LEDGER.csv` | 32 | document 03 only |
| `CUSTOMER_JOURNEY_LEDGER.csv` | 37 | document 02 only |
| `LEGACY_MIGRATION_PARITY.csv` | 30 | document 07 only |
| `GOLDEN_CASE_EVIDENCE_LEDGER.csv` | 76 | category = golden_case |
| `CODEBASE_CONVERGENCE_MAP.csv` | 49 | 5 codebase-mapping clusters (KEEP/EXTEND/ADAPT/DEPRECATE/CREATE) |
| `CARTESIAN_UX_COVERAGE.csv` | 0 (header only) | **not generated** — needs genuine cartesian design (state × journey × viewport × theme × input × autonomy × permission), not a filter of the extraction. Explicitly left empty rather than filled with placeholder rows. |
| `PACKET_REGISTRY.md` | 15 packets | epic -> packet mapping, reuse basis, dependencies |
| `DEPENDENCY_GRAPH.md` | — | epic sequencing, Mermaid |
| `FINAL_CANDIDATE_MANIFEST.md` | — | **not started** — end-of-program artifact, not a W1 deliverable |

## Known limitations of this pass

- Requirement rows are extracted per-document-cluster by independent
  subagents; near-duplicate rows across clusters (the same rule stated in
  two documents) have not been deduplicated yet.
- `epics` tagging was inferred by each extracting agent from context, not
  cross-validated against document 14 §4's epic map row by row — treat as a
  strong first pass, not ground truth, until a review pass confirms it.
- Category routing into the per-concern ledgers (API_EVENT, SECURITY, UI,
  GOLDEN_CASE) is a straight filter on the `category` field the same
  extracting agent assigned — same caveat.
- `CODEBASE_CONVERGENCE_MAP.csv` findings are unverified by a second reader;
  file paths look internally consistent (real migration numbers, real
  service-file naming conventions matching the rest of this codebase) but
  have not been independently re-confirmed the way the first pass's bad
  cluster was caught. Spot-checking a sample before relying on any single
  `KEEP` claim is recommended before a packet starts.
