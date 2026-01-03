/**
 * Super Admin Onboarding Tour
 * 
 * Guides platform administrators through the super admin console.
 */

import { TourConfig } from './types';

export const SUPERADMIN_TOUR: TourConfig = {
    id: 'superadmin-onboarding',
    name: {
        en: 'Super Admin Console Overview',
        pl: 'Przegląd Konsoli Super Admina'
    },
    description: {
        en: 'Learn how to manage organizations, users, billing, and platform settings.',
        pl: 'Naucz się jak zarządzać organizacjami, użytkownikami, rozliczeniami i ustawieniami platformy.'
    },
    targetAudience: ['superadmin'],
    estimatedDuration: 15,
    showOnFirstVisit: true,
    steps: [
        {
            id: 'dashboard',
            title: { en: 'Platform Dashboard', pl: 'Dashboard Platformy' },
            content: {
                en: 'Welcome to the Super Admin Console. Here you can see platform-wide metrics and manage all organizations.',
                pl: 'Witaj w Konsoli Super Admina. Tutaj możesz zobaczyć metryki platformy i zarządzać wszystkimi organizacjami.'
            },
            target: '.superadmin-dashboard',
            placement: 'center'
        },
        {
            id: 'organizations',
            title: { en: 'Organization Management', pl: 'Zarządzanie Organizacjami' },
            content: {
                en: 'Create, modify, and manage all organizations on the platform.',
                pl: 'Twórz, modyfikuj i zarządzaj wszystkimi organizacjami na platformie.'
            },
            target: '.organizations-nav',
            placement: 'right'
        },
        {
            id: 'users',
            title: { en: 'Global User Management', pl: 'Globalne Zarządzanie Użytkownikami' },
            content: {
                en: 'Manage all users across organizations. Move users, reset passwords, and impersonate for support.',
                pl: 'Zarządzaj wszystkimi użytkownikami w organizacjach. Przenoś użytkowników, resetuj hasła i impersonuj do wsparcia.'
            },
            target: '.users-nav',
            placement: 'right'
        },
        {
            id: 'billing',
            title: { en: 'Billing Center', pl: 'Centrum Rozliczeń' },
            content: {
                en: 'Manage subscriptions, pricing, invoices, and revenue tracking.',
                pl: 'Zarządzaj subskrypcjami, cenami, fakturami i śledzeniem przychodów.'
            },
            target: '.billing-nav',
            placement: 'right'
        },
        {
            id: 'sso',
            title: { en: 'SSO Configuration', pl: 'Konfiguracja SSO' },
            content: {
                en: 'Set up Single Sign-On for organizations using Google Workspace or SAML.',
                pl: 'Skonfiguruj Single Sign-On dla organizacji używających Google Workspace lub SAML.'
            },
            target: '.sso-nav',
            placement: 'right'
        },
        {
            id: 'security',
            title: { en: 'Security Policies', pl: 'Polityki Bezpieczeństwa' },
            content: {
                en: 'Configure platform-wide and per-organization security policies.',
                pl: 'Skonfiguruj polityki bezpieczeństwa dla platformy i per organizacja.'
            },
            target: '.security-nav',
            placement: 'right'
        },
        {
            id: 'whitelabel',
            title: { en: 'White-label Studio', pl: 'Studio White-label' },
            content: {
                en: 'Customize branding, colors, and login pages for organizations.',
                pl: 'Dostosuj branding, kolory i strony logowania dla organizacji.'
            },
            target: '.whitelabel-nav',
            placement: 'right'
        },
        {
            id: 'ai-config',
            title: { en: 'AI Configuration', pl: 'Konfiguracja AI' },
            content: {
                en: 'Manage AI providers, model routing, and usage monitoring.',
                pl: 'Zarządzaj dostawcami AI, routingiem modeli i monitorowaniem użycia.'
            },
            target: '.ai-config-nav',
            placement: 'right'
        },
        {
            id: 'compliance',
            title: { en: 'Compliance Center', pl: 'Centrum Zgodności' },
            content: {
                en: 'Handle GDPR requests, compliance audits, and data protection.',
                pl: 'Obsługuj żądania GDPR, audyty zgodności i ochronę danych.'
            },
            target: '.compliance-nav',
            placement: 'right'
        },
        {
            id: 'settings',
            title: { en: 'System Settings', pl: 'Ustawienia Systemu' },
            content: {
                en: 'Configure platform identity, email settings, and advanced options.',
                pl: 'Skonfiguruj tożsamość platformy, ustawienia email i opcje zaawansowane.'
            },
            target: '.settings-nav',
            placement: 'right'
        }
    ],
    completionActions: [
        {
            type: 'navigate',
            target: 'superadmin-dashboard'
        }
    ]
};

export default SUPERADMIN_TOUR;








