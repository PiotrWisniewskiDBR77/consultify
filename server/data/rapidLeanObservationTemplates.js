/**
 * RapidLean Observation Templates - DBR77 Format (Backend JS Version)
 * Standardized templates for production floor observations (Gemba Walk)
 * Maps to DRD Axes: Processes (Axis 1) and Culture (Axis 5)
 */

const RAPID_LEAN_OBSERVATION_TEMPLATES = [
    {
        id: 'value_stream_template',
        dimension: 'value_stream',
        drdAxis: 'processes',
        drdArea: '1A',
        name: 'Value Stream Observation',
        description: 'Observe value stream flow from order to delivery. Maps to DRD Axis 1: Digital Processes',
        photoRequired: true,
        notesRequired: true,
        estimatedTime: 15,
        checklist: [
            {
                id: 'vs_1',
                text: 'Is value stream map visible on the floor?',
                type: 'yes_no',
                required: true,
                helpText: 'Look for visual maps showing process flow',
                drdMapping: { axis: 1, area: '1A', level: 3 }
            },
            {
                id: 'vs_2',
                text: 'Are cycle times displayed and updated?',
                type: 'yes_no',
                required: true,
                drdMapping: { axis: 1, area: '1B', level: 4 }
            },
            {
                id: 'vs_3',
                text: 'Observe actual cycle time (minutes)',
                type: 'measurement',
                required: false,
                helpText: 'Time from order start to completion'
            },
            {
                id: 'vs_4',
                text: 'Are bottlenecks clearly visible?',
                type: 'yes_no',
                required: true,
                drdMapping: { axis: 1, area: '1C', level: 4 }
            },
            {
                id: 'vs_5',
                text: 'Take photo of value stream board',
                type: 'photo',
                required: true
            },
            {
                id: 'vs_6',
                text: 'Notes on value stream observations',
                type: 'text',
                required: true,
                helpText: 'Document what you see: flow, delays, waiting times'
            }
        ]
    },
    {
        id: 'waste_template',
        dimension: 'waste_elimination',
        drdAxis: 'processes',
        drdArea: '1C',
        name: 'Waste Identification',
        description: 'Identify and document the 7+1 wastes. Maps to DRD Axis 1: Digital Processes',
        photoRequired: true,
        notesRequired: true,
        estimatedTime: 20,
        checklist: [
            {
                id: 'waste_1',
                text: 'Transportation waste observed?',
                type: 'yes_no',
                required: true,
                helpText: 'Unnecessary movement of materials/products'
            },
            {
                id: 'waste_2',
                text: 'Inventory waste observed?',
                type: 'yes_no',
                required: true,
                helpText: 'Excess inventory, WIP accumulation'
            },
            {
                id: 'waste_3',
                text: 'Motion waste observed?',
                type: 'yes_no',
                required: true,
                helpText: 'Unnecessary worker movement'
            },
            {
                id: 'waste_4',
                text: 'Waiting waste observed?',
                type: 'yes_no',
                required: true,
                helpText: 'Idle time, waiting for materials/tools'
            },
            {
                id: 'waste_5',
                text: 'Overproduction waste observed?',
                type: 'yes_no',
                required: true,
                helpText: 'Producing more than customer demand'
            },
            {
                id: 'waste_6',
                text: 'Over-processing waste observed?',
                type: 'yes_no',
                required: true,
                helpText: 'Doing more than customer needs'
            },
            {
                id: 'waste_7',
                text: 'Defects observed?',
                type: 'yes_no',
                required: true,
                helpText: 'Rework, scrap, quality issues'
            },
            {
                id: 'waste_8',
                text: 'Unused talent observed?',
                type: 'yes_no',
                required: true,
                helpText: 'Workers not engaged in improvement'
            },
            {
                id: 'waste_9',
                text: 'Take photos of waste examples',
                type: 'photo',
                required: true
            },
            {
                id: 'waste_10',
                text: 'Document waste details',
                type: 'text',
                required: true,
                helpText: 'Describe each waste type found, quantities, locations'
            }
        ]
    },
    {
        id: 'flow_pull_template',
        dimension: 'flow_pull',
        drdAxis: 'processes',
        drdArea: '1C',
        name: 'Flow & Pull Systems',
        description: 'Observe Kanban, WIP limits, batch sizes. Maps to DRD Axis 1: Digital Processes',
        photoRequired: true,
        notesRequired: true,
        estimatedTime: 15,
        checklist: [
            {
                id: 'flow_1',
                text: 'Are Kanban cards/signals visible?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'flow_2',
                text: 'Is WIP limit displayed?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'flow_3',
                text: 'Current WIP level',
                type: 'measurement',
                required: false,
                helpText: 'Count actual items in process'
            },
            {
                id: 'flow_4',
                text: 'Is WIP within limits?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'flow_5',
                text: 'Batch size observed',
                type: 'measurement',
                required: false,
                helpText: 'How many items processed together?'
            },
            {
                id: 'flow_6',
                text: 'Take photo of Kanban board',
                type: 'photo',
                required: true
            },
            {
                id: 'flow_7',
                text: 'Flow observations',
                type: 'text',
                required: true,
                helpText: 'Describe flow: smooth, interrupted, blocked?'
            }
        ]
    },
    {
        id: 'quality_template',
        dimension: 'quality_source',
        drdAxis: 'processes',
        drdArea: '1B',
        name: 'Quality at Source',
        description: 'Observe Poka-Yoke, Andon, quality culture. Maps to DRD Axis 1: Digital Processes',
        photoRequired: true,
        notesRequired: true,
        estimatedTime: 15,
        checklist: [
            {
                id: 'qual_1',
                text: 'Poka-Yoke devices visible?',
                type: 'yes_no',
                required: true,
                helpText: 'Mistake-proofing mechanisms'
            },
            {
                id: 'qual_2',
                text: 'Andon system present?',
                type: 'yes_no',
                required: true,
                helpText: 'Visual/audio signal system'
            },
            {
                id: 'qual_3',
                text: 'Can workers stop production?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'qual_4',
                text: 'Quality checkpoints location',
                type: 'text',
                required: false,
                helpText: 'Where are quality checks performed?'
            },
            {
                id: 'qual_5',
                text: 'Take photo of quality station',
                type: 'photo',
                required: true
            },
            {
                id: 'qual_6',
                text: 'Quality culture observations',
                type: 'text',
                required: true,
                helpText: 'How is quality handled: built-in or inspected?'
            }
        ]
    },
    {
        id: 'ci_template',
        dimension: 'continuous_improvement',
        drdAxis: 'culture',
        drdArea: '5A',
        name: 'Continuous Improvement',
        description: 'Observe Kaizen boards, suggestion systems. Maps to DRD Axis 5: Organizational Culture',
        photoRequired: true,
        notesRequired: true,
        estimatedTime: 10,
        checklist: [
            {
                id: 'ci_1',
                text: 'Kaizen board visible?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'ci_2',
                text: 'Employee suggestions displayed?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'ci_3',
                text: 'Number of active improvements',
                type: 'measurement',
                required: false
            },
            {
                id: 'ci_4',
                text: 'Last Kaizen event date visible?',
                type: 'yes_no',
                required: false
            },
            {
                id: 'ci_5',
                text: 'Take photo of improvement board',
                type: 'photo',
                required: true
            },
            {
                id: 'ci_6',
                text: 'CI culture observations',
                type: 'text',
                required: true,
                helpText: 'Are workers engaged in improvement?'
            }
        ]
    },
    {
        id: 'visual_template',
        dimension: 'visual_management',
        drdAxis: 'culture',
        drdArea: '5B',
        name: 'Visual Management',
        description: 'Observe KPIs, standards, visual controls. Maps to DRD Axis 5: Organizational Culture',
        photoRequired: true,
        notesRequired: true,
        estimatedTime: 10,
        checklist: [
            {
                id: 'vis_1',
                text: 'KPI boards visible?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'vis_2',
                text: 'Standard work sheets posted?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'vis_3',
                text: '5S implementation visible?',
                type: 'yes_no',
                required: true
            },
            {
                id: 'vis_4',
                text: 'Color coding used?',
                type: 'yes_no',
                required: false
            },
            {
                id: 'vis_5',
                text: 'Take photos of visual boards',
                type: 'photo',
                required: true
            },
            {
                id: 'vis_6',
                text: 'Visual management observations',
                type: 'text',
                required: true,
                helpText: 'Can problems be identified at a glance?'
            }
        ]
    }
];

// Mapping: Observation answers → RapidLean questionnaire scores
const OBSERVATION_TO_SCORE_MAPPING = {
    value_stream: {
        'vs_1_true': 4, 'vs_1_false': 1,
        'vs_2_true': 4, 'vs_2_false': 1,
        'vs_4_true': 3, 'vs_4_false': 2
    },
    waste_elimination: {
        'waste_1_false': 4, 'waste_1_true': 2,
        'waste_2_false': 4, 'waste_2_true': 2,
        'waste_3_false': 4, 'waste_3_true': 2,
        'waste_4_false': 4, 'waste_4_true': 2,
        'waste_5_false': 4, 'waste_5_true': 2,
        'waste_6_false': 4, 'waste_6_true': 2,
        'waste_7_false': 4, 'waste_7_true': 1,
        'waste_8_false': 4, 'waste_8_true': 2
    },
    flow_pull: {
        'flow_1_true': 4, 'flow_1_false': 1,
        'flow_2_true': 4, 'flow_2_false': 1,
        'flow_4_true': 4, 'flow_4_false': 2
    },
    quality_source: {
        'qual_1_true': 4, 'qual_1_false': 2,
        'qual_2_true': 4, 'qual_2_false': 2,
        'qual_3_true': 5, 'qual_3_false': 1
    },
    continuous_improvement: {
        'ci_1_true': 4, 'ci_1_false': 1,
        'ci_2_true': 4, 'ci_2_false': 1
    },
    visual_management: {
        'vis_1_true': 4, 'vis_1_false': 1,
        'vis_2_true': 4, 'vis_2_false': 1,
        'vis_3_true': 3, 'vis_3_false': 1
    }
};

// Mapping: Observation template → DRD Level Suggestion
const OBSERVATION_TO_DRD_MAPPING = {
    value_stream: {
        'vs_1_true': { axis: 1, area: '1A', level: 3 },
        'vs_1_false': { axis: 1, area: '1A', level: 1 },
        'vs_2_true': { axis: 1, area: '1B', level: 4 },
        'vs_2_false': { axis: 1, area: '1B', level: 2 },
        'vs_4_true': { axis: 1, area: '1C', level: 4 },
        'vs_4_false': { axis: 1, area: '1C', level: 2 }
    },
    waste_elimination: {
        'waste_1_false': { axis: 1, area: '1C', level: 4 },
        'waste_1_true': { axis: 1, area: '1C', level: 2 },
        'waste_7_false': { axis: 1, area: '1B', level: 4 },
        'waste_7_true': { axis: 1, area: '1B', level: 1 }
    },
    flow_pull: {
        'flow_1_true': { axis: 1, area: '1C', level: 4 },
        'flow_1_false': { axis: 1, area: '1C', level: 1 },
        'flow_4_true': { axis: 1, area: '1C', level: 4 },
        'flow_4_false': { axis: 1, area: '1C', level: 2 }
    },
    quality_source: {
        'qual_1_true': { axis: 1, area: '1B', level: 4 },
        'qual_1_false': { axis: 1, area: '1B', level: 2 },
        'qual_3_true': { axis: 1, area: '1B', level: 5 },
        'qual_3_false': { axis: 1, area: '1B', level: 1 }
    },
    continuous_improvement: {
        'ci_1_true': { axis: 5, area: '5A', level: 4 },
        'ci_1_false': { axis: 5, area: '5A', level: 1 },
        'ci_2_true': { axis: 5, area: '5A', level: 4 },
        'ci_2_false': { axis: 5, area: '5A', level: 1 }
    },
    visual_management: {
        'vis_1_true': { axis: 5, area: '5B', level: 4 },
        'vis_1_false': { axis: 5, area: '5B', level: 1 },
        'vis_2_true': { axis: 5, area: '5B', level: 4 },
        'vis_2_false': { axis: 5, area: '5B', level: 1 },
        'vis_3_true': { axis: 5, area: '5B', level: 3 },
        'vis_3_false': { axis: 5, area: '5B', level: 1 }
    }
};

// Helper functions
function getTemplateById(templateId) {
    return RAPID_LEAN_OBSERVATION_TEMPLATES.find(t => t.id === templateId);
}

function getTemplatesByDimension(dimension) {
    return RAPID_LEAN_OBSERVATION_TEMPLATES.filter(t => t.dimension === dimension);
}

function getAllTemplates() {
    return RAPID_LEAN_OBSERVATION_TEMPLATES;
}

module.exports = {
    RAPID_LEAN_OBSERVATION_TEMPLATES,
    OBSERVATION_TO_SCORE_MAPPING,
    OBSERVATION_TO_DRD_MAPPING,
    getTemplateById,
    getTemplatesByDimension,
    getAllTemplates
};

