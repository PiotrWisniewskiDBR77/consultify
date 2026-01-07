/**
 * Activation Milestones Configuration
 * Used for user journey tracking
 */

export interface ActivationMilestone {
    id: string;
    name: string;
    namePl?: string;
    description: string;
    descriptionPl?: string;
    requiredActions: string[];
    weight: number;
    order: number;
}

export const ACTIVATION_MILESTONES: ActivationMilestone[] = [
    {
        id: 'profile-complete',
        name: 'Complete Profile',
        namePl: 'Uzupełnij profil',
        description: 'Fill in your profile information',
        descriptionPl: 'Uzupełnij informacje o profilu',
        requiredActions: ['upload_avatar', 'add_bio', 'set_timezone'],
        weight: 10,
        order: 1,
    },
    {
        id: 'first-project',
        name: 'Create First Project',
        namePl: 'Utwórz pierwszy projekt',
        description: 'Create your first project',
        descriptionPl: 'Utwórz swój pierwszy projekt',
        requiredActions: ['create_project'],
        weight: 20,
        order: 2,
    },
    {
        id: 'first-assessment',
        name: 'Complete First Assessment',
        namePl: 'Ukończ pierwszą ocenę',
        description: 'Complete your first assessment',
        descriptionPl: 'Ukończ swoją pierwszą ocenę',
        requiredActions: ['complete_assessment'],
        weight: 30,
        order: 3,
    },
    {
        id: 'invite-team',
        name: 'Invite Team Members',
        namePl: 'Zaproś członków zespołu',
        description: 'Invite at least one team member',
        descriptionPl: 'Zaproś przynajmniej jednego członka zespołu',
        requiredActions: ['send_invite'],
        weight: 15,
        order: 4,
    },
    {
        id: 'ai-interaction',
        name: 'Use AI Assistant',
        namePl: 'Użyj asystenta AI',
        description: 'Have a conversation with the AI assistant',
        descriptionPl: 'Przeprowadź rozmowę z asystentem AI',
        requiredActions: ['ai_conversation'],
        weight: 25,
        order: 5,
    },
];

export const getActivationMilestones = () => ACTIVATION_MILESTONES;
export const getMilestoneById = (id: string) => ACTIVATION_MILESTONES.find(m => m.id === id);
export const calculateJourneyProgress = (completedActions: string[]): number => {
    let totalWeight = 0;
    let completedWeight = 0;

    for (const milestone of ACTIVATION_MILESTONES) {
        totalWeight += milestone.weight;
        const isComplete = milestone.requiredActions.every(action => completedActions.includes(action));
        if (isComplete) {
            completedWeight += milestone.weight;
        }
    }

    return totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
};

export const isPhaseActivated = (phaseId: string, completedActions: string[]): boolean => {
    const milestone = ACTIVATION_MILESTONES.find(m => m.id === phaseId);
    if (!milestone) return false;
    return milestone.requiredActions.every(action => completedActions.includes(action));
};

