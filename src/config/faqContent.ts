export interface FAQItem {
    id: string;
    moduleId: string;
    question: string;
    questionPl?: string;
    answer: string;
    answerPl?: string;
    tags?: string[];
}

export const FAQ_CONTENT: FAQItem[] = [];

export function getFAQsForModule(id: string) { return FAQ_CONTENT.filter(faq => faq.moduleId === id); }

export function searchFAQs(query: string, lang?: string): FAQItem[] {
    const lowerQuery = query.toLowerCase();
    return FAQ_CONTENT.filter(faq => 
        faq.question.toLowerCase().includes(lowerQuery) ||
        faq.answer.toLowerCase().includes(lowerQuery)
    );
}
