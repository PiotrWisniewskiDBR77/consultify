declare namespace _default {
    export { FrameworkBenchmarkService };
    export { BENCHMARK_DATA };
    export { REGION_MODIFIERS };
    export { SIZE_MODIFIERS };
}
export default _default;
export class FrameworkBenchmarkService {
    /**
     * Get benchmark data for a framework and industry
     * @param {string} framework - Framework ID
     * @param {string} industry - Industry sector
     * @param {Object} options - Additional options (region, size)
     * @returns {Object} Benchmark data
     */
    static getBenchmark(framework: string, industry: string, options?: Object): Object;
    /**
     * Calculate percentile rank for a score
     * @param {string} framework - Framework ID
     * @param {number} score - Assessment score
     * @param {string} industry - Industry sector
     * @param {Object} options - Additional options
     * @returns {Object} Percentile information
     */
    static calculatePercentile(framework: string, score: number, industry: string, options?: Object): Object;
    /**
     * Get label for percentile
     */
    static getPercentileLabel(percentile: any): "Industry Leader" | "Above Average" | "Average" | "Below Average" | "Laggard";
    /**
     * Compare assessment to benchmark with detailed breakdown
     * @param {string} framework - Framework ID
     * @param {Object} scoreResult - Score calculation result
     * @param {string} industry - Industry sector
     * @param {Object} options - Additional options
     * @returns {Object} Comparison data
     */
    static compareToIndustry(framework: string, scoreResult: Object, industry: string, options?: Object): Object;
    /**
     * Get industry list for a framework
     * @param {string} framework - Framework ID
     * @returns {Array} Available industries
     */
    static getAvailableIndustries(framework: string): any[];
    /**
     * Get regional comparison
     * @param {string} framework - Framework ID
     * @param {number} score - Assessment score
     * @param {string} industry - Industry sector
     * @returns {Object} Regional comparison
     */
    static getRegionalComparison(framework: string, score: number, industry: string): Object;
}
export namespace BENCHMARK_DATA {
    namespace SIRI {
        namespace manufacturing_discrete {
            let overall: number;
            namespace buildingBlocks {
                let PROCESS: number;
                let TECHNOLOGY: number;
                let ORGANIZATION: number;
            }
            namespace percentiles {
                let p25: number;
                let p50: number;
                let p75: number;
                let p90: number;
            }
            let sampleSize: number;
            let lastUpdated: string;
        }
        namespace manufacturing_process {
            let overall_1: number;
            export { overall_1 as overall };
            export namespace buildingBlocks_1 {
                let PROCESS_1: number;
                export { PROCESS_1 as PROCESS };
                let TECHNOLOGY_1: number;
                export { TECHNOLOGY_1 as TECHNOLOGY };
                let ORGANIZATION_1: number;
                export { ORGANIZATION_1 as ORGANIZATION };
            }
            export { buildingBlocks_1 as buildingBlocks };
            export namespace percentiles_1 {
                let p25_1: number;
                export { p25_1 as p25 };
                let p50_1: number;
                export { p50_1 as p50 };
                let p75_1: number;
                export { p75_1 as p75 };
                let p90_1: number;
                export { p90_1 as p90 };
            }
            export { percentiles_1 as percentiles };
            let sampleSize_1: number;
            export { sampleSize_1 as sampleSize };
            let lastUpdated_1: string;
            export { lastUpdated_1 as lastUpdated };
        }
        namespace automotive {
            let overall_2: number;
            export { overall_2 as overall };
            export namespace buildingBlocks_2 {
                let PROCESS_2: number;
                export { PROCESS_2 as PROCESS };
                let TECHNOLOGY_2: number;
                export { TECHNOLOGY_2 as TECHNOLOGY };
                let ORGANIZATION_2: number;
                export { ORGANIZATION_2 as ORGANIZATION };
            }
            export { buildingBlocks_2 as buildingBlocks };
            export namespace percentiles_2 {
                let p25_2: number;
                export { p25_2 as p25 };
                let p50_2: number;
                export { p50_2 as p50 };
                let p75_2: number;
                export { p75_2 as p75 };
                let p90_2: number;
                export { p90_2 as p90 };
            }
            export { percentiles_2 as percentiles };
            let sampleSize_2: number;
            export { sampleSize_2 as sampleSize };
            let lastUpdated_2: string;
            export { lastUpdated_2 as lastUpdated };
        }
        namespace aerospace {
            let overall_3: number;
            export { overall_3 as overall };
            export namespace buildingBlocks_3 {
                let PROCESS_3: number;
                export { PROCESS_3 as PROCESS };
                let TECHNOLOGY_3: number;
                export { TECHNOLOGY_3 as TECHNOLOGY };
                let ORGANIZATION_3: number;
                export { ORGANIZATION_3 as ORGANIZATION };
            }
            export { buildingBlocks_3 as buildingBlocks };
            export namespace percentiles_3 {
                let p25_3: number;
                export { p25_3 as p25 };
                let p50_3: number;
                export { p50_3 as p50 };
                let p75_3: number;
                export { p75_3 as p75 };
                let p90_3: number;
                export { p90_3 as p90 };
            }
            export { percentiles_3 as percentiles };
            let sampleSize_3: number;
            export { sampleSize_3 as sampleSize };
            let lastUpdated_3: string;
            export { lastUpdated_3 as lastUpdated };
        }
        namespace electronics {
            let overall_4: number;
            export { overall_4 as overall };
            export namespace buildingBlocks_4 {
                let PROCESS_4: number;
                export { PROCESS_4 as PROCESS };
                let TECHNOLOGY_4: number;
                export { TECHNOLOGY_4 as TECHNOLOGY };
                let ORGANIZATION_4: number;
                export { ORGANIZATION_4 as ORGANIZATION };
            }
            export { buildingBlocks_4 as buildingBlocks };
            export namespace percentiles_4 {
                let p25_4: number;
                export { p25_4 as p25 };
                let p50_4: number;
                export { p50_4 as p50 };
                let p75_4: number;
                export { p75_4 as p75 };
                let p90_4: number;
                export { p90_4 as p90 };
            }
            export { percentiles_4 as percentiles };
            let sampleSize_4: number;
            export { sampleSize_4 as sampleSize };
            let lastUpdated_4: string;
            export { lastUpdated_4 as lastUpdated };
        }
        namespace _global {
            let overall_5: number;
            export { overall_5 as overall };
            export namespace buildingBlocks_5 {
                let PROCESS_5: number;
                export { PROCESS_5 as PROCESS };
                let TECHNOLOGY_5: number;
                export { TECHNOLOGY_5 as TECHNOLOGY };
                let ORGANIZATION_5: number;
                export { ORGANIZATION_5 as ORGANIZATION };
            }
            export { buildingBlocks_5 as buildingBlocks };
            export namespace percentiles_5 {
                let p25_5: number;
                export { p25_5 as p25 };
                let p50_5: number;
                export { p50_5 as p50 };
                let p75_5: number;
                export { p75_5 as p75 };
                let p90_5: number;
                export { p90_5 as p90 };
            }
            export { percentiles_5 as percentiles };
            let sampleSize_5: number;
            export { sampleSize_5 as sampleSize };
            let lastUpdated_5: string;
            export { lastUpdated_5 as lastUpdated };
        }
    }
    namespace ADMA {
        export namespace manufacturing_discrete_1 {
            let overall_6: number;
            export { overall_6 as overall };
            export namespace pillars {
                let strategy: number;
                let smart_products: number;
                let smart_operations: number;
                let smart_supply: number;
                let data_driven: number;
            }
            export namespace percentiles_6 {
                let p25_6: number;
                export { p25_6 as p25 };
                let p50_6: number;
                export { p50_6 as p50 };
                let p75_6: number;
                export { p75_6 as p75 };
                let p90_6: number;
                export { p90_6 as p90 };
            }
            export { percentiles_6 as percentiles };
            let sampleSize_6: number;
            export { sampleSize_6 as sampleSize };
            let lastUpdated_6: string;
            export { lastUpdated_6 as lastUpdated };
        }
        export { manufacturing_discrete_1 as manufacturing_discrete };
        export namespace manufacturing_process_1 {
            let overall_7: number;
            export { overall_7 as overall };
            export namespace pillars_1 {
                let strategy_1: number;
                export { strategy_1 as strategy };
                let smart_products_1: number;
                export { smart_products_1 as smart_products };
                let smart_operations_1: number;
                export { smart_operations_1 as smart_operations };
                let smart_supply_1: number;
                export { smart_supply_1 as smart_supply };
                let data_driven_1: number;
                export { data_driven_1 as data_driven };
            }
            export { pillars_1 as pillars };
            export namespace percentiles_7 {
                let p25_7: number;
                export { p25_7 as p25 };
                let p50_7: number;
                export { p50_7 as p50 };
                let p75_7: number;
                export { p75_7 as p75 };
                let p90_7: number;
                export { p90_7 as p90 };
            }
            export { percentiles_7 as percentiles };
            let sampleSize_7: number;
            export { sampleSize_7 as sampleSize };
            let lastUpdated_7: string;
            export { lastUpdated_7 as lastUpdated };
        }
        export { manufacturing_process_1 as manufacturing_process };
        export namespace _global_1 {
            let overall_8: number;
            export { overall_8 as overall };
            export namespace pillars_2 {
                let strategy_2: number;
                export { strategy_2 as strategy };
                let smart_products_2: number;
                export { smart_products_2 as smart_products };
                let smart_operations_2: number;
                export { smart_operations_2 as smart_operations };
                let smart_supply_2: number;
                export { smart_supply_2 as smart_supply };
                let data_driven_2: number;
                export { data_driven_2 as data_driven };
            }
            export { pillars_2 as pillars };
            export namespace percentiles_8 {
                let p25_8: number;
                export { p25_8 as p25 };
                let p50_8: number;
                export { p50_8 as p50 };
                let p75_8: number;
                export { p75_8 as p75 };
                let p90_8: number;
                export { p90_8 as p90 };
            }
            export { percentiles_8 as percentiles };
            let sampleSize_8: number;
            export { sampleSize_8 as sampleSize };
            let lastUpdated_8: string;
            export { lastUpdated_8 as lastUpdated };
        }
        export { _global_1 as _global };
    }
    namespace CMMI {
        export namespace software {
            let overall_9: number;
            export { overall_9 as overall };
            export namespace categories {
                let DOING: number;
                let MANAGING: number;
                let ENABLING: number;
            }
            export namespace percentiles_9 {
                let p25_9: number;
                export { p25_9 as p25 };
                let p50_9: number;
                export { p50_9 as p50 };
                let p75_9: number;
                export { p75_9 as p75 };
                let p90_9: number;
                export { p90_9 as p90 };
            }
            export { percentiles_9 as percentiles };
            let sampleSize_9: number;
            export { sampleSize_9 as sampleSize };
            let lastUpdated_9: string;
            export { lastUpdated_9 as lastUpdated };
        }
        export namespace it_services {
            let overall_10: number;
            export { overall_10 as overall };
            export namespace categories_1 {
                let DOING_1: number;
                export { DOING_1 as DOING };
                let MANAGING_1: number;
                export { MANAGING_1 as MANAGING };
                let ENABLING_1: number;
                export { ENABLING_1 as ENABLING };
            }
            export { categories_1 as categories };
            export namespace percentiles_10 {
                let p25_10: number;
                export { p25_10 as p25 };
                let p50_10: number;
                export { p50_10 as p50 };
                let p75_10: number;
                export { p75_10 as p75 };
                let p90_10: number;
                export { p90_10 as p90 };
            }
            export { percentiles_10 as percentiles };
            let sampleSize_10: number;
            export { sampleSize_10 as sampleSize };
            let lastUpdated_10: string;
            export { lastUpdated_10 as lastUpdated };
        }
        export namespace defense {
            let overall_11: number;
            export { overall_11 as overall };
            export namespace categories_2 {
                let DOING_2: number;
                export { DOING_2 as DOING };
                let MANAGING_2: number;
                export { MANAGING_2 as MANAGING };
                let ENABLING_2: number;
                export { ENABLING_2 as ENABLING };
            }
            export { categories_2 as categories };
            export namespace percentiles_11 {
                let p25_11: number;
                export { p25_11 as p25 };
                let p50_11: number;
                export { p50_11 as p50 };
                let p75_11: number;
                export { p75_11 as p75 };
                let p90_11: number;
                export { p90_11 as p90 };
            }
            export { percentiles_11 as percentiles };
            let sampleSize_11: number;
            export { sampleSize_11 as sampleSize };
            let lastUpdated_11: string;
            export { lastUpdated_11 as lastUpdated };
        }
        export namespace _global_2 {
            let overall_12: number;
            export { overall_12 as overall };
            export namespace categories_3 {
                let DOING_3: number;
                export { DOING_3 as DOING };
                let MANAGING_3: number;
                export { MANAGING_3 as MANAGING };
                let ENABLING_3: number;
                export { ENABLING_3 as ENABLING };
            }
            export { categories_3 as categories };
            export namespace percentiles_12 {
                let p25_12: number;
                export { p25_12 as p25 };
                let p50_12: number;
                export { p50_12 as p50 };
                let p75_12: number;
                export { p75_12 as p75 };
                let p90_12: number;
                export { p90_12 as p90 };
            }
            export { percentiles_12 as percentiles };
            let sampleSize_12: number;
            export { sampleSize_12 as sampleSize };
            let lastUpdated_12: string;
            export { lastUpdated_12 as lastUpdated };
        }
        export { _global_2 as _global };
    }
    namespace LEAN {
        export namespace manufacturing_discrete_2 {
            let overall_13: number;
            export { overall_13 as overall };
            export namespace phases {
                let MEASURE: number;
                let OPTIMIZE: number;
                let AUTOMATE: number;
            }
            export namespace percentiles_13 {
                let p25_13: number;
                export { p25_13 as p25 };
                let p50_13: number;
                export { p50_13 as p50 };
                let p75_13: number;
                export { p75_13 as p75 };
                let p90_13: number;
                export { p90_13 as p90 };
            }
            export { percentiles_13 as percentiles };
            export namespace automationPotential {
                let high: number;
                let medium: number;
                let low: number;
            }
            let sampleSize_13: number;
            export { sampleSize_13 as sampleSize };
            let lastUpdated_13: string;
            export { lastUpdated_13 as lastUpdated };
        }
        export { manufacturing_discrete_2 as manufacturing_discrete };
        export namespace manufacturing_process_2 {
            let overall_14: number;
            export { overall_14 as overall };
            export namespace phases_1 {
                let MEASURE_1: number;
                export { MEASURE_1 as MEASURE };
                let OPTIMIZE_1: number;
                export { OPTIMIZE_1 as OPTIMIZE };
                let AUTOMATE_1: number;
                export { AUTOMATE_1 as AUTOMATE };
            }
            export { phases_1 as phases };
            export namespace percentiles_14 {
                let p25_14: number;
                export { p25_14 as p25 };
                let p50_14: number;
                export { p50_14 as p50 };
                let p75_14: number;
                export { p75_14 as p75 };
                let p90_14: number;
                export { p90_14 as p90 };
            }
            export { percentiles_14 as percentiles };
            export namespace automationPotential_1 {
                let high_1: number;
                export { high_1 as high };
                let medium_1: number;
                export { medium_1 as medium };
                let low_1: number;
                export { low_1 as low };
            }
            export { automationPotential_1 as automationPotential };
            let sampleSize_14: number;
            export { sampleSize_14 as sampleSize };
            let lastUpdated_14: string;
            export { lastUpdated_14 as lastUpdated };
        }
        export { manufacturing_process_2 as manufacturing_process };
        export namespace _global_3 {
            let overall_15: number;
            export { overall_15 as overall };
            export namespace phases_2 {
                let MEASURE_2: number;
                export { MEASURE_2 as MEASURE };
                let OPTIMIZE_2: number;
                export { OPTIMIZE_2 as OPTIMIZE };
                let AUTOMATE_2: number;
                export { AUTOMATE_2 as AUTOMATE };
            }
            export { phases_2 as phases };
            export namespace percentiles_15 {
                let p25_15: number;
                export { p25_15 as p25 };
                let p50_15: number;
                export { p50_15 as p50 };
                let p75_15: number;
                export { p75_15 as p75 };
                let p90_15: number;
                export { p90_15 as p90 };
            }
            export { percentiles_15 as percentiles };
            export namespace automationPotential_2 {
                let high_2: number;
                export { high_2 as high };
                let medium_2: number;
                export { medium_2 as medium };
                let low_2: number;
                export { low_2 as low };
            }
            export { automationPotential_2 as automationPotential };
            let sampleSize_15: number;
            export { sampleSize_15 as sampleSize };
            let lastUpdated_15: string;
            export { lastUpdated_15 as lastUpdated };
        }
        export { _global_3 as _global };
    }
}
export const REGION_MODIFIERS: {
    APAC: {
        SIRI: number;
        ADMA: number;
        CMMI: number;
        LEAN: number;
    };
    Europe: {
        SIRI: number;
        ADMA: number;
        CMMI: number;
        LEAN: number;
    };
    'North America': {
        SIRI: number;
        ADMA: number;
        CMMI: number;
        LEAN: number;
    };
    'South America': {
        SIRI: number;
        ADMA: number;
        CMMI: number;
        LEAN: number;
    };
    _global: {
        SIRI: number;
        ADMA: number;
        CMMI: number;
        LEAN: number;
    };
};
export namespace SIZE_MODIFIERS {
    export let small: number;
    let medium_3: number;
    export { medium_3 as medium };
    export let large: number;
    export let enterprise: number;
}
//# sourceMappingURL=frameworkBenchmarkService.d.ts.map