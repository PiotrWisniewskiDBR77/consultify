/**
 * AI Agent Service Tests
 * 
 * Tests for AI Agent service - initiative enrichment, session analysis, and assessment interviews.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../../../services/ai/agent';
import * as geminiModule from '../../../../services/ai/gemini';
import { FullInitiative, CompanyProfile, FullSession, InitiativeStatus } from '../../../../types';

// Mock gemini module
vi.mock('../../../../services/ai/gemini', () => ({
    sendMessageToAI: vi.fn()
}));

describe('Agent Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('enrichInitiativeWithAI', () => {
        const mockInitiative: Partial<FullInitiative> = {
            id: 'init-1',
            name: 'Digital Transformation',
            description: 'Generic transformation project'
        };

        const mockProfile: Partial<CompanyProfile> = {
            name: 'Test Company',
            industry: 'Manufacturing',
            country: 'Poland'
        };

        const mockSession: FullSession = {
            id: 'session-1',
            initiatives: [],
            economics: { overallROI: 0 }
        } as FullSession;

        it('should enrich initiative with AI-generated content', async () => {
            const mockResponse = JSON.stringify({
                description: 'Comprehensive digital transformation initiative',
                problemStatement: 'Current manual processes lead to inefficiencies',
                businessValue: 'High',
                deliverables: ['Automated Dashboard', 'New CRM Schema'],
                keyRisks: [
                    { risk: 'Technical complexity', mitigation: 'Phased approach', metric: 'Medium' }
                ],
                milestones: [
                    { name: 'Phase 1', date: '2024-Q2', status: 'pending' }
                ]
            });

            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue(mockResponse);

            const result = await Agent.enrichInitiativeWithAI(
                mockInitiative as FullInitiative,
                mockProfile,
                mockSession,
                'en'
            );

            expect(geminiModule.sendMessageToAI).toHaveBeenCalled();
            expect(result.description).toBeDefined();
            expect(result.businessValue).toBe('High');
            expect(result.deliverables).toBeInstanceOf(Array);
        });

        it('should handle JSON with markdown code blocks', async () => {
            const mockResponse = '```json\n{"description": "Test", "businessValue": "Medium"}\n```';
            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue(mockResponse);

            const result = await Agent.enrichInitiativeWithAI(
                mockInitiative as FullInitiative,
                mockProfile,
                mockSession
            );

            expect(result.description).toBe('Test');
            expect(result.businessValue).toBe('Medium');
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(geminiModule.sendMessageToAI).mockRejectedValue(new Error('AI Error'));

            const result = await Agent.enrichInitiativeWithAI(
                mockInitiative as FullInitiative,
                mockProfile,
                mockSession
            );

            expect(result).toEqual({});
        });

        it('should use correct language in prompt', async () => {
            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue('{"description": "Test"}');

            await Agent.enrichInitiativeWithAI(
                mockInitiative as FullInitiative,
                mockProfile,
                mockSession,
                'pl'
            );

            const callArgs = vi.mocked(geminiModule.sendMessageToAI).mock.calls[0];
            // Language is in the context message (2nd argument), not history (1st argument)
            expect(callArgs[1]).toContain('PL');
        });
    });

    describe('analyzeSessionForInsights', () => {
        const mockSession: FullSession = {
            id: 'session-1',
            initiatives: [
                { id: 'init-1', name: 'Initiative 1' } as FullInitiative
            ],
            economics: { overallROI: 25 }
        } as FullSession;

        it('should analyze session and return insights', async () => {
            const mockResponse = JSON.stringify([
                { type: 'risk', text: 'Budget mismatch detected', impact: 'High' },
                { type: 'opportunity', text: 'Fast track available', impact: 'Medium' }
            ]);

            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue(mockResponse);

            const result = await Agent.analyzeSessionForInsights(mockSession, 'Test Company', 'en');

            expect(geminiModule.sendMessageToAI).toHaveBeenCalled();
            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].type).toBe('risk');
        });

        it('should handle empty insights', async () => {
            vi.mocked(geminiModule.sendMessageToAI).mockRejectedValue(new Error('AI Error'));

            const result = await Agent.analyzeSessionForInsights(mockSession, 'Test Company');

            expect(result).toEqual([]);
        });

        it('should include session data in prompt', async () => {
            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue('[]');

            await Agent.analyzeSessionForInsights(mockSession, 'Test Company', 'en');

            const callArgs = vi.mocked(geminiModule.sendMessageToAI).mock.calls[0];
            expect(callArgs[1]).toContain('Test Company');
            expect(callArgs[1]).toContain('1 active');
            expect(callArgs[1]).toContain('25%');
        });
    });

    describe('conductAssessmentInterview', () => {
        const mockChatHistory = [
            { role: 'user' as const, text: 'We have basic processes' },
            { role: 'model' as const, text: 'Can you elaborate?' }
        ];

        it('should return next question when interview not finished', async () => {
            const mockResponse = JSON.stringify({
                isFinished: false,
                nextQuestion: 'What tools do you use?'
            });

            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue(mockResponse);

            const result = await Agent.conductAssessmentInterview('Process Maturity', mockChatHistory, 'en');

            expect(result.isFinished).toBe(false);
            expect(result.nextQuestion).toBe('What tools do you use?');
            expect(result.conclusion).toBeUndefined();
        });

        it('should return conclusion when interview finished', async () => {
            const mockResponse = JSON.stringify({
                isFinished: true,
                conclusion: {
                    score: 3.5,
                    reasoning: 'User has basics but lacks automation'
                }
            });

            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue(mockResponse);

            const result = await Agent.conductAssessmentInterview('Process Maturity', mockChatHistory, 'en');

            expect(result.isFinished).toBe(true);
            expect(result.conclusion).toBeDefined();
            expect(result.conclusion?.score).toBe(3.5);
            expect(result.nextQuestion).toBeUndefined();
        });

        it('should handle errors with fallback question', async () => {
            vi.mocked(geminiModule.sendMessageToAI).mockRejectedValue(new Error('AI Error'));

            const result = await Agent.conductAssessmentInterview('Process Maturity', mockChatHistory);

            expect(result.isFinished).toBe(false);
            expect(result.nextQuestion).toBeDefined();
        });

        it('should include chat history in prompt', async () => {
            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue('{"isFinished": false, "nextQuestion": "Test"}');

            await Agent.conductAssessmentInterview('Process Maturity', mockChatHistory, 'en');

            const callArgs = vi.mocked(geminiModule.sendMessageToAI).mock.calls[0];
            expect(callArgs[1]).toContain('USER: We have basic processes');
            expect(callArgs[1]).toContain('MODEL: Can you elaborate?');
        });

        it('should use correct language for Polish', async () => {
            vi.mocked(geminiModule.sendMessageToAI).mockResolvedValue('{"isFinished": false, "nextQuestion": "Test"}');

            await Agent.conductAssessmentInterview('Process Maturity', mockChatHistory, 'pl');

            const callArgs = vi.mocked(geminiModule.sendMessageToAI).mock.calls[0];
            expect(callArgs[1]).toContain('Polish');
        });
    });
});

