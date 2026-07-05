/**
 * SOP Builder — deepening ladder (drabinka pogłębiająca)
 *
 * Clones the Ansoff `deepeningLadder` pattern (src/config/ansoff/deepeningLadder.ts)
 * but encodes the SOP-specific "insight staircase": each authoring section of an
 * SOP (standards → checklists) is deepened along the same four rungs, so the
 * synthesis engine can judge whether a standard is real or aspirational:
 *
 *   1. surface          — what is the standard / step, stated plainly?
 *   2. evidence         — is it observed in practice or only written down?
 *   3. quantification   — is it measurable (threshold, target, time)?
 *   4. risk-capability  — who verifies it and what fails if it slips?
 *
 * The rungs form the "insight staircase — skąd wniosek": an SOP is only signable
 * when each standard is measurable, verified, owned, and its failure mode named.
 * Content is partner-grade and bilingual (PL/EN).
 */

/** The SOP authoring sections that carry a deepening ladder (context/summary excluded). */
export type SopSectionId = 'standards' | 'checklists';

export const SOP_SECTIONS: SopSectionId[] = ['standards', 'checklists'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and section-agnostic. */
export interface LadderRung {
  id: 'surface' | 'evidence' | 'quantification' | 'risk-capability';
  /** 1-4 depth level (surface..risk) — used by the synthesis engine for depth scoring. */
  depth: 1 | 2 | 3 | 4;
  label: Bilingual;
  /** The prompt shown to the user / fed to AI when deepening this rung. */
  question: Bilingual;
  /** Why this rung matters — the consultant framing (standard discipline). */
  rationale: Bilingual;
}

/** The four canonical rungs shared by every section, with section-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const SOP_LADDER_RUNG_ORDER = RUNG_ORDER;

/**
 * Per-section deepening ladder. Each section has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const SOP_DEEPENING_LADDER: Record<SopSectionId, LadderRung[]> = {
  standards: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaki jest ten standard w jednym zdaniu — co dokładnie jest „dobrze zrobione", a co nie?',
        en: 'What is this standard in one sentence — what exactly counts as "done right", and what does not?',
      },
      rationale: {
        pl: 'Standard, którego nie da się jednoznacznie ocenić, nie jest standardem, tylko intencją. Najpierw nazwijcie granicę zgodności.',
        en: 'A standard you cannot judge unambiguously is not a standard, it is an intention. First name the compliance boundary.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy ten standard jest realnie przestrzegany dziś, czy tylko zapisany — jaki jest dowód z praktyki?',
        en: 'Is this standard actually followed today, or only written down — what is the evidence from practice?',
      },
      rationale: {
        pl: 'SOP odklejony od praktyki tworzy fikcję zgodności. Dowód z gemba oddziela żywy standard od martwego dokumentu.',
        en: 'An SOP detached from practice creates a fiction of compliance. Gemba evidence separates a live standard from a dead document.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Czy standard ma mierzalny próg (czas, tolerancja, częstotliwość), czy jest oceniany „na oko"?',
        en: 'Does the standard have a measurable threshold (time, tolerance, frequency), or is it judged "by eye"?',
      },
      rationale: {
        pl: 'Bez mierzalnego progu dwie osoby ocenią ten sam wynik inaczej — standard bez liczby nie skaluje się na zespół.',
        en: 'Without a measurable threshold two people judge the same output differently — a standard without a number does not scale across a team.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Kto jest właścicielem standardu, kto go weryfikuje i co się psuje, gdy zostanie naruszony?',
        en: 'Who owns the standard, who verifies it, and what breaks when it is violated?',
      },
      rationale: {
        pl: 'Standard bez właściciela i konsekwencji naruszenia degraduje się w kwartał — nazwijcie właściciela i tryb kontroli.',
        en: 'A standard with no owner and no consequence of breach decays within a quarter — name the owner and the control cadence.',
      },
    },
  ],
  checklists: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaki krok checklisty to jest i który standard on egzekwuje — czy to weryfikacja, czy tylko czynność?',
        en: 'What checklist step is this and which standard does it enforce — is it a verification or just an action?',
      },
      rationale: {
        pl: 'Checklista to nie lista czynności, tylko lista weryfikacji. Krok, który niczego nie sprawdza, jest szumem.',
        en: 'A checklist is not a list of actions but a list of verifications. A step that verifies nothing is noise.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy ten punkt wychwytuje realny błąd, który się zdarzał — jaki jest dowód, że to nie jest zbędny krok?',
        en: 'Does this item catch a real error that has happened — what proves it is not a redundant step?',
      },
      rationale: {
        pl: 'Checklisty puchną od punktów „na wszelki wypadek", aż ludzie przestają je czytać. Każdy punkt musi bronić się historią błędu.',
        en: 'Checklists bloat with "just in case" items until people stop reading them. Each item must earn its place with an error history.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Czy punkt daje jednoznaczny wynik pass/fail z mierzalnym kryterium, a nie ocenę uznaniową?',
        en: 'Does the item yield an unambiguous pass/fail with a measurable criterion, not a discretionary judgment?',
      },
      rationale: {
        pl: 'Punkt bez binarnego kryterium przepuszcza błąd, bo „chyba jest ok". Mierzalny próg zamyka tę furtkę.',
        en: 'An item without a binary criterion lets errors through because "it seems fine". A measurable threshold closes that gap.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jak dowodzicie, że checklistę wykonano (podpis, log, poka-yoke), i co grozi, gdy krok się pominie?',
        en: 'How do you prove the checklist was run (sign-off, log, poka-yoke), and what is the risk if a step is skipped?',
      },
      rationale: {
        pl: 'Checklista bez śladu wykonania jest niewidoczna dla audytu; punkt o wysokim ryzyku warto zabezpieczyć poka-yoke, nie dyscypliną.',
        en: 'A checklist with no completion trace is invisible to audit; a high-risk item is better secured by poka-yoke than by discipline.',
      },
    },
  ],
};

export interface SectionProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per section. Consumed when AI (or the offline
 * fallback) proposes candidate SOP items. Mirrors Ansoff's ANSOFF_PROPOSAL_BANK.
 */
export const SOP_PROPOSAL_BANK: Record<SopSectionId, SectionProposal[]> = {
  standards: [
    {
      rung: 'surface',
      title: {
        pl: 'Zapisać standard jako granicę pass/fail, nie jako zasadę',
        en: 'Write the standard as a pass/fail boundary, not a principle',
      },
      explanation: {
        pl: 'Zamiast „dbaj o jakość" napiszcie granicę: „szew ≤ 2 mm odchylenia" — coś, co dwie osoby ocenią tak samo bez dyskusji.',
        en: 'Instead of "care about quality" write a boundary: "seam within 2 mm tolerance" — something two people grade the same without debate.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Wywieść standard z realnej praktyki, nie z życzenia',
        en: 'Derive the standard from real practice, not a wish',
      },
      explanation: {
        pl: 'Standard, którego nikt dziś nie dotrzymuje, to plan zmiany, nie SOP; oprzyjcie go na najlepszym powtarzalnym wykonaniu, jakie widać na gemba.',
        en: 'A standard nobody meets today is a change plan, not an SOP; base it on the best repeatable performance you can observe at the gemba.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Nadać standardowi mierzalny próg',
        en: 'Give the standard a measurable threshold',
      },
      explanation: {
        pl: 'Czas, tolerancja lub częstotliwość zamieniają ocenę uznaniową w powtarzalny test — bez tego standard nie skaluje się na nową obsadę.',
        en: 'A time, tolerance, or frequency turns a discretionary judgment into a repeatable test — without it the standard will not scale to new staff.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przypisać właściciela i tryb kontroli standardu',
        en: 'Assign an owner and a control cadence to the standard',
      },
      explanation: {
        pl: 'Standard bez właściciela i rytmu audytu degraduje się cicho; nazwijcie kto go pilnuje i jak często sprawdza zgodność.',
        en: 'A standard with no owner and no audit rhythm decays silently; name who guards it and how often compliance is checked.',
      },
    },
  ],
  checklists: [
    {
      rung: 'surface',
      title: {
        pl: 'Zamienić czynności w punkty weryfikacji',
        en: 'Turn actions into verification points',
      },
      explanation: {
        pl: 'Dobra checklista sprawdza wynik („czy zawór zamknięty?"), nie zleca czynność („zamknij zawór") — weryfikacja łapie błąd, czynność go zakłada.',
        en: 'A good checklist verifies an outcome ("is the valve closed?"), not commands an action ("close the valve") — verification catches the error, an action assumes it.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Uzasadnić każdy punkt historią realnego błędu',
        en: 'Justify each item with a real error history',
      },
      explanation: {
        pl: 'Punkty „na wszelki wypadek" rozdymają checklistę, aż przestaje być czytana; zostawcie tylko te, które broni udokumentowany defekt.',
        en: 'Just-in-case items bloat the checklist until it stops being read; keep only those a documented defect defends.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Nadać punktom binarne kryterium pass/fail',
        en: 'Give items a binary pass/fail criterion',
      },
      explanation: {
        pl: 'Punkt z mierzalnym progiem („temperatura 60–65°C") zamyka furtkę „chyba jest ok"; ocena uznaniowa przepuszcza błąd pod presją czasu.',
        en: 'An item with a measurable threshold ("temperature 60–65°C") closes the "seems fine" loophole; a discretionary judgment lets errors through under time pressure.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zabezpieczyć krytyczny krok przez poka-yoke, nie dyscyplinę',
        en: 'Secure the critical step with poka-yoke, not discipline',
      },
      explanation: {
        pl: 'Dla kroku o wysokim ryzyku pominięcia zaprojektujcie fizyczne/logiczne zabezpieczenie, które uniemożliwia błąd — pewniejsze niż poleganie na uwadze.',
        en: 'For a step with high skip risk, design a physical/logical guard that makes the error impossible — more reliable than relying on attention.',
      },
    },
  ],
};
