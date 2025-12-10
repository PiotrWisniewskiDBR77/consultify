// Onboarding tour steps configuration
export const tourSteps = [
    {
        target: '.sidebar',
        title: 'Welcome to Consultify!',
        content: 'Navigate your digital transformation journey using this sidebar. Access all key features from here.',
        placement: 'right' as const
    },
    {
        target: '[data-tour="assessment"]',
        title: 'Start with Assessment',
        content: 'Begin by assessing your organization\'s digital maturity across 7 key axes. This provides the foundation for your transformation roadmap.',
        placement: 'bottom' as const
    },
    {
        target: '[data-tour="initiatives"]',
        title: 'Strategic Initiatives',
        content: 'AI-powered recommendations for initiatives based on your assessment. Prioritize and plan your transformation projects.',
        placement: 'bottom' as const
    },
    {
        target: '[data-tour="roadmap"]',
        title: 'Implementation Roadmap',
        content: 'Visualize your transformation timeline. Organize initiatives across quarters and waves for optimal execution.',
        placement: 'bottom' as const
    },
    {
        target: '[data-tour="reports"]',
        title: 'Analytics & Reports',
        content: 'Track progress, ROI, and generate professional reports for stakeholders. Export to PDF when needed.',
        placement: 'bottom' as const
    }
];
