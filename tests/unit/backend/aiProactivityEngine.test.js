/**
 * AI Proactivity Engine Tests
 */

const AIProactivityEngine = require('../../../server/src/services/aiProactivityEngine');

describe('AIProactivityEngine', () => {
    describe('MODES', () => {
        it('should have all three proactivity modes defined', () => {
            expect(AIProactivityEngine.MODES.REACTIVE).toBe('REACTIVE');
            expect(AIProactivityEngine.MODES.BALANCED).toBe('BALANCED');
            expect(AIProactivityEngine.MODES.PROACTIVE).toBe('PROACTIVE');
        });
    });

    describe('getBehaviors', () => {
        it('should return REACTIVE behaviors with all disabled', () => {
            const behaviors = AIProactivityEngine.getBehaviors('REACTIVE');
            
            expect(behaviors.autoSuggest).toBe(false);
            expect(behaviors.nudges).toBe(false);
            expect(behaviors.contextualHints).toBe(false);
            expect(behaviors.initiateConversation).toBe(false);
        });

        it('should return BALANCED behaviors with partial features', () => {
            const behaviors = AIProactivityEngine.getBehaviors('BALANCED');
            
            expect(behaviors.autoSuggest).toBe(true);
            expect(behaviors.nudges).toBe(true);
            expect(behaviors.contextualHints).toBe(true);
            expect(behaviors.initiateConversation).toBe(false);
        });

        it('should return PROACTIVE behaviors with all enabled', () => {
            const behaviors = AIProactivityEngine.getBehaviors('PROACTIVE');
            
            expect(behaviors.autoSuggest).toBe(true);
            expect(behaviors.nudges).toBe(true);
            expect(behaviors.contextualHints).toBe(true);
            expect(behaviors.initiateConversation).toBe(true);
        });

        it('should return BALANCED as default for unknown mode', () => {
            const behaviors = AIProactivityEngine.getBehaviors('UNKNOWN');
            
            expect(behaviors).toEqual(AIProactivityEngine.BEHAVIORS.BALANCED);
        });
    });

    describe('getModeDescription', () => {
        it('should return description for REACTIVE mode', () => {
            const desc = AIProactivityEngine.getModeDescription('REACTIVE');
            
            expect(desc.title).toBe('Reactive');
            expect(desc.shortDescription).toContain('waits');
            expect(desc.icon).toBe('pause');
            expect(desc.color).toBe('gray');
            expect(desc.characteristics).toContain('Responds only when asked');
        });

        it('should return description for BALANCED mode', () => {
            const desc = AIProactivityEngine.getModeDescription('BALANCED');
            
            expect(desc.title).toBe('Balanced');
            expect(desc.shortDescription).toContain('suggests');
            expect(desc.icon).toBe('scale');
            expect(desc.color).toBe('purple');
        });

        it('should return description for PROACTIVE mode', () => {
            const desc = AIProactivityEngine.getModeDescription('PROACTIVE');
            
            expect(desc.title).toBe('Proactive');
            expect(desc.shortDescription).toContain('actively');
            expect(desc.icon).toBe('zap');
            expect(desc.color).toBe('green');
            expect(desc.characteristics).toContain('Proactively starts conversations');
        });
    });

    describe('getAllModes', () => {
        it('should return all modes with descriptions and behaviors', () => {
            const modes = AIProactivityEngine.getAllModes();
            
            expect(modes).toHaveLength(3);
            
            const reactive = modes.find(m => m.id === 'REACTIVE');
            expect(reactive).toBeDefined();
            expect(reactive.title).toBe('Reactive');
            expect(reactive.behaviors.autoSuggest).toBe(false);
            
            const balanced = modes.find(m => m.id === 'BALANCED');
            expect(balanced).toBeDefined();
            expect(balanced.title).toBe('Balanced');
            
            const proactive = modes.find(m => m.id === 'PROACTIVE');
            expect(proactive).toBeDefined();
            expect(proactive.title).toBe('Proactive');
            expect(proactive.behaviors.initiateConversation).toBe(true);
        });
    });

    describe('getProactivityPromptModifier', () => {
        it('should return REACTIVE prompt with restriction instructions', () => {
            const prompt = AIProactivityEngine.getProactivityPromptModifier('REACTIVE');
            
            expect(prompt).toContain('REACTIVE mode');
            expect(prompt).toContain('Only provide information when explicitly asked');
            expect(prompt).toContain('Do not offer unsolicited suggestions');
        });

        it('should return BALANCED prompt with moderate instructions', () => {
            const prompt = AIProactivityEngine.getProactivityPromptModifier('BALANCED');
            
            expect(prompt).toContain('BALANCED mode');
            expect(prompt).toContain('Provide helpful suggestions when they add clear value');
            expect(prompt).toContain('Let the user lead the conversation');
        });

        it('should return PROACTIVE prompt with active instructions', () => {
            const prompt = AIProactivityEngine.getProactivityPromptModifier('PROACTIVE');
            
            expect(prompt).toContain('PROACTIVE mode');
            expect(prompt).toContain('Actively identify opportunities to help');
            expect(prompt).toContain('anticipate user needs');
        });

        it('should return BALANCED as default for unknown mode', () => {
            const prompt = AIProactivityEngine.getProactivityPromptModifier('UNKNOWN');
            
            expect(prompt).toContain('BALANCED mode');
        });
    });

    describe('NUDGE_TYPES', () => {
        it('should have all nudge types defined', () => {
            expect(AIProactivityEngine.NUDGE_TYPES.DEADLINE_APPROACHING).toBeDefined();
            expect(AIProactivityEngine.NUDGE_TYPES.RISK_DETECTED).toBeDefined();
            expect(AIProactivityEngine.NUDGE_TYPES.OPTIMIZATION_OPPORTUNITY).toBeDefined();
            expect(AIProactivityEngine.NUDGE_TYPES.DOCUMENTATION_MISSING).toBeDefined();
            expect(AIProactivityEngine.NUDGE_TYPES.APPROVAL_NEEDED).toBeDefined();
            expect(AIProactivityEngine.NUDGE_TYPES.MILESTONE_UPCOMING).toBeDefined();
            expect(AIProactivityEngine.NUDGE_TYPES.RESOURCE_CONFLICT).toBeDefined();
            expect(AIProactivityEngine.NUDGE_TYPES.BUDGET_WARNING).toBeDefined();
        });
    });
});

