# Connector Backend Domain Model v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: implementation-grade backend aggregate model for provider catalog, connector installations, mappings, runtime runs, external objects and MCP or remote-tool audit

---

## 1. Why this document exists

The sync package needs one backend domain model rather than disconnected tables and services.

---

## 2. Core aggregates

The canonical backend model should include:

- `ProviderCatalogEntry`
- `ConnectorInstallation`
- `ConnectionCredentialRef`
- `MappingProfile`
- `SyncDefinition`
- `ConnectorRun`
- `ExternalObjectMirror`
- `ConflictCase`
- `SupportIncidentRef`

---

## 3. Provider catalog aggregate

Owns:

- provider identity
- category
- auth model
- capability badges
- policy flags

---

## 4. Installation aggregate

Owns:

- org ownership
- optional user ownership
- environment
- enabled state
- reauth state
- active mapping and sync definitions

---

## 5. Run aggregate

Owns:

- trigger source
- run status
- retry count
- error class
- related business objects
- event references

---

## 6. External object aggregate

Owns:

- external identity
- local object linkage
- freshness
- mirror state
- provenance

---

## 7. Related canonical docs

- `CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md`
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `EXTERNAL_OBJECT_LINEAGE_AND_PROVENANCE_V8.md`
- `CONNECTOR_DB_SCHEMA_AND_MIGRATION_CONTRACT_V8.md`
