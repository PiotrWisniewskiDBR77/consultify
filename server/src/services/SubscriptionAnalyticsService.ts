import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import {
  ChurnAnalyticsService,
  ChurnRateData,
  ChurnRateOptions,
  ChurnReason,
} from './analytics/ChurnAnalyticsService.js';
import {
  CohortAnalysisOptions,
  CohortAnalyticsService,
  CohortData,
} from './analytics/CohortAnalyticsService.js';
import { LtvAnalyticsService, LTVData, LTVOptions } from './analytics/LtvAnalyticsService.js';
import {
  ExpansionRevenueData,
  ExpansionRevenueOptions,
  MrrAnalyticsService,
  MRRData,
  MRRMovement,
  MRRTrendData,
  MRRTrendOptions,
} from './analytics/MrrAnalyticsService.js';
import {
  CustomerCounts,
  SnapshotResult,
  SnapshotService,
  SubscriptionEventData,
} from './analytics/SnapshotService.js';

// Re-export types for backward compatibility
export type {
  ChurnRateData,
  ChurnRateOptions,
  ChurnReason,
  CohortAnalysisOptions,
  CohortData,
  CustomerCounts,
  ExpansionRevenueData,
  ExpansionRevenueOptions,
  LTVData,
  LTVOptions,
  MRRData,
  MRRMovement,
  MRRTrendData,
  MRRTrendOptions,
  SnapshotResult,
  SubscriptionEventData,
};

export interface RevenueForecast {
  projectedMRR: number;
  projectedARR: number;
  confidence: string;
  assumptions: string[];
}

export interface SubscriptionHealth {
  overall: 'healthy' | 'warning' | 'critical';
  metrics: {
    churnRate: number;
    mrrGrowth: number;
    ltv: number;
    ltvToCac: number | null;
  };
  recommendations: string[];
}

export interface SubscriptionAnalyticsDependencies {
  db: IDatabase;
  uuidv4: () => string;
}

class SubscriptionAnalyticsServiceClass {
  private deps: SubscriptionAnalyticsDependencies;
  private mrrService!: MrrAnalyticsService;
  private churnService!: ChurnAnalyticsService;
  private ltvService!: LtvAnalyticsService;
  private cohortService!: CohortAnalyticsService;
  private snapshotService!: SnapshotService;

  constructor(deps?: Partial<SubscriptionAnalyticsDependencies>) {
    this.deps = {
      db: deps?.db ?? getDatabase(),
      uuidv4: deps?.uuidv4 ?? uuidv4,
    };
    this.initializeServices();
  }

  private initializeServices() {
    this.mrrService = new MrrAnalyticsService(this.deps.db);
    this.churnService = new ChurnAnalyticsService(this.deps.db);
    this.ltvService = new LtvAnalyticsService(this.deps.db);
    this.cohortService = new CohortAnalyticsService(this.deps.db);
    this.snapshotService = new SnapshotService(this.deps.db, this.deps.uuidv4);
  }

  setDependencies(newDeps: Partial<SubscriptionAnalyticsDependencies>): void {
    this.deps = { ...this.deps, ...newDeps };
    this.initializeServices();
  }

  // Facade Methods

  async getCurrentMRR(): Promise<MRRData> {
    return this.mrrService.getCurrentMRR();
  }

  async getMRRTrend(options: MRRTrendOptions = {}): Promise<MRRTrendData> {
    return this.mrrService.getMRRTrend(options);
  }

  async getMRRHistory(options: MRRTrendOptions = {}): Promise<MRRTrendData> {
    return this.mrrService.getMRRTrend(options);
  }

  async calculateMRRMovement(startDate: string, endDate: string): Promise<MRRMovement> {
    return this.mrrService.calculateMRRMovement(startDate, endDate);
  }

  async getExpansionRevenue(options: ExpansionRevenueOptions = {}): Promise<ExpansionRevenueData> {
    return this.mrrService.getExpansionRevenue(options);
  }

  async getChurnRate(options: ChurnRateOptions = {}): Promise<ChurnRateData> {
    return this.churnService.getChurnRate(options);
  }

  async calculateChurnRate(options: ChurnRateOptions = {}): Promise<ChurnRateData> {
    return this.churnService.getChurnRate(options);
  }

  async getChurnAnalysis(options: ChurnRateOptions = {}): Promise<ChurnRateData> {
    return this.churnService.getChurnRate(options);
  }

  async getChurnReasons(options: { months?: number } = {}): Promise<ChurnReason[]> {
    return this.churnService.getChurnReasons(options);
  }

  async getLTV(options: LTVOptions = {}): Promise<LTVData> {
    const mrrData = await this.mrrService.getCurrentMRR();
    const churnData = await this.churnService.getChurnRate({ months: 12 });

    const currentArpa =
      mrrData.activeSubscriptions > 0 ? mrrData.totalMRR / mrrData.activeSubscriptions : 0;

    const monthlyChurnRate = parseFloat(churnData.averages.customerChurnRate) / 100 || 0.05;

    return this.ltvService.getLTV(options, currentArpa, monthlyChurnRate);
  }

  async calculateLTV(options: LTVOptions = {}): Promise<LTVData> {
    return this.getLTV(options);
  }

  async getLTVBySegment(segmentField: string = 'plan'): Promise<any[]> {
    return this.ltvService.getLTVBySegment(segmentField);
  }

  async getCohortAnalysis(options: CohortAnalysisOptions = {}): Promise<CohortData> {
    return this.cohortService.getCohortAnalysis(options);
  }

  async createDailySnapshot(): Promise<SnapshotResult> {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const mrrData = await this.mrrService.getCurrentMRR();
    const movement = await this.mrrService.calculateMRRMovement(startOfDay, endOfDay);

    return this.snapshotService.createDailySnapshot(mrrData, movement);
  }

  async getCustomerCounts(): Promise<CustomerCounts> {
    return this.snapshotService.getCustomerCounts();
  }

  async recordSubscriptionEvent(data: SubscriptionEventData): Promise<{ id: string }> {
    return this.snapshotService.recordSubscriptionEvent(data);
  }

  async getRevenueForecast(): Promise<RevenueForecast> {
    const mrrData = await this.mrrService.getCurrentMRR();
    const trend = await this.mrrService.getMRRTrend({ days: 90 });

    const avgGrowth = parseFloat(trend.summary.avgGrowth) || 0;
    const projectedMRR = mrrData.totalMRR * (1 + avgGrowth / 100);
    const projectedARR = projectedMRR * 12;

    return {
      projectedMRR: Math.round(projectedMRR),
      projectedARR: Math.round(projectedARR),
      confidence: avgGrowth > 0 ? 'medium' : 'low',
      assumptions: [
        'Current growth rate continues',
        'No major market changes',
        'Customer acquisition remains stable',
      ],
    };
  }

  async getSubscriptionHealth(): Promise<SubscriptionHealth> {
    const churnData = await this.churnService.getChurnRate({ months: 3 });
    const trend = await this.mrrService.getMRRTrend({ days: 30 });
    const ltvData = await this.getLTV();

    const churnRate = parseFloat(churnData.averages.customerChurnRate) || 0;
    const mrrGrowth = parseFloat(trend.summary.totalGrowth) || 0;
    const ltv = ltvData.ltv;
    const ltvToCac = ltvData.ltvToCac ? parseFloat(ltvData.ltvToCac) : null;

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];

    if (churnRate > 5) {
      overall = 'critical';
      recommendations.push('High churn rate detected - investigate cancellation reasons');
    } else if (churnRate > 3) {
      overall = 'warning';
      recommendations.push('Monitor churn rate - consider retention strategies');
    }

    if (mrrGrowth < 0) {
      overall = overall === 'healthy' ? 'warning' : 'critical';
      recommendations.push('Negative MRR growth - focus on expansion and retention');
    }

    if (ltvToCac && ltvToCac < 3) {
      overall = overall === 'healthy' ? 'warning' : overall;
      recommendations.push('LTV:CAC ratio below optimal - optimize acquisition costs');
    }

    return {
      overall,
      metrics: {
        churnRate,
        mrrGrowth,
        ltv,
        ltvToCac,
      },
      recommendations,
    };
  }
}

// Singleton instance
const subscriptionAnalyticsServiceInstance = new SubscriptionAnalyticsServiceClass();

// Export as default
export default subscriptionAnalyticsServiceInstance;

// Backward compatibility exports
export const setDependencies = (deps: Partial<SubscriptionAnalyticsDependencies>) =>
  subscriptionAnalyticsServiceInstance.setDependencies(deps);
export const getCurrentMRR = () => subscriptionAnalyticsServiceInstance.getCurrentMRR();
export const getMRRHistory = (opts?: MRRTrendOptions) =>
  subscriptionAnalyticsServiceInstance.getMRRHistory(opts);
export const calculateChurnRate = (opts?: ChurnRateOptions) =>
  subscriptionAnalyticsServiceInstance.calculateChurnRate(opts);
export const getChurnAnalysis = (opts?: ChurnRateOptions) =>
  subscriptionAnalyticsServiceInstance.getChurnAnalysis(opts);
export const calculateLTV = (opts?: LTVOptions) =>
  subscriptionAnalyticsServiceInstance.calculateLTV(opts);
export const getCohortAnalysis = (opts?: CohortAnalysisOptions) =>
  subscriptionAnalyticsServiceInstance.getCohortAnalysis(opts);
export const getRevenueForecast = () => subscriptionAnalyticsServiceInstance.getRevenueForecast();
export const getSubscriptionHealth = () =>
  subscriptionAnalyticsServiceInstance.getSubscriptionHealth();
