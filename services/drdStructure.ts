import rawData from '../drd_data.json';

export interface DRDLevel {
    level: number;
    title: string;
    description: string;
}

export interface DRDArea {
    id: string; // e.g. "1A"
    name: string;
    levels: DRDLevel[];
}

export interface DRDAxis {
    id: number;
    name: string;
    areas: DRDArea[];
}

// Ensure the type assertion works
const typedData = (rawData as unknown) as DRDAxis[];

// Fix missing 7E and potential Axis 1 Name issue (if any)
const axis7 = typedData.find(a => a.id === 7);
if (axis7) {
    if (!axis7.areas.find(a => a.id === '7E')) {
        axis7.areas.push({
            id: '7E',
            name: 'AI Empowerment of Employees',
            levels: [
                { level: 1, title: 'No AI Skills', description: 'Employees have no AI skills and rely entirely on manual methods. Fear or skepticism prevails.' },
                { level: 2, title: 'Ad-hoc Usage', description: 'Some employees use tools like ChatGPT individually. No formal training or guidelines.' },
                { level: 3, title: 'Structured Enablement', description: 'Organization provides formal training and approved tools. Roles are defined.' },
                { level: 4, title: 'AI Fluency', description: 'Employees actively build their own AI workflows. Continuous upskilling is the norm.' },
                { level: 5, title: 'AI-Native Workforce', description: 'Human-AI collaboration is seamless. Employees orchestrate AI agents for daily tasks.' }
            ]
        });
    }
}

// Ensure Axis 6 (Cybersecurity) is correctly named/present
const axis6 = typedData.find(a => a.id === 6);
if (axis6 && axis6.name !== 'Cybersecurity') {
    axis6.name = 'Cybersecurity';
}

export const DRD_STRUCTURE: DRDAxis[] = typedData;

export const getQuestionsForAxis = (axisId: number) => {
    return DRD_STRUCTURE.find(a => a.id === axisId)?.areas || [];
};
