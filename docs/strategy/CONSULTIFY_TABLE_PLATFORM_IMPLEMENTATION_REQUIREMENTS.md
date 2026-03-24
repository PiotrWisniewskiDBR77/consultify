# Consultify Table Platform
## Implementation Requirements

This document defines the minimum implementation requirements for the future Airtable-like table platform.

It exists to make future planning specific, reviewable, and auditable before rebuild work starts.

## 1. Functional requirements

### 1.1 Metadata requirements

The platform must support:

- create base
- create table
- create field
- create view
- update schema metadata
- delete or archive metadata objects
- stable identifiers for all schema objects

### 1.2 Record requirements

The platform must support:

- create record
- read record
- update record
- delete record
- batch create/update/delete
- record-level audit visibility
- attachment binding

### 1.3 View requirements

The platform must support:

- saved views
- visible field configuration
- sort
- filter
- grouping metadata
- pagination
- default view behavior

### 1.4 Relation requirements

The platform must support:

- linked records
- reverse relation semantics
- count
- lookup
- rollup v1

### 1.5 Chat requirements

The platform must support:

- describe schema in natural language
- generate structured proposal
- show proposal to user
- accept/reject/refine proposal
- execute approved schema mutations
- log executed schema changes

## 2. Non-functional requirements

The platform must support:

- safe coexistence with current workspace tooling
- progressive rollout
- feature flagging
- observability
- auditability
- API stability
- testability

## 3. Required backend capabilities

### 3.1 Metadata API

Required capabilities:

- list bases
- get base
- create base
- update base
- create table
- update table
- create field
- update field
- create view
- update view

### 3.2 Records API

Required capabilities:

- list records
- get record
- create record
- update record
- delete record
- batch operations
- query by view
- query with filter/sort/projection

### 3.3 Audit capabilities

Required capabilities:

- log schema mutation
- log record mutation
- expose mutation metadata for diagnostics

## 4. Required frontend capabilities

### 4.1 Grid

Required capabilities:

- render rows from backend records
- inline edit cells
- add row
- delete row
- bulk select v1
- visible columns
- saved view switching

### 4.2 Detail panel

Required capabilities:

- open by record ID
- show all available fields
- support attachments
- support relation previews

### 4.3 Chat proposal UX

Required capabilities:

- preview structured schema change
- approval controls
- execution feedback
- failure messaging

## 5. Field types required in MVP

Minimum required field types:

- text
- long_text
- number
- currency
- percent
- checkbox
- date
- single_select
- multi_select
- url
- email
- phone
- attachment
- linked_record
- created_time
- created_by
- last_modified_time
- last_modified_by

Deferred field types:

- advanced formula types
- AI-generated fields as first-class backend objects
- highly specialized field widgets

## 6. Current code constraints that implementation must respect

### 6.1 Table persistence boundary

Current payload creation happens in:

- [src/components/MyWork/table/useTablePersistence.ts](src/components/MyWork/table/useTablePersistence.ts)

This file currently serializes table schema into `extensions.table`, which means any new backend implementation must either:

- replace this as the primary persistence mechanism, or
- temporarily adapt it while canonical persistence moves server-side

### 6.2 Table action AI boundary

Current NL action flow happens in:

- [src/components/MyWork/table/AITableAssistant.tsx](src/components/MyWork/table/AITableAssistant.tsx)

The implementation must reuse this as an adapter entry point instead of inventing a parallel chat path immediately.

### 6.3 Backend integration surface

Current backend integration is concentrated in:

- [server/src/routes/my-work.routes.ts](server/src/routes/my-work.routes.ts)

The new implementation must avoid expanding this route into a permanent table platform monolith.

## 7. Required data contracts

The future platform should introduce contracts for:

- `Base`
- `Table`
- `Field`
- `View`
- `Record`
- `Attachment`
- `RecordLink`
- `SchemaProposal`
- `SchemaMutationResult`

## 8. Validation requirements

The platform must validate:

- field names
- reserved identifiers
- duplicate fields
- invalid field options
- invalid linked-record targets
- invalid view filters
- invalid chat proposals before execution

## 9. Performance requirements

Minimum expectations for the first serious implementation:

- basic record queries should not require loading the full dataset into frontend memory
- tables should remain usable beyond current local-only assumptions
- pagination must be backend-backed
- batch writes must exist to reduce request pressure

## 10. Security and operational requirements

Required first-wave controls:

- backend-only credential handling
- no schema mutation directly from client secrets
- feature flags for rollout
- audit logging for schema mutation
- controlled pilot exposure

Deferred controls:

- full enterprise SSO/SCIM parity
- full platform permission matrix

## 11. Testing requirements

Implementation must include:

- API contract tests
- integration tests for metadata and records flows
- end-to-end tests for grid CRUD
- end-to-end tests for chat proposal approval flow
- regression checks against existing workspace behavior

## 12. Review gates before execution

Before build starts, the following must be explicit:

- source of truth model
- MVP field-type list
- relation semantics for v1
- compatibility expectations with current workspace
- rollout model and feature flags
- non-impact operating constraints for other modules
