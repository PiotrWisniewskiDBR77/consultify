import * as megatrendModel from '../models/megatrend.js';
import logger from '../utils/Logger.js';

export interface MegatrendService {
  getBaselineTrends: (industry?: string) => Promise<unknown>;
  getRadarData: (industry?: string) => Promise<unknown>;
  getTrendDetail: (id: string) => Promise<unknown>;
  createCustomTrend: (data: unknown, companyId: string) => Promise<unknown>;
  updateCustomTrend: (id: string, data: unknown, companyId: string) => Promise<unknown>;
}

const requiredMethods = [
  'getBaselineTrends',
  'getRadarData',
  'getTrendDetail',
  'createCustomTrend',
  'updateCustomTrend',
] as const;

export const missingMegatrendMethods = requiredMethods.filter(
  (method) => typeof megatrendModel[method] !== 'function'
);

export const megatrendsAvailable = missingMegatrendMethods.length === 0;

if (!megatrendsAvailable) {
  logger.error('[Megatrend] Startup control failed: model exports are incomplete', {
    missingMethods: missingMegatrendMethods,
  });
}

export const megatrendService: MegatrendService | null = megatrendsAvailable
  ? {
      getBaselineTrends: megatrendModel.getBaselineTrends,
      getRadarData: megatrendModel.getRadarData,
      getTrendDetail: megatrendModel.getTrendDetail,
      createCustomTrend: megatrendModel.createCustomTrend,
      updateCustomTrend: megatrendModel.updateCustomTrend,
    }
  : null;
