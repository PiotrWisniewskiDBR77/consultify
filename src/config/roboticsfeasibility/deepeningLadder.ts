/**
 * Robotics Feasibility — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the SMED / Inventory-Autopilot / RPA-Scanner `deepeningLadder` +
 * `PROPOSAL_BANK` pattern (see src/config/rpascanner/deepeningLadder.ts). Encodes
 * the robotics-feasibility "depth staircase" per input axis of the assessment:
 *
 *   1. surface          — what is the current state of this axis (operation, cost, mix)?
 *   2. evidence         — is it measured, or is it habit / a supplier's brochure figure?
 *   3. quantification   — how much time / money / risk does it carry, at what variability?
 *   4. risk-capability  — what capability / procedure must exist to change it safely?
 *
 * The six canonical axes mirror the doctrine's input list AND its two-gate logic —
 * technical feasibility (operation · variability · safety-precision) is read BEFORE
 * economic feasibility (cycle-time · volume · labour-cost), because reversing the
 * order is the single most common cause of failed automation (60% miss target ROI):
 *   - operation     : how repeatable / structured is the physical task itself?
 *   - cycleTime     : the manual cycle time and how much it varies operator-to-operator
 *   - volume        : cycles/day, shifts, seasonality, and — decisively — volume TREND
 *   - variability   : product mix / SKU count through the operation, changeover frequency
 *   - labourCost    : fully-burdened cost of the station, incl. turnover/recruitment
 *   - safety        : safety regime (fenced robot vs cobot, ISO 10218/TS 15066) + precision
 *
 * Content is partner-grade, bilingual (PL/EN), consumed by the tool's input
 * sections and by the synthesis engine (roboticsEngine.ts).
 */

export type RoboticsAxisId =
  | 'operation'
  | 'cycleTime'
  | 'volume'
  | 'variability'
  | 'labourCost'
  | 'safety';

export const ROBOTICS_AXES: RoboticsAxisId[] = [
  'operation',
  'cycleTime',
  'volume',
  'variability',
  'labourCost',
  'safety',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and axis-agnostic. */
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

export const ROBOTICS_LADDER_RUNG_ORDER = RUNG_ORDER;

const ROBOTICS_AXIS_LABEL: Record<RoboticsAxisId, Bilingual> = {
  operation: { pl: 'Operacja', en: 'Operation' },
  cycleTime: { pl: 'Czas cyklu', en: 'Cycle time' },
  volume: { pl: 'Wolumen', en: 'Volume' },
  variability: { pl: 'Zmienność produktu', en: 'Product variability' },
  labourCost: { pl: 'Koszt pracy', en: 'Labour cost' },
  safety: { pl: 'Bezpieczeństwo i precyzja', en: 'Safety & precision' },
};

export const roboticsAxisLabel = (axis: RoboticsAxisId): Bilingual => ROBOTICS_AXIS_LABEL[axis];

/**
 * Per-axis deepening ladder. Each axis has exactly 4 rungs in RUNG_ORDER, so the
 * synthesis engine can rely on a stable shape.
 */
export const ROBOTICS_DEEPENING_LADDER: Record<RoboticsAxisId, LadderRung[]> = {
  operation: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Opiszcie operację jako sekwencję ruchów — czy to zawsze te same czynności między tym samym startem a końcem cyklu, czy „zależy od przypadku"?',
        en: 'Describe the operation as a sequence of movements — is it always the same actions between the same cycle start and end, or does it "depend on the case"?',
      },
      rationale: {
        pl: 'Robot odwzorowuje regułę, nie intuicję operatora — im więcej wyjątków i osądu sytuacyjnego, tym gorszy kandydat, niezależnie od tego, jak męcząca jest praca.',
        en: 'A robot replays a rule, not the operator\'s intuition — the more exceptions and situational judgment, the worse the candidate, no matter how tiring the work is.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy środowisko jest ustrukturyzowane (stała pozycja detalu, stałe oświetlenie), czy detal trafia w przypadkowym ułożeniu wymagającym drogiej percepcji (vision/AI)?',
        en: 'Is the environment structured (fixed part position, stable lighting), or does the part arrive in a random pose requiring an expensive perception layer (vision/AI)?',
      },
      rationale: {
        pl: 'Wysoka powtarzalność bez ustrukturyzowanego środowiska nadal wymaga drogiej warstwy percepcji — kryteria czyta się RAZEM, nie osobno.',
        en: 'High repeatability without a structured environment still needs an expensive perception layer — the criteria are read TOGETHER, not separately.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak trudny jest chwyt (gripping) — obiekt sztywny i regularny, czy kruchy/śliski/deformowalny wymagający specjalistycznego chwytaka i „ludzkiej zręczności"?',
        en: 'How hard is the grip (gripping) — a rigid, regular object, or a fragile/slippery/deformable one needing a specialist end-effector and "human dexterity"?',
      },
      rationale: {
        pl: 'Chwytak to NAJCZĘSTSZA przyczyna porażki technicznej — jeśli chwyt wymaga adaptacyjnego nacisku, to sygnał ostrzegawczy podnoszący próg opłacalności, nie automatyczne wykluczenie.',
        en: 'The gripper is the MOST common cause of technical failure — if the grip needs adaptive pressure, it is a warning sign that raises the profitability threshold, not an automatic exclusion.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy proces bazowy jest ustabilizowany, czy dopiero go standaryzujecie — bo robotyzacja chaosu daje tylko szybszy, droższy chaos?',
        en: 'Is the base process stabilized, or are you still standardizing it — because automating chaos only yields faster, more expensive chaos?',
      },
      rationale: {
        pl: 'Najpierw ustabilizuj proces, potem wróć do oceny robotyzacji — automatyzacja niestabilnego procesu utrwala jego wady w sprzęcie, którego przeróbka jest droga.',
        en: 'Stabilize the process first, then return to the robotization assessment — automating an unstable process bakes its flaws into hardware that is expensive to rework.',
      },
    },
  ],
  cycleTime: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Ile trwa jeden cykl operacji wykonywany ręcznie i skąd znacie tę liczbę — z pomiaru na stanowisku czy z pamięci brygadzisty?',
        en: 'How long is one manual cycle of the operation, and where does that number come from — a measurement at the station or the foreman\'s memory?',
      },
      rationale: {
        pl: 'Cycle time jest licznikiem oszczędności — założony „na oko" psuje cały business case, bo o niego mnoży się wolumen i koszt pracy.',
        en: 'Cycle time is the numerator of the saving — a guessed figure poisons the whole business case, because volume and labour cost multiply through it.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy czas cyklu jest stały, czy „zależy kto robi" — jaka jest rozpiętość między najszybszym a najwolniejszym operatorem i pod koniec zmiany?',
        en: 'Is the cycle time constant, or does it "depend on who does it" — what is the spread between the fastest and slowest operator, and at the end of a shift?',
      },
      rationale: {
        pl: 'Duża rozpiętość czasu ludzkiego to jednocześnie ukryta strata jakości i mocny argument za robotem, który trzyma stały takt bez efektu zmęczenia.',
        en: 'A wide human-time spread is both a hidden quality loss and a strong argument for a robot that holds a constant takt without a fatigue effect.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki cycle time realnie osiągnie robot/cobot na pełnym miksie wariantów — czy macie tę liczbę, czy przyjmujecie deklarację dostawcy?',
        en: 'What cycle time will the robot/cobot really achieve on the full variant mix — do you have that number, or are you taking the supplier\'s claim?',
      },
      rationale: {
        pl: 'Deklarowany cycle time cobota mierzony jest zwykle na jednym wariancie w idealnych warunkach — realny takt na pełnym miksie to jeden z parametrów, który uzasadnia PILOT zamiast wiary.',
        en: 'A claimed cobot cycle time is usually measured on one variant in ideal conditions — the real takt on the full mix is one of the parameters that justifies a PILOT over faith.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy to stanowisko jest wąskim gardłem linii — bo przyspieszenie nie-ograniczenia nie zwiększa przepustowości systemu i nie wchodzi do licznika ROI?',
        en: 'Is this station the line constraint — because speeding up a non-constraint does not raise system throughput and does NOT enter the ROI numerator?',
      },
      rationale: {
        pl: 'Zgodnie z zasadą Throughput przyspieszenie stanowiska, które nie jest ograniczeniem, nie daje więcej wyrobów — przyrost przepustowości liczy się do ROI tylko, gdy stanowisko jest constraintem.',
        en: 'By the Throughput principle, speeding up a station that is not the constraint yields no more output — a throughput gain counts toward ROI only if the station is the constraint.',
      },
    },
  ],
  volume: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Ile cykli/jednostek przechodzi przez operację dziennie i tygodniowo, na ilu zmianach (1/2/3) i czy jest sezonowość?',
        en: 'How many cycles/units pass through the operation daily and weekly, on how many shifts (1/2/3), and is there seasonality?',
      },
      rationale: {
        pl: 'Ten sam robot ma zupełnie inny payback przy 1 zmianie i przy 3 — liczba zmian często decyduje o opłacalności bardziej niż sam wybór sprzętu.',
        en: 'The same robot has a completely different payback at 1 shift versus 3 — the shift count often decides profitability more than the equipment choice itself.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy wolumen jest zmierzony z systemu (MES/ERP), czy oszacowany — i czy uwzględnia realne przestoje, a nie moc teoretyczną?',
        en: 'Is the volume measured from a system (MES/ERP) or estimated — and does it reflect real downtime, not theoretical capacity?',
      },
      rationale: {
        pl: 'Business case na wolumenie teoretycznym zawyża oszczędność — payback liczy się z realnie przepracowanych cykli, nie z nominalnej mocy stanowiska.',
        en: 'A business case on theoretical volume overstates the saving — payback is computed from cycles actually worked, not the station\'s nominal capacity.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest TREND wolumenu tej operacji na 3-5 lat — rosnący, stabilny czy malejący — i czy pokrywa się z horyzontem amortyzacji robota?',
        en: 'What is the VOLUME TREND for this operation over 3-5 years — rising, stable or falling — and does it match the robot\'s amortization horizon?',
      },
      rationale: {
        pl: 'Trend wolumenu waży więcej niż wolumen bieżący: amortyzacja robota (3-7 lat) musi pokrywać się z prognozą popytu, inaczej poprawny arytmetycznie payback prowadzi do złej decyzji.',
        en: 'The volume trend outweighs current volume: the robot\'s amortization (3-7 yrs) must match the demand forecast, else an arithmetically-correct payback leads to a bad decision.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy przy malejącym lub niepewnym wolumenie da się zabezpieczyć inwestycję (elastyczność re-deploymentu robota na inną operację), czy CAPEX jest przypisany na sztywno?',
        en: 'If volume is falling or uncertain, can the investment be hedged (redeploying the robot to another operation), or is the CAPEX rigidly committed to this station?',
      },
      rationale: {
        pl: 'Robot możliwy do przeniesienia na inną operację znosi część ryzyka trendu — sztywno przypisany CAPEX przy malejącym wolumenie to najczęstsza pułapka strategicznie złej, choć „opłacalnej" decyzji.',
        en: 'A robot redeployable to another operation offsets some trend risk — a rigidly-committed CAPEX on falling volume is the classic trap of a strategically-bad yet "profitable" decision.',
      },
    },
  ],
  variability: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Ile wariantów/SKU przechodzi przez tę operację i jak często zmienia się wariant — raz na zmianę, kilka razy dziennie, ciągle?',
        en: 'How many variants/SKUs pass through this operation, and how often does the variant change — once per shift, several times a day, continuously?',
      },
      rationale: {
        pl: 'Zmienność produktu to najczęściej niedoceniany zabójca opłacalności — robot kupiony do zadania o wysokiej zmienności kończy jako drogi, rzadko używany sprzęt.',
        en: 'Product variability is the most underrated killer of profitability — a robot bought for a high-variability task ends up as expensive, rarely-used equipment.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy zmiana wariantu wymaga przezbrojenia chwytaka/programu, i czy to jest udokumentowana procedura, czy wiedza plemienna operatora?',
        en: 'Does a variant change require a gripper/program changeover, and is that a documented procedure or the operator\'s tribal knowledge?',
      },
      rationale: {
        pl: 'Każde przezbrojenie chwytaka to koszt operacyjny często pomijany w kalkulacji — bez spisanej procedury zmiany zmienność jest ukrytym kosztem, nie parametrem.',
        en: 'Every gripper changeover is an operating cost often omitted from the calculation — without a written change procedure, variability is a hidden cost, not a parameter.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki udział wolumenu przypada na 2-3 najczęstsze warianty — czy da się nimi obsadzić 70-80% jednostek, zostawiając ogon manualnie?',
        en: 'What share of volume falls on the 2-3 most frequent variants — could they cover 70-80% of units, leaving the tail manual?',
      },
      rationale: {
        pl: 'Rozkład wolumenu po wariantach decyduje o rekomendacji HYBRYDA: jeśli garść wariantów robi większość jednostek, robot bierze rdzeń, człowiek — ogon niestandardowy.',
        en: 'The volume distribution across variants drives the HYBRID recommendation: if a handful of variants make most units, the robot takes the core and the human the non-standard tail.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy istnieje wbudowana procedura re-oceny ryzyka bezpieczeństwa przy KAŻDEJ zmianie wariantu/chwytaka, czy to ukryty koszt compliance?',
        en: 'Is there a built-in safety re-assessment procedure for EVERY variant/gripper change, or is it a hidden compliance cost?',
      },
      rationale: {
        pl: 'W reżimie cobota zmiana chwytaka lub detalu formalnie wymaga ponownej oceny zgodności z normą (ISO 10218:2025) — brak tej procedury to ryzyko wypadku, nie formalność.',
        en: 'In the cobot regime a gripper or part change formally requires a fresh conformity assessment (ISO 10218:2025) — missing that procedure is an accident risk, not a formality.',
      },
    },
  ],
  labourCost: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Ile etatów/zmian obsadza tę operację i jaki jest w pełni obciążony koszt jednego stanowiska (płaca + narzuty + nadgodziny)?',
        en: 'How many FTEs/shifts staff this operation, and what is the fully-burdened cost of one station (wage + on-costs + overtime)?',
      },
      rationale: {
        pl: 'Payback jest funkcją kosztu pracy zastępowanej, nie uniwersalną stałą — bez pełnego kosztu stanowiska mianownik oszczędności jest zaniżony.',
        en: 'Payback is a function of the labour cost replaced, not a universal constant — without the full station cost the saving denominator is understated.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy koszt uwzględnia rotację i rekrutację — ile razy w roku obsadzacie to stanowisko na nowo i ile kosztuje jedno wdrożenie?',
        en: 'Does the cost include turnover and recruitment — how often per year do you re-staff this station, and what does one onboarding cost?',
      },
      rationale: {
        pl: 'Koszt chronicznej rotacji rzadko jest policzony wprost, a bywa mocniejszym case\'em niż sama oszczędność/godzinę — stanowisko taniego, ale nieobsadzalnego etatu potrafi uzasadnić robota mimo niskiej stawki.',
        en: 'Chronic turnover cost is rarely counted explicitly, yet can be a stronger case than the hourly saving itself — a cheap-but-unfillable station can justify a robot despite the low rate.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile FTE realnie zwalnia robot (redukcja czy przesunięcie na nadzór), i jaki jest nowy OPEX robota (serwis, energia, operator nadzorujący)?',
        en: 'How many FTE does the robot really free (reduction vs. reassignment to supervision), and what is the robot\'s new OPEX (service, energy, supervising operator)?',
      },
      rationale: {
        pl: 'Oszczędność netto to redukcja etatów MINUS nowy OPEX robota — pominięcie operatora nadzorującego i serwisu zawyża licznik ROI i skraca payback pozornie.',
        en: 'Net saving is FTE reduction MINUS the robot\'s new OPEX — omitting the supervising operator and service overstates the ROI numerator and shortens payback only on paper.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jak zarządzicie oporem załogi — czy jest narracja o przesunięciu na nowe role (nadzór, obsługa wyjątków), czy tylko o redukcji?',
        en: 'How will you manage workforce resistance — is there a narrative of shifting to new roles (supervision, exception handling), or only of reduction?',
      },
      rationale: {
        pl: 'Opór załogi (lęk o miejsca pracy) blokuje wdrożenia technicznie poprawne — plan zmiany musi mówić o przesunięciu ludzi na nadzór i utrzymanie, nie tylko o cięciu etatów.',
        en: 'Workforce resistance (fear for jobs) blocks technically-sound deployments — the change plan must speak of moving people to supervision and maintenance, not only of cutting headcount.',
      },
    },
  ],
  safety: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy ludzie pracują w bezpośrednim sąsiedztwie stacji — bo to przesądza o reżimie: ogrodzony robot przemysłowy vs. cobot we współdzielonej przestrzeni?',
        en: 'Do people work in the immediate vicinity of the station — because that decides the regime: a fenced industrial robot vs. a cobot in shared space?',
      },
      rationale: {
        pl: 'Reżim bezpieczeństwa determinuje koszt integracji i elastyczność layoutu — cobot (ISO 10218-2:2025/dawne TS 15066) jest droższy per prędkość, ale tańszy w integracji (brak ogrodzenia).',
        en: 'The safety regime determines integration cost and layout flexibility — a cobot (ISO 10218-2:2025/former TS 15066) is dearer per unit of speed but cheaper to integrate (no fencing).',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jakie są wymogi precyzji i regulacyjne (tolerancje wymiarowe, spożywcze/medyczne/ATEX) — czy są zmierzone, czy „mniej więcej"?',
        en: 'What are the precision and regulatory requirements (dimensional tolerances, food/medical/ATEX) — are they measured, or "roughly"?',
      },
      rationale: {
        pl: 'Wymóg regulacyjny lub wysoka tolerancja podnosi klasę robota i koszt walidacji — założenie „mniej więcej" ujawnia się dopiero przy odbiorze, gdy CAPEX jest już wydany.',
        en: 'A regulatory requirement or tight tolerance raises the robot class and validation cost — a "roughly" assumption surfaces only at acceptance, once the CAPEX is already spent.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile realnie kosztuje warstwa bezpieczeństwa (ogrodzenia/czujniki lub monitorowanie kontaktu) i czy jest jawną linią w CAPEX, czy schowana w „integracji"?',
        en: 'What does the safety layer really cost (fencing/sensors or contact monitoring), and is it an explicit CAPEX line or buried in "integration"?',
      },
      rationale: {
        pl: 'Bezpieczeństwo to osobna linia CAPEX — schowane w agregacie zaniża koszt i wydłuża realny payback względem pierwotnego pitchu dostawcy.',
        en: 'Safety is a separate CAPEX line — buried in an aggregate it understates cost and lengthens real payback versus the supplier\'s original pitch.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy macie zdolność do POWTARZALNEJ oceny zgodności przy każdej zmianie (program/chwytak/detal), czy traktujecie to jak jednorazowy certyfikat?',
        en: 'Do you have the capability for RECURRING conformity assessment on every change (program/gripper/part), or do you treat it as a one-off certificate?',
      },
      rationale: {
        pl: 'W reżimie współdzielonej przestrzeni zgodność z normą to powtarzalny proces przy KAŻDEJ zmianie, nie jednorazowy certyfikat — brak tej zdolności to ukryte ryzyko wypadku i przestoju.',
        en: 'In a shared-space regime, standard conformity is a recurring process on EVERY change, not a one-off certificate — lacking that capability is a hidden accident and downtime risk.',
      },
    },
  ],
};

export interface AxisProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per axis. Consumed when AI (or the offline
 * fallback) proposes candidate robotics moves. Mirrors RPA-Scanner's PROPOSAL_BANK.
 */
export const ROBOTICS_PROPOSAL_BANK: Record<RoboticsAxisId, AxisProposal[]> = {
  operation: [
    {
      rung: 'surface',
      title: {
        pl: 'Spisać operację jako sekwencję ruchów z punktami start/koniec',
        en: 'Write the operation as a movement sequence with start/end points',
      },
      explanation: {
        pl: 'Zanim ocenicie robotyzowalność, udokumentujcie każdy ruch cyklu i wskażcie miejsca osądu sytuacyjnego — to one, nie sam wolumen, przesądzają, czy zadanie jest ustrukturyzowane.',
        en: 'Before assessing robotizability, document every cycle movement and mark the points of situational judgment — those, not volume, decide whether the task is structured.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Ocenić strukturę środowiska (pozycja detalu, oświetlenie)',
        en: 'Assess environment structure (part position, lighting)',
      },
      explanation: {
        pl: 'Sprawdźcie, czy detal trafia w stałej pozycji i przy stałym kontraście — środowisko chaotyczne wymaga drogiej warstwy vision, zanim robot w ogóle zadziała.',
        en: 'Check whether the part arrives in a fixed pose at constant contrast — a chaotic environment needs an expensive vision layer before the robot works at all.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Przetestować rozwiązywalność chwytu w budżecie integratora',
        en: 'Test grip solvability within the integrator budget',
      },
      explanation: {
        pl: 'Zweryfikujcie chwyt na realnym detalu (sztywność, kruchość, zmienność kształtu) — chwytak to najczęstsza przyczyna porażki technicznej i najczęstsza niedoszacowana pozycja kosztu.',
        en: 'Verify the grip on a real part (rigidity, fragility, shape variability) — the gripper is the top cause of technical failure and the most-underestimated cost line.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustabilizować proces bazowy przed robotyzacją',
        en: 'Stabilize the base process before robotizing',
      },
      explanation: {
        pl: 'Jeśli proces nie jest jeszcze ustandaryzowany, najpierw go domknijcie — robotyzacja niestabilnego procesu utrwala jego wady w drogim sprzęcie.',
        en: 'If the process is not yet standardized, close it first — robotizing an unstable process bakes its flaws into expensive hardware.',
      },
    },
  ],
  cycleTime: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmierzyć realny cycle time manualny na stanowisku',
        en: 'Measure the real manual cycle time at the station',
      },
      explanation: {
        pl: 'Zastąpcie pamięć brygadzisty pomiarem z kilku cykli i kilku operatorów — ta liczba jest licznikiem całej oszczędności i nie może być założona „na oko".',
        en: 'Replace the foreman\'s memory with a measurement over several cycles and operators — this figure is the numerator of the whole saving and cannot be guessed.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć rozpiętość czasu między operatorami i w czasie zmiany',
        en: 'Measure time spread across operators and through the shift',
      },
      explanation: {
        pl: 'Duża wariancja czasu ludzkiego to ukryta strata jakości i argument za stałym taktem robota — udokumentujcie ją, zamiast uśredniać do jednej liczby.',
        en: 'A wide human-time variance is a hidden quality loss and an argument for a robot\'s constant takt — document it rather than averaging it to one number.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zweryfikować realny cycle time robota na pełnym miksie (pilot)',
        en: 'Verify the robot\'s real cycle time on the full mix (pilot)',
      },
      explanation: {
        pl: 'Nie przyjmujcie deklaracji dostawcy mierzonej na jednym wariancie — pilot na pełnym miksie daje twardą liczbę, od której zależy payback.',
        en: 'Do not take the supplier claim measured on one variant — a pilot on the full mix gives the hard number the payback depends on.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Sprawdzić, czy stanowisko jest wąskim gardłem linii',
        en: 'Check whether the station is the line constraint',
      },
      explanation: {
        pl: 'Policzcie przyrost przepustowości do ROI tylko, gdy stanowisko jest ograniczeniem — przyspieszenie nie-constraintu nie zwiększa wyjścia systemu.',
        en: 'Count the throughput gain toward ROI only if the station is the constraint — speeding up a non-constraint does not raise system output.',
      },
    },
  ],
  volume: [
    {
      rung: 'surface',
      title: {
        pl: 'Ustalić wolumen cykli i liczbę zmian z danych, nie z pamięci',
        en: 'Establish cycle volume and shift count from data, not memory',
      },
      explanation: {
        pl: 'Wyciągnijcie liczbę cykli/dzień i liczbę zmian z MES/ERP — liczba zmian często decyduje o opłacalności bardziej niż wybór sprzętu.',
        en: 'Pull cycles/day and shift count from MES/ERP — the shift count often decides profitability more than the equipment choice.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Skorygować wolumen o realne przestoje, nie moc teoretyczną',
        en: 'Correct volume for real downtime, not theoretical capacity',
      },
      explanation: {
        pl: 'Oprzyjcie business case na cyklach realnie przepracowanych — wolumen teoretyczny zawyża oszczędność i skraca payback pozornie.',
        en: 'Base the business case on cycles actually worked — theoretical volume overstates the saving and shortens payback only on paper.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Nałożyć prognozę trendu wolumenu na horyzont amortyzacji',
        en: 'Overlay the volume-trend forecast on the amortization horizon',
      },
      explanation: {
        pl: 'Zestawcie 3-5-letni trend wolumenu z 5-letnią amortyzacją robota — malejący wolumen odradza CAPEX nawet przy dobrym paybacku dzisiaj.',
        en: 'Set the 3-5-year volume trend against the robot\'s 5-year amortization — falling volume argues against the CAPEX even with a good payback today.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zabezpieczyć CAPEX możliwością re-deploymentu robota',
        en: 'Hedge the CAPEX with robot redeployability',
      },
      explanation: {
        pl: 'Wybierzcie rozwiązanie możliwe do przeniesienia na inną operację — to znosi część ryzyka trendu przy niepewnym wolumenie.',
        en: 'Choose a solution redeployable to another operation — it offsets part of the trend risk under uncertain volume.',
      },
    },
  ],
  variability: [
    {
      rung: 'surface',
      title: {
        pl: 'Policzyć liczbę wariantów i częstość zmiany na operacji',
        en: 'Count variants and change frequency on the operation',
      },
      explanation: {
        pl: 'Ustalcie, ile wariantów przechodzi przez stanowisko i jak często następuje zmiana — zmienność jest najczęściej niedocenianym zabójcą opłacalności.',
        en: 'Establish how many variants pass the station and how often changes occur — variability is the most underrated killer of profitability.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Spisać procedurę przezbrojenia chwytaka/programu',
        en: 'Write down the gripper/program changeover procedure',
      },
      explanation: {
        pl: 'Udokumentujcie koszt i czas każdej zmiany wariantu — bez spisanej procedury zmienność jest ukrytym kosztem, nie parametrem business case\'u.',
        en: 'Document the cost and time of each variant change — without a written procedure, variability is a hidden cost, not a business-case parameter.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wyznaczyć warianty wysokowolumenowe pod scenariusz HYBRYDA',
        en: 'Identify high-volume variants for a HYBRID scenario',
      },
      explanation: {
        pl: 'Znajdźcie 2-3 warianty robiące 70-80% jednostek — robot bierze ten rdzeń, człowiek zostaje na ogonie niestandardowym; to często optymalny wynik ekonomiczny.',
        en: 'Find the 2-3 variants making 70-80% of units — the robot takes that core, the human stays on the non-standard tail; often the optimal economic outcome.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wbudować re-ocenę bezpieczeństwa w procedurę zmiany wariantu',
        en: 'Build safety re-assessment into the variant-change procedure',
      },
      explanation: {
        pl: 'Dodajcie do procesu zmiany wariantu formalny krok ponownej oceny zgodności (ISO 10218:2025) — bez niego zmienność jest ukrytym kosztem compliance i ryzykiem wypadku.',
        en: 'Add a formal conformity re-assessment step (ISO 10218:2025) to the variant-change process — without it, variability is a hidden compliance cost and accident risk.',
      },
    },
  ],
  labourCost: [
    {
      rung: 'surface',
      title: {
        pl: 'Policzyć w pełni obciążony koszt stanowiska × liczba zmian',
        en: 'Cost the fully-burdened station × shift count',
      },
      explanation: {
        pl: 'Zsumujcie płacę, narzuty i nadgodziny na wszystkich zmianach obsadzających operację — to mianownik oszczędności, którego nie wolno zaniżyć.',
        en: 'Sum wage, on-costs and overtime across every shift staffing the operation — this is the saving denominator you must not understate.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Doliczyć koszt rotacji i rekrutacji na stanowisku',
        en: 'Add the turnover and recruitment cost of the station',
      },
      explanation: {
        pl: 'Policzcie liczbę rotacji/rok × koszt wdrożenia — chroniczna rotacja bywa mocniejszym case\'em niż oszczędność/godzinę i rzadko jest w P&L wprost.',
        en: 'Count rotations/year × onboarding cost — chronic turnover can be a stronger case than the hourly saving and is rarely explicit in the P&L.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wyliczyć oszczędność netto: redukcja FTE minus nowy OPEX robota',
        en: 'Compute net saving: FTE reduction minus new robot OPEX',
      },
      explanation: {
        pl: 'Odejmijcie od redukcji etatów nowy koszt robota (serwis, energia, operator nadzorujący) — dopiero wynik netto wchodzi do paybacku.',
        en: 'Subtract the new robot cost (service, energy, supervising operator) from the FTE reduction — only the net result enters the payback.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zbudować narrację przesunięcia ludzi, nie tylko redukcji',
        en: 'Build a narrative of shifting people, not only reduction',
      },
      explanation: {
        pl: 'Zaplanujcie przeszkolenie operatorów na nowe role (nadzór, obsługa wyjątków, konserwacja) — bez tej narracji opór załogi blokuje technicznie poprawne wdrożenie.',
        en: 'Plan operator retraining into new roles (supervision, exception handling, maintenance) — without this narrative, workforce resistance blocks a technically-sound deployment.',
      },
    },
  ],
  safety: [
    {
      rung: 'surface',
      title: {
        pl: 'Rozstrzygnąć reżim: robot ogrodzony vs. cobot współdzielony',
        en: 'Decide the regime: fenced robot vs. shared-space cobot',
      },
      explanation: {
        pl: 'Ustalcie obecność ludzi w sąsiedztwie stacji — to przesądza o reżimie (ISO 10218-1 vs. 10218-2:2025/TS 15066), a reżim o koszcie integracji i elastyczności layoutu.',
        en: 'Establish human presence near the station — it decides the regime (ISO 10218-1 vs. 10218-2:2025/TS 15066), and the regime decides integration cost and layout flexibility.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć wymogi precyzji i regulacyjne operacji',
        en: 'Measure the operation\'s precision and regulatory requirements',
      },
      explanation: {
        pl: 'Ustalcie tolerancje wymiarowe i wymogi (spożywcze/medyczne/ATEX) liczbowo — założenie „mniej więcej" ujawnia się dopiero przy odbiorze, gdy CAPEX jest wydany.',
        en: 'Establish dimensional tolerances and requirements (food/medical/ATEX) numerically — a "roughly" assumption surfaces only at acceptance, once the CAPEX is spent.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wydzielić bezpieczeństwo jako jawną linię CAPEX',
        en: 'Break out safety as an explicit CAPEX line',
      },
      explanation: {
        pl: 'Wycenić ogrodzenia/czujniki lub monitorowanie kontaktu osobno od hardware\'u — schowane w „integracji" zaniżają koszt i wydłużają realny payback.',
        en: 'Price fencing/sensors or contact monitoring separately from hardware — buried in "integration" they understate cost and lengthen real payback.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wprowadzić powtarzalną ocenę zgodności przy każdej zmianie',
        en: 'Introduce recurring conformity assessment on every change',
      },
      explanation: {
        pl: 'Ustanówcie proces ponownej oceny bezpieczeństwa przy zmianie programu/chwytaka/detalu — zgodność to powtarzalny proces, nie jednorazowy certyfikat.',
        en: 'Establish a safety re-assessment process on any program/gripper/part change — conformity is a recurring process, not a one-off certificate.',
      },
    },
  ],
};
