export default MCPServer;
declare namespace MCPServer {
    export { MCP_VERSION as VERSION };
    export { TOOLS };
    export { RESOURCES };
    export { PROMPTS };
    export function getServerInfo(): {
        protocolVersion: string;
        capabilities: {
            tools: {
                listChanged: boolean;
            };
            resources: {
                subscribe: boolean;
                listChanged: boolean;
            };
            prompts: {
                listChanged: boolean;
            };
            logging: {};
        };
        serverInfo: {
            name: string;
            version: string;
        };
    };
    export function listTools(): {
        tools: ({
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    status: {
                        type: string;
                        enum: string[];
                    };
                    priority: {
                        type: string;
                        enum: string[];
                    };
                    projectId: {
                        type: string;
                    };
                    limit: {
                        type: string;
                        default: number;
                    };
                };
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    title: {
                        type: string;
                        description: string;
                    };
                    description: {
                        type: string;
                    };
                    priority: {
                        type: string;
                        enum: string[];
                    };
                    dueDate: {
                        type: string;
                        format: string;
                    };
                    projectId: {
                        type: string;
                    };
                    assigneeId: {
                        type: string;
                    };
                };
                required: string[];
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    taskId: {
                        type: string;
                    };
                    title: {
                        type: string;
                    };
                    status: {
                        type: string;
                    };
                    priority: {
                        type: string;
                    };
                    dueDate: {
                        type: string;
                    };
                };
                required: string[];
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    taskId: {
                        type: string;
                    };
                };
                required: string[];
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    status: {
                        type: string;
                    };
                    limit: {
                        type: string;
                        default: number;
                    };
                };
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    initiativeId: {
                        type: string;
                    };
                };
                required: string[];
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    unreadOnly: {
                        type: string;
                        default: boolean;
                    };
                    limit: {
                        type: string;
                        default: number;
                    };
                };
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    userId: {
                        type: string;
                    };
                    title: {
                        type: string;
                    };
                    message: {
                        type: string;
                    };
                    type: {
                        type: string;
                    };
                };
                required: string[];
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    status: {
                        type: string;
                    };
                    limit: {
                        type: string;
                        default: number;
                    };
                };
            };
        } | {
            name: string;
            description: string;
            inputSchema: {
                type: string;
                properties: {
                    query: {
                        type: string;
                    };
                    types: {
                        type: string;
                        items: {
                            type: string;
                            enum: string[];
                        };
                        default: string[];
                    };
                    limit: {
                        type: string;
                        default: number;
                    };
                };
                required: string[];
            };
        })[];
    };
    export function executeTool(toolName: any, args: any, userContext: any): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    export function listResources(): {
        resources: ({
            uri: string;
            name: string;
            description: string;
            mimeType: string;
        } | {
            uri: string;
            name: string;
            description: string;
            mimeType: string;
        } | {
            uri: string;
            name: string;
            description: string;
            mimeType: string;
        } | {
            uri: string;
            name: string;
            description: string;
            mimeType: string;
        } | {
            uri: string;
            name: string;
            description: string;
            mimeType: string;
        })[];
    };
    export function readResource(uri: any, userContext: any): Promise<{
        contents: {
            uri: any;
            mimeType: string;
            text: string;
        }[];
    }>;
    export function listPrompts(): {
        prompts: ({
            name: string;
            description: string;
            arguments: {
                name: string;
                description: string;
                required: boolean;
            }[];
        } | {
            name: string;
            description: string;
            arguments: {
                name: string;
                description: string;
                required: boolean;
            }[];
        } | {
            name: string;
            description: string;
            arguments: {
                name: string;
                description: string;
                required: boolean;
            }[];
        })[];
    };
    export function getPrompt(promptName: any, args: any, userContext: any): Promise<{
        messages: {
            role: string;
            content: {
                type: string;
                text: string;
            };
        }[];
    }>;
    export function _getTasksList(userId: any, organizationId: any, args: any): Promise<any>;
    export function _createTask(userId: any, organizationId: any, args: any): Promise<any>;
    export function _updateTask(userId: any, organizationId: any, args: any): Promise<any>;
    export function _getTask(userId: any, organizationId: any, args: any): Promise<any>;
    export function _getInitiativesList(userId: any, organizationId: any, args: any): Promise<any>;
    export function _getInitiative(userId: any, organizationId: any, args: any): Promise<any>;
    export function _getNotificationsList(userId: any, args: any): Promise<any>;
    export function _sendNotification(userId: any, organizationId: any, args: any): Promise<any>;
    export function _getProjectsList(userId: any, organizationId: any, args: any): Promise<any>;
    export function _search(userId: any, organizationId: any, args: any): Promise<{
        query: any;
        results: never[];
    }>;
    export function _getUserProfile(userId: any): Promise<any>;
    export function _getTodaysTasks(userId: any, organizationId: any): Promise<any>;
    export function _getOverdueTasks(userId: any, organizationId: any): Promise<any>;
    export function _getUnreadNotifications(userId: any): Promise<any>;
    export function _getOrgInitiatives(organizationId: any): Promise<any>;
    export function _buildStandupPrompt(userId: any, organizationId: any, args: any): Promise<{
        role: string;
        content: {
            type: string;
            text: string;
        };
    }[]>;
    export function _buildTaskBreakdownPrompt(userId: any, organizationId: any, args: any): Promise<{
        role: string;
        content: {
            type: string;
            text: string;
        };
    }[]>;
    export function _buildInitiativeSummaryPrompt(userId: any, organizationId: any, args: any): Promise<{
        role: string;
        content: {
            type: string;
            text: string;
        };
    }[]>;
    export function _logAudit(userId: any, organizationId: any, data: any): Promise<any>;
}
declare const MCP_VERSION: "2024-11-05";
declare const TOOLS: {
    'consultify.tasks.list': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                status: {
                    type: string;
                    enum: string[];
                };
                priority: {
                    type: string;
                    enum: string[];
                };
                projectId: {
                    type: string;
                };
                limit: {
                    type: string;
                    default: number;
                };
            };
        };
    };
    'consultify.tasks.create': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                title: {
                    type: string;
                    description: string;
                };
                description: {
                    type: string;
                };
                priority: {
                    type: string;
                    enum: string[];
                };
                dueDate: {
                    type: string;
                    format: string;
                };
                projectId: {
                    type: string;
                };
                assigneeId: {
                    type: string;
                };
            };
            required: string[];
        };
    };
    'consultify.tasks.update': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                taskId: {
                    type: string;
                };
                title: {
                    type: string;
                };
                status: {
                    type: string;
                };
                priority: {
                    type: string;
                };
                dueDate: {
                    type: string;
                };
            };
            required: string[];
        };
    };
    'consultify.tasks.get': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                taskId: {
                    type: string;
                };
            };
            required: string[];
        };
    };
    'consultify.initiatives.list': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                status: {
                    type: string;
                };
                limit: {
                    type: string;
                    default: number;
                };
            };
        };
    };
    'consultify.initiatives.get': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                initiativeId: {
                    type: string;
                };
            };
            required: string[];
        };
    };
    'consultify.notifications.list': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                unreadOnly: {
                    type: string;
                    default: boolean;
                };
                limit: {
                    type: string;
                    default: number;
                };
            };
        };
    };
    'consultify.notifications.send': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                userId: {
                    type: string;
                };
                title: {
                    type: string;
                };
                message: {
                    type: string;
                };
                type: {
                    type: string;
                };
            };
            required: string[];
        };
    };
    'consultify.projects.list': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                status: {
                    type: string;
                };
                limit: {
                    type: string;
                    default: number;
                };
            };
        };
    };
    'consultify.search': {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                query: {
                    type: string;
                };
                types: {
                    type: string;
                    items: {
                        type: string;
                        enum: string[];
                    };
                    default: string[];
                };
                limit: {
                    type: string;
                    default: number;
                };
            };
            required: string[];
        };
    };
};
declare const RESOURCES: {
    'consultify://user/profile': {
        uri: string;
        name: string;
        description: string;
        mimeType: string;
    };
    'consultify://user/tasks/today': {
        uri: string;
        name: string;
        description: string;
        mimeType: string;
    };
    'consultify://user/tasks/overdue': {
        uri: string;
        name: string;
        description: string;
        mimeType: string;
    };
    'consultify://user/notifications/unread': {
        uri: string;
        name: string;
        description: string;
        mimeType: string;
    };
    'consultify://organization/initiatives': {
        uri: string;
        name: string;
        description: string;
        mimeType: string;
    };
};
declare const PROMPTS: {
    'consultify.daily_standup': {
        name: string;
        description: string;
        arguments: {
            name: string;
            description: string;
            required: boolean;
        }[];
    };
    'consultify.task_breakdown': {
        name: string;
        description: string;
        arguments: {
            name: string;
            description: string;
            required: boolean;
        }[];
    };
    'consultify.initiative_summary': {
        name: string;
        description: string;
        arguments: {
            name: string;
            description: string;
            required: boolean;
        }[];
    };
};
//# sourceMappingURL=mcpServer.d.ts.map