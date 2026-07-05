/**
 * Process Automation — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the SMED / Ansoff `deepeningLadder` + `PROPOSAL_BANK` pattern
 * (see src/config/smedplanner/deepeningLadder.ts). Encodes the automation-
 * specific "depth staircase" per redesign phase:
 *
 *   1. surface          — what does the process do today in this phase?
 *   2. evidence         — is the claim measured / observed, or assumed?
 *   3. quantification   — how much time, volume, or error does it carry?
 *   4. risk-capability  — what must you be able to do to automate it safely?
 *
 * The four canonical automation phases mirror the "do not automate a broken
 * process" doctrine:
 *   - map          : capture the real process, steps, handoffs and exceptions
 *   - standardize  : remove variation and rework BEFORE automating
 *   - automate     : select automation candidates and the right mechanism
 *   - sustain      : govern, monitor and keep the automated flow honest
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the Process
 * Automation redesign phases and by the synthesis engine (automationEngine.ts).
 */

export type AutomationPhaseId = 'map' | 'standardize' | 'automate' | 'sustain';

export const AUTOMATION_PHASES: AutomationPhaseId[] = [
  'map',
  'standardize',
  'automate',
  'sustain',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and phase-agnostic. */
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

/** The four canonical rungs shared by every phase, with phase-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const AUTOMATION_LADDER_RUNG_ORDER = RUNG_ORDER;

const AUTOMATION_PHASE_LABEL: Record<AutomationPhaseId, Bilingual> = {
  map: { pl: 'Zmapuj', en: 'Map' },
  standardize: { pl: 'Ustandaryzuj', en: 'Standardize' },
  automate: { pl: 'Zautomatyzuj', en: 'Automate' },
  sustain: { pl: 'Utrzymaj', en: 'Sustain' },
};

export const automationPhaseLabel = (phase: AutomationPhaseId): Bilingual =>
  AUTOMATION_PHASE_LABEL[phase];

/**
 * Per-phase deepening ladder. Each phase has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const AUTOMATION_DEEPENING_LADDER: Record<AutomationPhaseId, LadderRung[]> = {
  map: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak realnie przebiega ten proces dziś — kto co robi, w jakiej kolejności i gdzie następują przekazania (handoffy)?',
        en: 'How does this process actually run today — who does what, in what order, and where are the handoffs?',
      },
      rationale: {
        pl: 'Automatyzacja mapy w głowie kierownika utrwala fikcję. Najpierw uczciwa mapa realnego, a nie idealnego, przebiegu.',
        en: 'Automating the map in a manager’s head cements a fiction. First an honest map of the real, not the ideal, flow.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że tak wygląda przebieg — z obserwacji i logów systemowych, czy z opisu „jak powinno być”?',
        en: 'How do you know the flow looks like this — from observation and system logs, or from a "how it should be" description?',
      },
      rationale: {
        pl: 'Rozjazd między procesem opisanym a wykonywanym to dokładnie te miejsca, w których automatyzacja się wywraca.',
        en: 'The gap between the documented and the executed process is exactly where automation later breaks.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile razy tygodniowo uruchamiacie ten proces i ile minut zajmuje jeden cykl — jaki to wolumen w skali roku?',
        en: 'How many times a week do you run this process and how many minutes per cycle — what volume is that across a year?',
      },
      rationale: {
        pl: 'Wolumen × czas cyklu zamienia „to męczące” w policzoną pulę godzin, o którą warto (lub nie) walczyć.',
        en: 'Volume × cycle time turns "this is tedious" into a counted pool of hours worth fighting for (or not).',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Które kroki mają wyjątki i decyzje wymagające osądu, a które są w pełni deterministyczne i regułowe?',
        en: 'Which steps carry exceptions and judgement calls, and which are fully deterministic and rule-based?',
      },
      rationale: {
        pl: 'Automatyzuje się kroki regułowe. Kroki z osądem albo się upraszcza, albo zostawia człowiekowi z podpowiedzią.',
        en: 'Rule-based steps automate. Judgement steps are either simplified or left to a human with assistance.',
      },
    },
  ],
  standardize: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Ile różnych wariantów tego procesu naprawdę istnieje — jeden standard, czy „każdy robi po swojemu”?',
        en: 'How many real variants of this process exist — one standard, or "everyone does it their own way"?',
      },
      rationale: {
        pl: 'Nie automatyzuje się rozjechanego procesu. Wariancja to koszt, który automatyzacja tylko zabetonuje.',
        en: 'You do not automate a scattered process. Variation is a cost automation would only set in concrete.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Które kroki to praca dodająca wartość, a które to poprawki, oczekiwanie i przepisywanie danych między systemami?',
        en: 'Which steps add value, and which are rework, waiting, and re-keying data between systems?',
      },
      rationale: {
        pl: 'Zautomatyzowany marnotraw to szybszy marnotraw. Najpierw usuń krok, którego nie powinno być.',
        en: 'Automated waste is faster waste. First remove the step that should not exist at all.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest dziś poziom błędów i poprawek w tym procesie i ile czasu pochłania sama korekta?',
        en: 'What is today’s error and rework rate in this process, and how much time does correction alone consume?',
      },
      rationale: {
        pl: 'Poziom błędu bazowego to punkt odniesienia dla obietnicy automatyzacji — bez niego zysk jest deklaracją.',
        en: 'The baseline error rate is the reference for the automation promise — without it the gain is a claim.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy da się uzgodnić jeden standard przebiegu, zanim ruszy automatyzacja — kto jest jego właścicielem?',
        en: 'Can you agree one standard flow before automation starts — and who owns it?',
      },
      rationale: {
        pl: 'Standard bez właściciela rozjeżdża się w tygodnie. Zdolność zarządcza, nie techniczna, decyduje o trwałości.',
        en: 'A standard without an owner drifts within weeks. A managerial, not technical, capability decides durability.',
      },
    },
  ],
  automate: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które konkretne kroki są kandydatami do automatyzacji i jakim mechanizmem (RPA, integracja API, reguły, AI)?',
        en: 'Which specific steps are automation candidates, and by what mechanism (RPA, API integration, rules, AI)?',
      },
      rationale: {
        pl: 'Kandydat automatyzacji to konkretny krok z mechanizmem, nie „zautomatyzujmy proces”. Ogólnik nie da się wycenić.',
        en: 'An automation candidate is a specific step with a mechanism, not "let’s automate the process". A vague wish cannot be costed.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy istnieje stabilne, ustrukturyzowane wejście dla tej automatyzacji, czy dane trzeba najpierw uporządkować?',
        en: 'Is there a stable, structured input for this automation, or must the data be cleaned up first?',
      },
      rationale: {
        pl: 'Automatyzacja na niestabilnym wejściu generuje ciche błędy — droższe niż praca ręczna, którą miała zastąpić.',
        en: 'Automation on an unstable input produces silent errors — costlier than the manual work it replaced.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile minut na cykl i ile błędów zdejmie ta automatyzacja i jaki jest koszt jej budowy oraz utrzymania?',
        en: 'How many minutes per cycle and how many errors will this automation remove, and what is its build and run cost?',
      },
      rationale: {
        pl: 'Oszczędność minus koszt utrzymania decyduje o payback. Automatyzacja bez tej różnicy to hobby, nie inwestycja.',
        en: 'Savings minus run cost decide the payback. Automation without that difference is a hobby, not an investment.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Co się dzieje, gdy automatyzacja się wywali w środku nocy — kto to zauważy i jak wygląda ścieżka awaryjna?',
        en: 'What happens when the automation fails at 3am — who notices, and what is the fallback path?',
      },
      rationale: {
        pl: 'Automatyzacja bez planu awaryjnego przenosi ryzyko na klienta. Najpierw nazwij, kto łapie wyjątek.',
        en: 'Automation without a fallback plan shifts risk to the customer. First name who catches the exception.',
      },
    },
  ],
  sustain: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak zauważycie, że zautomatyzowany proces przestał działać poprawnie — jaki sygnał to pokaże?',
        en: 'How will you notice the automated process has stopped working correctly — what signal shows it?',
      },
      rationale: {
        pl: 'Automatyzacja bez monitoringu psuje się cicho. Zysk znika, a nikt nie wie kiedy ani dlaczego.',
        en: 'Automation without monitoring rots silently. The gain disappears and no one knows when or why.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy mierzycie realny czas cyklu i poziom błędów PO automatyzacji, czy zakładacie, że obietnica się spełniła?',
        en: 'Do you measure the real post-automation cycle time and error rate, or assume the promise held?',
      },
      rationale: {
        pl: 'Deklarowany zysk ≠ zmierzony zysk. Bez pomiaru po wdrożeniu bronicie liczby, której nikt nie potwierdził.',
        en: 'Claimed gain ≠ measured gain. Without post-deployment measurement you defend a number no one confirmed.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest realny wskaźnik wyjątków wymagających człowieka i jak zmienia się w czasie?',
        en: 'What is the real rate of exceptions requiring a human, and how does it trend over time?',
      },
      rationale: {
        pl: 'Rosnący wskaźnik wyjątków to znak, że proces bazowy się zmienił, a automatyzacja została w tyle.',
        en: 'A rising exception rate signals the base process changed and the automation fell behind.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Kto jest właścicielem tej automatyzacji po odejściu zespołu wdrożeniowego i kto może ją bezpiecznie zmienić?',
        en: 'Who owns this automation after the delivery team leaves, and who can safely change it?',
      },
      rationale: {
        pl: 'Automatyzacja bez właściciela staje się czarną skrzynką, której nikt nie rusza — do dnia, w którym się wywala.',
        en: 'Automation without an owner becomes a black box no one touches — until the day it breaks.',
      },
    },
  ],
};

export interface PhaseProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per phase. Consumed when AI (or the offline
 * fallback) proposes candidate automation moves. Mirrors SMED's PROPOSAL_BANK.
 */
export const AUTOMATION_PROPOSAL_BANK: Record<AutomationPhaseId, PhaseProposal[]> = {
  map: [
    {
      rung: 'surface',
      title: {
        pl: 'Przejść proces krok po kroku z osobą, która go wykonuje',
        en: 'Walk the process step by step with the person who runs it',
      },
      explanation: {
        pl: 'Zanim cokolwiek zautomatyzujecie, spiszcie realny przebieg z wykonawcą, nie z regulaminu — mapa z regulaminu prawie zawsze pomija wyjątki.',
        en: 'Before automating anything, capture the real flow with the operator, not from the policy — the policy map almost always omits the exceptions.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć wolumen i czas cyklu z realnych danych',
        en: 'Count volume and cycle time from real data',
      },
      explanation: {
        pl: 'Zbierzcie liczbę uruchomień na tydzień i minuty na cykl z logów lub próby, żeby wiedzieć, czy w ogóle jest o co walczyć.',
        en: 'Gather runs-per-week and minutes-per-cycle from logs or a sample so you know whether there is anything worth fighting for.',
      },
    },
  ],
  standardize: [
    {
      rung: 'surface',
      title: {
        pl: 'Zredukować liczbę wariantów przebiegu do jednego uzgodnionego',
        en: 'Reduce the process variants to one agreed flow',
      },
      explanation: {
        pl: 'Nazwijcie każdy wariant, uzgodnijcie jeden standard i przypiszcie mu właściciela — dopiero taki proces da się sensownie zautomatyzować.',
        en: 'Name every variant, agree one standard, and give it an owner — only such a process can be sensibly automated.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Usunąć kroki poprawek i przepisywania danych',
        en: 'Remove rework and data re-keying steps',
      },
      explanation: {
        pl: 'Dla każdego kroku zapytajcie „czy dodaje wartość?” — przepisywanie danych między systemami to typowy krok do wyeliminowania, nie zautomatyzowania.',
        en: 'For each step ask "does it add value?" — re-keying data between systems is a typical step to eliminate, not automate.',
      },
    },
  ],
  automate: [
    {
      rung: 'surface',
      title: {
        pl: 'Wybrać najprostszy mechanizm dla każdego kandydata',
        en: 'Pick the simplest mechanism for each candidate',
      },
      explanation: {
        pl: 'Dla kroku regułowego integracja API bije RPA, a RPA bije robotę ręczną — sięgajcie po najprostsze narzędzie, które załatwia sprawę.',
        en: 'For a rule-based step an API integration beats RPA, and RPA beats manual work — reach for the simplest tool that does the job.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wyliczyć payback: oszczędność minus koszt utrzymania',
        en: 'Compute payback: savings minus run cost',
      },
      explanation: {
        pl: 'Zestawcie zaoszczędzone godziny × koszt roboczogodziny z kosztem budowy i utrzymania automatyzacji — payback ponad rok to sygnał ostrożności.',
        en: 'Set saved hours × loaded hourly cost against the build and run cost of the automation — a payback beyond a year is a caution signal.',
      },
    },
  ],
  sustain: [
    {
      rung: 'surface',
      title: {
        pl: 'Ustawić monitoring i próg alarmu dla automatyzacji',
        en: 'Set up monitoring and an alert threshold for the automation',
      },
      explanation: {
        pl: 'Zdefiniujcie sygnał, który pokaże, że automatyzacja przestała działać (wzrost wyjątków, spadek wolumenu), i przypiszcie go do człowieka.',
        en: 'Define the signal that shows the automation stopped working (rising exceptions, dropping volume) and assign it to a human.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przypisać właściciela i ścieżkę awaryjną',
        en: 'Assign an owner and a fallback path',
      },
      explanation: {
        pl: 'Nazwijcie, kto utrzymuje automatyzację i co się dzieje, gdy padnie — bez tego zysk trwa tylko do pierwszej awarii.',
        en: 'Name who maintains the automation and what happens when it fails — without this the gain lasts only until the first outage.',
      },
    },
  ],
};
