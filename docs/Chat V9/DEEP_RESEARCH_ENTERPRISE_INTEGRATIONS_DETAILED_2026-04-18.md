# Enterprise Integrations Requirements — Consultify (detailed)

> **Status:** source research input, captured 2026-04-18. Do not edit in place.
> **Scope:** answers the Enterprise Integrations / Connector catalogue /
> Auth-ACL-residency deep research prompt (Prompt 6 of the first research
> batch) with the **full, detailed** specification. Supersedes the shorter
> Connectors section (R-CONNECT-1…8) inside
> `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md`.
>
> **ID reconciliation required at plan-action time:**
> - `R-CONNECT-1…8` from the earlier Artifact/Connectors/ROI/Onboarding research
>   doc is **subsumed** by this document's `R-CONNECT-1…24`. IDs collide.
> - At plan-action time, this document is authoritative for all `R-CONNECT-*`
>   IDs. The earlier R-CONNECT-1…8 rows should be **closed / merged** into the
>   corresponding detailed IDs here, not re-ticketed. The mapping is spelled out
>   in the "ID reconciliation" table below.
>
> Complements the Reasoning, Feedback/Learning, Agentic Chat Runtime, and ROI
> Lifecycle research documents dated 2026-04-18.
>
> **Next step:** this document will be turned into the canonical Integrations
> implementation plan (tickets + flags + tests + CI invariants) in a follow-up
> pass.

---

## Strategic thesis

Consultify should not position integrations as a feature add-on. For the target buyer, **integrations are the product boundary**. If Consultify cannot read the systems where work, evidence, permissions, and commercial context actually live, it becomes another silo.

The correct design centre is therefore not "more connectors", but a **trust-preserving enterprise integration fabric** with four hard properties:

1. **Least-privilege auth**
2. **ACL-aware retrieval**
3. **Explicit indexing transparency**
4. **Enforceable regional residency**

The benchmark products (Atlassian Rovo, Glean, Microsoft 365 Copilot connectors, Slack Enterprise) all converge on the same operating pattern: admin-governed connection setup, permission sync from the source system, and either indexed or federated retrieval that honours source visibility at query time.

### Contract-level non-negotiables

Treat these as contract-level requirements, not roadmap aspirations:

- **ZERO ACL leak**
- **ZERO silent storage**
- **Disconnect = purge**
- **Least privilege by default**
- **SSO/SCIM mandatory for enterprise**
- **Region-pinned storage**

For OAuth and identity: authorisation code flow, PKCE, exact redirect URIs, refresh token hygiene, OIDC for primary SSO, SAML 2.0 as enterprise fallback, SCIM 2.0 for lifecycle sync.

---

## Connector catalogue and prioritisation

### Priority logic

The fastest path to enterprise value is not "largest number of logos". It is highest overlap with consulting workflows: mail, files, CRM, work execution, knowledge bases, and chat. In practice, that makes **Google Workspace + Microsoft 365 + Salesforce + Atlassian + Slack** the centre of gravity.

### Legend

- **Auth:** `U` = user-level OAuth; `A` = admin/tenant install; `App` = application/service principal; `Key` = API key/token; `Cert` = certificate/JWT.
- **Freshness:** `WH` = webhook/push; `Delta` = incremental token/feed; `Poll` = scheduled polling.
- **ACL:** `Native` = source permissions can be propagated; `Limited` = app-scoped or coarse ACL model; `Mixed` = combination of admin install and per-user consent.
- **Rate:** `H` = high/headroom-friendly; `M` = moderate or plan-based; `V` = vendor/method-specific or dynamic throttling.
- **Effort:** `S` / `M` / `L` = estimated implementation effort for a production-grade, enterprise-safe connector.

### P0 connectors

| Connector | Why it is P0 | Auth | Scope posture | Freshness | ACL posture | Enterprise readiness | Rate | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Microsoft 365 substrate** | One admin plane for Outlook, OneDrive, SharePoint, Teams, users, groups, and future Copilot-style connectors | U + A + App | Delegated read where possible; application permissions only where necessary | WH + Delta | Native via Entra users/groups and external-item ACL patterns | Admin consent, national clouds, Multi-Geo, SCIM ecosystem | V | L |
| **Outlook** | Email is a primary evidence source for consulting, finance and legal workflows | U + A | `Mail.ReadBasic` / `Mail.Read` preferred before wider mail scopes | WH + Delta | Native mailbox visibility | Strong admin/governance via Graph | V | M |
| **OneDrive** | Personal work files and drafts often sit here before moving to SharePoint | U + A + App | `Files.Read` / `Files.Read.All` style least privilege | WH + Delta | Native file and drive permissions | Multi-Geo and national cloud support | V | L |
| **SharePoint** | The quoted CFO/DMS equivalent in many enterprises; must be first-wave | A + App | `Sites.Selected` or least viable site/document scopes; avoid tenant-wide overreach where possible | WH + Delta | Native site, library and item permissions | Strong governance and residency controls | V | L |
| **Gmail** | Core source for executive and consultant workflows in Google-centric firms | U + A | `gmail.readonly` / `gmail.metadata` before `gmail.modify` or full mail scope | Push + partial sync | Native mailbox visibility | Mature OAuth and admin SDK ecosystem | H | M |
| **Google Drive** | Often the highest-ROI document source in Google-first organisations | U + A | `drive.readonly` before broader scopes | WH + Changes feed | Native file permissions | Shared drives, rich change feed | H | M |
| **Salesforce** | Essential for CEO and commercial research use cases; opportunities, accounts, cases, docs | U + A | Read-only connected app scopes first; admin-approved install for enterprise | CDC + Poll | Strong object/field security; record access must be explicitly preserved | Connected apps and admin pre-authorisation are mature | M | L |
| **Jira** | Critical for COO execution visibility, current work state and issue flow | U + A | Read-only issue/project scopes first | WH + Poll | Native project/issue visibility | Strong enterprise install and governance patterns | M | M |
| **Confluence** | High-value internal knowledge source for delivery context and historical decisions | U + A | Read-only content scopes first | WH + Poll | Native space/page visibility | Same enterprise posture as Jira | M | M |
| **Slack** | High-context conversational layer; indispensable, but only if truly permission-aware | A + U | Workspace/org install plus per-user scopes for private content where required | Events + RTS/federated patterns | **Mixed**: public via org install; private/DM requires user authorisation | Enterprise Grid admin install, SCIM, audit logs, token rotation | V | L |

### P1 connectors

| Connector | Why it is P1 | Auth | Scope posture | Freshness | ACL posture | Enterprise readiness | Rate | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Google Calendar** | Project cadence, staffing context, meeting intelligence; secondary to mail/files | U + A | `calendar.readonly` | WH | Native calendar sharing | Admin-managed within Workspace | M | S |
| **HubSpot** | Strong ROI in RevOps-heavy consulting clients; below Salesforce for enterprise depth | U + A + client credentials for webhook journal | Granular CRM object scopes | WH journal + snapshots | Native account/object access | SCIM available on higher tiers | H | M |
| **Microsoft Teams** | Valuable, but technically harder than Slack for consistent enterprise-safe message retrieval | A + App | Least-privilege channel/chat read; export APIs where compliance demands | WH + export patterns | Native, but APIs vary by resource and permission type | Deep M365 governance and residency support | V | L |
| **Notion** | Popular in services firms; API permissions are app/page-share centric, not a perfect enterprise ACL model | U | Capabilities chosen during OAuth; keep read-only | WH | **Limited**: content is shared to the integration, not derived from per-user enterprise ACLs | Public integrations, refresh tokens, Enterprise SCIM | M | M |
| **Box** | Important in regulated document workflows and external sharing-heavy firms | U + A + JWT/Cert | `root_readonly` and narrowly enabled scopes | WH + events | Native collaborations and groups | Admin authorisation and enterprise events | M | M |
| **Dropbox** | Strong for mid-market consulting teams; slightly weaker than Box/M365 on enterprise governance fit | U + A | Scoped OAuth permissions for files/sharing/team endpoints | WH + cursor polling | Native sharing and team files | Team-admin authorisation for Business APIs | M | M |
| **GitHub** | High value where consulting includes engineering delivery, proposals, or solution build-outs | App + U | Prefer GitHub App permissions over broad OAuth scopes | WH | Native repo/org/team permissions | GitHub Apps have scalable limits and built-in webhooks | H | M |
| **GitLab** | Similar value to GitHub, especially for self-managed or regulated clients | U + App-like patterns depending on instance | Narrow OAuth scopes; self-managed nuances | WH | Native project/group permission model | Strong for self-managed and dedicated deployments | M | M |
| **Zendesk** | Important for customer support and post-sales consulting evidence | U + A | Read before write; OAuth tokens preferable to static API tokens | WH + incremental export | Native ticket/help-centre access | Mature webhook and token model | M | M |
| **Intercom** | Valuable for customer conversations and support intelligence, especially in SaaS clients | U + A | OAuth scopes reviewed by Intercom; minimise permissions | WH | Workspace-centric with OAuth scopes by topic/object | Public app review and strong token guidance | H | M |

### P2 connectors

| Connector | Why it is P2 | Auth | Scope posture | Freshness | ACL posture | Enterprise readiness | Rate | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Asana** | Useful, but usually lower enterprise centrality than Jira/Confluence | U | Registered OAuth scopes; read-only first | WH | Native project/task access | Mature OAuth and webhooks | H | M |
| **Monday.com** | Popular in some service teams, but lower mandatory value for first enterprise cohort | U + app constructs | API permission scopes; complexity budgets matter | WH | Native account/item permissions | Strong app governance, user scope approvals | H | M |
| **Linear** | Excellent for product-led software teams, but narrower TAM than Jira | U | OAuth 2.0 / API key with minimum permissions | WH | Native workspace/team permissions | Enterprise app approvals and SCIM available | M | M |
| **ClickUp** | Mid-market demand exists, but long-tail relative to P0/P1 enterprise stack | U | OAuth/read-only first | WH | Native workspace hierarchy, but webhooks are creator/user-tied | Enterprise SSO/SCIM available | H on Enterprise, lower on smaller plans | M |
| **Figma** | Useful for design-heavy consulting, not broad enough for first-wave enterprise | U | Fine-grained OAuth scopes | WH | Native team/project/file permissions | Enterprise-ready, but specialised | M | M |
| **Miro** | Valuable for workshops and transformation programmes, but secondary vs CRM/mail/docs | U | `boards` / `projects` / `org` scopes; read-only first | WH | Native board/team access, enterprise org APIs available | Enterprise team governance and SCIM | M | M |
| **Zoom** | Meeting artefacts matter, but transcripts/recordings are usually not the first blocker | U + A + server-to-server for internal cases | Granular OAuth scopes; deauthorisation handling required | WH | Native meeting/recording access; transcript ACLs vary by model | Mature app marketplace and admin controls | M | M |
| **Lattice** | Narrower buyer overlap; HR feedback useful but not first-wave | Key/admin token posture (verify during discovery) | Read-only HR/goal scopes only | Likely poll-first | Likely workspace/admin scoped | Enterprise-focused, but public technical detail is sparse | Unknown / verify | M |
| **BambooHR** | Relevant for staffing context, but not usually the first blocker | Key | Read-only employee/field access first | WH available | Native user-permissioned visibility | Enterprise provisioning fit depends on plan and IdP | M | M |
| **Workday** | Strategically important for some enterprises, but very high implementation and support cost | A + OAuth client + tenant-specific security group patterns | Read-only domains only; strict security-group minimisation | Poll/event strategy depends on tenant capabilities | Native, but tenant-specific and complex | Enterprise-ready but high-friction and tenant-gated | Unknown / tenant-specific | L |

### Custom DMS requirement

Because the buyer explicitly named "our DMS", a **custom connector contract** is also required in the first enterprise architecture, even if the specific DMS vendor is unknown.

It should **only admit indexed mode** if the source can provide:

- stable item IDs
- latest version hash
- modified timestamp
- retrievable body/attachment bytes
- principal lists or equivalent access grants
- a change feed or webhook

If it cannot, the safe fallback is **federated retrieval or manual refresh only**. This is exactly the trade-off now visible in Microsoft 365 Copilot's synced-versus-federated connector model.

---

## Auth and identity lifecycle

### Dual-lane identity model

The correct enterprise model for Consultify is **dual-lane identity**:

- **Lane 1 — User-level connection** for sources whose content visibility is inherently user-scoped: Gmail, Outlook, Google Drive, Slack private content, many task tools.
- **Lane 2 — Tenant/admin install** for sources where enterprise setup, organisation-wide metadata, or app permissions are required: SharePoint, Teams export scenarios, Slack Enterprise Grid admin APIs, Box enterprise events, Salesforce connected apps.

### SSO posture

- **OIDC** = default implementation target (modern token-based federation, interoperable identity claims).
- **SAML 2.0** = first-class fallback (catalogue compatibility, existing IdP templates).
- **SCIM 2.0** = mandatory for enterprise tier, with **group sync preserved end-to-end** (CISO wants group-based visibility, not just user creation).

### Token policy

Stricter than the connector vendors' minimums:

- Envelope encryption at rest
- Token-level audit records
- Refresh-token rotation where supported
- Revocation handling
- Connector-specific state machine: `connected`, `degraded`, `refresh_required`, `suspended`, `disconnected`, `purged`

When the source emits deauthorisation or revocation signals (Zoom deauthorisation, Slack token rotation/refresh, Notion refresh-token lifecycle, Zendesk refresh-token handling, Gmail watch stop), Consultify should immediately stop ingestion and queue purge according to policy.

### Practical enterprise rules

- User OAuth flow in chat and Settings must be identical in outcome. The current "connect in chat" toast is architecturally harmful because it creates a permission illusion.
- Admin install must mint tenant metadata separately from user content tokens. Do not overload one token type for both.
- Disconnect = operational stop + cache quarantine immediately + purge completion within 30 days.
- **Dead-man switch:** any connector with expired or unused tokens for 30 days auto-suspends, notifies user/admin, and stops jobs until reconnection.
- No admin scope without proof. Admin scopes require written justification, surface-level UI disclosure, and a narrower alternative analysis.

---

## Data ingestion, freshness, and ACL trust

### Evidence pipeline model

Treat ingestion as an **evidence pipeline, not a crawler**. The core object model should at minimum support:

`tenant`, `source`, `connector_instance`, `principal`, `group`, `source_item`, `source_version`, `access_edge`, `content_blob`, `chunk`, `sync_job`, `purge_job`

On top of that, a **canonical entity graph** so that "the same thing" arriving from different channels resolves to one logical object (e.g. a proposal file appearing as a Gmail attachment, a Drive file, and a SharePoint copy). Use source IDs and content hashes first, then title/path/author/time heuristics only as fallback.

### Freshness SLOs

Default: **webhook-first, delta-second, polling-last.**

| Source | Proposed freshness SLO | Mechanism |
| --- | --- | --- |
| Gmail new mail | under 5 minutes | `watch` + history/partial sync |
| Outlook new mail | under 5 minutes | Graph notifications + delta |
| Google Drive edits | under 10 minutes | `changes.watch` + fetch changed file |
| SharePoint / OneDrive edits | under 15 minutes | change notifications + delta + permission fetch |
| Jira issue update | under 2 minutes | webhook-first |
| Slack public content | under 2 minutes | event/RTS/federated where available |
| Salesforce opportunity update | under 5 minutes | CDC or scheduled incremental |
| Notion change | under 5 minutes | webhook + point fetch |

Every connector must expose `last_successful_sync`, `oldest_unprocessed_change`, `permission_sync_lag`, and `sample_recent_items` in the admin surface.

### Content preprocessing per type

One chunking strategy will fail:

- **Email** — separate subject, body, quoted history, participants, attachments.
- **Docs / wiki pages** — semantic sections, headings, tables, comments, version metadata.
- **Sheets** — preserve tab name, cell ranges, headers, formula/value distinction.
- **Slides** — slide-level chunking with speaker notes where available.
- **Tickets** — issue body, status history, comments, assignee changes, labels.
- **Chat** — thread-aware segmentation with channel, participants, timestamp context.
- **Meeting artefacts** — recording metadata, transcript sections, speaker turns.

### Retention

Connector-specific and visible. Default of 90 days for email is sensible as a product default, but must be tenant-configurable and visible to both admins and users because zero silent storage is non-negotiable.

---

## ACL propagation and trust

This is the decisive section. Consultify must behave as though it is a **query-time extension of the source systems**, not a shadow data lake.

### Core ACL pattern

1. Import source ACLs into a normalised principal graph.
2. Attach principals to source versions and chunks.
3. Filter candidate chunks by subject principals before reranking or synthesis.
4. Re-check highly sensitive items at fetch time when the source supports it.
5. Reconcile ACL drift asynchronously and fail closed when stale.

### Hard connector-specific implications

- **Slack** cannot be treated as "enterprise-safe" from an ACL standpoint with a tenant token alone if private channels, DMs, and group DMs are needed. Slack must run **mixed-mode**: org install for topology and public content, user token for private visibility.
- **Notion** is not a perfect source for zero-leak, user-relative enterprise ACL because content is explicitly shared to the integration. It should be treated as **workspace/app-share scoped** unless additional user-relative checks are built. Do not use Notion as the trust benchmark.
- **SharePoint and OneDrive** can support very strong trust, but only if Consultify ingests both content changes **and permission changes**, and correctly models the difference between application permissions, selected-site scopes, and source inheritance.
- **Salesforce** should be indexed only through a model that preserves **record-level visibility**, not merely object/field access. Product requirement should be stricter than generic REST access, with explicit access stamping per record family ingested.

### Product rules

- If a connector cannot export reliable ACLs, it cannot enter indexed mode for enterprise tier.
- If a connector only supports app-scoped access, mark it `limited-trust` and surface that fact in UI and admin policy.
- **Admin override is not a bypass.** Even tenant admins in Consultify should only see content the source has granted them, unless the source itself exposes a compliant admin/eDiscovery mode and the contract explicitly allows it.
- ACL drift detection compares source version timestamp, source permission timestamp if available, and the last permission-sync checkpoint. On drift, fail closed for restricted objects.
- Maintain an ACL audit trail recording subject, source item, decision reason, and policy version at retrieval time.

---

## Admin, governance, and honest UX

### Admin surface as governance ledger

The required admin domains:

| Surface | What must be visible |
| --- | --- |
| **Connector inventory** | connector, tenant, installer, auth mode, state, last sync, item count, chunk count, principal count |
| **Scope audit** | requested scopes, granted scopes, last-used scopes, over-privilege alerts |
| **Residency** | source region if known, Consultify storage region, cross-region transfers, processor path |
| **DLP policy** | connector/source-level restrictions, retrieval bans, export bans, deep-research exclusions |
| **Kill switch** | immediate tenant-wide disable per connector family and per instance |
| **Health** | webhook health, sync lag, error rate, backlog, rate-limit headroom |
| **Cost** | ingestion cost, storage cost, embedding cost, retrieval cost by tenant and connector |
| **Purge ledger** | disconnect date, purge due date, purge completion evidence |

### Honest capability taxonomy (product law)

- `supported_in_chat`
- `supported_in_settings_only`
- `supported_but_limited_trust`
- `roadmap`
- `unsupported`

UI consequences are mechanical, never interpretive:

| State | Chat UI | Settings UI | Behaviour |
| --- | --- | --- | --- |
| `supported_in_chat` | shown and enabled | shown | full connect flow works end-to-end |
| `supported_in_settings_only` | shown with "Connect in Settings" notice | enabled | never shows a dead-end toast |
| `supported_but_limited_trust` | shown with trust warning chip | shown with admin note | cannot enter indexed mode unless approved |
| `roadmap` | disabled with demand capture | request interest | never implies runtime support |
| `unsupported` | hidden from action menus | optionally documented only | no ghost capabilities |

### Post-connect validation handshake

Every successful connection must:

1. obtain the token
2. call a minimal read endpoint
3. show five sample objects
4. show the scopes granted
5. show the residency/retention policy that will apply

If that validation fails, the connector state **cannot be "connected"**.

---

## Benchmark, MVP, and compliance

### Benchmark findings

| Benchmark | Signal Consultify should align with |
| --- | --- |
| **Rovo** | Connector setup is admin-led; users connect external accounts when necessary; permissions from third-party apps are respected and synced. |
| **Glean** | Connectors fetch both content and permissions; Slack private visibility depends on end-user auth; SharePoint/OneDrive handling is explicit about application permissions and scope trade-offs; Slack RTS introduces a federated/live model for freshness and permission correctness. |
| **Microsoft 365 Copilot connectors** | Platform formally distinguishes synced connectors from federated connectors — the right conceptual model for Consultify too. |
| **Slack Enterprise** | Enterprise Grid install, admin approvals, org-level OAuth, SCIM, audit logs, and private-scope handling define the bar for chat connectors in regulated environments. |

### Fourteen-day MVP

**Not five unrelated connectors. Five connector families on two trust substrates.**

1. **Microsoft 365 family** — SharePoint, OneDrive, Outlook + tenant/group substrate.
2. **Google Workspace family** — Gmail and Google Drive.
3. **Salesforce**.
4. **Atlassian family** — Jira and Confluence.
5. **Slack** — public + mixed-mode private fallback.

This covers the bulk of the first-cohort customer asks: CFO evidence retrieval from SharePoint-like DMS, CEO research over CRM, COO operational awareness from Jira, broad executive context from mail and docs.

### MVP scope honesty

In fourteen days, **do not promise full long-tail enterprise parity.** Promise:

- M365 indexed mode for selected sites/libraries and user mailboxes.
- Google indexed mode for Gmail and Drive.
- Salesforce opportunity/account/contact read with strict read-only scopes.
- Jira/Confluence read-only work and wiki visibility.
- Slack organisational install with honest disclosure that private/DM visibility requires additional per-user authorisation and may initially run in public/federated mode.

### Build vs buy

For Consultify, the answer is **build the contract; buy only the plumbing if it stays behind your contract.** The enterprise buyer will judge on ACL correctness, purge guarantees, residency enforcement, and admin visibility — not on how quickly an underlying adapter was assembled.

- **Build in-house:** auth state model, connector contract, principal graph, ACL filter engine, sync orchestration, purge engine, admin governance, honest UX, residency enforcement.
- **Optionally outsource later:** low-strategic-value P2 adapters, but only if they conform to the connector contract and never weaken ACL, purge, or residency guarantees.

### Compliance matrix

| Control area | What Consultify must do | Connector-specific implication |
| --- | --- | --- |
| **GDPR-style minimisation** | request minimum scopes, support retention windows, support deletion/purge evidence | all connectors default to read-only and configurable retention |
| **SOC 2-style access control** | SSO, SCIM, RBAC, audit trails, key management | enterprise tier requires OIDC/SAML + SCIM + immutable audit logs |
| **Zero ACL leak** | source ACL import + query-time enforcement + drift detection | no indexed mode for limited-trust connectors without compensating control |
| **Zero silent storage** | visible indexing log, item counts, sample objects, retention policy | admin and user can see what is stored and why |
| **Disconnect = purge** | immediate stop, quarantine, 30-day hard purge, audit record | every connector instance has a purge job with evidence |
| **DLP / data-use policy** | per-source restrictions on deep research, synthesis, export, cross-source mixing | Salesforce or HR sources may be queryable but blocked from report generation |
| **Regional residency** | UE tenant data stored in UE, enforced at storage and processing layer | use vendor region controls where available; fail closed on unsupported cross-region modes |

For residency specifically, align with published vendor patterns: Google Workspace data regions, Atlassian data residency, Slack data residency, Salesforce Hyperforce data residency, Microsoft 365 Multi-Geo / national cloud models. The platform should expose **connector-region compatibility as an explicit property** and refuse cross-region indexing for tenants whose contract requires strict EU residence.

---

## Requirements register

| ID | Pri | Requirement | Test | Risk if missed | Effort |
| --- | --- | --- | --- | --- | --- |
| **R-CONNECT-1** | **P0** | Chat and Settings must use the same working OAuth backend; no chat-only placeholder flow | connect in chat, fetch sample items, verify usable token | credibility loss, failed pilot | M |
| **R-CONNECT-2** | **P0** | Every connector instance must declare trust mode: `indexed`, `federated`, `limited-trust`, `disabled` | admin UI shows mode and reason | silent overclaiming | S |
| **R-CONNECT-3** | **P0** | Least-privilege scopes only; admin scopes require written justification and UI disclosure | scope diff report flags excess scope | CISO rejection | M |
| **R-CONNECT-4** | **P0** | Enterprise tier must support OIDC and SAML SSO | test with Entra and Okta | blocked procurement | M |
| **R-CONNECT-5** | **P0** | Enterprise tier must support SCIM 2.0 user and group provisioning | create/update/deprovision user and group | stale access, offboarding risk | M |
| **R-CONNECT-6** | **P0** | Every indexed chunk must carry source principals and source version metadata | inspect stored chunk record | ACL leak | L |
| **R-CONNECT-7** | **P0** | Retrieval must filter by principals before reranking and synthesis | red-team with restricted document | data exposure | L |
| **R-CONNECT-8** | **P0** | If reliable ACLs are unavailable, connector must run `federated`/manual only | attempt to enable indexed mode on limited source | silent security downgrade | M |
| **R-CONNECT-9** | **P0** | Disconnect must immediately stop sync and schedule purge; full purge within 30 days | revoke token then inspect jobs and remaining artefacts | privacy/compliance breach | M |
| **R-CONNECT-10** | **P0** | Purge must delete embeddings, caches, extracted text, and derivative indexes | post-purge storage scan | false deletion claims | L |
| **R-CONNECT-11** | **P0** | Admin console must show requested scopes, granted scopes, and last-used scopes | UI and API validation | over-privilege goes unnoticed | M |
| **R-CONNECT-12** | **P0** | Admin kill switch must disable a connector family tenant-wide immediately | switch off and verify query path denial | incident response failure | M |
| **R-CONNECT-13** | **P0** | Every connector must publish sync lag, error rate, and rate-limit headroom | health dashboard acceptance test | stale data with no visibility | M |
| **R-CONNECT-14** | **P0** | Post-connect validation must show at least five sample items and applied retention/residency rules | manual connect acceptance | false-positive "connected" state | S |
| **R-CONNECT-15** | **P1** | Deduplication must merge identical artefacts across mail attachment and file sources into one logical entity | same file via Gmail and SharePoint yields one entity | noisy retrieval, user distrust | M |
| **R-CONNECT-16** | **P1** | DLP policies must support source-level bans on deep research, export, and cross-source mixing | block Salesforce in report generation | policy breach | M |
| **R-CONNECT-17** | **P1** | Residency policy engine must pin tenant data to an allowed region and deny unsupported connector flows | EU tenant test with cross-region storage attempt | contractual breach | L |
| **R-CONNECT-18** | **P1** | Slack private visibility must require per-user auth on top of org install | DM/private channel access test | ACL leak in chat | M |
| **R-CONNECT-19** | **P1** | Notion must be labelled `limited-trust` unless user-relative access checks are implemented | admin UI and retrieval audit | overclaiming enterprise ACL parity | S |
| **R-CONNECT-20** | **P1** | SharePoint `Sites.Selected` mode should be supported for tighter enterprise scopes | site-scoped install and sync test | excessive Microsoft scope demand | L |
| **R-CONNECT-21** | **P1** | Freshness SLOs must be explicit per connector and visible in admin UI | admin sees target and actual lag | stale-content disputes | S |
| **R-CONNECT-22** | **P2** | Connector cost attribution must report ingestion, storage, embedding and retrieval costs per tenant per month | billing reconciliation test | margin blindness | M |
| **R-CONNECT-23** | **P2** | Custom DMS connector SDK/contract must exist before enterprise GA | onboard one pilot DMS source | blocked deals on "our DMS" objection | L |
| **R-CONNECT-24** | **P2** | Roadmap connectors must support demand capture but never appear as available in chat add-file menus | UX test for unsupported connector | ghost-capability distrust | S |

---

## Requirements inventory (flat list)

| ID | Priority | One-liner |
| --- | --- | --- |
| R-CONNECT-1 | P0 | Chat + Settings share the same OAuth backend (no chat-only placeholder) |
| R-CONNECT-2 | P0 | Per-instance trust mode: indexed / federated / limited-trust / disabled |
| R-CONNECT-3 | P0 | Least-privilege scopes; admin scopes require written justification + UI disclosure |
| R-CONNECT-4 | P0 | OIDC + SAML SSO for enterprise |
| R-CONNECT-5 | P0 | SCIM 2.0 user + group provisioning |
| R-CONNECT-6 | P0 | Every indexed chunk carries source principals + version metadata |
| R-CONNECT-7 | P0 | Retrieval filters by principals before reranking/synthesis |
| R-CONNECT-8 | P0 | No reliable ACL → federated/manual only (no indexed mode) |
| R-CONNECT-9 | P0 | Disconnect immediately stops sync + purges within 30 days |
| R-CONNECT-10 | P0 | Purge deletes embeddings, caches, extracted text, derivative indexes |
| R-CONNECT-11 | P0 | Admin sees requested / granted / last-used scopes |
| R-CONNECT-12 | P0 | Kill switch disables connector family tenant-wide immediately |
| R-CONNECT-13 | P0 | Sync lag / error rate / rate-limit headroom published per connector |
| R-CONNECT-14 | P0 | Post-connect validation = ≥ 5 sample items + retention/residency shown |
| R-CONNECT-15 | P1 | Deduplication across mail-attachment vs file sources → one logical entity |
| R-CONNECT-16 | P1 | DLP policies: per-source bans on deep research / export / cross-source mixing |
| R-CONNECT-17 | P1 | Residency engine pins tenant data to region; denies cross-region flows |
| R-CONNECT-18 | P1 | Slack private visibility requires per-user auth on top of org install |
| R-CONNECT-19 | P1 | Notion = `limited-trust` unless user-relative access checks built |
| R-CONNECT-20 | P1 | SharePoint `Sites.Selected` mode supported |
| R-CONNECT-21 | P1 | Freshness SLOs explicit per connector + visible in admin UI |
| R-CONNECT-22 | P2 | Cost attribution per tenant per connector per month |
| R-CONNECT-23 | P2 | Custom DMS connector SDK/contract before enterprise GA |
| R-CONNECT-24 | P2 | Roadmap connectors support demand capture but never appear in chat add-file menus |

**Totals:** 24 requirements — 14 × P0, 7 × P1, 3 × P2.

---

## ID reconciliation with the earlier research doc

The earlier `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` contained 8 high-level R-CONNECT items. They are **subsumed** by this detailed document. Mapping:

| Old ID (Artifact/Connect/ROI/Onboard doc) | Old one-liner | Resolves to (this doc) | Notes |
| --- | --- | --- | --- |
| R-CONNECT-1 (P0) | Indexed vs federated connector modes, explicit per source | **R-CONNECT-2 + R-CONNECT-8** | Split: trust-mode declaration + mandatory federated/manual fallback when ACL unreliable |
| R-CONNECT-2 (P0) | OAuth 2.1 + PKCE, least-privilege scopes, no implicit grant | **R-CONNECT-1 + R-CONNECT-3** | Split: unified OAuth backend (chat + Settings) + least-privilege + admin-scope justification |
| R-CONNECT-3 (P0) | SSO (SAML/OIDC) + SCIM for enterprise identity | **R-CONNECT-4 + R-CONNECT-5** | Split: SSO (OIDC + SAML) + SCIM 2.0 with group sync |
| R-CONNECT-4 (P0) | Explicit per-source freshness SLA + webhooks/delta | **R-CONNECT-13 + R-CONNECT-21** | Split: runtime metrics published + target SLO visible in admin UI |
| R-CONNECT-5 (P0) | ACL import, query-time enforcement, drift detection, deny > allow | **R-CONNECT-6 + R-CONNECT-7 + R-CONNECT-18 + R-CONNECT-19** | Split: chunk-level principals + query-time filter + Slack mixed-mode + Notion limited-trust |
| R-CONNECT-6 (P0) | Disconnect = purge (cache + embeddings + audit evidence) | **R-CONNECT-9 + R-CONNECT-10** | Split: stop + schedule + 30-day purge + explicit deletion of embeddings/caches/derivative indexes |
| R-CONNECT-7 (P1) | Honest UX — connector state taxonomy + post-connect validation | **R-CONNECT-2 + R-CONNECT-14 + R-CONNECT-24** | Split: trust-mode taxonomy + 5-sample validation + roadmap UX rules |
| R-CONNECT-8 (P1) | Admin governance surface (inventory, scopes, lag, errors, residency, DLP, cost) | **R-CONNECT-11 + R-CONNECT-12 + R-CONNECT-13 + R-CONNECT-16 + R-CONNECT-17 + R-CONNECT-22** | Split: scope audit + kill switch + health + DLP + residency + cost attribution |

**New rows with no antecedent in the earlier doc:**
- R-CONNECT-15 (cross-source deduplication, canonical entity graph)
- R-CONNECT-20 (SharePoint `Sites.Selected` scope support)
- R-CONNECT-23 (Custom DMS connector SDK/contract for enterprise GA)

At plan-action time the earlier 8 rows close; this doc's 24 rows become the canonical ticket seeds.

---

## Cross-document linkage

- **Reasoning (`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`):**
  - Every connector becomes a `ScopeSource` in the Reasoning scope resolver (R-REASON-7). Precedence: explicit attachment > workspace canonical > system record > org memory > approved web > model prior.
  - `PERMISSION_DENIED` at retrieval time (R-CONNECT-7) must emit `reasoning.permission_denied` event (R-REASON-19) and downgrade response to `insufficient_evidence` per R-REASON-12.
  - Freshness SLO metrics (R-CONNECT-21) feed the Reasoning trust bundle `evidence.sources[].freshness_at_use` (R-REASON-16).
  - Rate-limit headroom (R-CONNECT-13) must respect the budget estimator from R-REASON-4.

- **Feedback / Learning (`DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md`):**
  - Disconnect-purge (R-CONNECT-9/10) must cascade into derived learned memory objects (R-LEARN-5) and learned patterns built from that connector's evidence.
  - Anonymization gate for platform learning (R-LEARN-7) requires tenant-unique strings from connectors be suppressed — the principal graph from R-CONNECT-6 tells us what is tenant-unique.
  - SAR export (R-LEARN-6) must include which connector sourced which piece of memory.

- **Agentic Chat / Runtime (`DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_2026-04-18.md`):**
  - Every write-capable connector is a tool in `AgentDefinitionV1` (R-AGENT-1), with tool scope explicit per severity class (R-AGENT-9).
  - Any mutation back into a source system (future state) flows through `ModuleMutationGatewayV1` (R-AGENT-6), carries `DiffPreviewV1` (R-AGENT-8) and requires approval checkpoint.
  - Connector-originated incidents (policy blocks, scope denials) generate `AgentIncidentV1` (R-AGENT-17).
  - Kill switch (R-CONNECT-12) must cancel live runs using that connector and flag the `RunLedger` (R-AGENT-11) as `aborted_by_connector_revocation`.

- **Artifact (`DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` §Artifact):**
  - Artifact evidence refs (R-ARTIFACT-3) point to source versions from connectors; disconnect must handle the "evidence now unavailable" state explicitly.
  - Content preprocessing per type (this doc §Data ingestion) feeds Artifact canonical content schemas (R-ARTIFACT-2) for email / doc / sheet / slide / ticket / chat / meeting.

- **ROI (`DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md`):**
  - KPI `sourceSystem` (R-OUTCOME-4) resolves to a connector; `freshnessDate` on KpiMeasurement derives from R-CONNECT-21 freshness SLO.
  - Measurement provenance (R-OUTCOME-5) must stamp `sourceType` from the connector trust mode (R-CONNECT-2).
  - **Critical:** R-CONNECT-10 purge **must NOT** purge historical KpiMeasurement records already signed — SOX-defensible retention (R-OUTCOME-3 / R-OUTCOME-12) overrides connector purge. Connector purge deletes raw blobs + embeddings + extracted text, but measurement records with provenance remain pinned.
  - ACL (R-CONNECT-7) governs who can see initiative-level financial detail inside the tenant.

- **Onboarding (same file §Onboarding):**
  - CISO persona aha-moment (R-ONBOARD-6) = the Admin Governance Ledger (this doc §Admin surface) shown in-session during onboarding.
  - Honest capability taxonomy (this doc §UX) is the substrate for "no ghost capabilities" in R-ONBOARD-1/3.

---

## What this document is NOT

- Not a ticket backlog (the next pass converts `R-CONNECT-*` into tickets, flags, tests, CI invariants).
- Not a vendor selection doc — connector-specific implementation choices (e.g. Microsoft Graph vs Graph Data Connect, Slack Events API vs RTS) are implementation decisions; contracts stay the same.
- Not a legal/compliance sign-off — compliance matrix above is a product-control matrix, not legal advice.
- Not a replacement for existing dev plans (`TRUST_*`, `ADMIN_*`) — it is the integration substrate those plans assume.

## Next step

Turn this document into the canonical Enterprise Integrations implementation plan alongside Reasoning / Feedback / Agent Runtime / Artifact / ROI / Onboarding:
1. **Close** the 8 `R-CONNECT-*` rows from the earlier Artifact/Connectors/ROI/Onboarding doc (see mapping table above) — do not re-ticket them.
2. Assign each `R-CONNECT-*` from *this* doc a ticket ID and block (likely dedicated `connect` block in `ChatV9Block` union, or a dedicated `ChatV10Block`).
3. Register feature flags per requirement (`ff.connect_oauth_unified`, `ff.connect_trust_mode`, `ff.connect_least_privilege`, `ff.connect_sso_oidc_saml`, `ff.connect_scim_group_sync`, `ff.connect_chunk_principals`, `ff.connect_query_acl_filter`, `ff.connect_disconnect_purge`, `ff.connect_admin_scope_audit`, `ff.connect_kill_switch`, `ff.connect_health_dashboard`, `ff.connect_post_validation`, `ff.connect_dedup`, `ff.connect_dlp_policy`, `ff.connect_residency_engine`, `ff.connect_slack_private_per_user_auth`, `ff.connect_notion_limited_trust`, `ff.connect_sharepoint_selected_sites`, `ff.connect_freshness_slo_surface`, `ff.connect_cost_attribution`, `ff.connect_custom_dms_sdk`, `ff.connect_roadmap_demand_capture`, etc.).
4. Draft `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy; split by sub-surface (Auth / Identity / Ingestion / ACL / Admin / UX / per-connector).
5. Extend `CHAT_V9_TELEMETRY_CONTRACT` with `connect.*` event families (`connect.connected`, `connect.scope_granted`, `connect.sync_succeeded`, `connect.sync_failed`, `connect.permission_drift_detected`, `connect.acl_filter_rejected`, `connect.disconnect_initiated`, `connect.purge_completed`, `connect.kill_switch_triggered`, `connect.validation_failed`, `connect.dlp_block`, `connect.residency_block`).
6. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-CONNECT-*` → flag in registry,
   - every `connect.*` event → section in telemetry contract,
   - every connector in the catalogue (P0 + P1 + P2) has a registered `connector_id`, trust-mode default, auth posture, and region-compatibility entry,
   - every trust-mode value (`indexed`, `federated`, `limited-trust`, `disabled`) used in code matches the documented taxonomy,
   - every honest-capability state (`supported_in_chat`, `supported_in_settings_only`, `supported_but_limited_trust`, `roadmap`, `unsupported`) is bijective with the UI taxonomy.
