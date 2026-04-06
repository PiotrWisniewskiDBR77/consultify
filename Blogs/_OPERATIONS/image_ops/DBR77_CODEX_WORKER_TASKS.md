# DBR77 Codex Worker Tasks

## Purpose

This file contains exact task prompts I can give to Codex in supervised mode.

Codex should receive only one of these task types at a time.

## Rule

Codex must execute only the assigned slugs and roles.

Codex must not:

- choose its own batch
- review old unassigned assets
- spawn subagents
- explore the repo broadly
- create helper contact sheets unless explicitly asked
- launch `Blogs/_TOOLS/run_image_generation.py`
- use local API keys or any local runner fallback

## Hard Mode Lock

Current project rule:

- `Codex-native only`

If an assigned generation or repair task cannot be completed through Codex's account-based path, Codex must stop and report the blocker instead of switching to the local runner.

## Task A: Fresh Batch Generation

Use this when I want Codex to generate a new batch.

```text
Execute this DBR77 image generation assignment exactly.

Read only:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_MASTER.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md

Task type:
- fresh production batch

Provider:
- openai

Product:
- <Product>

Assigned slugs:
- <slug_1>
- <slug_2>
- <slug_3>
- <slug_4>
- <slug_5>
- <slug_6>
- <slug_7>
- <slug_8>
- <slug_9>
- <slug_10>

For each slug:
- read the matching image-prompts.md
- generate exactly these roles:
  - hero
  - analytical
  - social
- generate through Codex's account-based image path only
- save images and matching .meta.json sidecars in the queue-defined asset folder

Do not:
- choose other slugs
- inspect older completed batches
- rerender anything unless generation itself fails

Before closing any role, apply Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md.

Finish with a short factual report:
- generated slugs
- any failed roles
- any obvious issues noticed
```

## Task B: Targeted Repair Batch

Use this when I already reviewed outputs and want only selected roles repaired.

```text
Execute this DBR77 image repair assignment exactly.

Read only:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_MASTER.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- the specific image-prompts.md files for the assigned slugs

Task type:
- targeted repair batch

Provider:
- openai

Assigned roles to rerender:
- <slug_a> | <role>
- <slug_b> | <role>
- <slug_c> | <role>
- <slug_d> | <role>
- <slug_e> | <role>

Rules:
- rerender only the listed roles
- rerender through Codex's account-based image path only
- do not touch unlisted roles
- do not review old unrelated assets
- do not broaden the scope
- use Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md to decide whether the rerender is strong enough to keep

Finish with a short factual report:
- rerendered roles
- output file paths
- any failures
```

## Task C: Prompt-Aware Repair After Supervisor Patch

Use this after I have already edited the prompt file and want Codex to regenerate only the patched role.

```text
Execute this DBR77 prompt-aware repair assignment exactly.

The prompt file has already been updated by the supervisor.

Read:
- the assigned image-prompts.md files only

Provider:
- openai

Assigned patched roles:
- <slug_x> | <role>
- <slug_y> | <role>
- <slug_z> | <role>

Rules:
- rerender only these exact roles
- do not reinterpret the task
- do not review or modify any other slug
- save the new version through Codex's account-based image path only

Finish with:
- slug
- role
- new output path
- success or failure
```

## Task D: Strict No-Improvisation Mode

Use this if Codex keeps drifting.

```text
Do not explore the repo.
Do not spawn agents.
Do not choose your own scope.
Do not inspect unrelated assets.
Do not build contact sheets.

Execute only the assignment I gave you.

If I listed slugs, use only those slugs.
If I listed roles, use only those roles.
If the assignment is complete, stop and report.
```

## Task E: Active Repair Batch - Consultify 11-20

Use this now for the current supervised repair round after supervisor review and prompt patches.

```text
Execute this DBR77 prompt-aware repair assignment exactly.

The supervisor has already reviewed Consultify 11-20 and already patched the prompt files.

Read only:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_MASTER.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- the assigned image-prompts.md files for the listed slugs

Provider:
- openai

Assigned patched roles to rerender:
- 11_strategic_reporting | hero
- 11_strategic_reporting | analytical
- 11_strategic_reporting | social
- 12_okr_management | analytical
- 12_okr_management | social
- 13_why_board_updates_should_come_from_live_transformation_systems | hero
- 13_why_board_updates_should_come_from_live_transformation_systems | social
- 14_why_strategy_workshops_fail_without_execution_system | analytical
- 14_why_strategy_workshops_fail_without_execution_system | social
- 15_how_to_keep_transformation_roi_visible_after_kickoff | hero
- 15_how_to_keep_transformation_roi_visible_after_kickoff | social
- 16_why_steering_committees_fail_when_the_system_is_static | analytical
- 16_why_steering_committees_fail_when_the_system_is_static | social
- 17_why_transformation_programs_need_one_source_of_truth | hero
- 17_why_transformation_programs_need_one_source_of_truth | analytical
- 17_why_transformation_programs_need_one_source_of_truth | social
- 18_how_to_turn_leadership_decisions_into_owned_initiatives | analytical
- 18_how_to_turn_leadership_decisions_into_owned_initiatives | social
- 19_why_transformation_portfolios_fail_without_live_prioritization | social
- 20_how_to_keep_leadership_alignment_after_the_offsite | social

Rules:
- rerender only these exact roles
- use Codex's account-based image path only
- do not touch approved roles
- do not review unrelated assets
- do not create contact sheets or helper artifacts
- do not widen the scope beyond this list
- use Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md before accepting a rerender as complete

Finish with a short factual report:
- each rerendered slug and role
- new output path
- any failures
```
