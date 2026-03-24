# External Object Lineage And Provenance v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical identity, version, mirror snapshot, freshness and transformation-lineage model for external objects consumed or published by the platform

---

## 1. Why this document exists

Once Consultify syncs with external systems, it must always be possible to answer:

- where did this object come from
- which external record does it correspond to
- when was it last refreshed
- which transformations happened on the way

---

## 2. Canonical external object identity

Every synced external object should preserve:

- `source_system_key`
- `source_workspace_ref`
- `source_object_type`
- `source_object_id`
- `source_object_url`
- `installation_id`
- `org_id`

Together these form the external identity spine.

---

## 3. Provenance metadata

Minimum provenance metadata:

- `first_seen_at`
- `last_seen_at`
- `last_synced_at`
- `freshness_state`
- `credential_owner_ref`
- `sync_mode`
- `mapping_profile_ref`
- `sensitivity_label`

---

## 4. Lineage model

The platform should preserve lineage across:

- ingest
- normalize
- map
- enrich
- mirror
- publish

Canonical lineage object:

`ExternalObjectLineageRecord`

Fields:

- `external_identity_ref`
- `local_object_ref`
- `lineage_stage`
- `input_version_ref`
- `output_version_ref`
- `transform_ref`
- `run_id`

---

## 5. Mirror vs link vs publish

These behaviors must remain distinct:

- `linked`: Consultify points to the external object
- `mirrored`: a local synced representation exists
- `published`: Consultify created or updated the external object

The lineage model must record which behavior happened.

---

## 6. Freshness doctrine

Every external object should expose:

- `fresh`
- `stale`
- `unknown`
- `failed_refresh`
- `revoked_access`

Freshness must be visible to operators and, where relevant, to users and AI consumers.

---

## 7. Why this matters for AI

If AI uses external content, provenance must survive through:

- retrieval
- citations
- summaries
- proposals

Rule:

`no AI-derived output grounded in external content should lose source traceability`

---

## 8. Related canonical docs

- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `CLOUD_FILES_AND_EXTERNAL_DOCS_RUNTIME_V8.md`
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`
- `CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md`
