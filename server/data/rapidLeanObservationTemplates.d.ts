declare namespace _default {
    export { RAPID_LEAN_OBSERVATION_TEMPLATES };
    export { OBSERVATION_TO_SCORE_MAPPING };
    export { OBSERVATION_TO_DRD_MAPPING };
    export { getTemplateById };
    export { getTemplatesByDimension };
    export { getAllTemplates };
}
export default _default;
/**
 * RapidLean Observation Templates - DBR77 Format (Backend JS Version)
 * Standardized templates for production floor observations (Gemba Walk)
 * Maps to DRD Axes: Processes (Axis 1) and Culture (Axis 5)
 */
export const RAPID_LEAN_OBSERVATION_TEMPLATES: {
    id: string;
    dimension: string;
    drdAxis: string;
    drdArea: string;
    name: string;
    description: string;
    photoRequired: boolean;
    notesRequired: boolean;
    estimatedTime: number;
    checklist: ({
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText: string;
        drdMapping: {
            axis: number;
            area: string;
            level: number;
        };
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        drdMapping: {
            axis: number;
            area: string;
            level: number;
        };
        helpText?: undefined;
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText: string;
        drdMapping?: undefined;
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText?: undefined;
        drdMapping?: undefined;
    })[];
}[];
export namespace OBSERVATION_TO_SCORE_MAPPING {
    namespace value_stream {
        let vs_1_true: number;
        let vs_1_false: number;
        let vs_2_true: number;
        let vs_2_false: number;
        let vs_4_true: number;
        let vs_4_false: number;
    }
    namespace waste_elimination {
        let waste_1_false: number;
        let waste_1_true: number;
        let waste_2_false: number;
        let waste_2_true: number;
        let waste_3_false: number;
        let waste_3_true: number;
        let waste_4_false: number;
        let waste_4_true: number;
        let waste_5_false: number;
        let waste_5_true: number;
        let waste_6_false: number;
        let waste_6_true: number;
        let waste_7_false: number;
        let waste_7_true: number;
        let waste_8_false: number;
        let waste_8_true: number;
    }
    namespace flow_pull {
        let flow_1_true: number;
        let flow_1_false: number;
        let flow_2_true: number;
        let flow_2_false: number;
        let flow_4_true: number;
        let flow_4_false: number;
    }
    namespace quality_source {
        let qual_1_true: number;
        let qual_1_false: number;
        let qual_2_true: number;
        let qual_2_false: number;
        let qual_3_true: number;
        let qual_3_false: number;
    }
    namespace continuous_improvement {
        let ci_1_true: number;
        let ci_1_false: number;
        let ci_2_true: number;
        let ci_2_false: number;
    }
    namespace visual_management {
        let vis_1_true: number;
        let vis_1_false: number;
        let vis_2_true: number;
        let vis_2_false: number;
        let vis_3_true: number;
        let vis_3_false: number;
    }
}
export namespace OBSERVATION_TO_DRD_MAPPING {
    export namespace value_stream_1 {
        export namespace vs_1_true_1 {
            let axis: number;
            let area: string;
            let level: number;
        }
        export { vs_1_true_1 as vs_1_true };
        export namespace vs_1_false_1 {
            let axis_1: number;
            export { axis_1 as axis };
            let area_1: string;
            export { area_1 as area };
            let level_1: number;
            export { level_1 as level };
        }
        export { vs_1_false_1 as vs_1_false };
        export namespace vs_2_true_1 {
            let axis_2: number;
            export { axis_2 as axis };
            let area_2: string;
            export { area_2 as area };
            let level_2: number;
            export { level_2 as level };
        }
        export { vs_2_true_1 as vs_2_true };
        export namespace vs_2_false_1 {
            let axis_3: number;
            export { axis_3 as axis };
            let area_3: string;
            export { area_3 as area };
            let level_3: number;
            export { level_3 as level };
        }
        export { vs_2_false_1 as vs_2_false };
        export namespace vs_4_true_1 {
            let axis_4: number;
            export { axis_4 as axis };
            let area_4: string;
            export { area_4 as area };
            let level_4: number;
            export { level_4 as level };
        }
        export { vs_4_true_1 as vs_4_true };
        export namespace vs_4_false_1 {
            let axis_5: number;
            export { axis_5 as axis };
            let area_5: string;
            export { area_5 as area };
            let level_5: number;
            export { level_5 as level };
        }
        export { vs_4_false_1 as vs_4_false };
    }
    export { value_stream_1 as value_stream };
    export namespace waste_elimination_1 {
        export namespace waste_1_false_1 {
            let axis_6: number;
            export { axis_6 as axis };
            let area_6: string;
            export { area_6 as area };
            let level_6: number;
            export { level_6 as level };
        }
        export { waste_1_false_1 as waste_1_false };
        export namespace waste_1_true_1 {
            let axis_7: number;
            export { axis_7 as axis };
            let area_7: string;
            export { area_7 as area };
            let level_7: number;
            export { level_7 as level };
        }
        export { waste_1_true_1 as waste_1_true };
        export namespace waste_7_false_1 {
            let axis_8: number;
            export { axis_8 as axis };
            let area_8: string;
            export { area_8 as area };
            let level_8: number;
            export { level_8 as level };
        }
        export { waste_7_false_1 as waste_7_false };
        export namespace waste_7_true_1 {
            let axis_9: number;
            export { axis_9 as axis };
            let area_9: string;
            export { area_9 as area };
            let level_9: number;
            export { level_9 as level };
        }
        export { waste_7_true_1 as waste_7_true };
    }
    export { waste_elimination_1 as waste_elimination };
    export namespace flow_pull_1 {
        export namespace flow_1_true_1 {
            let axis_10: number;
            export { axis_10 as axis };
            let area_10: string;
            export { area_10 as area };
            let level_10: number;
            export { level_10 as level };
        }
        export { flow_1_true_1 as flow_1_true };
        export namespace flow_1_false_1 {
            let axis_11: number;
            export { axis_11 as axis };
            let area_11: string;
            export { area_11 as area };
            let level_11: number;
            export { level_11 as level };
        }
        export { flow_1_false_1 as flow_1_false };
        export namespace flow_4_true_1 {
            let axis_12: number;
            export { axis_12 as axis };
            let area_12: string;
            export { area_12 as area };
            let level_12: number;
            export { level_12 as level };
        }
        export { flow_4_true_1 as flow_4_true };
        export namespace flow_4_false_1 {
            let axis_13: number;
            export { axis_13 as axis };
            let area_13: string;
            export { area_13 as area };
            let level_13: number;
            export { level_13 as level };
        }
        export { flow_4_false_1 as flow_4_false };
    }
    export { flow_pull_1 as flow_pull };
    export namespace quality_source_1 {
        export namespace qual_1_true_1 {
            let axis_14: number;
            export { axis_14 as axis };
            let area_14: string;
            export { area_14 as area };
            let level_14: number;
            export { level_14 as level };
        }
        export { qual_1_true_1 as qual_1_true };
        export namespace qual_1_false_1 {
            let axis_15: number;
            export { axis_15 as axis };
            let area_15: string;
            export { area_15 as area };
            let level_15: number;
            export { level_15 as level };
        }
        export { qual_1_false_1 as qual_1_false };
        export namespace qual_3_true_1 {
            let axis_16: number;
            export { axis_16 as axis };
            let area_16: string;
            export { area_16 as area };
            let level_16: number;
            export { level_16 as level };
        }
        export { qual_3_true_1 as qual_3_true };
        export namespace qual_3_false_1 {
            let axis_17: number;
            export { axis_17 as axis };
            let area_17: string;
            export { area_17 as area };
            let level_17: number;
            export { level_17 as level };
        }
        export { qual_3_false_1 as qual_3_false };
    }
    export { quality_source_1 as quality_source };
    export namespace continuous_improvement_1 {
        export namespace ci_1_true_1 {
            let axis_18: number;
            export { axis_18 as axis };
            let area_18: string;
            export { area_18 as area };
            let level_18: number;
            export { level_18 as level };
        }
        export { ci_1_true_1 as ci_1_true };
        export namespace ci_1_false_1 {
            let axis_19: number;
            export { axis_19 as axis };
            let area_19: string;
            export { area_19 as area };
            let level_19: number;
            export { level_19 as level };
        }
        export { ci_1_false_1 as ci_1_false };
        export namespace ci_2_true_1 {
            let axis_20: number;
            export { axis_20 as axis };
            let area_20: string;
            export { area_20 as area };
            let level_20: number;
            export { level_20 as level };
        }
        export { ci_2_true_1 as ci_2_true };
        export namespace ci_2_false_1 {
            let axis_21: number;
            export { axis_21 as axis };
            let area_21: string;
            export { area_21 as area };
            let level_21: number;
            export { level_21 as level };
        }
        export { ci_2_false_1 as ci_2_false };
    }
    export { continuous_improvement_1 as continuous_improvement };
    export namespace visual_management_1 {
        export namespace vis_1_true_1 {
            let axis_22: number;
            export { axis_22 as axis };
            let area_22: string;
            export { area_22 as area };
            let level_22: number;
            export { level_22 as level };
        }
        export { vis_1_true_1 as vis_1_true };
        export namespace vis_1_false_1 {
            let axis_23: number;
            export { axis_23 as axis };
            let area_23: string;
            export { area_23 as area };
            let level_23: number;
            export { level_23 as level };
        }
        export { vis_1_false_1 as vis_1_false };
        export namespace vis_2_true_1 {
            let axis_24: number;
            export { axis_24 as axis };
            let area_24: string;
            export { area_24 as area };
            let level_24: number;
            export { level_24 as level };
        }
        export { vis_2_true_1 as vis_2_true };
        export namespace vis_2_false_1 {
            let axis_25: number;
            export { axis_25 as axis };
            let area_25: string;
            export { area_25 as area };
            let level_25: number;
            export { level_25 as level };
        }
        export { vis_2_false_1 as vis_2_false };
        export namespace vis_3_true_1 {
            let axis_26: number;
            export { axis_26 as axis };
            let area_26: string;
            export { area_26 as area };
            let level_26: number;
            export { level_26 as level };
        }
        export { vis_3_true_1 as vis_3_true };
        export namespace vis_3_false_1 {
            let axis_27: number;
            export { axis_27 as axis };
            let area_27: string;
            export { area_27 as area };
            let level_27: number;
            export { level_27 as level };
        }
        export { vis_3_false_1 as vis_3_false };
    }
    export { visual_management_1 as visual_management };
}
export function getTemplateById(templateId: any): {
    id: string;
    dimension: string;
    drdAxis: string;
    drdArea: string;
    name: string;
    description: string;
    photoRequired: boolean;
    notesRequired: boolean;
    estimatedTime: number;
    checklist: ({
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText: string;
        drdMapping: {
            axis: number;
            area: string;
            level: number;
        };
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        drdMapping: {
            axis: number;
            area: string;
            level: number;
        };
        helpText?: undefined;
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText: string;
        drdMapping?: undefined;
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText?: undefined;
        drdMapping?: undefined;
    })[];
} | undefined;
export function getTemplatesByDimension(dimension: any): {
    id: string;
    dimension: string;
    drdAxis: string;
    drdArea: string;
    name: string;
    description: string;
    photoRequired: boolean;
    notesRequired: boolean;
    estimatedTime: number;
    checklist: ({
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText: string;
        drdMapping: {
            axis: number;
            area: string;
            level: number;
        };
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        drdMapping: {
            axis: number;
            area: string;
            level: number;
        };
        helpText?: undefined;
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText: string;
        drdMapping?: undefined;
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText?: undefined;
        drdMapping?: undefined;
    })[];
}[];
export function getAllTemplates(): {
    id: string;
    dimension: string;
    drdAxis: string;
    drdArea: string;
    name: string;
    description: string;
    photoRequired: boolean;
    notesRequired: boolean;
    estimatedTime: number;
    checklist: ({
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText: string;
        drdMapping: {
            axis: number;
            area: string;
            level: number;
        };
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        drdMapping: {
            axis: number;
            area: string;
            level: number;
        };
        helpText?: undefined;
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText: string;
        drdMapping?: undefined;
    } | {
        id: string;
        text: string;
        type: string;
        required: boolean;
        helpText?: undefined;
        drdMapping?: undefined;
    })[];
}[];
//# sourceMappingURL=rapidLeanObservationTemplates.d.ts.map