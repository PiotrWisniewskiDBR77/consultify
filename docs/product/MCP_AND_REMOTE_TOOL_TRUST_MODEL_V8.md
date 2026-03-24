# MCP And Remote Tool Trust Model v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical trust model for MCP servers, remote tool providers, credential delegation, remote mutation policy and external trust boundaries

---

## 1. Why this document exists

Remote tools and MCP providers are part of the integration layer, but they are not identical to business-object synchronization.

They need their own trust model.

---

## 2. Trust classes

Every remote tool provider should be classified as:

- `internal_trusted`
- `customer_trusted`
- `external_reviewed`
- `experimental`

This class determines:

- allowed capabilities
- mutation permissions
- approval requirements

---

## 3. Remote tool capability classes

Canonical classes:

- `read_only`
- `write_with_confirmation`
- `write_with_policy`
- `autonomous_mutation_forbidden`

Rule:

`mutation capability must never be inferred from mere connectivity`

---

## 4. Credential ownership

The platform must track whether credentials are:

- superadmin-owned
- org-owned
- user-owned
- ephemeral delegated

This ownership affects:

- visibility
- audit
- rotation
- revoke semantics

---

## 5. Tool allowlist doctrine

Each MCP or remote tool installation must define:

- allowed tools
- denied tools
- module access scope
- environment scope

---

## 6. Human-in-the-loop rule

Remote mutation through MCP or external tools should default to:

`propose -> review -> approve -> execute`

Exceptions require explicit policy.

---

## 7. Related canonical docs

- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
- `CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md`
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
