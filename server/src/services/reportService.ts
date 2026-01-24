import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js'; // Fallback
import type { IDatabase } from '../database/IDatabase.js';
import {
  CreateReportData,
  Report,
  ReportDefinitionService,
  ReportFilter,
  UpdateReportData,
} from './report/ReportDefinitionService.js';
import { ReportExecution, ReportExecutionService } from './report/ReportExecutionService.js';
import { ReportExportService } from './report/ReportExportService.js';
import { ReportGeneratorService } from './report/ReportGeneratorService.js';

/**
 * ReportService Facade
 *
 * Orchestrates:
 * - ReportDefinitionService (CRUD)
 * - ReportExecutionService (Execution History)
 * - ReportGeneratorService (Data Fetching)
 * - ReportExportService (CSV Export)
 */
export class ReportService {
  private definitionService: ReportDefinitionService;
  private executionService: ReportExecutionService;
  private generatorService: ReportGeneratorService;
  private exportService: ReportExportService;

  // Maintain internal DB reference for backward compatibility (some callers might access it)
  private _db: IDatabase | null = null;
  private _uuidv4: (() => string) | null = null;

  constructor() {
    // Initialize services with default dependencies (which will use lazy defaults if not provided)
    this.definitionService = new ReportDefinitionService();
    this.executionService = new ReportExecutionService();
    this.generatorService = new ReportGeneratorService();
    this.exportService = new ReportExportService();
  }

  /**
   * Backward compatibility: expose db getter/setter
   */
  get db(): IDatabase {
    if (!this._db) {
      this._db = getDatabase();
    }
    return this._db!;
  }

  set db(val: IDatabase) {
    this._db = val;
    // Propagate to sub-services
    this.updateDependencies();
  }

  /**
   * Initialize dependencies (Backward compatibility)
   */
  async init() {
    // Ensure DB is loaded
    if (!this._db) {
      this._db = getDatabase();
    }
    this.updateDependencies();
  }

  /**
   * Inject dependencies for testing
   */
  setDependencies(deps: { db?: IDatabase; uuidv4?: () => string }) {
    if (deps.db) this._db = deps.db;
    if (deps.uuidv4) this._uuidv4 = deps.uuidv4;
    this.updateDependencies();
  }

  private updateDependencies() {
    const deps = {
      db: this._db || undefined,
      uuidv4: this._uuidv4 || undefined,
    };
    // Re-instantiate or update services if they had setter methods (they don't currently, so re-instantiating is safer or we add setDeps)
    // For now, let's just re-instantiate since they are cheap
    this.definitionService = new ReportDefinitionService(deps);
    this.executionService = new ReportExecutionService(deps);
    this.generatorService = new ReportGeneratorService(deps);
    // Export service has no deps
  }

  // --- Delegation to ReportDefinitionService ---

  async getReports(filters: ReportFilter = {}) {
    await this.init();
    return this.definitionService.getReports(filters);
  }

  async getReportById(reportId: string) {
    await this.init();
    return this.definitionService.getReportById(reportId);
  }

  async createReport(data: CreateReportData, userId: string) {
    await this.init();
    return this.definitionService.createReport(data, userId);
  }

  async updateReport(reportId: string, data: UpdateReportData) {
    await this.init();
    return this.definitionService.updateReport(reportId, data);
  }

  async deleteReport(reportId: string) {
    await this.init();
    return this.definitionService.deleteReport(reportId);
  }

  async getScheduledReportsToRun() {
    await this.init();
    return this.definitionService.getScheduledReportsToRun();
  }

  // --- Delegation to ReportExecutionService & Generator ---

  async executeReport(reportId: string) {
    await this.init();
    const report = await this.definitionService.getReportById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    const executionId = await this.executionService.startExecution(reportId);

    try {
      // Generate data
      const filters = report.filters || {};
      const columns = report.columns || [];

      // Casting filters to any because generator expects generic object but filters is ReportFilter
      const result = await this.generateReportData(report.reportType, filters, columns);

      await this.executionService.completeExecution(executionId, result);

      return { executionId, status: 'completed', result };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.executionService.failExecution(executionId, err);
      throw err;
    }
  }

  async getReportExecutions(reportId: string, limit: number = 20) {
    await this.init();
    return this.executionService.getReportExecutions(reportId, limit);
  }

  // --- Delegation to ReportGeneratorService ---

  async generateReportData(reportType: string, filters: any, columns: any[]) {
    await this.init();
    return this.generatorService.generateReportData(reportType, filters, columns);
  }

  // --- Delegation to ReportExportService ---

  exportToCsv(reportData: any) {
    return this.exportService.exportToCsv(reportData);
  }
}

// Export singleton instance for backward compatibility
const reportServiceInstance = new ReportService();
export default reportServiceInstance;
