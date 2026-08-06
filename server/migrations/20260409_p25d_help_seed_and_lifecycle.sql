-- P25-D: Help content seed minimum + lifecycle columns + deprecation support
-- Contract: §2.3.4 seed minimum, §2.3.4 lifecycle, §2.3.7 pkt 13 deprecation

-- ============================================================
-- 1. Add lifecycle and deprecation columns to kb_articles
-- ============================================================

ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS last_reviewed_at TEXT DEFAULT NULL;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS content_owner TEXT DEFAULT NULL;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS redirect_to_slug TEXT DEFAULT NULL;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ============================================================
-- 2. Seed: Help overview article (§2.3.4 requirement)
-- ============================================================

INSERT INTO kb_articles (
  id, slug, category_id, status, is_featured, reading_time_minutes,
  sort_order, next_action, related_modules, last_reviewed_at, content_owner
) VALUES (
  'kb-art-help-overview',
  'help-overview',
  (SELECT id FROM kb_categories WHERE slug = 'getting-started' LIMIT 1),
  'published', 1, 3, 1,
  '{"route":"/"}',
  '["help"]',
  '2026-04-09', 'product'
) ON CONFLICT DO NOTHING;

INSERT INTO kb_article_translations (
  id, article_id, language, title, summary, content
) SELECT
  'kb-art-trans-help-overview-en', id, 'en',
  'Help in Consultify — how it works and where to find support',
  'A complete guide to the Consultify Help system: contextual help, search, knowledge base, and AI assistance.',
  '# Help in Consultify

## How Help works

Consultify''s Help system is designed to guide you in context — wherever you are in the application, help is always one click away.

### Entry points

- **Help button** (?) on every screen opens the Help side panel with contextual guidance for your current view.
- **Cmd+K / Ctrl+K** opens global search across all help content.
- **Ask AI** connects you with Teresa, your in-app copilot, who can answer questions grounded in our knowledge base.

### What you''ll find

1. **This Step** — explains what the current screen does, what you should do here, and what comes next.
2. **Quick Guides** — short, focused articles on specific topics related to your current work.
3. **Knowledge Base** — the full library of articles, organized by category and searchable.
4. **FAQ** — frequently asked questions for quick answers.

### Language support

Help content is available in English and Polish. If a Polish translation is not yet available, you''ll see the English version with a clear notification.

### AI assistance

When you click "Ask AI", Teresa receives context about where you are and what help documents are relevant. She cites specific knowledge base articles — never invents information.

## Getting more help

- Use the search to find articles by keyword
- Browse knowledge base collections for curated content
- Ask Teresa for step-by-step guidance'
FROM kb_articles WHERE slug = 'help-overview'
ON CONFLICT DO NOTHING;

INSERT INTO kb_article_translations (
  id, article_id, language, title, summary, content
) SELECT
  'kb-art-trans-help-overview-pl', id, 'pl',
  'Help w Consultify — jak działa i gdzie szukać wsparcia',
  'Kompletny przewodnik po systemie Help w Consultify: pomoc kontekstowa, wyszukiwarka, baza wiedzy i asystent AI.',
  '# Help w Consultify

## Jak działa Help

System Help w Consultify jest zaprojektowany, aby prowadzić Cię w kontekście — gdziekolwiek jesteś w aplikacji, pomoc jest zawsze na wyciągnięcie ręki.

### Punkty wejścia

- **Przycisk Help** (?) na każdym ekranie otwiera panel boczny z pomocą kontekstową dla bieżącego widoku.
- **Cmd+K / Ctrl+K** otwiera globalne wyszukiwanie w całej bazie pomocy.
- **Zapytaj AI** łączy Cię z Teresą, Twoim asystentem w aplikacji, który odpowiada na pytania na podstawie bazy wiedzy.

### Co znajdziesz

1. **Ten krok** — wyjaśnia, co robi bieżący ekran, co powinieneś tu zrobić i co dalej.
2. **Szybkie przewodniki** — krótkie, skoncentrowane artykuły na tematy związane z bieżącą pracą.
3. **Baza wiedzy** — pełna biblioteka artykułów, uporządkowana wg kategorii i przeszukiwalna.
4. **FAQ** — najczęściej zadawane pytania dla szybkich odpowiedzi.

### Wsparcie językowe

Treści Help są dostępne po angielsku i polsku. Jeśli tłumaczenie polskie nie jest jeszcze dostępne, zobaczysz wersję angielską z wyraźnym powiadomieniem.

### Asystent AI

Gdy klikniesz „Zapytaj AI", Teresa otrzymuje kontekst o tym, gdzie jesteś i jakie artykuły są istotne. Cytuje konkretne artykuły z bazy wiedzy — nigdy nie wymyśla informacji.

## Więcej pomocy

- Użyj wyszukiwarki, aby znaleźć artykuły po słowach kluczowych
- Przeglądaj kolekcje bazy wiedzy po wyselekcjonowane treści
- Zapytaj Teresę o krok po kroku'
FROM kb_articles WHERE slug = 'help-overview'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Seed: Search guide article (§2.3.4 requirement)
-- ============================================================

INSERT INTO kb_articles (
  id, slug, category_id, status, is_featured, reading_time_minutes,
  sort_order, next_action, related_modules, last_reviewed_at, content_owner
) VALUES (
  'kb-art-help-search-guide',
  'help-search-guide',
  (SELECT id FROM kb_categories WHERE slug = 'getting-started' LIMIT 1),
  'published', 0, 2, 2,
  '{"route":"/"}',
  '["help"]',
  '2026-04-09', 'product'
) ON CONFLICT DO NOTHING;

INSERT INTO kb_article_translations (
  id, article_id, language, title, summary, content
) SELECT
  'kb-art-trans-help-search-guide-en', id, 'en',
  'How Help search works and how to interpret results',
  'Learn how to use the Help search effectively: search operators, result types, language indicators, and tips for finding what you need.',
  '# How Help Search Works

## Quick search (Cmd+K / Ctrl+K)

Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) from anywhere in the app to open the global help search.

### What gets searched

- **Modules** — all application modules and their descriptions
- **Articles** — knowledge base articles (full text)
- **FAQ** — frequently asked questions and answers
- **Videos** — tutorial video titles and descriptions

### Reading results

Each result shows:
- **Title** — the name of the content
- **Type badge** — Module, Article, FAQ, or Video
- **Language badge** — if you are in Polish mode and the content is only available in English, you will see an **EN-only** badge
- **Excerpt** — a preview of the matching content

### Tips for better results

1. Use **specific keywords** rather than full sentences
2. Try both English and Polish terms
3. Use the **filter tabs** (All, Module, Card, FAQ, Video) to narrow results
4. If no results: try alternative keywords or browse the suggested categories

### Keyboard navigation

- **↑↓** to navigate between results
- **↵ Enter** to open the selected result
- **Esc** to close search'
FROM kb_articles WHERE slug = 'help-search-guide'
ON CONFLICT DO NOTHING;

INSERT INTO kb_article_translations (
  id, article_id, language, title, summary, content
) SELECT
  'kb-art-trans-help-search-guide-pl', id, 'pl',
  'Jak działa wyszukiwarka Help i jak interpretować wyniki',
  'Dowiedz się, jak efektywnie korzystać z wyszukiwarki Help: typy wyników, wskaźniki językowe i wskazówki.',
  '# Jak działa wyszukiwarka Help

## Szybkie wyszukiwanie (Cmd+K / Ctrl+K)

Naciśnij **Cmd+K** (Mac) lub **Ctrl+K** (Windows/Linux) z dowolnego miejsca w aplikacji, aby otworzyć globalne wyszukiwanie.

### Co jest przeszukiwane

- **Moduły** — wszystkie moduły aplikacji i ich opisy
- **Artykuły** — artykuły bazy wiedzy (pełny tekst)
- **FAQ** — najczęściej zadawane pytania i odpowiedzi
- **Wideo** — tytuły i opisy tutoriali wideo

### Czytanie wyników

Każdy wynik pokazuje:
- **Tytuł** — nazwa treści
- **Badge typu** — Moduł, Artykuł, FAQ lub Wideo
- **Badge języka** — jeśli jesteś w trybie polskim i treść jest dostępna tylko po angielsku, zobaczysz badge **EN-only**
- **Fragment** — podgląd pasującej treści

### Wskazówki dla lepszych wyników

1. Używaj **konkretnych słów kluczowych** zamiast pełnych zdań
2. Próbuj zarówno angielskich, jak i polskich terminów
3. Użyj **zakładek filtrów** (Wszystko, Moduł, Karta, FAQ, Wideo) aby zawęzić wyniki
4. Brak wyników: spróbuj alternatywnych słów kluczowych lub przeglądaj sugerowane kategorie

### Nawigacja klawiaturowa

- **↑↓** nawigacja między wynikami
- **↵ Enter** otwarcie wybranego wyniku
- **Esc** zamknięcie wyszukiwarki'
FROM kb_articles WHERE slug = 'help-search-guide'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Backfill last_reviewed_at for P25-B primers
-- ============================================================

UPDATE kb_articles SET last_reviewed_at = '2026-03-31', content_owner = 'engineering'
WHERE slug IN ('p25b-tools-primer', 'p25b-interview-primer', 'p25b-outputs-primer', 'p25b-en-only')
  AND last_reviewed_at IS NULL;

-- ============================================================
-- 5. Enhance P25-B primer content (richer, actually helpful)
-- ============================================================

UPDATE kb_article_translations SET
  content = '# Tools — Your Starting Point

## What are Tools?

Tools are specialized consulting instruments built into Consultify. Each tool helps you analyze a specific aspect of your organization — from strategic positioning (Dynamic SWOT) to process optimization (VSM Builder) to digital maturity (AI Discovery).

## How to get started

1. **Browse the library** — Open the Tools module to see all available tools organized by category: Strategic, Operational, and Digital.
2. **Pick a tool** — Select the tool most relevant to your current need. Start with **Dynamic SWOT** if unsure.
3. **Run the analysis** — Follow the guided flow: provide inputs, let AI process, review results.
4. **Use the output** — Results feed directly into Initiatives, Reports, and Presentations.

## What comes next

After running your first tool, you can:
- Create an **Initiative** based on the findings
- Generate a **Report** for stakeholders
- Ask **Teresa** to interpret results and suggest next steps

## Tips

- Each tool has a dedicated help article (look for "How to use: [Tool Name]" in Knowledge Base)
- You can run multiple tools and compare results
- Tool outputs are saved automatically and linked to your project'
WHERE article_id = (SELECT id FROM kb_articles WHERE slug = 'p25b-tools-primer')
  AND language = 'en';

UPDATE kb_article_translations SET
  content = '# Tools — Twój punkt startowy

## Czym są Narzędzia?

Narzędzia to specjalistyczne instrumenty konsultingowe wbudowane w Consultify. Każde narzędzie pomaga analizować konkretny aspekt organizacji — od pozycjonowania strategicznego (Dynamic SWOT) przez optymalizację procesów (VSM Builder) po dojrzałość cyfrową (AI Discovery).

## Jak zacząć

1. **Przeglądaj bibliotekę** — Otwórz moduł Narzędzia, aby zobaczyć wszystkie dostępne narzędzia pogrupowane wg kategorii: Strategiczne, Operacyjne i Cyfrowe.
2. **Wybierz narzędzie** — Wybierz najbardziej odpowiednie dla bieżącej potrzeby. Zacznij od **Dynamic SWOT**, jeśli nie wiesz od czego.
3. **Uruchom analizę** — Postępuj zgodnie z prowadzonym przepływem: podaj dane wejściowe, pozwól AI przetworzyć, przejrzyj wyniki.
4. **Wykorzystaj wyniki** — Rezultaty zasilają bezpośrednio Inicjatywy, Raporty i Prezentacje.

## Co dalej

Po uruchomieniu pierwszego narzędzia możesz:
- Stworzyć **Inicjatywę** na podstawie ustaleń
- Wygenerować **Raport** dla interesariuszy
- Zapytać **Teresę** o interpretację wyników i sugestie kolejnych kroków

## Wskazówki

- Każde narzędzie ma dedykowany artykuł pomocy (szukaj „Jak używać: [Nazwa narzędzia]" w Bazie Wiedzy)
- Możesz uruchomić wiele narzędzi i porównać wyniki
- Wyniki narzędzi są zapisywane automatycznie i powiązane z Twoim projektem'
WHERE article_id = (SELECT id FROM kb_articles WHERE slug = 'p25b-tools-primer')
  AND language = 'pl';

UPDATE kb_article_translations SET
  content = '# Interview — Start Here

## What is the Interview?

The Interview is Consultify''s guided discovery process. It is a structured conversation that helps you articulate your organization''s context, challenges, and aspirations — which then powers all AI analysis and recommendations.

## How to get started

1. **Open Interview** — Navigate to the Interview module from the main menu.
2. **Answer questions** — The system guides you through topics: industry, scale, challenges, maturity, goals.
3. **Review context** — After the interview, review the captured context and refine if needed.
4. **Proceed to analysis** — Your interview data powers Tools, Initiatives, and AI recommendations.

## What comes next

- **Run assessments** using licensed frameworks (DRD, SIRI, ADMA, LEAN)
- **Generate initiatives** with AI based on your context
- **Ask Teresa** to explain findings or suggest priorities

## Tips

- Be honest and specific — AI quality depends on context quality
- You can update your interview anytime as your situation evolves
- Interview context is shared across all modules for consistency'
WHERE article_id = (SELECT id FROM kb_articles WHERE slug = 'p25b-interview-primer')
  AND language = 'en';

UPDATE kb_article_translations SET
  content = '# Interview — Zacznij tutaj

## Czym jest Interview?

Interview to prowadzony proces odkrywania w Consultify. Jest to ustrukturyzowana rozmowa, która pomaga wyartykułować kontekst organizacji, wyzwania i aspiracje — co zasila wszystkie analizy AI i rekomendacje.

## Jak zacząć

1. **Otwórz Interview** — Przejdź do modułu Interview z menu głównego.
2. **Odpowiedz na pytania** — System prowadzi Cię przez tematy: branża, skala, wyzwania, dojrzałość, cele.
3. **Przejrzyj kontekst** — Po wywiadzie przejrzyj uchwycony kontekst i doprecyzuj w razie potrzeby.
4. **Przejdź do analizy** — Dane z wywiadu zasilają Narzędzia, Inicjatywy i rekomendacje AI.

## Co dalej

- **Uruchom oceny** przy użyciu licencjonowanych frameworków (DRD, SIRI, ADMA, LEAN)
- **Generuj inicjatywy** z AI na podstawie Twojego kontekstu
- **Zapytaj Teresę** o wyjaśnienie ustaleń lub sugestie priorytetów

## Wskazówki

- Bądź szczery i konkretny — jakość AI zależy od jakości kontekstu
- Możesz zaktualizować swój wywiad w dowolnym momencie
- Kontekst wywiadu jest współdzielony między wszystkimi modułami'
WHERE article_id = (SELECT id FROM kb_articles WHERE slug = 'p25b-interview-primer')
  AND language = 'pl';

UPDATE kb_article_translations SET
  content = '# Outputs & Results — Start Here

## What are Outputs?

Outputs is where all your work comes together. Reports, presentations, and deliverables generated from your tools, initiatives, and analyses live here.

## How to get started

1. **Browse outputs** — Open the Outputs module to see all generated deliverables.
2. **Generate from work** — After running tools or creating initiatives, click "Generate Report" or "Create Presentation".
3. **Customize** — Edit generated content, add your insights, and adjust formatting.
4. **Share** — Export as PDF, PowerPoint, or share directly with stakeholders.

## What comes next

- Review AI-generated **executive summaries** for key stakeholders
- Create **meeting presentations** from your initiative portfolio
- Track **benefits realization** against projected outcomes

## Tips

- Outputs update automatically when underlying data changes
- Use Teresa to help interpret results or draft executive summaries
- Pin important outputs for quick access from your dashboard'
WHERE article_id = (SELECT id FROM kb_articles WHERE slug = 'p25b-outputs-primer')
  AND language = 'en';

UPDATE kb_article_translations SET
  content = '# Outputs i Wyniki — Zacznij tutaj

## Czym są Outputs?

Outputs to miejsce, gdzie cała Twoja praca się zbiera. Raporty, prezentacje i dostarczenia wygenerowane z narzędzi, inicjatyw i analiz znajdują się tutaj.

## Jak zacząć

1. **Przeglądaj wyniki** — Otwórz moduł Outputs, aby zobaczyć wszystkie wygenerowane materiały.
2. **Generuj z pracy** — Po uruchomieniu narzędzi lub stworzeniu inicjatyw kliknij „Generuj raport" lub „Stwórz prezentację".
3. **Dostosuj** — Edytuj wygenerowaną treść, dodaj swoje spostrzeżenia, dostosuj formatowanie.
4. **Udostępnij** — Eksportuj jako PDF, PowerPoint lub udostępnij bezpośrednio interesariuszom.

## Co dalej

- Przejrzyj generowane przez AI **streszczenia dla kadry zarządzającej**
- Stwórz **prezentacje na spotkania** z portfela inicjatyw
- Śledź **realizację korzyści** w porównaniu z prognozowanymi wynikami

## Wskazówki

- Wyniki aktualizują się automatycznie, gdy bazowe dane się zmieniają
- Użyj Teresy, aby pomogła zinterpretować wyniki lub przygotować streszczenia
- Przypnij ważne wyniki, aby mieć szybki dostęp z dashboardu'
WHERE article_id = (SELECT id FROM kb_articles WHERE slug = 'p25b-outputs-primer')
  AND language = 'pl';
