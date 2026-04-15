-- Migration: 291_knowledge_base_polish_translations.sql
-- Purpose: Add Polish translations for all Knowledge Base articles
-- Date: 2026-01-20
-- Context: Full i18n support for Enterprise Documentation Portal

-- ============================================
-- CATEGORY TRANSLATIONS - POLISH
-- ============================================

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-gs-pl', 'kb-cat-getting-started', 'pl', 'Pierwsze Kroki', 'Szybkie przewodniki i wprowadzenie do platformy'),
    ('kb-cat-trans-assess-pl', 'kb-cat-assessment', 'pl', 'Frameworki Oceny', 'Metodologie DRD, SIRI, CMMI, Lean 4.0 i ADMA'),
    ('kb-cat-trans-mod-pl', 'kb-cat-modules', 'pl', 'Moduły Przemysłowe', 'MES, WMS, QMS, CMMS, IoT i 14 więcej modułów'),
    ('kb-cat-trans-ai-pl', 'kb-cat-ai', 'pl', 'Platforma AI', 'Asystent AI, rekomendacje, prompty i automatyzacja'),
    ('kb-cat-trans-analytics-pl', 'kb-cat-analytics', 'pl', 'Analityka i Raporty', 'Dashboardy, KPI, raporty i eksport danych'),
    ('kb-cat-trans-transform-pl', 'kb-cat-transformation', 'pl', 'Zarządzanie Transformacją', 'Inicjatywy, roadmapy, analiza ROI i zarządzanie zmianą'),
    ('kb-cat-trans-admin-pl', 'kb-cat-admin', 'pl', 'Administracja', 'Konfiguracja organizacji, użytkownicy, bezpieczeństwo i zgodność'),
    ('kb-cat-trans-api-pl', 'kb-cat-api', 'pl', 'Dokumentacja API', 'Dokumentacja REST API, specyfikacje OpenAPI i webhooki'),
    ('kb-cat-trans-int-pl', 'kb-cat-integrations', 'pl', 'Integracje', 'SAP, Microsoft 365, Slack, Power BI i więcej'),
    ('kb-cat-trans-trouble-pl', 'kb-cat-troubleshoot', 'pl', 'Rozwiązywanie Problemów', 'Częste problemy, komunikaty błędów i wsparcie');

-- ============================================
-- GETTING STARTED - POLISH TRANSLATIONS
-- ============================================

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-platform-pl', 'kb-art-platform-overview', 'pl',
     'Przegląd Platformy IRIS',
     'Odkryj jak IRIS 6.0 przyspiesza transformację cyfrową dzięki ocenie wspieranej przez AI, planowaniu i możliwościom realizacji.',
'# Przegląd Platformy IRIS

## Czym jest IRIS?

**IRIS** (Industrial Readiness & Intelligence System) to platforma klasy enterprise zaprojektowana, aby pomóc organizacjom oceniać, planować i realizować inicjatywy transformacji cyfrowej.

## Kluczowe Możliwości

### 1. Ocena i Diagnoza
Oceń gotowość organizacji w ramach wielu sprawdzonych frameworków:
- **DRD** - Digital Readiness Diagnostic
- **SIRI** - Smart Industry Readiness Index
- **CMMI** - Capability Maturity Model
- **Lean 4.0** - Digitalizacja Lean Manufacturing

### 2. Planowanie Wspierane przez AI
Przekształć wnioski z oceny w wykonalne plany działania:
- Rekomendacje inicjatyw generowane przez AI
- Punktacja priorytetów na podstawie wpływu i wysiłku
- Planowanie zasobów i zdolności
- Projekcja ROI i generowanie business case

### 3. Zarządzanie Realizacją
Śledź postęp transformacji za pomocą narzędzi PMO klasy enterprise:
- Zarządzanie cyklem życia inicjatyw
- Przydzielanie i śledzenie zadań
- Przepływy pracy z kamieniami milowymi
- Zarządzanie ryzykiem i problemami

### 4. Moduły Doskonałości Przemysłowej
19 specjalistycznych modułów do operacji produkcyjnych:
- MES, WMS, QMS, CMMS, IoT, GEMBA
- HSE, ESG, KPI, APS, MRP, DT
- HRM, LMS, SKILLS, PARTNER, DATA-AI
- ADMIN, SETTINGS

## Jak Zacząć

1. **Wypełnij Ocenę** - Zacznij od DRD lub SIRI
2. **Przejrzyj Rekomendacje AI** - Przeanalizuj wygenerowane wnioski
3. **Utwórz Inicjatywy** - Zaplanuj transformację
4. **Realizuj i Śledź** - Zarządzaj wdrożeniem
5. **Mierz Wpływ** - Monitoruj KPI i korzyści

Gotowy do rozpoczęcia? [Rozpocznij pierwszą ocenę](/assessment)');

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-firstass-pl', 'kb-art-first-assessment', 'pl',
     'Pierwsza Ocena w 10 Minut',
     'Wypełnij pierwszą ocenę DRD i otrzymaj rekomendacje AI w zaledwie 10 minut.',
'# Pierwsza Ocena w 10 Minut

## Przegląd

Ten przewodnik przeprowadzi Cię przez wypełnienie pierwszej oceny Digital Readiness Diagnostic (DRD). W zaledwie 10 minut otrzymasz kompleksowy obraz cyfrowej dojrzałości Twojej organizacji.

## Krok 1: Dostęp do Centrum Oceny

1. Kliknij **Ocena** w głównej nawigacji
2. Wybierz **DRD - Digital Readiness Diagnostic**
3. Kliknij **Rozpocznij Nową Ocenę**

## Krok 2: Odpowiedz na Pytania (7 Wymiarów)

Ocena DRD obejmuje 7 krytycznych wymiarów:

| Wymiar | Pytania | Czas |
|--------|---------|------|
| Strategia | 5 | ~1 min |
| Organizacja | 5 | ~1 min |
| Technologia | 6 | ~1.5 min |
| Dane | 5 | ~1 min |
| Ludzie | 5 | ~1 min |
| Procesy | 5 | ~1 min |
| Innowacje | 5 | ~1 min |

> **Wskazówka**: Odpowiadaj szczerze - zawyżone wyniki prowadzą do nieprawidłowych rekomendacji.

## Krok 3: Przejrzyj Wyniki

Po przesłaniu zobaczysz:
- **Ogólny Wynik Dojrzałości** (1-5)
- **Rozbicie Wymiarów** z wizualnym wykresem radarowym
- **Porównanie z Benchmarkiem** vs. branża
- **Analiza Luk** wyróżniająca obszary do poprawy

## Krok 4: Rekomendacje AI

Nasz silnik AI generuje:
- **Priorytetowe Inicjatywy** - Uszeregowane według wpływu
- **Szybkie Wygrane** - Niski wysiłek, wysoki wpływ
- **Projekty Strategiczne** - Długoterminowe transformacje
- **Szacowane ROI** dla każdej rekomendacji

## Następne Kroki

1. Przejrzyj 3 najważniejsze rekomendacje
2. Kliknij **Utwórz Inicjatywę** przy dowolnej rekomendacji
3. Zbuduj swoją mapę transformacji

[Rozpocznij Ocenę Teraz](/assessment/drd)');

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-aichat-pl', 'kb-art-ai-chat-intro', 'pl',
     'Przewodnik po Czacie i Rekomendacjach AI',
     'Naucz się wykorzystywać IRIS AI do spersonalizowanych rekomendacji, pytań i automatyzacji.',
'# Przewodnik po Czacie i Rekomendacjach AI

## Poznaj Swojego AI Co-Pilota

Asystent IRIS AI został zaprojektowany, aby pomóc Ci w nawigacji transformacji cyfrowej z kontekstowym, inteligentnym wsparciem.

## Jak Używać Czatu AI

### Rozpoczęcie Rozmowy

1. Kliknij przycisk **Czat AI** (prawy dolny róg) lub przejdź do `/chat`
2. Wpisz pytanie naturalnie
3. AI odpowiada z kontekstowymi sugestiami

### Przykładowe Prompty

**Ocena i Analiza**
- "Przeanalizuj moje ostatnie wyniki DRD"
- "Jakie są moje 3 najważniejsze obszary do poprawy?"
- "Porównaj moje wyniki z benchmarkami branżowymi"

**Planowanie Inicjatyw**
- "Zaproponuj inicjatywy na poprawę dojrzałości danych"
- "Stwórz roadmapę na następne 6 miesięcy"
- "Oszacuj ROI dla wdrożenia MES"

**Raportowanie**
- "Wygeneruj streszczenie dla zarządu"
- "Stwórz prezentację dla rady nadzorczej"
- "Eksportuj dashboard KPI"

## Rekomendacje AI

### Jak Działają

1. AI analizuje Twoje dane z oceny
2. Uwzględnia benchmarki branżowe
3. Bierze pod uwagę kontekst organizacji
4. Generuje spriorytetyzowane inicjatywy

### Typy Rekomendacji

| Typ | Opis |
|-----|------|
| 🎯 Szybkie Wygrane | Niski wysiłek, natychmiastowy wpływ |
| 📈 Strategiczne | Wysoki wpływ, wymaga inwestycji |
| 🛡️ Mitygacja Ryzyka | Redukcja zidentyfikowanych ryzyk |
| 💡 Innowacje | Możliwości przewagi konkurencyjnej |

## Ustawienia AI

Dostosuj zachowanie AI:
- Format odpowiedzi (szczegółowy/zwięzły)
- Preferencje językowe
- Ustawienia pamięci
- Poziom automatyzacji akcji

[Otwórz Czat AI](/chat)');

-- ============================================
-- AI PLATFORM - POLISH TRANSLATIONS
-- ============================================

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-aiov-pl', 'kb-art-ai-overview', 'pl',
     'Przegląd Asystenta AI',
     'Poznaj możliwości IRIS AI i jak przyspiesza Twoją podróż transformacji cyfrowej.',
'# Przegląd Asystenta AI

## Czym jest IRIS AI?

IRIS AI to system sztucznej inteligencji klasy enterprise zaprojektowany specjalnie dla przemysłowej transformacji cyfrowej. Łączy ekspertyzę domenową z zaawansowanymi modelami językowymi.

## Kluczowe Możliwości

### 1. Kontekstowe Rozumienie
- Zna kontekst Twojej organizacji
- Pamięta poprzednie rozmowy
- Rozumie terminologię branżową
- Dostosowuje się do Twojej roli i preferencji

### 2. Analiza Ocen
- Interpretuje wyniki DRD, SIRI, CMMI
- Identyfikuje wzorce i luki
- Dostarcza porównania z benchmarkami
- Sugeruje obszary do poprawy

### 3. Rekomendacje Inicjatyw
- Pomysły na transformację generowane przez AI
- Punktacja priorytetów (wpływ × wykonalność)
- Szacowanie wysiłku
- Projekcja ROI

### 4. Raportowanie i Wnioski
- Automatyczne streszczenia dla zarządu
- Analiza trendów KPI
- Wykrywanie anomalii
- Zapytania w języku naturalnym

## Używanie Czatu AI

### Najlepsze Praktyki

1. **Bądź Konkretny** - "Przeanalizuj trendy OEE za Q4" vs "Powiedz mi o OEE"
2. **Podaj Kontekst** - "Dla naszego zakładu motoryzacyjnego w Polsce..."
3. **Zadawaj Pytania Uzupełniające** - "Dlaczego tak?" "Podaj przykład"
4. **Proś o Akcje** - "Utwórz inicjatywę dla tego"

### Prywatność Danych

- Dane nigdy nie opuszczają Twojego tenanta
- PII jest automatycznie redagowane
- Pełna ścieżka audytu dostępna
- Zgodność z SOC 2 Type II

[Rozpocznij Rozmowę z AI](/chat)');

-- ============================================
-- API REFERENCE - POLISH TRANSLATIONS
-- ============================================

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-apiintro-pl', 'kb-art-api-intro', 'pl',
     'Wprowadzenie do API',
     'Rozpocznij pracę z IRIS REST API dla programowego dostępu do ocen, inicjatyw i analityki.',
'# Wprowadzenie do API

## Przegląd

IRIS API zapewnia programowy dostęp do wszystkich możliwości platformy. Buduj integracje, automatyzuj przepływy pracy i rozszerzaj funkcjonalność.

## Bazowy URL

```
https://api.iris.technolex.io/v1
```

## Uwierzytelnianie

Wszystkie żądania API wymagają uwierzytelnienia poprzez:
- **Klucze API** - Dla serwer-do-serwer
- **OAuth 2.0** - Dla kontekstu użytkownika

Zobacz [Przewodnik Uwierzytelniania](/docs/api-reference/api-authentication) po szczegóły.

## Format Odpowiedzi

Wszystkie odpowiedzi są w formacie JSON:

```json
{
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-20T12:00:00Z"
  }
}
```

## Limity Szybkości

| Plan | Żądania/min | Żądania/dzień |
|------|-------------|---------------|
| Starter | 60 | 10,000 |
| Professional | 300 | 100,000 |
| Enterprise | Custom | Custom |

## SDK

Oficjalne SDK dostępne:
- JavaScript/TypeScript
- Python
- Java
- C# (.NET)

## Jak Zacząć

1. [Utwórz Klucz API](/settings/api-keys)
2. Wykonaj pierwsze żądanie
3. Eksploruj endpointy

```bash
curl -X GET "https://api.iris.technolex.io/v1/assessments" \
  -H "Authorization: Bearer TWOJ_KLUCZ_API"
```

[Zobacz Pełną Dokumentację API](/docs/api-reference)');

-- ============================================
-- TROUBLESHOOTING - POLISH TRANSLATIONS
-- ============================================

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-faq-pl', 'kb-art-faq-general', 'pl',
     'Często Zadawane Pytania',
     'Odpowiedzi na najczęstsze pytania dotyczące platformy IRIS, ocen i funkcji.',
'# Często Zadawane Pytania

## Ogólne

### Czym jest IRIS?
IRIS (Industrial Readiness & Intelligence System) to platforma enterprise do oceny, planowania i realizacji transformacji cyfrowej.

### Dla jakich branż jest przeznaczony IRIS?
IRIS jest zaprojektowany dla organizacji produkcyjnych i przemysłowych, w tym motoryzacji, lotnictwa, farmacji, spożywczej i produkcji dyskretnej.

### Jak zabezpieczone są dane?
IRIS posiada certyfikat SOC 2 Type II z szyfrowaniem end-to-end, zgodnością z GDPR i zabezpieczeniami klasy enterprise.

## Oceny

### Jak długo trwa ocena?
Ocena DRD trwa około 15-20 minut. Oceny SIRI i wieloframeworkowe mogą trwać 30-45 minut.

### Czy mogę wstrzymać i wznowić?
Tak, oceny automatycznie zapisują się po każdej sekcji. Możesz kontynuować od miejsca, w którym skończyłeś.

### Kto powinien wypełniać oceny?
Idealnie, zespoły cross-funkcjonalne obejmujące operacje, IT, HR i kierownictwo wykonawcze dla kompleksowych wniosków.

## Funkcje AI

### Jakich modeli AI używa IRIS?
IRIS używa wielu dostawców AI, w tym OpenAI GPT-4, Anthropic Claude i niestandardowych modeli dopasowanych do przemysłu.

### Czy moje dane są używane do trenowania AI?
Nie. Twoje dane nigdy nie są używane do trenowania zewnętrznych modeli AI. Całe przetwarzanie odbywa się w Twoim bezpiecznym tenancie.

### Czy mogę dostosować zachowanie AI?
Tak. Ustawienia pozwalają na regulację formatu odpowiedzi, języka, pamięci i poziomu automatyzacji.

## Cennik i Plany

### Jakie plany są dostępne?
Poziomy Starter, Professional i Enterprise z różnymi funkcjami i limitami użycia.

### Czy jest bezpłatny okres próbny?
Tak, 14-dniowy bezpłatny okres próbny z pełnymi funkcjami Professional.

[Kontakt z Wsparciem](/support)');
