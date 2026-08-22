# Interview tables — owner review evidence — 2026-08-22

Classification: `INTERNAL_RESTRICTED`

| Evidence ID | Surface | SHA-256 | Proves | Does not prove |
|---|---|---|---|---|
| `INT-TBL-EVD-001` | Inbox | `a9c55658f52a7b14728465ec0aacca26f39f1d307c9e2dead6693ad102fe80a6` | Visible baseline for the Inbox upper menus and table. | Context/kebab behavior, data correctness or persistence. |
| `INT-TBL-EVD-002` | Sessions | `765adc4a0862af8929e16a5ba7cfa4da9585b4429c2afa27ba57edcd1e163e82` | Visible baseline for the Sessions upper menus and table. | Context/kebab behavior, data correctness or persistence. |
| `INT-TBL-EVD-003` | Assigned | `be0cbf285dd63251e187d50c9d4afad8cfb59cc197ea99bef1470f98ef459216` | Visible baseline for the Assigned upper menus and table. | Context/kebab behavior, data correctness or persistence. |
| `INT-TBL-EVD-004` | Templates | `1b7069439ce14b56759c44b45eb63b06d62203130fef4d4ce979ae761c699b42` | Visible baseline for the Templates upper menus and table. | Context/kebab behavior, data correctness or persistence. |
| `INT-TBL-EVD-005` | Insights | `949b8aa50003f8056c1d4d220fec17b49778df4597cca577976d643614d70941` | Visible baseline for the Insights upper menus and table. | Context/kebab behavior, data correctness or persistence. |
| `INT-TBL-EVD-006` | Initiatives | `4144e251057a93c5454caa47f8b27531e49df5d16eefe970672eeb8911519808` | Visible baseline for the Initiatives upper menus and table. | Context/kebab behavior, data correctness or persistence. |

Owner result: `TABLE_SHAPE_AND_UPPER_MENUS_OWNER_APPROVED`.

Open review dimensions: right-click context menus, row kebab menus and
correctness of data, state, permissions, behavior and readback.

## Context and kebab menu evidence

| Evidence ID | Surface | SHA-256 | Visible action evidence |
|---|---|---|---|
| `INT-MENU-EVD-001` | Inbox / right-click | `e09d4a3683466d09cf3c6b4b01ab4134a7ebe24c7963d2cf8208b6f977e0de72` | Continue, Open preview, Edit, Delay and Delete. |
| `INT-MENU-EVD-002` | Inbox / kebab | `e02a4c80f52e238f8e74798150727177624c0a33b75b2e70b4f28e4fb9701218` | Same five visible actions; owner says the lifecycle menu remains incomplete. |
| `INT-MENU-EVD-003` | Sessions / right-click | `94852a8d10e1117e7eb61258f39eb89ba98cdbe44ed4f6148eac3875a5c2de54` | Open preview, Archive and disabled Delete with reason. |
| `INT-MENU-EVD-004` | Sessions / kebab | `411ef6b5e8dd2771aade8902dcdfe069721ff47b831c07b41a512fe7676fbc08` | Same three visible actions. |
| `INT-MENU-EVD-005` | Assigned / right-click | `a61fe90e3a9bd74336f0673408649fec72237bb05a320373425ba6046dbed6ba` | Open preview, Edit, Archive and Delay. |
| `INT-MENU-EVD-006` | Assigned / kebab | `19ed91470ad486adc1a3e495ab298cf74eb20417a19c25e8e11462a20acbdfc2` | Adds Reassign, Send reminder and Escalate now, proving surface divergence. |
| `INT-MENU-EVD-007` | Templates / right-click | `0d88b8bf8c57fc5e87734ef4a95f2c394d8e8f12fa4418b93a1c0b5430619367` | Rich object-specific set: use, assign, clone, usage, default, preview, edit, archive and delete. |
| `INT-MENU-EVD-008` | Initiatives / right-click | `adf1936c9b66f579bbb0f47dcb6d58bd512b4eedd786268ffd990c387da4118f` | Only Send to review, Open in Initiatives and Open preview are visible. |

These screenshots prove visible menu content only. They do not prove that an
action is authorized, wired, persisted or reflected after refresh. The required
next artifact is a per-object, per-state and per-permission action matrix shared
by the right-click and kebab renderers.

## Preview action-footer evidence

| Evidence ID | Surface | SHA-256 | Visible state |
|---|---|---|---|
| `INT-PREV-EVD-001` | Inbox | `fd0b5d54aa729fa85adbe240d2fc62af7c832ba6b60363f92e781b0263f3281d` | AI and Relations precede bespoke Continue/Open/+1d/+3d/+7d controls; action hierarchy and anti-duplication require canon review. |
| `INT-PREV-EVD-002` | Sessions | `fae7e6a7bf2804deddc4845dd31dbbe5a78cabb1c66e5334a8cd15dbb1f46ef5` | AI and Relations precede a single Generate insights action plus overflow. |
| `INT-PREV-EVD-003` | Assigned | `5bc0d87a186da80898c31e084da2224b66f7303b246ec3c241ae9a8e0c61851b` | Approved assignment ends with an informational closure strip and no visible action footer. |
| `INT-PREV-EVD-004` | Templates | `74bdda6a8e05c27271ceca0434a6b30696b16be1a49b8178ced0c805e7f7d569` | AI and Relations precede bespoke Edit/Duplicate/Delete action rows. |
| `INT-PREV-EVD-005` | Insights | `3567c6e428588253713168c8322f31db489aaec10e32e6018f443ac57100db49` | AI is followed directly by a What's-next conversion strip; canonical Actions mapping is absent or intentionally omitted but undocumented. |
| `INT-PREV-EVD-006` | Initiatives | `6aeb83e3525d11021434d29bce4cbacc52e54c3e55ca71a4b5079c1ade9854cb` | AI and Relations precede Send to review, Open initiative document and overflow controls. |

Normative comparison: `TRIADA_KANON.md` owns Preview anatomy and appearance;
`TABLE_AND_PREVIEW_CANON.md` §7 and §7.3b own mechanics and button variants.
The required order is `AI → Relations → Actions → Co dalej`; Actions use
`PreviewActionBar` plus `actionPillClass()`, and duplicate Open/export controls
are forbidden. Screenshots do not prove handler, permission, persistence or
readback correctness.

## Question workspace regression evidence

| Evidence ID | Baseline | SHA-256 | Visible state |
|---|---|---|---|
| `INT-QCARD-EVD-001` | Current N-type regression | `5300720ea87ec4dd82bf30e96d4c2c9b3a18575d8c3339aa57b86624fa9d7bd3` | The single-question runtime is constrained inside the generic N-mode artifact shell, with additional left section navigation and a right properties panel. |
| `INT-QCARD-EVD-002` | Previous production, owner-approved direction | `1d952eef92513696760a6b27d8770e157e74225c6eeb20a7ac5f49444339a39d` | Dedicated wide question workspace with question rail, broad answer canvas and persistent bottom Save/Next navigation. |

Owner decision: remove the N-type embedding and restore the previous production
single-question workspace. Git history identifies `809e3abe31` as the change
that removed the dedicated early-return runtime and embedded it in `NModeShell`.
The rollback must remain presentation-scoped and retain later persistence,
review and workflow corrections.

## Assignment generator evidence

| Evidence ID | Surface | SHA-256 | Visible state |
|---|---|---|---|
| `INT-ASSIGN-EVD-001` | Assign Interview modal | `170ccdb632210203ae6b2f57b0a87374472cb12756e6e14f4c9365c59fdec442` | Required template selector has no visible suggestion while the assignee selector is populated; the remainder of the generator is owner-approved. |

Source diagnosis: since `84c0525d05c`, the modal filters the API list to
`status === approved && hasPublishedVersion === true`. The server derives the
second flag from an exact template-version snapshot scoped to the active
organization. This explains the empty selector without implying that the
template library itself is empty. The exact rejected record and database
snapshot still require live readback before remediation.

## Template editor evidence

| Evidence ID | Surface | SHA-256 | Visible state |
|---|---|---|---|
| `INT-TPL-ED-EVD-001` | Template editor | `73bc4131cfc186eccb24d3dbefc0f4d1757ede1b0a78c7b028dab633272740d3` | Complete editor with 12-question list and creation/publish controls; owner reports successful use and positive assessment with a minor intuitiveness reservation. |

Owner result: `FUNCTIONALLY_OWNER_APPROVED / MINOR_DISCOVERABILITY_RESERVATION`.
This is a preserve decision, not authorization for redesign. Publish persistence
and subsequent availability in Assign remain separate correctness checks.

## Insight and Initiative creator-standard evidence

| Evidence ID | Surface | SHA-256 | Visible state |
|---|---|---|---|
| `INT-CREATOR-EVD-001` | AI Insight Creator / Define | `b0e0f47723a309d3cb440af06e1e09c1b98eb43e37d9491909d406905fde1ef5` | Small modal, compressed three-step header and dense output-type cards; more options continue below an internal fold. |
| `INT-CREATOR-EVD-002` | AI Insight Creator / Source | `f4712eb7e807234ddc3c0ed16ac06fd7295d8a450b8211d7ff7390417f9c5a30` | People, date, role and department controls compete inside a narrow content area. |
| `INT-CREATOR-EVD-003` | AI Insight Creator / Refine, top | `0f554f0c79661469bc2d77685f2014bf730a967822f494a38852c71166aadf63` | Leading-question block, Advanced frame and analysis-mode cards create nested containers and multiple visual boundaries. |
| `INT-CREATOR-EVD-004` | AI Insight Creator / Refine, middle | `83f6a45d1bcf6da5b2baa44242dedd212488a8c8cffe7a67d79aa5e539d1263e` | Internal scroll reaches topic focus and AI context boundary while the user has no clear total-progress or continuation cue. |
| `INT-CREATOR-EVD-005` | AI Insight Creator / Refine, bottom | `4d08454096c22200cc32bba179f13249b871950b15e166a0beb8cea1953b1b87` | Context-document upload and document states appear only after substantial scrolling; persistent Run remains visible but content extent is opaque. |

Owner decision: preserve the business substance, but replace the current
operability with one shared creator-dialog standard for Insight, Initiative and
eventually all creators. Three independent reviews (UX/workflow,
design-system/responsive UI and product/IA) were commissioned before defining
the remediation contract. No implementation is authorized during intake.

### Initiative Creator parity evidence

| Evidence ID | Surface | SHA-256 | Visible state |
|---|---|---|---|
| `INT-INIT-CREATOR-EVD-001` | AI Initiative Wizard / Insights | `9c708ae9e2471abe86a8737985313294e427c5c28a6a1a92deb26478d15308cf` | Five-step wizard begins with explicit Insight selection and lineage promise; source cards and summary occupy a wide but visually sparse workspace. |
| `INT-INIT-CREATOR-EVD-002` | AI Initiative Wizard / Intent, top | `6b81dba1e5e9470f63daa66ee6b5a289b6366c74baa2c93f46df38e6d080471c` | Auto-filled core, project, portfolio warning and transformation decision compete in a dense internally scrolling step. |
| `INT-INIT-CREATOR-EVD-003` | AI Initiative Wizard / Intent, AI failure | `206ab163203322b0296f9725d34738c272506ba9462ae772ab19e138ddbec529` | Section-level AI fill ends with the generic toast `Failed to fill the section with AI.` |
| `INT-INIT-CREATOR-EVD-004` | AI Initiative Wizard / Intent, lower content | `7e890adfd6cc517fddfacd158f99604d02d87fd40d3e4bc4299ec7c84b2f6770` | Transformation decision, priorities, count, horizon, risk and context become visible after scrolling; persistent footer remains, but total content extent is unclear. |

This resolves the prior total absence of Initiative evidence and confirms the
shared operability problem plus the intended Insight → Initiative mechanic.
It does not close parity: Candidates, Governance and Result are not captured.
The Liquid Glass direction is recorded as conditional visual language, subject
to contrast, reduced-transparency, focus and performance gates.
