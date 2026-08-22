# Visual standard — card-by-card execution and evidence register

Authority: derived execution packet for `XMOD-OWN-006` and `XMOD-OWN-007`. It is
not proof that a screen was inspected or corrected. Every row starts fail-closed
as `NOT_INSPECTED` and requires all `CMP-01–12` checks to be reconciled.

## A. Non-negotiable component contract

| Area | Required standard |
|---|---|
| Typography | Use only the semantic scale in `XMOD-OWN-003`; one H1; ordered headings; body `14/20`; caption never below `12/16` |
| Text colour | Canonical primary, secondary/muted, disabled and inverse tokens; never lower contrast to simulate hierarchy |
| State colour | One token family for focus, info, success, warning, error and destructive; red never indicates ordinary selection |
| Backgrounds | Canonical page, card, nested surface, selected, disabled and overlay surfaces; no module palette |
| Borders | Canonical neutral, focus, validation and destructive borders; consistent thickness, radius and divider treatment by component role |
| Elevation | Shadows only for overlays, menus and components whose layering requires them; ordinary cards do not invent elevation |
| Spacing | Shared spacing scale; identical card padding, section gaps, field gaps and action alignment for equivalent components |
| Controls | Shared heights and states for buttons, inputs, selects, textareas, toggles, checks, segmented controls and icon buttons |
| Data views | Shared table header, row, hover, selected, empty, loading, pagination and responsive-overflow treatments |
| Feedback | Shared banners/toasts/inline messages; persistent mutation result; no colour-only meaning |

### Mandatory component checks applied to every screen row

| Check | Required inspection and repair output |
|---|---|
| `CMP-01` | Container, grid, gutters, alignment, spacing and overflow; record every local layout override |
| `CMP-02` | H1/H2/H3, card titles, body, labels, helper, caption, breadcrumb, control and KPI typography |
| `CMP-03` | Primary, muted, disabled, inverse and link text colours plus contrast result |
| `CMP-04` | Page, card, nested, selected, disabled, overlay, table and input backgrounds |
| `CMP-05` | Borders, dividers, thickness, radii, focus/error rings, elevation and shadows |
| `CMP-06` | Every select/dropdown: trigger, chevron, popup, option, selected, hover, focus, disabled, validation, keyboard and overflow |
| `CMP-07` | Inputs, textareas, toggles, checkboxes, radios, segmented controls, date/number controls and icon buttons |
| `CMP-08` | Cards, accordions, banners, tables, lists, dialogs, drawers, tooltips, badges and empty/loading skeletons |
| `CMP-09` | Primary, secondary and destructive actions plus clean/dirty/saving/saved/error feedback |
| `CMP-10` | Default, hover, active, focus-visible, disabled, loading, empty, validation, error, success, stale and unauthorized states as applicable |
| `CMP-11` | Desktop, compact/mobile, 200% zoom, PL/EN expansion and no unintended horizontal scrolling |
| `CMP-12` | Keyboard order, accessible names/roles/states, contrast, non-colour meaning and reduced-motion behavior |

For a failure, the row's linked repair register must record: route, role, viewport,
component instance/locator, failed check ID, current component/token/value, target
component/token, affected states, repair owner, before/after artifacts and result.
`NOT_APPLICABLE` requires a reason; an empty cell is never a pass.

## B. Required audit procedure for every row

For each screen: inventory all visible component instances; map each to canonical
tokens/components; record exceptions; correct them; replay `default`, `hover`,
`focus-visible`, `disabled`, `loading`, `empty`, `validation`, `error` and `success`
where applicable; capture before/after at desktop and compact width; verify PL/EN,
keyboard, contrast and 200% zoom; link evidence and reviewer result in the row.

Status vocabulary: `NOT_INSPECTED`, `IN_REVIEW`, `FAIL`, `PASS_WITH_LIMITATIONS`,
`PASS`. `PASS` requires linked evidence on the exact candidate SHA.

## C. Organization screen checklist

| Audit ID | Module | Child screen | Required checks | Review status | Evidence/result |
|---|---|---|---|---|---|
| `VIS-ORG-001` | Organization Profile | Identity & Scale | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-002` | Organization Profile | Operating Model | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-003` | Organization Profile | Market Position | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-004` | Organization Profile | Technology, Culture & Constraints | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-005` | Goals & Expectations | Strategic Intent | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-006` | Goals & Expectations | Success Measures | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-007` | Goals & Expectations | Scope & Boundaries | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-008` | Goals & Expectations | Stakeholder Expectations | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-009` | Challenges | Declared Challenges | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-010` | Challenges | Root Causes | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-011` | Challenges | Goal Blockers | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-012` | Challenges | Evidence | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-013` | Strategic Synthesis | Risks & Opportunities | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-014` | Strategic Synthesis | Transformation Scenarios | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-015` | Strategic Synthesis | Recommendation | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-016` | Strategic Synthesis | Executive Brief | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-017` | Sources & Knowledge | Files | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-018` | Sources & Knowledge | Claims & Sources | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-019` | Sources & Knowledge | Source Conflicts | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-020` | Sources & Knowledge | Knowledge Graph | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-021` | Readiness & Governance | Readiness Summary | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-022` | Readiness & Governance | Gaps & Freshness | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-023` | Readiness & Governance | Decisions & Conflicts | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ORG-024` | Readiness & Governance | Versions & Publication | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |

## D. Admin screen checklist

| Audit ID | Domain | Child screen | Required checks | Review status | Evidence/result |
|---|---|---|---|---|---|
| `VIS-ADM-001` | Team & Access | Members | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-002` | Team & Access | Invitations | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-003` | Team & Access | Roles & Permissions | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-004` | Team & Access | Teams | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-005` | Team & Access | Guests & External Access | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-006` | Team & Access | Access Requests | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-007` | Team & Access | Access Reviews | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-008` | Team & Access | Ownership | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-009` | Billing & Plans | Overview | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-010` | Billing & Plans | Plan & Limits | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-011` | Billing & Plans | Usage & Costs | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-012` | Billing & Plans | Payment Methods | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-013` | Billing & Plans | Invoices | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-014` | Billing & Plans | Seats & Licences | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-015` | Billing & Plans | Billing Details | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-016` | Billing & Plans | Budgets & Alerts | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-017` | Billing & Plans | Plan Change History | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-018` | AI Control | Policy & Autonomy | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-019` | AI Control | Personas | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-020` | AI Control | Models & Providers | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-021` | AI Control | Limits & Budgets | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-022` | AI Control | Data & Privacy | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-023` | AI Control | Quality Evaluations | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-024` | AI Control | AI Incidents | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-025` | AI Control | Configuration Versions | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-026` | AI Control | AI Operations | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-027` | AI Control | AI Audit | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-028` | Security & Identity | Security Policy | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-029` | Security & Identity | SSO | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-030` | Security & Identity | SCIM & Lifecycle | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-031` | Security & Identity | Sessions | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-032` | Security & Identity | API Access | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-033` | Security & Identity | Domains | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-034` | Security & Identity | Service Accounts | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-035` | Security & Identity | Security Alerts | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-036` | Security & Identity | Break-glass | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-037` | Security & Identity | Risk Summary | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-038` | Audit Log | Events | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-039` | Audit Log | High-risk Changes | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-040` | Audit Log | Compliance Evidence | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-041` | Audit Log | Retention & Export | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-042` | Audit Log | Integrity | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-043` | Audit Log | Legal Hold | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-044` | Audit Log | Export History | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-045` | Admin Command Center | Overview | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-046` | Admin Command Center | Attention Queue | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-047` | Admin Command Center | Compliance Posture | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-048` | Admin Command Center | Cost & Capacity | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-049` | System Health | Service Status | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-050` | System Health | Dependencies | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-051` | System Health | Diagnostics | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-052` | System Health | Incident History | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-053` | System Health | Queues & Jobs | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-054` | System Health | SLA/SLO | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-ADM-055` | System Health | Platform Operations | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |

## E. Settings screen checklist

| Audit ID | Module | Child screen | Required checks | Review status | Evidence/result |
|---|---|---|---|---|---|
| `VIS-SET-001` | My Settings | Profile | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-002` | My Settings | Account | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-003` | My Settings | Sessions | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-004` | Work Preferences | Dashboard | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-005` | Work Preferences | Focus & Snooze | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-006` | Work Preferences | Task Display | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-007` | Work Preferences | Automation Defaults | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-008` | Work Preferences | Time Tracking | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-009` | Regional & Language | Language | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-010` | Regional & Language | Region & Formats | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-011` | Regional & Language | Time Zone | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-012` | Regional & Language | Week & Calendar | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-013` | AI & Automation | Personal AI Preferences | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-014` | AI & Automation | Suggestions | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-015` | AI & Automation | Personal Automations | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-016` | Notifications | Channels | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-017` | Notifications | Event Preferences | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-018` | Notifications | Quiet Hours | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-019` | Notifications | Digest | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-020` | Security & Privacy | Personal Security | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-021` | Security & Privacy | Connected Sessions | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-022` | Security & Privacy | Privacy Choices | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-023` | Security & Privacy | Data Export | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-024` | Integrations | Connected Apps | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-025` | Integrations | Personal Connections | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-026` | Integrations | Authorization History | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-027` | Appearance & Advanced | Appearance | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-028` | Appearance & Advanced | Accessibility | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-029` | Appearance & Advanced | Keyboard Shortcuts | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |
| `VIS-SET-030` | Appearance & Advanced | Advanced | `CMP-01–12` | `NOT_INSPECTED` | `EVIDENCE_MISSING` |

## F. Completion counters

- Canonical child screens in scope: `109` (`24 Organization + 55 Admin + 30 Settings`)
- Inspected: `0 / 109`
- Component check results completed: `0 / 1308` (`109 × 12`)
- Passed with exact-SHA evidence: `0 / 109`
- Current result: `NOT_EXECUTED / EVIDENCE_MISSING`
