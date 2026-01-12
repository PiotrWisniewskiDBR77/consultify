/**
 * VoiceCommandParser
 * 
 * Parses voice commands for HITL approval workflow.
 * Supports both English and Polish commands.
 * 
 * Commands:
 * - approve / akceptuj - Approve current/first pending action
 * - reject [reason] / odrzuć [powód] - Reject with optional reason
 * - skip / pomiń - Skip to next action
 * - details / szczegóły - Get action details
 * - approve all low risk / akceptuj wszystkie niskie ryzyko
 * - always approve this / zawsze akceptuj takie
 * - always reject this / zawsze odrzucaj takie
 * - list pending / pokaż oczekujące
 * 
 * @module server/services/voiceCommandParser
 */

const COMMAND_TYPES = {
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    SKIP: 'SKIP',
    DETAILS: 'DETAILS',
    APPROVE_ALL_LOW_RISK: 'APPROVE_ALL_LOW_RISK',
    ALWAYS_APPROVE: 'ALWAYS_APPROVE',
    ALWAYS_REJECT: 'ALWAYS_REJECT',
    LIST_PENDING: 'LIST_PENDING',
    HELP: 'HELP',
    UNKNOWN: 'UNKNOWN'
};

// Command patterns with regex for flexible matching
const COMMAND_PATTERNS = [
    // APPROVE
    {
        type: COMMAND_TYPES.APPROVE,
        patterns: [
            /^(approve|akceptuj|zatwierdź|ok|yes|tak|accept)$/i,
            /^(approve|akceptuj|zatwierdź)\s+(this|to|first|pierwszy|action|akcję)$/i,
            /^zatwierdz$/i  // without polish chars
        ],
        extract: null
    },
    
    // REJECT with reason
    {
        type: COMMAND_TYPES.REJECT,
        patterns: [
            /^(reject|odrzuć|odrzuc|no|nie)$/i,
            /^(reject|odrzuć|odrzuc)\s+(.+)$/i,  // With reason
            /^(reject|odrzuć|odrzuc)\s+(this|to|akcję)$/i
        ],
        extract: (match, text) => {
            const reasonMatch = text.match(/^(?:reject|odrzuć|odrzuc)\s+(?:because|bo|ponieważ|powod:?)\s+(.+)$/i);
            if (reasonMatch) return { reason: reasonMatch[1] };
            
            const directReasonMatch = text.match(/^(?:reject|odrzuć|odrzuc)\s+(?!this|to|akcję)(.+)$/i);
            if (directReasonMatch) return { reason: directReasonMatch[1] };
            
            return {};
        }
    },
    
    // SKIP
    {
        type: COMMAND_TYPES.SKIP,
        patterns: [
            /^(skip|pomiń|pomin|next|następny|nastepny|later|później|pozniej)$/i
        ],
        extract: null
    },
    
    // DETAILS
    {
        type: COMMAND_TYPES.DETAILS,
        patterns: [
            /^(details|szczegóły|szczegoly|info|information|informacje|more|więcej|wiecej|tell me more|powiedz więcej)$/i,
            /^(what|co)\s+(is|to)\s+(this|to)$/i,
            /^explain|wyjaśnij|wyjasni$/i
        ],
        extract: null
    },
    
    // APPROVE ALL LOW RISK
    {
        type: COMMAND_TYPES.APPROVE_ALL_LOW_RISK,
        patterns: [
            /^(approve|akceptuj|zatwierdź)\s+(all|wszystkie)\s+(low\s+risk|niskie\s+ryzyko|safe|bezpieczne)$/i,
            /^(approve|akceptuj)\s+(wszystkie|all)\s+(niskiego\s+ryzyka|o\s+niskim\s+ryzyku)$/i
        ],
        extract: null
    },
    
    // ALWAYS APPROVE (learn pattern)
    {
        type: COMMAND_TYPES.ALWAYS_APPROVE,
        patterns: [
            /^(always|zawsze)\s+(approve|akceptuj|zatwierdź)(\s+(this|to|similar|takie|podobne))?$/i,
            /^(remember|zapamiętaj|zapamietaj)(\s+to)?\s+(approve|akceptuj|że\s+akceptuję)$/i,
            /^(auto.?approve|auto.?akceptuj)(\s+(this|to))?$/i
        ],
        extract: null
    },
    
    // ALWAYS REJECT (learn pattern)
    {
        type: COMMAND_TYPES.ALWAYS_REJECT,
        patterns: [
            /^(always|zawsze)\s+(reject|odrzuć|odrzucaj)(\s+(this|to|similar|takie|podobne))?$/i,
            /^(remember|zapamiętaj|zapamietaj)(\s+to)?\s+(reject|odrzuć|że\s+odrzucam)$/i,
            /^(auto.?reject|auto.?odrzuć)(\s+(this|to))?$/i
        ],
        extract: null
    },
    
    // LIST PENDING
    {
        type: COMMAND_TYPES.LIST_PENDING,
        patterns: [
            /^(list|pokaż|pokaz|show|wyświetl|wyswietl)\s+(pending|oczekujące|oczekujace|actions|akcje)$/i,
            /^(what|co)\s+(is|jest)\s+(pending|oczekuje|do\s+zatwierdzenia)$/i,
            /^(pending|oczekujące|oczekujace)\s+(list|lista)$/i,
            /^ile\s+(mam|jest)\s+(do\s+zatwierdzenia|oczekujących|pending)$/i
        ],
        extract: null
    },
    
    // HELP
    {
        type: COMMAND_TYPES.HELP,
        patterns: [
            /^(help|pomoc|commands|komendy|what can (i|you) (say|do))$/i,
            /^(jak|how)\s+(to|mogę)$/i
        ],
        extract: null
    }
];

const VoiceCommandParser = {
    COMMAND_TYPES,

    /**
     * Parse a voice command text
     * @param {string} text - Transcribed voice command
     * @returns {object} - { type, params, confidence, originalText }
     */
    parse: (text) => {
        if (!text || typeof text !== 'string') {
            return {
                type: COMMAND_TYPES.UNKNOWN,
                params: {},
                confidence: 0,
                originalText: text || ''
            };
        }

        const normalizedText = text.trim().toLowerCase();
        
        for (const command of COMMAND_PATTERNS) {
            for (const pattern of command.patterns) {
                const match = normalizedText.match(pattern);
                if (match) {
                    const params = command.extract ? command.extract(match, normalizedText) : {};
                    
                    return {
                        type: command.type,
                        params,
                        confidence: VoiceCommandParser._calculateConfidence(normalizedText, match),
                        originalText: text,
                        matchedPattern: pattern.toString()
                    };
                }
            }
        }

        // Fuzzy matching for close matches
        const fuzzyResult = VoiceCommandParser._fuzzyMatch(normalizedText);
        if (fuzzyResult) {
            return fuzzyResult;
        }

        return {
            type: COMMAND_TYPES.UNKNOWN,
            params: {},
            confidence: 0,
            originalText: text,
            suggestions: VoiceCommandParser._getSuggestions(normalizedText)
        };
    },

    /**
     * Calculate confidence based on match quality
     * @private
     */
    _calculateConfidence: (text, match) => {
        // Exact single-word matches get high confidence
        if (match[0] === text) return 1.0;
        
        // Partial matches get medium confidence
        const matchRatio = match[0].length / text.length;
        return Math.min(0.95, 0.7 + (matchRatio * 0.3));
    },

    /**
     * Fuzzy match for close matches
     * @private
     */
    _fuzzyMatch: (text) => {
        const keywords = {
            [COMMAND_TYPES.APPROVE]: ['aprov', 'aprove', 'akept', 'zatw', 'ok', 'yes'],
            [COMMAND_TYPES.REJECT]: ['rejet', 'rejec', 'odrzu', 'nie', 'no'],
            [COMMAND_TYPES.SKIP]: ['ski', 'pomi', 'nex', 'later'],
            [COMMAND_TYPES.DETAILS]: ['deta', 'szcze', 'info', 'wiec', 'more']
        };

        for (const [type, keys] of Object.entries(keywords)) {
            for (const key of keys) {
                if (text.includes(key)) {
                    return {
                        type,
                        params: {},
                        confidence: 0.6,
                        originalText: text,
                        fuzzyMatched: true
                    };
                }
            }
        }

        return null;
    },

    /**
     * Get command suggestions for unknown input
     * @private
     */
    _getSuggestions: (text) => {
        const suggestions = [];
        
        if (text.length < 3) {
            suggestions.push('Try saying "approve", "reject", "skip", or "details"');
        } else {
            if (text.includes('a') || text.includes('ok') || text.includes('y')) {
                suggestions.push('Did you mean "approve"?');
            }
            if (text.includes('n') || text.includes('r')) {
                suggestions.push('Did you mean "reject"?');
            }
        }
        
        return suggestions;
    },

    /**
     * Check if text is a valid approval command
     * @param {string} text - Text to check
     * @returns {boolean}
     */
    isApprovalCommand: (text) => {
        const result = VoiceCommandParser.parse(text);
        return [
            COMMAND_TYPES.APPROVE, 
            COMMAND_TYPES.REJECT, 
            COMMAND_TYPES.ALWAYS_APPROVE, 
            COMMAND_TYPES.ALWAYS_REJECT,
            COMMAND_TYPES.APPROVE_ALL_LOW_RISK
        ].includes(result.type);
    },

    /**
     * Check if command is a learning command (always approve/reject)
     * @param {string} text - Text to check
     * @returns {boolean}
     */
    isLearningCommand: (text) => {
        const result = VoiceCommandParser.parse(text);
        return [
            COMMAND_TYPES.ALWAYS_APPROVE, 
            COMMAND_TYPES.ALWAYS_REJECT
        ].includes(result.type);
    },

    /**
     * Get available commands help text
     * @param {string} language - 'en' or 'pl'
     * @returns {object} - Commands help object
     */
    getHelp: (language = 'en') => {
        const help = {
            en: {
                title: 'Voice Approval Commands',
                commands: [
                    { command: 'approve', description: 'Approve the current action' },
                    { command: 'reject [reason]', description: 'Reject with optional reason' },
                    { command: 'skip', description: 'Skip to next action' },
                    { command: 'details', description: 'Get more information about the action' },
                    { command: 'approve all low risk', description: 'Approve all low-risk actions' },
                    { command: 'always approve this', description: 'Learn to auto-approve similar actions' },
                    { command: 'always reject this', description: 'Learn to auto-reject similar actions' },
                    { command: 'list pending', description: 'Show pending actions' },
                    { command: 'help', description: 'Show this help' }
                ]
            },
            pl: {
                title: 'Komendy głosowe zatwierdzania',
                commands: [
                    { command: 'akceptuj', description: 'Zatwierdź bieżącą akcję' },
                    { command: 'odrzuć [powód]', description: 'Odrzuć z opcjonalnym powodem' },
                    { command: 'pomiń', description: 'Przejdź do następnej akcji' },
                    { command: 'szczegóły', description: 'Pokaż więcej informacji o akcji' },
                    { command: 'akceptuj wszystkie niskie ryzyko', description: 'Zatwierdź wszystkie akcje o niskim ryzyku' },
                    { command: 'zawsze akceptuj takie', description: 'Naucz się automatycznie akceptować podobne' },
                    { command: 'zawsze odrzucaj takie', description: 'Naucz się automatycznie odrzucać podobne' },
                    { command: 'pokaż oczekujące', description: 'Pokaż akcje oczekujące' },
                    { command: 'pomoc', description: 'Pokaż tę pomoc' }
                ]
            }
        };

        return help[language] || help.en;
    },

    /**
     * Generate voice response for command result
     * @param {string} commandType - Command type executed
     * @param {object} result - Result of the command
     * @param {string} language - 'en' or 'pl'
     * @returns {string} - Voice response text
     */
    getVoiceResponse: (commandType, result, language = 'en') => {
        const responses = {
            en: {
                [COMMAND_TYPES.APPROVE]: result.success 
                    ? `Approved. ${result.patternLearned ? 'Pattern learned.' : ''}` 
                    : `Could not approve: ${result.error}`,
                [COMMAND_TYPES.REJECT]: result.success 
                    ? `Rejected. ${result.patternLearned ? 'Pattern learned.' : ''}` 
                    : `Could not reject: ${result.error}`,
                [COMMAND_TYPES.SKIP]: 'Skipped. Moving to next action.',
                [COMMAND_TYPES.DETAILS]: 'Here are the details.',
                [COMMAND_TYPES.ALWAYS_APPROVE]: 'OK, I will automatically approve similar actions in the future.',
                [COMMAND_TYPES.ALWAYS_REJECT]: 'OK, I will automatically reject similar actions in the future.',
                [COMMAND_TYPES.LIST_PENDING]: `You have ${result.count || 0} pending actions.`,
                [COMMAND_TYPES.HELP]: 'You can say: approve, reject, skip, details, or always approve this.',
                [COMMAND_TYPES.UNKNOWN]: 'I did not understand. Try saying approve, reject, skip, or help.'
            },
            pl: {
                [COMMAND_TYPES.APPROVE]: result.success 
                    ? `Zatwierdzono. ${result.patternLearned ? 'Wzorzec zapamiętany.' : ''}` 
                    : `Nie można zatwierdzić: ${result.error}`,
                [COMMAND_TYPES.REJECT]: result.success 
                    ? `Odrzucono. ${result.patternLearned ? 'Wzorzec zapamiętany.' : ''}` 
                    : `Nie można odrzucić: ${result.error}`,
                [COMMAND_TYPES.SKIP]: 'Pominięto. Przechodzę do następnej akcji.',
                [COMMAND_TYPES.DETAILS]: 'Oto szczegóły.',
                [COMMAND_TYPES.ALWAYS_APPROVE]: 'OK, będę automatycznie akceptować podobne akcje w przyszłości.',
                [COMMAND_TYPES.ALWAYS_REJECT]: 'OK, będę automatycznie odrzucać podobne akcje w przyszłości.',
                [COMMAND_TYPES.LIST_PENDING]: `Masz ${result.count || 0} akcji oczekujących.`,
                [COMMAND_TYPES.HELP]: 'Możesz powiedzieć: akceptuj, odrzuć, pomiń, szczegóły lub zawsze akceptuj takie.',
                [COMMAND_TYPES.UNKNOWN]: 'Nie zrozumiałem. Spróbuj powiedzieć: akceptuj, odrzuć, pomiń lub pomoc.'
            }
        };

        const langResponses = responses[language] || responses.en;
        return langResponses[commandType] || langResponses[COMMAND_TYPES.UNKNOWN];
    }
};

module.exports = VoiceCommandParser;







