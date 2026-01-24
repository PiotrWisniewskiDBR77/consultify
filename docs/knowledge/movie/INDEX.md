# Knowledge Base Video Scripts Index

This directory contains all English video scripts ready for HeyGen recording.
Each file is named to match its corresponding Knowledge Base article slug.

## Naming Convention

```
[slug].script.md
```

Where `[slug]` matches the `slug` field in the `kb_articles` table from `270_knowledge_base_public_articles.sql`.

---

## Quick Reference Table

| Script File | KB Article Slug | Duration | Category |
|-------------|-----------------|----------|----------|
| `getting-started-guide.script.md` | `getting-started-guide` | ~2:00 | Quick Guides |
| `ai-chat-assistant.script.md` | `ai-chat-assistant` | ~1:30 | Quick Guides |
| `drd-methodology-overview.script.md` | `drd-methodology-overview` | ~3:00 | Methodologies |
| `10-dimension-audit-framework.script.md` | `10-dimension-audit-framework` | ~4:00 | Methodologies |
| `oee-calculation-best-practices.script.md` | `oee-best-practices` | ~3:00 | Best Practices |
| `esg-carbon-strategy.script.md` | `esg-carbon-strategy` | ~2:30 | Industrial |
| `hse-digital-culture.script.md` | `hse-digital-culture` | ~2:30 | Industrial |
| `qms-total-quality.script.md` | `qms-total-quality` | ~2:30 | Industrial |
| `wms-strategic-inventory.script.md` | `wms-strategic-inventory` | ~2:45 | Industrial |
| `workforce-transformation.script.md` | `workforce-transformation` | ~2:45 | Industrial |
| `lean-4-0-principles.script.md` | `lean-4-0-principles-digital-excellence` | ~3:00 | Methodologies |
| `automotive-oem-predictive-maintenance-case-study.script.md` | `automotive-oem-predictive-maintenance-case-study` | ~3:00 | Case Studies |

---

## How to Match Scripts to KB Articles

1. Open `server/migrations/270_knowledge_base_public_articles.sql`
2. Find the article by searching for its `slug` value
3. The `video_url` field in `kb_articles` should point to the uploaded HeyGen video
4. The `video_script` field in `kb_article_translations` can store the script text for reference

---

## Production Workflow

1. **Record**: Use HeyGen with Dr. Piotr Wiśniewski avatar
2. **Upload**: Store video in cloud storage (S3/GCS)
3. **Link**: Update `video_url` in `kb_articles` table
4. **Embed**: Videos will auto-display in `KnowledgeArticleView` component

---

## Files in This Directory

- `INDEX.md` — This file
- `getting-started-guide.script.md`
- `ai-chat-assistant.script.md`
- `drd-methodology-overview.script.md`
- `10-dimension-audit-framework.script.md`
- `oee-calculation-best-practices.script.md`
- `esg-carbon-strategy.script.md`
- `hse-digital-culture.script.md`
- `qms-total-quality.script.md`
- `wms-strategic-inventory.script.md`
- `workforce-transformation.script.md`
- `lean-4-0-principles.script.md`
- `automotive-oem-predictive-maintenance-case-study.script.md`

---

## Help Tutorial Videos (Onboarding Series)

10 tutorial videos designed to teach new users how to work with the platform. Should be shown in sequence during onboarding.

| # | Script File | KB Article Slug | Duration |
|---|-------------|-----------------|----------|
| 01 | `tutorial-01-first-steps.script.md` | `tutorial-first-steps` | ~2:00 |
| 02 | `tutorial-02-dashboard-navigation.script.md` | `tutorial-dashboard-navigation` | ~2:30 |
| 03 | `tutorial-03-first-assessment.script.md` | `tutorial-first-assessment` | ~3:00 |
| 04 | `tutorial-04-maturity-score.script.md` | `tutorial-maturity-score` | ~2:30 |
| 05 | `tutorial-05-ai-recommendations.script.md` | `tutorial-ai-recommendations` | ~2:30 |
| 06 | `tutorial-06-managing-initiatives.script.md` | `tutorial-managing-initiatives` | ~2:30 |
| 07 | `tutorial-07-roadmap.script.md` | `tutorial-roadmap` | ~2:30 |
| 08 | `tutorial-08-reports.script.md` | `tutorial-reports` | ~2:00 |
| 09 | `tutorial-09-team-collaboration.script.md` | `tutorial-team-collaboration` | ~2:30 |
| 10 | `tutorial-10-ai-chat.script.md` | `tutorial-ai-chat` | ~2:00 |

**Total Tutorial Runtime:** ~24 minutes
