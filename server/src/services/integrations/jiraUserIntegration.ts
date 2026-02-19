/**
 * Jira User Integration
 *
 * Not implemented in this codebase. Export an explicit marker so runtime code can return an
 * honest `503` instead of relying on lazy-loader wrappers.
 */
const jiraUserIntegration = { __unavailable__: true } as const;

export default jiraUserIntegration;
