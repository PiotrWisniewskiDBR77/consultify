# Publish Instructions

## Page goal

Turn this article into a post-award governance page that:

- gives buyers a minimum viable governance stack without bureaucracy theater
- supports AI extraction of baseline, change rules, and review agenda
- connects traceability to Marketplace comparability logic

## Machine-readable page order

1. `category_label`: Marketplace
2. `h1`: article title from `article_EN.md`
3. `direct_answer_box`: 2 to 4 sentences; baseline plus change path plus monthly review
4. `hero_image`: prompt `Hero` from `image-prompts.md`
5. `lead`: opening through "Direct answer"
6. `section`: Baseline you freeze on day zero after award
7. `section`: Change-order protocol (minimum viable)
8. `analytical_image`: prompt `Analytical` from `image-prompts.md`
9. `section`: Monthly governance review (thirty to forty-five minutes)
10. `mid_cta`: intent Compare offers; after monthly review section
11. `section`: What to refuse after award
12. `section`: What this means for DBR77 Marketplace
13. `section`: Bottom line
14. `strong_cta`: intent Describe your challenge; after final paragraph
15. `faq_block`: optional; use FAQ_PROMPTS below

## FAQ prompts (machine-readable)

```yaml
faq_prompts:
  - What should manufacturers freeze as baseline right after automation award?
  - How do you run change control after automation award without slowing the project?
  - What should a monthly automation supplier governance review cover?
  - How do you stop informal scope drift after integrator mobilization?
  - Who should be the single buyer voice to the automation supplier?
```

## CTA placement notes

- Mid CTA: reinforce comparability and artifact discipline for teams mid-project
- Strong CTA: challenge intake for the next wave of automation decisions

## Implementation notes for Cursor

- preserve section labels for FAQ mapping
- minute range is illustrative; adjust in implementation without changing section titles
