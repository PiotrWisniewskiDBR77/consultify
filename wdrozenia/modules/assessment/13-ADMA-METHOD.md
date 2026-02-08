# ADMA — Advanced Digital Maturity Assessment (Factory of the Future)

## Co to jest ADMA i po co to robimy

**ADMA** (Advanced Digital Maturity Assessment) to metoda diagnozy dojrzałości cyfrowej zakładu produkcyjnego, powiązana z koncepcją **Factory of the Future**.

W praktyce ADMA służy do:

- określenia “gdzie jesteśmy” (poziom dojrzałości),
- porównania z benchmarkiem (w ramach programu / populacji),
- zbudowania **Transformation Plan** (priorytety i inicjatywy).

## Źródła

Opis procedury i 7 transformacji poniżej jest oparty o materiały publiczne:

- `https://northsearegion.eu/growin4/tools-and-methods-for-you-to-use/adma-european-advanced-manufacturing-support-centre/`
- (kontekst praktyczny i skala 1–5) `https://imfactory.com.pl/en/knowledge/adma-scan-evaluate-the-digital-maturity-of-your-business/`

W kodzie Consultify jest też “ADMA 2.0” (5 filarów, 12 wymiarów) w `src/services/admaStructure.ts` — to implementacja UI, nie pełna kanoniczna metoda 7-transformacyjna.

## Jak prowadzić ADMA (procedura)

### 1) Ankieta (Quick / Full) i zebranie odpowiedzi

- Rekomendacja: **5–7 osób** (dyrektor zakładu + UR + produkcja + IT/OT + SC + jakość + HR/R&D).
- Każdy wypełnia niezależnie (wynik nie jest “głosowaniem”, tylko materiałem do walidacji).

### 2) Walidacja (wywiad + shopfloor / “shadow scan”)

Zgodnie z typową praktyką wdrożeniową:

- wywiad z management (ok. 90 min),
- wizyta na produkcji (ok. 60 min),
- “shadow scan” konsultanta (wstępny scoring),
- konsolidacja wyników z firmą.

### 3) Transformation Plan

Wynik ADMA ma prowadzić do planu:

- priorytety w 7 transformacjach,
- inicjatywy “foundation” (dane, integracje, kompetencje) + inicjatywy “value” (konkretne przypadki użycia),
- plan 12–24 miesiące + estymacja efektów.

## Skala dojrzałości 1–5 (użyteczna operacyjnie)

W praktyce (często spotykane nazewnictwo):

1. **Very basic / Newcomer** — digitalizacja incydentalna, ręczna praca dominuje.
2. **Basic / Beginner** — pierwsze narzędzia, silosy, pilotaże.
3. **Intermediate** — integracja w kluczowych obszarach, decyzje coraz częściej na danych.
4. **Factory of the Future** — zaawansowana integracja i automatyzacja, predict/optimize.
5. **Self-improving FoF** — pętle doskonalenia, AI/analytics, ciągła innowacja.

> Zasada: jeśli firma ma “punktowo” rozwiązania z poziomu 4, ale brak skali i standardów — nie podbijaj poziomu.

## 7 transformacji ADMA (T1–T7)

Każdą transformację oceniaj w rozmowie w 4 perspektywach: **technologicznej, biznesowej, środowiskowej, ludzkiej** (gdzie ma to sens).

### T1 — Advanced Manufacturing Technologies

- **Co oceniamy:** nowoczesne technologie wytwarzania (sprzęt, automatyzacja, zdolność absorpcji technologii).
- **Dowody:** park maszynowy, automatyzacje, modernizacje, zdolności UR, standardy utrzymania.
- **Pytania:**
  - Jakie technologie są “state-of-the-art” w Twojej branży i co już macie?
  - Czy automatyzacje są utrzymywane (MTBF/MTTR, części, kompetencje)?
  - Jak szybko wdrażacie nowe technologie i kto jest właścicielem?

### T2 — Digital Factory

- **Co oceniamy:** cyfrową warstwę fabryki (dane, integracje, IT/OT, spójność informacji).
- **Dowody:** ERP/MES/SCADA/WMS/QMS, architektura danych, integracje, raporty real-time.
- **Pytania:** single source of truth, integracje, jakość danych, cyber-segmentacja IT/OT.

### T3 — Eco Factory

- **Co oceniamy:** dojrzałość środowiskowa i efektywność energetyczna (sustainability, circular).
- **Dowody:** pomiary energii/mediów, KPI (kWh/szt.), inicjatywy redukcji, raportowanie ESG.
- **Pytania:** czy znacie koszt/ślad na produkt, czy macie pętlę optymalizacji energii, odzysk/recykling.

### T4 — End-to-End Customer Oriented Engineering

- **Co oceniamy:** projektowanie “od klienta” i przepływ wymagań do realizacji (digital thread).
- **Dowody:** PLM, zarządzanie zmianą, lead time od zamówienia do wdrożenia, VOC.
- **Pytania:** jak klient wpływa na produkt, jak zamykacie feedback loop, jak zarządzacie wariantowością.

### T5 — Human Centered Organization

- **Co oceniamy:** rozwój ludzi, kompetencje, ergonomia pracy i zaangażowanie.
- **Dowody:** matryce kompetencji, szkolenia, system sugestii, bezpieczeństwo psychologiczne, rotacja.
- **Pytania:** jak planujecie reskilling, czy pracownicy współtworzą zmiany, jak mierzycie adopcję.

### T6 — Smart Manufacturing

- **Co oceniamy:** inteligentne procesy produkcyjne (widoczność, predykcja, optymalizacja, elastyczność).
- **Dowody:** OEE/Andon, predykcyjne UR, planowanie, optymalizacja przez dane/AI.
- **Pytania:** czy decyzje są data-driven, gdzie jest closed-loop (reakcja automatyczna), jak szybko adaptujecie plan.

### T7 — Value Chain Oriented Open Factory

- **Co oceniamy:** współpracę w ekosystemie (dostawcy/klienci/uczelnie/startupy) i otwartość łańcucha wartości.
- **Dowody:** integracje z partnerami, wspólne KPI, projekty z uczelniami/partnerami, platformy.
- **Pytania:** jak wymieniacie dane w łańcuchu, jak budujecie zaufanie i standardy, jak działają partnerstwa.

## Mapowanie do “ADMA 2.0” w Consultify (5 filarów)

W UI aplikacji ADMA jest uproszczone do 5 filarów:

1. Strategy & Organization
2. Smart Products
3. Smart Operations
4. Smart Supply Chain
5. Data-Driven Services

**Rekomendowane mapowanie 7 → 5 (dla raportowania w systemie):**

- Strategy & Organization ← T5 + część T7 (organizacja/kompetencje/współpraca) + elementy governance
- Smart Products ← T4
- Smart Operations ← T1 + T6
- Smart Supply Chain ← T7 (wymiar value chain)
- Data-Driven Services ← T2 (dane/integracje) + elementy monetyzacji danych

Jeśli robisz audyt “kanoniczny” — raportuj w 7 transformacjach. Jeśli potrzebujesz spiąć wynik z formularzem w aplikacji — agreguj wg powyższego.
