/**
 * Data Collection — barrel export and connector registration.
 */

export {
  connectorRegistry,
  type ConnectorRow,
  connectorRunner,
  type ExternalRecord,
  type ExternalSchema,
  type FetchOptions,
  type FieldMapping,
  type IConnector,
  type RunResult,
} from './connectorFramework.js';
export { airtableConnector } from './connectors/airtable.js';
export { csvXlsxConnector } from './connectors/csvXlsx.js';
export { googleSheetsConnector } from './connectors/googleSheets.js';
export { jiraConnector } from './connectors/jira.js';
export { postgresConnector } from './connectors/postgres.js';
export { webhookConnector } from './connectors/webhook.js';
export {
  type DriftReport,
  SchemaDriftDetector,
  schemaDriftDetector,
} from './schemaDriftDetector.js';
export {
  autoMap,
  inferFieldType,
  default as schemaMappingEngine,
  type TargetField,
  transformValue,
  validateMapping,
} from './schemaMappingEngine.js';
export { SyncScheduler, syncScheduler } from './syncScheduler.js';

// ---------------------------------------------------------------------------
// Auto-register built-in connectors
// ---------------------------------------------------------------------------

import { connectorRegistry } from './connectorFramework.js';
import { airtableConnector } from './connectors/airtable.js';
import { csvXlsxConnector } from './connectors/csvXlsx.js';
import { googleSheetsConnector } from './connectors/googleSheets.js';
import { jiraConnector } from './connectors/jira.js';
import { postgresConnector } from './connectors/postgres.js';
import { webhookConnector } from './connectors/webhook.js';

connectorRegistry.register('csv_xlsx', csvXlsxConnector);
connectorRegistry.register('google_sheets', googleSheetsConnector);
connectorRegistry.register('airtable', airtableConnector);
connectorRegistry.register('postgres', postgresConnector);
connectorRegistry.register('jira', jiraConnector);
connectorRegistry.register('webhook', webhookConnector);
