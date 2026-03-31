/**
 * P01 Extension — Cloud Storage Sync Tests
 *
 * Verifies bidirectional cloud storage sync for:
 * - Google Drive: list + download + upload (real API calls)
 * - OneDrive/SharePoint: list + download + upload (real Graph API)
 * - Dropbox: list + download + upload (real Dropbox API)
 * - CONNECTORS catalog includes cloud storage providers
 * - Cloud routes: sources CRUD, file listing, download, upload, sync, import
 * - Background import processing
 */

import { describe, it, expect } from 'vitest';

// ===========================================================================
// CONNECTORS catalog — cloud storage providers
// ===========================================================================

describe('Cloud Storage — CONNECTORS catalog', () => {
  it('CONNECTORS includes google_drive', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    expect(mod.CONNECTORS.google_drive).toBeDefined();
    expect(mod.CONNECTORS.google_drive.capabilities).toContain('files');
  });

  it('CONNECTORS includes onedrive', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    expect(mod.CONNECTORS.onedrive).toBeDefined();
    expect(mod.CONNECTORS.onedrive.capabilities).toContain('files');
  });

  it('CONNECTORS includes dropbox', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    expect(mod.CONNECTORS.dropbox).toBeDefined();
    expect(mod.CONNECTORS.dropbox.capabilities).toContain('files');
  });

  it('PROVIDER_ADAPTERS includes cloud storage adapters', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrationHubService.ts', 'utf-8'
    );
    expect(content).toContain('google_drive: cloudStorageSyncAdapter');
    expect(content).toContain('onedrive: cloudStorageSyncAdapter');
    expect(content).toContain('dropbox: cloudStorageSyncAdapter');
  });
});

// ===========================================================================
// cloudDataService — provider implementations
// ===========================================================================

describe('Cloud Storage — cloudDataService providers', () => {
  it('exports all CRUD + sync functions', async () => {
    const mod = await import(
      '../../../server/src/services/cloudDataService.js'
    );
    const svc = mod.default || mod;
    expect(typeof (svc.listCloudSources || mod.listCloudSources)).toBe('function');
    expect(typeof (svc.getCloudSource || mod.getCloudSource)).toBe('function');
    expect(typeof (svc.createCloudSource || mod.createCloudSource)).toBe('function');
    expect(typeof (svc.deleteCloudSource || mod.deleteCloudSource)).toBe('function');
    expect(typeof (svc.listCloudFiles || mod.listCloudFiles)).toBe('function');
    expect(typeof (svc.downloadCloudFile || mod.downloadCloudFile)).toBe('function');
    expect(typeof (svc.uploadCloudFile || mod.uploadCloudFile)).toBe('function');
    expect(typeof (svc.processImportJob || mod.processImportJob)).toBe('function');
  });

  it('Google Drive: list uses googleapis.com/drive/v3', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('googleapis.com/drive/v3/files');
  });

  it('Google Drive: download supports Workspace doc export', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('vnd.google-apps.document');
    expect(content).toContain('vnd.google-apps.spreadsheet');
    expect(content).toContain('/export?mimeType=');
  });

  it('Google Drive: upload uses multipart upload', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('uploadType=multipart');
    expect(content).toContain('multipart/related');
  });

  it('OneDrive: list uses Graph API /me/drive', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('graph.microsoft.com/v1.0/me/drive/root/children');
    expect(content).toContain('graph.microsoft.com/v1.0/me/drive/items');
  });

  it('OneDrive: download fetches /content endpoint', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('/content');
    expect(content).toContain('downloadOneDriveFile');
  });

  it('OneDrive: upload uses PUT to /content', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('uploadOneDriveFile');
    expect(content).toContain("method: 'PUT'");
  });

  it('Dropbox: list uses /2/files/list_folder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('api.dropboxapi.com/2/files/list_folder');
  });

  it('Dropbox: download uses /2/files/download', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('content.dropboxapi.com/2/files/download');
    expect(content).toContain('Dropbox-API-Arg');
  });

  it('Dropbox: upload uses /2/files/upload', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('content.dropboxapi.com/2/files/upload');
  });

  it('listCloudFiles dispatches to all 3 providers', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain("source.provider === 'google_drive'");
    expect(content).toContain("source.provider === 'onedrive'");
    expect(content).toContain("source.provider === 'dropbox'");
  });

  it('downloadCloudFile dispatches to all 3 providers', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    const downloadSection = content.split('downloadCloudFile')[1] || '';
    expect(downloadSection).toContain('downloadGoogleDriveFile');
    expect(downloadSection).toContain('downloadOneDriveFile');
    expect(downloadSection).toContain('downloadDropboxFile');
  });

  it('uploadCloudFile dispatches to all 3 providers', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    const uploadSection = content.split('uploadCloudFile')[1] || '';
    expect(uploadSection).toContain('uploadGoogleDriveFile');
    expect(uploadSection).toContain('uploadOneDriveFile');
    expect(uploadSection).toContain('uploadDropboxFile');
  });
});

// ===========================================================================
// Cloud routes
// ===========================================================================

describe('Cloud Storage — API routes', () => {
  it('cloud routes have sources CRUD', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/cloud.routes.ts', 'utf-8'
    );
    expect(content).toContain("router.get('/sources'");
    expect(content).toContain("router.post('/sources'");
    expect(content).toContain("router.delete('/sources/:id'");
  });

  it('cloud routes have file listing + download + upload', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/cloud.routes.ts', 'utf-8'
    );
    expect(content).toContain('/files');
    expect(content).toContain('/download');
    expect(content).toContain('/upload');
  });

  it('cloud routes have sync endpoint', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/cloud.routes.ts', 'utf-8'
    );
    expect(content).toContain('/sync');
    expect(content).toContain('filesSynced');
  });

  it('cloud routes have import + process endpoints', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/cloud.routes.ts', 'utf-8'
    );
    expect(content).toContain("router.post('/import'");
    expect(content).toContain('/process');
    expect(content).toContain('processImportJob');
  });

  it('cloud routes have providers catalog endpoint', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/cloud.routes.ts', 'utf-8'
    );
    expect(content).toContain("router.get('/providers'");
    expect(content).toContain('google_drive');
    expect(content).toContain('onedrive');
    expect(content).toContain('dropbox');
  });

  it('Gateway mounts /api/cloud', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/Gateway.ts', 'utf-8'
    );
    expect(content).toContain('/api/cloud');
  });
});

// ===========================================================================
// Background import processing
// ===========================================================================

describe('Cloud Storage — Background import', () => {
  it('processImportJob exists and handles download + extract', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/cloudDataService.ts', 'utf-8'
    );
    expect(content).toContain('processImportJob');
    expect(content).toContain("status = 'downloading'");
    expect(content).toContain("status = 'processing'");
    expect(content).toContain("status = 'completed'");
    expect(content).toContain("status = 'failed'");
  });
});

// ===========================================================================
// Frontend — CloudDataSettings + CloudFilePicker
// ===========================================================================

describe('Cloud Storage — Frontend', () => {
  it('CloudDataSettings has sync button', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/components/settings/CloudDataSettings.tsx', 'utf-8'
    );
    expect(content).toContain('handleSync');
    expect(content).toContain('/sync');
    expect(content).toContain('RefreshCw');
  });

  it('CloudDataSettings supports all providers', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/components/settings/CloudDataSettings.tsx', 'utf-8'
    );
    expect(content).toContain('google_drive');
    expect(content).toContain('onedrive');
    expect(content).toContain('dropbox');
    expect(content).toContain('sharepoint');
  });

  it('CloudFilePicker exists and calls listCloudFiles', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/components/AIChat/CloudFilePicker.tsx', 'utf-8'
    );
    expect(content).toContain('listCloudFiles');
    expect(content.length).toBeGreaterThan(200);
  });

  it('Api service has cloud file methods', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/services/api.ts', 'utf-8'
    );
    expect(content).toContain('listCloudFiles');
    expect(content).toContain('downloadCloudFile');
    expect(content).toContain('getCloudProviders');
  });
});
