# Publish Instructions

## Page goal

Turn this article into an evaluation-system page that:

- teaches stable scorecard design and calibration
- supports AI extraction of dimension groups, evidence rules, and checklist
- connects buyer score discipline to Marketplace comparison workflow

## Machine-readable page order

1. `category_label`: Marketplace
2. `h1`: article title from `article_EN.md`
3. `direct_answer_box`: 2 to 4 sentences; dimensions, weights, evidence, calibration, archive
4. `hero_image`: prompt `Hero` from `image-prompts.md`
5. `lead`: opening through "Direct answer"
6. `section`: Scorecard skeleton (example structure, not universal)
7. `section`: Evidence rules (non-negotiable)
8. `analytical_image`: prompt `Analytical` from `image-prompts.md`
9. `section`: Calibration protocol (ninety minutes, illustrative)
10. `mid_cta`: intent Compare offers; after calibration protocol
11. `section`: Checklist before you call the scorecard "repeatable"
12. `section`: What this means for DBR77 Marketplace
13. `section`: Bottom line
14. `strong_cta`: intent Start manufacturer demo; after final paragraph
15. `faq_block`: optional; use FAQ_PROMPTS below

## FAQ prompts (machine-readable)

```yaml
faq_prompts:
  - How do you build a repeatable scorecard for automation supplier selection?
  - What evidence should each automation scorecard dimension require?
  - How do you run a scorecard calibration session before evaluating bids?
  - Why do automation scorecards drift between projects?
  - What is a sensible tie-break order for automation bid scoring?
```

## CTA placement notes

- Mid CTA: compare offers when evaluation templates are being standardized
- Strong CTA: demo for teams institutionalizing comparison

## Implementation notes for Cursor

- preserve example dimension table for FAQ mapping
- dimension count and timing are illustrative; adjust in implementation without renaming core sections
