# Materials editors — visual and interaction standard

**Status:** canonical for Document Studio, Workbook Studio, Deck Builder and all template builders.
**Parent standards:** `00-foundation/visual-language.md`, `00-foundation/artifact-identity-map.md`, `02-components/editor-shell-canon.md`, `02-components/empty-loading-states.md`.

## 1. Product promise

Word, Excel and PowerPoint are three representations of the same Consultify material workflow. A user who learns one editor must recognize the placement, meaning and interaction of controls in the other two.

Each editor uses the same shell:

1. **Top command row:** document identity and lifecycle on the left; one to four primary editing actions; secondary actions; overflow; save state; QA; export/share.
2. **Left work rail:** structure navigation only (sections, sheets or slides), with add, duplicate, reorder and context menu.
3. **Centre canvas:** the material itself. It must receive the largest area and cannot be covered by application navigation.
4. **Right inspector:** properties for the current selection, grouped into no more than five visible sections. Advanced settings are collapsed.

No editor introduces an additional global toolbar, private color system or bespoke icon family.

## 2. Canonical artifact identity

| Material | Primary Lucide icon | Template icon | Signal accent | Never use |
|---|---|---|---|---|
| Word document | `FileText` | `FileType2` | neutral slate / info blue | page emoji, filled Word logo imitation |
| PowerPoint deck | `Presentation` | `PanelsTopLeft` | fuchsia signal | projector clip-art, filled orange PowerPoint imitation |
| Excel workbook | `FileSpreadsheet` | `TableProperties` | emerald signal | chart emoji, filled green Excel imitation |
| AI action | `Sparkles` | n/a | primary brand | magic-wand variants for ordinary manual actions |
| Quality | `ShieldCheck` | n/a | success/warning/danger by result | decorative stars or score-only color |
| Export/share | `Download` / `Share2` | n/a | neutral until action state | format logos as toolbar controls |

Artifact accents are data signals. Sidebar, command row and menus remain monochromatic.

## 3. Icon grammar

- Use `lucide-react` only for operational UI. Custom SVG is allowed only for a real brand mark or a domain illustration that Lucide cannot express.
- Stroke is `currentColor`, visually equivalent to Lucide's default 2 px. Do not mix outline and filled icon styles in one surface.
- Sizes:
  - `14 px`: dense menu rows and metadata;
  - `16 px`: standard buttons and toolbars;
  - `18–20 px`: section headers and format cards;
  - `24 px`: empty-state anchor;
  - `32 px` maximum: onboarding/format-choice hero.
- Icon-only controls require `aria-label`, tooltip and a minimum 36×36 px target. Destructive actions also require text in menus.
- The same verb always uses the same icon in all three editors: add=`Plus`, duplicate=`Copy`, rename=`Pencil`, delete=`Trash2`, move=`GripVertical`, undo=`Undo2`, redo=`Redo2`, comments=`MessageSquare`, history=`History`, sources=`Library`, lock=`Lock`, present=`MonitorPlay`.
- Do not use emoji as interface icons. Emoji remain allowed only as user-authored document content.

## 4. Cards, menus and panels

### Format and template cards

- One icon anchor, one title, one two-line use-case description and one trailing affordance.
- Equal height within a choice group. Entire card is clickable and keyboard focusable.
- Layer-2 surface, `rounded-xl`, no permanent saturated fill. Hover uses a subtle surface shift; selected state uses one primary border/ring.
- Format choice is Word / PowerPoint / Excel. Start mode is Blank / AI / Existing template. Never mix these two questions on one level.

### Menus

- Floating Layer-3 surface, `rounded-xl`, subtle shadow, portal above editor chrome.
- Every menu item has a 14 px icon, regular-weight label and optional shortcut aligned right.
- Five to seven direct items per group. Rare actions go into overflow; destructive actions form the final separated group.
- No unexplained glyphs, icon-only submenu rows or different icons for the same action between editors.

### Inspector

- Selection, content, appearance, data/source and accessibility are the maximum five default groups.
- Groups with no applicable properties disappear instead of displaying disabled noise.
- AI suggestions are separate from manual properties and never replace a manual control.

## 5. Illustrations and graphics

Three graphic classes are permitted:

1. **Functional preview:** a truthful miniature of a page, sheet or slide. It must be generated from the actual template/runtime representation.
2. **Explanatory illustration:** onboarding or an empty state where a visual materially explains the next action. Use a restrained duotone treatment based on application tokens.
3. **Audience content:** images, charts and diagrams inside the material. These follow the material template and are not application chrome.

Prohibited:

- generic stock clip-art, fake screenshots and decorative 3-D office graphics;
- old raster illustrations with baked-in text, theme colors or white backgrounds;
- gradients in operational chrome;
- large illustration when a 24 px semantic icon and clear instruction are sufficient;
- a template thumbnail that does not match the generated output.

## 6. Empty, loading and error states

Use shared `EmptyState` and `LoadingState`.

- Empty: semantic icon, concrete thesis, one-sentence cause and one relevant CTA.
- Loading: content-shaped skeleton; named progress for operations above three seconds.
- Error: `AlertTriangle`, actionable explanation, Retry and preserved user input.
- A failed load can never render the “create first item” empty state.

## 7. Manual-work parity

Every AI-generated element must remain manually editable with the same canonical controls as a manually created element. The UI must not expose an AI-only content type that cannot be selected, edited, reordered, duplicated, deleted, sourced and undone manually.

Shared lifecycle verbs and placement:

| Capability | Command placement |
|---|---|
| Create/add structural unit | left rail footer and keyboard shortcut |
| Rename/duplicate/delete/reorder | structural-unit context menu; drag handle for reorder |
| Content and formatting | canvas selection + right inspector |
| Undo/redo | top command row and platform shortcut |
| Comments/history/versioning | top secondary actions or overflow |
| QA | top command row, before export |
| Save state | passive status in top command row |
| Export/share/present | top-right action cluster; quality guard applies consistently |

## 8. Accessibility and quality gate

- Full keyboard reachability and visible focus for every interactive item.
- Tooltips do not contain essential information unavailable to keyboard/touch users.
- WCAG AA contrast in both themes. Status is never encoded by color alone.
- Icon registry test rejects emoji, non-canonical icon mappings and raw hex colors in materials navigation.
- Screenshot acceptance covers light/dark, 1280/1440 widths, modal, empty/error/loading, editor shell and each open menu.
- A release fails if a control is dead, duplicated, clipped, lacks an accessible name or uses an obsolete asset.

## 9. Migration rule

When an obsolete graphic is found:

1. classify its job (artifact identity, action, state, illustration or audience content);
2. replace action/identity/state graphics with the canonical Lucide mapping;
3. replace an illustration only when it materially helps; otherwise remove it and strengthen copy/layout;
4. add a regression test for mapping, accessibility and routing;
5. verify the real surface in light and dark mode.

Do not create a new illustration merely to preserve the amount of decoration on the old screen.
