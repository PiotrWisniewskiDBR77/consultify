import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ActionProposalEngine = require('../../server/ai/actionProposalEngine');

describe('ActionProposalEngine', () => {
    const mockContext = {
        orgId: 'legolex-v2',
        orgName: 'Legolex',
        timestamp: new Date().toISOString(),
        data: {
            users: [
                { id: 'user-001', first_name: 'Julia', last_name: 'Risk' },
                { id: 'user-002', first_name: 'Bob', last_name: 'Strong' },
                { id: 'user-003', first_name: 'Alice', last_name: 'Average' }
            ],
            task_distribution: {
                total: 15,
                by_status: { 'todo': 15 },
                by_priority: { 'high': 15 },
                user_load: {
                    'user-001': { total: 6, completed: 0, blocked: 0 },
                    'user-002': { total: 10, completed: 10, blocked: 0 },
                    'user-003': { total: 5, completed: 4, blocked: 0 }
                }
            },
            initiative_status: [
                { id: 'init-001', name: 'Blocked Project', status: 'BLOCKED', is_blocked: true, stale_days: 10 }
            ],
            help_completion_ratios: {
                'user-001': { ratio: 0.1, started: 2, completed: 0 }
            },
            metrics_funnel: {},
            recent_events: []
        }
    };

    it('should generate proposals for USER_AT_RISK', () => {
        const proposals = ActionProposalEngine.generateProposals(mockContext);

        const userAtRiskProposals = proposals.filter(p => p.origin_signal === 'USER_AT_RISK');
        expect(userAtRiskProposals.length).toBeGreaterThanOrEqual(1);

        const taskCreate = userAtRiskProposals.find(p => p.action_type === 'TASK_CREATE');
        expect(taskCreate).toBeDefined();
        expect(taskCreate.title).toContain('Julia');
        expect(taskCreate.scope).toBe('USER');

        const playbookAssign = userAtRiskProposals.find(p => p.action_type === 'PLAYBOOK_ASSIGN');
        expect(playbookAssign).toBeDefined();
    });

    it('should generate proposals for BLOCKED_INITIATIVE', () => {
        const proposals = ActionProposalEngine.generateProposals(mockContext);

        const blockedProposals = proposals.filter(p => p.origin_signal === 'BLOCKED_INITIATIVE');
        expect(blockedProposals.length).toBe(1);
        expect(blockedProposals[0].action_type).toBe('MEETING_SCHEDULE');
        expect(blockedProposals[0].title).toContain('Blocked Project');
    });

    it('should generate proposals for STRONG_TEAM_MEMBER', () => {
        const proposals = ActionProposalEngine.generateProposals(mockContext);

        const strongProposals = proposals.filter(p => p.origin_signal === 'STRONG_TEAM_MEMBER');
        expect(strongProposals.length).toBe(1);
        expect(strongProposals[0].action_type).toBe('ROLE_SUGGESTION');
        expect(strongProposals[0].title).toContain('Bob');
    });

    it('should be deterministic (return same output for same input)', () => {
        const output1 = ActionProposalEngine.generateProposals(mockContext);
        const output2 = ActionProposalEngine.generateProposals(mockContext);

        expect(JSON.stringify(output1)).toBe(JSON.stringify(output2));
    });

    it('should return sorted proposals by proposal_id', () => {
        const proposals = ActionProposalEngine.generateProposals(mockContext);
        const ids = proposals.map(p => p.proposal_id);
        const sortedIds = [...ids].sort();

        expect(ids).toEqual(sortedIds);
    });

    it('should adhere to the mandatory output model', () => {
        const proposals = ActionProposalEngine.generateProposals(mockContext);
        const p = proposals[0];

        expect(p).toHaveProperty('proposal_id');
        expect(p).toHaveProperty('origin_signal');
        expect(p).toHaveProperty('origin_recommendation');
        expect(p).toHaveProperty('title');
        expect(p).toHaveProperty('action_type');
        expect(p).toHaveProperty('scope');
        expect(p).toHaveProperty('payload_preview');
        expect(p).toHaveProperty('risk_level');
        expect(p).toHaveProperty('expected_impact');
        expect(p).toHaveProperty('simulation');
        expect(p.simulation).toHaveProperty('assumptions');
        expect(p.simulation).toHaveProperty('expected_direction');
        expect(p).toHaveProperty('requires_approval', true);
    });
});
