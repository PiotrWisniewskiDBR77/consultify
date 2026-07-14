/**
 * Narrative Engine — pyramid question bank (OXFORD O3).
 *
 * Doctrine: docs/standards/CONCLUSION_LAYER_STANDARD.md (K1-K4, answer-first / piramida Minto) +
 * classic McKinsey SCQA (Situation-Complication-Question-Answer) + Minto Pyramid Principle (MECE).
 * Structural sibling of src/config/swot/dynamicSwotQuestionBank.ts — the SAME laddered-branching
 * contract, ported from "quadrant" to "category":
 *
 *   thesis   — sharpen the governing thought (teza główna) to one falsifiable, answer-first claim
 *   scqa     — situation -> complication -> question -> answer consistency chain
 *   pyramid  — decompose the governing thought into a MECE set of supporting arguments
 *   evidence — force proof per argument or the honest "declared, unconfirmed"
 *
 * Every function here is pure — the runtime, the AI prompts and the unit tests consume the SAME
 * bank, so a question asked by the mentor in chat and a question rendered in a future wizard step
 * are the same question (single source of truth).
 */

export type PyramidCategory = 'thesis' | 'scqa' | 'pyramid' | 'evidence';

export type PyramidQuestionLevel = 1 | 2 | 3 | 4;

export interface PyramidAnswerOption {
  /** Stable branch key — persisted with the answer, drives the next question. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (steers the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface PyramidQuestionNode {
  id: string;
  category: PyramidCategory;
  level: PyramidQuestionLevel;
  /** Why a partner asks this — surfaced to the AI, optionally as a UI tooltip. */
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: PyramidAnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for this path.
   * A missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// THESIS — sharpen the governing thought to one falsifiable, supported claim
// ---------------------------------------------------------------------------

const THESIS_QUESTIONS: PyramidQuestionNode[] = [
  {
    id: 'th1-surface',
    category: 'thesis',
    level: 1,
    intentEn: 'A topic label is not a governing thought — force an assertion.',
    intentPl: 'Etykieta tematu nie jest tezą główną — wymuś twierdzenie.',
    textEn:
      'State your governing thought as ONE sentence — the answer to the audience\'s real question. Is it a recommendation/assertion, or still a topic label ("Q3 results", "our approach to X")?',
    textPl:
      'Sformułuj tezę główną jako JEDNO zdanie — odpowiedź na realne pytanie odbiorcy. Czy to rekomendacja/twierdzenie, czy wciąż etykieta tematu ("wyniki Q3", "nasze podejście do X")?',
    probeEn: 'If a rival consultant read only this sentence, could they disagree with it?',
    probePl:
      'Gdyby konkurencyjny konsultant przeczytał tylko to zdanie, mógłby się z nim nie zgodzić?',
    answerOptions: [
      {
        key: 'assertion',
        labelEn: 'It is a claim someone could argue with',
        labelPl: 'To twierdzenie, z którym można polemizować',
        consultantSignalEn: 'Good — test whether it survives opposite facts next.',
        consultantSignalPl: 'Dobrze — przetestuj teraz, czy przetrwa przeciwne fakty.',
      },
      {
        key: 'topic-label',
        labelEn: 'It is still a topic/heading, nobody could disagree',
        labelPl: 'To wciąż temat/nagłówek, nikt nie mógłby się nie zgodzić',
        consultantSignalEn: 'Not a thesis yet — force a bet before moving on.',
        consultantSignalPl: 'To jeszcze nie teza — wymuś zakład, zanim pójdziesz dalej.',
      },
    ],
    branches: { assertion: 'th2-falsifiable', 'topic-label': 'th2-sharpen' },
    defaultNextId: 'th2-falsifiable',
  },
  {
    id: 'th2-sharpen',
    category: 'thesis',
    level: 2,
    intentEn: 'Force the bet a topic label avoids making.',
    intentPl: 'Wymusić zakład, którego unika etykieta tematu.',
    textEn:
      'A topic is not a thesis. If you had to bet your fee on being right or wrong, what SPECIFIC claim would you make about it?',
    textPl:
      'Temat to nie teza. Gdybyś musiał postawić honorarium na to, że masz rację lub nie — jakie KONKRETNE twierdzenie byś postawił?',
    probeEn: 'Say it starting with "We recommend..." or "The evidence shows...", not "About...".',
    probePl:
      'Powiedz to zaczynając od „Rekomendujemy…" albo „Dowody pokazują…", nie od „W kwestii…".',
    answerOptions: [
      {
        key: 'now-assertion',
        labelEn: 'Rewritten as a claim now',
        labelPl: 'Przepisane teraz jako twierdzenie',
        consultantSignalEn: 'Carry the rewritten sentence forward into support.',
        consultantSignalPl: 'Przenieś przepisane zdanie dalej, do dowodu wsparcia.',
      },
      {
        key: 'still-vague',
        labelEn: 'Still cannot commit to a specific claim',
        labelPl: 'Wciąż nie potrafię zadeklarować konkretnego twierdzenia',
        consultantSignalEn: 'Flag as unresolved — the pyramid engine will reject a filler thesis.',
        consultantSignalPl: 'Oznacz jako nierozstrzygnięte — silnik piramidy odrzuci pustą tezę.',
      },
    ],
    branches: { 'now-assertion': 'th3-support', 'still-vague': 'th3-support' },
    defaultNextId: 'th3-support',
  },
  {
    id: 'th2-falsifiable',
    category: 'thesis',
    level: 2,
    intentEn: 'A thesis that survives any data is not a thesis (CONCLUSION_LAYER R3).',
    intentPl: 'Teza, która przetrwa dowolne dane, nie jest tezą (CONCLUSION_LAYER R3).',
    textEn: 'If the underlying facts were the opposite, would this thesis read differently?',
    textPl: 'Gdyby leżące u podstaw fakty były przeciwne, czy ta teza brzmiałaby inaczej?',
    probeEn: '"The company has room to improve" passes with any data — that is the failure mode.',
    probePl: '„Firma ma pole do poprawy" przechodzi przy dowolnych danych — to jest ten błąd.',
    answerOptions: [
      {
        key: 'yes-falsifiable',
        labelEn: 'Yes — opposite facts would force a different sentence',
        labelPl: 'Tak — przeciwne fakty wymusiłyby inne zdanie',
        consultantSignalEn: 'Falsifiable thesis — move to naming its supporting arguments.',
        consultantSignalPl: 'Teza falsyfikowalna — przejdź do nazwania argumentów wsparcia.',
      },
      {
        key: 'no-generic',
        labelEn: 'No — it would read the same either way',
        labelPl: 'Nie — brzmiałaby tak samo niezależnie od danych',
        consultantSignalEn: 'Generic filler thesis — rewrite before building a pyramid under it.',
        consultantSignalPl: 'Pusta, ogólnikowa teza — przepisz, zanim zbudujesz pod nią piramidę.',
      },
    ],
    branches: { 'yes-falsifiable': 'th3-support', 'no-generic': 'th3-support' },
    defaultNextId: 'th3-support',
  },
  {
    id: 'th3-support',
    category: 'thesis',
    level: 3,
    intentEn: 'A thesis with no named arguments is an assertion, not a pyramid.',
    intentPl: 'Teza bez nazwanych argumentów to twierdzenie, nie piramida.',
    textEn:
      'Which 2-4 arguments, if all true, would fully justify this thesis to a skeptical partner?',
    textPl:
      'Które 2-4 argumenty, gdyby wszystkie były prawdziwe, w pełni uzasadniłyby tę tezę przed sceptycznym partnerem?',
    probeEn: 'Name them now, even roughly — the pyramid category will force them to be MECE.',
    probePl: 'Nazwij je teraz, choćby z grubsza — kategoria "piramida" wymusi ich MECE.',
    answerOptions: [
      {
        key: 'named-arguments',
        labelEn: 'Named 2-4 candidate arguments',
        labelPl: 'Nazwano 2-4 kandydujące argumenty',
        consultantSignalEn: 'Ready for the pyramid ladder — test them for MECE next.',
        consultantSignalPl: 'Gotowe na drabinkę piramidy — przetestuj je teraz pod MECE.',
      },
      {
        key: 'not-yet-named',
        labelEn: 'Have not counted or named them yet',
        labelPl: 'Jeszcze ich nie policzono ani nie nazwano',
        consultantSignalEn: 'Force the count before the ladder ends.',
        consultantSignalPl: 'Wymuś policzenie, zanim skończy się drabinka.',
      },
    ],
    branches: { 'named-arguments': null, 'not-yet-named': 'th4-count' },
    defaultNextId: 'th4-count',
  },
  {
    id: 'th4-count',
    category: 'thesis',
    level: 4,
    intentEn: 'Fewer than two supporting arguments cannot be MECE — it is a single opinion.',
    intentPl: 'Mniej niż dwa argumenty wsparcia nie mogą być MECE — to pojedyncza opinia.',
    textEn:
      'How many supporting arguments do you have right now? Fewer than two means you do not have a pyramid yet, just an assertion.',
    textPl:
      'Ile argumentów wsparcia masz teraz? Mniej niż dwa oznacza, że nie masz jeszcze piramidy, tylko twierdzenie.',
    answerOptions: [
      {
        key: 'zero-or-one',
        labelEn: 'Zero or one',
        labelPl: 'Zero lub jeden',
        consultantSignalEn: 'Block finalizing the thesis until a second argument exists.',
        consultantSignalPl: 'Zablokuj domknięcie tezy, dopóki nie powstanie drugi argument.',
      },
      {
        key: 'two-or-more',
        labelEn: 'Two or more',
        labelPl: 'Dwa lub więcej',
        consultantSignalEn: 'Enough branches for a MECE test — proceed to the pyramid category.',
        consultantSignalPl: 'Wystarczająco gałęzi na test MECE — przejdź do kategorii "piramida".',
      },
    ],
    branches: { 'zero-or-one': null, 'two-or-more': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// SCQA — Situation -> Complication -> Question -> Answer consistency chain
// ---------------------------------------------------------------------------

const SCQA_QUESTIONS: PyramidQuestionNode[] = [
  {
    id: 'sc1-situation',
    category: 'scqa',
    level: 1,
    intentEn: 'The Situation is the stable ground both sides already agree on.',
    intentPl: 'Sytuacja to stabilny grunt, na który obie strony już się zgadzają.',
    textEn:
      'What is the stable, undisputed fact both you and the audience already agree on before the story starts (Situation)?',
    textPl:
      'Jaki jest stabilny, bezsporny fakt, na który Ty i odbiorca już się zgadzacie, zanim zacznie się historia (Sytuacja)?',
    probeEn: 'If the audience would argue with this sentence, it is not a Situation yet.',
    probePl: 'Jeśli odbiorca polemizowałby z tym zdaniem, to jeszcze nie jest Sytuacja.',
    answerOptions: [
      {
        key: 'stable-agreed',
        labelEn: 'Stated and both sides would agree on it',
        labelPl: 'Sformułowane i obie strony by się zgodziły',
        consultantSignalEn: 'Solid ground — build the Complication on top of it.',
        consultantSignalPl: 'Solidny grunt — buduj na nim Komplikację.',
      },
      {
        key: 'still-contested',
        labelEn: 'Not sure the audience would agree',
        labelPl: 'Nie jestem pewien, czy odbiorca by się zgodził',
        consultantSignalEn: 'Simplify to the smallest fact nobody disputes before continuing.',
        consultantSignalPl:
          'Uprość do najmniejszego faktu, którego nikt nie kwestionuje, zanim ruszysz dalej.',
      },
    ],
    branches: { 'stable-agreed': 'sc2-complication', 'still-contested': 'sc2-complication' },
    defaultNextId: 'sc2-complication',
  },
  {
    id: 'sc2-complication',
    category: 'scqa',
    level: 2,
    intentEn: 'The Complication is what breaks the stable picture — it must add something new.',
    intentPl: 'Komplikacja to coś, co burzy stabilny obraz — musi wnosić coś nowego.',
    textEn:
      'What changed, or what tension breaks that stable picture (Complication) — and does it say something the Situation did not already say?',
    textPl:
      'Co się zmieniło albo jakie napięcie burzy ten stabilny obraz (Komplikacja) — i czy mówi coś, czego Sytuacja jeszcze nie powiedziała?',
    probeEn:
      'If you removed the Situation sentence, would the Complication still make sense alone?',
    probePl: 'Gdybyś usunął zdanie Sytuacji, czy Komplikacja miałaby sens sama?',
    answerOptions: [
      {
        key: 'distinct-tension',
        labelEn: 'Yes — it names a genuinely new tension',
        labelPl: 'Tak — nazywa naprawdę nowe napięcie',
        consultantSignalEn: 'Move to the Question this tension forces.',
        consultantSignalPl: 'Przejdź do Pytania, które to napięcie wymusza.',
      },
      {
        key: 'restates-situation',
        labelEn: 'It mostly restates the Situation in other words',
        labelPl: 'W większości powtarza Sytuację innymi słowami',
        consultantSignalEn:
          'Not a real Complication yet — the pyramid engine will flag the restatement.',
        consultantSignalPl:
          'To jeszcze nie prawdziwa Komplikacja — silnik piramidy oznaczy powtórzenie.',
      },
    ],
    branches: { 'distinct-tension': 'sc3-question', 'restates-situation': 'sc3-question' },
    defaultNextId: 'sc3-question',
  },
  {
    id: 'sc3-question',
    category: 'scqa',
    level: 3,
    intentEn: 'The Complication must force exactly one sharp question, not a vague theme.',
    intentPl: 'Komplikacja musi wymuszać dokładnie jedno ostre pytanie, nie mglisty temat.',
    textEn: 'What is the ONE question the Complication forces the audience to ask?',
    textPl: 'Jakie JEDNO pytanie Komplikacja wymusza u odbiorcy?',
    probeEn: 'If you can name three unrelated questions, the Complication is still too broad.',
    probePl:
      'Jeśli potrafisz nazwać trzy niepowiązane pytania, Komplikacja jest wciąż zbyt szeroka.',
    answerOptions: [
      {
        key: 'sharp-question',
        labelEn: 'One sharp question, answerable by the thesis',
        labelPl: 'Jedno ostre pytanie, na które odpowiada teza',
        consultantSignalEn: 'Check next whether the Answer actually answers THIS question.',
        consultantSignalPl: 'Sprawdź teraz, czy Odpowiedź faktycznie odpowiada NA TO pytanie.',
      },
      {
        key: 'no-clear-question',
        labelEn: 'No clear single question yet',
        labelPl: 'Jeszcze brak jednego jasnego pytania',
        consultantSignalEn: 'Narrow the Complication until one question falls out of it.',
        consultantSignalPl: 'Zawęź Komplikację, aż wypadnie z niej jedno pytanie.',
      },
    ],
    branches: { 'sharp-question': 'sc4-answer', 'no-clear-question': 'sc4-answer' },
    defaultNextId: 'sc4-answer',
  },
  {
    id: 'sc4-answer',
    category: 'scqa',
    level: 4,
    intentEn: 'A governing thought that answers a different, easier question is a dodge.',
    intentPl: 'Teza główna, która odpowiada na inne, łatwiejsze pytanie, to unik.',
    textEn:
      'Does your governing thought answer EXACTLY the question above — or a different, easier one?',
    textPl:
      'Czy Twoja teza główna odpowiada DOKŁADNIE na powyższe pytanie — czy na inne, łatwiejsze?',
    probeEn:
      'Read the question, then the thesis, back to back — does the second sentence resolve the first?',
    probePl:
      'Przeczytaj pytanie, a potem tezę, jedno po drugim — czy drugie zdanie rozstrzyga pierwsze?',
    answerOptions: [
      {
        key: 'answers-the-question',
        labelEn: 'Yes — it resolves exactly this question',
        labelPl: 'Tak — rozstrzyga dokładnie to pytanie',
        consultantSignalEn: 'SCQA chain closed — move to building the MECE pyramid under it.',
        consultantSignalPl: 'Łańcuch SCQA domknięty — przejdź do budowy piramidy MECE pod nim.',
      },
      {
        key: 'answers-different-question',
        labelEn: 'No — it answers something easier or adjacent',
        labelPl: 'Nie — odpowiada na coś łatwiejszego lub pobocznego',
        consultantSignalEn: 'Rewrite the Answer or the Question until they match.',
        consultantSignalPl: 'Przepisz Odpowiedź albo Pytanie, aż będą do siebie pasować.',
      },
    ],
    branches: { 'answers-the-question': null, 'answers-different-question': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// PYRAMID — decompose the governing thought into a MECE set of arguments
// ---------------------------------------------------------------------------

const PYRAMID_QUESTIONS: PyramidQuestionNode[] = [
  {
    id: 'py1-grouping',
    category: 'pyramid',
    level: 1,
    intentEn:
      'Minto: arguments are grouped either deductively or inductively — never both at once.',
    intentPl: 'Minto: argumenty grupuje się albo dedukcyjnie, albo indukcyjnie — nigdy naraz.',
    textEn:
      'Are your supporting arguments a DEDUCTIVE chain (A; and because A, then B; therefore C) or INDEPENDENT INDUCTIVE reasons that together add up to the same conclusion?',
    textPl:
      'Czy Twoje argumenty wsparcia to łańcuch DEDUKCYJNY (A; a ponieważ A, to B; zatem C), czy NIEZALEŻNE powody INDUKCYJNE, które razem składają się na tę samą konkluzję?',
    answerOptions: [
      {
        key: 'deductive',
        labelEn: 'A logical chain — each step depends on the one before',
        labelPl: 'Łańcuch logiczny — każdy krok zależy od poprzedniego',
        consultantSignalEn: 'Test whether removing the middle link breaks the chain.',
        consultantSignalPl: 'Sprawdź, czy usunięcie środkowego ogniwa łamie łańcuch.',
      },
      {
        key: 'inductive',
        labelEn: 'Independent reasons pointing at the same conclusion',
        labelPl: 'Niezależne powody wskazujące na tę samą konkluzję',
        consultantSignalEn: 'Test whether any two reasons secretly argue the same point twice.',
        consultantSignalPl:
          'Sprawdź, czy dwa powody nie argumentują potajemnie tego samego dwa razy.',
      },
    ],
    branches: { deductive: 'py2-deductive-chain', inductive: 'py2-inductive-mece' },
    defaultNextId: 'py2-inductive-mece',
  },
  {
    id: 'py2-deductive-chain',
    category: 'pyramid',
    level: 2,
    intentEn: 'A deductive chain must actually depend on its middle link, or it is not a chain.',
    intentPl:
      'Łańcuch dedukcyjny musi faktycznie zależeć od środkowego ogniwa, inaczej to nie łańcuch.',
    textEn:
      'If you removed the middle argument, would the logic still hold? If yes, you do not have a chain — you have independent (inductive) arguments mislabeled as one.',
    textPl:
      'Gdybyś usunął środkowy argument, czy logika by się utrzymała? Jeśli tak, to nie masz łańcucha — masz niezależne (indukcyjne) argumenty błędnie nazwane łańcuchem.',
    answerOptions: [
      {
        key: 'chain-breaks',
        labelEn: 'Removing it breaks the logic — real chain',
        labelPl: 'Usunięcie go łamie logikę — prawdziwy łańcuch',
        consultantSignalEn: 'Confirmed deductive chain — run the MECE gap check next.',
        consultantSignalPl: 'Potwierdzony łańcuch dedukcyjny — sprawdź teraz lukę MECE.',
      },
      {
        key: 'chain-survives',
        labelEn: 'The logic still holds without it',
        labelPl: 'Logika utrzymuje się bez niego',
        consultantSignalEn: 'Relabel as inductive grouping before the MECE test.',
        consultantSignalPl: 'Przeklasyfikuj na grupowanie indukcyjne, zanim zrobisz test MECE.',
      },
    ],
    branches: { 'chain-breaks': 'py3-mece', 'chain-survives': 'py3-mece' },
    defaultNextId: 'py3-mece',
  },
  {
    id: 'py2-inductive-mece',
    category: 'pyramid',
    level: 2,
    intentEn: 'Independent reasons must be Mutually Exclusive — no two arguing the same point.',
    intentPl:
      'Niezależne powody muszą być wzajemnie wykluczające się — żadne dwa nie mogą argumentować tego samego.',
    textEn:
      'Do your inductive arguments answer DIFFERENT facets of the question, or do two of them overlap and argue essentially the same point twice?',
    textPl:
      'Czy Twoje argumenty indukcyjne odpowiadają na RÓŻNE aspekty pytania, czy dwa z nich się nakładają i argumentują w gruncie rzeczy to samo dwa razy?',
    answerOptions: [
      {
        key: 'distinct-facets',
        labelEn: 'Each covers a genuinely different facet',
        labelPl: 'Każdy pokrywa naprawdę inny aspekt',
        consultantSignalEn:
          'Mutual exclusivity holds — check collective exhaustiveness (gaps) next.',
        consultantSignalPl:
          'Wzajemna wykluczalność się trzyma — sprawdź teraz łączną wyczerpalność (luki).',
      },
      {
        key: 'overlap-suspected',
        labelEn: 'Two of them feel like the same point twice',
        labelPl: 'Dwa z nich zdają się być tym samym punktem powtórzonym dwa razy',
        consultantSignalEn:
          'Merge the overlapping arguments before counting them as separate branches.',
        consultantSignalPl:
          'Scal nakładające się argumenty, zanim policzysz je jako osobne gałęzie.',
      },
    ],
    branches: { 'distinct-facets': 'py3-mece', 'overlap-suspected': 'py3-mece' },
    defaultNextId: 'py3-mece',
  },
  {
    id: 'py3-mece',
    category: 'pyramid',
    level: 3,
    intentEn: 'Collective exhaustiveness: a skeptical 5th argument must fit an existing bucket.',
    intentPl:
      'Łączna wyczerpalność: sceptyczny 5. argument musi zmieścić się w istniejącej gałęzi.',
    textEn:
      'If a skeptical partner raised a 5th argument against your thesis, would it fit inside one of your existing buckets, or does it expose a genuine gap?',
    textPl:
      'Gdyby sceptyczny partner podniósł 5. argument przeciw Twojej tezie, czy zmieściłby się w jednej z istniejących gałęzi, czy odsłania prawdziwą lukę?',
    probeEn: 'Naming the gap out loud is cheaper than a client finding it in the room.',
    probePl: 'Nazwanie luki na głos jest tańsze niż odkrycie jej przez klienta na sali.',
    answerOptions: [
      {
        key: 'fits-existing',
        labelEn: 'It fits an existing bucket',
        labelPl: 'Mieści się w istniejącej gałęzi',
        consultantSignalEn: 'Collectively exhaustive so far — do the final catch-all sweep.',
        consultantSignalPl:
          'Na razie łącznie wyczerpujące — zrób ostatnie sprawdzenie pod "kosz na resztę".',
      },
      {
        key: 'exposes-gap',
        labelEn: 'It exposes a real gap you had not named',
        labelPl: 'Odsłania prawdziwą lukę, której jeszcze nie nazwano',
        consultantSignalEn: 'Add the missing branch before finalizing the pyramid.',
        consultantSignalPl: 'Dodaj brakującą gałąź, zanim domkniesz piramidę.',
      },
    ],
    branches: { 'fits-existing': 'py4-catchall', 'exposes-gap': 'py4-catchall' },
    defaultNextId: 'py4-catchall',
  },
  {
    id: 'py4-catchall',
    category: 'pyramid',
    level: 4,
    intentEn: 'A vague "other/miscellaneous" branch is not a real MECE bucket.',
    intentPl: 'Mglista gałąź "inne/pozostałe" to nie prawdziwa gałąź MECE.',
    textEn:
      'Is any of your arguments a vague "other/miscellaneous" bucket rather than a real, nameable branch?',
    textPl:
      'Czy któryś z Twoich argumentów to mglisty kosz "inne/pozostałe", a nie prawdziwa, nazwana gałąź?',
    answerOptions: [
      {
        key: 'no-catchall',
        labelEn: 'No — every branch has a specific name',
        labelPl: 'Nie — każda gałąź ma konkretną nazwę',
        consultantSignalEn: 'Pyramid ready — move to attaching evidence per argument.',
        consultantSignalPl: 'Piramida gotowa — przejdź do podpięcia dowodu pod każdy argument.',
      },
      {
        key: 'has-catchall',
        labelEn: 'Yes — one branch is a vague leftover bucket',
        labelPl: 'Tak — jedna gałąź to mglisty kosz na resztę',
        consultantSignalEn: 'Split it into named branches or fold it into an existing one.',
        consultantSignalPl: 'Podziel ją na nazwane gałęzie albo wchłoń do istniejącej.',
      },
    ],
    branches: { 'no-catchall': null, 'has-catchall': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// EVIDENCE — proof per argument, or the honest "declared, unconfirmed"
// ---------------------------------------------------------------------------

const EVIDENCE_QUESTIONS: PyramidQuestionNode[] = [
  {
    id: 'ev1-proof',
    category: 'evidence',
    level: 1,
    intentEn: 'A claim without a claim without a NAMED proof point is a slogan.',
    intentPl: 'Twierdzenie bez NAZWANEGO dowodu to slogan.',
    textEn:
      'For this specific argument, what SPECIFIC proof (data point, quote, example) backs it — not a source category, the actual proof?',
    textPl:
      'Dla tego konkretnego argumentu — jaki KONKRETNY dowód (dana, cytat, przykład) go potwierdza, nie kategoria źródła, tylko sam dowód?',
    answerOptions: [
      {
        key: 'named-proof',
        labelEn: 'Yes — a specific, named proof point',
        labelPl: 'Tak — konkretny, nazwany dowód',
        consultantSignalEn: 'Confirmed — test the so-what next.',
        consultantSignalPl: 'Potwierdzone — sprawdź teraz "no i co z tego".',
      },
      {
        key: 'no-proof-yet',
        labelEn: 'No proof point exists yet',
        labelPl: 'Jeszcze nie ma dowodu',
        consultantSignalEn: 'Force the honest declared/unconfirmed label before moving on.',
        consultantSignalPl:
          'Wymuś uczciwą etykietę deklaracja/niepotwierdzone, zanim pójdziesz dalej.',
      },
    ],
    branches: { 'named-proof': 'ev2-sowhat', 'no-proof-yet': 'ev2-declare' },
    defaultNextId: 'ev2-declare',
  },
  {
    id: 'ev2-declare',
    category: 'evidence',
    level: 2,
    intentEn: 'Naming uncertainty beats masking it (CONCLUSION_LAYER R2).',
    intentPl: 'Nazwanie niepewności jest lepsze niż jej maskowanie (CONCLUSION_LAYER R2).',
    textEn:
      'With no proof yet, are you willing to label this argument "declared — unconfirmed" rather than presenting it as fact?',
    textPl:
      'Bez dowodu — czy zgadzasz się oznaczyć ten argument jako „deklaracja — niepotwierdzone" zamiast prezentować go jak fakt?',
    answerOptions: [
      {
        key: 'yes-label-it',
        labelEn: 'Yes — keep it, honestly labelled',
        labelPl: 'Tak — zostaw, uczciwie oznaczone',
        consultantSignalEn: 'Gate applied — the argument still counts, just flagged.',
        consultantSignalPl: 'Bramka zastosowana — argument nadal się liczy, tylko oznaczony.',
      },
      {
        key: 'prefer-to-assert',
        labelEn: 'I would rather present it as settled fact',
        labelPl: 'Wolałbym przedstawić to jako rozstrzygnięty fakt',
        consultantSignalEn:
          'Refuse — an unlabelled guess is the fastest way to lose credibility on stage.',
        consultantSignalPl:
          'Odmów — nieoznaczona domysł to najszybszy sposób na utratę wiarygodności na scenie.',
      },
    ],
    branches: { 'yes-label-it': 'ev3-implication', 'prefer-to-assert': 'ev3-implication' },
    defaultNextId: 'ev3-implication',
  },
  {
    id: 'ev2-sowhat',
    category: 'evidence',
    level: 2,
    intentEn: 'So-what test: proof matters only if it changes the decision.',
    intentPl: 'Test "no i co z tego": dowód liczy się tylko, jeśli zmienia decyzję.',
    textEn: 'So what — why does this proof matter to the DECISION, not just to the topic?',
    textPl: 'No i co z tego — dlaczego ten dowód ma znaczenie dla DECYZJI, a nie tylko dla tematu?',
    probeEn: 'If your answer just repeats the proof in other words, the so-what is still missing.',
    probePl: 'Jeśli odpowiedź tylko powtarza dowód innymi słowami, "no i co z tego" wciąż brakuje.',
    answerOptions: [
      {
        key: 'names-consequence',
        labelEn: 'Names a concrete business consequence',
        labelPl: 'Nazywa konkretną konsekwencję biznesową',
        consultantSignalEn: 'So-what present — capture the implication for the recommendation.',
        consultantSignalPl: '"No i co z tego" obecne — zapisz implikację dla rekomendacji.',
      },
      {
        key: 'restates-proof',
        labelEn: 'Mostly restates the proof in other words',
        labelPl: 'W większości powtarza dowód innymi słowami',
        consultantSignalEn: 'Push once more for the consequence, not a paraphrase.',
        consultantSignalPl: 'Dopytaj jeszcze raz o konsekwencję, nie o parafrazę.',
      },
    ],
    branches: { 'names-consequence': 'ev3-implication', 'restates-proof': 'ev3-implication' },
    defaultNextId: 'ev3-implication',
  },
  {
    id: 'ev3-implication',
    category: 'evidence',
    level: 3,
    intentEn: 'An implication with no action is trivia, not a K3 seed.',
    intentPl: 'Implikacja bez akcji to ciekawostka, nie zalążek K3.',
    textEn:
      'What follows for the recommendation if this argument holds — what would you do differently because of it?',
    textPl:
      'Co z tego wynika dla rekomendacji, jeśli ten argument się utrzyma — co zrobiłbyś inaczej z tego powodu?',
    answerOptions: [
      {
        key: 'concrete-action',
        labelEn: 'A concrete action follows',
        labelPl: 'Wynika konkretna akcja',
        consultantSignalEn: 'Argument is pyramid-ready — link it into the move sequence.',
        consultantSignalPl: 'Argument gotowy do piramidy — połącz go z sekwencją ruchów.',
      },
      {
        key: 'no-action-follows',
        labelEn: 'No action follows — it is interesting but inert',
        labelPl: 'Nie wynika żadna akcja — ciekawe, ale bezwładne',
        consultantSignalEn: 'Demote it to context, not a load-bearing argument.',
        consultantSignalPl: 'Zdegraduj do kontekstu, nie traktuj jako argumentu nośnego.',
      },
    ],
    branches: { 'concrete-action': null, 'no-action-follows': null },
    defaultNextId: null,
  },
];

export const NARRATIVE_PYRAMID_QUESTION_BANK: Record<PyramidCategory, PyramidQuestionNode[]> = {
  thesis: THESIS_QUESTIONS,
  scqa: SCQA_QUESTIONS,
  pyramid: PYRAMID_QUESTIONS,
  evidence: EVIDENCE_QUESTIONS,
};

const QUESTION_INDEX: Map<string, PyramidQuestionNode> = new Map(
  Object.values(NARRATIVE_PYRAMID_QUESTION_BANK)
    .flat()
    .map((q) => [q.id, q])
);

export function getPyramidQuestion(id: string): PyramidQuestionNode | undefined {
  return QUESTION_INDEX.get(id);
}

/**
 * Structural self-check used by unit tests and (defensively) at module load in
 * dev: every branch target must exist, every category has >= 3 leveled
 * questions, levels start at 1, and every path reaches a terminal (no cycles).
 * Near-literal port of validateSwotQuestionBank.
 */
export function validatePyramidQuestionBank(): string[] {
  const problems: string[] = [];
  (Object.keys(NARRATIVE_PYRAMID_QUESTION_BANK) as PyramidCategory[]).forEach((category) => {
    const questions = NARRATIVE_PYRAMID_QUESTION_BANK[category];
    const levels = new Set(questions.map((q) => q.level));
    if (!levels.has(1)) problems.push(`${category}: missing level-1 entry question`);
    if (levels.size < 3) problems.push(`${category}: fewer than 3 question levels`);
    questions.forEach((q) => {
      if (q.category !== category) problems.push(`${q.id}: category mismatch`);
      if (q.answerOptions.length < 2) problems.push(`${q.id}: fewer than 2 answer options`);
      q.answerOptions.forEach((opt) => {
        if (!(opt.key in q.branches)) problems.push(`${q.id}: option ${opt.key} has no branch`);
      });
      Object.entries(q.branches).forEach(([key, target]) => {
        if (target !== null && !QUESTION_INDEX.has(target)) {
          problems.push(`${q.id}: branch ${key} points to missing question ${target}`);
        }
      });
      if (q.defaultNextId !== null && !QUESTION_INDEX.has(q.defaultNextId)) {
        problems.push(`${q.id}: defaultNextId points to missing question`);
      }
      if (!q.textPl || !q.textEn) problems.push(`${q.id}: missing PL or EN text`);
    });
    // Every path from the entry question must terminate (no cycles).
    const entry = questions.find((q) => q.level === 1);
    if (entry) {
      const stack: { id: string; seen: Set<string> }[] = [{ id: entry.id, seen: new Set() }];
      while (stack.length) {
        const { id, seen } = stack.pop()!;
        if (seen.has(id)) {
          problems.push(`${category}: cycle detected at ${id}`);
          continue;
        }
        const node = QUESTION_INDEX.get(id);
        if (!node) continue;
        const nextSeen = new Set(seen).add(id);
        const targets = new Set(
          Object.values(node.branches).concat(node.defaultNextId ? [node.defaultNextId] : [])
        );
        targets.forEach((t) => {
          if (t) stack.push({ id: t, seen: nextSeen });
        });
      }
    }
  });
  return problems;
}

/**
 * Serialize the ladder for a category into a prompt block, so the AI mentor
 * asks EXACTLY these questions in conversation (single source of truth with
 * any future UI wizard step).
 */
export function buildCategoryLadderPromptBlock(
  category: PyramidCategory,
  language: 'pl' | 'en'
): string {
  const questions = NARRATIVE_PYRAMID_QUESTION_BANK[category];
  return questions
    .map((q) => {
      const text = language === 'pl' ? q.textPl : q.textEn;
      const intent = language === 'pl' ? q.intentPl : q.intentEn;
      const options = q.answerOptions
        .map((opt) => {
          const label = language === 'pl' ? opt.labelPl : opt.labelEn;
          const signal = language === 'pl' ? opt.consultantSignalPl : opt.consultantSignalEn;
          const next = q.branches[opt.key];
          return `    - [${opt.key}] "${label}" -> ${next || 'ladder complete'} (${signal})`;
        })
        .join('\n');
      return `[${q.id}] (L${q.level}) intent: ${intent}\n  Q: ${text}\n${options}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Evidence gate — an argument counts as accepted only with proof or an
// explicit "declared, unconfirmed" label. Near-literal port of the SWOT gate
// (src/config/swot/dynamicSwotQuestionBank.ts).
// ---------------------------------------------------------------------------

export const DECLARED_UNCONFIRMED_LABEL = {
  pl: 'Deklaracja — niepotwierdzone',
  en: 'Declared — unconfirmed',
} as const;

export type ArgumentEvidenceStatus = 'confirmed' | 'declared';

export interface ArgumentEvidenceGateResult {
  status: ArgumentEvidenceStatus;
  /** Label to render on the card when status !== confirmed. */
  label?: { pl: string; en: string };
}

/**
 * Evidence gate applied to a pyramid argument (a NarrativePillar):
 * - at least one non-empty proof point or evidence entry -> confirmed
 * - otherwise                                            -> declared (explicit label)
 * The gate never blocks acceptance — it forces honesty about the evidence
 * status (CONCLUSION_LAYER R2: naming uncertainty beats masking it).
 */
export function evaluateArgumentEvidence(argument: {
  proofPoints?: string[];
  evidence?: string[];
}): ArgumentEvidenceGateResult {
  const proofCount = (argument.proofPoints || []).filter((p) => p && p.trim()).length;
  const evidenceCount = (argument.evidence || []).filter((e) => e && e.trim()).length;
  if (proofCount > 0 || evidenceCount > 0) return { status: 'confirmed' };
  return { status: 'declared', label: { ...DECLARED_UNCONFIRMED_LABEL } };
}
