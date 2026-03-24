# 01: Funkcjonalność i User Journey — DBR77 Marketplace

## Opis platformy

**DBR77 Marketplace** to B2B platforma cyfrowa dedykowana branży **automatyzacji przemysłowej, robotyki i integracji oprogramowania**. Łączy trzy strony ekosystemu:

- **Producentów** (zakłady produkcyjne) — publikują wyzwania automatyzacyjne i wymagania projektowe
- **Integratorów systemów** — projektują i wdrażają rozwiązania techniczne, realizują projekty
- **Dostawców technologii** — dostarczają komponenty: roboty, sensory, moduły oprogramowania

Platforma digitalizuje tradycyjnie rozproszony, relacyjny proces pozyskiwania, oceny i zawierania umów na rozwiązania automatyzacyjne — wprowadzając przejrzystość, szybkość i jakość na każdym etapie transakcji.

---

## User Journey od pierwszego logowania

### Faza 1: Onboarding (rejestracja i konfiguracja)

1. **Rejestracja (OAuth)** — użytkownik loguje się przez Google, LinkedIn lub inny dostawca OAuth
2. **Weryfikacja e-mail** — potwierdzenie adresu e-mail linkiem weryfikacyjnym
3. **Wybór typu profilu** — Manufacturer (Producent) lub Integrator (Integrator systemów)
4. **Dane firmy** — nazwa, NIP/VAT, adres, branża, rozmiar zespołu
5. **Weryfikacja Tax ID** — weryfikacja identyfikatora podatkowego (VIES, GUS, itd.)
6. **Ekrany edukacyjne** — wprowadzenie do przepływu platformy (Challenge → Solution → Offer → Contract)

### Faza 2: Dla Producenta — zbieranie potrzeb i publikacja wyzwania

1. **Kreator Challenge (5 kroków)**:
   - Krok 1: Podstawowe info — tytuł, kategoria (Challenge technologiczny / Integracja software)
   - Krok 2: Opis i kontekst — aktualny stan procesu, cele, ograniczenia
   - Krok 3: Wymagania — specyfikacje techniczne, budżet, harmonogram, kraje dostawy
   - Krok 4: Konfiguracja NDA — czy wymagane NDA, wybór szablonu
   - Krok 5: Przegląd i publikacja

2. **Wsparcie AI** — generowanie tytułu, rozbudowa opisu, estymacja budżetu, tagi, założenia operacyjne
3. **Pattern CtS (Clarify-then-Structure)** — AI dopytuje o brakujące szczegóły, potem strukturuje treść
4. **Weryfikacja DBR77** — administratorzy zatwierdzają Challenge przed publikacją
5. **Tłumaczenia** — automatyczne tłumaczenie treści (PL, DE, FR, JA) przez DeepL

### Faza 3: Dopasowanie i odpowiedzi

1. **AI Matching** — silnik generuje embeddingi i dopasowuje Challenge do profili integratorów (Qdrant)
2. **Powiadomienia** — dopasowani integratorzy otrzymują e-mail i powiadomienia push
3. **NDA (jeśli wymagane)** — integratorzy podpisują NDA przez DocuSign przed dostępem do szczegółów
4. **Składanie Solution** — propozycje techniczne z ROI, stosem technologicznym, wizualizacjami 2D/3D

### Faza 4: Ocena i negocjacja

1. **Przegląd Solution** — Producent: Accept / Reject / Request Changes
2. **Utworzenie Offer** — Integrator tworzy ofertę formalną (Software Offer Wizard lub PDF)
3. **Przegląd Offer** — Producent: Accept / Reject
4. **Counter-offer** — możliwość negocjacji warunków
5. **Wgląd w prowizję** — obie strony widzą szacowaną prowizję DBR77 przed akceptacją

### Faza 5: Kontrakt i realizacja projektu

1. **Podpis umowy (DocuSign)** — producent podpisuje pierwszy, potem integrator
2. **Zarządzanie kamieniami milowymi** — definicja, przesyłanie deliverabli, zatwierdzanie
3. **Spotkania Zoom** — planowanie spotkań w ramach platformy
4. **Tracking postępu** — dashboard, powiadomienia o overdue milestones (>24h)

### Faza 6: Zamknięcie i ocena

1. **Completions** — zatwierdzenie ostatniego kamienia milowego
2. **Wzajemna ocena** — obie strony wystawiają oceny (mutual release)
3. **Whitelist** — wysoka ocena wpływa na preferowaną widoczność integratora

---

## Możliwe Assesmenty / Typy wyzwań

| Typ | Opis |
|-----|------|
| **Technological Challenge** | Automatyzacja fizyczna — roboty, handling materiałów, linie produkcyjne |
| **Software Integration** | MES, ERP, SCADA, integracja danych, Przemysł 4.0 |

### Kategorie zastosowań (Application Types)

- Pick-and-Place, Assembly, Quality Control, Painting, Welding, Transport, Gluing
- MES (Manufacturing Execution System), ERP

---

## Dashboardy

### Dashboard Producenta

- **Stat Cards**: Accepted Solutions, Accepted Offers, Pending Solutions, Pending Offers
- **Wykres słupkowy**: aktywność Challenge i engagement w czasie
- **Waiting-for-Review List**: priorytetyzowana lista wymagająca działania (Solutions, Offers, Milestones)

### Dashboard Integratora

- Dopasowane Challenges, statusy rozwiązań, pipeline ofert

### Operations Hub (Admin)

- Pending verifications, overdue milestones, flagged messages, bulk actions

---

## Moduły analityczne

- Challenge performance metrics (view counts, solution submission rates, time-to-first-solution)
- Konwersja: Solution → Offer → Contract
- Raporty porównawcze ofert (koszt, timeline, milestones)

---

## Zarządzanie inicjatywami i planowanie zadań

- **Challenges** jako inicjatywy automatyzacyjne
- **Milestones** jako zadania z deliverablami, datami, zatwierdzaniem
- Zoom Meetings z Action Items
- (Planowane: Gantt charts, dependency management między milestones)

---

## Wymuszanie i przyspieszanie decyzji

- **Strukturyzowany workflow** — brak rozproszenia w e-mailach
- **Notifications / Push (FCM)** — alerty o nowych Solutions, Offers, milestone approvals
- **Operations Hub** — flagowanie overdue milestones (>24h)
- **Transparentna prowizja** — obie strony wiedzą, ile kosztuje platforma

---

## Generowanie raportów

- Raporty z cyklu życia projektu (Challenge → Contract)
- Porównanie ofert (koszt, timeline, scope)
- Dane do raportowania boardowego (procurement efficiency, ROI inwestycji)
- (Planowane: zaawansowana analityka, market intelligence)

---

## Różnicowanie DBR77

| Cecha | Opis |
|------|------|
| **AI Matching** | OpenAI + Qdrant — dopasowanie semantyczne, nie tylko słowa kluczowe |
| **NDA-first** | DocuSign, gwarancja poufności przed udostępnieniem szczegółów |
| **Model prowizji** | Producent **nie płaci**; prowizja progresywna (od 5%) po stronie integratora |
| **5 języków** | EN, DE, FR, PL, JA + tłumaczenia DeepL |
| **ISO 27001** | Zgodność z wymogami bezpieczeństwa informacji |
| **Zoom + DocuSign** | Spotkania i umowy w ramach platformy |
