# Current Sync Connection Method And Target Flow v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: code-informed explanation of how synchronization and integrations currently work in the repo, why the current shape is fragmented, and what the target consolidated connection flow should be

---

## 1. Why this document exists

The integration story in the repo is currently stronger in raw capabilities than in product coherence.

There is enough code and documentation to prove that connectors exist, but not enough simplicity to claim:

`Consultify already has one easy, unified sync system`

This document closes that gap by explaining:

- the current connection methods
- the current fragmentation
- the target consolidated flow
- the benchmark-informed missing layers that still prevent mature external synchronization

---

## 2. Current reality in the repo

Today the repository shows three parallel integration shapes:

### 2.1 Org-level integrations

This is the strongest intended enterprise path.

It includes:

- provider catalog
- integration records
- sync mappings
- sync logs
- org-level routes and settings surfaces

This is the correct foundation for full synchronization.

### 2.2 User-level integrations and preferences

This path is useful for:

- personal channels
- private calendars
- per-user preferences

But it is not a sufficient enterprise system-of-record for organization-wide sync.

### 2.3 Unified Sync Hub / Guardrails

This path introduces:

- stronger health views
- audit and guardrails
- sync-health surfaces

But it is not yet fully consolidated with the org-level integration layer.

---

## 3. The core problem

The platform currently has enough parts to create the illusion of completeness, but not one simple, canonical sync operating model.

The fragmentation problem is:

- multiple setup paths
- multiple data ownership paths
- multiple UI stories
- multiple places for health and logs

This makes external-world sync harder than it should feel.

---

## 4. What is already strong

The current stack already proves meaningful capability in:

- MCP provider registry
- Jira partial task sync
- Slack and Teams webhook-style message delivery
- cloud publish paths
- calendar ICS feed
- sync logs and mapping foundations
- connector architecture for AI retrieval and enterprise search

So the problem is not:

`there is no sync capability`

It is:

`the capability is not yet one coherent easy-sync product`

---

## 4.1 Hard blockers confirmed by readiness analysis

The benchmark and code audit together confirm that the main blockers are:

- no single canonical integration platform across all current surfaces
- no full OAuth lifecycle for major vendors
- no superadmin provider control plane
- no first-class mapping product
- no fully mature queue, replay and dead-letter runtime
- no unified operator support surface

These are not optional refinements.
They are the difference between partial integrations and a trusted sync platform.

---

## 5. Current connection method by family

### 5.1 Calendars

Current reality:

- ICS-style calendar publication exists
- OAuth-grade calendar connection and bidirectional event handling are not yet the simple canonical flow

Current weakness:

- too much distance between technical capability and user promise

### 5.2 Communication channels

Current reality:

- webhook-based outbound behavior is present
- project/channel routing is partially modeled
- richer interactive actions are still incomplete

Current weakness:

- easy connect and durable per-channel control are not one consistent product surface

### 5.3 PM and task tools

Current reality:

- Jira has partial real sync value
- other PM platforms exist mostly as target cards or future scope

Current weakness:

- one strong Jira path is not the same as a generalized PM sync product

### 5.4 Cloud files

Current reality:

- cloud publish exists where token paths are available

Current weakness:

- connect, authorize, browse scope and manage sync health are not yet one simple user journey

### 5.5 AI and MCP ecosystems

Current reality:

- provider registry and remote tool logic are strong

Current weakness:

- users and operators still need one simpler mental model for what is a model/provider integration versus what is business-object synchronization

---

## 5.6 Benchmark-informed missing layers

The current repo shape is still missing several layers that mature platforms make explicit:

- `control plane` for provider catalog, policy and deployment governance
- `connection objects` reusable across flows and environments
- `workflow or sync definitions` that are distinct from credentials and runs
- `job runtime` with inspectable retries, failures and replay
- `support surfaces` for operator and support teams

Without these layers, new connectors increase complexity faster than they increase capability.

---

## 6. Target consolidated connection flow

The target product flow should be:

`choose provider -> authenticate -> choose ownership level -> select capabilities -> map source and target objects -> test -> enable -> observe health -> resolve conflicts only when needed`

### 6.1 Step 1: Choose provider

The platform should clearly categorize providers by:

- calendar
- communication
- PM/task
- cloud docs/files
- knowledge
- AI/provider/MCP

### 6.2 Step 2: Authenticate

The product should clearly show whether the connector is:

- org-level
- user-level
- service-account-like
- API key based
- webhook based

### 6.3 Step 3: Choose capabilities

The user or admin should explicitly select:

- read
- write
- bidirectional
- publish-only
- retrieve-only

### 6.4 Step 4: Map objects

The product must provide explicit mapping between external and internal objects.

Examples:

- `task` <-> `issue`
- `decision review` -> `message/card`
- `calendar_event` <-> `review window`
- `artifact` -> `cloud file`

### 6.5 Step 5: Test

Every connector should have:

- test connection
- sample sync or test publish
- visible result

### 6.6 Step 6: Enable and run

Once enabled, the connector should expose:

- sync mode
- schedule
- health
- logs
- last run
- next run if scheduled

### 6.7 Step 7: Explain and recover

When a sync fails or conflicts, the user should see:

- what failed
- which object was affected
- whether action is required
- how to recover

---

## 7. Target ownership model

The target flow must separate:

### 7.1 Superadmin

Owns:

- provider catalog
- platform policy
- allowed connector classes
- compliance posture

### 7.2 Org admin

Owns:

- org-level connector connection
- mapping
- channel/folder/project routing
- org-level sync policy

### 7.3 User

Owns:

- personal channels or calendar where allowed
- personal preferences
- personal reauth when the connector is user-scoped

Rule:

`easy sync requires explicit ownership or else troubleshooting becomes impossible`

---

## 8. What the target flow must add beyond current V3 docs

The next-level V8 expectation is not just more connectors.

It is:

- one simple setup journey
- one honest capability model
- one ownership model
- one health and troubleshooting story
- one clear split between sync, automation and AI grounding
- one explicit split between control plane and runtime plane
- one consistent model for connection, sync definition and run record

---

## 9. Recommended target priorities

For Consultify's product mission, the priority order should be:

1. calendars
2. communication channels
3. PM/task systems
4. cloud files
5. knowledge and external document systems
6. AI provider and MCP ecosystems

Reason:

- first connect work timing
- then connect work communication
- then connect work execution systems
- then connect outputs and evidence
- then expand knowledge and AI reach

---

## 10. Acceptance criteria

This document is doing its job if:

- the current fragmentation is explicit
- the target flow is understandable in one pass
- future connector work can be judged against one consolidated easy-sync model

---

## 11. Related canonical docs

- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
- `CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
- `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- `CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md`
- `CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md`
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
- `INTEGRATIONS_CONNECTOR_RUNBOOKS_ENTERPRISE_V3.md`
