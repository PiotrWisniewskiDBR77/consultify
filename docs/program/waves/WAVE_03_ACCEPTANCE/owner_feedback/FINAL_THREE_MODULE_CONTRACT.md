# Wave 3 — final documentation contract for Organization, Admin and Settings

Date: `2026-08-21`

Documentation status: `COMPLETE_EXPERT_SPEC / OWNER_CONFIRMATION_REQUIRED`

Runtime replay baseline: `http://127.0.0.1:3957`

Candidate SHA: `97e8ab0116d95ed3db0c3c7fa53b4f0e0ed09717`

This is a documentation deliverable only. It does not assert that the candidate
implements the specification and does not record owner acceptance.

## 1. Binding hierarchy

All three modules use one information architecture:

1. global application navigation selects `Organization`, `Admin` or `Settings`;
2. the domain opens with a fixed left menu;
3. the menu contains expandable modules;
4. modules expose child screens;
5. the content area renders exactly one child screen;
6. horizontal tabs are allowed only for alternative views of one object and may
   never duplicate the left-menu hierarchy.

## 2. Shared screen contract

Every screen contains, in order:

1. breadcrumb: domain → module → screen;
2. title and one-sentence purpose;
3. optional compact status/readiness summary;
4. one primary action and only necessary secondary actions;
5. working content split into bounded section cards;
6. contextual provenance, permissions or audit detail when relevant;
7. persistent result feedback after every mutation.

The breadcrumb occupies one fixed top-left slot and aligns with the title and
content. On editable screens, the single authoritative `Save Changes` action
occupies the fixed right-side slot of the same screen-header line. Semantically
different actions retain that slot but use a truthful verb.

Required states: `LOADING`, `EMPTY`, `PARTIAL`, `READY`, `STALE`, `CONFLICT`,
`ERROR`, `UNAUTHORIZED`. Record lifecycle (`DRAFT`, `REVIEW`, `APPROVED`,
`PUBLISHED`, `ARCHIVED`) is a separate dimension and must not be mixed with
request/system state.

## 3. Canonical ownership

| Object | Canonical module | Rule |
|---|---|---|
| Business facts, goals, challenges, sources, readiness | Organization | Admin and Settings may link but not duplicate editing |
| Personal preferences, notifications, locale, personal privacy | Settings | Never counted as Organization readiness |
| Organization policies, roles, security, billing, AI governance | Admin | Personal Settings may show effective values read-only |
| Knowledge claims and graph | Organization → Sources & Knowledge | Contextual deep-links always return to the same canonical object |
| Runtime/platform operations | Admin → System Health, platform role only | Customer Admin receives diagnostics and approved safe actions only |

## 4. Shared interaction and visual contract

- Reuse the actual Settings shell and components; do not visually approximate them.
- Ordinary screens use one shared working container: `width: 100%` and proposed
  desktop `max-width: 1280px` after sidebars. Header, banners, actions and cards align
  to its edges. Only named `WIDE_DATA` canvases may exceed it; this never changes
  header/action alignment. See `CROSS_MODULE/OWNER_FEEDBACK_REGISTER.md`.
- Use existing application design tokens by semantic role. Exact values must come
  from component/token inventory tied to the candidate SHA, not from screenshot
  colour sampling.
- Typography uses the shared semantic scale defined by `XMOD-OWN-003` in
  `CROSS_MODULE/OWNER_FEEDBACK_REGISTER.md`; module-specific or screen-local font
  sizes are prohibited.
- Editable Organization, Admin and Settings screens use an explicit, canonical
  `Save Changes` header action with visible clean/dirty/saving/saved/error state.
  Any background draft preservation is supplementary and may not impersonate a
  confirmed save; success requires server acknowledgement and readback. Sensitive
  Admin mutations additionally require explicit action and confirmation.
- Destructive Admin actions require target, impact, reason, re-authentication where
  sensitive, explicit confirmation, result, recovery statement and audit event.
- Desktop keeps the domain menu visible. Tablet uses a persistent/drawer hybrid.
  Mobile uses a domain selector, one-column cards and sticky primary action only
  where loss of context would otherwise occur.
- WCAG 2.2 AA: full keyboard operation, visible focus, semantic labels and errors,
  contrast, zoom 200%, reduced motion and no colour-only meaning.
- Polish and English labels must tolerate at least 30% expansion without clipping.

## 5. Evidence required for acceptance

Visual acceptance requires exact-SHA screenshots at agreed desktop, tablet and
mobile viewports. Functional mutation acceptance additionally requires:

1. authorized UI action and receipt;
2. unauthorized-role negative result;
3. applicable API/database/provider readback;
4. audit event;
5. persistence after refresh and cold signed session;
6. explicit owner outcome.

Smoke tests, static PASS labels and screenshots alone are not owner acceptance.

## 6. Module specifications

- [`01_ORGANIZATION/FINAL_IMPLEMENTATION_SPEC.md`](01_ORGANIZATION/FINAL_IMPLEMENTATION_SPEC.md)
- [`14_ADMIN/FINAL_IMPLEMENTATION_SPEC.md`](14_ADMIN/FINAL_IMPLEMENTATION_SPEC.md)
- [`13_SETTINGS/FINAL_IMPLEMENTATION_SPEC.md`](13_SETTINGS/FINAL_IMPLEMENTATION_SPEC.md)

## 7. Owner gate

The specification is complete as an expert-authored design contract. It becomes
owner-approved only after Piotr explicitly confirms the three module maps and the
five decisions listed in `OWNER_CONFIRMATION_SHEET.md`.
