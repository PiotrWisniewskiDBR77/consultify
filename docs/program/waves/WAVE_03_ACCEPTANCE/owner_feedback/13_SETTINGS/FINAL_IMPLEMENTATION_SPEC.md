# Settings — final implementation specification

Status: `COMPLETE_EXPERT_SPEC / EXACT_SHA_REPLAY_REQUIRED`

## Purpose and ownership

Settings owns personal preferences and is the canonical navigation/component shell
for Organization and Admin. It does not own organization business facts, tenant-wide
security/billing policy or platform operations.

## Canonical left-menu map

### 1. My Settings

Children: `Profile`, `Account`, `Sessions`. Personal identity, account lifecycle and
the user's own session visibility; organization role changes remain in Admin.

### 2. Work Preferences

Children: `Dashboard`, `Focus & Snooze`, `Task Display`, `Automation Defaults`,
`Time Tracking`. Controls affect only the signed-in user unless explicitly labelled.

### 3. Regional & Language

Children: `Language`, `Region & Formats`, `Time Zone`, `Week & Calendar`.
Formatting preview shows the effective result before save.

### 4. AI & Automation

Children: `Personal AI Preferences`, `Suggestions`, `Personal Automations`.
The screen shows effective organization policy read-only and prevents personal
choices from exceeding Admin policy.

### 5. Notifications

Children: `Channels`, `Event Preferences`, `Quiet Hours`, `Digest`.
Permission/connection state of channels is explicit; test notification is available
only where delivery can be confirmed.

### 6. Security & Privacy

Children: `Personal Security`, `Connected Sessions`, `Privacy Choices`, `Data Export`.
Tenant-wide MFA/SSO/retention remains in Admin and is linked read-only where useful.

### 7. Integrations

Children: `Connected Apps`, `Personal Connections`, `Authorization History`.
Organization-wide connectors live in Admin/AI governance. Tokens and secrets are
never redisplayed.

### 8. Appearance & Advanced

Children: `Appearance`, `Accessibility`, `Keyboard Shortcuts`, `Advanced`.
Advanced contains reversible user-level choices only and has reset-to-default with
clear scope.

Billing does not appear as a personal Settings editor when it is organization-owned;
it may provide a read-only plan link to Admin for authorized users.

## Screen anatomy and component contract

Every child screen uses the existing Settings implementation for domain sidebar,
module/child rows, breadcrumb, section card, form row, controls, alerts, dialogs,
skeletons and empty states. Exact component names, variants and semantic tokens are
bound through candidate-SHA inventory; values must not be copied visually from a
screenshot or reimplemented locally.

Each screen contains: breadcrumb; title/purpose; optional effective-policy notice;
bounded section cards; one consistent save model; and saved/error/readback status.

## Save policy

- the latest explicit owner requirement `XMOD-OWN-005` supersedes the earlier
  mixed autosave proposal: every editable screen exposes one authoritative
  `Save Changes` action in the canonical header slot;
- reversible local draft preservation may protect input between interactions, but
  it is not a committed save and must never show a server-confirmed success state;
- explicit save validates the complete changed set and communicates
  `CLEAN`, `DIRTY`, `SAVING`, `SAVED` and `ERROR`;
- confirmation: account, privacy, session revocation, disconnect and reset actions;
- organization-enforced values are read-only and explain the governing Admin policy.

## Responsive and accessibility contract

Desktop keeps the left menu. Tablet uses the existing Settings drawer behavior.
Mobile presents domain/module/screen selection above a single-column content flow.
Tables become accessible lists/cards where comparison is not essential.

WCAG 2.2 AA requirements include keyboard completion, visible focus, semantic
landmarks/headings, `aria-current`, `aria-expanded`, programmatic labels/errors,
announced async status, modal focus management, zoom/reflow, reduced motion and no
colour-only meaning. PL/EN content must not clip or obscure actions.

## Required states

Every screen supports `LOADING`, `EMPTY`, `PARTIAL`, `READY`, `DIRTY`, `SAVING`,
`SAVED_READBACK_CONFIRMED`, `STALE`, `ERROR`, `UNAUTHORIZED`,
`DISABLED_BY_ORGANIZATION_POLICY` and `UNKNOWN` where effective state cannot be read.

## Acceptance suite

| AC | Expected result | Required evidence |
|---|---|---|
| `SET-FINAL-AC-001` | Every Settings function has one canonical module and child screen | exact-SHA route/menu inventory |
| `SET-FINAL-AC-002` | Active module/screen survives deep-link, refresh and browser history | navigation replay |
| `SET-FINAL-AC-003` | All three domains reuse verified Settings shell/components/tokens | candidate code/component inventory + visual comparison |
| `SET-FINAL-AC-004` | Explicit header save never claims success before readback or loses failed edits; supplementary draft protection is never presented as committed | positive/error/cold-session evidence |
| `SET-FINAL-AC-005` | Personal preferences cannot override organization policy | UI and direct API negative tests |
| `SET-FINAL-AC-006` | Personal vs organization-wide integrations have distinct canonical locations | role/route inventory and deep-links |
| `SET-FINAL-AC-007` | Security/privacy actions show scope, confirmation, receipt and audit where required | UI + readback + audit evidence |
| `SET-FINAL-AC-008` | Loading/empty/error/stale/unknown states never display false success | controlled fixtures |
| `SET-FINAL-AC-009` | Desktop/tablet/mobile and PL/EN preserve hierarchy and complete flows without basic horizontal scroll | viewport/language evidence |
| `SET-FINAL-AC-010` | Keyboard, focus, zoom, labels, status announcements and contrast meet WCAG 2.2 AA | accessibility evidence |

Settings' previously accepted direction still requires exact-runtime/exact-SHA replay;
the historic screenshot is a reference, not current owner acceptance.
