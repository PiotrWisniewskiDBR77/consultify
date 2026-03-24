/**
 * Data Collection — barrel export and connector registration.
 */

export {
  connectorRegistry,
  connectorRunner,
  type IConnector,
  type ExternalSchema,
  type ExternalRecord,
  type FetchOptions,
  type FieldMapping,
  type RunResult,
  type ConnectorRow,
} from './connectorFramework.js';

export {
  default as schemaMappingEngine,
  autoMap,
  inferFieldType,
  transformValue,
  validateMapping,
  type TargetField,
} from './schemaMappingEngine.js';

export { csvXlsxConnector } from './connectors/csvXlsx.js';
export { googleSheetsConnector } from './connectors/googleSheets.js';
export { airtableConnector } from './connectors/airtable.js';
export { postgresConnector } from './connectors/postgres.js';
export { jiraConnector } from './connectors/jira.js';
export { webhookConnector } from './connectors/webhook.js';

export { SyncScheduler, syncScheduler } from './syncScheduler.js';

export { SchemaDriftDetector, schemaDriftDetector, type DriftReport } from './schemaDriftDetector.js';

// ---------------------------------------------------------------------------
// Auto-register built-in connectors
// ---------------------------------------------------------------------------

import { connectorRegistry } from './connectorFramework.js';
import { csvXlsxConnector } from './connectors/csvXlsx.js';
import { googleSheetsConnector } from './connectors/googleSheets.js';
import { airtableConnector } from './connectors/airtable.js';
import { postgresConnector } from './connectors/postgres.js';
import { jiraConnector } from './connectors/jira.js';
import { webhookConnector } from './connectors/webhook.js';

connectorRegistry.register('csv_xlsx', csvXlsxConnector);
connectorRegistry.register('google_sheets', googleSheetsConnector);
connectorRegistry.register('airtable', airtableConnector);
connectorRegistry.register('postgres', postgresConnector);
connectorRegistry.register('jira', jiraConnector);
connectorRegistry.register('webhook', webhookConnector);
