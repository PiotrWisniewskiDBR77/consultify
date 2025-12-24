/**
 * RapidLean Questionnaire Data
 * 
 * 6 Dimensions of Lean Operational Excellence
 * Each dimension has 3 questions rated on 1-5 scale
 * Total: 18 questions
 */

export interface LeanDimension {
    id: string;
    name: string;
    description: string;
    icon: string;
    questions: LeanQuestion[];
}

export interface LeanQuestion {
    id: string;
    text: string;
    helpText: string;
    dimension: string;
}

export const RAPID_LEAN_QUESTIONNAIRE: LeanDimension[] = [
    {
        id: 'value_stream',
        name: 'Value Stream Efficiency',
        description: 'Ability to identify and optimize value-creating activities',
        icon: 'TrendingUp',
        questions: [
            {
                id: 'value_stream_1',
                text: 'Has your organization mapped its core value streams from customer order to delivery?',
                helpText: 'Value stream mapping visualizes all steps (value-adding and non-value-adding) in delivering a product/service',
                dimension: 'value_stream'
            },
            {
                id: 'value_stream_2',
                text: 'Do you measure and track cycle time for each value stream?',
                helpText: 'Cycle time is the total time from request initiation to delivery completion',
                dimension: 'value_stream'
            },
            {
                id: 'value_stream_3',
                text: 'Are value stream improvements systematically prioritized and executed?',
                helpText: 'Improvements should target bottlenecks with the highest impact on customer value',
                dimension: 'value_stream'
            }
        ]
    },
    {
        id: 'waste_elimination',
        name: 'Waste Elimination (7+1 Wastes)',
        description: 'Systematic identification and removal of non-value-added activities',
        icon: 'Trash2',
        questions: [
            {
                id: 'waste_elimination_1',
                text: 'Does your team actively identify and categorize waste (transport, inventory, motion, waiting, overproduction, over-processing, defects)?',
                helpText: 'The 7 wastes of Lean + 1 (unused talent) should be continuously monitored',
                dimension: 'waste_elimination'
            },
            {
                id: 'waste_elimination_2',
                text: 'Is there a structured process for eliminating identified waste?',
                helpText: 'Kaizen events, PDCA cycles, or improvement projects should target waste reduction',
                dimension: 'waste_elimination'
            },
            {
                id: 'waste_elimination_3',
                text: 'Are waste reduction initiatives linked to measurable cost/time savings?',
                helpText: 'Quantified impact ensures focus on high-value improvements',
                dimension: 'waste_elimination'
            }
        ]
    },
    {
        id: 'flow_pull',
        name: 'Flow & Pull Systems',
        description: 'Work flows smoothly through the system based on customer demand',
        icon: 'Layers',
        questions: [
            {
                id: 'flow_pull_1',
                text: 'Do you use visual signals (Kanban) to trigger production/work based on actual demand?',
                helpText: 'Pull systems prevent overproduction by producing only what\'s needed when it\'s needed',
                dimension: 'flow_pull'
            },
            {
                id: 'flow_pull_2',
                text: 'Is work-in-progress (WIP) limited to prevent bottlenecks?',
                helpText: 'WIP limits reduce lead time and improve focus on completing tasks',
                dimension: 'flow_pull'
            },
            {
                id: 'flow_pull_3',
                text: 'Are processes designed for one-piece flow or small batch sizes?',
                helpText: 'Small batches reduce waiting time and enable faster feedback',
                dimension: 'flow_pull'
            }
        ]
    },
    {
        id: 'quality_source',
        name: 'Quality at Source (Jidoka)',
        description: 'Build quality into the process rather than inspecting it in',
        icon: 'CheckCircle',
        questions: [
            {
                id: 'quality_source_1',
                text: 'Do you have Poka-Yoke (mistake-proofing) mechanisms in critical processes?',
                helpText: 'Error-proofing prevents defects from occurring in the first place',
                dimension: 'quality_source'
            },
            {
                id: 'quality_source_2',
                text: 'Are workers empowered to stop production when quality issues are detected?',
                helpText: 'Andon systems give frontline workers authority to halt the line',
                dimension: 'quality_source'
            },
            {
                id: 'quality_source_3',
                text: 'Is there a culture of "building quality in" rather than "inspecting quality in"?',
                helpText: 'Quality should be a process outcome, not a post-production check',
                dimension: 'quality_source'
            }
        ]
    },
    {
        id: 'continuous_improvement',
        name: 'Continuous Improvement Culture',
        description: 'Systematic, incremental improvement driven by all employees',
        icon: 'RefreshCw',
        questions: [
            {
                id: 'continuous_improvement_1',
                text: 'Do you conduct regular Kaizen events or improvement workshops?',
                helpText: 'Kaizen events bring cross-functional teams together to solve specific problems',
                dimension: 'continuous_improvement'
            },
            {
                id: 'continuous_improvement_2',
                text: 'Is there an active employee suggestion system with visible results?',
                helpText: 'Frontline workers are closest to problems and should be encouraged to propose solutions',
                dimension: 'continuous_improvement'
            },
            {
                id: 'continuous_improvement_3',
                text: 'Are improvement ideas tracked, prioritized, and implemented systematically?',
                helpText: 'Without follow-through, suggestion systems lose credibility',
                dimension: 'continuous_improvement'
            }
        ]
    },
    {
        id: 'visual_management',
        name: 'Visual Management',
        description: 'Make performance, problems, and standards visible to everyone',
        icon: 'Eye',
        questions: [
            {
                id: 'visual_management_1',
                text: 'Are KPIs and performance metrics visually displayed at the workplace?',
                helpText: 'Visual boards should show real-time status (green/yellow/red)',
                dimension: 'visual_management'
            },
            {
                id: 'visual_management_2',
                text: 'Is standard work documented and visible at each workstation?',
                helpText: 'Standard work sheets ensure consistency and serve as a baseline for improvement',
                dimension: 'visual_management'
            },
            {
                id: 'visual_management_3',
                text: 'Can anyone identify problems and abnormalities at a glance?',
                helpText: 'Visual management should enable instant problem detection (5S, shadow boards, color coding)',
                dimension: 'visual_management'
            }
        ]
    }
];

// Scoring scale definitions
export const LEAN_SCALE = [
    { value: 1, label: 'Ad-Hoc', description: 'No systematic approach; activities are reactive' },
    { value: 2, label: 'Emerging', description: 'Initial awareness; sporadic activities' },
    { value: 3, label: 'Defined', description: 'Documented processes; not fully embedded' },
    { value: 4, label: 'Managed', description: 'Systematic approach with measurable results' },
    { value: 5, label: 'World-Class', description: 'Fully embedded; continuous innovation' }
];

// Helper to get all questions as flat array
export const getAllQuestions = (): LeanQuestion[] => {
    return RAPID_LEAN_QUESTIONNAIRE.flatMap(dim => dim.questions);
};

// Helper to get questions by dimension
export const getQuestionsByDimension = (dimensionId: string): LeanQuestion[] => {
    const dimension = RAPID_LEAN_QUESTIONNAIRE.find(d => d.id === dimensionId);
    return dimension?.questions || [];
};
