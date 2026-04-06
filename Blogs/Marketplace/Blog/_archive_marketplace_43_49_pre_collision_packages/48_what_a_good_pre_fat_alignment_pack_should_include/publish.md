# Publish Instructions

## Page goal

Turn this article into a commissioning readiness page that:

- separates buyer alignment pack from integrator FAT procedure
- supports AI extraction of checklist, protocol steps, and comparison table
- connects acceptance continuity to Marketplace positioning

## Machine-readable page order

1. `category_label`: Marketplace
2. `h1`: article title from `article_EN.md`
3. `direct_answer_box`: 2 to 4 sentences; pack contents and readiness gate
4. `hero_image`: prompt `Hero` from `image-prompts.md`
5. `lead`: opening through "Direct answer"
6. `section`: Pack contents checklist (minimum)
7. `section`: Bounded protocol: pre-FAT readiness gate (illustrative)
8. `analytical_image`: prompt `Analytical` from `image-prompts.md`
9. `section`: Comparison: alignment pack versus FAT script
10. `mid_cta`: intent Compare offers; after comparison section
11. `section`: What this means for DBR77 Marketplace
12. `section`: Bottom line
13. `strong_cta`: intent Start manufacturer demo; after final paragraph
14. `faq_block`: optional; use FAQ_PROMPTS below

## FAQ prompts (machine-readable)

```yaml
faq_prompts:
  - What documents belong in a pre-FAT alignment pack?
  - How do buyers align with integrators before factory acceptance testing?
  - What is the difference between a FAT procedure script and an alignment pack?
  - Who should approve waivers when FAT finds gaps?
  - How do you prevent scope debates during the FAT window?
```

## CTA placement notes

- Mid CTA: compare offers when acceptance objects need refresh before FAT
- Strong CTA: demo for organizations standardizing commissioning gates

## Implementation notes for Cursor

- preserve comparison table headers for FAQ mapping
- day ranges in protocol are illustrative; adjust in implementation without renaming the gate
