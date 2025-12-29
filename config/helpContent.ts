/**
 * Help Content Configuration
 * 
 * Context-aware help content per view/route.
 */

export interface HelpItem {
    title: string;
    content: string;
    type: 'article' | 'video' | 'faq';
    videoUrl?: string;
    articleUrl?: string;
    onClick?: () => void;
}

export interface ViewHelpConfig {
    viewId: string;
    pathPattern: string | RegExp;
    items: HelpItem[];
}

export const HELP_CONTENT: ViewHelpConfig[] = [
    {
        viewId: 'dashboard',
        pathPattern: '/dashboard',
        items: [
            {
                title: 'help.content.dashboard.0.title',
                content: 'help.content.dashboard.0.content',
                type: 'article',
            },
            {
                title: 'help.content.dashboard.1.title',
                content: 'help.content.dashboard.1.content',
                type: 'video',
                videoUrl: '#',
            },
        ],
    },
    {
        viewId: 'assessment',
        pathPattern: /\/assessment|\/full-step1/,
        items: [
            {
                title: 'help.content.assessment.0.title',
                content: 'help.content.assessment.0.content',
                type: 'article',
            },
            {
                title: 'help.content.assessment.1.title',
                content: 'help.content.assessment.1.content',
                type: 'faq',
            },
            {
                title: 'help.content.assessment.2.title',
                content: 'help.content.assessment.2.content',
                type: 'article',
            },
        ],
    },
    {
        viewId: 'initiatives',
        pathPattern: /\/initiatives|\/full-step2/,
        items: [
            {
                title: 'help.content.initiatives.0.title',
                content: 'help.content.initiatives.0.content',
                type: 'article',
            },
            {
                title: 'help.content.initiatives.1.title',
                content: 'help.content.initiatives.1.content',
                type: 'article',
            },
        ],
    },
    {
        viewId: 'roadmap',
        pathPattern: /\/roadmap|\/full-step3/,
        items: [
            {
                title: 'help.content.roadmap.0.title',
                content: 'help.content.roadmap.0.content',
                type: 'article',
            },
            {
                title: 'help.content.roadmap.1.title',
                content: 'help.content.roadmap.1.content',
                type: 'video',
                videoUrl: '#',
            },
        ],
    },
    {
        viewId: 'team',
        pathPattern: /\/team|\/users/,
        items: [
            {
                title: 'help.content.team.0.title',
                content: 'help.content.team.0.content',
                type: 'article',
            },
            {
                title: 'help.content.team.1.title',
                content: 'help.content.team.1.content',
                type: 'faq',
            },
        ],
    },
    {
        viewId: 'drd_workspace',
        pathPattern: /\/drd|\/axis/,
        items: [
            {
                title: 'help.content.drd_workspace.0.title',
                content: 'help.content.drd_workspace.0.content',
                type: 'article',
            },
            {
                title: 'help.content.drd_workspace.1.title',
                content: 'help.content.drd_workspace.1.content',
                type: 'article',
            },
            {
                title: 'help.content.drd_workspace.2.title',
                content: 'help.content.drd_workspace.2.content',
                type: 'faq',
            },
        ],
    },
    // SSO Configuration Help
    {
        viewId: 'sso_configuration',
        pathPattern: /\/superadmin\/sso/,
        items: [
            {
                title: 'help.content.sso.0.title',
                content: 'help.content.sso.0.content',
                type: 'article',
            },
            {
                title: 'help.content.sso.1.title',
                content: 'help.content.sso.1.content',
                type: 'article',
            },
            {
                title: 'help.content.sso.2.title',
                content: 'help.content.sso.2.content',
                type: 'faq',
            },
        ],
    },
    // Security Policies Help
    {
        viewId: 'security_policies',
        pathPattern: /\/superadmin\/security/,
        items: [
            {
                title: 'help.content.security.0.title',
                content: 'help.content.security.0.content',
                type: 'article',
            },
            {
                title: 'help.content.security.1.title',
                content: 'help.content.security.1.content',
                type: 'article',
            },
            {
                title: 'help.content.security.2.title',
                content: 'help.content.security.2.content',
                type: 'faq',
            },
        ],
    },
    // White-label Studio Help
    {
        viewId: 'whitelabel_studio',
        pathPattern: /\/superadmin\/whitelabel/,
        items: [
            {
                title: 'help.content.whitelabel.0.title',
                content: 'help.content.whitelabel.0.content',
                type: 'article',
            },
            {
                title: 'help.content.whitelabel.1.title',
                content: 'help.content.whitelabel.1.content',
                type: 'article',
            },
            {
                title: 'help.content.whitelabel.2.title',
                content: 'help.content.whitelabel.2.content',
                type: 'faq',
            },
        ],
    },
    // Integrations & Webhooks Help
    {
        viewId: 'integrations',
        pathPattern: /\/settings\/integrations/,
        items: [
            {
                title: 'help.content.integrations.0.title',
                content: 'help.content.integrations.0.content',
                type: 'article',
            },
            {
                title: 'help.content.integrations.1.title',
                content: 'help.content.integrations.1.content',
                type: 'article',
            },
            {
                title: 'help.content.integrations.2.title',
                content: 'help.content.integrations.2.content',
                type: 'faq',
            },
        ],
    },
    {
        viewId: 'default',
        pathPattern: /.*/,
        items: [
            {
                title: 'help.content.default.0.title',
                content: 'help.content.default.0.content',
                type: 'article',
            },
            {
                title: 'help.content.default.1.title',
                content: 'help.content.default.1.content',
                type: 'faq',
            },
        ],
    },
];

/**
 * Get help content for a specific view/path
 */
export const getHelpForView = (path: string): HelpItem[] => {
    // Find matching config
    for (const config of HELP_CONTENT) {
        if (config.pathPattern instanceof RegExp) {
            if (config.pathPattern.test(path)) {
                return config.items;
            }
        } else if (path.includes(config.pathPattern)) {
            return config.items;
        }
    }

    // Fallback to default
    const defaultConfig = HELP_CONTENT.find(c => c.viewId === 'default');
    return defaultConfig?.items || [];
};

export default HELP_CONTENT;
