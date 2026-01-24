# Knowledge Base Content Production

This directory contains all content assets for the IRIS 6.0 Knowledge Base.

## Quick Status

| Total Episodes | Ready for Recording | In Progress | Planned |
|----------------|---------------------|-------------|---------|
| 12 | **7** | 0 | 5 |

## Directory Structure

```
docs/knowledge/
├── README.md                    # This file
├── CONTENT_GUIDELINES.md        # Writing & video production standards
│
├── 01_quick_guides/             
│   ├── getting-started/         ✅ COMPLETE (EN, PL, article)
│   ├── first-assessment/        📋 Metadata only
│   └── ai-chat-basics/          ✅ Script ready (EN)
│
├── 02_methodologies/            
│   ├── drd-overview/            ✅ COMPLETE (EN, PL, teaser, article)
│   └── 10-dimension-audit/      ✅ COMPLETE (EN, teaser, article)
│
├── 03_best_practices/           
│   ├── oee-calculation/         ✅ COMPLETE (EN, PL, teaser, article)
│   ├── lean-manufacturing/      ✅ Script ready (EN)
│   └── continuous-improvement/  📋 Metadata only
│
├── 04_case_studies/             
│   └── automotive-plant/        ✅ COMPLETE (EN script, article)
│
└── 05_tools_features/           
    └── assessment-module/       📋 Metadata only
```

## Episode Folder Structure

Each episode folder should contain:

```
episode-name/
├── README.md               # Episode metadata (title, description, target audience)
├── SCRIPT_EN.md            # Full HeyGen script (English)
├── SCRIPT_PL.md            # Full HeyGen script (Polish)
├── SCRIPT_DE.md            # Full HeyGen script (German)
├── TEASER_SCRIPT.md        # 30-60 sec teaser script for Landing Page
├── article_content.md      # Written article content (Markdown)
├── thumbnail.png           # 1200×630px thumbnail image
├── video_full.mp4          # Full HeyGen video (after recording)
└── video_teaser.mp4        # Teaser video (after recording)
```

## Priority Episodes (Wave 1) — ALL READY

| # | Episode | Category | Files Ready | HeyGen |
|---|---------|----------|-------------|--------|
| 1 | **DRD Methodology Overview** | Methodologies | ✅ EN, PL, Teaser, Article | ⏳ To record |
| 2 | **Getting Started** | Quick Guides | ✅ EN, PL, Teaser, Article | ⏳ To record |
| 3 | **OEE Calculation Best Practices** | Best Practices | ✅ EN, PL, Teaser, Article | ⏳ To record |
| 4 | **10-Dimension Audit** | Methodologies | ✅ EN, Teaser, Article | ⏳ To record |
| 5 | **Automotive Plant Case Study** | Case Studies | ✅ EN Script, Article | ⏳ To record |
| 6 | **Lean Manufacturing Principles** | Best Practices | ✅ EN Script | ⏳ To record |
| 7 | **AI Chat Basics** | Quick Guides | ✅ EN Script | ⏳ To record |

## Content Production Workflow

1. **Write Article** → `article_content.md` ✅
2. **Create Scripts** → `SCRIPT_*.md` files ✅
3. **Design Thumbnail** → `thumbnail.png` ⏳
4. **Record in HeyGen** → Upload to episode folder ⏳
5. **Update Database** → Add URLs to `kb_articles` table ⏳

## HeyGen Recording Checklist

When recording in HeyGen:

1. Use script from `SCRIPT_EN.md` (or PL version)
2. Avatar: Dr. Piotr Wiśniewski (or professional avatar)
3. Export in 1080p MP4
4. Save as `video_full.mp4` in episode folder
5. Record teaser (30-60 sec) as `video_teaser.mp4`
6. Update database migration with video URLs

## Scripts Word Count

| Episode | EN Script | PL Script | Duration Est. |
|---------|-----------|-----------|---------------|
| DRD Overview | ~400 words | ~420 words | 3 min |
| Getting Started | ~320 words | ~340 words | 2 min |
| OEE Best Practices | ~420 words | ~440 words | 3 min |
| 10-Dimension Audit | ~480 words | — | 4 min |
| Automotive Case Study | ~450 words | — | 3 min |
| Lean Manufacturing | ~380 words | — | 3 min |
| AI Chat Basics | ~200 words | — | 1.5 min |

## Next Steps

1. ⏳ Record HeyGen videos for priority episodes
2. ⏳ Create thumbnail images (Canva template ready)
3. ⏳ Run DB migration: `npm run migrate`
4. ⏳ Upload videos to hosting (YouTube/Vimeo or HeyGen)
5. ⏳ Update `kb_articles` table with video URLs
