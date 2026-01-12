/**
 * Socratic Question Engine
 * 
 * Enables the Co-Thinker to ask intelligent, probing questions
 * that guide the user's thinking rather than just providing answers.
 * 
 * Based on Socratic questioning techniques used in consulting and coaching.
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

import { aiLogger } from './logger.js';

// Socratic question patterns by type
const SOCRATIC_PATTERNS = {
    // Questions to clarify meaning
    clarification: {
        name: 'Clarification',
        purpose: 'Understand exactly what the user means',
        templates: [
            "When you say '{term}', can you give me a specific example?",
            "Help me understand - what does success look like for {topic}?",
            "You mentioned {item}. What's driving that priority?",
            "Can you tell me more about what you mean by '{term}'?",
            "What specifically do you mean when you say '{term}'?",
            "Could you elaborate on '{term}'? I want to make sure I understand correctly.",
            "How would you define '{term}' in your organization's context?"
        ],
        templatesPl: [
            "Kiedy mówisz '{term}', czy możesz podać konkretny przykład?",
            "Pomóż mi zrozumieć - jak wygląda sukces w przypadku {topic}?",
            "Wspomniałeś o {item}. Co sprawia, że to jest priorytet?",
            "Czy możesz powiedzieć więcej o tym, co masz na myśli mówiąc '{term}'?",
            "Co dokładnie masz na myśli mówiąc '{term}'?",
            "Czy mógłbyś rozwinąć '{term}'? Chcę się upewnić, że dobrze rozumiem.",
            "Jak zdefiniowałbyś '{term}' w kontekście Twojej organizacji?"
        ]
    },

    // Questions to probe assumptions
    probing: {
        name: 'Probing Assumptions',
        purpose: 'Uncover and examine underlying assumptions',
        templates: [
            "What evidence do you have for {assumption}?",
            "If we pursue {option}, what could go wrong?",
            "How would you explain this to your CEO in 30 seconds?",
            "What assumptions are we making here that might not be true?",
            "What would need to be true for {option} to work?",
            "Is there data that supports {assumption}?",
            "What's the basis for believing {assumption}?",
            "Have you tested this assumption before?"
        ],
        templatesPl: [
            "Jakie masz dowody na poparcie {assumption}?",
            "Jeśli podążymy za {option}, co może pójść nie tak?",
            "Jak wyjaśniłbyś to swojemu CEO w 30 sekund?",
            "Jakie założenia przyjmujemy, które mogą nie być prawdziwe?",
            "Co musiałoby być prawdą, żeby {option} zadziałało?",
            "Czy są dane wspierające {assumption}?",
            "Na jakiej podstawie wierzysz w {assumption}?",
            "Czy testowałeś to założenie wcześniej?"
        ]
    },

    // Questions to explore different perspectives
    perspective: {
        name: 'Perspective',
        purpose: 'Consider different viewpoints and stakeholders',
        templates: [
            "How would your operations team view this initiative?",
            "If you were a customer, what would you expect?",
            "What would a competitor do in this situation?",
            "How might the board view this investment?",
            "What would your frontline employees say about this?",
            "How would this look from your customer's perspective?",
            "What would a skeptic say about this approach?",
            "If this fails, how would stakeholders react?"
        ],
        templatesPl: [
            "Jak Twój zespół operacyjny oceniłby tę inicjatywę?",
            "Gdybyś był klientem, czego byś oczekiwał?",
            "Co zrobiłby konkurent w tej sytuacji?",
            "Jak zarząd mógłby postrzegać tę inwestycję?",
            "Co powiedzieliby o tym pracownicy pierwszej linii?",
            "Jak to wygląda z perspektywy Twojego klienta?",
            "Co powiedziałby sceptyk o tym podejściu?",
            "Jeśli to się nie uda, jak zareagują interesariusze?"
        ]
    },

    // Questions about implications and consequences
    implication: {
        name: 'Implications',
        purpose: 'Explore consequences and downstream effects',
        templates: [
            "If {condition}, then what happens to {dependent}?",
            "What's the second-order effect of {decision}?",
            "What are we NOT doing if we invest in this?",
            "How does this decision affect other priorities?",
            "What resources would this take away from other initiatives?",
            "If this succeeds, what new challenges might emerge?",
            "What's the long-term impact of {decision}?",
            "What dependencies does this create?"
        ],
        templatesPl: [
            "Jeśli {condition}, to co stanie się z {dependent}?",
            "Jaki jest efekt drugiego rzędu {decision}?",
            "Czego NIE robimy, jeśli inwestujemy w to?",
            "Jak ta decyzja wpływa na inne priorytety?",
            "Jakie zasoby odbiera to innym inicjatywom?",
            "Jeśli to się uda, jakie nowe wyzwania mogą się pojawić?",
            "Jaki jest długoterminowy wpływ {decision}?",
            "Jakie zależności to tworzy?"
        ]
    },

    // Questions to synthesize and confirm understanding
    synthesis: {
        name: 'Synthesis',
        purpose: 'Confirm understanding and summarize',
        templates: [
            "So if I understand correctly: {summary}. Is that right?",
            "What I'm hearing is {pattern}. Does that resonate?",
            "Based on what you've shared, the priority seems to be {priority}. Agree?",
            "Let me make sure I have this right: {summary}",
            "To summarize: {summary}. Am I missing anything?",
            "It sounds like the key issue is {issue}. Is that accurate?",
            "So the main blocker is {blocker}. Correct?"
        ],
        templatesPl: [
            "Więc jeśli dobrze rozumiem: {summary}. Czy to prawda?",
            "Słyszę, że {pattern}. Czy to rezonuje?",
            "Na podstawie tego co powiedziałeś, priorytetem wydaje się być {priority}. Zgadzasz się?",
            "Pozwól, że upewnię się, że dobrze zrozumiałem: {summary}",
            "Podsumowując: {summary}. Czy czegoś mi brakuje?",
            "Brzmi to tak, jakby kluczową kwestią było {issue}. Czy to trafne?",
            "Więc główna blokada to {blocker}. Zgadza się?"
        ]
    },

    // Questions about evidence and reasoning
    evidence: {
        name: 'Evidence',
        purpose: 'Ground discussion in facts and data',
        templates: [
            "What data do we have to support this?",
            "Where have you seen this work before?",
            "What metrics would validate this approach?",
            "Can you point to a specific example of this succeeding?",
            "What would we need to measure to know this is working?",
            "How confident are you in these numbers?",
            "What's the source of this estimate?",
            "Have similar initiatives been tried before? What happened?"
        ],
        templatesPl: [
            "Jakie dane wspierają to twierdzenie?",
            "Gdzie widziałeś, że to działa?",
            "Jakie metryki potwierdziłyby to podejście?",
            "Czy możesz wskazać konkretny przykład sukcesu?",
            "Co musielibyśmy mierzyć, żeby wiedzieć, że to działa?",
            "Jak pewny jesteś tych liczb?",
            "Jakie jest źródło tego szacunku?",
            "Czy podobne inicjatywy były już wcześniej próbowane? Co się stało?"
        ]
    },

    // Questions about alternatives and options
    alternatives: {
        name: 'Alternatives',
        purpose: 'Explore other options and approaches',
        templates: [
            "What other approaches have you considered?",
            "What's the alternative if this doesn't work?",
            "Is there a simpler way to achieve the same goal?",
            "What's the minimum viable version of this?",
            "Could we pilot this with a smaller scope first?",
            "What would a 10x faster approach look like?",
            "What if budget was no constraint - what would you do differently?",
            "What's the 80/20 version of this initiative?"
        ],
        templatesPl: [
            "Jakie inne podejścia rozważałeś?",
            "Jaka jest alternatywa, jeśli to nie zadziała?",
            "Czy jest prostszy sposób na osiągnięcie tego samego celu?",
            "Jaka jest minimalna wersja tego rozwiązania?",
            "Czy moglibyśmy najpierw przetestować to w mniejszym zakresie?",
            "Jak wyglądałoby podejście 10x szybsze?",
            "Gdyby budżet nie był ograniczeniem - co byś zrobił inaczej?",
            "Jaka jest wersja 80/20 tej inicjatywy?"
        ]
    },

    // Questions to challenge and stress-test
    challenge: {
        name: 'Challenge',
        purpose: 'Stress-test ideas and plans',
        templates: [
            "Why would this fail?",
            "What's the strongest argument against this approach?",
            "If a competitor saw this plan, what would they exploit?",
            "What's the biggest risk we're not talking about?",
            "Where could we be wrong?",
            "What would make you abandon this approach?",
            "What's the worst case scenario?",
            "Who would oppose this and why?"
        ],
        templatesPl: [
            "Dlaczego to mogłoby się nie udać?",
            "Jaki jest najsilniejszy argument przeciwko temu podejściu?",
            "Gdyby konkurent zobaczył ten plan, co by wykorzystał?",
            "Jakie jest największe ryzyko, o którym nie mówimy?",
            "Gdzie możemy się mylić?",
            "Co sprawiłoby, że porzuciłbyś to podejście?",
            "Jaki jest najgorszy scenariusz?",
            "Kto by się temu sprzeciwił i dlaczego?"
        ]
    }
};

// Context-based question selection rules
const QUESTION_SELECTION_RULES = {
    // When starting a new topic
    newTopic: ['clarification', 'perspective'],
    
    // When user makes a strong claim
    strongClaim: ['probing', 'evidence'],
    
    // When discussing options
    decidingOptions: ['alternatives', 'implication'],
    
    // When planning or roadmapping
    planning: ['implication', 'challenge'],
    
    // When user seems confident
    overconfident: ['challenge', 'probing'],
    
    // When user seems uncertain
    uncertain: ['clarification', 'synthesis'],
    
    // When wrapping up a topic
    concluding: ['synthesis', 'implication'],
    
    // Default behavior
    default: ['clarification', 'probing', 'perspective']
};

class SocraticEngine {
    constructor() {
        this.patterns = SOCRATIC_PATTERNS;
        this.rules = QUESTION_SELECTION_RULES;
        this.recentQuestionTypes = [];
    }

    /**
     * Generate a Socratic question based on context
     * @param {Object} context - Current conversation context
     * @returns {Object} Question with metadata
     */
    generateQuestion(context) {
        const {
            topic,
            userStatement,
            conversationPhase,
            emotionalState,
            language = 'en',
            recentQuestions = []
        } = context;

        // Determine appropriate question type
        const questionType = this.selectQuestionType(context);
        
        // Avoid repeating same question types
        if (this.recentQuestionTypes.length >= 3) {
            this.recentQuestionTypes.shift();
        }
        this.recentQuestionTypes.push(questionType);

        // Get question template
        const pattern = this.patterns[questionType];
        if (!pattern) {
            return this.getFallbackQuestion(language);
        }

        // Select template
        const templates = language === 'pl' ? pattern.templatesPl : pattern.templates;
        const template = this.selectTemplate(templates, recentQuestions);

        // Fill in template variables
        const variables = this.extractVariables(userStatement, topic);
        const question = this.fillTemplate(template, variables);

        return {
            question,
            type: questionType,
            purpose: pattern.purpose,
            originalTemplate: template,
            variables
        };
    }

    /**
     * Select appropriate question type based on context
     */
    selectQuestionType(context) {
        const {
            conversationPhase,
            emotionalState,
            userStatement,
            isNewTopic,
            isStrongClaim,
            isPlanning
        } = context;

        // Rule-based selection
        if (isNewTopic) {
            return this.pickFromTypes(this.rules.newTopic);
        }

        if (isStrongClaim || this.detectStrongClaim(userStatement)) {
            return this.pickFromTypes(this.rules.strongClaim);
        }

        if (isPlanning || conversationPhase === 'roadmap') {
            return this.pickFromTypes(this.rules.planning);
        }

        if (emotionalState === 'confident') {
            return this.pickFromTypes(this.rules.overconfident);
        }

        if (emotionalState === 'uncertain') {
            return this.pickFromTypes(this.rules.uncertain);
        }

        // Avoid repetition
        const availableTypes = Object.keys(this.patterns).filter(
            t => !this.recentQuestionTypes.includes(t)
        );

        if (availableTypes.length > 0) {
            return this.pickFromTypes(availableTypes);
        }

        return this.pickFromTypes(this.rules.default);
    }

    /**
     * Pick a random type from array, avoiding recently used
     */
    pickFromTypes(types) {
        // Filter out recently used
        const available = types.filter(t => !this.recentQuestionTypes.slice(-2).includes(t));
        const pool = available.length > 0 ? available : types;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /**
     * Select a template, avoiding recently used questions
     */
    selectTemplate(templates, recentQuestions = []) {
        // Filter out templates that match recent questions
        const available = templates.filter(t => 
            !recentQuestions.some(rq => this.isSimilar(t, rq))
        );
        
        const pool = available.length > 0 ? available : templates;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /**
     * Check if two questions are similar
     */
    isSimilar(template, question) {
        // Remove variables and compare
        const cleanTemplate = template.replace(/\{[^}]+\}/g, '').toLowerCase();
        const cleanQuestion = (question || '').toLowerCase();
        
        // Simple similarity check
        const templateWords = cleanTemplate.split(/\s+/).filter(w => w.length > 3);
        const matchCount = templateWords.filter(w => cleanQuestion.includes(w)).length;
        
        return matchCount > templateWords.length * 0.6;
    }

    /**
     * Extract variables from user statement for template filling
     */
    extractVariables(userStatement, topic) {
        const variables = {
            term: '',
            topic: topic || 'this topic',
            item: '',
            assumption: '',
            option: '',
            condition: '',
            dependent: '',
            decision: '',
            summary: '',
            pattern: '',
            priority: '',
            issue: '',
            blocker: ''
        };

        if (!userStatement) return variables;

        // Extract quoted terms
        const quotedMatch = userStatement.match(/"([^"]+)"|'([^']+)'/);
        if (quotedMatch) {
            variables.term = quotedMatch[1] || quotedMatch[2];
        }

        // Extract key nouns/phrases (simplified)
        const words = userStatement.split(/\s+/);
        
        // Look for significant terms
        const significantWords = words.filter(w => 
            w.length > 4 && 
            !['should', 'would', 'could', 'think', 'about', 'there', 'which', 'their', 'these'].includes(w.toLowerCase())
        );

        if (significantWords.length > 0) {
            variables.term = variables.term || significantWords[0];
            variables.item = significantWords[0];
            variables.option = significantWords.slice(0, 3).join(' ');
            variables.assumption = significantWords.slice(0, 4).join(' ');
        }

        // Use full statement for summary
        variables.summary = userStatement.length > 100 
            ? userStatement.substring(0, 100) + '...'
            : userStatement;

        return variables;
    }

    /**
     * Fill template with variables
     */
    fillTemplate(template, variables) {
        let result = template;
        
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || `[${key}]`);
        }
        
        return result;
    }

    /**
     * Detect if statement contains a strong claim
     */
    detectStrongClaim(statement) {
        if (!statement) return false;
        
        const strongIndicators = [
            'always', 'never', 'definitely', 'certainly', 'obviously',
            'everyone', 'no one', 'impossible', 'guaranteed', 'sure',
            'zawsze', 'nigdy', 'na pewno', 'oczywiste', 'wszyscy', 'nikt'
        ];
        
        const lowerStatement = statement.toLowerCase();
        return strongIndicators.some(indicator => lowerStatement.includes(indicator));
    }

    /**
     * Get a fallback question
     */
    getFallbackQuestion(language = 'en') {
        const fallbacks = {
            en: [
                "Can you tell me more about that?",
                "What makes you say that?",
                "How do you see this playing out?",
                "What would be most helpful to discuss right now?"
            ],
            pl: [
                "Czy możesz powiedzieć mi więcej?",
                "Co sprawia, że tak mówisz?",
                "Jak widzisz rozwój tej sytuacji?",
                "Co byłoby najbardziej pomocne do omówienia teraz?"
            ]
        };

        const questions = fallbacks[language] || fallbacks.en;
        return {
            question: questions[Math.floor(Math.random() * questions.length)],
            type: 'fallback',
            purpose: 'Continue the conversation'
        };
    }

    /**
     * Generate a follow-up question based on AI response
     */
    generateFollowUp(aiResponse, context) {
        const { language = 'en', conversationPhase } = context;

        // If AI made recommendations, probe implications
        if (this.containsRecommendation(aiResponse)) {
            const type = 'implication';
            const pattern = this.patterns[type];
            const templates = language === 'pl' ? pattern.templatesPl : pattern.templates;
            const template = templates[Math.floor(Math.random() * templates.length)];
            
            return {
                question: this.fillTemplate(template, { decision: 'this recommendation' }),
                type,
                purpose: pattern.purpose
            };
        }

        // If AI mentioned risks, probe alternatives
        if (this.containsRisk(aiResponse)) {
            const type = 'alternatives';
            const pattern = this.patterns[type];
            const templates = language === 'pl' ? pattern.templatesPl : pattern.templates;
            const template = templates[Math.floor(Math.random() * templates.length)];
            
            return {
                question: template.replace(/\{[^}]+\}/g, 'this situation'),
                type,
                purpose: pattern.purpose
            };
        }

        // Default: synthesis question
        const type = 'synthesis';
        const pattern = this.patterns[type];
        const templates = language === 'pl' ? pattern.templatesPl : pattern.templates;
        
        return {
            question: "Does this address your question, or should we explore further?",
            type,
            purpose: pattern.purpose
        };
    }

    /**
     * Check if response contains a recommendation
     */
    containsRecommendation(text) {
        const indicators = [
            'recommend', 'suggest', 'should', 'advise', 'propose',
            'polecam', 'sugeruję', 'powinien', 'doradzam', 'proponuję'
        ];
        const lower = text.toLowerCase();
        return indicators.some(i => lower.includes(i));
    }

    /**
     * Check if response mentions risks
     */
    containsRisk(text) {
        const indicators = [
            'risk', 'challenge', 'concern', 'caution', 'careful',
            'ryzyko', 'wyzwanie', 'ostrożność', 'uwaga'
        ];
        const lower = text.toLowerCase();
        return indicators.some(i => lower.includes(i));
    }

    /**
     * Get all question patterns (for UI display)
     */
    getAllPatterns() {
        return Object.entries(this.patterns).map(([id, pattern]) => ({
            id,
            name: pattern.name,
            purpose: pattern.purpose,
            exampleCount: pattern.templates.length
        }));
    }

    /**
     * Reset recent questions tracking (for new conversation)
     */
    reset() {
        this.recentQuestionTypes = [];
    }
}

// Singleton instance
const socraticEngine = new SocraticEngine();

export {
SocraticEngine,
    socraticEngine,
    SOCRATIC_PATTERNS,
    QUESTION_SELECTION_RULES
};

export default {
    SocraticEngine,
    socraticEngine,
    SOCRATIC_PATTERNS,
    QUESTION_SELECTION_RULES
};

