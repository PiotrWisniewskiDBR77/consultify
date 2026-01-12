/**
 * Admin Setup Tour
 *
 * Guides administrators through initial organization setup.
 */

import { TourConfig } from './types';

export const ADMIN_SETUP_TOUR: TourConfig = {
    id: 'admin-setup',
    name: {
        en: 'Set Up Your Organization',
        pl: 'Skonfiguruj Swoją Organizację',
    },
    description: {
        en: 'Learn how to configure your organization, invite users, and set up integrations.',
        pl: 'Naucz się jak skonfigurować organizację, zaprosić użytkowników i ustawić integracje.',
    },
    targetAudience: ['admin'],
    estimatedDuration: 12,
    showOnFirstVisit: true,
    steps: [
        {
            id: 'welcome',
            title: { en: 'Welcome, Administrator!', pl: 'Witaj, Administratorze!' },
            content: {
                en: "As an admin, you can manage users, configure settings, and monitor your organization's transformation progress.",
                pl: 'Jako administrator możesz zarządzać użytkownikami, konfigurować ustawienia i monitorować postęp transformacji organizacji.',
            },
            target: '.admin-dashboard',
            placement: 'center',
        },
        {
            id: 'org-context',
            title: { en: 'Organization Context', pl: 'Kontekst Organizacji' },
            content: {
                en: 'First, complete your organization context. This improves AI recommendations significantly.',
                pl: 'Najpierw uzupełnij kontekst organizacji. To znacząco poprawia rekomendacje AI.',
            },
            target: '.org-context-card',
            placement: 'right',
        },
        {
            id: 'invite-users',
            title: { en: 'Invite Team Members', pl: 'Zaproś Członków Zespołu' },
            content: {
                en: 'Invite your team to collaborate on assessments and initiatives.',
                pl: 'Zaproś swój zespół do współpracy nad ocenami i inicjatywami.',
            },
            target: '.invite-users-button',
            placement: 'bottom',
        },
        {
            id: 'roles',
            title: { en: 'Assign Roles', pl: 'Przypisz Role' },
            content: {
                en: 'Choose appropriate roles for each user: Admin, Project Manager, Team Member, or Viewer.',
                pl: 'Wybierz odpowiednie role dla każdego użytkownika: Admin, Project Manager, Team Member lub Viewer.',
            },
            target: '.role-selector',
            placement: 'left',
        },
        {
            id: 'work-mode',
            title: { en: 'Work Mode Settings', pl: 'Ustawienia Trybu Pracy' },
            content: {
                en: 'Configure how your organization structures work - by locations, projects, or both.',
                pl: 'Skonfiguruj jak Twoja organizacja strukturyzuje pracę - według lokalizacji, projektów lub obu.',
            },
            target: '.work-mode-settings',
            placement: 'right',
        },
        {
            id: 'ai-config',
            title: { en: 'AI Configuration', pl: 'Konfiguracja AI' },
            content: {
                en: 'Set up AI provider credentials and configure usage limits.',
                pl: 'Skonfiguruj dane uwierzytelniające dostawcy AI i ustaw limity użycia.',
            },
            target: '.ai-config-card',
            placement: 'left',
        },
        {
            id: 'knowledge-base',
            title: { en: 'Knowledge Base', pl: 'Baza Wiedzy' },
            content: {
                en: 'Upload organization documents to enhance AI recommendations.',
                pl: 'Prześlij dokumenty organizacji, aby ulepszyć rekomendacje AI.',
            },
            target: '.knowledge-base-card',
            placement: 'right',
        },
        {
            id: 'integrations',
            title: { en: 'Integrations', pl: 'Integracje' },
            content: {
                en: 'Connect with Slack, Teams, Jira, and other tools your team uses.',
                pl: 'Połącz się ze Slack, Teams, Jira i innymi narzędziami używanymi przez Twój zespół.',
            },
            target: '.integrations-card',
            placement: 'bottom',
        },
        {
            id: 'complete',
            title: { en: "You're Ready!", pl: 'Jesteś Gotowy!' },
            content: {
                en: 'Your organization is set up. Start your first assessment or explore the dashboard.',
                pl: 'Twoja organizacja jest skonfigurowana. Rozpocznij pierwszą ocenę lub eksploruj dashboard.',
            },
            placement: 'center',
        },
    ],
    completionActions: [
        {
            type: 'navigate',
            target: 'admin-dashboard',
        },
    ],
};

export default ADMIN_SETUP_TOUR;

