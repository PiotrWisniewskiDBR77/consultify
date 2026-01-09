/**
 * Gamification Achievements Configuration
 */

export interface Achievement {
    id: string;
    name: string;
    namePl?: string;
    description: string;
    descriptionPl?: string;
    icon: string;
    points: number;
    category: 'onboarding' | 'engagement' | 'mastery' | 'collaboration';
    condition: {
        type: string;
        value: number;
    };
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first-login',
        name: 'First Steps',
        namePl: 'Pierwsze kroki',
        description: 'Log in for the first time',
        descriptionPl: 'Zaloguj się po raz pierwszy',
        icon: '🚀',
        points: 10,
        category: 'onboarding',
        condition: { type: 'login_count', value: 1 },
    },
    {
        id: 'first-project',
        name: 'Project Pioneer',
        namePl: 'Pionier projektów',
        description: 'Create your first project',
        descriptionPl: 'Utwórz swój pierwszy projekt',
        icon: '📋',
        points: 25,
        category: 'onboarding',
        condition: { type: 'project_count', value: 1 },
    },
];

export const getAchievements = () => ACHIEVEMENTS;
export const getAchievementById = (id: string) => ACHIEVEMENTS.find(a => a.id === id);



