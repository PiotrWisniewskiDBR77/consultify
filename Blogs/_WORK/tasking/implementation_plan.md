## Industrial Style Contract (Revised)

- **Hero:** Editorial industrial photography. Real human business moments (decisions, handoffs, escalations), not staged stock poses.
- **Analytical:** Physical tabletop / workshop constructions. Fabricated explanatory devices (rails, trays, gates), no software schematics, no dashboard UI.
- **Social:** Tight editorial macro-crop. One clear physical focal subject. No floating icons, no KPI tiles, no holographic overlays, no decorative infographic elements. Macro/close industrial detail or compressed human moment.
- **Export Standard:** 
    - Hero/Analytical: 16:9.
    - Social: 1:1 (Square). If the tool produces 16:9, I will center-crop to 1:1.

## User Review Required

> [!IMPORTANT]
> **NO FLOATING ICONS:** Social images must be purely physical macro shots. Any drift into "AI-symbolism packs" with floating UI elements will be auto-rejected and regenerated.

## Proposed Changes

### [IRIS Blog Production]

#### [NEW] Assets for slug 39: `what_a_human_approval_policy_should_look_like_in_factory_ai`
- `IRIS/Blog/39_.../assets/images/hero_16x9_v1.png`
- `IRIS/Blog/39_.../assets/images/hero_16x9_v1.meta.json`
- `IRIS/Blog/39_.../assets/images/analytical_16x9_v1.png`
- `IRIS/Blog/39_.../assets/images/analytical_16x9_v1.meta.json`
- `IRIS/Blog/39_.../assets/images/social_1x1_v1.png`
- `IRIS/Blog/39_.../assets/images/social_1x1_v1.meta.json`

#### [NEW] Assets for slug 40: `how_to_review_ai_assisted_operations_after_the_first_90_days`
- (Same triptych structure as 39)

#### [NEW] Assets for slug 41: `how_to_design_an_exception_handling_model_for_ai_assisted_operations`
- (Same triptych structure as 39)

#### [NEW] Assets for slug 42: `when_a_factory_needs_one_operational_arbiter_for_conflicting_signals`
- (Same triptych structure as 39)

#### [NEW] Assets for slug 43: `how_to_build_a_cross_site_playbook_for_ai_assisted_factory_operations`
- (Same triptych structure as 39)

#### [NEW] Assets for slug 44: `what_an_executive_ai_operations_scorecard_should_include_and_ignore`
- (Same triptych structure as 39)

#### [NEW] Assets for slug 45: `when_to_keep_ai_assistance_inside_one_workflow_and_when_to_connect_more`
- (Same triptych structure as 39)

#### [NEW] Assets for slug 46: `how_to_create_audit_ready_records_for_ai_assisted_factory_decisions`
- (Same triptych structure as 39)

#### [NEW] Assets for slug 47: `what_data_ownership_should_look_like_in_an_ai_native_plant_operating_system`
- `IRIS/Blog/47_.../assets/images/hero_16x9_v1.png`
- `IRIS/Blog/47_.../assets/images/hero_16x9_v1.meta.json`
- *(Analytical and Social will not be generated per task instructions)*

## Open Questions

- **Visual Tone:** The request specifies "one style of light / photography in the whole batch." Should I strictly aim for "neutral workshop light with slight shadow depth" for all? (Defaulting to this if not specified otherwise in individual prompts).

## Verification Plan

### Automated Verification
- Check that all 25 images and 25 `.meta.json` files exist.
- Verify each `.meta.json` has required fields.
- **Social Crop Check:** Ensure all `social_1x1_v1.png` files are square (1:1).

### Manual Verification
- Self-QC check of each image against `DBR77_IMAGE_QC_STANDARD.md` Mode 2 + specific **No Floating Icons** rule for Social.
- Final generation of a list of 25 paths with pass/correction stats.
