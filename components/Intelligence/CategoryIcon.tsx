/**
 * CategoryIcon Component
 * 
 * Icons and configuration for insight categories
 */

import React from 'react';
import {
    Target,
    Users,
    AlertTriangle,
    FileQuestion,
    Lock,
    CheckCircle,
    GitBranch,
    Gauge
} from 'lucide-react';
import { InsightCategory, PMODomainId } from '../../types';

export interface CategoryConfig {
    id: InsightCategory;
    label: string;
    labelPl: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bgColor: string;
    textColor: string;
    pmoDomain: PMODomainId;
    description: string;
    descriptionPl: string;
}

export const INSIGHT_CATEGORIES: Record<InsightCategory, CategoryConfig> = {
    objective: {
        id: 'objective',
        label: 'Objectives',
        labelPl: 'Cele',
        icon: Target,
        color: 'emerald',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        pmoDomain: PMODomainId.BENEFITS_REALIZATION,
        description: 'Project goals and expected outcomes',
        descriptionPl: 'Cele projektu i oczekiwane rezultaty'
    },
    stakeholder: {
        id: 'stakeholder',
        label: 'Stakeholders',
        labelPl: 'Interesariusze',
        icon: Users,
        color: 'purple',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        textColor: 'text-purple-600 dark:text-purple-400',
        pmoDomain: PMODomainId.RESOURCE_RESPONSIBILITY,
        description: 'Key people and their roles',
        descriptionPl: 'Kluczowe osoby i ich role'
    },
    risk: {
        id: 'risk',
        label: 'Risks',
        labelPl: 'Ryzyka',
        icon: AlertTriangle,
        color: 'amber',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        textColor: 'text-amber-600 dark:text-amber-400',
        pmoDomain: PMODomainId.RISK_ISSUE_MANAGEMENT,
        description: 'Potential problems and mitigations',
        descriptionPl: 'Potencjalne problemy i sposoby ich mitygacji'
    },
    assumption: {
        id: 'assumption',
        label: 'Assumptions',
        labelPl: 'Założenia',
        icon: FileQuestion,
        color: 'sky',
        bgColor: 'bg-sky-100 dark:bg-sky-900/30',
        textColor: 'text-sky-600 dark:text-sky-400',
        pmoDomain: PMODomainId.SCOPE_CHANGE_CONTROL,
        description: 'Things assumed to be true',
        descriptionPl: 'Rzeczy przyjmowane za prawdziwe'
    },
    constraint: {
        id: 'constraint',
        label: 'Constraints',
        labelPl: 'Ograniczenia',
        icon: Lock,
        color: 'rose',
        bgColor: 'bg-rose-100 dark:bg-rose-900/30',
        textColor: 'text-rose-600 dark:text-rose-400',
        pmoDomain: PMODomainId.SCOPE_CHANGE_CONTROL,
        description: 'Limitations and boundaries',
        descriptionPl: 'Ograniczenia i granice'
    },
    decision: {
        id: 'decision',
        label: 'Decisions',
        labelPl: 'Decyzje',
        icon: CheckCircle,
        color: 'indigo',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
        textColor: 'text-indigo-600 dark:text-indigo-400',
        pmoDomain: PMODomainId.GOVERNANCE_DECISION_MAKING,
        description: 'Key decisions made',
        descriptionPl: 'Kluczowe podjęte decyzje'
    },
    dependency: {
        id: 'dependency',
        label: 'Dependencies',
        labelPl: 'Zależności',
        icon: GitBranch,
        color: 'orange',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        textColor: 'text-orange-600 dark:text-orange-400',
        pmoDomain: PMODomainId.SCHEDULE_MILESTONES,
        description: 'External dependencies',
        descriptionPl: 'Zależności zewnętrzne'
    },
    success_criteria: {
        id: 'success_criteria',
        label: 'Success Criteria',
        labelPl: 'Kryteria sukcesu',
        icon: Gauge,
        color: 'teal',
        bgColor: 'bg-teal-100 dark:bg-teal-900/30',
        textColor: 'text-teal-600 dark:text-teal-400',
        pmoDomain: PMODomainId.PERFORMANCE_MONITORING,
        description: 'How success is measured',
        descriptionPl: 'Jak mierzony jest sukces'
    }
};

export const getCategoryConfig = (category: InsightCategory): CategoryConfig => {
    return INSIGHT_CATEGORIES[category];
};

interface CategoryIconProps {
    category: InsightCategory;
    size?: number;
    className?: string;
    showBackground?: boolean;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
    category,
    size = 16,
    className = '',
    showBackground = false
}) => {
    const config = getCategoryConfig(category);
    const Icon = config.icon;

    if (showBackground) {
        return (
            <div className={`p-2 rounded-lg ${config.bgColor} ${className}`}>
                <Icon size={size} className={config.textColor} />
            </div>
        );
    }

    return <Icon size={size} className={`${config.textColor} ${className}`} />;
};

export default CategoryIcon;

