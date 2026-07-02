/**
 * Document Studio — Inline AI action definitions (R2).
 *
 * Each action carries a bilingual label (PL/EN) and an instruction string
 * that is forwarded to the backend createDocumentStudioLocalProposal call.
 */

export interface InlineAction {
  id: string;
  labelPl: string;
  labelEn: string;
  instruction: string;
}

export const INLINE_ACTIONS: InlineAction[] = [
  {
    id: 'shorten',
    labelPl: 'Skróć',
    labelEn: 'Shorten',
    instruction: 'Skróć ten fragment o ok. 40%. Zachowaj kluczowe fakty.',
  },
  {
    id: 'expand',
    labelPl: 'Rozwiń',
    labelEn: 'Expand',
    instruction: 'Rozwiń ten fragment z większą ilością szczegółów i przykładów.',
  },
  {
    id: 'improve',
    labelPl: 'Popraw',
    labelEn: 'Improve',
    instruction: 'Popraw styl i klarowność. Zachowaj treść i strukturę.',
  },
  {
    id: 'formal',
    labelPl: 'Formalny ton',
    labelEn: 'Formal tone',
    instruction: 'Przepisz w formalnym tonie biznesowym.',
  },
  {
    id: 'explain',
    labelPl: 'Wyjaśnij',
    labelEn: 'Explain',
    instruction: 'Wyjaśnij ten fragment prostszym językiem.',
  },
];
