# My Work → Notebook — owner product review

Date: `2026-08-22`  
Visual-review runtime badge: `75bed3bb6485`  
Route: `/my-work?notebook=:id`  
Status: `NOTEBOOK_VISUAL_PRODUCT_REVIEW_COMPLETE / REMEDIATION_REQUIRED / FUNCTIONAL_AUDIT_NOT_RUN / OWNER_VERDICT_PENDING`

## Evidence boundary and positive result

Piotr's first impression, notebook creation and note creation are strongly positive. The editor direction should be preserved. This walkthrough used the same non-qualified Chat-oriented fixture as the Ideas review, so evidence is visual/product evidence only: it does not prove API wiring, autosave, search completeness, context propagation, permissions or conversion readback.

Notebook's target role is the private, team and project knowledge bank—not merely a single-note editor. The following six tasks consolidate all observations without duplicating them.

## Consolidated tasks

### MYW-NBK-CORE-001 — Final right rail: document metadata and living context

**Priority:** `P0`

Replace the current overlapping `Tools / Work / Context` model with two purposeful views:

- `Work` becomes the document record: owner, private/shared/protected visibility, tags, maturity/status, verification state, review cadence/date, modified date, word count and other true document properties.
- `Context` remains the living relationship view: backlinks, linked outputs, initiatives, tasks, decisions and every other supported contextual artifact.

Move the current header metadata and controls into their correct rail sections where appropriate: saved state, ownership/privacy, verification, review cadence, Sources, Review, Convert, Initiatives, Topic and Mini Outline. Keep the document surface focused on content.

Remove the separate `Tools` view unless a capability audit proves a unique function that cannot live in the editor context menu, kebab, Work or Context. Do not lose functionality during consolidation.

**Acceptance:** one responsive Liquid Glass rail stays inside the editor workspace; metadata has explicit API/save/error/readback contracts; Context and Work have distinct purposes; opening/closing preserves editor position and selection; light/dark, keyboard and narrow desktop/tablet behavior are verified.

### MYW-NBK-CORE-002 — Native block insertion and contextual editing

**Priority:** `P0`

Make component insertion native to the document:

- Right-click opens a context-sensitive menu at the selected block/caret.
- A visible block picker provides the same canonical action registry for keyboard/touch discovery.
- The kebab and context menu may expose the same action, but must never drift in availability, label or permission.
- Users can insert, describe/configure, move, duplicate and delete supported blocks; each block can invoke `Edit with AI`/`Improve with Teresa` with a preview and explicit apply/reject.
- AI never silently overwrites content. Preserve undo, versioning, autosave receipt and conflict/error recovery.
- Provide keyboard equivalent (`Context Menu`/Shift+F10 or documented shortcut), focus return, accessible names and correct disabled states.

The block catalogue must be audited before deciding the final set; current Callout, Warning, Toggle, Table and Divider are inputs, not automatically approved scope.

### MYW-NBK-003 — Living context updates without silent rewriting

**Priority:** `P1`

Context must actively help keep a note current. When linked context changes, the note should show what changed, which sections may be stale and a sourced proposal to update them. The user sees a diff and explicitly applies, partially applies or rejects it. Rejection and dismissal persist; accepted changes create normal note history. Define freshness timestamps, source lineage, permissions, removed-source behavior and conflict handling.

### MYW-NBK-004 — Complete artifact graph and global notebook search

**Priority:** `P1`

Audit Context completeness beyond Initiatives, Tasks and Decisions. Include every product-relevant artifact type where authorized—notes/notebooks, ideas, reports, assessments, materials/sources, meetings, outputs and linked project knowledge—and explicitly document exclusions.

Add fast search across all accessible notebooks and notes. Search title, body, tags, topics, people/project metadata and linked artifacts; provide type/notebook/status/date filters, highlighted matches, keyboard navigation, empty/error states and tenant/visibility enforcement. The current list filters (`All`, `Pinned`, `Recent`, `To review`, `Fresh`, `Orphaned`) complement search; they do not replace it.

### MYW-NBK-005 — Resolve quick capture: “Drop a thought or a link”

**Priority:** `P2 / AUDIT_FIRST`

Do not remove or retain this control by guesswork. Establish its intended contract and test it. If retained, it should quickly accept text or a URL, create an inbox note/capture with source metadata, acknowledge success, avoid duplicates and allow later classification/move into a notebook. Clarify paste/Enter behavior, malformed links, permission, offline/error and cold readback. If it offers no unique value after search/new-note/context-menu changes, remove it cleanly.

### MYW-NBK-006 — Simplify the local toolbar and verify every action

**Priority:** `P1`

In the local top-right group retain only:

- the kebab,
- the button opening the `Work / Context` rail.

Remove the dedicated AI icon because Teresa owns AI interaction. Audit the remaining two icons before removal; migrate any unique action into the kebab, document metadata or context menu. Then verify every retained toolbar, kebab, formatting, export, share, conversion, block, AI and context action for handler, API/local contract, authorization, progress/success/error receipt, persistence, undo, duplicate protection and cold refresh. An enabled control without working behavior is a defect.

## Required integrator journeys

1. Create notebook and notes from blank/template/quick capture; edit and cold reopen.
2. Insert and manipulate every retained block by picker, right click and keyboard.
3. Change document metadata and verify API/database readback and permissions.
4. Link every supported artifact type; verify visibility and foreign-tenant denial.
5. Change linked context and exercise propose/diff/apply/partial/reject/stale/conflict flows.
6. Search title/body/tag/topic/link across multiple notebooks and access levels.
7. Exercise export/share/conversions and Teresa edits with no silent mutation.
8. Replay responsive, light/dark, PL/EN, keyboard/a11y with clean console/network.

## Gate decision

Notebook visual/product discovery is complete. The core editor/create experience is positively received, but implementation is not accepted. Start with `MYW-NBK-CORE-001` and `MYW-NBK-CORE-002`, then complete context/search and toolbar/integration verification. No additional owner visual exploration is required before these designs are prepared.

Evidence: [evidence/notebook-owner-review-2026-08-22/INDEX.md](evidence/notebook-owner-review-2026-08-22/INDEX.md)
