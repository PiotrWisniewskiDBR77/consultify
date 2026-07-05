/**
 * DMS Builder (Daily Management System) — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Ansoff / SWOT `deepeningLadder` + `PROPOSAL_BANK` pattern
 * (see src/config/ansoff/deepeningLadder.ts). Encodes the DMS-specific
 * "depth staircase" per control-loop layer:
 *
 *   1. surface          — does this layer of the daily control loop exist at all?
 *   2. evidence         — is it real (owned, current), not a laminated poster?
 *   3. quantification   — what does it measure, at what threshold and cadence?
 *   4. risk-capability  — what must the team be able to do to run it every day?
 *
 * The four canonical DMS layers form a closed control loop:
 *   - visibility     : the right few KPIs are visible, current, and owned
 *   - cadence        : a tiered review rhythm (tier-1 huddle .. tier-3 review)
 *   - escalation     : an off-target KPI triggers a defined path to the right level
 *   - response       : escalation closes with a countermeasure and a verified check
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the DMS input
 * phases and by the synthesis engine (managementSystemEngine.ts).
 */

export type DmsLayerId = 'visibility' | 'cadence' | 'escalation' | 'response';

export const DMS_LAYERS: DmsLayerId[] = ['visibility', 'cadence', 'escalation', 'response'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and layer-agnostic. */
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

export const DMS_LADDER_RUNG_ORDER = RUNG_ORDER;

const DMS_LAYER_LABEL: Record<DmsLayerId, Bilingual> = {
  visibility: { pl: 'Widoczność', en: 'Visibility' },
  cadence: { pl: 'Rytm', en: 'Cadence' },
  escalation: { pl: 'Eskalacja', en: 'Escalation' },
  response: { pl: 'Reakcja', en: 'Response' },
};

export const dmsLayerLabel = (layer: DmsLayerId): Bilingual => DMS_LAYER_LABEL[layer];

/**
 * Per-layer deepening ladder. Each layer has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const DMS_DEEPENING_LADDER: Record<DmsLayerId, LadderRung[]> = {
  visibility: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które nieliczne wskaźniki naprawdę rządzą dniem zespołu i czy są widoczne w jednym miejscu przy stanowisku pracy?',
        en: 'Which few KPIs actually govern the team\'s day, and are they visible in one place at the point of work?',
      },
      rationale: {
        pl: 'DMS zaczyna się od nielicznych właściwych wskaźników — tablica z 30 metrykami to nie widoczność, to szum.',
        en: 'A DMS starts with the vital few KPIs — a board with 30 metrics is not visibility, it is noise.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Kto aktualizuje te wskaźniki i jak świeże są dane — czy tablica żyje, czy to zalaminowany plakat sprzed miesięcy?',
        en: 'Who updates these KPIs and how fresh is the data — is the board alive, or a laminated poster from months ago?',
      },
      rationale: {
        pl: 'Widoczność bez właściciela i aktualnych danych jest pozorna — zespół przestaje na nią patrzeć w tydzień.',
        en: 'Visibility without an owner and current data is fake — the team stops looking at it within a week.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Czy każdy wskaźnik ma jasny cel/próg i kolor stanu (na cel / poza celem), a nie tylko surową liczbę?',
        en: 'Does each KPI have a clear target/threshold and a status colour (on-target / off-target), not just a raw number?',
      },
      rationale: {
        pl: 'Liczba bez progu nie mówi, czy jest problem — dopiero cel zamienia wskaźnik w sygnał do działania.',
        en: 'A number without a threshold does not say whether there is a problem — only a target turns a KPI into an action signal.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy zespół rozumie, skąd bierze się każdy wskaźnik i potrafi na niego wpłynąć — czy patrzy na metryki, których nie kontroluje?',
        en: 'Does the team understand where each KPI comes from and can influence it — or are they staring at metrics they do not control?',
      },
      rationale: {
        pl: 'Wskaźnik poza wpływem zespołu demotywuje zamiast sterować — widoczność musi być sparowana ze sprawczością.',
        en: 'A KPI beyond the team\'s influence demotivates instead of steering — visibility must be paired with agency.',
      },
    },
  ],
  cadence: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy istnieje stały, krótki rytm przeglądu wskaźników (np. codzienny huddle) o ustalonej porze i długości?',
        en: 'Is there a fixed, short review rhythm of the KPIs (e.g. a daily huddle) at a set time and length?',
      },
      rationale: {
        pl: 'Rytm to serce DMS — bez stałej pory przegląd zdarza się „jak jest czas", czyli nie zdarza się wcale.',
        en: 'Cadence is the heart of a DMS — without a fixed time the review happens "when there is time", meaning never.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy huddle trzyma się standardu (agenda, prowadzący, czas), czy rozłazi się w luźne zebranie bez decyzji?',
        en: 'Does the huddle hold a standard (agenda, lead, timebox), or does it sprawl into a loose meeting with no decisions?',
      },
      rationale: {
        pl: 'Rytm bez standardu spotkania degeneruje do statusów — dowodem żywej kadencji są decyzje i akcje z każdego huddle.',
        en: 'Cadence without a meeting standard degrades into status updates — the proof of a live cadence is decisions and actions from each huddle.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile poziomów ma rytm (tier-1 zespół → tier-3 zakład) i jak szybko sygnał z dołu dociera na górę?',
        en: 'How many tiers does the rhythm have (tier-1 team → tier-3 plant) and how fast does a signal from the floor reach the top?',
      },
      rationale: {
        pl: 'Warstwowy rytm (tier 1-3) mierzy się czasem przejścia sygnału — jeśli problem z rana czeka tydzień na zarząd, kadencja jest fasadą.',
        en: 'A tiered rhythm (tier 1-3) is measured by signal travel time — if a morning problem waits a week for leadership, the cadence is a facade.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy huddle działa bez lidera-bohatera — czy każdy przeszkolony członek zespołu potrafi go poprowadzić?',
        en: 'Does the huddle run without a hero-leader — can any trained team member facilitate it?',
      },
      rationale: {
        pl: 'Rytm zależny od jednej osoby zawala się przy jej urlopie — trwała kadencja to wyszkolona zdolność, nie charyzma lidera.',
        en: 'A rhythm dependent on one person collapses on their leave — durable cadence is a trained capability, not a leader\'s charisma.',
      },
    },
  ],
  escalation: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Gdy wskaźnik wchodzi poza cel, czy istnieje jasna reguła: kto, do kogo i w jakim czasie eskaluje?',
        en: 'When a KPI goes off-target, is there a clear rule: who escalates, to whom, and within what time?',
      },
      rationale: {
        pl: 'Bez reguły eskalacji odchylenie ginie na tablicy — sygnał bez ścieżki na górę to sygnał zignorowany.',
        en: 'Without an escalation rule a deviation dies on the board — a signal with no path upward is a signal ignored.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy w ostatnich tygodniach reguła realnie zadziałała — są przykłady eskalacji, które trafiły na właściwy poziom?',
        en: 'Has the rule actually fired in recent weeks — are there examples of escalations that reached the right level?',
      },
      rationale: {
        pl: 'Reguła, która nigdy nie zadziałała, jest teoretyczna — dowodem jest historia eskalacji, nie zapis w procedurze.',
        en: 'A rule that has never fired is theoretical — the proof is an escalation history, not a line in a procedure.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki próg i czas wyzwalają eskalację (np. 2 dni poza celem → tier-2) i jaki jest limit czasu na reakcję?',
        en: 'What threshold and time trigger an escalation (e.g. 2 days off-target → tier-2), and what is the response time limit?',
      },
      rationale: {
        pl: 'Eskalacja bez policzonego progu i zegara jest uznaniowa — mierzalny wyzwalacz odróżnia system od dobrej woli.',
        en: 'Escalation without a quantified threshold and clock is discretionary — a measurable trigger separates a system from goodwill.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy poziom, na który trafia eskalacja, ma realną władzę i zasób, by zadziałać — czy eskaluje w próżnię?',
        en: 'Does the level the escalation reaches have real authority and resources to act — or does it escalate into a void?',
      },
      rationale: {
        pl: 'Eskalacja do poziomu bez sprawczości uczy zespół, że zgłaszanie nic nie daje — i sygnały zamierają.',
        en: 'Escalation to a level with no agency teaches the team that raising issues changes nothing — and the signals go quiet.',
      },
    },
  ],
  response: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy eskalowany problem kończy się przypisaną akcją naprawczą z właścicielem i terminem, a nie samą dyskusją?',
        en: 'Does an escalated problem end in an assigned countermeasure with an owner and a due date, not just a discussion?',
      },
      rationale: {
        pl: 'Reakcja zamyka pętlę DMS — bez akcji naprawczej z właścicielem eskalacja jest kroniką problemów, nie ich rozwiązywaniem.',
        en: 'Response closes the DMS loop — without an owned countermeasure, escalation is a chronicle of problems, not their resolution.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy sprawdzacie, że akcja naprawcza faktycznie zawróciła wskaźnik na cel — czy zamykacie ją „na słowo"?',
        en: 'Do you verify that the countermeasure actually returned the KPI to target — or do you close it "on trust"?',
      },
      rationale: {
        pl: 'Reakcja bez weryfikacji skutku to pozorne zamknięcie — dowodem jest wskaźnik z powrotem w celu, nie odhaczona akcja.',
        en: 'A response without verified effect is a fake close — the proof is the KPI back on target, not a ticked-off action.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest odsetek problemów zamkniętych w terminie i jak często ten sam problem wraca (nawroty)?',
        en: 'What share of problems close on time, and how often does the same problem recur (repeat rate)?',
      },
      rationale: {
        pl: 'Dojrzałość reakcji mierzy się terminowością i nawrotami — powtarzający się problem znaczy, że leczono objaw, nie przyczynę.',
        en: 'Response maturity is measured by on-time closure and recurrence — a repeating problem means the symptom was treated, not the cause.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy zespół umie dojść do przyczyny źródłowej (np. 5x dlaczego), czy reakcje to gaszenie pożarów bez uczenia się?',
        en: 'Can the team reach root cause (e.g. 5 whys), or are responses firefighting with no learning?',
      },
      rationale: {
        pl: 'Reakcja bez zdolności analizy przyczyny to wieczne gaszenie pożarów — trwały DMS wymaga kompetencji rozwiązywania problemów, nie tylko szybkości.',
        en: 'Response without root-cause capability is perpetual firefighting — a durable DMS needs problem-solving competency, not just speed.',
      },
    },
  ],
};

export interface LayerProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per layer. Consumed when AI (or the offline
 * fallback) proposes candidate DMS elements. Mirrors Ansoff's PROPOSAL_BANK.
 */
export const DMS_PROPOSAL_BANK: Record<DmsLayerId, LayerProposal[]> = {
  visibility: [
    {
      rung: 'surface',
      title: {
        pl: 'Wybrać 4-6 wskaźników, które naprawdę rządzą dniem',
        en: 'Pick the 4-6 KPIs that truly govern the day',
      },
      explanation: {
        pl: 'Zacznijcie od nielicznych właściwych metryk (bezpieczeństwo, jakość, dostawa, koszt) na jednej tablicy przy stanowisku — nie od dashboardu z 30 liczbami, którego nikt nie czyta.',
        en: 'Start from the vital few metrics (safety, quality, delivery, cost) on one board at the point of work — not a 30-number dashboard no one reads.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Przypisać właściciela i częstotliwość aktualizacji każdej metryki',
        en: 'Assign an owner and update frequency to each metric',
      },
      explanation: {
        pl: 'Każdy wskaźnik potrzebuje osoby, która go aktualizuje, i jasnej częstotliwości — bez tego tablica staje się zalaminowanym plakatem w ciągu tygodni.',
        en: 'Every KPI needs a person who updates it and a clear frequency — without this the board becomes a laminated poster within weeks.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Dodać cel i kolor stanu do każdego wskaźnika',
        en: 'Add a target and status colour to every KPI',
      },
      explanation: {
        pl: 'Zielony/czerwony względem progu zamienia surową liczbę w sygnał do działania — zespół widzi problem, zanim ktokolwiek go opisze słowami.',
        en: 'Green/red against a threshold turns a raw number into an action signal — the team sees the problem before anyone puts it into words.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Usunąć wskaźniki poza wpływem zespołu',
        en: 'Drop metrics beyond the team\'s influence',
      },
      explanation: {
        pl: 'Metryka, na którą zespół nie ma wpływu, demotywuje i uczy ignorowania tablicy — zostawcie tylko te, na które codzienne działania realnie oddziałują.',
        en: 'A metric the team cannot influence demotivates and teaches them to ignore the board — keep only those daily actions actually move.',
      },
    },
  ],
  cadence: [
    {
      rung: 'surface',
      title: {
        pl: 'Ustawić codzienny 15-minutowy huddle o stałej porze',
        en: 'Set a daily 15-minute huddle at a fixed time',
      },
      explanation: {
        pl: 'Krótki, stały rytm przy tablicy o tej samej porze buduje nawyk przeglądu — bez ustalonej pory przegląd zdarza się „jak jest czas", czyli nigdy.',
        en: 'A short, fixed rhythm at the board at the same time builds the review habit — without a set time it happens "when there is time", i.e. never.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Wprowadzić standard huddle: agenda, prowadzący, timebox',
        en: 'Introduce a huddle standard: agenda, lead, timebox',
      },
      explanation: {
        pl: 'Stały format (co przeglądamy, kto prowadzi, ile trwa) chroni huddle przed rozejściem się w luźne zebranie — dowodem żywej kadencji są decyzje z każdego spotkania.',
        en: 'A fixed format (what we review, who leads, how long) protects the huddle from sprawling into a loose meeting — the proof of live cadence is decisions from each one.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zbudować rytm warstwowy tier 1→2→3',
        en: 'Build a tiered rhythm tier 1→2→3',
      },
      explanation: {
        pl: 'Połączcie huddle zespołu (tier-1) z przeglądem obszaru (tier-2) i zakładu (tier-3), tak by sygnał z rana docierał na górę tego samego dnia — mierzcie czas przejścia.',
        en: 'Link the team huddle (tier-1) to an area review (tier-2) and plant review (tier-3) so a morning signal reaches the top the same day — measure the travel time.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przeszkolić rotacyjnych prowadzących huddle',
        en: 'Train rotating huddle facilitators',
      },
      explanation: {
        pl: 'Gdy huddle potrafi poprowadzić kilku przeszkolonych członków zespołu, rytm przetrwa urlop lidera — trwała kadencja to wyszkolona zdolność, nie charyzma jednej osoby.',
        en: 'When several trained team members can run the huddle, the rhythm survives the leader\'s leave — durable cadence is a trained capability, not one person\'s charisma.',
      },
    },
  ],
  escalation: [
    {
      rung: 'surface',
      title: {
        pl: 'Spisać jasną regułę: kto, do kogo, w jakim czasie eskaluje',
        en: 'Write a clear rule: who escalates, to whom, within what time',
      },
      explanation: {
        pl: 'Dla wskaźnika poza celem zdefiniujcie ścieżkę na górę z osobą i limitem czasu — bez reguły odchylenie ginie na tablicy jako sygnał bez adresata.',
        en: 'For an off-target KPI define the upward path with a person and a time limit — without a rule the deviation dies on the board as a signal with no addressee.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Prześledzić realne eskalacje z ostatnich tygodni',
        en: 'Trace real escalations from recent weeks',
      },
      explanation: {
        pl: 'Sprawdźcie, czy reguła kiedykolwiek zadziałała i dokąd trafiła — reguła bez historii eskalacji jest teoretyczna, choćby ładnie opisana w procedurze.',
        en: 'Check whether the rule ever fired and where it landed — a rule with no escalation history is theoretical, however nicely it reads in a procedure.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Ustalić próg i zegar wyzwalający eskalację',
        en: 'Set the threshold and clock that trigger escalation',
      },
      explanation: {
        pl: 'Np. „2 dni poza celem → tier-2 w 24 h" zamienia eskalację z uznaniowej w systemową — mierzalny wyzwalacz odróżnia system od dobrej woli.',
        en: 'E.g. "2 days off-target → tier-2 within 24h" turns escalation from discretionary into systematic — a measurable trigger separates a system from goodwill.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Potwierdzić, że poziom docelowy ma władzę i zasób',
        en: 'Confirm the target level has authority and resources',
      },
      explanation: {
        pl: 'Eskalacja musi trafiać tam, gdzie ktoś może realnie zadziałać — eskalacja w próżnię uczy zespół, że zgłaszanie nic nie zmienia, i sygnały zamierają.',
        en: 'Escalation must reach where someone can actually act — escalating into a void teaches the team that raising issues changes nothing, and signals go quiet.',
      },
    },
  ],
  response: [
    {
      rung: 'surface',
      title: {
        pl: 'Zamykać każdą eskalację akcją z właścicielem i terminem',
        en: 'Close every escalation with an owned, dated action',
      },
      explanation: {
        pl: 'Eskalowany problem musi kończyć się przypisaną akcją naprawczą, nie dyskusją — to reakcja domyka pętlę DMS z tablicy do wyniku.',
        en: 'An escalated problem must end in an assigned countermeasure, not a discussion — response is what closes the DMS loop from board to result.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Weryfikować, że wskaźnik wrócił na cel przed zamknięciem',
        en: 'Verify the KPI is back on target before closing',
      },
      explanation: {
        pl: 'Zamykajcie akcję dopiero, gdy metryka realnie wróciła do celu — dowodem skutku jest wskaźnik w zieleni, nie odhaczona pozycja na liście.',
        en: 'Close an action only when the metric has actually returned to target — the proof of effect is the KPI in green, not a ticked-off list item.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Śledzić terminowość zamknięć i nawroty problemów',
        en: 'Track on-time closure and problem recurrence',
      },
      explanation: {
        pl: 'Mierzcie odsetek akcji zamkniętych w terminie i częstość powrotu tego samego problemu — nawrót znaczy, że leczono objaw, nie przyczynę.',
        en: 'Measure the share of actions closed on time and how often the same problem returns — a recurrence means the symptom was treated, not the cause.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wyposażyć zespół w prostą analizę przyczyny źródłowej',
        en: 'Equip the team with simple root-cause analysis',
      },
      explanation: {
        pl: 'Bez zdolności dojścia do przyczyny (np. 5x dlaczego) reakcje to wieczne gaszenie pożarów — trwały DMS wymaga kompetencji rozwiązywania problemów, nie tylko szybkości.',
        en: 'Without the ability to reach root cause (e.g. 5 whys), responses are perpetual firefighting — a durable DMS needs problem-solving competency, not just speed.',
      },
    },
  ],
};
