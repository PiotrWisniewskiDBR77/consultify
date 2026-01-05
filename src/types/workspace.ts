/**
 * Workspace Types for Unified AI Chat System
 *
 * Defines types for workspace context that AI uses to understand
 * what the user is currently viewing/working on in split-screen mode.
 */

import { AppView } from './core';

/**
 * Types of workspace content that can be displayed alongside chat
 */
export type WorkspaceType =
    | 'task'
    | 'initiative'
    | 'assessment'
    | 'roadmap'
    | 'artifact'
    | 'document'
    | 'decision'
    | 'report'
    | 'dashboard'
    | 'empty';

/**
 * Display mode for the chat interface
 * - 'full': Full-screen AI Chat (AIChatWelcomeView)
 * - 'split': Split-screen with workspace panel
 * - 'collapsed': Chat minimized to sidebar icon
 */
export type ChatDisplayMode = 'full' | 'split' | 'collapsed';

/**
 * Context about what's currently displayed in the workspace panel
 * This is passed to AI to provide relevant assistance
 */
export interface WorkspaceContext {
    /** Current AppView being displayed */
    view: AppView;

    /** Type of content in workspace */
    type: WorkspaceType;

    /** ID of the specific entity being viewed (if any) */
    entityId?: string;

    /** Name/title of the entity for AI context */
    entityName?: string;

    /** Additional data about the entity */
    entityData?: Record<string, unknown>;

    /** PMO project context if applicable */
    projectId?: string;
    projectName?: string;

    /** Timestamp when context was set */
    timestamp: Date;
}

/**
 * Navigation options when transitioning between views
 */
export interface NavigationOptions {
    /** Preserve active conversation (default: true) */
    preserveChat?: boolean;

    /** Workspace context to set for the target view */
    workspaceContext?: Partial<WorkspaceContext>;

    /** Show "Back to Chat" option in new view */
    showReturnOption?: boolean;

    /** Entity to highlight/select in the target view */
    highlightEntityId?: string;
}

/**
 * AI action that can trigger navigation or workspace changes
 */
export interface AINavigationAction {
    type: 'navigate' | 'open_workspace' | 'expand_chat';
    targetView?: AppView;
    workspaceType?: WorkspaceType;
    entityId?: string;
    entityData?: Record<string, unknown>;
}

/**
 * Helper to create a workspace context
 */
export function createWorkspaceContext(
    view: AppView,
    type: WorkspaceType,
    options?: Partial<Omit<WorkspaceContext, 'view' | 'type' | 'timestamp'>>,
): WorkspaceContext {
    return {
        view,
        type,
        timestamp: new Date(),
        ...options,
    };
}

/**
 * Map AppView to default WorkspaceType
 */
export function getDefaultWorkspaceType(view: AppView): WorkspaceType {
    const viewTypeMap: Partial<Record<AppView, WorkspaceType>> = {
        [AppView.MY_WORK]: 'task',
        [AppView.FULL_STEP2_INITIATIVES]: 'initiative',
        [AppView.INITIATIVE_GENERATOR]: 'initiative',
        [AppView.ASSESSMENT_DRD]: 'assessment',
        [AppView.ASSESSMENT_OVERVIEW]: 'assessment',
        [AppView.FULL_STEP3_ROADMAP]: 'roadmap',
        [AppView.PORTFOLIO_ROADMAP]: 'roadmap',
        [AppView.FULL_STEP6_REPORTS]: 'report',
        [AppView.DASHBOARD]: 'dashboard',
        [AppView.USER_DASHBOARD]: 'dashboard',
    };

    return viewTypeMap[view] || 'empty';
}

export default WorkspaceContext;
