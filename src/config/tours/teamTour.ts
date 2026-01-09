/**
 * Team Tour Configuration
 * Tour for team collaboration features
 */

export interface TourStep {
    target: string;
    title: string;
    titlePl?: string;
    content: string;
    contentPl?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const TEAM_TOUR: TourStep[] = [
    {
        target: '[data-tour="team-members"]',
        title: 'Team Members',
        titlePl: 'Członkowie zespołu',
        content: 'See all your team members and their roles.',
        contentPl: 'Zobacz wszystkich członków zespołu i ich role.',
        placement: 'right',
    },
    {
        target: '[data-tour="invite"]',
        title: 'Invite Team Members',
        titlePl: 'Zaproś członków zespołu',
        content: 'Invite new team members to collaborate on projects.',
        contentPl: 'Zaproś nowych członków zespołu do współpracy przy projektach.',
        placement: 'bottom',
    },
];

export const getTeamTour = () => TEAM_TOUR;



