# Knowledge RAG v8 - Gap matrix

> Status: Draft v8
> Cel: Uporzadkowac luki miedzy obecnym pakietem `Knowledge RAG v8` a poziomem dojrzalych, bezpiecznych i operacyjnie gotowych systemow knowledge/RAG.

---

## 1. Jak czytac te matrix

Kazdy wiersz pokazuje:
- obszar knowledge/RAG,
- target state,
- obecny stan,
- glowna luka,
- priorytet.

Priorytety:
- `P0` - blocker dla bezpiecznego i kanonicznego wdrozenia
- `P1` - bardzo wazne dla enterprise-grade kompletnosci
- `P2` - wzmacnia excellence, operations i scale

---

## 2. Matrix

| Area | Target state | As-is | Gap | Priority |
|---|---|---|---|---|
| User vs org doctrine | Explicit, frozen, product-wide | Now documented | Good | Closed |
| No direct user-to-user retrieval | Explicit architectural rule | Now documented | Good | Closed |
| Tenant isolation | Structural across all stores and retrieval paths | Strong in doctrine, fragmented in runtime | Need one storage and retrieval enforcement path | P0 |
| Canonical document registry | One registry for retrievable source objects | `knowledge_docs` vs `knowledge_documents` split | Storage/governance mismatch | P0 |
| Canonical org memory model | One semantic org memory store | `ai_org_memory`, `ai_organization_memory`, `organization_memory` | Memory fragmentation | P0 |
| User-private corpus | First-class private knowledge corpus | User memory exists, private corpus not fully modeled | Under-modeled private knowledge layer | P0 |
| Promotion workflow | Explicit reviewed private -> shared path | Conceptually defined only | No canonical runtime/policy contract yet | P1 |
| ACL inheritance | Permissions flow from source to chunk and retrieval | Partial visibility concepts exist | Not deeply specified | P0 |
| Chunk/source provenance | Every chunk traces to source object and answer trace | Partial metadata exists | No full provenance ledger | P1 |
| Citation fidelity | Clickable/verifiable grounded answer contract | Partial in chat/research direction | No canonical RAG citation fidelity contract | P1 |
| Freshness metadata | Last indexed / last verified / stale policy | Barely defined | Missing temporal correctness layer | P1 |
| Incremental indexing | Re-index only changed content | Some hashes/version fields exist in places | No canonical strategy | P1 |
| Dedup and version lineage | Source identity and replacement semantics | Partial fields exist | Not defined as system rule | P1 |
| Connector governance | Connectors respect permissions, sync and drift rules | External/provider abstraction exists | No full connector governance package | P1 |
| Enterprise search contract | One enterprise retrieval gateway shared by chat, execution and workers | Consumer retrieval exists in fragments | Missing one unified enterprise search contract | P0 |
| Retrieval gateway | One policy-first gateway for all consumers | Retrieval controls exist in several places | Not unified | P0 |
| Consumer presets | Chat/agent/worker/deep-research scope contracts | Partly conceptually defined | Need explicit matrices and runtime presets | P1 |
| Private mode semantics for knowledge | Exact effect on private/shared/session retrieval | Partly defined in chat memory docs | Not fully translated into knowledge-layer contract | P1 |
| Data classification / redaction | DLP-aware ingest and embedding policy | Sensitivity exists conceptually | No ingest-time redaction/classification contract | P1 |
| Retention and deletion | Delete/archive cascades to chunks and embeddings | High-level mention only | Missing full lifecycle semantics | P1 |
| Retrieval evals | Offline and online evals per task type | Not documented in package | Missing quality gate system | P1 |
| Permission leakage tests | ACL safety benchmark suite | Not documented | Missing security eval layer | P0 |
| Operator observability | Traces, ingest state, blocked sources, drift alerts | Partial logs in runtime | No canonical ops package | P2 |
| Admin/curator tooling | Governance UI and review flows | Partial admin surfaces exist | No full product contract | P2 |

---

## 3. Most important unresolved gaps

### 3.1 Storage truth is still fragmented

Without fixing:
- `knowledge_docs` vs `knowledge_documents`
- `ai_org_memory` vs `ai_organization_memory` vs `organization_memory`

we do not really have one secure knowledge architecture.

### 3.2 Private corpus is weaker than shared corpus

Today private user memory is mostly:
- preferences,
- context,
- lightweight memory entries.

It is not yet a first-class private knowledge corpus with clear CRUD, indexing and promotion semantics.

### 3.3 Provenance is not complete enough

Without full provenance we cannot confidently answer:
- what exact source object influenced this answer,
- what exact chunk was retrieved,
- what promotion path moved this insight into shared knowledge.

### 3.4 Freshness and sync are still under-specified

Dojrzale systems think carefully about:
- changed content,
- stale corpora,
- re-index policy,
- temporal conflicts.

Our package still needs this.

### 3.5 Quality and safety evals are missing

Without evals we cannot verify:
- retrieval quality,
- citation faithfulness,
- permission safety,
- cross-scope leakage resistance.

### 3.6 Parity package improved ownership, but not full closure

The new parity package gives canonical homes to:

- enterprise search,
- output trust,
- identity and scope,
- memory lifecycle.

However, `Knowledge RAG v8` should still treat these as open until the RAG benchmark and parity documents agree on:

- exact retrieval gateway contract,
- exact connector lifecycle semantics,
- exact provenance and freshness metadata,
- exact safety eval expectations.

---

## 4. Recommended missing documentation themes

To make the package truly complete, the next missing canonical detail should cover:

### A. Retrieval and provenance operations spec

Should define:
- lineage metadata,
- citation rules,
- blocked/used source logs,
- retrieval trace contract.

### B. Ingestion and sync operations spec

Should define:
- connector sync,
- incremental indexing,
- dedup/version rules,
- stale-content and drift handling.

### C. Evaluation and observability pack

Should define:
- retrieval eval datasets,
- permission leakage tests,
- unsupported claim monitoring,
- operator dashboards and alerts.

### D. Cross-package RAG parity sync

Should define:
- which RAG benchmark gaps are now owned by parity docs,
- which remain in RAG package local ownership,
- how status is updated across both packages without divergence.

These can be separate docs or explicit sections added in later waves.

---

## 5. Strategic conclusion

The current package is strong enough to freeze the architecture direction.

It is not yet fully complete relative to mature enterprise RAG systems because we still lack detailed treatment of:
- provenance,
- freshness,
- connector lifecycle,
- evals,
- and operator tooling.

So the right conclusion is:

`we have the right core model, but we still need one more hardening pass for production-grade completeness`

Related docs:
- `KNOWLEDGE_RAG_V8_BENCHMARK.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `KNOWLEDGE_RAG_V8_AS_IS.md`
- `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
