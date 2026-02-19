/**
 * Startup Validator
 *
 * The real implementation is not present in this repository. Export an explicit marker so the
 * server startup can skip validation without relying on stub proxies or self-import wrappers.
 */
const startupValidator = { __unavailable__: true } as const;

export default startupValidator;
