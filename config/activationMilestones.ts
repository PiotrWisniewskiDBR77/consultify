/**
 * Activation Milestones Configuration
 * 
 * Defines what "activated" means for each phase.
 * Used for:
 * - Dashboard metrics
 * - PQL scoring
 * - Conversion analysis
 */

export interface Milestone {
    id: string;
    name: string;
    description: string;
    required?: boolean;
}

export interface PhaseActivation {
    phase: string;
    phaseName: string;
    milestones: Milestone[];
    activatedWhen: string[];  // Milestone IDs that define activation
}

export const ACTIVATION_MILESTONES: Record<string, PhaseActivation> = {
    A: {
        phase: 'A',
        phaseName: 'Pre-Entry',
        milestones: [
            { id: 'cta_clicked', name: 'CTA Clicked', description: 'User clicked main CTA on landing page', required: true },
        ],
        activatedWhen: ['cta_clicked'],
    },

    B: {
        phase: 'B',
        phaseName: 'Demo Session',
        milestones: [
            { id: 'demo_started', name: 'Demo Started', description: 'User entered demo mode', required: true },
            { id: 'viewed_3_pages', name: 'Viewed 3+ Pages', description: 'User explored at least 3 demo pages' },
            { id: 'used_ai_narrator', name: 'Used AI Narrator', description: 'User interacted with AI explanations' },
            { id: 'demo_completed', name: 'Demo Completed', description: 'User spent >5 min in demo' },
            { id: 'tour_completed', name: 'Tour Completed', description: 'User completed demo tour' },
        ],
        activatedWhen: ['demo_started', 'viewed_3_pages'],
    },

    C: {
        phase: 'C',
        phaseName: 'Trial Entry',
        milestones: [
            { id: 'code_entered', name: 'Code Entered', description: 'User entered access code', required: true },
            { id: 'trial_started', name: 'Trial Started', description: 'Trial session activated', required: true },
            { id: 'confirmations_accepted', name: 'Confirmations Accepted', description: 'User accepted transition confirmations' },
        ],
        activatedWhen: ['code_entered', 'trial_started'],
    },

    D: {
        phase: 'D',
        phaseName: 'Organization Setup',
        milestones: [
            { id: 'org_name_set', name: 'Organization Named', description: 'User set organization name' },
            { id: 'role_selected', name: 'Role Selected', description: 'User selected their role' },
            { id: 'context_set', name: 'Context Set', description: 'User provided organization context' },
            { id: 'memory_activated', name: 'Memory Activated', description: 'User confirmed memory activation', required: true },
        ],
        activatedWhen: ['memory_activated'],
    },

    E: {
        phase: 'E',
        phaseName: 'Guided First Value',
        milestones: [
            { id: 'first_axis_created', name: 'First Axis Created', description: 'User created first DRD axis' },
            { id: 'first_position_added', name: 'First Position Added', description: 'User added first position to axis' },
            { id: 'ai_question_answered', name: 'AI Question Answered', description: 'User responded to AI thinking partner' },
            { id: 'snapshot_created', name: 'Snapshot Created', description: 'User created first snapshot', required: true },
            { id: 'tour_first_value_completed', name: 'First Value Tour', description: 'User completed first value tour' },
        ],
        activatedWhen: ['first_axis_created', 'snapshot_created'],
    },

    F: {
        phase: 'F',
        phaseName: 'Team Expansion',
        milestones: [
            { id: 'invite_sent', name: 'Invite Sent', description: 'User sent team invitation' },
            { id: 'second_user_joined', name: 'Second User Joined', description: 'Another team member joined', required: true },
            { id: 'multi_perspective_view', name: 'Multi-Perspective View', description: 'User viewed multiple perspectives' },
            { id: 'ai_facilitation_used', name: 'AI Facilitation Used', description: 'User used AI facilitation features' },
        ],
        activatedWhen: ['second_user_joined'],
    },
};

/**
 * Get activation criteria for a phase
 */
export const getActivationCriteria = (phase: string): string[] => {
    return ACTIVATION_MILESTONES[phase]?.activatedWhen || [];
};

/**
 * Check if user is activated based on completed milestones
 */
export const isPhaseActivated = (phase: string, completedMilestones: string[]): boolean => {
    const criteria = getActivationCriteria(phase);
    return criteria.every(milestone => completedMilestones.includes(milestone));
};

/**
 * Get all milestones for a phase
 */
export const getPhaseMilestones = (phase: string): Milestone[] => {
    return ACTIVATION_MILESTONES[phase]?.milestones || [];
};

/**
 * Get required milestones for a phase
 */
export const getRequiredMilestones = (phase: string): Milestone[] => {
    return getPhaseMilestones(phase).filter(m => m.required);
};

export default ACTIVATION_MILESTONES;
