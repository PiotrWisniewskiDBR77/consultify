/**
 * Assessment Knowledge Base - Unified Exports
 *
 * Provides knowledge (questions, examples, technologies) for all frameworks.
 */

export type { ADMADimensionLevelKey, ADMALevelKnowledge } from './admaKnowledge';
export { getADMAKnowledge, getADMAPillarInfo } from './admaKnowledge';
export type { DRDAreaLevelKey, DRDLevelKnowledge } from './drdKnowledge';
export { getDRDKnowledge } from './drdKnowledge';
export type { LeanLevelKnowledge, LeanWasteKnowledge } from './leanKnowledge';
export { getLeanKnowledge, getLeanLevelMeaning, getLeanWasteKnowledge } from './leanKnowledge';
export type { SIRIDimensionLevelKey, SIRILevelKnowledge } from './siriKnowledge';
export { getSIRIBuildingBlockInfo, getSIRIKnowledge } from './siriKnowledge';
export type {
  MaturityPathwayFramework,
  MaturityPathwayInput,
  MaturityPathwayRecommendation,
} from './maturityPathwayService';
export { getMaturityPathway } from './maturityPathwayService';

/**
 * Universal knowledge getter for any framework
 */
export type FrameworkLevelKnowledge = {
  questions: [string, string, string];
  example: string;
  suggestedTechnologies: string[];
};

export function getFrameworkKnowledge(
  framework: string,
  dimensionId: string,
  levelNumber: number
): FrameworkLevelKnowledge {
  switch (framework.toLowerCase()) {
    case 'drd': {
      const { getDRDKnowledge: get } = require('./drdKnowledge');
      return get(dimensionId, levelNumber);
    }
    case 'siri': {
      const { getSIRIKnowledge: get } = require('./siriKnowledge');
      return get(dimensionId, levelNumber);
    }
    case 'adma': {
      const { getADMAKnowledge: get } = require('./admaKnowledge');
      return get(dimensionId, levelNumber);
    }
    case 'lean': {
      const { getLeanKnowledge: get } = require('./leanKnowledge');
      const parts = dimensionId.split('#');
      const knowledge = get(parts[0] || 'MEASURE', parts[1] || 'PROCESSES', levelNumber);
      return {
        questions: knowledge.coachQuestions,
        example: knowledge.evidenceGuidance,
        suggestedTechnologies: [],
      };
    }
    default:
      return {
        questions: [
          'Is this level achieved?',
          'Do we have evidence?',
          'Is it consistently applied?',
        ],
        example: 'Provide evidence confirming this maturity level.',
        suggestedTechnologies: ['Process Documentation', 'KPI Dashboard'],
      };
  }
}
