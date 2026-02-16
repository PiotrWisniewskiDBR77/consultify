/**
 * Assessment Knowledge Base - Unified Exports
 *
 * Provides knowledge (questions, examples, technologies) for all frameworks.
 */

export type { ADMADimensionLevelKey, ADMALevelKnowledge } from './admaKnowledge';
export { getADMAKnowledge, getADMAPillarInfo } from './admaKnowledge';
export type { DRDAreaLevelKey, DRDLevelKnowledge } from './drdKnowledge';
export { getDRDKnowledge } from './drdKnowledge';
export type { SIRIDimensionLevelKey, SIRILevelKnowledge } from './siriKnowledge';
export { getSIRIBuildingBlockInfo, getSIRIKnowledge } from './siriKnowledge';

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
