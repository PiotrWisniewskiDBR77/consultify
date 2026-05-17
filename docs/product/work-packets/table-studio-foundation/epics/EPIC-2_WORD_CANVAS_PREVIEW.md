# EPIC-2 — Word-Canvas Preview Components

**Owner:** Agent C (preview components lead)
**Sprint:** Sprint 3
**Status:** `PLANNED`
**Depends on:** EPIC-1 (US-1.3 ArtifactPreview shape, US-1.5 useKimiArtifactPipeline lane wiring)
**Blocks:** Sprint 6 (validation matrix needs the preview rendered)

## Epic goal

Render the Tabele artifact preview as a **Word-style document canvas** — sectioned, scrollable, with typography hierarchy that matches the Wordy idiom: cover header, KPI strip, schema-as-document-blocks, records-as-table, relations-as-chips, AI rationale section. The canvas is what makes "looks analogous to Word documentation" true. Pure presentational; reads from `preview` shape only; no business logic, no data fetching.

## Acceptance criteria (epic-level)

- AC-2.0.1 `KimiWorkspaceShell.ArtifactPreviewPane` renders a full Word-canvas layout when `preview.type === 'tabele'`.
- AC-2.0.2 Side-by-side screenshot vs Wordy passes Word-idiom parity review (L6.4).
- AC-2.0.3 DBR77 audit clean: zero off-palette colors in new files (L1.4).
- AC-2.0.4 Render time < 100 ms for 25 rows × 10 cols (L8.2).
- AC-2.0.5 Auto-collapse Schema/Relation sections when `tabeleSchemaFields.length ≤ 3` or `tabeleRelations.length === 0`.
- AC-2.0.6 All AI-related action affordances live in shell header right-slot (Menu 3); none in canvas body (L6.3).
- AC-2.0.7 Component tests cover: cover, KPI, schema, records, relations, rationale (L3.3).

## User stories

### US-2.1 — `TabelePreviewLayout` (sectioned scroll container)

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx` (CREATE)

**Layout (top → bottom)**

```
┌─────────────────────────────────────────────────┐
│ COVER HEADER                                    │
│  - Table title (h1, monospace+sans hybrid)      │
│  - Subtitle: "Operational Table" / "Tabela operacyjna"│
│  - Last-updated / autosave dot                  │
├─────────────────────────────────────────────────┤
│ KPI STRIP (4 cards: Rows / Columns / Status / Format)│
├─────────────────────────────────────────────────┤
│ ## Schema  (section header + collapse toggle)   │
│   • TabeleSchemaBlock × N                       │
├─────────────────────────────────────────────────┤
│ ## Records (section header + row count badge)   │
│   - <table> first 25 rows                       │
│   - "Showing 25 of {total}" footer if applicable│
├─────────────────────────────────────────────────┤
│ ## Relations (section header + collapse toggle) │
│   - TabeleRelationChip flex wrap                │
├─────────────────────────────────────────────────┤
│ ## AI Rationale                                 │
│   - TabeleRationaleSection                      │
└─────────────────────────────────────────────────┘
```

**Props**

```typescript
interface TabelePreviewLayoutProps {
  preview: ArtifactPreview & { type: 'tabele' };
  onOpenBuilder?: () => void;       // wired in EPIC-4
  onOpenProposalQueue?: () => void; // wired in EPIC-4
  isPolish: boolean;
}
```

**Acceptance criteria**
- AC-2.1.1 Pure functional component; no side effects, no fetch.
- AC-2.1.2 Section headers use Wordy `text-lg font-semibold` + DBR77 slate tokens.
- AC-2.1.3 Section spacing matches Wordy preview (verified by side-by-side screenshot).
- AC-2.1.4 Auto-collapse logic per AC-2.0.5.
- AC-2.1.5 No AI action button in body (L6.3).
- AC-2.1.6 a11y: every section has `<section aria-labelledby="...">` and visible `<h2 id="...">`.
- AC-2.1.7 i18n: every visible string via `t()`; no hardcoded English/Polish.

**Estimate:** 1 d

---

### US-2.2 — `TabeleSchemaBlock` (Word-paragraph idiom)

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleSchemaBlock.tsx` (CREATE)

**Visual idiom (mimics a Word paragraph with code-fenced field name)**

```
─────────────────────────────────────────
  `field_name`     [text]  ✓ committed
  Optional caption / governance note
─────────────────────────────────────────
```

**Props**

```typescript
interface TabeleSchemaBlockProps {
  field: TabelePreviewSchemaField;
  isPolish: boolean;
  onClickProposal?: (proposalId: string) => void;
}
```

**Acceptance criteria**
- AC-2.2.1 Field name in `font-mono` styling, type as a pill chip (e.g., `text-xs bg-slate-100 dark:bg-navy-800`).
- AC-2.2.2 Governance state pill: `committed` (sky), `proposed` (amber), `rejected` (rose) — DBR77 semantic accents only.
- AC-2.2.3 If `proposalId` set + `onClickProposal` set → click navigates to proposal review.
- AC-2.2.4 Hover surface mirrors Wordy block hover: `hover:bg-slate-50 dark:hover:bg-navy-800/50`.
- AC-2.2.5 No emoji; pure text + lucide icons.

**Estimate:** 0.5 d

---

### US-2.3 — `TabeleRelationChip` with explainability tooltip

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRelationChip.tsx` (CREATE)

**Visual**

```
[ field_name → other_table (12) ]   ⓘ tooltip on hover/focus
```

**Props**

```typescript
interface TabeleRelationChipProps {
  relation: TabelePreviewRelation;
  rationale?: string;             // populated by parent from explainRelation API
  loading?: boolean;
  onLoadRationale?: (relation: TabelePreviewRelation) => void;
}
```

**Acceptance criteria**
- AC-2.3.1 Chip uses sky accent on hover; default monochrome.
- AC-2.3.2 Tooltip uses `@floating-ui/dom` (already in deps) and renders rationale text + cited source list.
- AC-2.3.3 First hover triggers `onLoadRationale` (lazy-load) if `rationale` is undefined.
- AC-2.3.4 If `loading` → tooltip shows `<Loader2 className="animate-spin" />` + i18n loading message.
- AC-2.3.5 ACL-protected fail path: if rationale fetch returns 403 → tooltip shows "Insufficient permissions" message; chip degrades to neutral monochrome.
- AC-2.3.6 a11y: chip is a `<button aria-describedby="tooltip-id">` with keyboard focus + Enter/Space activation.

**Estimate:** 0.75 d

---

### US-2.4 — `TabeleRationaleSection` (AI rationale + governance status)

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRationaleSection.tsx` (CREATE)

**Layout**

```
┌─────────────────────────────────────────────────┐
│ ## AI Rationale                                 │
│ {summary paragraph}                             │
│                                                 │
│ • bullet 1                                      │
│ • bullet 2                                      │
│ • bullet 3                                      │
│                                                 │
│ Cited sources: [src-1] [src-2] [src-3]          │
│                                                 │
│ Proposal status: [pending] (link to queue)      │
└─────────────────────────────────────────────────┘
```

**Props**

```typescript
interface TabeleRationaleSectionProps {
  rationale: TabelePreviewRationale;
  isPolish: boolean;
  onOpenProposalQueue?: () => void;
}
```

**Acceptance criteria**
- AC-2.4.1 Summary text uses Wordy paragraph styling.
- AC-2.4.2 Bullets render with sky bullet point; ≤ 6 bullets visible (overflow → "show more" disclosure).
- AC-2.4.3 Cited sources rendered as muted chips; each chip is a link iff source resolves to known artifact.
- AC-2.4.4 Proposal status pill: `pending` (amber), `approved` (emerald), `rejected` (rose), `none` (slate).
- AC-2.4.5 If `proposalStatus !== 'none'` and `onOpenProposalQueue` set → "Review proposals" link rendered.
- AC-2.4.6 No emoji; lucide icons only.

**Estimate:** 0.75 d

---

### US-2.5 — `KimiWorkspaceShell` switch-arm for `preview.type === 'tabele'`

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (UPDATE — add render branch in `ArtifactPreviewPane`)

**Acceptance criteria**
- AC-2.5.1 New branch: `{preview.type === 'tabele' && <TabelePreviewLayout preview={preview} ... />}`.
- AC-2.5.2 Existing `pdf`, `xlsx`, `deck` branches unchanged (snapshot test).
- AC-2.5.3 Empty/failure states (`isGenerating && !preview`, `isFailed && !preview`, `!preview || preview.type === 'none'`) reuse existing fallback UI; sky accent applied via `LANE_CONFIG.tabele.accentColor`.
- AC-2.5.4 Component test: when `preview.type === 'tabele'` → `<TabelePreviewLayout />` is rendered (L3.2, L3.3).

**Estimate:** 0.5 d

---

### US-2.6 — DBR77 audit + responsive behavior

**Files** (audit only — applies across all EPIC-2 files)

**Acceptance criteria**
- AC-2.6.1 `rg "#[0-9a-fA-F]{3,6}\b"` against `tabelePreview/*.tsx` and `TabeleView.tsx` returns 0 matches outside comments (L1.4).
- AC-2.6.2 All accents use Tailwind `sky-*` / `slate-*` / `navy-*` / DBR77 semantic accents (`emerald` for committed/approved, `amber` for pending, `rose` for rejected/error).
- AC-2.6.3 Mobile breakpoint: at `lg:` and below, sections stack; record table becomes horizontally scrollable with shadow gradient.
- AC-2.6.4 Dark mode: every contrast ratio passes WCAG AA (manual check + screenshot).
- AC-2.6.5 Reduced-motion: animations disabled when `prefers-reduced-motion: reduce`.

**Estimate:** 0.5 d

---

## Sprint mapping

US-2.1 → US-2.6 all execute in **Sprint 3** (Agent C).

## Total estimate

~4 d single-agent.

## Dependencies on other epics

- **EPIC-1** US-1.3 must be merged first (`ArtifactPreview` shape + `tabeleArtifact.ts` types).
- **EPIC-3** is independent (rationale text comes pre-fetched via the shape; this epic doesn't call backend).
- **EPIC-4** consumes `TabelePreviewLayout` and wires the `onOpenBuilder` / `onOpenProposalQueue` callbacks.

## Out of scope (do NOT do in this epic)

- Data fetching from `tablePlatform.api.ts` → that's EPIC-1 (US-1.7) for the API client, EPIC-4 for the orchestrator wiring.
- TabeleView.tsx orchestrator → EPIC-4.
- Intent routing in chat → EPIC-4 / Sprint 5.
- i18n key authoring (only consume existing keys via `t()`; full key list authored in EPIC-4 / Sprint 5).
