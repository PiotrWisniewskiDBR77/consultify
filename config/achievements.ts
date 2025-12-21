import { Zap, Target, Users, Layout, BookOpen, Flag, Award, Sparkles } from 'lucide-react';

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    category: 'onboarding' | 'social' | 'expert' | 'power';
}

export const ACHIEVEMENTS: Achievement[] = [
    // Onboarding
    {
        id: 'first_steps',
        title: 'Pierwsze Kroki',
        description: 'Ukończono pierwszą trasę onboardingową',
        icon: Flag,
        category: 'onboarding'
    },
    {
        id: 'axis_creator',
        title: 'Architekt',
        description: 'Utworzono pierwszą Oś Decyzyjną',
        icon: Layout,
        category: 'onboarding'
    },

    // Social
    {
        id: 'team_player',
        title: 'Gracz Zespołowy',
        description: 'Zaproszono pierwszego członka zespołu',
        icon: Users,
        category: 'social'
    },
    {
        id: 'collaborator',
        title: 'Dyskutant',
        description: 'Dodano 5 komentarzy w dyskusjach',
        icon: MessageSquare,
        category: 'social'
    },

    // Expert
    {
        id: 'strategist',
        title: 'Strateg',
        description: 'Zdefiniowano poziomy Actual i Target dla osi',
        icon: Target,
        category: 'expert'
    },
    {
        id: 'quick_learner',
        title: 'Prymusek',
        description: 'Przeczytaj 5 artykułów pomocy',
        icon: BookOpen,
        category: 'expert'
    },

    // Power
    {
        id: 'streak_master',
        title: 'Konsekwentny',
        description: 'Logowanie przez 3 dni z rzędu',
        icon: Zap,
        category: 'power'
    },
    {
        id: 'phase_completer',
        title: 'Zwycięzca Fazy',
        description: 'Ukończono fazę E',
        icon: Award,
        category: 'power'
    }
];

// Helper to get achievement details
export const getAchievement = (id: string) => ACHIEVEMENTS.find(a => a.id === id);

// Temporary icon fix import
import { MessageSquare } from 'lucide-react';
