# Cloud Files And External Docs Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical runtime semantics for external docs and files including access, preview, extraction completeness, live or mirrored freshness and publish or share behavior

---

## 1. Why this document exists

Cloud-file integrations are not only storage adapters.

They affect:

- publishing
- evidence
- retrieval
- preview
- access control

---

## 2. Canonical file behaviors

Every external-file flow must be labeled as:

- `link_only`
- `published_copy`
- `live_mirror`
- `retrieval_source`

These behaviors are not equivalent and must not be mixed in UI language.

---

## 3. File runtime metadata

Every synced or published external file should preserve:

- `source_system_key`
- `external_file_id`
- `external_path`
- `share_url`
- `access_scope`
- `file_behavior`
- `last_published_at`
- `last_refreshed_at`
- `freshness_state`

---

## 4. Preview and extraction completeness

The platform should distinguish:

- preview available
- preview partial
- text extraction complete
- text extraction partial
- extraction unsupported

This matters for both users and AI.

---

## 5. Publish semantics

Publishing must define:

- target destination
- overwrite rule
- naming rule
- version rule
- share-link rule

---

## 6. Mirror semantics

If a file is mirrored, the system must define:

- refresh cadence
- checksum or version comparison
- stale behavior
- revoked-access behavior

---

## 7. Related canonical docs

- `EXTERNAL_OBJECT_LINEAGE_AND_PROVENANCE_V8.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`
- `CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md`
