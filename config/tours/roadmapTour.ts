/**
 * Roadmap Building Tour
 *
 * Guides users through creating and managing transformation roadmaps.
 */

import { TourConfig } from './types';

export const ROADMAP_TOUR: TourConfig = {
    id: 'roadmap-building',
    name: {
        en: 'Build Your Transformation Roadmap',
        pl: 'Zbuduj Mapę Drogową Transformacji',
    },
    description: {
        en: 'Learn how to create a strategic roadmap for your digital transformation journey.',
        pl: 'Naucz się jak stworzyć strategiczną mapę drogową dla Twojej podróży transformacji cyfrowej.',
    },
    targetAudience: ['user', 'admin'],
    estimatedDuration: 8,
    steps: [
        {
            id: 'overview',
            title: { en: 'Roadmap Overview', pl: 'Przegląd Mapy Drogowej' },
            content: {
                en: "The roadmap visualizes your transformation journey over time. Let's build one together.",
                pl: 'Mapa drogowa wizualizuje Twoją podróż transformacyjną w czasie. Zbudujmy jedną razem.',
            },
            target: '.roadmap-canvas',
            placement: 'center',
        },
        {
            id: 'phases',
            title: { en: 'Define Phases', pl: 'Zdefiniuj Fazy' },
            content: {
                en: 'Organize your roadmap into phases like Foundation, Growth, and Optimization.',
                pl: 'Zorganizuj mapę drogową w fazy jak Fundament, Wzrost i Optymalizacja.',
            },
            target: '.phase-editor',
            placement: 'right',
        },
        {
            id: 'add-initiatives',
            title: { en: 'Place Initiatives', pl: 'Umieść Inicjatywy' },
            content: {
                en: 'Drag initiatives onto the timeline. Position them in the appropriate phase.',
                pl: 'Przeciągnij inicjatywy na oś czasu. Umieść je w odpowiedniej fazie.',
            },
            target: '.initiative-sidebar',
            placement: 'left',
        },
        {
            id: 'dependencies',
            title: { en: 'Set Dependencies', pl: 'Ustaw Zależności' },
            content: {
                en: 'Connect initiatives that depend on each other. The system will warn about conflicts.',
                pl: 'Połącz inicjatywy, które zależą od siebie. System ostrzeże o konfliktach.',
            },
            target: '.dependency-line',
            placement: 'top',
        },
        {
            id: 'milestones',
            title: { en: 'Add Milestones', pl: 'Dodaj Kamienie Milowe' },
            content: {
                en: 'Mark key achievement points with milestones. These are great for stakeholder communication.',
                pl: 'Oznacz kluczowe punkty osiągnięć kamieniami milowymi. Są świetne do komunikacji z interesariuszami.',
            },
            target: '.milestone-button',
            placement: 'bottom',
        },
        {
            id: 'resources',
            title: { en: 'Resource Capacity', pl: 'Pojemność Zasobów' },
            content: {
                en: 'Enable the resource overlay to see capacity constraints and avoid overallocation.',
                pl: 'Włącz nakładkę zasobów, aby zobaczyć ograniczenia pojemności i uniknąć nadmiernej alokacji.',
            },
            target: '.resource-toggle',
            placement: 'left',
        },
        {
            id: 'export',
            title: { en: 'Share & Export', pl: 'Udostępnij i Eksportuj' },
            content: {
                en: 'Export your roadmap to PDF or PowerPoint for presentations and stakeholder reviews.',
                pl: 'Eksportuj mapę drogową do PDF lub PowerPoint do prezentacji i przeglądów z interesariuszami.',
            },
            target: '.export-button',
            placement: 'bottom',
        },
    ],
    prerequisites: ['initiative-creation'],
    completionActions: [
        {
            type: 'navigate',
            target: 'roadmap',
        },
    ],
};

export default ROADMAP_TOUR;



