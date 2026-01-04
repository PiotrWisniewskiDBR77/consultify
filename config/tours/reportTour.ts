/**
 * Report Generation Tour
 *
 * Guides users through creating and customizing reports.
 */

import { TourConfig } from './types';

export const REPORT_TOUR: TourConfig = {
    id: 'report-generation',
    name: {
        en: 'Generate Your First Report',
        pl: 'Wygeneruj Pierwszy Raport',
    },
    description: {
        en: 'Learn how to create executive summaries, ROI reports, and custom analytics.',
        pl: 'Naucz się jak tworzyć podsumowania dla kadry zarządzającej, raporty ROI i niestandardowe analizy.',
    },
    targetAudience: ['user', 'admin'],
    estimatedDuration: 6,
    steps: [
        {
            id: 'overview',
            title: { en: 'Reports Center', pl: 'Centrum Raportów' },
            content: {
                en: 'The Reports Center provides comprehensive reporting on your transformation progress.',
                pl: 'Centrum Raportów dostarcza kompleksowe raportowanie postępu Twojej transformacji.',
            },
            target: '.reports-header',
            placement: 'bottom',
        },
        {
            id: 'standard',
            title: { en: 'Standard Reports', pl: 'Raporty Standardowe' },
            content: {
                en: 'Choose from pre-built reports: Executive Summary, Assessment Comparison, Initiative Status, and more.',
                pl: 'Wybierz z gotowych raportów: Podsumowanie dla Zarządu, Porównanie Ocen, Status Inicjatyw i więcej.',
            },
            target: '.report-templates',
            placement: 'right',
        },
        {
            id: 'roi',
            title: { en: 'ROI Calculator', pl: 'Kalkulator ROI' },
            content: {
                en: 'Calculate return on investment for your initiatives using NPV, payback period, and IRR.',
                pl: 'Oblicz zwrot z inwestycji dla swoich inicjatyw używając NPV, okresu zwrotu i IRR.',
            },
            target: '.roi-calculator',
            placement: 'left',
        },
        {
            id: 'customize',
            title: { en: 'Customize Report', pl: 'Dostosuj Raport' },
            content: {
                en: 'Select date range, sections to include, and branding options.',
                pl: 'Wybierz zakres dat, sekcje do uwzględnienia i opcje brandingu.',
            },
            target: '.report-customizer',
            placement: 'bottom',
        },
        {
            id: 'kpi',
            title: { en: 'KPI & OKR Tracking', pl: 'Śledzenie KPI i OKR' },
            content: {
                en: 'Track key performance indicators and objectives across your transformation.',
                pl: 'Śledź kluczowe wskaźniki wydajności i cele w całej transformacji.',
            },
            target: '.kpi-dashboard',
            placement: 'right',
        },
        {
            id: 'export',
            title: { en: 'Export & Share', pl: 'Eksportuj i Udostępnij' },
            content: {
                en: 'Export to PDF, PowerPoint, or Excel. Schedule automatic delivery to stakeholders.',
                pl: 'Eksportuj do PDF, PowerPoint lub Excel. Zaplanuj automatyczną dostawę do interesariuszy.',
            },
            target: '.export-options',
            placement: 'left',
        },
        {
            id: 'schedule',
            title: { en: 'Schedule Reports', pl: 'Zaplanuj Raporty' },
            content: {
                en: 'Set up recurring reports to be generated and emailed automatically.',
                pl: 'Skonfiguruj cykliczne raporty do automatycznego generowania i wysyłania emailem.',
            },
            target: '.schedule-button',
            placement: 'bottom',
        },
    ],
    prerequisites: ['assessment-flow'],
    completionActions: [
        {
            type: 'navigate',
            target: 'reports',
        },
    ],
};

export default REPORT_TOUR;
