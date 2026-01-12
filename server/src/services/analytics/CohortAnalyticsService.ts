import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';

export interface CohortAnalysisOptions {
    cohortMonths?: number;
    retentionMonths?: number;
}

export interface CohortData {
    period: { cohortMonths: number; retentionMonths: number };
    cohorts: Array<{
        cohort: string;
        startingCount: number;
        currentActive: number;
        retentionRate: string;
    }>;
}

export class CohortAnalyticsService {
    private db: IDatabase;

    constructor(db?: IDatabase) {
        this.db = db || getDatabase();
    }

    /**
     * Get cohort retention analysis
     */
    async getCohortAnalysis(options: CohortAnalysisOptions = {}): Promise<CohortData> {
        const { cohortMonths = 6, retentionMonths = 12 } = options;

        // Get cohorts (customers grouped by signup month)
        const orgs = await this.db.all<{
            cohort: string;
            org_id: string;
            created_at: string;
            current_status: string;
        }>(
            `SELECT 
                strftime('%Y-%m', o.created_at) as cohort,
                o.id as org_id,
                o.created_at,
                ob.status as current_status
             FROM organizations o
             LEFT JOIN organization_billing ob ON o.id = ob.organization_id
             WHERE o.created_at >= date('now', '-${cohortMonths} months')
             ORDER BY cohort ASC`,
            [],
        );

        // Group by cohort
        const cohorts: Record<
            string,
            {
                cohort: string;
                startingCount: number;
                organizations: Array<{ org_id: string; created_at: string; current_status: string }>;
            }
        > = {};

        (orgs || []).forEach((org) => {
            if (!cohorts[org.cohort]) {
                cohorts[org.cohort] = {
                    cohort: org.cohort,
                    startingCount: 0,
                    organizations: [],
                };
            }
            cohorts[org.cohort].startingCount++;
            cohorts[org.cohort].organizations.push(org);
        });

        // Calculate retention for each cohort
        const cohortData = Object.values(cohorts).map((cohort) => {
            const activeCount = cohort.organizations.filter((o) => o.current_status === 'active').length;

            return {
                cohort: cohort.cohort,
                startingCount: cohort.startingCount,
                currentActive: activeCount,
                retentionRate: cohort.startingCount > 0 ? ((activeCount / cohort.startingCount) * 100).toFixed(1) : '0',
            };
        });

        return {
            period: { cohortMonths, retentionMonths },
            cohorts: cohortData,
        };
    }
}
