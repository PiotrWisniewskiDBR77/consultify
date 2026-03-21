# AI Connectors Enterprise Search Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny model `connectors`, `enterprise search`, `ACL-aware retrieval` i `source freshness` dla wszystkich AI consumerow.

---

## 1. Why this matters for Consultify

W srodowisku AI dla biznesu user nie pyta tylko o to, co jest w czacie.
Pyta o to, co jest w:

- dokumentach organizacji,
- projektach,
- repozytoriach wiedzy,
- systemach zewnetrznych,
- kontrolowanych zrodlach klienta.

Bez dojrzalego modelu connectorow AI staje sie albo slepe, albo niebezpieczne.

---

## 2. Leader patterns

Leaders pokazuja stale te same zasady:

- enterprise search musi byc first-class, nie dodatkiem do uploadu plikow,
- source scope musi byc jawny,
- ACL i tenant boundaries musza byc zastosowane przed rankingiem,
- sync, staleness i re-index sa czescia produktu, nie tylko pipeline engineering.

Imported references:

- `Perplexity`: evidence-first search discipline,
- `Claude`: file and project knowledge grounding,
- `LangChain`: routered retrieval across verticals,
- `OpenAI` and agent systems: retrieval workers with structured outputs.

---

## 3. Current V8 coverage

Already covered partially in:

- `KNOWLEDGE_RAG_V8_SSOT.md`
- `KNOWLEDGE_RAG_V8_BENCHMARK.md`
- `KNOWLEDGE_RAG_V8_GAP_MATRIX.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`

Current gap:

- brak jednej kanonicznej architektury, ktora spina `connector registry`, `sync lifecycle`, `ACL mapping`, `retrieval presets`, `freshness` i `source audit`.

---

## 4. Canonical target architecture

Canonical flow:

`connector registration -> source auth -> source mapping -> ingest -> classify -> ACL projection -> chunk/embed/index -> retrieve -> cite/log -> refresh/archive`

Required components:

- `ConnectorRegistry`
- `ConnectorCredentialPolicy`
- `ConnectorSyncJob`
- `SourceACLProjector`
- `EnterpriseSearchGateway`
- `FreshnessAndDriftMonitor`
- `CitationSourceLedger`

Canonical retrieval rule:

`no connector content may enter ranking before tenant, source ACL, role and project visibility checks`

## 4.1 Leader-grade hardening requirements

To reach mature enterprise-search quality, this architecture must also define:

- connector auth lifecycle including token refresh, revocation and secret ownership,
- exact ACL projection rules from external systems into internal retrieval policy,
- hybrid retrieval strategy for keyword, semantic and rerank stages where source class requires it,
- source freshness and drift states with clear user and operator semantics,
- ingestion-time classification and redaction before sensitive content reaches chunks or embeddings,
- blocked-source and denied-result traces visible to operators.

Minimum connector metadata should include:

- `connector_id`
- `connector_type`
- `credential_owner_ref`
- `source_system_id`
- `source_acl_hash`
- `sensitivity_label`
- `freshness_state`
- `last_synced_at`
- `last_verified_at`
- `index_version`
- `drift_state`

---

## 5. Contracts and boundaries

`Knowledge RAG v8` owns:

- knowledge scope taxonomy,
- retention and promotion,
- general retrieval governance.

This document owns:

- connector-specific lifecycle,
- mapping from external ACLs into internal effective access,
- freshness guarantees,
- search contract for all AI consumers.

`Chat`, `Execution`, `Workers` may consume enterprise search, but cannot define their own connector semantics.

---

## 6. Risks and failure modes

Main risks:

- stale documents continue to influence answers,
- revoked access is not reflected in retrieval,
- connector content leaks across projects or roles,
- same source appears trustworthy in UI but is not traceable in support logs,
- different AI consumers apply different search presets to the same source family.

---

## 7. Implementation implications

The platform should add:

- one canonical connector catalog with source class and sensitivity,
- one sync and re-index lifecycle with failure states,
- one internal ACL projection model,
- one retrieval preset model per consumer and task shape,
- one freshness status exposed to operators and, when relevant, to users.

---

## 8. Acceptance criteria

- Every connected source has tenant, owner, ACL and sensitivity metadata.
- Revoked access is reflected before the next retrieval decision.
- Search results expose traceable source references.
- Operators can inspect freshness, last sync and indexing state.
- Chat, execution and worker consumers use one governed enterprise search gateway.

---

## 9. Related canonical docs

- `docs/product/KNOWLEDGE_RAG_V8_SSOT.md`
- `docs/product/KNOWLEDGE_RAG_V8_BENCHMARK.md`
- `docs/product/KNOWLEDGE_RAG_V8_GAP_MATRIX.md`
- `docs/product/CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
