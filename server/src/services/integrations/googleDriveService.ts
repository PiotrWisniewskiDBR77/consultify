/**
 * Google Drive Service - OAuth Integration
 * Provides access to Google Drive files for AI context
 *
 * @version 1.0.0
 */

import { aiLogger } from '../ai/logger.js';

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleDriveToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
  shared?: boolean;
}

export interface DriveFolder extends DriveFile {
  children?: DriveFile[];
}

export interface DriveSearchResult {
  files: DriveFile[];
  nextPageToken?: string;
}

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';

class GoogleDriveService {
  private config: GoogleDriveConfig | null = null;

  /**
   * Initialize the service with OAuth credentials
   */
  initialize(config: GoogleDriveConfig): void {
    this.config = config;
    aiLogger.info('GoogleDriveService', 'Initialized');
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!(this.config?.clientId && this.config?.clientSecret);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string, scopes: string[] = []): string {
    if (!this.config) {
      throw new Error('GoogleDriveService not initialized');
    }

    const defaultScopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ];

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: [...defaultScopes, ...scopes].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleDriveToken> {
    if (!this.config) {
      throw new Error('GoogleDriveService not initialized');
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleDriveToken> {
    if (!this.config) {
      throw new Error('GoogleDriveService not initialized');
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Keep the same refresh token
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope,
    };
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  async ensureValidToken(token: GoogleDriveToken): Promise<GoogleDriveToken> {
    if (Date.now() < token.expiresAt - 60000) {
      return token; // Still valid (with 1 minute buffer)
    }

    return this.refreshAccessToken(token.refreshToken);
  }

  /**
   * List files in a folder
   */
  async listFiles(
    accessToken: string,
    folderId: string = 'root',
    pageToken?: string
  ): Promise<DriveSearchResult> {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, parents, shared)',
      orderBy: 'folder,name',
      pageSize: '50',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list files: ${error}`);
    }

    const data = await response.json();

    return {
      files: data.files || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Search for files
   */
  async searchFiles(
    accessToken: string,
    query: string,
    mimeType?: string,
    pageToken?: string
  ): Promise<DriveSearchResult> {
    let q = `name contains '${query}' and trashed = false`;
    if (mimeType) {
      q += ` and mimeType = '${mimeType}'`;
    }

    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, parents, shared)',
      pageSize: '20',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search failed: ${error}`);
    }

    const data = await response.json();

    return {
      files: data.files || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get file metadata
   */
  async getFile(accessToken: string, fileId: string): Promise<DriveFile> {
    const params = new URLSearchParams({
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, parents, shared',
    });

    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get file: ${error}`);
    }

    return response.json();
  }

  /**
   * Download file content
   */
  async downloadFile(accessToken: string, fileId: string): Promise<{ content: string; mimeType: string }> {
    // First, get the file metadata to determine type
    const file = await this.getFile(accessToken, fileId);

    // Handle Google Docs export
    if (file.mimeType.startsWith('application/vnd.google-apps.')) {
      return this.exportGoogleDoc(accessToken, fileId, file.mimeType);
    }

    // Download regular file
    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download file: ${error}`);
    }

    const content = await response.text();

    return {
      content,
      mimeType: file.mimeType,
    };
  }

  /**
   * Export Google Docs/Sheets/Slides to standard format
   */
  async exportGoogleDoc(
    accessToken: string,
    fileId: string,
    mimeType: string
  ): Promise<{ content: string; mimeType: string }> {
    const exportMimeTypes: Record<string, string> = {
      'application/vnd.google-apps.document': 'text/plain',
      'application/vnd.google-apps.spreadsheet': 'text/csv',
      'application/vnd.google-apps.presentation': 'text/plain',
    };

    const exportMimeType = exportMimeTypes[mimeType] || 'text/plain';

    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to export file: ${error}`);
    }

    const content = await response.text();

    return {
      content,
      mimeType: exportMimeType,
    };
  }

  /**
   * Get storage quota
   */
  async getStorageQuota(accessToken: string): Promise<{ used: number; limit: number }> {
    const response = await fetch(`${GOOGLE_DRIVE_API}/about?fields=storageQuota`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get quota: ${error}`);
    }

    const data = await response.json();
    const quota = data.storageQuota || {};

    return {
      used: parseInt(quota.usage) || 0,
      limit: parseInt(quota.limit) || 0,
    };
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<void> {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }
}

export const googleDriveService = new GoogleDriveService();
export default googleDriveService;
