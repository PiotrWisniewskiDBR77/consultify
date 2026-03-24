# Knowledge RAG v8 - Benchmark

> Status: Draft v8
> Cel: Sprawdzic, jakie obszary dojrzale systemy knowledge/RAG maja zwykle przemyslane, a ktore z nich sa juz pokryte w `consultify`, a ktore nadal sa lukami.

---

## 1. Po co istnieje ten dokument

`KNOWLEDGE_RAG_V8_SSOT.md` definiuje nasz target model.

Ten dokument odpowiada na inne pytanie:

`czy nasze RAG docs obejmuja wszystkie istotne warstwy, ktore dojrzale systemy zwykle maja juz przemyslane?`

Benchmark nie kopiuje jednego produktu.
Patrzy na wspolne cechy mature enterprise-grade RAG systems.

---

## 2. Benchmark categories

Do porownania przyjmujemy osiem kategorii:

1. ownership and tenancy
2. authorization and source governance
3. ingestion and indexing lifecycle
4. provenance and citations
5. freshness and temporal correctness
6. retrieval quality and evals
7. observability and operator tooling
8. lifecycle, retention and deletion

---

## 3. What strong systems usually define

### 3.1 Ownership and tenancy

Mature systems usually define:
- strict tenant identity on every source object,
- explicit split between private user knowledge and shared team/org knowledge,
- safe promotion path from private to shared,
- clear rule for global/system corpora.

### 3.2 Authorization and source governance

Mature systems usually define:
- ACL inheritance from source system to retrieved chunks,
- document-level and chunk-level permissions,
- sensitivity/classification labels,
- approval or deny states before retrieval,
- connector-aware permissions.

### 3.3 Ingestion and indexing lifecycle

Mature systems usually define:
- connector contracts,
- incremental indexing,
- deduplication,
- versioning and hashes,
- failure handling and reprocessing,
- separation of offline ingest from online retrieval.

### 3.4 Provenance and citations

Mature systems usually define:
- source lineage from original object to chunk,
- chunk metadata preserving page/section/location,
- answer citations linked to exact evidence,
- audit trace from answer back to retrieved context.

### 3.5 Freshness and temporal correctness

Mature systems usually define:
- freshness metadata,
- last indexed / last verified timestamps,
- stale knowledge handling,
- temporal filters when newer data should dominate older data,
- drift awareness for synced sources.

### 3.6 Retrieval quality and evals

Mature systems usually define:
- offline retrieval evals,
- permission-safety tests,
- citation correctness checks,
- unsupported-claim monitoring,
- benchmark sets by task type.

### 3.7 Observability and operator tooling

Mature systems usually define:
- ingest pipeline logs,
- retrieval traces,
- which sources were used/blocked,
- latency/cost/quality per step,
- admin/operator views for failures and drift.

### 3.8 Lifecycle, retention and deletion

Mature systems usually define:
- retention owners,
- archive and delete semantics,
- embedding deletion on source delete,
- legal/compliance constraints,
- export and data-subject handling where relevant.

---

## 4. Benchmark comparison matrix

| Area | Mature systems usually have | Our current package | Status |
|---|---|---|---|
| User vs org separation | Yes | Yes, strongly defined | Strong |
| Tenant isolation doctrine | Yes | Yes, strongly defined | Strong |
| No direct user-to-user retrieval | Often explicit in better systems | Yes | Strong |
| Promotion private -> shared | Yes | Yes, conceptually defined | Strong |
| Unified storage truth | Yes | Not yet fully defined in runtime, only called out as issue | Gap |
| ACL inheritance and pre-filtered auth | Yes | Partly defined, not yet deeply specified | Gap |
| Connector governance | Yes | Mentioned only at high level | Gap |
| Incremental indexing and dedup | Yes | Not yet specified as canonical requirement | Gap |
| Versioning and freshness | Yes | Barely covered | Gap |
| Provenance source -> chunk -> answer | Yes | Partly implied, not a full contract | Gap |
| Temporal retrieval / freshness preference | Often in stronger systems | Not yet explicit | Gap |
| Evals for retrieval and permission safety | Yes | Not yet explicit in package | Gap |
| Operator observability | Yes | Not yet explicit in package | Gap |
| Redaction / DLP classification at ingest | Often in enterprise systems | Only partial via sensitivity idea | Gap |
| Archive/delete embedding lifecycle | Yes | Retention mentioned, detailed delete semantics incomplete | Gap |

---

## 5. Areas we already cover well

### 5.1 Ownership and sharing doctrine

We already cover strongly:
- user-private vs organization-shared split,
- no direct user-to-user retrieval,
- no tenant-to-tenant retrieval,
- promotion as explicit workflow.

This is a good architectural core.

### 5.2 Consumer neutrality

We already position knowledge layer correctly as shared infrastructure for:
- chat,
- execution agent,
- virtual workers,
- deep research.

This is more mature than many feature-first RAG designs.

### 5.3 Policy-first direction

We already define the right top-level rule:
- filter by scope and policy before ranking.

This aligns with secure enterprise RAG practice.

---

## 6. Important aspects others usually think through that we still need to document better

### 6.1 Provenance ledger

We still need a clearer contract for:
- source object ID,
- chunk provenance,
- answer citation provenance,
- promotion provenance,
- audit replay path.

### 6.2 Freshness and temporal behavior

We still need:
- freshness metadata,
- stale-source treatment,
- incremental sync expectations,
- temporal bias rules when sources disagree.

### 6.3 Connector and sync governance

We still need:
- sync ownership,
- connector permission mapping,
- change detection strategy,
- re-index triggers,
- failure and drift semantics.

### 6.4 Deduplication and versioning

We still need:
- canonical document identity rules,
- duplicate detection policy,
- version lineage,
- update vs replace semantics.

### 6.5 Retrieval evals and safety evals

We still need:
- benchmark datasets,
- ACL leakage tests,
- citation fidelity checks,
- unsupported-claim metrics,
- consumer-specific retrieval evals.

### 6.6 Operator tooling

We still need:
- ingest dashboards,
- blocked-source diagnostics,
- retrieval trace inspection,
- freshness/drift alerts,
- promotion review tooling.

### 6.7 Data classification and redaction

We still need:
- ingestion-time classification,
- redaction policy,
- sensitive-field handling before embedding,
- policy for confidential content in vectors/chunks.

---

## 7. Benchmark conclusion

Our current package is strong in:
- conceptual ownership,
- sharing doctrine,
- tenant boundaries,
- user-vs-org distinction.

It is still weaker than mature enterprise RAG designs in:
- ingestion lifecycle sophistication,
- provenance and freshness,
- retrieval evals,
- connector governance,
- operator observability,
- data classification/redaction.

That means the package is directionally correct, but not yet fully complete.

The next missing canonical documents should therefore focus on:
- gap prioritization,
- provenance/freshness/evals,
- and storage/governance unification.

## 7.1 What the parity package now closes

The benchmark is no longer standing alone.
The parity package now provides canonical homes for several benchmark gaps:

| Benchmark gap area | Parity document that now owns it |
| --- | --- |
| connector governance | `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` |
| provenance and citation contract | `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` |
| identity and effective scope | `AI_IDENTITY_ROLES_AND_SCOPE_ARCHITECTURE_V8.md` |
| memory lifecycle and delete cascade | `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md` |
| workload classes for retrieval consumers | `AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md` |

This is an important improvement, but not yet a reason to mark those gaps as closed.
Most of them should still be treated as `partial hardening complete, reference-grade detail still pending`.

## 7.2 Remaining benchmark-level deficits after parity pass

Even with the parity package in place, the documentation is still weaker than mature enterprise RAG systems in:

- exact connector ACL projection and sync semantics,
- provenance mechanics from source object to answer span,
- retrieval evals and permission leakage testing,
- operator tooling and blocked-source diagnostics,
- ingest-time classification and redaction,
- freshness and temporal conflict rules.

Related docs:
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `KNOWLEDGE_RAG_V8_AS_IS.md`
- `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
