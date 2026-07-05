/**
 * RPA Scanner — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the SMED / Ansoff `deepeningLadder` + `PROPOSAL_BANK` pattern
 * (see src/config/smedplanner/deepeningLadder.ts). Encodes the RPA/automation
 * feasibility "depth staircase" per gate of the assessment:
 *
 *   1. surface          — what process is a candidate for automation?
 *   2. evidence         — is it rule-based and stable, or judgement-heavy?
 *   3. quantification   — what is the ROI: volume × handling time × error rate?
 *   4. risk-capability  — can it be built and maintained without new fragility?
 *
 * The four canonical gates mirror how a partner triages an automation backlog
 * from "someone wants a bot" to "here is a defensible, high-ROI candidate":
 *   - identify       : surface every manual, repetitive, rule-following process
 *   - standardize    : test whether the process is stable and rule-based enough
 *   - quantify       : compute the ROI from volume, handling time and error cost
 *   - feasibility    : judge technical build + maintenance + exception risk
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the RPA Scanner
 * input/analysis phases and by the synthesis engine (feasibilityEngine.ts).
 */

export type RpaGateId = 'identify' | 'standardize' | 'quantify' | 'feasibility';

export const RPA_GATES: RpaGateId[] = ['identify', 'standardize', 'quantify', 'feasibility'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and gate-agnostic. */
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

/** The four canonical rungs shared by every gate, with gate-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const RPA_LADDER_RUNG_ORDER = RUNG_ORDER;

const RPA_GATE_LABEL: Record<RpaGateId, Bilingual> = {
  identify: { pl: 'Zidentyfikuj', en: 'Identify' },
  standardize: { pl: 'Ustandaryzuj', en: 'Standardize' },
  quantify: { pl: 'Skwantyfikuj', en: 'Quantify' },
  feasibility: { pl: 'Oceń wykonalność', en: 'Feasibility' },
};

export const rpaGateLabel = (gate: RpaGateId): Bilingual => RPA_GATE_LABEL[gate];

/**
 * Per-gate deepening ladder. Each gate has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const RPA_DEEPENING_LADDER: Record<RpaGateId, LadderRung[]> = {
  identify: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które procesy są dziś wykonywane ręcznie, powtarzalnie i według reguł — kto je robi i jak często?',
        en: 'Which processes are done manually, repetitively and by the rules today — who does them and how often?',
      },
      rationale: {
        pl: 'RPA opłaca się tam, gdzie człowiek wykonuje ustrukturyzowaną pracę wg reguł; identyfikacja zaczyna się od nazwania takiego procesu, nie od wyboru narzędzia.',
        en: 'RPA pays off where a human follows structured, rule-based work; identification starts by naming such a process, not by picking a tool.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiadomo, że proces jest powtarzalny — z logu systemu i obserwacji, czy z „wydaje się, że tak"?',
        en: 'How do you know the process is repetitive — from a system log and observation, or from "it seems so"?',
      },
      rationale: {
        pl: 'Kandydat na automatyzację bez dowodu na powtarzalność bywa pracą pozornie rutynową, w której ukryta jest ciągła decyzja człowieka.',
        en: 'An automation candidate without evidence of repetition is often seemingly-routine work that hides a constant human decision.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest wolumen tego procesu (transakcji / miesiąc) i ile osób go dziś obsługuje?',
        en: 'What is the volume of this process (transactions / month) and how many people handle it today?',
      },
      rationale: {
        pl: 'Wolumen × liczba obsługujących to pierwszy filtr: proces o niskim wolumenie rzadko zwróci koszt budowy i utrzymania bota.',
        en: 'Volume × handlers is the first filter: a low-volume process rarely returns the cost of building and maintaining a bot.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy proces jest stabilny, czy zmienia się co kwartał — i czy warto go automatyzować, zanim się ustabilizuje?',
        en: 'Is the process stable, or does it change every quarter — and is it worth automating before it settles?',
      },
      rationale: {
        pl: 'Automatyzacja niestabilnego procesu utrwala zmienny cel; identyfikacja musi odsiać procesy, które najpierw trzeba ustandaryzować.',
        en: 'Automating an unstable process locks a moving target; identification must screen out processes that need standardizing first.',
      },
    },
  ],
  standardize: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy proces ma jedną, spisaną ścieżkę, czy każdy operator robi go trochę inaczej?',
        en: 'Does the process have one written path, or does each operator do it a little differently?',
      },
      rationale: {
        pl: 'Bot odwzorowuje regułę, nie intuicję; bez jednej ustandaryzowanej ścieżki automatyzujecie wariant jednej osoby, a nie proces.',
        en: 'A bot replays a rule, not intuition; without one standardized path you automate one person\'s variant, not the process.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki odsetek przypadków obsługuje reguła, a jaki wymaga wyjątku i decyzji człowieka?',
        en: 'What share of cases the rule handles, versus the share needing an exception and human judgement?',
      },
      rationale: {
        pl: 'Proces w 70% regułowy i w 30% wyjątkowy to nie kandydat na pełną automatyzację — udział wyjątków decyduje o granicy bota.',
        en: 'A process 70% rule-based and 30% exception is not a full-automation candidate — the exception share sets the bot\'s boundary.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile ustandaryzowanych kroków ma proces i ile z nich dotyka systemów ze stabilnym interfejsem?',
        en: 'How many standardized steps does the process have, and how many touch systems with a stable interface?',
      },
      rationale: {
        pl: 'Liczba kroków i stabilność interfejsów to koszt budowy i kruchość bota — więcej niestabilnych ekranów to więcej awarii po zmianie systemu.',
        en: 'Step count and interface stability drive build cost and bot brittleness — more unstable screens means more breakage after a system change.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy proces da się uprościć lub ujednolicić przed automatyzacją, zamiast utrwalać botem jego obecną złożoność?',
        en: 'Can the process be simplified or unified before automation, rather than locking its current complexity into a bot?',
      },
      rationale: {
        pl: 'Automatyzacja złego procesu daje szybszy zły proces; standaryzacja przed botem jest tańsza niż przebudowa bota po fakcie.',
        en: 'Automating a bad process yields a faster bad process; standardizing before the bot is cheaper than rebuilding the bot afterwards.',
      },
    },
  ],
  quantify: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Ile minut zajmuje jedno wykonanie procesu ręcznie i jaki jest jego miesięczny wolumen?',
        en: 'How many minutes does one manual run of the process take, and what is its monthly volume?',
      },
      rationale: {
        pl: 'Czas obsługi × wolumen to surowy potencjał godzin do odzyskania — fundament każdej kalkulacji zwrotu z automatyzacji.',
        en: 'Handling time × volume is the raw pool of hours to recover — the foundation of every automation ROI calculation.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy te liczby są z systemu (log, raport), czy z pamięci zespołu — i jaki jest realny odsetek błędów?',
        en: 'Are these numbers from the system (a log, a report) or from team memory — and what is the real error rate?',
      },
      rationale: {
        pl: 'Zawyżony czas obsługi zawyża zwrot i uzasadnia bota, który się nie zwróci; status dowodu decyduje, czy business case przejdzie.',
        en: 'An inflated handling time inflates the return and justifies a bot that will not pay back; the evidence status decides whether the business case holds.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest roczny zwrot: odzyskane godziny + koszt błędów uniknięty, minus koszt budowy i utrzymania bota?',
        en: 'What is the annual return: hours recovered + error cost avoided, minus the bot\'s build and maintenance cost?',
      },
      rationale: {
        pl: 'Netto zwrot, nie same odzyskane godziny, decyduje o kolejności; bot o wysokim wolumenie, ale drogim utrzymaniu, potrafi mieć ujemny zwrot.',
        en: 'Net return, not recovered hours alone, sets the order; a high-volume bot with costly maintenance can still return negative.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy poza godzinami automatyzacja niesie ryzyko jakości, zgodności lub audytu, którego nie widać w kalkulacji ROI?',
        en: 'Beyond hours, does automation carry a quality, compliance or audit risk invisible in the ROI calculation?',
      },
      rationale: {
        pl: 'Bot podejmujący decyzje regulowane bez śladu audytowego zamienia oszczędność czasu w ryzyko kary — nazwijcie je obok ROI, nie zamiast niego.',
        en: 'A bot making regulated decisions without an audit trail turns a time saving into a penalty risk — name it alongside ROI, not instead of it.',
      },
    },
  ],
  feasibility: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jakiej technologii wymaga automatyzacja tego procesu — proste RPA, OCR, integracja API, czy model AI?',
        en: 'What technology does automating this process require — plain RPA, OCR, an API integration, or an AI model?',
      },
      rationale: {
        pl: 'Poziom technologii determinuje koszt, czas i ryzyko; proste RPA na stabilnym ekranie to inny projekt niż bot z modelem decyzyjnym.',
        en: 'The technology level determines cost, time and risk; plain RPA on a stable screen is a different project than a decision-model bot.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy istnieje dowód wykonalności — proof of concept, podobny bot w firmie, czy tylko przekonanie dostawcy?',
        en: 'Is there feasibility evidence — a proof of concept, a similar bot in-house, or just the vendor\'s conviction?',
      },
      rationale: {
        pl: 'Wykonalność zakładana bez PoC to najczęstszy powód, dla którego program RPA przepala budżet na botach, które nie ruszają na produkcji.',
        en: 'Feasibility assumed without a PoC is the most common reason an RPA program burns budget on bots that never go live.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kosztuje utrzymanie bota rocznie (zmiany systemów, wyjątki, nadzór) względem jednorazowego kosztu budowy?',
        en: 'What is the bot\'s annual maintenance cost (system changes, exceptions, oversight) relative to the one-off build cost?',
      },
      rationale: {
        pl: 'Bot to nie jednorazowy koszt, lecz zobowiązanie utrzymaniowe; kruchy bot na niestabilnym systemie zjada zwrot w kolejnych kwartałach.',
        en: 'A bot is not a one-off cost but a maintenance liability; a brittle bot on an unstable system eats the return in later quarters.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy macie zdolność utrzymania bota (zespół, nadzór, obsługa wyjątków), czy tworzycie zależność od dostawcy?',
        en: 'Do you have the capability to maintain the bot (a team, oversight, exception handling), or are you creating vendor lock-in?',
      },
      rationale: {
        pl: 'Automatyzacja bez zdolności utrzymania przenosi ryzyko z operatora na dostawcę i na kruchość — nazwij lukę zdolności, zanim ją zbudujesz.',
        en: 'Automation without maintenance capability shifts risk from the operator onto the vendor and onto brittleness — name the capability gap before you build.',
      },
    },
  ],
};

export interface GateProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per gate. Consumed when AI (or the offline
 * fallback) proposes candidate automation assessments. Mirrors SMED's PROPOSAL_BANK.
 */
export const RPA_PROPOSAL_BANK: Record<RpaGateId, GateProposal[]> = {
  identify: [
    {
      rung: 'surface',
      title: {
        pl: 'Zebrać procesy „swivel-chair" między systemami',
        en: 'Capture "swivel-chair" processes between systems',
      },
      explanation: {
        pl: 'Zacznijcie od procesów, w których człowiek przepisuje dane z jednego systemu do drugiego — to najczystszy, najłatwiejszy do obrony kandydat na RPA.',
        en: 'Start with processes where a human re-keys data from one system into another — the cleanest, most defensible RPA candidate.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Potwierdzić powtarzalność logiem, nie odczuciem',
        en: 'Confirm repetition with a log, not a feeling',
      },
      explanation: {
        pl: 'Dla każdego kandydata sprawdźcie w logu systemu, ile razy proces wykonano — powtarzalność deklarowana bywa pracą z ukrytą ciągłą decyzją człowieka.',
        en: 'For each candidate check the system log for how many times the process ran — declared repetition often hides constant human judgement.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Odfiltrować kandydatów o niskim wolumenie',
        en: 'Filter out low-volume candidates',
      },
      explanation: {
        pl: 'Oznaczcie wolumen każdego procesu; proces uruchamiany kilka razy w miesiącu rzadko zwróci koszt budowy i utrzymania bota, mimo że irytuje.',
        en: 'Tag each process with its volume; a process run a few times a month rarely returns the bot\'s build and maintenance cost, however annoying.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Odłożyć procesy niestabilne do standaryzacji',
        en: 'Defer unstable processes to standardization',
      },
      explanation: {
        pl: 'Procesy zmieniające się co kwartał zaznaczcie do ustandaryzowania przed automatyzacją — bot na ruchomym celu psuje się szybciej, niż zwraca.',
        en: 'Flag processes that change every quarter for standardizing before automation — a bot on a moving target breaks faster than it pays back.',
      },
    },
  ],
  standardize: [
    {
      rung: 'surface',
      title: {
        pl: 'Spisać jedną najlepszą ścieżkę procesu',
        en: 'Write the one best process path',
      },
      explanation: {
        pl: 'Zanim zbudujecie bota, spiszcie jedną ustandaryzowaną ścieżkę — bez niej automatyzujecie wariant jednego operatora zamiast procesu firmy.',
        en: 'Before building a bot, write one standardized path — without it you automate one operator\'s variant instead of the firm\'s process.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć udział wyjątków w przypadkach',
        en: 'Measure the exception share of cases',
      },
      explanation: {
        pl: 'Policzcie, ile procent przypadków wymaga decyzji człowieka — udział wyjątków wyznacza granicę bota i chroni przed obietnicą „100% automatyzacji".',
        en: 'Compute the share of cases needing human judgement — the exception share sets the bot\'s boundary and guards against a "100% automation" promise.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zmapować kroki dotykające niestabilnych ekranów',
        en: 'Map steps that touch unstable screens',
      },
      explanation: {
        pl: 'Oznaczcie kroki oparte o interfejsy zmieniające się przy aktualizacjach — to źródło przyszłej kruchości bota, którą lepiej wycenić przed budową.',
        en: 'Flag steps built on interfaces that shift on updates — the source of the bot\'s future brittleness, better priced before the build.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uprościć proces przed automatyzacją, nie po',
        en: 'Simplify the process before automation, not after',
      },
      explanation: {
        pl: 'Usuńcie zbędne kroki i wyjątki, zanim zbudujecie bota — automatyzacja złego procesu daje szybszy zły proces, a przeróbka bota jest droższa.',
        en: 'Remove redundant steps and exceptions before building the bot — automating a bad process yields a faster bad process, and reworking the bot costs more.',
      },
    },
  ],
  quantify: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmierzyć czas obsługi jednego wykonania',
        en: 'Measure the handling time of one run',
      },
      explanation: {
        pl: 'Obserwujcie jedno realne wykonanie i zmierzcie minuty — czas obsługi × wolumen to surowy potencjał godzin, którego szacunek z pamięci nie zastąpi.',
        en: 'Observe one real run and measure the minutes — handling time × volume is the raw pool of hours a memory estimate cannot replace.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Pobrać wolumen i błędy z systemu, nie z pamięci',
        en: 'Pull volume and errors from the system, not memory',
      },
      explanation: {
        pl: 'Business case oparty na zawyżonym czasie obsługi uzasadnia bota, który się nie zwróci — liczby z logu chronią budżet przed optymizmem.',
        en: 'A business case built on an inflated handling time justifies a bot that will not pay back — log-sourced numbers protect the budget from optimism.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć zwrot netto, nie same odzyskane godziny',
        en: 'Compute net return, not recovered hours alone',
      },
      explanation: {
        pl: 'Odejmijcie koszt budowy i rocznego utrzymania od odzyskanych godzin i uniknionych błędów — dopiero zwrot netto porządkuje kandydatów wg opłacalności.',
        en: 'Subtract build and annual maintenance from recovered hours and avoided errors — only net return ranks candidates by payoff.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wycenić ryzyko zgodności obok ROI',
        en: 'Price the compliance risk alongside ROI',
      },
      explanation: {
        pl: 'Dla procesów regulowanych nazwijcie ryzyko braku śladu audytowego — bot bez logu decyzji zamienia oszczędność w potencjalną karę.',
        en: 'For regulated processes name the missing-audit-trail risk — a bot with no decision log turns the saving into a potential penalty.',
      },
    },
  ],
  feasibility: [
    {
      rung: 'surface',
      title: {
        pl: 'Sklasyfikować wymaganą technologię automatyzacji',
        en: 'Classify the required automation technology',
      },
      explanation: {
        pl: 'Rozróżnijcie proste RPA, OCR, integrację API i model AI — poziom technologii determinuje koszt, czas i ryzyko, zanim wybierzecie kandydata do budowy.',
        en: 'Distinguish plain RPA, OCR, API integration and an AI model — the technology level sets cost, time and risk before you pick a build candidate.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zwalidować wykonalność proof of concept',
        en: 'Validate feasibility with a proof of concept',
      },
      explanation: {
        pl: 'Zanim zatwierdzicie budżet, uruchomcie mały PoC na jednym wariancie — wykonalność zakładana bez dowodu to najczęstsza przyczyna botów, które nie ruszają.',
        en: 'Before approving budget, run a small PoC on one variant — feasibility assumed without proof is the top reason bots never go live.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Oszacować koszt utrzymania względem budowy',
        en: 'Estimate maintenance cost relative to build',
      },
      explanation: {
        pl: 'Policzcie roczny koszt utrzymania (zmiany systemów, wyjątki, nadzór) — kruchy bot potrafi kosztować rocznie tyle, ile jego budowa, kasując zwrot.',
        en: 'Compute the annual maintenance cost (system changes, exceptions, oversight) — a brittle bot can cost as much per year as its build, erasing the return.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Nazwać brakującą zdolność utrzymania bota',
        en: 'Name the missing bot-maintenance capability',
      },
      explanation: {
        pl: 'Wskażcie zespół, nadzór i obsługę wyjątków, których brak zamieni bota w zależność od dostawcy — bez tej zdolności automatyzacja przenosi ryzyko, nie usuwa go.',
        en: 'Point at the team, oversight and exception handling whose absence would turn the bot into vendor lock-in — without this capability automation shifts risk rather than removing it.',
      },
    },
  ],
};
