import { FullSession, FullInitiative, AxisId } from '../types';
import { DRD_STRUCTURE, DRDLevel } from './drdStructure';

export const generateInitiatives = (session: FullSession): FullInitiative[] => {
    const initiatives: FullInitiative[] = [];
    const axisMap: Record<number, AxisId> = {
        1: 'processes',
        2: 'digitalProducts',
        3: 'businessModels',
        4: 'dataManagement',
        5: 'culture',
        6: 'cybersecurity',
        7: 'aiMaturity'
    };

    DRD_STRUCTURE.forEach(axis => {
        const axisKey = axisMap[axis.id];
        if (!axisKey) return;

        const axisData = session.assessment[axisKey];
        if (!axisData || !axisData.areaScores) return;

        axis.areas.forEach(area => {
            const currentLevel = axisData.areaScores![area.id] || 0;

            // Find levels above current
            const nextLevels = area.levels.filter(l => l.level > currentLevel);

            // Strategy: Suggest the IMMEDIATE next level as the initiative.
            // We could suggest all gaps, but usually you plan for the next step.
            if (nextLevels.length > 0) {
                const nextLevel = nextLevels[0]; // The immediate next step

                initiatives.push({
                    id: `init-${area.id}-${nextLevel.level}-${Date.now()}`,
                    name: `Advance ${area.name} to Level ${nextLevel.level}`,
                    description: `${nextLevel.title}. ${nextLevel.description}`,
                    axis: axisKey,
                    priority: currentLevel === 0 ? 'High' : (currentLevel < 3 ? 'Medium' : 'Low'), // Basic logic: urgent if 0
                    complexity: nextLevel.level > 4 ? 'High' : (nextLevel.level > 2 ? 'Medium' : 'Low'),
                    status: 'Draft',
                    estimatedCost: nextLevel.level * 10000, // Placeholder
                    estimatedAnnualBenefit: nextLevel.level * 20000, // Placeholder
                    notes: `Generated based on current level ${currentLevel}.`
                });
            }
        });
    });

    return initiatives;
};
