-- Migration: 292_knowledge_base_polish_translations_extended.sql
-- Purpose: Add remaining Polish translations for all Knowledge Base articles
-- Date: 2026-01-20

-- Getting Started Articles - Polish
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-firstinit-pl', 'kb-art-first-initiative', 'pl',
     'Tworzenie Pierwszej Inicjatywy',
     'Dowiedz się jak przekształcić rekomendacje AI w wykonalne inicjatywy transformacji.',
'# Tworzenie Pierwszej Inicjatywy

## Czym Jest Inicjatywa?

Inicjatywa to zdefiniowany projekt transformacji cyfrowej z konkretnymi celami, harmonogramem i mierzalnymi rezultatami.

## Jak Utworzyć Inicjatywę

1. Przejdź do **Inicjatywy** w głównym menu
2. Kliknij **Nowa Inicjatywa**
3. Wypełnij szczegóły projektu
4. Przypisz zasoby i harmonogram

## Elementy Inicjatywy

- **Cel biznesowy** - Co chcemy osiągnąć
- **KPI** - Jak zmierzymy sukces
- **Budżet** - Wymagane zasoby
- **Harmonogram** - Kamienie milowe
- **Ryzyka** - Potencjalne przeszkody

[Utwórz Inicjatywę](/initiatives/new)'),
    
    ('kb-art-trans-dashboard-pl', 'kb-art-dashboard-guide', 'pl',
     'Zrozumienie Dashboardu',
     'Kompleksowy przewodnik po głównym dashboardzie IRIS i jego funkcjach.',
'# Zrozumienie Dashboardu

## Przegląd

Dashboard IRIS zapewnia widok 360° Twojej transformacji cyfrowej.

## Główne Elementy

### Karty Podsumowania
- Ogólny wynik dojrzałości
- Aktywne inicjatywy
- Nadchodzące kamienie milowe
- Alerty i powiadomienia

### Wykresy i Trendy
- Postęp w czasie
- Porównanie z benchmarkiem
- Analiza wymiarów

### Szybkie Akcje
- Nowa ocena
- Utwórz inicjatywę
- Generuj raport

[Otwórz Dashboard](/dashboard)'),

    ('kb-art-trans-navigation-pl', 'kb-art-navigation', 'pl',
     'Przewodnik po Interfejsie',
     'Poznaj nawigację i główne elementy interfejsu IRIS.',
'# Przewodnik po Interfejsie

## Pasek Nawigacji

Główna nawigacja znajduje się po lewej stronie ekranu:

- **Dashboard** - Strona główna
- **Oceny** - DRD, SIRI, CMMI
- **Inicjatywy** - Projekty transformacji
- **Roadmapa** - Plan działania
- **Raporty** - Analityka
- **Czat AI** - Asystent
- **Ustawienia** - Konfiguracja

## Górny Pasek

- Wyszukiwarka globalna
- Powiadomienia
- Profil użytkownika
- Przełącznik organizacji

## Skróty Klawiszowe

| Skrót | Akcja |
|-------|-------|
| Ctrl+K | Wyszukaj |
| Ctrl+N | Nowy element |
| ? | Pomoc |

[Powrót do Dashboardu](/dashboard)'),

    ('kb-art-trans-mobile-pl', 'kb-art-mobile-pwa', 'pl',
     'Konfiguracja Aplikacji Mobilnej',
     'Zainstaluj aplikację IRIS jako PWA na telefonie lub tablecie.',
'# Konfiguracja Aplikacji Mobilnej

## PWA - Progressive Web App

IRIS jest dostępny jako aplikacja mobilna bez potrzeby pobierania ze sklepu.

## Instalacja na iOS

1. Otwórz Safari na iris.technolex.io
2. Kliknij ikonę Udostępnij
3. Wybierz "Dodaj do ekranu głównego"
4. Potwierdź nazwę aplikacji

## Instalacja na Android

1. Otwórz Chrome na iris.technolex.io
2. Kliknij menu (3 kropki)
3. Wybierz "Zainstaluj aplikację"
4. Potwierdź instalację

## Funkcje Mobilne

- Pełny dostęp do dashboardu
- Czat AI
- Przegląd ocen
- Powiadomienia push

[Otwórz na telefonie](/)');

-- AI Platform Articles - Polish
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-airec-pl', 'kb-art-ai-recommendations', 'pl',
     'Silnik Rekomendacji AI',
     'Poznaj jak IRIS AI generuje priorytetowe rekomendacje na podstawie Twoich danych.',
'# Silnik Rekomendacji AI

## Jak Działają Rekomendacje

### Źródła Danych
1. Wyniki oceny DRD/SIRI/CMMI
2. Dane organizacyjne
3. Benchmarki branżowe
4. Historia inicjatyw

### Algorytm Priorytetyzacji

Każda rekomendacja otrzymuje punktację na podstawie:
- **Wpływ** - Potencjalny efekt na biznes
- **Wysiłek** - Wymagane zasoby
- **Ryzyka** - Potencjalne przeszkody
- **Zależności** - Powiązania z innymi inicjatywami

### Typy Rekomendacji

| Typ | Opis |
|-----|------|
| Szybkie Wygrane | Niski wysiłek, szybki rezultat |
| Strategiczne | Wysokie znaczenie długoterminowe |
| Mitygacja Ryzyk | Redukcja zidentyfikowanych zagrożeń |
| Innowacje | Przewaga konkurencyjna |

[Przeglądaj Rekomendacje](/recommendations)'),

    ('kb-art-trans-aiprompts-pl', 'kb-art-ai-prompts', 'pl',
     'Prompt Engineering dla Przemysłu',
     'Naucz się pisać efektywne prompty dla przemysłowego AI.',
'# Prompt Engineering dla Przemysłu

## Podstawy Pisania Promptów

Efektywny prompt dla IRIS AI zawiera:

1. **Kontekst** - Tło sytuacji
2. **Cel** - Co chcesz osiągnąć
3. **Ograniczenia** - Limity i wymagania
4. **Format** - Oczekiwana forma odpowiedzi

## Przykłady Dobrych Promptów

### Analiza
```
Przeanalizuj moje wyniki DRD z ostatniego kwartału.
Porównaj z benchmarkiem dla branży motoryzacyjnej.
Przedstaw 3 główne obszary wymagające poprawy.
```

### Planowanie
```
Zaproponuj inicjatywy na poprawę dojrzałości cyfrowej
w obszarze Technologii. Budżet: 500k EUR.
Horyzont czasowy: 12 miesięcy.
```

### Raportowanie
```
Wygeneruj streszczenie wykonawcze naszej transformacji
dla zarządu. Format: 1 strona, kluczowe KPI, ryzyka.
```

[Otwórz Czat AI](/chat)'),

    ('kb-art-trans-aimemory-pl', 'kb-art-ai-memory', 'pl',
     'Pamięć i Kontekst AI',
     'Zrozum jak IRIS AI zapamiętuje kontekst i personalizuje odpowiedzi.',
'# Pamięć i Kontekst AI

## Jak AI Zapamiętuje

IRIS AI wykorzystuje wielopoziomowy system pamięci:

### Pamięć Sesji
- Aktualna rozmowa
- Ostatnie zapytania
- Kontekst bieżący

### Pamięć Długoterminowa
- Preferencje użytkownika
- Historia ocen
- Wzorce zachowań

### Pamięć Organizacyjna
- Struktura firmy
- Projekty i inicjatywy
- Branżowe specyfiki

## Ustawienia Prywatności

Możesz kontrolować co AI zapamiętuje:
- Włącz/wyłącz pamięć
- Wyczyść historię
- Eksportuj dane

[Zarządzaj Pamięcią AI](/settings/ai)'),

    ('kb-art-trans-aicost-pl', 'kb-art-ai-cost', 'pl',
     'Zarządzanie Kosztami AI',
     'Monitoruj i optymalizuj wykorzystanie i koszty AI w Twojej organizacji.',
'# Zarządzanie Kosztami AI

## Modele Rozliczeń

IRIS oferuje elastyczne opcje rozliczeń AI:

### Pakiety Tokenów
- Starter: 100k tokenów/miesiąc
- Professional: 500k tokenów/miesiąc
- Enterprise: Bez limitu

### Monitorowanie Zużycia

Dashboard kosztów pokazuje:
- Zużycie dzienne/tygodniowe/miesięczne
- Podział na funkcje (czat, raporty, analiza)
- Prognozy na bieżący okres

## Optymalizacja

Wskazówki na redukcję kosztów:
1. Używaj konkretnych promptów
2. Korzystaj z cache dla powtarzalnych zapytań
3. Ustaw limity dla użytkowników

[Panel Kosztów AI](/admin/ai-costs)'),

    ('kb-art-trans-aisec-pl', 'kb-art-ai-security', 'pl',
     'Bezpieczeństwo i Prywatność AI',
     'Dowiedz się jak IRIS chroni Twoje dane w kontekście AI.',
'# Bezpieczeństwo i Prywatność AI

## Architektura Bezpieczeństwa

### Izolacja Danych
- Dane tenanta są izolowane
- Brak współdzielenia między organizacjami
- Szyfrowanie end-to-end

### Przetwarzanie Danych
- Dane nie opuszczają EU (GDPR)
- Automatyczna redakcja PII
- Audit trail wszystkich operacji

### Certyfikacje
- SOC 2 Type II
- ISO 27001
- GDPR Compliant

## Kontrola Dostępu

- Role i uprawnienia
- MFA dla administratorów
- Logi dostępu

[Ustawienia Bezpieczeństwa](/settings/security)'),

    ('kb-art-trans-aiactions-pl', 'kb-art-ai-actions', 'pl',
     'Akcje i Automatyzacja AI',
     'Poznaj możliwości automatyzacji zadań za pomocą IRIS AI.',
'# Akcje i Automatyzacja AI

## Co AI Może Zrobić

IRIS AI może wykonywać akcje w Twoim imieniu:

### Automatyczne Akcje
- Tworzenie inicjatyw z rekomendacji
- Generowanie raportów
- Wysyłanie powiadomień
- Aktualizacja statusów

### Akcje Wymagające Potwierdzenia
- Przypisywanie zasobów
- Modyfikacja budżetów
- Zmiana priorytetów

## Konfiguracja Automatyzacji

Ustaw poziom automatyzacji:
1. **Manualna** - Każda akcja wymaga potwierdzenia
2. **Asystowana** - Sugestie z jednym kliknięciem
3. **Automatyczna** - AI działa samodzielnie

[Konfiguruj Automatyzację](/settings/ai-actions)');

-- API Reference - Polish
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-apiauth-pl', 'kb-art-api-auth', 'pl',
     'Uwierzytelnianie API',
     'Dowiedz się jak uwierzytelniać żądania do IRIS API.',
'# Uwierzytelnianie API

## Metody Uwierzytelniania

### Klucze API

Dla integracji serwer-do-serwer:

```bash
curl -H "Authorization: Bearer API_KEY" \
  https://api.iris.technolex.io/v1/assessments
```

### OAuth 2.0

Dla aplikacji działających w kontekście użytkownika:

1. Zarejestruj aplikację
2. Uzyskaj tokeny
3. Odświeżaj tokeny automatycznie

## Tworzenie Kluczy API

1. Przejdź do Ustawienia > API
2. Kliknij "Nowy Klucz"
3. Ustaw uprawnienia i limity
4. Skopiuj klucz (pokazany tylko raz!)

## Bezpieczeństwo

- Nigdy nie umieszczaj kluczy w kodzie
- Używaj zmiennych środowiskowych
- Rotuj klucze regularnie

[Zarządzaj Kluczami](/settings/api-keys)');

-- Troubleshooting - Polish
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-login-pl', 'kb-art-troubleshoot-login', 'pl',
     'Problemy z Logowaniem',
     'Rozwiązywanie typowych problemów z logowaniem do IRIS.',
'# Problemy z Logowaniem

## Najczęstsze Problemy

### Zapomniałem Hasła
1. Kliknij "Zapomniałem hasła" na stronie logowania
2. Podaj adres email
3. Sprawdź skrzynkę (również spam)
4. Kliknij link resetujący

### Konto Zablokowane
Po 5 nieudanych próbach konto jest blokowane na 15 minut.
Poczekaj lub skontaktuj się z administratorem.

### Problemy z SSO
Jeśli Twoja organizacja używa SSO:
1. Sprawdź czy używasz poprawnego email
2. Skontaktuj się z IT
3. Spróbuj trybu incognito

### Błąd "Nieprawidłowe Dane"
- Sprawdź pisownię email
- Upewnij się o właściwej klawiaturze
- Wyczyść cache przeglądarki

[Kontakt z Wsparciem](/support)'),

    ('kb-art-trans-sync-pl', 'kb-art-troubleshoot-sync', 'pl',
     'Problemy z Synchronizacją Danych',
     'Rozwiązywanie problemów z synchronizacją danych i integracjami.',
'# Problemy z Synchronizacją Danych

## Typowe Problemy

### Dane Nie Aktualizują Się
1. Sprawdź status integracji w Ustawienia > Integracje
2. Zweryfikuj uprawnienia
3. Wymuś ręczną synchronizację

### Błędy Importu
- Sprawdź format pliku (CSV, Excel)
- Zweryfikuj wymagane kolumny
- Usuń znaki specjalne

### Problemy z API
- Sprawdź logi błędów
- Zweryfikuj klucze API
- Sprawdź limity szybkości

## Diagnostyka

1. Otwórz Ustawienia > Integracje
2. Kliknij "Test Połączenia"
3. Przejrzyj szczegóły błędu

[Status Integracji](/settings/integrations)'),

    ('kb-art-trans-support-pl', 'kb-art-support', 'pl',
     'Kontakt z Pomocą Techniczną',
     'Jak skontaktować się z zespołem wsparcia IRIS.',
'# Kontakt z Pomocą Techniczną

## Kanały Wsparcia

### Czat w Aplikacji
Najszybsza opcja - kliknij ikonę czatu w prawym dolnym rogu.

### Email
support@technolex.io
Odpowiedź w ciągu 24h (dni robocze)

### Telefon (Enterprise)
+48 22 123 45 67
Pn-Pt 9:00-17:00 CET

## Przed Kontaktem

Przygotuj:
- Nazwę organizacji
- Opis problemu
- Zrzuty ekranu
- ID żądania (jeśli dotyczy)

## Priorytety

| Priorytet | Opis | SLA |
|-----------|------|-----|
| Krytyczny | System niedostępny | 1h |
| Wysoki | Kluczowa funkcja nie działa | 4h |
| Normalny | Problem z funkcjonalnością | 24h |
| Niski | Pytanie, sugestia | 72h |

[Otwórz Zgłoszenie](/support/new)');
