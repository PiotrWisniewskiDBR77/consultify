/**
 * PlaybookResolver Tests
 * 
 * Tests for playbook priority, conflict resolution, and recommendation logic.
 */

const PlaybookResolver = require('../../../server/services/playbookResolver');

// Mock HelpService
const mockHelpService = {
    getAvailablePlaybooks: vi.fn(),
    getUserProgress: vi.fn()
};

vi.mock('../../../server/services/helpService', () => ({
    default: mockHelpService
}));

describe('PlaybookResolver', () => {
    const mockContext = {
        orgType: 'PAID',
        role: 'client',
        userId: 'user-1',
        organizationId: 'org-1',
        currentRoute: '/dashboard'
    };

    const mockPlaybooks = [
        {
            key: 'first_value_checklist',
            title: 'First Value Checklist',
            description: 'Get started',
            priority: 1,
            status: 'AVAILABLE',
            targetOrgType: 'ANY',
            targetRole: 'ANY'
        },
        {
            key: 'invite_team_howto',
            title: 'Invite Team',
            description: 'How to invite team members',
            priority: 2,
            status: 'AVAILABLE',
            targetOrgType: 'PAID',
            targetRole: 'client'
        },
        {
            key: 'upgrade_prompt',
            title: 'Upgrade Now',
            description: 'Upgrade to premium',
            priority: 5,
            status: 'AVAILABLE',
            targetOrgType: 'TRIAL',
            targetRole: 'ANY'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getNextBestPlaybooks', () => {
        it('should return playbooks filtered by status', async () => {
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(mockPlaybooks);

            const result = await PlaybookResolver.getNextBestPlaybooks(mockContext);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeLessThanOrEqual(PlaybookResolver.MAX_CONCURRENT_PLAYBOOKS);
        });

        it('should filter out completed playbooks', async () => {
            const playbooksWithCompleted = [
                ...mockPlaybooks,
                {
                    key: 'completed_playbook',
                    status: 'DONE',
                    priority: 1
                }
            ];
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(playbooksWithCompleted);

            const result = await PlaybookResolver.getNextBestPlaybooks(mockContext);

            expect(result.every(p => p.status === 'AVAILABLE')).toBe(true);
        });

        it('should respect limit parameter', async () => {
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(mockPlaybooks);

            const result = await PlaybookResolver.getNextBestPlaybooks(mockContext, 2);

            expect(result.length).toBeLessThanOrEqual(2);
        });

        it('should prioritize playbooks by score', async () => {
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(mockPlaybooks);

            const result = await PlaybookResolver.getNextBestPlaybooks(mockContext);

            // Higher priority (lower number) should come first
            expect(result[0].priority).toBeLessThanOrEqual(result[result.length - 1]?.priority || 999);
        });

        it('should boost score for matching org type', async () => {
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(mockPlaybooks);

            const result = await PlaybookResolver.getNextBestPlaybooks(mockContext);

            // Playbook matching orgType should be prioritized
            const matchingPlaybook = result.find(p => p.targetOrgType === mockContext.orgType);
            expect(matchingPlaybook).toBeDefined();
        });

        it('should boost score for matching route', async () => {
            const routeSpecificPlaybook = {
                key: 'dashboard_guide',
                title: 'Dashboard Guide',
                priority: 3,
                status: 'AVAILABLE',
                targetRoute: '/dashboard',
                targetOrgType: 'ANY',
                targetRole: 'ANY'
            };
            mockHelpService.getAvailablePlaybooks.mockResolvedValue([
                ...mockPlaybooks,
                routeSpecificPlaybook
            ]);

            const result = await PlaybookResolver.getNextBestPlaybooks(mockContext);

            // Route-specific playbook should be prioritized
            expect(result.some(p => p.key === 'dashboard_guide')).toBe(true);
        });

        it('should limit upgrade prompts', async () => {
            const upgradePlaybooks = [
                { key: 'upgrade_1', priority: 5, status: 'AVAILABLE', targetOrgType: 'ANY' },
                { key: 'upgrade_2', priority: 5, status: 'AVAILABLE', targetOrgType: 'ANY' },
                { key: 'upgrade_3', priority: 5, status: 'AVAILABLE', targetOrgType: 'ANY' }
            ];
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(upgradePlaybooks);

            const result = await PlaybookResolver.getNextBestPlaybooks(mockContext);

            // Should limit upgrade prompts
            const upgradeCount = result.filter(p => 
                p.key.includes('upgrade') || p.key.includes('trial') || p.key.includes('demo')
            ).length;
            expect(upgradeCount).toBeLessThanOrEqual(1);
        });
    });

    describe('shouldShowPlaybook', () => {
        it('should return true for available playbook', async () => {
            mockHelpService.getUserProgress.mockResolvedValue({
                isCompleted: false,
                isDismissed: false
            });

            const result = await PlaybookResolver.shouldShowPlaybook(
                'user-1',
                'org-1',
                'test_playbook'
            );

            expect(result).toBe(true);
        });

        it('should return false for completed playbook', async () => {
            mockHelpService.getUserProgress.mockResolvedValue({
                isCompleted: true,
                isDismissed: false
            });

            const result = await PlaybookResolver.shouldShowPlaybook(
                'user-1',
                'org-1',
                'test_playbook'
            );

            expect(result).toBe(false);
        });

        it('should return false for dismissed playbook', async () => {
            mockHelpService.getUserProgress.mockResolvedValue({
                isCompleted: false,
                isDismissed: true
            });

            const result = await PlaybookResolver.shouldShowPlaybook(
                'user-1',
                'org-1',
                'test_playbook'
            );

            expect(result).toBe(false);
        });
    });

    describe('resolveConflicts', () => {
        it('should return empty array for empty input', () => {
            const result = PlaybookResolver.resolveConflicts([], mockContext);

            expect(result).toEqual([]);
        });

        it('should sort playbooks by score', () => {
            const playbooks = [
                { key: 'low_priority', priority: 5, targetOrgType: 'ANY' },
                { key: 'high_priority', priority: 1, targetOrgType: 'ANY' }
            ];

            const result = PlaybookResolver.resolveConflicts(playbooks, mockContext);

            expect(result[0].priority).toBeLessThan(result[1].priority);
        });

        it('should apply context scoring', () => {
            const playbooks = [
                { key: 'generic', priority: 3, targetOrgType: 'ANY', targetRole: 'ANY' },
                { key: 'specific', priority: 3, targetOrgType: 'PAID', targetRole: 'client' }
            ];

            const result = PlaybookResolver.resolveConflicts(playbooks, mockContext);

            // Specific match should score higher
            expect(result[0].key).toBe('specific');
        });
    });

    describe('resolveRecommended', () => {
        it('should return trial_expired_upgrade for expired trial', () => {
            const policySnapshot = {
                isTrial: true,
                isTrialExpired: true,
                trialDaysLeft: 0
            };
            const playbooks = [
                { key: 'trial_expired_upgrade' },
                { key: 'other_playbook' }
            ];

            const result = PlaybookResolver.resolveRecommended(playbooks, policySnapshot);

            expect(result).toBe('trial_expired_upgrade');
        });

        it('should return start_trial_from_demo for demo mode', () => {
            const policySnapshot = {
                isDemo: true,
                isTrial: false
            };
            const playbooks = [
                { key: 'start_trial_from_demo' },
                { key: 'other_playbook' }
            ];

            const result = PlaybookResolver.resolveRecommended(playbooks, policySnapshot);

            expect(result).toBe('start_trial_from_demo');
        });

        it('should return trial_last_week_upgrade for trial ending soon', () => {
            const policySnapshot = {
                isTrial: true,
                isTrialExpired: false,
                trialDaysLeft: 5
            };
            const playbooks = [
                { key: 'trial_last_week_upgrade' },
                { key: 'other_playbook' }
            ];

            const result = PlaybookResolver.resolveRecommended(playbooks, policySnapshot);

            expect(result).toBe('trial_last_week_upgrade');
        });

        it('should return invite_blocked_explained when invites blocked', () => {
            const policySnapshot = {
                blockedActions: ['INVITES']
            };
            const playbooks = [
                { key: 'invite_blocked_explained' },
                { key: 'other_playbook' }
            ];

            const result = PlaybookResolver.resolveRecommended(playbooks, policySnapshot);

            expect(result).toBe('invite_blocked_explained');
        });

        it('should return route-based recommendation for billing route', () => {
            const policySnapshot = {};
            const playbooks = [
                { key: 'billing_upgrade_howto' },
                { key: 'other_playbook' }
            ];

            const result = PlaybookResolver.resolveRecommended(playbooks, policySnapshot, '/billing');

            expect(result).toBe('billing_upgrade_howto');
        });

        it('should return first_value_checklist as default', () => {
            const policySnapshot = {};
            const playbooks = [
                { key: 'first_value_checklist' },
                { key: 'other_playbook' }
            ];

            const result = PlaybookResolver.resolveRecommended(playbooks, policySnapshot);

            expect(result).toBe('first_value_checklist');
        });

        it('should return null when no playbooks available', () => {
            const policySnapshot = {};
            const playbooks = [];

            const result = PlaybookResolver.resolveRecommended(playbooks, policySnapshot);

            expect(result).toBeNull();
        });
    });

    describe('getHelpHintForFeature', () => {
        it('should return hint for blocked feature', async () => {
            const context = {
                ...mockContext,
                blockedActions: ['INVITES']
            };
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(mockPlaybooks);

            const result = await PlaybookResolver.getHelpHintForFeature('INVITES', context);

            expect(result).toBeDefined();
            expect(result.isBlocked).toBe(true);
            expect(result.reason).toBeDefined();
        });

        it('should return null for unblocked feature without playbook', async () => {
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(mockPlaybooks);

            const result = await PlaybookResolver.getHelpHintForFeature('UNKNOWN_FEATURE', mockContext);

            expect(result).toBeNull();
        });

        it('should return playbook info when available', async () => {
            const playbooks = [
                {
                    key: 'invite_guide',
                    title: 'Invite Guide',
                    description: 'How to invite team members'
                }
            ];
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(playbooks);

            const result = await PlaybookResolver.getHelpHintForFeature('invite', mockContext);

            expect(result).toBeDefined();
            expect(result.playbook).toBeDefined();
            expect(result.playbook.key).toBe('invite_guide');
        });
    });

    describe('getRecommendedPlaybooks', () => {
        it('should return playbooks with recommendation flags', async () => {
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(mockPlaybooks);

            const result = await PlaybookResolver.getRecommendedPlaybooks(mockContext);

            expect(result.every(p => p.isRecommended === true)).toBe(true);
            expect(result.every(p => p.recommendationReason)).toBe(true);
        });

        it('should include recommendation reason', async () => {
            mockHelpService.getAvailablePlaybooks.mockResolvedValue(mockPlaybooks);

            const result = await PlaybookResolver.getRecommendedPlaybooks(mockContext);

            expect(result[0].recommendationReason).toBeDefined();
            expect(typeof result[0].recommendationReason).toBe('string');
        });
    });
});

