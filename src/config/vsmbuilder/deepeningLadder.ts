/**
 * VSM Builder — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Inventory Autopilot / SMED `deepeningLadder` + `PROPOSAL_BANK`
 * pattern (see src/config/inventoryautopilot/deepeningLadder.ts). Encodes the
 * Value-Stream-Mapping-specific "depth staircase" per lever of the analysis:
 *
 *   1. surface          — what does the flow / step look like from the outside?
 *   2. evidence         — is it measured on gemba, or estimated from memory / procedure?
 *   3. quantification   — how much lead time / rework / capital does it cost, in numbers?
 *   4. risk-capability  — what capability / discipline must exist to change it safely & keep it?
 *
 * The four canonical levers mirror the disciplined VSM diagnostic order
 * (doctrine §4-§6): you cannot locate a constraint before the flow is mapped,
 * you cannot cost the waste before the flow is timed, and the future-state /
 * kaizen sequence must lead with the true constraint, not the loudest step.
 *   - flow        : map the current-state end-to-end and time it (C/T, L/T, timeline, PCE input)
 *   - bottleneck  : locate the TRUE constraint from queues/WIP & uptime, not the longest step
 *   - waste       : classify value-add vs 7 muda; find the pure-waste steps to eliminate
 *   - rework      : quantify the hidden factory (%C&A < 100%) — the invisible rework cost
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (vsmEngine.ts).
 */

export type VsmLeverId = 'flow' | 'bottleneck' | 'waste' | 'rework';

export const VSM_LEVERS: VsmLeverId[] = ['flow', 'bottleneck', 'waste', 'rework'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and lever-agnostic. */
export interface LadderRung {
  id: 'surface' | 'evidence' | 'quantification' | 'risk-capability';
  /** 1-4 depth level (surface..risk) — used by the synthesis engine for depth scoring. */
  depth: 1 | 2 | 3 | 4;
  label: Bilingual;
  /** The prompt shown to the user / fed to AI when deepening this rung. */
  question: Bilingual;
  /** Why this rung matters — the consultant framing. */
  rationale: Bilingual;
}

const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const VSM_LADDER_RUNG_ORDER = RUNG_ORDER;

const VSM_LEVER_LABEL: Record<VsmLeverId, Bilingual> = {
  flow: { pl: 'Przepływ', en: 'Flow' },
  bottleneck: { pl: 'Ograniczenie', en: 'Constraint' },
  waste: { pl: 'Marnotrawstwo', en: 'Waste' },
  rework: { pl: 'Przeróbki', en: 'Rework' },
};

export const vsmLeverLabel = (lever: VsmLeverId): Bilingual => VSM_LEVER_LABEL[lever];

/**
 * Per-lever deepening ladder. Each lever has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const VSM_DEEPENING_LADDER: Record<VsmLeverId, LadderRung[]> = {
  flow: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak wygląda ten strumień od triggera klienta do dostarczenia wartości — jakie kroki, kto je wykonuje i w jakiej kolejności praca faktycznie przechodzi?',
        en: 'What does this stream look like from the customer trigger to value delivery — which steps, who performs them, and in what order does work actually pass?',
      },
      rationale: {
        pl: 'Większość organizacji zna proces z procedury, nie z rzeczywistości — dopóki nie zmapujecie kroków end-to-end, nikt pojedynczy nie widzi, gdzie praca utyka między działami.',
        en: 'Most organizations know the process from a procedure, not from reality — until you map the steps end-to-end, no single person can see where work stalls between departments.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd pochodzą czasy kroków — ze zmierzenia na gemba stoperem / z logów, czy z pamięci uczestników i wartości „z procedury"?',
        en: 'Where do the step times come from — measured on gemba with a stopwatch / from logs, or from participants\' memory and "as-per-procedure" values?',
      },
      rationale: {
        pl: 'Mapa z szacunkami „na oko" to ilustracja, nie diagnostyka — dowodem jest czas zmierzony na jednej realnej jednostce (follow-one-piece), nie średnia z sali warsztatowej.',
        en: 'A map built on gut-feel estimates is an illustration, not a diagnosis — the evidence is time measured on one real unit (follow-one-piece), not an average from the workshop room.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile wynosi całkowity lead time strumienia (z kolejkami) w porównaniu z sumą czasu faktycznej pracy (C/T) — jaki jest stosunek jednego do drugiego?',
        en: 'What is the total stream lead time (queues included) versus the sum of actual work time (C/T) — what is the ratio of one to the other?',
      },
      rationale: {
        pl: 'Ten stosunek to Process Cycle Efficiency — dopóki go nie policzycie, „proces trwa za długo" jest odczuciem; PCE zamienia je w twardy, policzalny dowód skali marnotrawstwa.',
        en: 'That ratio is Process Cycle Efficiency — until you compute it, "the process takes too long" is a feeling; PCE turns it into hard, quantified proof of the scale of waste.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy potraficie utrzymać mapę żywą — re-mapować po każdej zmianie — czy powstanie jednorazowo i stanie się martwym dokumentem na ścianie?',
        en: 'Can you keep the map alive — re-mapping after each change — or will it be drawn once and become a dead document on the wall?',
      },
      rationale: {
        pl: 'VSM to cykl, nie zdarzenie — bez kadencji przeglądu ograniczenie i tak się przesunie, a future-state map przestanie odzwierciedlać rzeczywistość w kilka tygodni.',
        en: 'VSM is a cycle, not an event — without a review cadence the constraint moves anyway, and the future-state map stops reflecting reality within weeks.',
      },
    },
  ],
  bottleneck: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Który krok organizacja uważa za „winowajcę" spowolnienia — i na czym opiera to przekonanie (najdłuższy czas pracy, najwięcej narzekań)?',
        en: 'Which step does the organization consider the "culprit" of the slowdown — and what is that belief based on (longest work time, most complaints)?',
      },
      rationale: {
        pl: 'Intuicja organizacji niemal zawsze wskazuje krok najgłośniejszy lub najbardziej widoczny, nie ten, który realnie ogranicza przepustowość — nazwanie tej intuicji na starcie pozwala ją później skonfrontować z danymi.',
        en: 'The organization\'s intuition almost always points to the loudest or most visible step, not the one that actually limits throughput — naming that intuition up front lets you later confront it with data.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Gdzie praca piętrzy się najbardziej (największa kolejka / WIP PRZED krokiem) i który krok ma najniższy uptime względem wymaganego czasu pracy?',
        en: 'Where does work pile up most (largest queue / WIP BEFORE a step) and which step has the lowest uptime relative to its required cycle time?',
      },
      rationale: {
        pl: 'Ograniczenie zdradza się kolejką, która rośnie przed nim, a nie długim czasem pracy w nim — praca czeka na WEJŚCIE do constraintu, a kroki za nim głodują; to sygnał wizualny, nie opinia.',
        en: 'The constraint reveals itself through the queue growing before it, not through a long work time within it — work waits to ENTER the constraint while downstream steps starve; it is a visual signal, not an opinion.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile lead time całego strumienia siedzi w jednym-dwóch krokach — i o ile skróciłby się strumień, gdyby udrożnić właśnie ten constraint (a nie krok obok)?',
        en: 'How much of the whole stream\'s lead time sits in one or two steps — and how much would the stream shorten if you unblocked that constraint (and not the step beside it)?',
      },
      rationale: {
        pl: 'Teoria ograniczeń jest bezwzględna: zysk z usprawnienia NIE-ograniczenia jest iluzoryczny — przepustowość i tak wyznacza constraint; bez policzenia udziału w lead time nie odróżnicie realnej dźwigni od kosztownej pozorności.',
        en: 'The theory of constraints is unforgiving: the gain from improving a NON-constraint is illusory — throughput is set by the constraint anyway; without quantifying its lead-time share you cannot tell the real lever from a costly illusion.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy po udrożnieniu tego constraintu potraficie ponownie znaleźć następny (bo ograniczenie się przesunie) — czy ogłosicie sukces i przestaniecie patrzeć?',
        en: 'After unblocking this constraint, can you find the next one (because the constraint will move) — or will you declare success and stop looking?',
      },
      rationale: {
        pl: 'Klasyczny błąd: rozwiązać ograniczenie A, ogłosić zwycięstwo, nie zauważyć że B jest teraz nowym constraintem i pochłania cały zysk — bez zdolności do re-mapowania efekt punktowej interwencji wyparowuje.',
        en: 'The classic error: solve constraint A, declare victory, miss that B is now the new constraint absorbing the entire gain — without the capability to re-map, the effect of a point intervention evaporates.',
      },
    },
  ],
  waste: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Za które kroki klient zapłaciłby wprost, gdyby je widział (wartość dodana), a które są tylko przekazaniem, oczekiwaniem, kontrolą lub podwójną robotą?',
        en: 'Which steps would the customer pay for outright if they saw them (value-add), and which are only handoffs, waiting, inspection, or double work?',
      },
      rationale: {
        pl: 'Rozdzielenie wartości dodanej od marnotrawstwa jest fundamentem — bez niego „usprawniamy proces" oznacza zwykle przyspieszanie kroków, które w ogóle nie powinny istnieć.',
        en: 'Separating value-add from waste is the foundation — without it "we improve the process" usually means speeding up steps that should not exist at all.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Do której z 7 muda należy każdy krok bez wartości (nadprodukcja, oczekiwanie, transport, nadmierne przetwarzanie, zapas, ruch, wady) — i czy to konieczne NVA (regulacyjne), czy czyste marnotrawstwo?',
        en: 'Which of the 7 muda does each non-value step belong to (overproduction, waiting, transport, over-processing, inventory, motion, defects) — and is it necessary NVA (regulatory) or pure waste?',
      },
      rationale: {
        pl: 'Nie każdy krok bez wartości da się usunąć — kontrola zgodności bywa wymagana; dowodem gotowości do eliminacji jest zaklasyfikowanie kroku jako czyste muda, nie tylko „wygląda na zbędny".',
        en: 'Not every non-value step can be removed — a compliance check may be mandatory; the evidence of eligibility for elimination is classifying the step as pure muda, not merely "looks redundant".',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile lead time i ilu FTE pochłaniają kroki czystego marnotrawstwa łącznie — i jaka część PCE poprawiłaby się po ich eliminacji?',
        en: 'How much lead time and how many FTE do the pure-waste steps consume in total — and how much would PCE improve after eliminating them?',
      },
      rationale: {
        pl: 'Lista muda ma wartość dopiero z liczbą przy niej — „N% kroków to czysty NVA do eliminacji" jest obronialną rekomendacją; „mamy trochę marnotrawstwa" nie jest.',
        en: 'A muda list only has value with a number attached — "N% of steps are pure NVA to eliminate" is a defensible recommendation; "we have some waste" is not.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Które kroki bez wartości są konieczne (regulacja, ryzyko, kontrakt) i muszą zostać — a wśród reszty, czy eliminacja jednego nie przeniesie marnotrawstwa gdzie indziej?',
        en: 'Which non-value steps are necessary (regulation, risk, contract) and must stay — and among the rest, will eliminating one merely relocate the waste elsewhere?',
      },
      rationale: {
        pl: 'Usunięcie kontroli jakości bez przeniesienia jej do źródła błędu tworzy przeróbki dalej w strumieniu — eliminacja muda wymaga zdolności do zabezpieczenia jakości, nie samego cięcia kroku.',
        en: 'Removing a quality check without moving it to the source of the error creates rework further downstream — eliminating muda requires the capability to safeguard quality, not just cutting the step.',
      },
    },
  ],
  rework: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które kroki przepuszczają dalej pracę wymagającą poprawek, uzupełnień lub wyjaśnień — gdzie jednostka „wraca" do poprzedniego kroku, zamiast płynąć naprzód?',
        en: 'Which steps pass on work that needs corrections, additions or clarifications — where does a unit "come back" to a prior step instead of flowing forward?',
      },
      rationale: {
        pl: 'Przeróbki to ukryta fabryka — praca krąży, ale standardowe raporty liczą tylko output na wyjściu, nie zawrócone jednostki; pierwszy krok to zobaczyć, gdzie praca zawraca.',
        en: 'Rework is the hidden factory — work circulates, but standard reports count only output at the exit, not returned units; the first step is to see where work loops back.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest %C&A (procent jednostek przechodzących do następnego kroku bez poprawek) w każdym kroku — i skąd ta liczba pochodzi, z pomiaru czy z założenia „u nas jest dobrze"?',
        en: 'What is the %C&A (share of units passing to the next step with no correction) at each step — and where does that number come from, measurement or an assumption that "we\'re fine"?',
      },
      rationale: {
        pl: '%C&A to najczęściej pomijana metryka VSM i najbardziej ujawniająca — dowodem ukrytej fabryki jest zmierzony odsetek zawrotów, nie przekonanie zespołu o własnej jakości.',
        en: '%C&A is the most often skipped VSM metric and the most revealing — the evidence of the hidden factory is the measured return rate, not the team\'s conviction about its own quality.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile realnie kosztuje ukryta fabryka — (1 − %C&A) × wolumen × czas pętli poprawki — w FTE-dniach lub lead-time-dniach na miesiąc?',
        en: 'What does the hidden factory truly cost — (1 − %C&A) × volume × rework-loop time — in FTE-days or lead-time-days per month?',
      },
      rationale: {
        pl: 'Ten iloczyn zwykle daje jeden z największych, najmniej widocznych insightów sesji — koszt niewidoczny w żadnym raporcie KPI, bo raporty liczą throughput, nie zawroty.',
        en: 'This product usually yields one of the largest, least visible insights of the session — a cost invisible in every KPI report, because reports count throughput, not returns.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy potraficie przenieść kontrolę do źródła błędu (walidacja przy wprowadzaniu danych, praca standaryzowana) — czy jedynie dołożycie kolejny krok kontroli na końcu?',
        en: 'Can you move the control to the source of the error (validation at data entry, standardized work) — or will you merely add another inspection step at the end?',
      },
      rationale: {
        pl: 'Dokładanie kontroli na końcu zwiększa lead time i nie usuwa przyczyny — trwałe domknięcie fabryki przeróbek wymaga zdolności do zabezpieczenia jakości u źródła, nie po fakcie.',
        en: 'Adding an inspection at the end increases lead time and does not remove the cause — durably closing the rework factory requires the capability to safeguard quality at the source, not after the fact.',
      },
    },
  ],
};

export interface LeverProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per lever. Consumed when AI (or the offline
 * fallback) proposes candidate kaizen moves. Mirrors Inventory's PROPOSAL_BANK.
 */
export const VSM_PROPOSAL_BANK: Record<VsmLeverId, LeverProposal[]> = {
  flow: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować current-state end-to-end z właścicielami kroków w pokoju',
        en: 'Map the current state end-to-end with step owners in the room',
      },
      explanation: {
        pl: 'Narysujcie proces od triggera klienta do dostarczenia wartości z rzeczywistymi wykonawcami (nie tylko kierownikami) — odręczna mapa wymusza dyskusję i ujawnia przekazania, których nie ma w żadnej procedurze.',
        en: 'Draw the process from customer trigger to value delivery with the real doers (not just managers) — a hand-drawn map forces discussion and surfaces handoffs no procedure records.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć czasy na gemba metodą follow-one-piece',
        en: 'Time the steps on gemba with follow-one-piece',
      },
      explanation: {
        pl: 'Prześledźcie los jednej realnej jednostki (zamówienia, wniosku, sprawy) przez cały strumień ze stoperem — zbierzcie C/T i L/T z rzeczywistości, nie średnie z pamięci ani statusy z systemu ticketowego.',
        en: 'Follow one real unit (order, request, case) through the whole stream with a stopwatch — capture C/T and L/T from reality, not averages from memory or statuses from a ticketing system.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć Process Cycle Efficiency całego strumienia',
        en: 'Compute the stream\'s Process Cycle Efficiency',
      },
      explanation: {
        pl: 'Podzielcie sumę czasu wartości dodanej przez całkowity lead time — PCE 3-8% (typowe dla procesów biurowych) to policzalny dowód, że proces głównie czeka, i najsilniejszy punkt otwarcia rozmowy z zarządem.',
        en: 'Divide total value-add time by total lead time — a PCE of 3-8% (typical for office processes) is quantified proof the process mostly waits, and the strongest opening for the board conversation.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustawić kadencję re-mapowania po każdym cyklu kaizen',
        en: 'Set a re-mapping cadence after each kaizen cycle',
      },
      explanation: {
        pl: 'Zaplanujcie przegląd (np. +90 dni) i re-mapowanie strumienia — bez tego future-state map staje się martwym dokumentem, a ograniczenie i tak przesuwa się w nowe miejsce.',
        en: 'Schedule a review (e.g. +90 days) and a re-mapping of the stream — without it the future-state map becomes a dead document, and the constraint moves to a new place regardless.',
      },
    },
  ],
  bottleneck: [
    {
      rung: 'surface',
      title: {
        pl: 'Nazwać domniemanego „winowajcę" i skonfrontować go z mapą',
        en: 'Name the presumed "culprit" and confront it with the map',
      },
      explanation: {
        pl: 'Zapiszcie, który krok organizacja obwinia o spowolnienie — potem sprawdźcie na mapie, gdzie realnie piętrzy się praca; rozbieżność między intuicją a kolejką jest sama w sobie insightem.',
        en: 'Write down which step the organization blames for the slowdown — then check on the map where work actually piles up; the gap between intuition and the queue is itself an insight.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zlokalizować constraint po kolejce/WIP, nie po najdłuższym C/T',
        en: 'Locate the constraint by queue/WIP, not by longest C/T',
      },
      explanation: {
        pl: 'Wskażcie krok z największym WIP przed wejściem i najniższym uptime — praca czeka na WEJŚCIE do ograniczenia, a kroki za nim głodują; to, nie długi czas pracy, wyznacza realny constraint.',
        en: 'Point to the step with the largest WIP at its entry and the lowest uptime — work waits to ENTER the constraint while downstream steps starve; that, not a long work time, marks the real constraint.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć udział constraintu w lead time całości',
        en: 'Quantify the constraint\'s share of total lead time',
      },
      explanation: {
        pl: 'Pokażcie, ile procent lead time strumienia siedzi w jednym-dwóch krokach — ta liczba kieruje budżet i uwagę zarządu w jedno miejsce zamiast rozpraszać program po całym procesie.',
        en: 'Show what percentage of stream lead time sits in one or two steps — this number focuses the budget and board attention on one place rather than scattering the program across the whole process.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zaplanować ponowną lokalizację ograniczenia po interwencji',
        en: 'Plan to re-locate the constraint after the intervention',
      },
      explanation: {
        pl: 'Umówcie re-mapowanie po udrożnieniu constraintu — ograniczenie przesunie się na kolejny krok; bez ponownego pomiaru zespół ogłosi sukces, a zysk pochłonie nowy, niezauważony bottleneck.',
        en: 'Agree to re-map after unblocking the constraint — it will move to the next step; without a re-measure the team declares success while a new, unnoticed bottleneck absorbs the gain.',
      },
    },
  ],
  waste: [
    {
      rung: 'surface',
      title: {
        pl: 'Oznaczyć każdy krok jako VA / konieczne NVA / czyste muda',
        en: 'Tag each step as VA / necessary NVA / pure muda',
      },
      explanation: {
        pl: 'Przejdźcie krok po kroku i sklasyfikujcie czas: wartość dodana (klient by zapłacił), NVA konieczne (regulacja/ryzyko), czyste marnotrawstwo do eliminacji — to rozdzielenie decyduje, gdzie w ogóle wolno ciąć.',
        en: 'Go step by step and classify the time: value-add (customer would pay), necessary NVA (regulation/risk), pure waste to eliminate — this split decides where cutting is even permitted.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Przypisać każde muda do jednej z 7 kategorii TPS',
        en: 'Attribute each waste to one of the 7 TPS categories',
      },
      explanation: {
        pl: 'Nazwijcie typ marnotrawstwa (nadprodukcja, oczekiwanie, transport, nadmierne przetwarzanie, zapas, ruch, wady) — nazwa kategorii podpowiada przeciwdziałanie i odróżnia usuwalne muda od koniecznej kontroli.',
        en: 'Name the waste type (overproduction, waiting, transport, over-processing, inventory, motion, defects) — the category name suggests the countermeasure and separates removable muda from a necessary control.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć lead time i FTE odzyskiwalne z eliminacji czystego NVA',
        en: 'Cost the lead time and FTE recoverable from eliminating pure NVA',
      },
      explanation: {
        pl: 'Zsumujcie czas i etaty pochłaniane przez kroki czystego marnotrawstwa oraz efekt ich usunięcia na PCE — „N% kroków to NVA do eliminacji, X dni lead time do odzyskania" jest obronialną listą kaizen.',
        en: 'Sum the time and headcount consumed by pure-waste steps and their removal\'s effect on PCE — "N% of steps are NVA to eliminate, X lead-time days to recover" is a defensible kaizen list.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przenieść konieczną kontrolę do źródła, nie usuwać jej ślepo',
        en: 'Move a necessary control to the source, do not blindly delete it',
      },
      explanation: {
        pl: 'Zanim usuniecie krok kontroli, sprawdźcie, czy nie jest wymagany (regulacja/ryzyko) i czy jego eliminacja nie tworzy przeróbek dalej — przenieście kontrolę do źródła błędu zamiast wycinać ją bez zabezpieczenia.',
        en: 'Before removing an inspection step, check it is not mandatory (regulation/risk) and that its removal does not create rework downstream — move the control to the source of the error rather than cutting it unguarded.',
      },
    },
  ],
  rework: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować pętle zawrotu — gdzie praca wraca do poprawki',
        en: 'Map the return loops — where work comes back for correction',
      },
      explanation: {
        pl: 'Zaznaczcie na mapie każde miejsce, gdzie jednostka wraca do poprzedniego kroku po brakujące dane lub poprawkę — te pętle to ukryta fabryka, niewidoczna w raportach liczących tylko output.',
        en: 'Mark on the map every place a unit returns to a prior step for missing data or a fix — these loops are the hidden factory, invisible in reports that count only output.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć %C&A w każdym kroku',
        en: 'Measure %C&A at each step',
      },
      explanation: {
        pl: 'Ustalcie realny odsetek jednostek przechodzących bez poprawek per krok — to najczęściej pomijana i najbardziej ujawniająca metryka; niski %C&A wskazuje krok generujący zawroty, których nie widać w KPI.',
        en: 'Establish the real share of units passing without correction per step — the most often skipped and most revealing metric; a low %C&A flags the step generating returns invisible in the KPIs.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wycenić ukrytą fabrykę: (1 − %C&A) × wolumen × czas pętli',
        en: 'Cost the hidden factory: (1 − %C&A) × volume × loop time',
      },
      explanation: {
        pl: 'Pomnóżcie odsetek zawrotów przez roczny wolumen i czas pętli poprawki — wynik w FTE-dniach/miesiąc to zwykle jeden z największych, niewidocznych w raportach kosztów całej sesji.',
        en: 'Multiply the return rate by annual volume and the rework-loop time — the result in FTE-days/month is usually one of the session\'s largest costs, invisible in the reports.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przesunąć kontrolę jakości do źródła błędu',
        en: 'Shift quality control to the source of the error',
      },
      explanation: {
        pl: 'Wprowadźcie walidację danych w kroku, w którym błąd powstaje (np. przy wprowadzaniu zamówienia) zamiast wyłapywać go później — to eliminuje pętlę zwrotną zamiast dokładać kolejny krok kontroli na końcu.',
        en: 'Introduce data validation at the step where the error originates (e.g. at order entry) instead of catching it later — this eliminates the return loop rather than adding another inspection step at the end.',
      },
    },
  ],
};
