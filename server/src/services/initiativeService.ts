import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.ts';
import {
    CreateInitiativeData,
    Initiative,
    InitiativeDefinitionService,
    UpdateInitiativeData,
} from './initiative/InitiativeDefinitionService.js';
import { InitiativeFinancialService } from './initiative/InitiativeFinancialService.js';
import { InitiativeProgressService } from './initiative/InitiativeProgressService.js';
import { InitiativeRiskService } from './initiative/InitiativeRiskService.js';

export class InitiativeService {
    public definition: InitiativeDefinitionService;
    public progress: InitiativeProgressService;
    public financial: InitiativeFinancialService;
    public risk: InitiativeRiskService;

    // Internal dependencies management for backward compatibility
    private _db: IDatabase | null = null;
    private _uuidv4: (() => string) | null = null;

    constructor() {
        this.definition = new InitiativeDefinitionService();
        this.progress = new InitiativeProgressService();
        this.financial = new InitiativeFinancialService();
        this.risk = new InitiativeRiskService();
    }

    /**
     * Set dependencies for testing or explicit injection
     */
    setDependencies(deps: { db?: IDatabase; uuidv4?: () => string }) {
        if (deps.db) this._db = deps.db;
        if (deps.uuidv4) this._uuidv4 = deps.uuidv4;

        const effectiveDeps = {
            db: this._db || getDatabase(),
            uuidv4: this._uuidv4 || uuidv4,
        };

        this.definition.setDependencies(effectiveDeps);
        this.progress.setDependencies({ db: effectiveDeps.db });
        this.financial.setDependencies({ db: effectiveDeps.db });
        this.risk.setDependencies({ db: effectiveDeps.db });
    }

    // --- Definition / CRUD ---

    async getInitiatives(organizationId: string, limit?: number, offset?: number): Promise<Initiative[]> {
        return this.definition.getInitiatives(organizationId, limit, offset);
    }

    async getInitiativeById(id: string, organizationId?: string): Promise<Initiative | null> {
        return this.definition.getInitiativeById(id, organizationId);
    }

    async createInitiative(data: CreateInitiativeData): Promise<Initiative> {
        return this.definition.createInitiative(data);
    }

    /**
     * @deprecated Experimental CQRS implementation - use ONLY for testing for now
     */
    async createInitiativeViaCQRS(data: CreateInitiativeData): Promise<{ id: string }> {
        const { commandBus } = await import('./cqrs/index.js');
        const { CreateInitiativeCommand } = await import('./cqrs/initiative/CreateInitiative.js');

        const command = new CreateInitiativeCommand(
            data.title,
            data.project_id || '', // Start assuming project_id
            data.owner_id || '',
            data.summary,
            data.start_date,
            data.end_date,
            data.cost_capex,
        );

        return commandBus.execute(command) as Promise<{ id: string }>;
    }

    async updateInitiative(id: string, data: UpdateInitiativeData, organizationId?: string): Promise<boolean> {
        return this.definition.updateInitiative(id, data, organizationId);
    }

    async deleteInitiative(id: string, organizationId?: string): Promise<boolean> {
        return this.definition.deleteInitiative(id, organizationId);
    }

    // --- Progress ---

    async recalculateProgress(params: string | { organizationId: string; initiativeId: string }): Promise<number> {
        // Backward compatibility handling
        let organizationId: string | undefined;
        let initiativeId: string;

        if (typeof params === 'string') {
            initiativeId = params;
            logger.warn('[InitiativeService] DEPRECATION WARNING: recalculateProgress called without organizationId');
        } else {
            organizationId = params.organizationId;
            initiativeId = params.initiativeId;
        }

        return this.progress.recalculateProgress(initiativeId, organizationId);
    }

    // --- Financial ---
    async updateFinancials(initiativeId: string, capex: number, opex: number, expectedRoi: number): Promise<boolean> {
        return this.financial.updateFinancials(initiativeId, capex, opex, expectedRoi);
    }

    async getFinancialStats(organizationId: string) {
        return this.financial.getFinancialStats(organizationId);
    }
}

// Export singleton for backward compatibility (simulating cached instance)
const instance = new InitiativeService();
export default instance;
