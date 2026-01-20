-- Migration: 270_knowledge_base_public_articles.sql
-- Purpose: Create tables for public Knowledge Base articles with translations
-- Date: 2026-01-20
-- Context: Supports in-app help library and landing page preview

-- ============================================
-- KNOWLEDGE CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS kb_categories (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT NOT NULL DEFAULT 'BookOpen',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_public INTEGER DEFAULT 0, -- Visible on landing page
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_categories_slug ON kb_categories(slug);
CREATE INDEX IF NOT EXISTS idx_kb_categories_active ON kb_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_kb_categories_public ON kb_categories(is_public);

-- ============================================
-- KNOWLEDGE ARTICLES
-- ============================================
CREATE TABLE IF NOT EXISTS kb_articles (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES kb_categories(id),
    slug TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, published, archived
    is_featured INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0, -- Visible on landing page
    view_count INTEGER DEFAULT 0,
    reading_time_minutes INTEGER DEFAULT 3,
    thumbnail_url TEXT,
    video_url TEXT, -- Full HeyGen video
    video_teaser_url TEXT, -- Short teaser for landing page
    related_modules TEXT, -- JSON array: ["mes", "wms", "qms"]
    target_audience TEXT, -- JSON array: ["operator", "manager"]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_public ON kb_articles(is_public);
CREATE INDEX IF NOT EXISTS idx_kb_articles_featured ON kb_articles(is_featured);

-- ============================================
-- KNOWLEDGE CATEGORY TRANSLATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS kb_category_translations (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES kb_categories(id) ON DELETE CASCADE,
    language TEXT NOT NULL, -- en, pl, de, es, ar, ja
    name TEXT NOT NULL,
    description TEXT,
    UNIQUE(category_id, language)
);

CREATE INDEX IF NOT EXISTS idx_kb_cat_trans_category ON kb_category_translations(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_cat_trans_lang ON kb_category_translations(language);

-- ============================================
-- KNOWLEDGE ARTICLE TRANSLATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS kb_article_translations (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
    language TEXT NOT NULL, -- en, pl, de, es, ar, ja
    title TEXT NOT NULL,
    summary TEXT, -- Short text for landing page preview
    content TEXT, -- Full Markdown content
    video_script TEXT, -- HeyGen script for this language
    UNIQUE(article_id, language)
);

CREATE INDEX IF NOT EXISTS idx_kb_art_trans_article ON kb_article_translations(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_art_trans_lang ON kb_article_translations(language);

-- ============================================
-- ARTICLE VIEW TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS kb_article_views (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
    user_id TEXT, -- NULL for anonymous views
    session_id TEXT,
    source TEXT DEFAULT 'in_app', -- in_app, landing, help_panel
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_views_article ON kb_article_views(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_views_created ON kb_article_views(created_at);

-- ============================================
-- SEED DATA: CATEGORIES
-- ============================================
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-quick-guides', 'quick-guides', 'Rocket', 1, 1, 1),
    ('kb-cat-methodologies', 'methodologies', 'BookOpen', 2, 1, 1),
    ('kb-cat-best-practices', 'best-practices', 'Sparkles', 3, 1, 1),
    ('kb-cat-case-studies', 'case-studies', 'FolderOpen', 4, 1, 0),
    ('kb-cat-tools-features', 'tools-features', 'Wrench', 5, 1, 0);

-- Category translations: English
INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-quick-en', 'kb-cat-quick-guides', 'en', 'Quick Guides', 'Get started tutorials and step-by-step instructions'),
    ('kb-cat-trans-meth-en', 'kb-cat-methodologies', 'en', 'Methodologies', 'DRD, SIRI, Lean 4.0, CMMI and other transformation frameworks'),
    ('kb-cat-trans-best-en', 'kb-cat-best-practices', 'en', 'Best Practices', 'Industry patterns and proven approaches'),
    ('kb-cat-trans-case-en', 'kb-cat-case-studies', 'en', 'Case Studies', 'Customer success stories and implementations'),
    ('kb-cat-trans-tools-en', 'kb-cat-tools-features', 'en', 'Tools & Features', 'Platform deep-dives and feature guides');

-- Category translations: Polish
INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-quick-pl', 'kb-cat-quick-guides', 'pl', 'Szybkie Przewodniki', 'Tutoriale i instrukcje krok po kroku'),
    ('kb-cat-trans-meth-pl', 'kb-cat-methodologies', 'pl', 'Metodologie', 'DRD, SIRI, Lean 4.0, CMMI i inne frameworki transformacji'),
    ('kb-cat-trans-best-pl', 'kb-cat-best-practices', 'pl', 'Najlepsze Praktyki', 'Wzorce branżowe i sprawdzone podejścia'),
    ('kb-cat-trans-case-pl', 'kb-cat-case-studies', 'pl', 'Studia Przypadków', 'Historie sukcesu klientów i wdrożenia'),
    ('kb-cat-trans-tools-pl', 'kb-cat-tools-features', 'pl', 'Narzędzia i Funkcje', 'Szczegółowe przewodniki po platformie');

-- Category translations: German
INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-quick-de', 'kb-cat-quick-guides', 'de', 'Schnellanleitungen', 'Erste Schritte und Schritt-für-Schritt-Anleitungen'),
    ('kb-cat-trans-meth-de', 'kb-cat-methodologies', 'de', 'Methoden', 'DRD, SIRI, Lean 4.0, CMMI und andere Transformationsframeworks'),
    ('kb-cat-trans-best-de', 'kb-cat-best-practices', 'de', 'Best Practices', 'Branchenmuster und bewährte Ansätze'),
    ('kb-cat-trans-case-de', 'kb-cat-case-studies', 'de', 'Fallstudien', 'Kundenerfolgsgeschichten und Implementierungen'),
    ('kb-cat-trans-tools-de', 'kb-cat-tools-features', 'de', 'Tools & Funktionen', 'Plattform-Tieftauchgänge und Feature-Guides');

-- ============================================
-- SEED DATA: SAMPLE ARTICLES (First 3 Priority)
-- ============================================
INSERT OR IGNORE INTO kb_articles (id, category_id, slug, status, is_featured, is_public, reading_time_minutes, related_modules, target_audience) VALUES
    ('kb-art-drd-overview', 'kb-cat-methodologies', 'drd-methodology-overview', 'published', 1, 1, 5, '["assessment", "dashboard", "roadmap"]', '["manager", "executive", "consultant"]'),
    ('kb-art-getting-started', 'kb-cat-quick-guides', 'getting-started-consultinity', 'published', 1, 1, 3, '["dashboard", "assessment"]', '["all"]'),
    ('kb-art-oee-practices', 'kb-cat-best-practices', 'oee-calculation-best-practices', 'published', 1, 1, 4, '["mes", "kpi", "gemba"]', '["operator", "supervisor", "manager"]');

-- Article translations: DRD Methodology (EN)
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content, video_script) VALUES
    ('kb-art-trans-drd-en', 'kb-art-drd-overview', 'en', 
     'DRD Methodology Overview', 
     'Discover how Digital Readiness Diagnostic helps organizations assess their Industry 4.0 readiness across 7 critical dimensions.',
'# DRD Methodology Overview

## What is DRD?

**Digital Readiness Diagnostic (DRD)** is a comprehensive framework for assessing organizational readiness for digital transformation and Industry 4.0 adoption.

## Why DRD Matters

Studies show that **70% of digital transformation projects fail** to meet their objectives. The primary reason? Organizations jump into technology investments without understanding their true readiness.

DRD addresses this by providing:
- **Objective Assessment** - Data-driven evaluation across 7 dimensions
- **Gap Identification** - Specific areas where improvement is needed
- **Prioritized Roadmap** - Clear action plan based on impact and effort

## The 7 Dimensions

1. **Strategy** - Digital vision and leadership alignment
2. **Organization** - Structure and governance for transformation
3. **Technology** - Infrastructure and tool readiness
4. **Data** - Data management and analytics maturity
5. **People** - Skills and change management capability
6. **Processes** - Operational efficiency and automation
7. **Innovation** - Culture and capacity for innovation

## How Consultinity Helps

With Consultinity, the entire DRD assessment takes just **15 minutes**. Our AI analyzes your responses and generates:
- Comprehensive readiness score
- Benchmarks against industry peers
- Prioritized transformation roadmap
- AI-powered recommendations

## Getting Started

1. Navigate to Assessment Hub
2. Select "DRD - Digital Readiness Diagnostic"
3. Complete the 7-dimension questionnaire
4. Review your AI-generated report

Ready to discover your digital readiness score? Start your assessment today!',
'Hi, I''m your digital transformation guide from Consultinity. Today, let''s talk about DRD — Digital Readiness Diagnostic — the framework that''s helping organizations across Europe accelerate their Industry 4.0 journey.

Here''s the reality: Most digital transformation initiatives fail. Studies show that 70% of transformation projects don''t meet their objectives. Why? Because organizations jump into technology without understanding their true readiness.

DRD changes that. Here''s how:

First, it assesses your current state across 7 critical dimensions: Strategy, Organization, Technology, Data, People, Processes, and Innovation.

Second, it identifies concrete gaps — not vague recommendations, but specific areas where you''re falling behind industry benchmarks.

Third, it generates a prioritized roadmap. Which initiatives deliver the highest ROI? What should you tackle first? DRD tells you.

With Consultinity, the entire DRD assessment takes just 15 minutes. Our AI analyzes your responses and generates a comprehensive report with benchmarks against your industry peers.

Ready to discover your digital readiness score? Start your free trial at Consultinity.com and take the DRD assessment today. Your transformation journey begins now!');

-- Article translations: DRD Methodology (PL)
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content, video_script) VALUES
    ('kb-art-trans-drd-pl', 'kb-art-drd-overview', 'pl',
     'Metodologia DRD - Przegląd',
     'Dowiedz się, jak Digital Readiness Diagnostic pomaga organizacjom ocenić gotowość do Przemysłu 4.0 w 7 kluczowych wymiarach.',
'# Metodologia DRD - Przegląd

## Czym jest DRD?

**Digital Readiness Diagnostic (DRD)** to kompleksowy framework do oceny gotowości organizacji na transformację cyfrową i adopcję Przemysłu 4.0.

## Dlaczego DRD ma znaczenie

Badania pokazują, że **70% projektów transformacji cyfrowej nie osiąga swoich celów**. Główny powód? Organizacje inwestują w technologie bez zrozumienia swojej rzeczywistej gotowości.

DRD rozwiązuje ten problem oferując:
- **Obiektywną Ocenę** - Analizę opartą na danych w 7 wymiarach
- **Identyfikację Luk** - Konkretne obszary wymagające poprawy
- **Priorytetyzowana Mapa Drogowa** - Jasny plan działania

## 7 Wymiarów

1. **Strategia** - Wizja cyfrowa i zaangażowanie kierownictwa
2. **Organizacja** - Struktura i zarządzanie transformacją
3. **Technologia** - Infrastruktura i gotowość narzędzi
4. **Dane** - Zarządzanie danymi i dojrzałość analityczna
5. **Ludzie** - Kompetencje i zarządzanie zmianą
6. **Procesy** - Efektywność operacyjna i automatyzacja
7. **Innowacje** - Kultura i zdolność do innowacji

## Jak pomaga Consultinity

W Consultinity pełna ocena DRD zajmuje tylko **15 minut**. Nasza AI analizuje odpowiedzi i generuje:
- Kompleksowy wynik gotowości
- Benchmarki względem konkurencji
- Priorytetyzowaną mapę drogową
- Rekomendacje oparte na AI

## Rozpocznij

1. Przejdź do Assessment Hub
2. Wybierz "DRD - Digital Readiness Diagnostic"
3. Wypełnij kwestionariusz 7 wymiarów
4. Przejrzyj raport wygenerowany przez AI

Gotowy poznać swój wynik gotowości cyfrowej? Rozpocznij ocenę już dziś!',
'Cześć, jestem Twoim przewodnikiem po transformacji cyfrowej z Consultinity. Dziś porozmawiamy o DRD — Digital Readiness Diagnostic — frameworku, który pomaga organizacjom w całej Europie przyspieszyć drogę do Przemysłu 4.0.

Oto rzeczywistość: Większość inicjatyw transformacji cyfrowej kończy się niepowodzeniem. Badania pokazują, że 70% projektów transformacyjnych nie osiąga swoich celów. Dlaczego? Bo organizacje rzucają się na technologie bez zrozumienia swojej prawdziwej gotowości.

DRD to zmienia. Oto jak:

Po pierwsze, ocenia Twój obecny stan w 7 kluczowych wymiarach: Strategia, Organizacja, Technologia, Dane, Ludzie, Procesy i Innowacje.

Po drugie, identyfikuje konkretne luki — nie ogólne rekomendacje, ale specificzne obszary, w których zostajesz w tyle za benchmarkami branżowymi.

Po trzecie, generuje priorytetyzowaną mapę drogową. Które inicjatywy przyniosą najwyższy ROI? Co powinieneś zrobić najpierw? DRD Ci to powie.

Z Consultinity, cała ocena DRD zajmuje tylko 15 minut. Nasza AI analizuje Twoje odpowiedzi i generuje kompleksowy raport z benchmarkami względem konkurentów.

Gotowy odkryć swój wynik gotowości cyfrowej? Rozpocznij darmowy trial na Consultinity.com i wykonaj ocenę DRD już dziś. Twoja podróż transformacyjna zaczyna się teraz!');

-- Article translations: Getting Started (EN)
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content, video_script) VALUES
    ('kb-art-trans-gs-en', 'kb-art-getting-started', 'en',
     'Getting Started with Consultinity',
     'Your first steps in the platform: from assessment to AI-powered recommendations in under 10 minutes.',
'# Getting Started with Consultinity

## Welcome to Your Transformation Journey

Consultinity is your AI-powered PMO platform for digital transformation. This guide will help you get value from the platform in under 10 minutes.

## Step 1: Complete Quick Assessment (5 min)

Start with our Quick Assessment to get instant AI recommendations:

1. Go to **Dashboard** → Click **"Start Quick Assessment"**
2. Answer 15 questions about your organization
3. AI generates personalized recommendations immediately

## Step 2: Explore Your Dashboard

Your dashboard shows:
- **Maturity Score** - Overall digital readiness
- **Active Initiatives** - Transformation projects in progress
- **AI Recommendations** - Prioritized next steps
- **Team Activity** - Recent actions by your team

## Step 3: Review AI Recommendations

Based on your assessment, AI generates:
- Gap analysis across dimensions
- Prioritized initiative suggestions
- Estimated effort and impact scores
- Quick wins you can start today

## Step 4: Create Your First Initiative

Turn recommendations into action:
1. Click any recommendation card
2. Select "Create Initiative"
3. AI pre-fills details based on assessment
4. Assign team members and set timeline

## Pro Tips

- 💡 Use AI Chat anytime to ask questions
- 📊 Export reports for stakeholder presentations
- 🔔 Enable notifications for team updates
- 📱 Install PWA for mobile access

Ready to transform? Your journey starts now!',
'Welcome to Consultinity! I''m here to help you get started with the platform in just a few minutes.

First, let me show you the Quick Assessment. This 5-minute questionnaire will give you instant AI recommendations for your transformation journey. Just go to your Dashboard and click Start Quick Assessment.

Next, explore your Dashboard. Here you''ll see your maturity score, active initiatives, and AI-powered recommendations. Everything is designed to give you actionable insights at a glance.

Now, let''s look at the AI Recommendations. Based on your assessment, our AI generates prioritized initiatives with estimated effort and impact. You can see quick wins you can start today.

Finally, create your first initiative. Just click any recommendation, select Create Initiative, and AI will pre-fill the details for you. It''s that simple.

Pro tip: Use the AI Chat anytime to ask questions about your data or get personalized recommendations.

Ready to transform your organization? Start your free trial at Consultinity.com. See you inside!');

-- Article translations: OEE Best Practices (EN)
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content, video_script) VALUES
    ('kb-art-trans-oee-en', 'kb-art-oee-practices', 'en',
     'OEE Calculation Best Practices',
     'Master Overall Equipment Effectiveness with proper calculation methods, common pitfalls, and industry benchmarks.',
'# OEE Calculation Best Practices

## What is OEE?

**Overall Equipment Effectiveness (OEE)** is the gold standard for measuring manufacturing productivity. It identifies the percentage of planned production time that is truly productive.

## The OEE Formula

```
OEE = Availability × Performance × Quality
```

### Availability
- Tracks unplanned downtime
- Formula: (Run Time / Planned Production Time) × 100
- Common losses: Equipment failures, setup/adjustments

### Performance
- Tracks slow cycles and small stops
- Formula: (Ideal Cycle Time × Total Count) / Run Time × 100
- Common losses: Minor stops, reduced speed

### Quality
- Tracks defects and rework
- Formula: (Good Count / Total Count) × 100
- Common losses: Defects, startup rejects

## World-Class Benchmarks

| Metric | World-Class | Acceptable | Poor |
|--------|-------------|------------|------|
| OEE | 85%+ | 60-85% | <60% |
| Availability | 90%+ | 75-90% | <75% |
| Performance | 95%+ | 80-95% | <80% |
| Quality | 99%+ | 95-99% | <95% |

## Common Mistakes

1. ❌ Excluding planned downtime incorrectly
2. ❌ Using incorrect cycle times
3. ❌ Not counting all small stops
4. ❌ Manual data entry errors
5. ❌ Measuring OEE in isolation

## Best Practices

1. ✅ Use real-time data collection (IoT sensors)
2. ✅ Break down by shift, line, and product
3. ✅ Track the Six Big Losses
4. ✅ Set realistic improvement targets
5. ✅ Review trends, not just snapshots

## How Consultinity Helps

With Consultinity MES module:
- Automatic OEE calculation from IoT data
- Real-time dashboards by shift/line
- Six Big Losses analysis
- AI-powered improvement recommendations
- Historical trend analysis

Start tracking your OEE with precision today!',
'OEE — Overall Equipment Effectiveness — is the gold standard for measuring manufacturing productivity. But here''s the problem: most organizations calculate it wrong.

Today, I''ll show you the best practices for accurate OEE measurement.

First, let''s review the formula. OEE equals Availability times Performance times Quality. Each component tells a different story about your production losses.

Availability measures downtime. Performance tracks speed losses. Quality counts defects. Together, they give you the complete picture.

Now, the most common mistakes. Number one: excluding planned downtime incorrectly. Number two: using theoretical cycle times instead of real ones. Number three: not capturing all small stops.

Here are the best practices. Use real-time data collection with IoT sensors. Break down OEE by shift, line, and product. Track the Six Big Losses. And most importantly, review trends over time, not just daily snapshots.

With Consultinity''s MES module, you get automatic OEE calculation from IoT data, real-time dashboards, and AI-powered improvement recommendations.

Ready to measure OEE with precision? Start your free trial at Consultinity.com. Your journey to world-class manufacturing starts now!');
