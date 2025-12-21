import React from 'react';
import { Target, Cpu, Users, TrendingUp, Globe, Layers } from 'lucide-react';
import { EmptyStateWithActions } from './EmptyStateWithActions';

/**
 * AxisEmptyState — Empty state for DRD Axes view
 * 
 * Shows templates for quick axis creation.
 */

export interface AxisTemplate {
    id: string;
    name: string;
    description: string;
    suggestedPositions: string[];
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
}

export const AXIS_TEMPLATES: AxisTemplate[] = [
    {
        id: 'technology_investment',
        name: 'Inwestycje technologiczne',
        description: 'Jak alokować budżet na technologię?',
        suggestedPositions: [
            'Minimalna inwestycja - fokus na core business',
            'Umiarkowana - modernizacja kluczowych systemów',
            'Agresywna - pełna transformacja cyfrowa',
        ],
        icon: Cpu,
        color: 'blue',
    },
    {
        id: 'organizational_structure',
        name: 'Struktura organizacyjna',
        description: 'Jak powinniśmy się reorganizować?',
        suggestedPositions: [
            'Status quo - optymalizacja obecnej struktury',
            'Ewolucja - stopniowe zmiany',
            'Rewolucja - fundamentalna przebudowa',
        ],
        icon: Users,
        color: 'purple',
    },
    {
        id: 'market_expansion',
        name: 'Ekspansja rynkowa',
        description: 'Które rynki eksplorować?',
        suggestedPositions: [
            'Konsolidacja - umocnienie pozycji na obecnych rynkach',
            'Dywersyfikacja - nowe segmenty na obecnym rynku',
            'Ekspansja geograficzna - nowe kraje/regiony',
        ],
        icon: Globe,
        color: 'emerald',
    },
    {
        id: 'growth_strategy',
        name: 'Strategia wzrostu',
        description: 'Organiczny czy przez akwizycje?',
        suggestedPositions: [
            'Wzrost organiczny - budowanie wewnętrznych kompetencji',
            'Partnerstwa strategiczne - joint ventures i alianse',
            'M&A - akwizycje i fuzje',
        ],
        icon: TrendingUp,
        color: 'amber',
    },
    {
        id: 'product_strategy',
        name: 'Strategia produktowa',
        description: 'Gdzie skupić rozwój produktów?',
        suggestedPositions: [
            'Core - udoskonalanie głównych produktów',
            'Rozszerzenie - nowe warianty i funkcje',
            'Dywersyfikacja - zupełnie nowe produkty',
        ],
        icon: Layers,
        color: 'pink',
    },
];

interface AxisEmptyStateProps {
    onCreateAxis: () => void;
    onSelectTemplate: (template: AxisTemplate) => void;
}

export const AxisEmptyState: React.FC<AxisEmptyStateProps> = ({
    onCreateAxis,
    onSelectTemplate,
}) => {
    return (
        <EmptyStateWithActions
            icon={Target}
            title="Brak osi decyzyjnych"
            description="Oś decyzyjna to przestrzeń do ustrukturyzowania jednego tematu strategicznego. Zacznij od pustej osi lub wybierz gotowy szablon."
            actions={[
                {
                    label: 'Utwórz pustą oś',
                    onClick: onCreateAxis,
                    variant: 'primary',
                },
            ]}
            templates={AXIS_TEMPLATES.map(template => ({
                id: template.id,
                label: template.name,
                description: template.description,
                onClick: () => onSelectTemplate(template),
                icon: template.icon,
            }))}
        />
    );
};

export default AxisEmptyState;
