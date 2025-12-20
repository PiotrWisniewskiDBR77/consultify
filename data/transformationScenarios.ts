
import { BrainCircuit, GitMerge, RefreshCw, Zap, TrendingUp, Layers, Activity } from 'lucide-react';

export interface ScenarioArchetype {
    id: 'stabilize' | 'quickwins' | 'hybrid' | 'foundation' | 'scale' | 'fullreset';
    name: string;
    icon: any;
    narrative: string;
    description: string;
    tags: string[];
    tempo: number; // 1-5
    ambition: number; // 1-5
    risk: number; // 1-5
    gains: string[];
    sacrifices: string[];
    impact: {
        management: string;
        operations: string;
        it: string;
        culture: string;
    };
    aiReasoning?: string[]; // Dynamic
}

export const SCENARIOS: ScenarioArchetype[] = [
    {
        id: 'stabilize',
        name: 'Stabilize & Optimize',
        icon: Activity,
        narrative: 'Najpierw porządek, potem ambicje.',
        description: 'Firma koncentruje się na stabilizacji procesów krytycznych, naprawie długu technologicznego i przygotowaniu organizacji pod przyszłe zmiany.',
        tags: ['Process', 'Compliance', 'Cleanup'],
        tempo: 2,
        ambition: 2,
        risk: 1,
        gains: ['Odzyskanie kontroli operacyjnej', 'Redukcja awaryjności', 'Klarowność procesów'],
        sacrifices: ['Brak efektu "WOW"', 'Opóźnienie innowacji o 6-12 msc', 'Frustracja "ambitnych" liderów'],
        impact: {
            management: 'Focus on governance',
            operations: 'Standardization',
            it: 'Debt reduction',
            culture: 'Discipline first'
        }
    },
    {
        id: 'quickwins',
        name: 'Quick Wins First',
        icon: Zap,
        narrative: 'Pokażmy efekt, żeby kupić czas.',
        description: 'Strategia punktowych wdrożeń (np. RPA, proste AI) w celu wygenerowania oszczędności finansujących dalszą transformację.',
        tags: ['ROI', 'Speed', 'Momentum'],
        tempo: 5,
        ambition: 2,
        risk: 2,
        gains: ['Natychmiastowe (3msc) zwroty', 'Budowa entuzjazmu zespołu', 'Niski koszt wejścia'],
        sacrifices: ['Rozwiązania wyspowe (silosy)', 'Dług technologiczny rośnie', 'Brak spójnej architektury'],
        impact: {
            management: 'Results-driven',
            operations: 'Efficiency spikes',
            it: 'Integration challenges',
            culture: 'Excitement'
        }
    },
    {
        id: 'hybrid',
        name: 'Balanced Hybrid Core',
        icon: GitMerge,
        narrative: 'Zmiana bez szoku, ale z kierunkiem.',
        description: 'Równoległe porządkowanie operacji (Core) i budowa nowych kompetencji cyfrowych na wydzielonym obszarze.',
        tags: ['Balance', 'Culture', 'Evolution'],
        tempo: 3,
        ambition: 3,
        risk: 2,
        gains: ['Kontrolowana zmiana', 'Mniejszy opór zespołu', 'Budowa fundamentów pod AI'],
        sacrifices: ['Wolniejsze tempo początkowe', 'Wymaga dwutorowego zarządzania', 'Ryzyko rozmycia priorytetów'],
        impact: {
            management: 'Dual focus',
            operations: 'Incremental',
            it: 'Modernization',
            culture: 'Gradual shift'
        }
    },
    {
        id: 'foundation',
        name: 'AI & Data Foundation',
        icon: Layers,
        narrative: 'Bez danych nie ma przyszłości.',
        description: 'Inwestycja w platformy danych, czyszczenie master data i analitykę przed jakimkolwiek wdrożeniem procesowym.',
        tags: ['Data', 'Architect', 'AI-Ready'],
        tempo: 2,
        ambition: 4,
        risk: 3,
        gains: ['Jakość danych = jakość AI', 'Skalowalność w przyszłości', 'Prawda o firmie (Data-Driven)'],
        sacrifices: ['Ogromne koszty niewidoczne dla biznesu', 'Nuda przez 9 miesięcy', 'Brak szybkich wyników'],
        impact: {
            management: 'Data literacy',
            operations: 'New metrics',
            it: 'Platform build',
            culture: 'Fact-based'
        }
    },
    {
        id: 'scale',
        name: 'Digital Scale-Up',
        icon: TrendingUp,
        narrative: 'Skalujemy to, co już działa.',
        description: 'Agresywne wdrażanie sprawdzonych technologii na całą organizację. Zakłada, że fundamenty już istnieją.',
        tags: ['Growth', 'Rollout', 'Speed'],
        tempo: 5,
        ambition: 4,
        risk: 3,
        gains: ['Szybkie zdobycie rynku', 'Efekty skali', 'Dominacja cyfrowa'],
        sacrifices: ['Wysokie ryzyko przepalenia zespołu', 'Kosztowne licencje', 'Chaos w trakcie wdrażania'],
        impact: {
            management: 'Change champions',
            operations: 'New SOPs',
            it: 'Support scaling',
            culture: 'Agility'
        }
    },
    {
        id: 'fullreset',
        name: 'Full Digital Reset',
        icon: RefreshCw,
        narrative: 'Zrywamy z przeszłością.',
        description: 'Budowa nowej organizacji obok starej ("Greenfield") lub całkowita wymiana systemów core (ERP replacement).',
        tags: ['Disruption', 'Greenfield', 'Reinvention'],
        tempo: 2, // Slow start
        ambition: 5,
        risk: 5,
        gains: ['Brak długu technologicznego', 'Idealne procesy', 'Organizacja przyszłości'],
        sacrifices: ['Paraliż decyzyjny', 'Koszt > budżet', 'Śmiertelne ryzyko porażki'],
        impact: {
            management: 'Visionary',
            operations: 'Reinvention',
            it: 'Cloud Native',
            culture: 'Shock therapy'
        }
    }
];

export const recommendScenario = (challenges: any[], profile: any): string => {
    // Simple mock logic for recommendation
    const highRisk = profile?.activeConstraints?.length > 3;
    const lowBudget = profile?.budget === 'Low';

    if (highRisk && lowBudget) return 'stabilize';
    if (!highRisk && lowBudget) return 'quickwins';
    if (highRisk && !lowBudget) return 'foundation';

    // Default safe bet
    return 'hybrid';
};
