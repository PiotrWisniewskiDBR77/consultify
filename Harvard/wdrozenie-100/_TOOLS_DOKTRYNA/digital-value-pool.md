# Digital Value Pools / Value-at-Stake — doktryna narzędzia

> Rodowód: McKinsey Digital ("value at stake" w analizach sektorowych — np. 140+ use case'ów AI/digital
> zmapowanych na 7 strumieni wartości w CPG), BCG ("Digital Value Gap", digital strategy roadmap: value
> potential × ambition × capability). W obu domach nie ma jednej "opatentowanej" nazwy narzędzia —
> "digital value pool" to potoczna nazwa całej rodziny analiz mapujących, GDZIE w łańcuchu wartości
> cyfryzacja/AI tworzy pieniądze, i ile.

## 1. Cel

Zlokalizować i **skwantyfikować** pule wartości cyfrowej/AI ukryte w organizacji — nie "gdzie da się
wdrożyć AI", tylko **gdzie leżą realne pieniądze**: które funkcje, procesy, linie biznesowe mają
największy value-at-stake (potencjalny wzrost przychodu, redukcja kosztu, uniknięte ryzyko) — i na tej
podstawie **spriorytetyzować**, gdzie inwestować pierwszy dolar transformacji, a gdzie NIE inwestować
mimo szumu medialnego.

Narzędzie odpowiada na pytanie zarządu: *"Mamy budżet na AI/digital — na co go wydać, żeby to było
widoczne w P&L, a nie w prezentacji?"*

## 2. Kiedy używać

- Formułowanie strategii cyfrowej/AI na poziomie firmy lub SBU.
- Alokacja budżetu transformacji (capex/opex) między konkurujące inicjatywy.
- Odpowiedź na "gdzie zacząć z AI" — kiedy zarząd chce pilotaż, ale nie wie który obszar wybrać.
- Budowanie business case'u pod inwestycję technologiczną (uzasadnienie kwoty wobec CFO).
- Coroczny przegląd portfela inicjatyw cyfrowych — czy pula wartości się wyczerpała, czy pojawiła się
  nowa (np. GenAI otworzyła pule niedostępne wcześniej — obsługa klienta, content, coding).
- NIE używać jako narzędzia operacyjnego wdrożenia (to warstwa strategii/priorytetyzacji, nie
  projektowania rozwiązania — po wyborze puli wchodzi się w case AI/automatyzacji per use case).

## 3. Inputy

- **Mapa łańcucha wartości / listy funkcji** organizacji (sprzedaż, marketing, operacje, łańcuch
  dostaw, finanse, HR, IT, obsługa klienta, R&D) — punkt wyjścia dekompozycji.
- **Baseline finansowy**: struktura kosztów per funkcja (FTE, koszt procesowy, koszt błędów/rework),
  struktura przychodu (per segment/kanał/produkt), marże.
- **Benchmarki branżowe** (raporty McKinsey/BCG/Gartner per sektor — ile % kosztu/przychodu typowo
  "w grze" dla danej funkcji przy digitalizacji/AI; np. w customer service 20-30% redukcji kosztu
  obsługi przy dobrym wdrożeniu GenAI).
- **Katalog use case'ów** — zarówno "z rynku" (co robi konkurencja/branża), jak i zgłoszonych
  wewnętrznie (warsztaty z liniami biznesowymi, ból operacyjny).
- **Dane o dojrzałości**: jakość danych, stan systemów źródłowych, poziom digitalizacji procesu
  bazowego (nie da się "AI-fikować" procesu, który jest papierowy).
- **Ambicja zarządu**: horyzont czasowy, apetyt na ryzyko, czy celem jest efektywność czy
  transformacja modelu biznesowego.

## 4. Metoda

1. **Dekompozycja łańcucha wartości** — rozbij organizację na funkcje/procesy (10-20 węzłów), nie
   analizuj "AI w firmie" jako całość — to zbyt ogólne, żeby cokolwiek wynikło.
2. **Oszacowanie "value at stake" per węzeł** — dla każdej funkcji: jaki % kosztu bazowego lub
   przychodu bazowego jest teoretycznie "w grze" pod wpływem cyfryzacji/AI (benchmark branżowy ×
   wielkość bazy). To pułap teoretyczny, nie prognoza.
3. **Impact × Feasibility (macierz priorytetyzacji)** — każdy zidentyfikowany use case/pulę ocenia się
   na dwóch osiach:
   - **Impact**: wielkość wartości, szybkość materializacji, strategiczność (czy buduje przewagę, czy
     tylko domyka parytet).
   - **Feasibility**: dostępność i jakość danych, dojrzałość technologiczna, złożoność zmiany
     organizacyjnej/procesowej, koszt i czas wdrożenia, ryzyko regulacyjne.
4. **Ambition-to-impact** — zestawienie "ile wartości jest w grze" z "ile firma realistycznie może
   przechwycić w danym horyzoncie" (capture rate) — bo value-at-stake to nie to samo co value captured.
5. **Roadmapa** — sekwencjonowanie: quick wins (wysoki impact, wysoka feasibility) najpierw,
   fundamenty danych/platformy równolegle, duże obstawienia strategiczne (wysoki impact, niska
   feasibility) jako program wieloletni, "no-go" (niski impact niezależnie od feasibility) — odrzucone
   jawnie, żeby nie wracały co kwartał.

## 5. Jak się WNIOSKUJE

- **Top-down vs bottom-up sizing — użyj obu i porównaj rozbieżność.**
  - Top-down: benchmark branżowy × baza kosztowa/przychodowa firmy → szybki pułap teoretyczny, dobry
    do rankingu funkcji, słaby do precyzyjnego uzasadnienia budżetu (łatwo przeszacować).
  - Bottom-up: suma konkretnych use case'ów zgłoszonych i skwantyfikowanych z liniami biznesowymi →
    wolniejszy, ale defensowalny wobec CFO.
  - Duża rozbieżność top-down vs bottom-up = sygnał: albo są niewidoczne/niezgłoszone use case'y
    (bottom-up zaniża), albo benchmark branżowy nie pasuje do specyfiki firmy (top-down zawyża).
- **Feasibility to nie tylko technologia.** Najczęstszy błąd: ocenia się feasibility jako "czy
  technologia istnieje" (prawie zawsze tak) i pomija dane (czy są kompletne, dostępne, dobrej
  jakości), zmianę procesu (czy trzeba przeprojektować workflow, nie tylko podłączyć narzędzie) i
  zmianę ludzką (czy właściciel procesu chce, czy sabotuje).
- **Pułapka "pilotów bez skali"** (twardy fakt z rynku 2024-2026): większość firm utyka w fazie
  pilotażu — mniej niż 10% wdrożonych use case'ów AI przechodzi pilotaż do skali produkcyjnej;
  ~70% programów zmiany failuje przez opór/brak wsparcia zarządu, nie przez technologię. WNIOSEK
  METODOLOGICZNY: wysoki impact + wysoka feasibility TECHNICZNA to za mało — trzeba osobno ocenić
  "feasibility skalowania" (czy jest właściciel procesu z budżetem i mandatem, czy jest ścieżka do
  >1 lokalizacji/zespołu, czy metryka sukcesu jest biznesowa a nie adopcyjna).
- **Gdzie wartość realna vs hype.** Sygnał hype: use case powtarza się we wszystkich prezentacjach
  konkurencji, ale nikt nie potrafi pokazać liczby $ per firma — zwykle znaczy to niską feasibility
  danych (świetnie brzmi, źle się wdraża) albo że wartość już skonsumowana przez early movers.
  Sygnał realnej puli: baza kosztowa/przychodowa jest duża, proces bazowy jest ustrukturyzowany i
  cyfrowy (dane już istnieją), a właściciel procesu zgłasza ból SAM, bez podpowiedzi z zewnątrz.
- **Capture rate maleje z czasem, jeśli się nie działa.** Pula wartości nie jest statyczna — im dłużej
  się zwleka, tym więcej z niej przechwytuje konkurencja lub tym bardziej się kurczy (np. produkt
  komodytyzuje się, marża spada, więc % "w grze" też spada w wartości bezwzględnej).
- **Brakująca pula to często najcenniejszy insight.** Funkcja, o której nikt w warsztacie nie
  wspomina (bo "zawsze tak było") — częściej niż nie, to tam leży niewykorzystana pula, bo nikt
  jej nie kwestionował.

## 6. INSIGHTY (rdzeń narzędzia)

To jest sedno — narzędzie istnieje, żeby wygenerować zdania typu:

- *"80% zmapowanej wartości cyfrowej leży w 2 z 12 funkcji (obsługa klienta + planowanie łańcucha
  dostaw) — reszta portfela to razem <20%, mimo że pochłania >50% budżetu inicjatyw."* → realokacja.
- *"Use case X: wysoki impact, ale feasibility blokowana przez jakość danych źródłowych (brak
  ustandaryzowanego CRM) — odłóż do czasu fundamentu danych, nie buduj na piasku."*
- *"Brakująca pula: nikt w organizacji nie patrzy na funkcję Z (np. planowanie cen/pricing) pod kątem
  AI — a benchmark branżowy pokazuje, że to typowo 3-5% marży w grze. Zero inicjatyw = martwe pole."*
- *"Rozbieżność top-down (X mln) vs bottom-up (0,3X mln) o rząd wielkości = albo linie biznesowe nie
  widzą swojego bólu, albo zarząd żyje w benchmarku, który nie pasuje do modelu biznesowego firmy."*
- *"3 use case'y na liście to peryferyjny quick-fix (<1% puli), a pochłaniają najwięcej uwagi
  zarządu, bo są 'widoczne' — prawdziwa pula czeka w mniej efektownym, ale dużym procesie
  operacyjnym."*
- *"Feasibility techniczna wysoka, ale brak właściciela procesu z mandatem i budżetem — to jest
  kandydat na 'pilot, który nigdy nie przejdzie do skali', niezależnie od jakości technologii."*
- Każdy taki insight → konkretna inicjatywa transformacyjna z uzasadnioną kolejnością w roadmapie
  (nie: "wdrożmy AI", tylko: "zainwestuj tu pierwszy, bo tu jest pieniądz i da się go wziąć").

## 7. Worked example

**Kontekst:** średniej wielkości firma B2B usługowa (DBR77-podobny profil), przychód 200 mln PLN,
rozważa gdzie skierować budżet transformacji cyfrowej/AI na 2027 (5 mln PLN).

**Krok 1 — dekompozycja:** 8 funkcji: Sprzedaż, Marketing, Dostawa usługi/realizacja projektów,
Obsługa klienta, Finanse/administracja, HR, IT/operacje wewnętrzne, Zarządzanie wiedzą.

**Krok 2 — top-down value at stake** (benchmark branżowy × baza kosztowa):
- Dostawa usługi/realizacja (60 mln PLN kosztu bezpośredniego): benchmark 15-20% redukcji przez
  automatyzację raportowania i draftowanie deliverables AI → 9-12 mln PLN w grze.
- Sprzedaż (15 mln PLN kosztu): benchmark 10% wzrostu konwersji przez AI-lead scoring → ~3 mln PLN.
- Zarządzanie wiedzą (brak wydzielonego budżetu, koszt ukryty w czasie konsultantów — szacunek 8 mln
  PLN "utopionego" czasu na szukanie/odtwarzanie wiedzy): benchmark 20-30% redukcji → 2-2,5 mln PLN.
- Finanse/administracja (5 mln PLN kosztu): benchmark 25% automatyzacji księgowań/raportów →
  1,2 mln PLN.
- Pozostałe funkcje: <0,5 mln PLN każda — poniżej progu istotności.

**Krok 3 — bottom-up (zgłoszone use case'y z warsztatów):**
- Auto-draft deliverables (Word/Deck/Sheet z danych projektu) — zgłoszony przez 6/8 liderów projektów,
  szacunek oszczędności 4 mln PLN/rok.
- AI-lead scoring — zgłoszony przez szefa sprzedaży, szacunek 1,5 mln PLN/rok.
- Baza wiedzy z semantycznym wyszukiwaniem — zgłoszona przez 2 konsultantów juniorskich, brak
  szacunku finansowego (nieskwantyfikowana — czerwona flaga: duża top-down pula, zero bottom-up
  głosu = brak właściciela).

**Krok 4 — macierz impact/feasibility:**
- Auto-draft deliverables: impact WYSOKI (9-12 mln top-down / 4 mln bottom-up), feasibility WYSOKA
  (dane projektowe już strukturalne w systemie) → **zrób pierwsze**.
- AI-lead scoring: impact ŚREDNI, feasibility NISKA (CRM ma 40% pustych pól, dane niespójne) →
  **odłóż do czasu higieny danych CRM**.
- Baza wiedzy: impact WYSOKI teoretycznie, feasibility NISKA (brak strukturyzacji dokumentów,
  brak właściciela procesu) i brak mandatu → **pilotaż mały, nie duży budżet, dopóki nie ma
  właściciela**.

**Insight końcowy:** *"Pula 'Dostawa usługi' to 65% całej zmapowanej wartości cyfrowej firmy, a
dostała dotąd 10% uwagi zarządu — reszta energii szła w sprzedażowe AI, które ma 3x mniejszą pulę i
gorszą feasibility z powodu jakości danych CRM. Rekomendacja: 70% budżetu 2027 w auto-draft
deliverables (quick win, duża pula, dane gotowe), 20% w higienę danych CRM jako fundament pod
przyszły lead scoring, 10% w pilotaż bazy wiedzy z jawnym wymogiem wyznaczenia właściciela procesu
przed skalowaniem — inaczej to kolejny 'pilot bez skali'."*

## 8. Źródła

- [McKinsey — Fortune or fiction? The real value of a digital and AI transformation in CPG](https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/fortune-or-fiction-the-real-value-of-a-digital-and-ai-transformation-in-cpg) — 140+ use case'ów zmapowanych na 7 strumieni wartości, metodyka value-at-stake per value stream.
- [McKinsey — Choose the right scope for digital transformation](https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/choose-the-right-transformation-bite-size) — kryterium "widoczna wartość w grze + mierzalny impact" jako filtr scope'u transformacji.
- [McKinsey — Managing geopolitical value at stake](https://www.mckinsey.com/capabilities/geopolitics/our-insights/managing-geopolitical-value-at-stake-to-seize-opportunities-while-mitigating-risk) — ogólna metodyka wieloetapowego szacowania "value at stake" (metryki × prawdopodobieństwo × dotkliwość) przenoszalna na kontekst cyfrowy.
- [BCG — Assessing the Growing Digital Value Gap](https://www.bcg.com/publications/2022/assessing-digital-value-gap) — luka między firmami przechwytującymi wartość cyfrową a resztą rynku.
- [BCG — Digital Strategy Roadmap](https://www.bcg.com/capabilities/digital-technology-data/digital-strategy-roadmap) — priorytetyzacja opportunities wg value potential/ambition/capability.
- [BCG — A Bold New Approach to Technology Transformation](https://www.bcg.com/publications/2022/bold-new-approach-technology-transformation) — lighthouse use case'y, sekwencjonowanie MVP → skala.
- [McKinsey — Seizing the agentic AI advantage / state of AI 2025](https://www.mckinsey.com/capabilities/quantumblack/our-insights/seizing-the-agentic-ai-advantage) — dane o pułapce "pilotów bez skali" (<10% use case'ów przechodzi do skali), flawed metrics (tylko 20% firm mierzy wynikiem biznesowym).
- [McKinsey — The five-layer AI measurement framework](https://www.mckinsey.com/capabilities/quantumblack/our-insights/from-promise-to-impact-how-companies-can-measure-and-realize-the-full-value-of-ai) — jak mierzyć realizację wartości AI (nie tylko adopcję).
