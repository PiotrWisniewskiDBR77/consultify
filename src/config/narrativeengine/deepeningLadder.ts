/**
 * Narrative Engine — deepening ladder (drabinka pogłębiająca)
 *
 * Sibling of src/config/ansoff/deepeningLadder.ts. Where Ansoff walks each
 * growth quadrant down a depth staircase, the Narrative Engine walks each
 * message pillar down the SAME four-rung ladder, because a pillar that
 * "resonates high" is worthless unless the consultant can say WHAT proves the
 * claim and WHAT objection it must survive:
 *
 *   1. surface          — what claim does this pillar make and for whom?
 *   2. evidence         — the proof points that make the claim believable, not just bold
 *   3. quantification   — how strongly it lands (resonance) vs the effort to make it land
 *   4. risk-capability  — the objection it must survive and what you must be able to show
 *
 * The ladder is indexed by the store's `audienceResonance` band
 * (high / medium / low) so the config and the runtime speak the same
 * language. Content is partner-grade, bilingual (PL/EN), and consumed by the
 * NarrativeEngine input/pillars phases and by the synthesis engine.
 */

export type ResonanceBand = 'high' | 'medium' | 'low';

export const NARRATIVE_BANDS: ResonanceBand[] = ['high', 'medium', 'low'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and band-agnostic. */
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

/** The four canonical rungs shared by every band, with band-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const NARRATIVE_LADDER_RUNG_ORDER = RUNG_ORDER;

/**
 * Per-resonance-band deepening ladder. Each band has exactly 4 rungs in
 * RUNG_ORDER, so the synthesis engine can rely on a stable shape.
 */
export const NARRATIVE_DEEPENING_LADDER: Record<ResonanceBand, LadderRung[]> = {
  high: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaką jedną tezę stawia ten filar i do kogo dokładnie jest skierowana?',
        en: 'What single claim does this pillar make, and exactly whom is it aimed at?',
      },
      rationale: {
        pl: 'Silny filar zaczyna się od jednej ostrej tezy dla konkretnego odbiorcy — narracja bez adresata nie rezonuje z nikim.',
        en: 'A strong pillar starts from one sharp claim for a specific audience — a narrative with no addressee resonates with no one.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jakie konkretne proof points (dane, przykład, referencja) czynią tę tezę wiarygodną, a nie tylko odważną?',
        en: 'Which concrete proof points (data, example, reference) make this claim believable rather than merely bold?',
      },
      rationale: {
        pl: 'Teza bez dowodu to slogan; wysoki rezonans utrzymuje się tylko wtedy, gdy każdy filar niesie twardy proof point.',
        en: 'A claim without proof is a slogan; high resonance holds only when each pillar carries a hard proof point.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak mocno ta teza trafia w odbiorcę i ile kosztuje dowiezienie jej tak, żeby została zapamiętana?',
        en: 'How strongly does this claim land with the audience, and what does it cost to deliver it memorably?',
      },
      rationale: {
        pl: 'Rezonans to nie efekt uboczny — to stosunek siły trafienia do wysiłku; najsilniejszy filar wygrywa tę arytmetykę.',
        en: 'Resonance is not a side effect — it is landing power over effort; the strongest pillar wins that arithmetic.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jaki jest najsilniejszy zarzut przeciw tej tezie i czym musicie dysponować, żeby go rozbroić na scenie?',
        en: 'What is the strongest objection to this claim, and what must you be able to show to defuse it live?',
      },
      rationale: {
        pl: 'Silny filar wyprzedza zarzut; narracja, która ignoruje kontrargument, pęka przy pierwszym trudnym pytaniu.',
        en: 'A strong pillar preempts the objection; a narrative that ignores the counter-argument cracks at the first hard question.',
      },
    },
  ],
  medium: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaką tezę stawia ten filar i dlaczego trafia tylko połowicznie — czy teza jest rozmyta, czy odbiorca źle nazwany?',
        en: 'What claim does this pillar make, and why does it only half-land — is the claim fuzzy or the audience mis-named?',
      },
      rationale: {
        pl: 'Średni rezonans zwykle znaczy rozmytą tezę albo złego adresata; najpierw zdiagnozujcie który z dwóch.',
        en: 'Medium resonance usually means a fuzzy claim or the wrong addressee; first diagnose which of the two.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jakiego proof pointa brakuje, żeby ta teza przeszła z „ciekawe" do „wierzę"?',
        en: 'Which proof point is missing to move this claim from "interesting" to "I believe it"?',
      },
      rationale: {
        pl: 'Filar o średnim rezonansie najczęściej ma tezę bez dowodu; jeden mocny proof point potrafi go podnieść.',
        en: 'A medium-resonance pillar most often has a claim without proof; one strong proof point can lift it.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Czy warto inwestować wysiłek w podniesienie tego filara, czy lepiej wpleść go jako wsparcie silniejszej tezy?',
        en: 'Is it worth the effort to lift this pillar, or better to weave it in as support for a stronger claim?',
      },
      rationale: {
        pl: 'Nie każdy filar musi być główny; policzcie, czy podniesienie rezonansu jest warte wysiłku, czy lepiej go podporządkować.',
        en: 'Not every pillar must be primary; compute whether lifting its resonance is worth the effort or better to subordinate it.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jaki zarzut osłabia ten filar i czy da się go przeramować, zamiast bronić w obecnej formie?',
        en: 'Which objection weakens this pillar, and can you reframe it rather than defend it as-is?',
      },
      rationale: {
        pl: 'Filar o średnim rezonansie często zyskuje więcej na przeramowaniu niż na obronie; nazwijcie zarzut i alternatywne ujęcie.',
        en: 'A medium-resonance pillar often gains more from a reframe than a defense; name the objection and an alternative framing.',
      },
    },
  ],
  low: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaką tezę stawia ten filar i dlaczego w ogóle jest w narracji — czy niesie coś, czego inne filary nie niosą?',
        en: 'What claim does this pillar make, and why is it in the narrative at all — does it carry anything the others do not?',
      },
      rationale: {
        pl: 'Filar o niskim rezonansie to kandydat do cięcia; najpierw sprawdźcie, czy w ogóle dokłada coś unikalnego do łuku.',
        en: 'A low-resonance pillar is a cut candidate; first check whether it adds anything unique to the arc at all.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy brak rezonansu wynika z braku dowodu, czy z tego, że odbiorcy to po prostu nie obchodzi?',
        en: 'Is the lack of resonance from missing proof, or because the audience simply does not care?',
      },
      rationale: {
        pl: 'Rozróżnijcie „nieudowodnione" od „nieistotne": pierwsze da się naprawić dowodem, drugie należy uciąć.',
        en: 'Distinguish "unproven" from "irrelevant": the first is fixable with proof, the second should be cut.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile uwagi odbiorcy zjada ten filar w stosunku do tego, ile wnosi — czy nie osłabia silniejszych tez?',
        en: 'How much audience attention does this pillar consume versus what it adds — does it weaken the stronger claims?',
      },
      rationale: {
        pl: 'Uwaga odbiorcy jest budżetem; słaby filar wydaje ją bez zwrotu i rozmywa punkt kulminacyjny narracji.',
        en: 'Audience attention is a budget; a weak pillar spends it without return and dilutes the narrative’s climax.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakie ryzyko bierzecie, tnąc ten filar, i jak zachować jego jedną wartościową myśl gdzie indziej?',
        en: 'What risk do you take by cutting this pillar, and how do you preserve its one worthwhile idea elsewhere?',
      },
      rationale: {
        pl: 'Cięcie filara jest zwykle słuszne, ale nazwijcie jedną myśl wartą ocalenia, żeby nie wylać dziecka z kąpielą.',
        en: 'Cutting a pillar is usually right, but name the one idea worth saving so you do not throw out the baby with the bathwater.',
      },
    },
  ],
};

export interface PillarProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per resonance band. Consumed when AI (or the
 * offline fallback) proposes candidate narrative moves. Mirrors Ansoff's
 * PROPOSAL_BANK.
 */
export const NARRATIVE_PROPOSAL_BANK: Record<ResonanceBand, PillarProposal[]> = {
  high: [
    {
      rung: 'surface',
      title: {
        pl: 'Otworzyć narrację najsilniejszym filarem',
        en: 'Open the narrative with the strongest pillar',
      },
      explanation: {
        pl: 'Odbiorca decyduje w pierwszych 30 sekundach; postawcie filar o najwyższym rezonansie na początku, żeby kupić sobie uwagę na resztę.',
        en: 'The audience decides in the first 30 seconds; lead with the highest-resonance pillar to buy attention for the rest.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Dowieść tezy jednym niepodważalnym proof pointem',
        en: 'Prove the claim with one undeniable proof point',
      },
      explanation: {
        pl: 'Silny filar niesie jeden twardy dowód (liczba, przykład, referencja), który zamyka wątpliwość, zamiast trzech miękkich, które ją otwierają.',
        en: 'A strong pillar carries one hard proof (number, example, reference) that closes the doubt, not three soft ones that open it.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zbudować kulminację wokół filara o najwyższym rezonansie',
        en: 'Build the climax around the highest-resonance pillar',
      },
      explanation: {
        pl: 'Łuk narracji powinien piąć się do najmocniejszej tezy; to ona zostaje w głowie, gdy reszta wyparuje.',
        en: 'The narrative arc should climb to the strongest claim; that is the one that stays in the head when the rest evaporates.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wyprzedzić najsilniejszy zarzut, zanim padnie',
        en: 'Preempt the strongest objection before it is raised',
      },
      explanation: {
        pl: 'Najlepszy filar sam nazywa kontrargument i go rozbraja; to buduje wiarygodność mocniej niż udawanie, że zarzutu nie ma.',
        en: 'The best pillar names the counter-argument itself and defuses it; that builds credibility more than pretending the objection does not exist.',
      },
    },
  ],
  medium: [
    {
      rung: 'surface',
      title: {
        pl: 'Zaostrzyć rozmytą tezę do jednego zdania',
        en: 'Sharpen the fuzzy claim to a single sentence',
      },
      explanation: {
        pl: 'Średni rezonans często leczy się ostrością: jeśli filara nie da się powiedzieć jednym zdaniem, odbiorca go nie zapamięta.',
        en: 'Medium resonance often heals with sharpness: if a pillar cannot be said in one sentence, the audience will not remember it.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Dodać brakujący proof point, żeby podnieść wiarygodność',
        en: 'Add the missing proof point to lift believability',
      },
      explanation: {
        pl: 'Filar o średnim rezonansie zwykle ma tezę bez dowodu; jeden konkretny proof point przesuwa go z „ciekawe" do „wierzę".',
        en: 'A medium-resonance pillar usually has a claim without proof; one concrete proof point moves it from "interesting" to "I believe it".',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Podporządkować średni filar silniejszej tezie',
        en: 'Subordinate the medium pillar to a stronger claim',
      },
      explanation: {
        pl: 'Nie każdy filar musi być główny; wpleciony jako wsparcie mocniejszej tezy wnosi więcej niż walcząc o własną scenę.',
        en: 'Not every pillar must be primary; woven in as support for a stronger claim it contributes more than fighting for its own stage.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przeramować filar zamiast bronić go w obecnej formie',
        en: 'Reframe the pillar instead of defending it as-is',
      },
      explanation: {
        pl: 'Gdy zarzut osłabia filar, przeramowanie (inne ujęcie tej samej wartości) często zyskuje więcej niż obrona pierwotnego sformułowania.',
        en: 'When an objection weakens a pillar, a reframe (a different framing of the same value) often gains more than defending the original wording.',
      },
    },
  ],
  low: [
    {
      rung: 'surface',
      title: {
        pl: 'Uciąć filar, który nie dokłada nic unikalnego do łuku',
        en: 'Cut the pillar that adds nothing unique to the arc',
      },
      explanation: {
        pl: 'Jeśli filar powtarza to, co niesie silniejsza teza, jego cięcie wzmacnia narrację przez skupienie uwagi tam, gdzie trafia.',
        en: 'If a pillar repeats what a stronger claim already carries, cutting it strengthens the narrative by focusing attention where it lands.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Uciąć tezę, która odbiorcy po prostu nie obchodzi',
        en: 'Cut the claim the audience simply does not care about',
      },
      explanation: {
        pl: 'Brak rezonansu z powodu nieistotności nie da się naprawić dowodem; taki filar zabiera uwagę bez zwrotu i należy go usunąć.',
        en: 'A lack of resonance from irrelevance cannot be fixed with proof; such a pillar takes attention without return and should be removed.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Odzyskać uwagę odbiorcy dla punktu kulminacyjnego',
        en: 'Reclaim audience attention for the climax',
      },
      explanation: {
        pl: 'Uwaga jest budżetem; usunięcie słabego filara przekierowuje ją na tezę, która ma naprawdę zostać w głowie.',
        en: 'Attention is a budget; removing a weak pillar redirects it to the claim that is meant to truly stay in the head.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ocalić jedną wartościową myśl słabego filara gdzie indziej',
        en: 'Preserve the one worthwhile idea from the weak pillar elsewhere',
      },
      explanation: {
        pl: 'Nawet słaby filar może mieć jedną wartą ocalenia myśl; wplećcie ją jako proof point silniejszej tezy, zanim utniecie resztę.',
        en: 'Even a weak pillar may hold one idea worth saving; weave it in as a proof point for a stronger claim before cutting the rest.',
      },
    },
  ],
};
