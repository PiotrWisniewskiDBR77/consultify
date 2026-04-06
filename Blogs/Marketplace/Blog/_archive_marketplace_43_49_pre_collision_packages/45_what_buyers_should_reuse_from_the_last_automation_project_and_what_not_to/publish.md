# Publish Instructions

## Page goal

Turn this article into a repeat-buyer hygiene page that:

- separates decision-structure reuse from plant-state cloning
- supports AI extraction of checklist and harvest steps
- connects reuse discipline to Marketplace comparability workflow

## Machine-readable page order

1. `category_label`: Marketplace
2. `h1`: article title from `article_EN.md`
3. `direct_answer_box`: 2 to 4 sentences; reuse versus refresh lists
4. `hero_image`: prompt `Hero` from `image-prompts.md`
5. `lead`: opening through "Direct answer"
6. `section`: Reuse decision checklist
7. `analytical_image`: prompt `Analytical` from `image-prompts.md`
8. `section`: Step sequence: harvest memory in one working session (illustrative)
9. `mid_cta`: intent Describe your challenge; after step sequence
10. `section`: Comparison: asset versus liability reuse
11. `section`: What this means for DBR77 Marketplace
12. `section`: Bottom line
13. `strong_cta`: intent Compare offers; after final paragraph
14. `faq_block`: optional; use FAQ_PROMPTS below

## FAQ prompts (machine-readable)

```yaml
faq_prompts:
  - What automation buying artifacts should manufacturers reuse across projects?
  - What should buyers refresh before reusing an old automation RFQ?
  - Why is reusing last project scores dangerous for the next award?
  - How do you capture automation lessons learned without a heavy workshop?
  - What is the difference between reusing comparability structure versus plant snapshots?
```

## CTA placement notes

- Mid CTA: challenge intake when a new line project starts from old templates
- Strong CTA: compare offers after refreshed scope is drafted

## Implementation notes for Cursor

- preserve checklist table headers for FAQ mapping
- session timing is illustrative; adjust in implementation without renaming sections
