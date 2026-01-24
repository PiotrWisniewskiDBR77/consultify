# Funkcjonalności Systemu Consultify

## 7️⃣ ZAKŁADKA 7.6 — AI CONSULTANT INSIGHTS
🎯 **Cel:**
Dać użytkownikowi możliwość dialogu z „digital executive consultant”. To jest kluczowa przewaga Consultify.

🧩 **Funkcje:**
- zadawanie pytań analitycznych
- analiza trendów
- wyjaśnienia finansowe
- interpretacja KPI
- rekomendacje operacyjne
- rekomendacje strategiczne

🤖 **ROLA AI**
To jest miejsce, gdzie AI „myśli jak partner konsultingowy”.
Przykłady:
- „Patrząc na Twoje KPI, przewiduję że wdrożenie AI w jakości powinno zostać przyspieszone o 4 tygodnie.”
- „Data Foundation blokuje 3 inne inicjatywy. Zalecam zwiększyć zasób o 1 FTE na 6 tygodni.”
- „Transformacja poprawiła efektywność o 18%. Można rozważyć kolejny cykl optymalizacji procesów.”

## 8️⃣ ZAKŁADKA 7.7 — FINAL TRANSFORMATION REPORT (AUTO-PDF)
🎯 **Cel:**
Automatycznie generować elegancki dokument końcowy projektu. Coś jak „Management Consulting Final Report”.

🧩 **Zawartość:**
- executive summary
- opis transformacji
- osiągnięte poziomy DRD
- kluczowe inicjatywy
- wyniki KPI
- wyniki finansowe
- lessons learned
- rekomendacje AI
- roadmapa dalszego rozwoju
- ocena kultury organizacyjnej
- final ROI

🤖 **ROLA AI**
AI:
- generuje PDF, PowerPoint lub Notion report
- dostosowuje język do odbiorcy (CEO, CFO, Board)
- tworzy slide deck do prezentacji
- tworzy wersję 1-stronicową (executive one-pager)

## OUTPUT MODUŁU 7
System generuje:
- centralny dashboard transformacji
- alerty i insighty AI
- pełny raport końcowy
- materiały dla zarządu
- aktualizację poziomu DRD po rollout’cie

---

# DASHBOARD (GLOBAL VIEW)
Moduł nadrzędny – centralny ekran kontrolny Consultify

## 0. FILOZOFIA DASHBOARDU
Dashboard nie jest zbiorem wykresów. To **centrum dowodzenia transformacją**, które ma spełniać trzy cele:
1. Szybko poinformować użytkownika o stanie projektu.
2. Zidentyfikować ryzyka i najważniejsze priorytety.
3. Umożliwić wejście w głąb modułów jednym kliknięciem.

Dashboard musi być:
- lekki
- przejrzysty
- inteligentny
- oparty na AI
- dopasowany do tego, na jakim etapie jest użytkownik.

Dlatego mamy **DWA TRYBY**:

## 🌱 1. DASHBOARD — BEFORE START (ONBOARDING STATE)
(czyli zanim firma uruchomi krok 1: Expectations & Challenges)

Ekran zawiera:

### A. Welcome Panel
- opis czym jest Consultify
- krótki film / tekst onboardingowy
- przycisk **Start the Transformation → Module 1**

AI może powiedzieć:
> „Zacznijmy od poznania Twojej firmy — przejdź do modułu 1, gdzie określimy cele i kontekst.”

### B. Required Steps Panel (Progress Bar 0% active)
Wyświetlamy 5 głównych kroków:
1. Expectations & Challenges
2. Assessment
3. Initiatives & Roadmap
4. Pilot
5. Rollout

Każdy krok jest szary, nieaktywny.
Gdy user kończy moduł 1 → pasek się aktywuje.

### C. Short instructions:
„Aby rozpocząć proces transformacji:
- Zdefiniuj cele i wyzwania.
- Wgraj dokumenty strategiczne.
- Przejdź do Assessmentu.”
To jest onboarding „bez oporu”.

### D. AI Assistant box (mini chat)
AI daje krótką informację:
> „Jestem Twoim konsultantem. Poprowadzę Cię przez cały proces krok po kroku.”

### E. Wygląd
Brak wykresów, brak KPI, brak inicjatyw. Dashboard ma być czysty, nieprzeładowany.

## 🟦 2. DASHBOARD — DURING PROJECT (LIVE STATE)
(kiedy użytkownik przeszedł krok 1 lub dalej)

To jest prawdziwy dashboard transformacji, który zawiera 5 sekcji:

### SEKCJA 1: PROJECT STATUS OVERVIEW
(Top row – 3 duże kafle)
- **A. Overall Progress**
    - pasek postępu (0–100%)
    - wynik na podstawie statusów modułów:
        - Expectations & Challenges (20% wagi)
        - Assessment (20%)
        - Initiatives & Roadmap (25%)
        - Pilot (15%)
        - Full Rollout (20%)
- **B. Current Phase**
    - „Current Phase: Assessment” lub „In Pilot Execution” lub „Full Rollout in progress”
- **C. Priority Alerts (AI-generated)**
    - 3 najważniejsze alerty (np. „Assessment incomplete”, „Pilot delayed”, „Critical dependency blocked”)

### SEKCJA 2: MODULE COMPLETION STATUS
(pasek z 5 blokami – każdy moduł ma status)
- Expectations & Challenges – ✔️ / ⚠️ / ❌
- Assessment – ✔️ / ⚠️ / ❌
- Initiatives & Roadmap – ✔️ / ⚠️ / ❌
- Pilot Execution – ✔️ / ⚠️ / ❌
- Full Rollout – ✔️ / ⚠️ / ❌
Click → przenosi do modułu.

### SEKCJA 3: INITIATIVE SUMMARY
(widok skrócony sytuacji inicjatyw)
- **A. Total Initiatives:** np. 27
- **B. Status:**
    - On Track (zielony)
    - At Risk (żółty)
    - Delayed (czerwony)
- **C. Link:** „View all initiatives → Module 3.2”

### SEKCJA 4: KPI SNAPSHOT
(tylko 4 kluczowe KPI, nie przeładowujemy)
Standardowy układ:
1. Cycle time
2. Quality / scrap
3. Throughput
4. Operational cost savings

Jeśli to firma usługowa → podmieniamy na: SLA, lead time, error rate, customer satisfaction.
AI dynamicznie wybiera najlepszy zestaw KPI.
Każdy KPI ma: baseline, actual, trend (zielony ↑ lub czerwony ↓).

### SEKCJA 5: AI INSIGHTS (SUPER WAŻNE)
Duża karta AI, która analizuje cały projekt i wyświetla:
- **A. Weekly Executive Summary** (np. „W tym tygodniu projekt przesunął się o 4%...”)
- **B. Recommended Actions** (Lista 3 zaleceń)
- **C. Early Predictive Risks** (np. „Za 3 tygodnie możliwe opóźnienie...”)

### SEKCJA 6: NAVIGATION SHORTCUTS
Szybkie wejście do najważniejszych modułów:
- Go to Assessment
- Go to Roadmap
- Go to Pilot Dashboard
- Go to Rollout Execution Dashboard

### SEKCJA 7: UPCOMING MILESTONES
Lista 5 najbliższych milestone’ów z całego programu: Milestone | Data | Status | Owner

### SEKCJA 8: DOCUMENTS & NOTES
Ostatnie: dodane dokumenty, notatki ze spotkań, komentarze AI.

## TRYB MINIMALNY (MUST HAVE)
Dla mniejszych firm → uproszczony layout:
- Progress
- Phase
- Key Numbers
- 3 AI Insights
- Quick Navigation

## 🧠 ZACHOWANIE AI W DASHBOARDZIE
AI monitoruje cały projekt 24/7, generuje alerty, pisze tygodniowe podsumowania, wskazuje priorytety, przewiduje problemy (predictive analytics) i sugeruje działania na podstawie KPI.
