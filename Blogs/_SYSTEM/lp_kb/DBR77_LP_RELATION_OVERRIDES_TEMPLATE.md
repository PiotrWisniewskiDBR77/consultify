# DBR77 LP Relation Overrides Template

## Purpose

Use this file as the manual correction layer when auto-built LP relations need adjustment.

Keep overrides rare.

## Rule

Do not add overrides for taste.

Add them only when:

- the automatic relation is misleading
- a stronger cross-product bridge is known
- a featured path must be protected

## Record Template

Use one YAML-like block per override:

```text
- product: Consultify
  action: add_edge
  from_slug: 21_how_to_defend_transformation_investment_with_live_value_evidence
  to_slug: 24_how_to_compare_capex_options_when_every_scenario_looks_plausible
  edge_type: bridge_next_product
  target_product: DT
  target_section: CAPEX And Investment
  reason: ROI defense often leads to capex scenario validation
  weight: 95
```

## Allowed Actions

- `add_edge`
- `remove_edge`
- `replace_edge`
- `change_weight`

## Required Fields By Action

### `add_edge`

- `product`
- `from_slug`
- `to_slug`
- `edge_type`
- `reason`

### `remove_edge`

- `product`
- `from_slug`
- `to_slug`
- `edge_type`
- `reason`

### `replace_edge`

- `product`
- `from_slug`
- `old_to_slug`
- `new_to_slug`
- `edge_type`
- `reason`

### `change_weight`

- `product`
- `from_slug`
- `to_slug`
- `edge_type`
- `weight`
- `reason`

## Example Override Set

- product: IRIS
  action: add_edge
  from_slug: 25_how_to_build_ai_assisted_factory_operations_step_by_step
  to_slug: 21_what_the_first_30_days_of_iiot_should_look_like_in_a_brownfield_factory
  edge_type: bridge_next_product
  target_product: IoT
  target_section: Execution And Rollout
  reason: buyers often need a visibility-first step before wider execution closure
  weight: 90

- product: DT
  action: remove_edge
  from_slug: 01_digital_twin_not_3d_model_decision_engine
  to_slug: 03_before_you_buy_a_robot_simulate_it_first
  edge_type: same_section
  reason: keep the front-door logic focused on executive education before robotics depth

