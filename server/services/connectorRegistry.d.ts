declare namespace _default {
    export { CONNECTOR_CATALOG };
    export { CONNECTOR_CATEGORIES };
    export { getAllConnectors };
    export { getConnector };
    export { getConnectorsByCategory };
    export { hasCapability };
    export { getRequiredCredentials };
    export { validateCredentials };
    export { getAllCategories };
}
export default _default;
export namespace CONNECTOR_CATALOG {
    namespace jira {
        let key: string;
        let name: string;
        let category: string;
        let description: string;
        let capabilities: string[];
        let requiredCredentials: string[];
        let defaultScopes: string[];
        let iconUrl: string;
        let documentationUrl: string;
    }
    namespace google_calendar {
        let key_1: string;
        export { key_1 as key };
        let name_1: string;
        export { name_1 as name };
        let category_1: string;
        export { category_1 as category };
        let description_1: string;
        export { description_1 as description };
        let capabilities_1: string[];
        export { capabilities_1 as capabilities };
        let requiredCredentials_1: string[];
        export { requiredCredentials_1 as requiredCredentials };
        let defaultScopes_1: string[];
        export { defaultScopes_1 as defaultScopes };
        let iconUrl_1: string;
        export { iconUrl_1 as iconUrl };
        let documentationUrl_1: string;
        export { documentationUrl_1 as documentationUrl };
    }
    namespace slack {
        let key_2: string;
        export { key_2 as key };
        let name_2: string;
        export { name_2 as name };
        let category_2: string;
        export { category_2 as category };
        let description_2: string;
        export { description_2 as description };
        let capabilities_2: string[];
        export { capabilities_2 as capabilities };
        let requiredCredentials_2: string[];
        export { requiredCredentials_2 as requiredCredentials };
        export let optionalCredentials: string[];
        let defaultScopes_2: string[];
        export { defaultScopes_2 as defaultScopes };
        let iconUrl_2: string;
        export { iconUrl_2 as iconUrl };
        let documentationUrl_2: string;
        export { documentationUrl_2 as documentationUrl };
    }
    namespace teams {
        let key_3: string;
        export { key_3 as key };
        let name_3: string;
        export { name_3 as name };
        let category_3: string;
        export { category_3 as category };
        let description_3: string;
        export { description_3 as description };
        let capabilities_3: string[];
        export { capabilities_3 as capabilities };
        let requiredCredentials_3: string[];
        export { requiredCredentials_3 as requiredCredentials };
        let defaultScopes_3: string[];
        export { defaultScopes_3 as defaultScopes };
        let iconUrl_3: string;
        export { iconUrl_3 as iconUrl };
        let documentationUrl_3: string;
        export { documentationUrl_3 as documentationUrl };
    }
    namespace hubspot {
        let key_4: string;
        export { key_4 as key };
        let name_4: string;
        export { name_4 as name };
        let category_4: string;
        export { category_4 as category };
        let description_4: string;
        export { description_4 as description };
        let capabilities_4: string[];
        export { capabilities_4 as capabilities };
        let requiredCredentials_4: string[];
        export { requiredCredentials_4 as requiredCredentials };
        let defaultScopes_4: string[];
        export { defaultScopes_4 as defaultScopes };
        let iconUrl_4: string;
        export { iconUrl_4 as iconUrl };
        let documentationUrl_4: string;
        export { documentationUrl_4 as documentationUrl };
    }
}
export namespace CONNECTOR_CATEGORIES {
    namespace project_management {
        export let label: string;
        let description_5: string;
        export { description_5 as description };
    }
    namespace calendar {
        let label_1: string;
        export { label_1 as label };
        let description_6: string;
        export { description_6 as description };
    }
    namespace communication {
        let label_2: string;
        export { label_2 as label };
        let description_7: string;
        export { description_7 as description };
    }
    namespace crm {
        let label_3: string;
        export { label_3 as label };
        let description_8: string;
        export { description_8 as description };
    }
}
/**
 * Get all available connectors.
 * @returns {Object[]} Array of connector definitions
 */
export function getAllConnectors(): Object[];
/**
 * Get a connector by key.
 * @param {string} key - Connector key
 * @returns {Object|null} Connector definition or null
 */
export function getConnector(key: string): Object | null;
/**
 * Get connectors by category.
 * @param {string} category - Category key
 * @returns {Object[]} Array of connectors in the category
 */
export function getConnectorsByCategory(category: string): Object[];
/**
 * Check if a connector supports a specific capability.
 * @param {string} key - Connector key
 * @param {string} capability - Capability to check
 * @returns {boolean}
 */
export function hasCapability(key: string, capability: string): boolean;
/**
 * Get required credentials for a connector.
 * @param {string} key - Connector key
 * @returns {string[]} List of required credential field names
 */
export function getRequiredCredentials(key: string): string[];
/**
 * Validate credentials for a connector.
 * @param {string} key - Connector key
 * @param {Object} credentials - Credentials object
 * @returns {boolean|{ valid: boolean, missing: string[] }}
 */
export function validateCredentials(key: string, credentials: Object): boolean | {
    valid: boolean;
    missing: string[];
};
/**
 * Get all categories.
 * @returns {Object[]} Categories with labels
 */
export function getAllCategories(): Object[];
//# sourceMappingURL=connectorRegistry.d.ts.map