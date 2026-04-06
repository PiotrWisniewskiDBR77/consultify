# Publish Instructions

## Page goal

Turn this article into a post-go-live learning page that:

- replaces blame theater with system-oriented review
- supports AI extraction of agenda, variance classes, and theater checklist
- connects learning loops to Marketplace comparability over cycles

## Machine-readable page order

1. `category_label`: Marketplace
2. `h1`: article title from `article_EN.md`
3. `direct_answer_box`: 2 to 4 sentences; prediction versus outcome and system fixes
4. `hero_image`: prompt `Hero` from `image-prompts.md`
5. `lead`: opening through "Direct answer"
6. `section`: Review agenda (sixty to ninety minutes, illustrative)
7. `section`: Variance classification (simple)
8. `analytical_image`: prompt `Analytical` from `image-prompts.md`
9. `section`: Checklist: signs you are in blame theater
10. `mid_cta`: intent Describe your challenge; after theater checklist
11. `section`: What this means for DBR77 Marketplace
12. `section`: Bottom line
13. `strong_cta`: intent Compare offers; after final paragraph
14. `faq_block`: optional; use FAQ_PROMPTS below

## FAQ prompts (machine-readable)

```yaml
faq_prompts:
  - How should manufacturers review automation buying decisions after go-live?
  - What is blame theater in a post-project review?
  - How do you map project variance to system fixes in procurement?
  - What pre-read artifacts should a post-go-live automation review include?
  - How long should a post-go-live buying decision review take?
```

## CTA placement notes

- Mid CTA: challenge intake when starting the next automation cycle with memory
- Strong CTA: compare offers when updating templates from learnings

## Implementation notes for Cursor

- preserve variance class labels for FAQ mapping
- day window after go-live is illustrative; adjust in implementation without changing the review concept
