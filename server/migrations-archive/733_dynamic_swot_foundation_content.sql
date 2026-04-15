-- Dynamic SWOT foundation content uplift
-- Align Known Tools preview and Help Center article with the new conversation-first,
-- outputs-first product direction.

UPDATE tools
SET
  description = 'AI-guided strategic SWOT that turns signals into tensions, recommended moves, and traceable outputs.',
  description_translations = '{
    "en": "AI-guided strategic SWOT that turns signals into tensions, recommended moves, and traceable outputs.",
    "pl": "SWOT prowadzony przez AI, który zamienia sygnały w napięcia strategiczne, rekomendowane ruchy i traceable outputy."
  }',
  library_content_translations = '{
    "en": {
      "shortDescription": "A conversation-first SWOT used to turn signals into strategic tensions, moves, and outputs.",
      "whenToUse": "Use when you need a shared strategic diagnosis and want to move quickly from discussion to concrete actions, initiatives, ideas, or executive deliverables.",
      "whatYouGet": ["Strategic tensions", "Recommended moves", "Initiative and idea candidates", "Ready path to report and presentation"],
      "inputs": ["Strategic question", "Scope and time horizon", "Internal signals", "External signals", "Known constraints or assumptions"],
      "steps": ["Mission Brief", "Internal Reality", "Market Reality", "Strategic Tensions", "Recommended Moves", "Outputs"],
      "outputs": ["Initiative", "Report", "Presentation", "Idea"],
      "commonMistakes": ["Treating SWOT as a static list", "Mixing symptoms with root causes", "Adding too many weak items", "Stopping at analysis instead of creating outputs"],
      "example": "Weakness: long onboarding cycle. Opportunity: higher demand for faster time-to-value. Move: create a standardized onboarding package. Output: one initiative for rollout and one idea for self-serve onboarding.",
      "nextSteps": ["Create one or more initiatives", "Create an executive report", "Create a strategy presentation", "Save emerging directions as ideas"]
    },
    "pl": {
      "shortDescription": "SWOT oparty na rozmowie z AI, który zamienia sygnały w napięcia strategiczne, ruchy i outputy.",
      "whenToUse": "Użyj, gdy potrzebujesz wspólnej diagnozy strategicznej i chcesz szybko przejść od rozmowy do działań, inicjatyw, pomysłów lub deliverables dla managementu.",
      "whatYouGet": ["Napięcia strategiczne", "Rekomendowane ruchy", "Kandydaci na inicjatywy i pomysły", "Gotową ścieżkę do raportu i prezentacji"],
      "inputs": ["Pytanie strategiczne", "Zakres i horyzont czasu", "Sygnały wewnętrzne", "Sygnały zewnętrzne", "Znane ograniczenia lub założenia"],
      "steps": ["Mission Brief", "Internal Reality", "Market Reality", "Strategic Tensions", "Recommended Moves", "Outputs"],
      "outputs": ["Inicjatywa", "Raport", "Prezentacja", "Pomysł"],
      "commonMistakes": ["Traktowanie SWOT jak statycznej listy", "Mieszanie objawów z przyczynami", "Dodawanie zbyt wielu słabych wpisów", "Kończenie na analizie zamiast tworzenia outputów"],
      "example": "Słabość: długi cykl onboardingu. Szansa: większy popyt na szybkie time-to-value. Ruch: standaryzowany pakiet onboardingu. Output: jedna inicjatywa wdrożeniowa i jeden pomysł na self-serve onboarding.",
      "nextSteps": ["Utwórz jedną lub więcej inicjatyw", "Utwórz raport dla managementu", "Utwórz prezentację strategiczną", "Zapisz nowe kierunki jako pomysły"]
    }
  }'
WHERE tool_type = 'dynamic-swot';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_articles'
  ) THEN
    UPDATE kb_articles
    SET
      is_featured = 1,
      reading_time_minutes = 6,
      related_modules = '["dynamic-swot"]',
      target_audience = '["consultant","manager","founder"]'
    WHERE id = 'kb-art-tools-dynamic-swot';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_article_translations'
  ) THEN
    UPDATE kb_article_translations
    SET
      title = 'How to use: Dynamic SWOT',
      summary = 'Run a conversation-first SWOT that surfaces strategic tensions, recommended moves, and outputs you can create immediately in Consultify.',
      content = '# Dynamic SWOT — How to use

## Purpose / when to use
Use Dynamic SWOT when you need a shared strategic diagnosis and want to quickly move from discussion to concrete outputs.

## What you need before you start
- Strategic question
- Scope and time horizon
- Known internal and external signals
- Constraints, assumptions, or evidence

## How the flow works
1) Define the mission brief
2) Capture internal reality
3) Capture market reality
4) Identify strategic tensions
5) Convert tensions into recommended moves
6) Create outputs

## How to interpret the result
Do not focus on having the longest list. Focus on the strongest tensions and the moves that are worth acting on now.

## Common mistakes
- Treating SWOT as a static matrix
- Listing too many weak items
- Mixing evidence with assumptions
- Stopping at summary only

## Example
Weakness: long onboarding cycle. Opportunity: higher demand for faster time-to-value. Move: create a standardized onboarding package.

## Outputs in Consultify
From this tool you can create:
- Initiative
- Report
- Presentation
- Idea

## Quick checklist
- Mission is clear
- Signals are concrete
- Tensions are visible
- Moves are actionable
- At least one output was considered',
  video_script = 'Dynamic SWOT helps you turn strategy discussion into action.
You start with a strategic question and collect the most important internal and external signals.
The tool structures them into strengths, weaknesses, opportunities, and threats.
Then AI helps you identify the most important strategic tensions and convert them into recommended moves.
At the end, you do not stop at analysis.
You can immediately create initiatives, a report, a presentation, or save a promising direction as an idea.
Dynamic SWOT is not just a matrix.
It is a guided path from diagnosis to next step.'
    WHERE article_id = 'kb-art-tools-dynamic-swot' AND language = 'en';

    UPDATE kb_article_translations
    SET
      title = 'Jak używać: Dynamic SWOT',
      summary = 'Przeprowadź SWOT oparty na rozmowie z AI, który odsłania napięcia strategiczne, rekomendowane ruchy i outputy gotowe do utworzenia w Consultify.',
      content = '# Dynamic SWOT — Jak używać

## Kiedy używać
Użyj Dynamic SWOT, gdy potrzebujesz wspólnej diagnozy strategicznej i chcesz szybko przejść od rozmowy do konkretnych outputów.

## Co przygotować przed startem
- Pytanie strategiczne
- Zakres i horyzont czasu
- Znane sygnały wewnętrzne i zewnętrzne
- Ograniczenia, założenia lub evidence

## Jak działa flow
1) Zdefiniuj mission brief
2) Zbierz internal reality
3) Zbierz market reality
4) Wskaż strategic tensions
5) Zamień je w recommended moves
6) Utwórz outputy

## Jak interpretować wynik
Nie skupiaj się na najdłuższej liście. Skup się na najmocniejszych napięciach i ruchach, które naprawdę warto uruchomić teraz.

## Typowe błędy
- Traktowanie SWOT jak statycznej macierzy
- Zbyt długa lista słabych wpisów
- Mieszanie evidence z założeniami
- Zatrzymanie się na samym podsumowaniu

## Przykład
Słabość: długi cykl onboardingu. Szansa: większy popyt na szybkie time-to-value. Ruch: standaryzowany pakiet onboardingu.

## Outputy w Consultify
Z tego narzędzia możesz utworzyć:
- Inicjatywę
- Raport
- Prezentację
- Pomysł

## Szybka checklista
- Mission jest jasne
- Sygnały są konkretne
- Napięcia są widoczne
- Ruchy są actionable
- Co najmniej jeden output został rozważony',
  video_script = 'Dynamic SWOT pomaga zamienić rozmowę strategiczną w działanie.
Zaczynasz od pytania strategicznego i zbierasz najważniejsze sygnały wewnętrzne oraz zewnętrzne.
Narzędzie porządkuje je w strengths, weaknesses, opportunities i threats.
Następnie AI pomaga wskazać najważniejsze napięcia strategiczne i zamienić je w rekomendowane ruchy.
Na końcu nie zatrzymujesz się na analizie.
Możesz od razu utworzyć inicjatywy, raport, prezentację albo zapisać obiecujący kierunek jako pomysł.
Dynamic SWOT to nie tylko macierz.
To prowadzona ścieżka od diagnozy do następnego kroku.'
    WHERE article_id = 'kb-art-tools-dynamic-swot' AND language = 'pl';
  END IF;
END $$;
