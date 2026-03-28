/**
 * Organization Metadata Service
 * Manages custom attributes and metadata for organizations.
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';
import organizationContextService from './organizationContext/OrganizationContextService.js';

class OrganizationMetadataServiceClass {
  private db: IDatabase;
  private logger: any;

  constructor(deps?: { db?: IDatabase; logger?: any }) {
    this.db = deps?.db || getDatabase();
    this.logger = deps?.logger || _logger;
  }

  setDependencies(deps: { db?: IDatabase; logger?: any }) {
    if (deps.db) this.db = deps.db;
    if (deps.logger) this.logger = deps.logger;
  }

  async getMetadata(orgId: string): Promise<any[]> {
    return await this.db.all('SELECT * FROM organization_metadata WHERE organization_id = ?', [
      orgId,
    ]);
  }

  async setMetadata(
    orgId: string,
    key: string,
    value: string,
    valueType: string = 'string',
    category: string = 'general',
    isSensitive: boolean = false
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO organization_metadata (organization_id, key, value, value_type, category, is_sensitive) 
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id, key) DO UPDATE SET value = excluded.value, value_type = excluded.value_type, category = excluded.category, is_sensitive = excluded.is_sensitive`,
      [orgId, key, value, valueType, category, isSensitive ? 1 : 0]
    );
    await organizationContextService.recordOrganizationMetadata({
      organizationId: orgId,
      userId: null,
      payload: { key, value, valueType, category, isSensitive },
    });
  }

  async deleteMetadata(orgId: string, key: string): Promise<boolean> {
    const result = await this.db.run(
      'DELETE FROM organization_metadata WHERE organization_id = ? AND key = ?',
      [orgId, key]
    );
    return (result as any).changes > 0;
  }
}

const organizationMetadataService = new OrganizationMetadataServiceClass();
export default organizationMetadataService;
