# Module Report — Part 4 (Modules 16–20)

Read-only per-module UI/UX audit. Reflects current code on branch `feat/wave1-foundations` after Wave-1/2 fixes (off-brand violet→crimson, `dark:text-slate-600`→`-400`). Deck/theme user-palettes, chart colors and 3rd-party brand logos are treated as legitimate and listed separately.

Brand canon confirmed in `tailwind.config.cjs`: `primary.DEFAULT = #A51C30` (HBS Crimson). Landing must be crimson + navy.

---

## 16) Presentations / Prezentacje — `src/components/Presentations/**`

**a) Komponenty graficzne**
Judged as a Gamma/Studio-class surface (UX docs 26/27): DeckBuilder builds its own chrome, so `fixed inset-0` overlays are canon-acceptable here (`PresentMode.tsx:78,147` present-mode fullscreen; `CommandPalette.tsx:255`; `ShareModal.tsx:103`; `DeckAuditLogModal.tsx:1146`; `DeckGovernanceCardModal.tsx:150`). Spinners are nearly all small inline `Loader2`/border-spinners inside buttons or panels (legit). One stray full-panel raw spinner: `BrandKitSettings.tsx:109` (`Loader2 w-8 h-8` centered as the whole loading state — should be `LoadingState`). `PresentationsHub.tsx:678` uses a raw `fixed inset-0 … bg-black/50` modal in the hub (not a Studio canvas) — candidate for the shared `Modal` primitive.

**b) Kolory (light + dark)**
Mostly clean. Remaining violet is semantic "AI/share" category coding, not generic accent drift: `DeckAuditLogModal.tsx:58-61,87-93` (share action + AI_AGENT/AI actor chips) and `DeckBuilderTopBar.tsx:88` (AI-activity pulse dot). `OutlineStep.tsx:342` violet `visualPolicy` badge is a minor stray — could move to a brand/neutral token. — **Legit, not drift:** all of `wizard/types.ts` color sets incl. `id:'indigo'` palette (411-) and per-theme `chartPalette` hex arrays; slide-type badge colors `types.ts:251,264` (`next_steps`/`thank_you` = `bg-indigo-500`) are categorical badge coding; `DeckTemplateGallery.tsx:53` `to-indigo-500` gradient is a template-category color.

**c) Uwagi**
Solid, cohesive Studio. Shapes/rounding consistent. The only real polish items are (1) normalize the "AI = violet" convention vs. brand crimson (decide and apply globally), (2) the lone full-panel spinner in BrandKitSettings, (3) the hub-level raw modal.

**Werdykt: PASS**
Top 3 fixes: 1) `BrandKitSettings.tsx:109` → `LoadingState`. 2) `PresentationsHub.tsx:678` → shared `Modal`. 3) Decide AI-accent token (violet vs primary) and apply to `DeckAuditLogModal`/`DeckBuilderTopBar`/`OutlineStep` consistently.

---

## 17) Document Studio — `src/components/DocumentStudio/**`

**a) Komponenty graficzne**
Clean Studio-class implementation. No raw `fixed inset-0` modals at all. Every `animate-spin` is a small inline `Loader2` inside a button/inline-status (`DocumentStudioDocumentPanel.tsx:1893,1930,1943,1959,1975`; `DocumentStudioIntakeForm.tsx:327`; `DocumentStudioOutlinePanel.tsx:82`; `DocumentStudioTemplateArchitectView.tsx:266`; `DocumentStudioQaPanel.tsx:151`) — all legit. No stray full-area spinners.

**b) Kolory (light + dark)**
**Czysto.** Zero violet/indigo/fuchsia/purple, zero hardcoded `#hex`/`[#…]`, no inline-style brand drift across the whole module.

**c) Uwagi**
Best-behaved module in this part. Panel layout, rounding and spacing are consistent; light/dark tokens used throughout. Nothing to flag.

**Werdykt: PASS**
Top 3 fixes: none required (optional: keep verifying QA/Outline panels stay token-based as they grow).

---

## 18) Table Studio — `src/components/MyWork/table/**`

(Note: there is no `src/components/Table/**`; the Table Studio lives under `src/components/MyWork/table/**` — ~150 files.)

**a) Komponenty graficzne**
Studio-class, but very large. 33 files use raw `fixed inset-0` modals — acceptable inside the table canvas (record expand, pickers, dialogs) per UX 26/27, but enough of them are plain hub-style dialogs that standardizing on the shared `Modal` primitive (`src/components/ui/primitives/Modal.tsx`) would reduce drift. Spinners are inline (no stray full-area `animate-spin` border-spinners found). Both shared primitives (`Modal`, `LoadingState`) exist and should be the target.

**b) Kolory (light + dark)**
Largest off-brand surface in this report: **indigo used as a primary accent** (not a user palette) in 13 files. Worst offenders: `governed/GovernedModelsDashboard.tsx` (12 hits — buttons `bg-indigo-600`, focus rings `focus:ring-indigo-500`, progress bar `bg-indigo-500` at :134, links/checkboxes); `extensions/ExtensionMarketplace.tsx` (8 — tabs, install buttons `bg-indigo-600`, icon tiles); `connectors/WebhookRelayPanel.tsx` (8 — primary buttons/inputs/focus rings); `TableToolbar.tsx:848,875,952,1161`; `integration/ConsultifyLinkPanel.tsx:168,277,354`; `WorkflowDashboard.tsx:258-259,294`; `SchemaProposalCard.tsx`; `RecordExpandModal.tsx:90`; `PlatformCellRenderer.tsx:258`; `IdeaCompletenessWidget.tsx:94`; `connectors/WebhookRelayPanel`. These should become `primary-*`. — **Legit, not drift:** `cells/AiClassificationCell.tsx:6-7,39-51` deterministic categorical class palette (sky→indigo→violet→fuchsia→… by class index); `ColorPalette.tsx`, `RowColoringConfig.tsx`, `ConditionalFormatting.tsx`, `charts/*` user-selectable cell/chart colors. No stray hardcoded `#hex` outside palettes.

**c) Uwagi**
Functionally rich but visually inconsistent: governance/extensions/connectors sub-areas read as an "indigo product," while the rest of the app is crimson. Dark variants are present alongside the indigo (`dark:bg-indigo-900/20` etc.) so contrast is OK — it's brand drift, not a contrast bug. Recommend a single sweep replacing accent `indigo-{500,600,700}` → `primary-*` in those 13 files.

**Werdykt: NEEDS-WORK** (color drift breadth)
Top 3 fixes: 1) Replace accent indigo→`primary-*` in `GovernedModelsDashboard.tsx`, `ExtensionMarketplace.tsx`, `WebhookRelayPanel.tsx` (buttons/rings/progress). 2) Same sweep for `TableToolbar.tsx`, `ConsultifyLinkPanel.tsx`, `WorkflowDashboard.tsx`, `RecordExpandModal.tsx`, `PlatformCellRenderer.tsx`, `SchemaProposalCard.tsx`, `IdeaCompletenessWidget.tsx`. 3) Consolidate the most hub-like of the 33 raw modals onto `ui/primitives/Modal` (leave true in-canvas overlays).

---

## 19) Partner — `src/views/partner/**`

**a) Komponenty graficzne**
Judged by marketing/portal standards. Well built. Two raw modals: `PartnerPortalView.tsx:1875` and `sections/ReferralToolsSection.tsx:1009` (`fixed inset-0 … bg-black/60 backdrop-blur`) — acceptable for a portal but could use the shared `Modal`. `DirectoryView.tsx` is a 10-line stub/placeholder (no UI concern).

**b) Kolory (light + dark)**
Effectively clean. No off-brand accent tokens. Only "violet" reference is a stale comment in `PartnerPortalView.tsx:11` ("Consistent styling with Admin module (violet accents)") — comment lies vs. code (code is on-brand); harmless but worth deleting. — **Legit, not drift:** `ProviderHomeView.tsx:1060` `bg-[#0A66C2]` is the LinkedIn brand blue (3rd-party logo chip); `sections/ReferralToolsSection.tsx:360` `#0F172A`/`#FFFFFF` is QR-code fg/bg config. No generic hardcoded-hex accents.

**c) Uwagi**
Dark mode is handled where it matters: `PartnerPortalView` (206 `dark:`), `ProviderHomeView` (117), `CommissionView` (36), `PartnerDashboardView` (proper `text-slate-900 dark:text-white` pairs). Shapes/rounding consistent with the rest of the app. Clean module.

**Werdykt: PASS**
Top 3 fixes: 1) Delete the misleading "violet accents" comment at `PartnerPortalView.tsx:11`. 2) Optionally route the two portal modals through `ui/primitives/Modal`. 3) Flesh out `DirectoryView.tsx` stub if it's meant to ship.

---

## 20) Landing Page — `src/components/Landing/**` + marketing views (`PublicLandingPage`, `PricingLandingPage`, `EnterprisePage`, `VectorPage`, `PublicMiniAssessmentView`)

**a) Komponenty graficzne**
Judged by marketing-page standards. Live hero stack (`EpicHeroSection`, `ProfitHeroSection`, `EntryTopBar`) is polished, with full dark handling (`MarketingLayout.tsx:56` `dark:bg-[#0A0F1E]`, `EpicHeroSection` 21 `dark:` rules). `EnterprisePage` wraps content in `MarketingLayout` so it inherits dark mode (its low inline `dark:` count is expected). No broken basics. **Dead code:** `Landing/HeroSection.tsx` is not imported anywhere — it still carries an `indigo` card variant (`:63` `color:'indigo'` + colorMap `:158-161`); off-brand but unreachable. Recommend deleting the file.

**b) Kolory (light + dark)**
Brand-correct: crimson family `#A51C30 / #851627 / #651120` and navy `#0A0F1E / #0F172A` throughout (`EpicHeroSection.tsx:240,282,363`; `EntryTopBar.tsx:313,459,583`; `HowItWorksSection`, `WhereItHappensSection`, `ForWhomSection`) — these are the canonical marketing design-system hex, **legit, not drift** (incl. categorical icon accents `#0891b2`/`#059669`/`#d97706` for section variety). Remaining genuine off-brand:
- `views/VectorPage.tsx:163` `bg-gradient-to-b from-indigo-50 to-white` — light indigo hero gradient on a live page (should be `primary-50`/crimson). The rest of VectorPage is correctly `primary-*` + `navy-*`.
- `views/PublicMiniAssessmentView.tsx` — heavily **indigo-themed public page**: 18 indigo hits (buttons `bg-indigo-600`, focus rings, icon tile `:292`, result header `:385-386`, spinners `:264,367`) plus 38 `gray-*` neutrals (off-brand vs. `slate-*`). This public, prospect-facing page is fully off the crimson brand.
- `components/Landing/InfoSections.tsx:617` `bg-indigo-600/5` decorative blur blob (minor; should be primary).

**c) Uwagi**
Core marketing surface is strong and on-brand with good dark-mode coverage. The weak spots are (1) `PublicMiniAssessmentView` reading as a different (indigo/gray) product, (2) the VectorPage hero gradient, (3) one decorative blur and dead `HeroSection.tsx`. `StudioView.tsx:151` (Studios shell, adjacent) uses a `text-blue-500` full-screen loading spinner — minor, blue not crimson, not violet.

**Werdykt: MINOR** (Landing core PASS; pulled down by `PublicMiniAssessmentView`)
Top 3 fixes: 1) Re-brand `PublicMiniAssessmentView.tsx` indigo→`primary-*` and `gray-*`→`slate-*` (18 + neutrals). 2) `VectorPage.tsx:163` `from-indigo-50`→`from-primary-50`; `InfoSections.tsx:617` blur→primary. 3) Delete unused `Landing/HeroSection.tsx` (carries off-brand indigo variant).

---

## Summary

| # | Module | Path | Werdykt |
|---|--------|------|---------|
| 16 | Presentations | `src/components/Presentations/**` | PASS |
| 17 | Document Studio | `src/components/DocumentStudio/**` | PASS |
| 18 | Table Studio | `src/components/MyWork/table/**` | NEEDS-WORK |
| 19 | Partner | `src/views/partner/**` | PASS |
| 20 | Landing | `src/components/Landing/**` + marketing views | MINOR |

Biggest single item: Table Studio accent-indigo drift across 13 files (governed/extensions/connectors). Biggest marketing item: `PublicMiniAssessmentView` is fully off-brand (indigo+gray).
