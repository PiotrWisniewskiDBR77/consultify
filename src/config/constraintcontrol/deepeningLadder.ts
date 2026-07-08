/**
 * Constraint Control — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Inventory Autopilot `deepeningLadder` + `PROPOSAL_BANK` pattern
 * (see src/config/inventoryautopilot/deepeningLadder.ts). Encodes the
 * Theory-of-Constraints "depth staircase" per focusing lever:
 *
 *   1. surface          — what is the current behaviour of this step / policy?
 *   2. evidence         — is the constraint located by QUEUE evidence, or by "who looks busy"?
 *   3. quantification    — how much throughput (T) does it cost, at what capacity vs demand?
 *   4. risk-capability  — what must exist to act without shifting the bottleneck or breaking service?
 *
 * The five canonical levers mirror TOC's Five Focusing Steps (POOGI):
 *   - identify     : locate the real constraint (longest & growing queue vs demand), not the busy resource
 *   - exploit      : squeeze maximum throughput from the constraint WITHOUT capital spend
 *   - subordinate  : slow everything else to the constraint's drum (Drum-Buffer-Rope)
 *   - elevate      : only after 1-3 are exhausted, invest to lift the constraint's capacity
 *   - policy       : find the rule/schedule/incentive that is the real (hidden) constraint
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (constraintEngine.ts).
 */

export type FocusStepId = 'identify' | 'exploit' | 'subordinate' | 'elevate' | 'policy';

export const FOCUS_STEPS: FocusStepId[] = [
  'identify',
  'exploit',
  'subordinate',
  'elevate',
  'policy',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and step-agnostic. */
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

export const CONSTRAINT_LADDER_RUNG_ORDER = RUNG_ORDER;

const FOCUS_STEP_LABEL: Record<FocusStepId, Bilingual> = {
  identify: { pl: 'Zidentyfikuj', en: 'Identify' },
  exploit: { pl: 'Wykorzystaj', en: 'Exploit' },
  subordinate: { pl: 'Podporządkuj', en: 'Subordinate' },
  elevate: { pl: 'Podnieś', en: 'Elevate' },
  policy: { pl: 'Ograniczenie polityki', en: 'Policy constraint' },
};

export const focusStepLabel = (step: FocusStepId): Bilingual => FOCUS_STEP_LABEL[step];

/**
 * Per-step deepening ladder. Each step has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const CONSTRAINT_DEEPENING_LADDER: Record<FocusStepId, LadderRung[]> = {
  identify: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Który krok procesu — od briefu klienta do dostawy — wygląda na wąskie gardło i skąd to przekonanie: z kolejki przed nim, czy z tego, że ktoś „jest zawalony"?',
        en: 'Which process step — from client brief to delivery — looks like the bottleneck, and on what basis: the queue in front of it, or the fact that someone "is swamped"?',
      },
      rationale: {
        pl: 'Zasób „100% zajęty" bywa fałszywym constraintem — może pracować nad rzeczami bez znaczenia dla przepustowości. Prawdziwe ograniczenie poznaje się po kolejce PRZED nim, nie po zajętości.',
        en: 'A "100% busy" resource is often a false constraint — it may be working on things irrelevant to throughput. The real constraint is known by the QUEUE in front of it, not by busyness.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy kolejka przed tym krokiem systematycznie rośnie miesiąc do miesiąca, czy reszta systemu czeka NA NIEGO — a nie odwrotnie?',
        en: 'Does the queue in front of this step grow month over month, and does the rest of the system wait ON IT — rather than the other way around?',
      },
      rationale: {
        pl: 'Sygnał constraintu to rosnąca lub nieznikająca kolejka i reszta systemu czekająca na ten jeden zasób. Dowodem jest penetracja bufora i % „na czas do constraintu", nie odczucie kierownika.',
        en: 'The constraint signal is a growing or persistent queue with the rest of the system waiting on that one resource. The evidence is buffer penetration and % "on time to the constraint", not a manager\'s gut feel.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile jednostek pracy ten krok potrafi przetworzyć w jednostce czasu (capacity), a ile system musi (demand) — gdzie capacity jest najbliżej lub poniżej demand?',
        en: 'How many work units can this step process per unit of time (capacity) versus how many the system must (demand) — where is capacity closest to or below demand?',
      },
      rationale: {
        pl: 'Constraint = krok, gdzie capacity < demand (lub najbliżej tej granicy). Dopóki nie zestawicie przepustowości z popytem per krok, lokalizacja jest zgadywaniem, nie diagnozą.',
        en: 'The constraint = the step where capacity < demand (or closest to that line). Until you set capacity against demand per step, the location is a guess, not a diagnosis.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy macie dane, by mierzyć kolejki i przepustowość na bieżąco — czy diagnoza constraintu to jednorazowy audyt, który zestarzeje się przy pierwszej zmianie popytu?',
        en: 'Do you have the data to measure queues and throughput continuously — or is the constraint diagnosis a one-off audit that ages the moment demand shifts?',
      },
      rationale: {
        pl: 'TOC to proces ciągły (POOGI), nie audyt. Bez zdolności do ciągłego czytania kolejek constraint przesunie się niezauważony, a organizacja zostanie z nieaktualną mapą.',
        en: 'TOC is an ongoing process (POOGI), not an audit. Without the capability to continuously read queues, the constraint moves unnoticed and the organization is left with a stale map.',
      },
    },
  ],
  exploit: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Na co realnie idzie czas constraintu — ile z niego to praca dodająca przepustowość, a ile to przestoje, przezbrojenia, poprawki i spotkania bez znaczenia?',
        en: 'Where does the constraint\'s time really go — how much adds throughput versus downtime, changeovers, rework and meaningless meetings?',
      },
      rationale: {
        pl: 'Większość ograniczeń jest wykorzystywana poniżej 50% realnego potencjału, zanim ktokolwiek zajmie się Exploit. Godzina odzyskana na constraincie to godzina przepustowości całego systemu — za darmo.',
        en: 'Most constraints run below 50% of their real potential before anyone does Exploit. An hour recovered on the constraint is an hour of whole-system throughput — for free.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Ile czasu constraintu ginie na wadliwy lub niekompletny input z wcześniejszych kroków, który powinien być złapany PRZED nim?',
        en: 'How much of the constraint\'s time is lost to faulty or incomplete input from upstream steps that should have been caught BEFORE it?',
      },
      rationale: {
        pl: 'Kontrola jakości TUŻ PRZED constraintem to klasyczna dźwignia Exploit — constraint nie może marnować minuty na wadliwy input, bo tej minuty nie odzyska cały system.',
        en: 'A quality gate JUST BEFORE the constraint is the classic Exploit lever — the constraint must not waste a minute on faulty input, because the whole system never recovers that minute.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'O ile wzrośnie przepustowość, jeśli usuniecie przestoje i poprawki na constraincie — ile jednostek/tydzień odzyskujecie bez ani złotówki CAPEX?',
        en: 'How much does throughput rise if you remove downtime and rework on the constraint — how many units/week do you recover with zero CAPEX?',
      },
      rationale: {
        pl: 'Analizy pokazują 20-30% ukrytej wydajności możliwej do odzyskania bez wydawania złotówki — trzeba tę liczbę wydobyć, bo to ona uzasadnia odłożenie kosztownego Elevate.',
        en: 'Analyses show 20-30% of hidden capacity recoverable without spending a cent — surface that number, because it is what justifies deferring costly Elevate.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy da się zablokować bloki czasu wyłącznie na pracę constraintu i ustawić kolejność zadań (najbliższy deadline / najbardziej krytyczny) bez zrywania innych zobowiązań?',
        en: 'Can you block time exclusively for constraint work and sequence its tasks (nearest deadline / most critical first) without breaking other commitments?',
      },
      rationale: {
        pl: 'Exploit wymaga dyscypliny organizacyjnej — chronienia constraintu przed przerwaniami. Bez zdolności do egzekwowania bloków i reguł kolejności dźwignia pozostaje na papierze.',
        en: 'Exploit demands organizational discipline — protecting the constraint from interruptions. Without the capability to enforce time blocks and sequencing rules, the lever stays on paper.',
      },
    },
  ],
  subordinate: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy tempo pracy wchodzącej do systemu wyznacza constraint (drum), czy zespoły niebędące ograniczeniem produkują tyle, ile potrafią — niezależnie od tego, ile constraint wchłonie?',
        en: 'Does the constraint set the pace of work entering the system (the drum), or do non-constraint teams produce all they can — regardless of how much the constraint can absorb?',
      },
      rationale: {
        pl: 'Zespół pracujący szybciej niż constraint potrafi wchłonąć nie pomaga — tworzy WIP i chaos priorytetów. Subordinate to najtrudniejszy politycznie krok: „wydajne" zespoły muszą zwolnić.',
        en: 'A team working faster than the constraint can absorb does not help — it creates WIP and priority chaos. Subordinate is the hardest step politically: "efficient" teams must slow down.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy istnieje bufor (czasu/informacji) chroniący constraint przed przestojem z powodu zmienności wcześniejszych kroków — i czy jego penetracja jest monitorowana (zielona/żółta/czerwona)?',
        en: 'Is there a buffer (time/information) protecting the constraint from downtime due to upstream variability — and is its penetration monitored (green/yellow/red)?',
      },
      rationale: {
        pl: 'Bufor to ubezpieczenie, nie marnotrawstwo. Penetracja bufora zastępuje klasyczny „procent ukończenia" jako główny wskaźnik sterowania — bez niej Subordinate jest ślepy.',
        en: 'The buffer is insurance, not waste. Buffer penetration replaces the classic "percent complete" as the main control signal — without it, Subordinate is blind.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'O ile puchnie WIP i wydłuża się lead time, gdy zespoły przed constraintem pracują pełną mocą — ile z tego WIP to koszt bez wpływu na przepustowość?',
        en: 'How much does WIP swell and lead time lengthen when pre-constraint teams run full-out — how much of that WIP is cost with no effect on throughput?',
      },
      rationale: {
        pl: 'Nadprodukcja przed constraintem to koszt bez zwrotu — trzeba pokazać liczbą, że lokalna „efektywność" tych zespołów nie przekłada się na T systemu, tylko na WIP i lead time.',
        en: 'Overproduction before the constraint is cost with no return — show by number that these teams\' local "efficiency" does not translate to system T, only to WIP and lead time.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy macie mechanizm uwalniania pracy zsynchronizowany z tempem constraintu (rope) — i czy zarząd zaakceptuje, że zespoły niebędące ograniczeniem będą czasem czekać?',
        en: 'Do you have a work-release mechanism synchronized to the constraint\'s pace (the rope) — and will leadership accept that non-constraint teams will sometimes wait?',
      },
      rationale: {
        pl: 'Rope zapobiega narastaniu WIP: nic nie wchodzi szybciej, niż constraint wchłonie. Bez zgody zarządu na „marnowanie potencjału" zespołów niebędących ograniczeniem Subordinate pada politycznie.',
        en: 'The rope prevents WIP build-up: nothing enters faster than the constraint absorbs. Without leadership buy-in to "waste" non-constraint capacity, Subordinate fails politically.',
      },
    },
  ],
  elevate: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy kroki Exploit i Subordinate są już wyczerpane — czy proponujecie inwestycję (etat, maszyna, outsourcing) zanim odzyskaliście darmową wydajność?',
        en: 'Are Exploit and Subordinate already exhausted — or are you proposing investment (headcount, machine, outsourcing) before recovering the free capacity?',
      },
      rationale: {
        pl: 'Elevate jest uzasadniony DOPIERO, gdy 1-3 wyczerpane. Przeskok od razu do Elevate to najdroższy sposób na kupienie wyniku, który można było dostać za darmo w Exploit.',
        en: 'Elevate is justified ONLY after 1-3 are exhausted. Jumping straight to Elevate is the most expensive way to buy a result you could have gotten for free in Exploit.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy różnica capacity–demand na constraincie jest realna i utrzymuje się po Exploit/Subordinate — czy to był efekt złej sekwencji lub priorytetyzacji, który już zniknął?',
        en: 'Is the capacity–demand gap on the constraint real and persistent after Exploit/Subordinate — or was it an effect of bad sequencing/prioritization that has already vanished?',
      },
      rationale: {
        pl: 'Elevate ma sens tylko przy realnej, utrzymującej się luce capacity–demand — nie przy efekcie złej sekwencji. Inaczej kupujecie moc, która nie była potrzebna.',
        en: 'Elevate makes sense only with a real, persistent capacity–demand gap — not with a bad-sequencing artifact. Otherwise you buy capacity that was never needed.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak inwestycja zmienia T, I i OE CAŁEGO systemu — czy dodatkowa moc na constraincie zwiększa Throughput bardziej, niż podnosi koszty operacyjne i związany kapitał?',
        en: 'How does the investment change T, I and OE of the WHOLE system — does added constraint capacity raise Throughput more than it raises operating expense and tied-up capital?',
      },
      rationale: {
        pl: 'Każda decyzja o Elevate oceniana jest przez pytanie, jak zmienia T/I/OE całości — nie przez „czy ten dział jest tani/drogi". Elevate poza constraintem zwiększa OE i I bez zmiany T.',
        en: 'Every Elevate decision is judged by how it changes system T/I/OE — not by "is this department cheap/expensive". Elevate off the constraint raises OE and I without changing T.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Gdzie przesunie się constraint po Elevate — na inny krok, czy z powrotem na rynek — i czy jesteście gotowi wrócić do kroku Identify, zamiast utrwalać starą politykę priorytetów?',
        en: 'Where will the constraint move after Elevate — to another step, or back to the market — and are you ready to return to Identify rather than cement the old priority policy?',
      },
      rationale: {
        pl: 'Po Elevate constraint zawsze się przesuwa. Ryzyko: polityki zbudowane wokół starego constraintu zostają z bezwładności i same stają się nowym, ukrytym ograniczeniem (inercja).',
        en: 'After Elevate the constraint always moves. The risk: policies built around the old constraint linger from inertia and become the new hidden constraint themselves.',
      },
    },
  ],
  policy: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaka reguła, harmonogram, SLA lub system premiowy zmusza system do zachowania, które tworzy kolejkę — zanim uznacie ograniczenie za fizyczne (brak ludzi/maszyn)?',
        en: 'What rule, schedule, SLA or incentive forces the system into behaviour that creates the queue — before you conclude the constraint is physical (missing people/machines)?',
      },
      rationale: {
        pl: 'Polityka jest NAJCZĘSTSZYM ukrytym ograniczeniem — częściej niż brak maszyny czy osoby. Policy constraint powinien być domyślną hipotezą pierwszą, nie ostatnią.',
        en: 'Policy is the MOST COMMON hidden constraint — more often than a missing machine or person. A policy constraint should be the default first hypothesis, not the last.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy kolejka wynika z fizycznego braku mocy, czy z kolejności zatwierdzeń, reguły zakupowej albo sztywnego harmonogramu — jakie ukryte założenie leży pod pozornym konfliktem „musimy X, ale też Y"?',
        en: 'Does the queue come from a physical lack of capacity, or from an approval order, a purchasing rule, a rigid schedule — what hidden assumption sits under the apparent "we must X but also Y" conflict?',
      },
      rationale: {
        pl: 'Technika Evaporating Cloud wydobywa ukryte, błędne założenie pod pozornym konfliktem — usunięcie tego jednego założenia często rozwiązuje konflikt bez kompromisu.',
        en: 'The Evaporating Cloud technique surfaces the hidden faulty assumption under an apparent conflict — removing that one assumption often resolves it without compromise.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'O ile spadłaby kolejka przed constraintem, gdyby zmienić tę politykę — i o ile taniej/szybciej jest to niż Elevate (zatrudnienie/CAPEX)?',
        en: 'How much would the pre-constraint queue drop if you changed this policy — and how much cheaper/faster is that than Elevate (hiring/CAPEX)?',
      },
      rationale: {
        pl: 'Zmiana polityki jest tańsza i szybsza niż Elevate, a często daje większy efekt na przepustowość. Ta liczba przechodzi wprost do rejestru inicjatyw jako dźwignia wysokiej wartości.',
        en: 'A policy change is cheaper and faster than Elevate, and often yields a larger throughput effect. This number goes straight to the initiative register as a high-value lever.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy jakaś polityka trwa z przyzwyczajenia, choć constraint, wokół którego powstała, już się przesunął — jaka reguła zmusza system do zachowania, które nie ma już uzasadnienia?',
        en: 'Does a policy persist from habit though the constraint it was built around has already moved — what rule forces behaviour that no longer has a justification?',
      },
      rationale: {
        pl: 'Inercja to najdroższy do zdiagnozowania constraint, bo nie boli namacalnie. Uzasadnia CYKLICZNY przegląd, nie jednorazowy audyt — koszt widać tylko w rozjeździe „co się mierzy" vs „co ogranicza wynik".',
        en: 'Inertia is the most expensive constraint to diagnose because it does not hurt tangibly. It justifies a RECURRING review, not a one-off audit — the cost shows only in the drift between "what is measured" and "what limits the result".',
      },
    },
  ],
};

export interface FocusProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per focusing step. Consumed when AI (or the
 * offline fallback) proposes candidate TOC moves. Mirrors Inventory's
 * INVENTORY_PROPOSAL_BANK.
 */
export const CONSTRAINT_PROPOSAL_BANK: Record<FocusStepId, FocusProposal[]> = {
  identify: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować sekwencję kroków procesu od popytu do dostawy',
        en: 'Map the process step sequence from demand to delivery',
      },
      explanation: {
        pl: 'Narysujcie proces jako sekwencję zależnych kroków (nie organigram), od briefu klienta do rezultatu — to na tej mapie widać, gdzie praca czeka, a gdzie płynie.',
        en: 'Draw the process as a sequence of dependent steps (not an org chart), from client brief to result — this is the map on which you see where work waits versus flows.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć kolejki przed każdym krokiem i ich trend',
        en: 'Measure the queue before each step and its trend',
      },
      explanation: {
        pl: 'Zestawcie długość kolejki przed każdym krokiem i jej zmianę w czasie — constraint to ten krok, przed którym kolejka rośnie lub nie znika, a nie ten, który „wygląda na zajęty".',
        en: 'Track the queue length before each step and its change over time — the constraint is the step whose queue grows or persists, not the one that "looks busy".',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zestawić przepustowość (capacity) z popytem (demand) per krok',
        en: 'Set capacity against demand per step',
      },
      explanation: {
        pl: 'Policzcie, ile jednostek pracy każdy krok przetwarza vs ile system musi — constraint to krok, gdzie capacity < demand lub jest najbliżej tej granicy.',
        en: 'Compute how many units each step processes versus what the system must — the constraint is the step where capacity < demand or closest to that line.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uruchomić ciągły pomiar kolejek (POOGI), nie jednorazowy audyt',
        en: 'Stand up continuous queue measurement (POOGI), not a one-off audit',
      },
      explanation: {
        pl: 'Wpięcie pomiaru penetracji bufora i % „na czas do constraintu" w cykliczny przegląd utrzymuje mapę żywą — bez tego constraint przesunie się niezauważony.',
        en: 'Wiring buffer penetration and % "on time to the constraint" into a recurring review keeps the map live — without it the constraint moves unnoticed.',
      },
    },
  ],
  exploit: [
    {
      rung: 'surface',
      title: {
        pl: 'Zablokować chronione bloki czasu wyłącznie na pracę constraintu',
        en: 'Block protected time exclusively for constraint work',
      },
      explanation: {
        pl: 'Wydzielcie stałe bloki, w których constraint nie jest przerywany spotkaniami ani zadaniami niskiej wartości — każda odzyskana godzina to godzina przepustowości całego systemu.',
        en: 'Carve out fixed blocks where the constraint is not interrupted by meetings or low-value tasks — every hour recovered is an hour of whole-system throughput.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Postawić kontrolę jakości TUŻ PRZED constraintem',
        en: 'Put a quality gate JUST BEFORE the constraint',
      },
      explanation: {
        pl: 'Wprowadźcie checklistę/bramę jakości przed krokiem-constraintem, żeby nie marnował czasu na wadliwy lub niekompletny input z wcześniejszych etapów.',
        en: 'Add a checklist/quality gate before the constraint step so it does not waste time on faulty or incomplete input from upstream.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć ukrytą wydajność odzyskiwaną bez CAPEX',
        en: 'Cost the hidden capacity recoverable without CAPEX',
      },
      explanation: {
        pl: 'Zsumujcie czas constraintu tracony na przestoje, przezbrojenia i poprawki — 20-30% ukrytej wydajności odzyskanej za darmo zwykle wystarcza, by odłożyć kosztowny Elevate.',
        en: 'Sum the constraint time lost to downtime, changeovers and rework — the 20-30% of hidden capacity recovered for free is usually enough to defer a costly Elevate.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustawić kolejność zadań na constraincie wg krytyczności',
        en: 'Sequence constraint tasks by criticality',
      },
      explanation: {
        pl: 'Zamieńcie „kto pierwszy przyszedł" na regułę „najbliższy deadline / najbardziej krytyczny pierwszy" — sama sekwencja podnosi wartość przepuszczaną przez constraint bez dodatkowej mocy.',
        en: 'Replace "first-come" with "nearest deadline / most critical first" — sequencing alone raises the value pushed through the constraint with no added capacity.',
      },
    },
  ],
  subordinate: [
    {
      rung: 'surface',
      title: {
        pl: 'Ustawić harmonogram constraintu jako bęben (drum) całego systemu',
        en: 'Set the constraint schedule as the drum for the whole system',
      },
      explanation: {
        pl: 'Niech to constraint wyznacza, ile pracy i w jakim tempie wchodzi do procesu — reszta zespołów pracuje do jego rytmu, nie do własnej maksymalnej mocy.',
        en: 'Let the constraint dictate how much work and at what pace enters the process — the rest of the teams work to its rhythm, not to their own maximum capacity.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Ustawić bufor przed constraintem i monitorować jego penetrację',
        en: 'Set a buffer before the constraint and monitor its penetration',
      },
      explanation: {
        pl: 'Zbudujcie zapas czasu/informacji chroniący constraint przed przestojem i sterujcie przez strefy zielona/żółta/czerwona — to zastępuje „procent ukończenia" jako sygnał sterowania.',
        en: 'Build a time/information buffer protecting the constraint from starvation and steer by green/yellow/red zones — this replaces "percent complete" as the control signal.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Pokazać liczbą, że nadprodukcja przed constraintem to tylko WIP',
        en: 'Show by number that pre-constraint overproduction is only WIP',
      },
      explanation: {
        pl: 'Zestawcie WIP i lead time przy pełnej mocy zespołów przed constraintem — dowiedźcie, że ich lokalna „efektywność" nie zmienia T systemu, tylko puchnie zapas i wydłuża realizację.',
        en: 'Track WIP and lead time when pre-constraint teams run full-out — prove their local "efficiency" does not change system T, only swells inventory and lengthens lead time.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wdrożyć linę (rope) uwalniającą pracę w tempie constraintu',
        en: 'Deploy the rope releasing work at the constraint\'s pace',
      },
      explanation: {
        pl: 'Zsynchronizujcie wejście nowej pracy z realną przepustowością constraintu — nic nie wchodzi szybciej, niż potrafi on wchłonąć, co zatrzymuje narastanie WIP i chaos priorytetów.',
        en: 'Synchronize the release of new work to the constraint\'s real throughput — nothing enters faster than it can absorb, which halts WIP build-up and priority chaos.',
      },
    },
  ],
  elevate: [
    {
      rung: 'surface',
      title: {
        pl: 'Potwierdzić, że Exploit i Subordinate są wyczerpane, zanim inwestujecie',
        en: 'Confirm Exploit and Subordinate are exhausted before you invest',
      },
      explanation: {
        pl: 'Zanim dołożycie etat, maszynę czy outsourcing, udokumentujcie, że darmowa wydajność z kroków 1-3 została odebrana — inaczej płacicie za wynik dostępny za darmo.',
        en: 'Before adding headcount, a machine or outsourcing, document that the free capacity from steps 1-3 has been captured — otherwise you pay for a result available for free.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zweryfikować, że luka capacity–demand jest realna i trwała',
        en: 'Verify the capacity–demand gap is real and persistent',
      },
      explanation: {
        pl: 'Sprawdźcie, czy różnica przepustowości i popytu utrzymuje się po Exploit/Subordinate — jeśli zniknęła po poprawie sekwencji, Elevate jest zbędny.',
        en: 'Check whether the capacity–demand gap persists after Exploit/Subordinate — if it vanished once sequencing improved, Elevate is unnecessary.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Ocenić inwestycję przez zmianę T, I i OE całego systemu',
        en: 'Judge the investment by system-wide change in T, I and OE',
      },
      explanation: {
        pl: 'Policzcie, czy dodatkowa moc na constraincie podnosi Throughput bardziej niż koszty operacyjne i związany kapitał — Elevate poza constraintem zwiększa OE/I bez zmiany T.',
        en: 'Compute whether added constraint capacity lifts Throughput more than operating expense and tied-up capital — Elevate off the constraint raises OE/I without changing T.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zaplanować przegląd Repeat po przesunięciu constraintu',
        en: 'Plan a Repeat review after the constraint moves',
      },
      explanation: {
        pl: 'Po Elevate constraint się przesunie — zaplanujcie powrót do kroku Identify i świadomą weryfikację starych polityk priorytetów, żeby inercja nie stała się nowym ograniczeniem.',
        en: 'After Elevate the constraint moves — schedule a return to Identify and a deliberate review of old priority policies, so inertia does not become the new constraint.',
      },
    },
  ],
  policy: [
    {
      rung: 'surface',
      title: {
        pl: 'Wypisać reguły, harmonogramy i systemy premiowe wokół constraintu',
        en: 'List the rules, schedules and incentives around the constraint',
      },
      explanation: {
        pl: 'Zanim uznacie ograniczenie za fizyczne, wylistujcie polityki kształtujące kolejność, priorytety i tempo — polityka jest najczęstszym ukrytym constraintem.',
        en: 'Before declaring the constraint physical, list the policies shaping order, priorities and pace — policy is the most common hidden constraint.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Rozbroić pozorny konflikt techniką Evaporating Cloud',
        en: 'Disarm the apparent conflict with the Evaporating Cloud',
      },
      explanation: {
        pl: 'Dla konfliktu „musimy X, ale też Y" wydobądźcie ukryte założenie, które go trzyma — usunięcie tego jednego błędnego założenia często rozwiązuje sprawę bez kompromisu.',
        en: 'For a "we must X but also Y" conflict, surface the hidden assumption holding it — removing that one faulty assumption often resolves it without compromise.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć spadek kolejki po zmianie polityki vs koszt Elevate',
        en: 'Cost the queue drop from a policy change vs the cost of Elevate',
      },
      explanation: {
        pl: 'Zestawcie, o ile skróci się kolejka po zmianie reguły, z ceną i czasem alternatywnego Elevate — zmiana polityki zwykle wygrywa na dźwigni przepustowości.',
        en: 'Compare how much the queue shrinks from a rule change against the price and time of an Elevate alternative — the policy change usually wins on throughput leverage.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wprowadzić cykliczny audyt polityk przeciw inercji',
        en: 'Introduce a recurring policy audit against inertia',
      },
      explanation: {
        pl: 'Reguła „przy każdym przesunięciu constraintu weryfikujemy stare polityki priorytetów" zatrzymuje inercję — bez niej reguła sprzed lat po cichu ogranicza wynik.',
        en: 'A rule of "at every constraint shift we re-verify old priority policies" halts inertia — without it a years-old rule quietly limits the result.',
      },
    },
  ],
};
