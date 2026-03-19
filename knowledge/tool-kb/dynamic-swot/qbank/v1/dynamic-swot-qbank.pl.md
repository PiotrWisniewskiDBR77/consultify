# Dynamic SWOT — QBank Pack (v1, PL)

## Pack meta

- **tool_slug**: `dynamic-swot`
- **pack_type**: `qbank`
- **pack_version**: `1.0.0`
- **language**: `pl`
- **source_kind**: `tool_pack`

## Provenance (sources)

- `docs/product/DYNAMIC_SWOT_TOOL_SPEC_V1.md`
- `docs/product/DYNAMIC_SWOT_MVP_V1.md`
- `docs/product/DYNAMIC_SWOT_IMPLEMENTATION_BACKLOG_V1.md`
- `docs/product/DYNAMIC_SWOT_CONTENT_PACK_V1.md`
- `src/store/useToolStore.ts`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTBuildPhase.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInsightsPhase.tsx`
- `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/how-to-use-swot-analysis-effectively/index.html`
- `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/tows-matrix-guide/index.html`
- `knowledge/Strategie /Busines to you.zip :: Busines to you/www.business-to-you.com/swot-analysis/index.html`
- `knowledge/Strategie /nibusinessinfo.zip :: nibusinessinfo/www.nibusinessinfo.co.uk/content/swot-analysis-example.html`

## Audience + use

- **Used by**: UI + AI
- **Do not use for**: automatycznego przypisywania odpowiedzi do ćwiartek bez walidacji użytkownika

---

## Sections (chunk-friendly)

### [section_id:overview] Jak używać tego QBanku

- QBank ma wspierać `conversation-first` flow.
- Pytania mają być krótkie, konkretne i prowadzić do jednego obiektu na raz.
- AI powinno:
  - zadać 1-3 pytania,
  - zaproponować strukturyzację,
  - poprosić o akceptację / korektę.

### [section_id:application_mapping] Mapowanie na aplikację

- **Library preview should show**: 1-2 pytania framingowe, kiedy użyć SWOT.
- **Main work surface should show**: pytania dla aktualnego etapu, nie cały bank naraz.
- **Help / AI surface should show**: follow-up probes i pytania naprawcze.
- **Outputs surface should show**: pytania o gotowość do initiative/report/presentation/idea.

### [section_id:evidence] Zasada użycia pytań

- Pytanie ma prowadzić do konkretnej obserwacji albo decyzji.
- Jeśli odpowiedź jest zbyt ogólna, AI ma zadać follow-up.
- Jeśli odpowiedź nie ma evidence, AI ma dopytać:
  - “skąd to wiemy?”
  - “czy to fakt, obserwacja czy hipoteza?”

### [area_id:mission] Mission Brief

#### [level:core] Core framing

- **Meaning**: zdefiniowanie decyzji i ram pracy.
- **Core questions**:
  - Q1: Jaką konkretną decyzję strategiczną próbujemy podjąć?
  - Q2: Jaki obszar firmy, rynku lub produktu obejmuje ta analiza?
  - Q3: Po czym poznamy, że ta sesja była użyteczna?
- **Follow-up probes**:
  - Co jest poza zakresem tej sesji?
  - Jaki horyzont czasu jest istotny: 3, 12 czy 24 miesiące?
  - Kto będzie odbiorcą wyniku: zarząd, lider obszaru, klient, zespół?
- **Example of a strong answer**: “Chcemy zdecydować, czy przyspieszyć wejście w kanał partnerski B2B w ciągu najbliższych 12 miesięcy bez utraty marży premium.”
- **Evidence guidance**: oczekuj choć jednego kontekstu biznesowego, KPI albo constraintu.
- **Common mistakes**:
  - “Chcemy po prostu rosnąć.”
  - “Przeanalizujmy całą firmę.”

#### [level:constraints] Assumptions and constraints

- **Meaning**: jawne nazwanie ograniczeń i założeń.
- **Core questions**:
  - Q1: Jakie ograniczenia musimy brać pod uwagę od początku?
  - Q2: Jakie założenia przyjmujemy, choć nie mamy jeszcze pełnych danych?
  - Q3: Czego nie wolno nam zepsuć, nawet jeśli chcemy przyspieszyć wzrost?
- **Follow-up probes**:
  - Czy są bariery budżetowe, kompetencyjne lub regulacyjne?
  - Jakie ryzyka reputacyjne lub operacyjne są krytyczne?
  - Które założenia wymagają później weryfikacji?
- **Example of a strong answer**: “Nie możemy obniżyć poziomu obsługi kluczowych klientów enterprise ani zwiększyć CAC o więcej niż 15%.”
- **Evidence guidance**: dobrze, jeśli constraint da się powiązać z realnym ograniczeniem biznesowym.
- **Common mistakes**:
  - brak constraints,
  - mieszanie constraintów z celami.

### [area_id:internal_reality] Internal Reality / sygnały wewnętrzne

#### [level:strengths] Strength signals

- **Meaning**: identyfikacja przewag wewnętrznych, które realnie pomagają.
- **Core questions**:
  - Q1: Co dziś daje nam przewagę, której konkurencja nie replikuje łatwo?
  - Q2: Jakie zasoby, kompetencje lub relacje już działają na naszą korzyść?
  - Q3: Gdzie organizacja dowozi lepiej niż przeciętnie?
- **Follow-up probes**:
  - Skąd to wiemy?
  - Czy ta przewaga jest skalowalna?
  - Czy to przewaga trwała czy chwilowa?
- **Example of a strong answer**: “Mamy wysoki poziom retencji klientów premium i krótszy czas wdrożenia niż u dwóch głównych konkurentów.”
- **Evidence guidance**: pytaj o KPI, przykłady klientów, dane procesowe.
- **Common mistakes**:
  - mylenie życzeń z przewagą,
  - wpisy zbyt ogólne: “dobry zespół”.

#### [level:weaknesses] Weakness signals

- **Meaning**: ograniczenia wewnętrzne, które hamują cel sesji.
- **Core questions**:
  - Q1: Co regularnie spowalnia wykonanie, sprzedaż albo jakość?
  - Q2: Gdzie tracimy czas, marżę lub przewagę?
  - Q3: Czego organizacja nie potrafi dziś zrobić wystarczająco dobrze?
- **Follow-up probes**:
  - Czy to problem systemowy czy incydentalny?
  - Co jest objawem, a co przyczyną?
  - Jak często ten problem wraca?
- **Example of a strong answer**: “Brak dedykowanego lejka dla partnerów powoduje, że leady B2B są obsługiwane jak retail i mają niższą konwersję.”
- **Evidence guidance**: szukaj danych o opóźnieniach, stratach, reklamacji, rozjazdach jakości.
- **Common mistakes**:
  - wpisy personalne zamiast systemowych,
  - mieszanie słabości z zewnętrznym zagrożeniem.

### [area_id:external_reality] Market Reality / sygnały zewnętrzne

#### [level:opportunities] Opportunity signals

- **Meaning**: zewnętrzne zmiany, które można wykorzystać.
- **Core questions**:
  - Q1: Jakie zmiany na rynku mogą zadziałać na naszą korzyść?
  - Q2: Gdzie rośnie popyt, którego jeszcze nie wykorzystujemy?
  - Q3: Jakie luki konkurencyjne albo kanały otwierają nowe pole wzrostu?
- **Follow-up probes**:
  - Czy to okno jest trwałe czy krótkie?
  - Co musi się wydarzyć wewnętrznie, żeby z tego skorzystać?
  - Czy to szansa dla całej firmy czy tylko jednego segmentu?
- **Example of a strong answer**: “Rośnie popyt na szybsze wdrożenia self-serve w segmencie partnerów regionalnych.”
- **Evidence guidance**: proś o benchmark, sygnał rynkowy, case konkurencji albo dane pipeline.
- **Common mistakes**:
  - wpisy zbyt szerokie: “AI jest szansą”.
  - brak związku z celem sesji.

#### [level:threats] Threat signals

- **Meaning**: zewnętrzne ryzyka i presje, które mogą zaszkodzić planowi.
- **Core questions**:
  - Q1: Co z zewnątrz może utrudnić realizację celu?
  - Q2: Jakie presje rynkowe, kosztowe albo konkurencyjne są dziś najbardziej realne?
  - Q3: Co się stanie, jeśli zignorujemy ten sygnał?
- **Follow-up probes**:
  - Jak bliskie czasowo jest to ryzyko?
  - Czy ryzyko dotyczy popytu, marży, operacji czy reputacji?
  - Czy mamy dziś jakąkolwiek tarczę obronną?
- **Example of a strong answer**: “Presja cenowa w kanale retail może skłaniać klientów do tańszych alternatyw, zanim rozbudujemy ofertę premium.”
- **Evidence guidance**: proś o dane cenowe, działania konkurencji, regulacje, trendy branżowe.
- **Common mistakes**:
  - mylenie zagrożenia z wewnętrznym brakiem kompetencji,
  - wrzucanie ogólnych lęków bez źródła.

### [area_id:signal_hygiene] Higiena sygnałów

#### [level:quality] Quality checks

- **Meaning**: zapewnienie, że sygnały nadają się do klasyfikacji.
- **Core questions**:
  - Q1: Czy ten sygnał opisuje jedną obserwację, a nie trzy tematy naraz?
  - Q2: Czy wiemy, skąd pochodzi ten sygnał?
  - Q3: Czy to fakt, obserwacja czy hipoteza?
- **Follow-up probes**:
  - Jak skrócić ten wpis do jednej tezy?
  - Czy ten sygnał nie jest już gotowym wnioskiem?
  - Czy da się go połączyć z konkretnym dowodem?
- **Example of a strong answer**: “Konwersja partnerów spadła po uproszczeniu oferty cenowej dla retail.”
- **Evidence guidance**: każdy sygnał powinien mieć `sourceLabel` i sensowny confidence.
- **Common mistakes**:
  - brak źródła,
  - długie wielozdaniowe wpisy,
  - gotowa rekomendacja zamiast sygnału.

### [area_id:swot_classification] Budowa kart SWOT

#### [level:classification] Classification and cleanup

- **Meaning**: poprawne przypisanie sygnałów do ćwiartek i oczyszczenie macierzy.
- **Core questions**:
  - Q1: Czy ten wpis jest wewnętrzny czy zewnętrzny?
  - Q2: Czy ten wpis pomaga nam, czy nas ogranicza?
  - Q3: Czy ten wpis jest duplikatem innej karty?
- **Follow-up probes**:
  - Czy tu nie mieszamy przyczyny ze skutkiem?
  - Czy ten element ma wystarczającą wagę, aby zostać w macierzy?
  - Czy wpis powinien zostać rozbity na dwa osobne elementy?
- **Example of a strong answer**: “Wysoka retencja premium” trafia do `strengths`, a “brak dedykowanego lejka B2B” do `weaknesses`.
- **Evidence guidance**: AI powinna dopytać o impact i confidence.
- **Common mistakes**:
  - wpis w złej ćwiartce,
  - zbyt wiele prawie identycznych kart,
  - brak priorytetu.

### [area_id:tensions] Strategic Tensions

#### [level:attack_repair_defend_protect] Tension generation

- **Meaning**: łączenie kart w napięcia o wartości strategicznej.
- **Core questions**:
  - Q1: Które połączenie kart tworzy dziś najsilniejszy dylemat albo okazję?
  - Q2: Dlaczego to napięcie ma znaczenie teraz, a nie “kiedyś”?
  - Q3: Co stanie się, jeśli nie odpowiemy na to napięcie?
- **Follow-up probes**:
  - Czy to jest `attack`, `repair`, `defend` czy `protect`?
  - Które dwie karty są tu kluczowe?
  - Czy istnieje kontrargument osłabiający to napięcie?
- **Example of a strong answer**: “Silna retencja premium + wzrost kanału partnerskiego tworzą napięcie attack: mamy bazę zaufania, ale nie mamy skalowalnego modelu wejścia.”
- **Evidence guidance**: napięcie powinno wskazywać source pair i `why now`.
- **Common mistakes**:
  - opis samej korelacji bez decyzji,
  - napięcie bez implikacji.

### [area_id:moves] Recommended Moves

#### [level:move_design] Move generation

- **Meaning**: zamiana napięć w konkretne ruchy.
- **Core questions**:
  - Q1: Jaki ruch najlepiej odpowiada na to napięcie?
  - Q2: Czy to quick win, big bet, defensive move czy capability build?
  - Q3: Jaki powinien być pierwszy krok, jeśli mamy ruszyć w ciągu 30 dni?
- **Follow-up probes**:
  - Jaki będzie spodziewany wpływ?
  - Jakie jest ryzyko i wysiłek?
  - Od czego zależy sukces tego ruchu?
- **Example of a strong answer**: “Stworzyć standaryzowany pakiet onboardingowy dla partnerów, zaczynając od pilota w jednym segmencie.”
- **Evidence guidance**: ruch powinien mieć uzasadnienie, linked tensions i first step.
- **Common mistakes**:
  - slogan zamiast ruchu,
  - ruch oderwany od napięcia,
  - brak priorytetu.

### [area_id:outputs] Outputs and readiness

#### [level:readiness] Output readiness

- **Meaning**: wybór właściwego outputu na podstawie dojrzałości insightu.
- **Core questions**:
  - Q1: Czy któryś ruch jest gotowy, by stać się inicjatywą?
  - Q2: Czy potrzebujemy najpierw executive report lub prezentacji, aby uzyskać zgodę?
  - Q3: Czy istnieje obiecujący kierunek, który jest jeszcze za wcześnie na inicjatywę i powinien zostać zapisany jako idea?
- **Follow-up probes**:
  - Czy final source summary jest wystarczająco jasne?
  - Czy mamy ownera lub sponsora dla następnego kroku?
  - Czy czegoś jeszcze brakuje do decyzji?
- **Example of a strong answer**: “Ruch onboardingowy jest gotowy na inicjatywę, ale dwa inne kierunki zapiszemy jako idee do dalszego zbadania.”
- **Evidence guidance**: output powinien wynikać z rekomendowanego ruchu, nie z intuicji poza sesją.
- **Common mistakes**:
  - tworzenie inicjatywy z hipotezy bez weryfikacji,
  - kończenie na summary bez decyzji o dalszym kroku.

### [area_id:repair_questions] Pytania naprawcze, gdy sesja jest słaba

#### [level:gaps] Gap recovery

- **Meaning**: pytania, które pomagają domknąć luki przed finalizacją.
- **Core questions**:
  - Q1: Która ćwiartka jest dziś najsłabiej udokumentowana?
  - Q2: Które wpisy są najbardziej ogólne lub najmniej wiarygodne?
  - Q3: Jakiego jednego dowodu najbardziej nam brakuje, aby zwiększyć pewność?
- **Follow-up probes**:
  - Czy któryś wpis powinien zostać obniżony z faktu do hipotezy?
  - Czy mamy za dużo kart, a za mało priorytetów?
  - Które napięcie jest sztucznie napompowane przez brak danych?
- **Example of a strong answer**: “Najbardziej brakuje nam twardych danych dla szans w kanale partnerskim, więc trzeba je oznaczyć jako hipotezę i dodać benchmark.”
- **Evidence guidance**: recovery questions powinny prowadzić do korekty stanu, nie tylko do rozmowy.
- **Common mistakes**:
  - ukrywanie luk,
  - sztuczne dopisywanie kart tylko po to, by zapełnić macierz.
