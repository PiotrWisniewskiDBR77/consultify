declare namespace _default {
    export { CONSULTING_FRAMEWORKS };
    export { getFramework };
    export { getFrameworkIds };
    export { getFrameworkMetadata };
    export { getAllFrameworksMetadata };
    export { recommendFrameworks };
    export { BCG_GROWTH_SHARE };
    export { MCKINSEY_7S };
    export { PORTER_5_FORCES };
    export { PESTLE };
    export { VALUE_CHAIN };
    export { SWOT };
}
export default _default;
export namespace CONSULTING_FRAMEWORKS {
    export { BCG_GROWTH_SHARE };
    export { MCKINSEY_7S };
    export { PORTER_5_FORCES };
    export { PESTLE };
    export { VALUE_CHAIN };
    export { SWOT };
}
/**
 * Get framework by ID
 */
export function getFramework(frameworkId: any): any;
/**
 * Get all framework IDs
 */
export function getFrameworkIds(): string[];
/**
 * Get framework metadata (without prompts)
 */
export function getFrameworkMetadata(frameworkId: any): any;
/**
 * Get all frameworks metadata
 */
export function getAllFrameworksMetadata(): {
    id: string;
    name: any;
    description: any;
    source: any;
}[];
/**
 * Recommend frameworks based on analysis needs
 */
export function recommendFrameworks(analysisContext: any): {
    frameworkId: string;
    reason: string;
    priority: number;
}[];
export namespace BCG_GROWTH_SHARE {
    let id: string;
    let name: string;
    let description: string;
    let source: string;
    namespace quadrants {
        namespace STAR {
            let name_1: string;
            export { name_1 as name };
            export let characteristics: string;
            export let strategy: string;
            export let resourceAllocation: string;
            export let icon: string;
        }
        namespace QUESTION_MARK {
            let name_2: string;
            export { name_2 as name };
            let characteristics_1: string;
            export { characteristics_1 as characteristics };
            let strategy_1: string;
            export { strategy_1 as strategy };
            let resourceAllocation_1: string;
            export { resourceAllocation_1 as resourceAllocation };
            let icon_1: string;
            export { icon_1 as icon };
        }
        namespace CASH_COW {
            let name_3: string;
            export { name_3 as name };
            let characteristics_2: string;
            export { characteristics_2 as characteristics };
            let strategy_2: string;
            export { strategy_2 as strategy };
            let resourceAllocation_2: string;
            export { resourceAllocation_2 as resourceAllocation };
            let icon_2: string;
            export { icon_2 as icon };
        }
        namespace DOG {
            let name_4: string;
            export { name_4 as name };
            let characteristics_3: string;
            export { characteristics_3 as characteristics };
            let strategy_3: string;
            export { strategy_3 as strategy };
            let resourceAllocation_3: string;
            export { resourceAllocation_3 as resourceAllocation };
            let icon_3: string;
            export { icon_3 as icon };
        }
    }
    namespace axes {
        namespace x {
            let name_5: string;
            export { name_5 as name };
            export let high: string;
            export let low: string;
            export let threshold: number;
        }
        namespace y {
            let name_6: string;
            export { name_6 as name };
            let high_1: string;
            export { high_1 as high };
            let low_1: string;
            export { low_1 as low };
            let threshold_1: number;
            export { threshold_1 as threshold };
        }
    }
    namespace applicationCriteria {
        namespace forInitiatives {
            let xAxis: string;
            let yAxis: string;
            let size: string;
        }
    }
    let promptTemplate: string;
}
export namespace MCKINSEY_7S {
    let id_1: string;
    export { id_1 as id };
    let name_7: string;
    export { name_7 as name };
    let description_1: string;
    export { description_1 as description };
    let source_1: string;
    export { source_1 as source };
    export namespace elements {
        namespace STRATEGY {
            let name_8: string;
            export { name_8 as name };
            export let type: string;
            let description_2: string;
            export { description_2 as description };
            export let assessmentQuestions: string[];
        }
        namespace STRUCTURE {
            let name_9: string;
            export { name_9 as name };
            let type_1: string;
            export { type_1 as type };
            let description_3: string;
            export { description_3 as description };
            let assessmentQuestions_1: string[];
            export { assessmentQuestions_1 as assessmentQuestions };
        }
        namespace SYSTEMS {
            let name_10: string;
            export { name_10 as name };
            let type_2: string;
            export { type_2 as type };
            let description_4: string;
            export { description_4 as description };
            let assessmentQuestions_2: string[];
            export { assessmentQuestions_2 as assessmentQuestions };
        }
        namespace SHARED_VALUES {
            let name_11: string;
            export { name_11 as name };
            let type_3: string;
            export { type_3 as type };
            let description_5: string;
            export { description_5 as description };
            let assessmentQuestions_3: string[];
            export { assessmentQuestions_3 as assessmentQuestions };
        }
        namespace STYLE {
            let name_12: string;
            export { name_12 as name };
            let type_4: string;
            export { type_4 as type };
            let description_6: string;
            export { description_6 as description };
            let assessmentQuestions_4: string[];
            export { assessmentQuestions_4 as assessmentQuestions };
        }
        namespace STAFF {
            let name_13: string;
            export { name_13 as name };
            let type_5: string;
            export { type_5 as type };
            let description_7: string;
            export { description_7 as description };
            let assessmentQuestions_5: string[];
            export { assessmentQuestions_5 as assessmentQuestions };
        }
        namespace SKILLS {
            let name_14: string;
            export { name_14 as name };
            let type_6: string;
            export { type_6 as type };
            let description_8: string;
            export { description_8 as description };
            let assessmentQuestions_6: string[];
            export { assessmentQuestions_6 as assessmentQuestions };
        }
    }
    export namespace alignmentAssessment {
        let levels: string[];
        namespace scoring {
            namespace MISALIGNED {
                let min: number;
                let max: number;
            }
            namespace PARTIALLY_ALIGNED {
                let min_1: number;
                export { min_1 as min };
                let max_1: number;
                export { max_1 as max };
            }
            namespace ALIGNED {
                let min_2: number;
                export { min_2 as min };
                let max_2: number;
                export { max_2 as max };
            }
            namespace HIGHLY_ALIGNED {
                let min_3: number;
                export { min_3 as min };
                let max_3: number;
                export { max_3 as max };
            }
        }
    }
    let promptTemplate_1: string;
    export { promptTemplate_1 as promptTemplate };
}
export namespace PORTER_5_FORCES {
    let id_2: string;
    export { id_2 as id };
    let name_15: string;
    export { name_15 as name };
    let description_9: string;
    export { description_9 as description };
    let source_2: string;
    export { source_2 as source };
    export namespace forces {
        namespace COMPETITIVE_RIVALRY {
            let name_16: string;
            export { name_16 as name };
            let description_10: string;
            export { description_10 as description };
            export let factors: string[];
            export let digitalFactors: string[];
        }
        namespace THREAT_NEW_ENTRANTS {
            let name_17: string;
            export { name_17 as name };
            let description_11: string;
            export { description_11 as description };
            let factors_1: string[];
            export { factors_1 as factors };
            let digitalFactors_1: string[];
            export { digitalFactors_1 as digitalFactors };
        }
        namespace BARGAINING_POWER_SUPPLIERS {
            let name_18: string;
            export { name_18 as name };
            let description_12: string;
            export { description_12 as description };
            let factors_2: string[];
            export { factors_2 as factors };
            let digitalFactors_2: string[];
            export { digitalFactors_2 as digitalFactors };
        }
        namespace BARGAINING_POWER_BUYERS {
            let name_19: string;
            export { name_19 as name };
            let description_13: string;
            export { description_13 as description };
            let factors_3: string[];
            export { factors_3 as factors };
            let digitalFactors_3: string[];
            export { digitalFactors_3 as digitalFactors };
        }
        namespace THREAT_SUBSTITUTES {
            let name_20: string;
            export { name_20 as name };
            let description_14: string;
            export { description_14 as description };
            let factors_4: string[];
            export { factors_4 as factors };
            let digitalFactors_4: string[];
            export { digitalFactors_4 as digitalFactors };
        }
    }
    export let threatLevels: string[];
    let promptTemplate_2: string;
    export { promptTemplate_2 as promptTemplate };
}
export namespace PESTLE {
    let id_3: string;
    export { id_3 as id };
    let name_21: string;
    export { name_21 as name };
    let description_15: string;
    export { description_15 as description };
    let source_3: string;
    export { source_3 as source };
    export namespace factors_5 {
        namespace POLITICAL {
            let name_22: string;
            export { name_22 as name };
            let description_16: string;
            export { description_16 as description };
            export let considerations: string[];
        }
        namespace ECONOMIC {
            let name_23: string;
            export { name_23 as name };
            let description_17: string;
            export { description_17 as description };
            let considerations_1: string[];
            export { considerations_1 as considerations };
        }
        namespace SOCIAL {
            let name_24: string;
            export { name_24 as name };
            let description_18: string;
            export { description_18 as description };
            let considerations_2: string[];
            export { considerations_2 as considerations };
        }
        namespace TECHNOLOGICAL {
            let name_25: string;
            export { name_25 as name };
            let description_19: string;
            export { description_19 as description };
            let considerations_3: string[];
            export { considerations_3 as considerations };
        }
        namespace LEGAL {
            let name_26: string;
            export { name_26 as name };
            let description_20: string;
            export { description_20 as description };
            let considerations_4: string[];
            export { considerations_4 as considerations };
        }
        namespace ENVIRONMENTAL {
            let name_27: string;
            export { name_27 as name };
            let description_21: string;
            export { description_21 as description };
            let considerations_5: string[];
            export { considerations_5 as considerations };
        }
    }
    export { factors_5 as factors };
    export let impactLevels: string[];
    let promptTemplate_3: string;
    export { promptTemplate_3 as promptTemplate };
}
export namespace VALUE_CHAIN {
    let id_4: string;
    export { id_4 as id };
    let name_28: string;
    export { name_28 as name };
    let description_22: string;
    export { description_22 as description };
    let source_4: string;
    export { source_4 as source };
    export namespace activities {
        namespace primary {
            namespace INBOUND_LOGISTICS {
                let name_29: string;
                export { name_29 as name };
                let description_23: string;
                export { description_23 as description };
                export let digitalOpportunities: string[];
            }
            namespace OPERATIONS {
                let name_30: string;
                export { name_30 as name };
                let description_24: string;
                export { description_24 as description };
                let digitalOpportunities_1: string[];
                export { digitalOpportunities_1 as digitalOpportunities };
            }
            namespace OUTBOUND_LOGISTICS {
                let name_31: string;
                export { name_31 as name };
                let description_25: string;
                export { description_25 as description };
                let digitalOpportunities_2: string[];
                export { digitalOpportunities_2 as digitalOpportunities };
            }
            namespace MARKETING_SALES {
                let name_32: string;
                export { name_32 as name };
                let description_26: string;
                export { description_26 as description };
                let digitalOpportunities_3: string[];
                export { digitalOpportunities_3 as digitalOpportunities };
            }
            namespace SERVICE {
                let name_33: string;
                export { name_33 as name };
                let description_27: string;
                export { description_27 as description };
                let digitalOpportunities_4: string[];
                export { digitalOpportunities_4 as digitalOpportunities };
            }
        }
        namespace support {
            namespace FIRM_INFRASTRUCTURE {
                let name_34: string;
                export { name_34 as name };
                let description_28: string;
                export { description_28 as description };
                let digitalOpportunities_5: string[];
                export { digitalOpportunities_5 as digitalOpportunities };
            }
            namespace HR_MANAGEMENT {
                let name_35: string;
                export { name_35 as name };
                let description_29: string;
                export { description_29 as description };
                let digitalOpportunities_6: string[];
                export { digitalOpportunities_6 as digitalOpportunities };
            }
            namespace TECHNOLOGY_DEVELOPMENT {
                let name_36: string;
                export { name_36 as name };
                let description_30: string;
                export { description_30 as description };
                let digitalOpportunities_7: string[];
                export { digitalOpportunities_7 as digitalOpportunities };
            }
            namespace PROCUREMENT {
                let name_37: string;
                export { name_37 as name };
                let description_31: string;
                export { description_31 as description };
                let digitalOpportunities_8: string[];
                export { digitalOpportunities_8 as digitalOpportunities };
            }
        }
    }
    let promptTemplate_4: string;
    export { promptTemplate_4 as promptTemplate };
}
export namespace SWOT {
    let id_5: string;
    export { id_5 as id };
    let name_38: string;
    export { name_38 as name };
    let description_32: string;
    export { description_32 as description };
    let source_5: string;
    export { source_5 as source };
    export namespace quadrants_1 {
        namespace STRENGTHS {
            let name_39: string;
            export { name_39 as name };
            let type_7: string;
            export { type_7 as type };
            export let nature: string;
            let description_33: string;
            export { description_33 as description };
        }
        namespace WEAKNESSES {
            let name_40: string;
            export { name_40 as name };
            let type_8: string;
            export { type_8 as type };
            let nature_1: string;
            export { nature_1 as nature };
            let description_34: string;
            export { description_34 as description };
        }
        namespace OPPORTUNITIES {
            let name_41: string;
            export { name_41 as name };
            let type_9: string;
            export { type_9 as type };
            let nature_2: string;
            export { nature_2 as nature };
            let description_35: string;
            export { description_35 as description };
        }
        namespace THREATS {
            let name_42: string;
            export { name_42 as name };
            let type_10: string;
            export { type_10 as type };
            let nature_3: string;
            export { nature_3 as nature };
            let description_36: string;
            export { description_36 as description };
        }
    }
    export { quadrants_1 as quadrants };
    export namespace strategies {
        namespace SO {
            let name_43: string;
            export { name_43 as name };
            let description_37: string;
            export { description_37 as description };
        }
        namespace WO {
            let name_44: string;
            export { name_44 as name };
            let description_38: string;
            export { description_38 as description };
        }
        namespace ST {
            let name_45: string;
            export { name_45 as name };
            let description_39: string;
            export { description_39 as description };
        }
        namespace WT {
            let name_46: string;
            export { name_46 as name };
            let description_40: string;
            export { description_40 as description };
        }
    }
    let promptTemplate_5: string;
    export { promptTemplate_5 as promptTemplate };
}
//# sourceMappingURL=consultingFrameworks.d.ts.map