/**
 * OneDrive Service - Microsoft OAuth Integration
 * Provides access to OneDrive/SharePoint files for AI context
 *
 * @version 1.0.0
 */

import { aiLogger } from '../ai/logger.js';

export interface OneDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId?: string; // 'common' for personal accounts, tenant ID for organization
}

export interface OneDriveToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export interface OneDriveItem {
  id: string;
  name: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  webUrl?: string;
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount: number;
  };
  parentReference?: {
    id: string;
    path: string;
  };
  shared?: {
    scope: string;
  };
}

export interface OneDriveSearchResult {
  items: OneDriveItem[];
  nextLink?: string;
}

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com';
const MICROSOFT_GRAPH_API = 'https://graph.microsoft.com/v1.0';

class OneDriveService {
  private config: OneDriveConfig | null = null;

  /**
   * Initialize the service with OAuth credentials
   */
  initialize(config: OneDriveConfig): void {
    this.config = {
      ...config,
      tenantId: config.tenantId || 'common',
    };
    aiLogger.info('OneDriveService', 'Initialized');
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
      throw new Error('OneDriveService not initialized');
    }

    const defaultScopes = [
      'Files.Read',
      'Files.Read.All',
      'User.Read',
      'offline_access',
    ];

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: [...defaultScopes, ...scopes].join(' '),
      state,
    });

    return `${MICROSOFT_AUTH_URL}/${this.config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OneDriveToken> {
    if (!this.config) {
      throw new Error('OneDriveService not initialized');
    }

    const response = await fetch(
      `${MICROSOFT_AUTH_URL}/${this.config.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
        }),
      }
    );

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
  async refreshAccessToken(refreshToken: string): Promise<OneDriveToken> {
    if (!this.config) {
      throw new Error('OneDriveService not initialized');
    }

    const response = await fetch(
      `${MICROSOFT_AUTH_URL}/${this.config.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope,
    };
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  async ensureValidToken(token: OneDriveToken): Promise<OneDriveToken> {
    if (Date.now() < token.expiresAt - 60000) {
      return token;
    }

    return this.refreshAccessToken(token.refreshToken);
  }

  /**
   * List items in a folder
   */
  async listItems(
    accessToken: string,
    folderId: string = 'root',
    skipToken?: string
  ): Promise<OneDriveSearchResult> {
    let url = `${MICROSOFT_GRAPH_API}/me/drive/items/${folderId}/children`;
    url += '?$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,parentReference,shared';
    url += '&$orderby=folder desc,name';
    url += '&$top=50';

    if (skipToken) {
      url += `&$skiptoken=${skipToken}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list items: ${error}`);
    }

    const data = await response.json();

    return {
      items: data.value || [],
      nextLink: data['@odata.nextLink'],
    };
  }

  /**
   * Search for files
   */
  async searchFiles(
    accessToken: string,
    query: string,
    skipToken?: string
  ): Promise<OneDriveSearchResult> {
    let url = `${MICROSOFT_GRAPH_API}/me/drive/root/search(q='${encodeURIComponent(query)}')`;
    url += '?$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,parentReference';
    url += '&$top=25';

    if (skipToken) {
      url += `&$skiptoken=${skipToken}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search failed: ${error}`);
    }

    const data = await response.json();

    return {
      items: data.value || [],
      nextLink: data['@odata.nextLink'],
    };
  }

  /**
   * Get item metadata
   */
  async getItem(accessToken: string, itemId: string): Promise<OneDriveItem> {
    const response = await fetch(
      `${MICROSOFT_GRAPH_API}/me/drive/items/${itemId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get item: ${error}`);
    }

    return response.json();
  }

  /**
   * Download file content
   */
  async downloadFile(accessToken: string, itemId: string): Promise<{ content: string; mimeType: string }> {
    // Get item metadata first
    const item = await this.getItem(accessToken, itemId);

    if (item.folder) {
      throw new Error('Cannot download a folder');
    }

    // Download the content
    const response = await fetch(
      `${MICROSOFT_GRAPH_API}/me/drive/items/${itemId}/content`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download file: ${error}`);
    }

    const content = await response.text();

    return {
      content,
      mimeType: item.file?.mimeType || 'application/octet-stream',
    };
  }

  /**
   * Get recent files
   */
  async getRecentFiles(accessToken: string): Promise<OneDriveItem[]> {
    const response = await fetch(
      `${MICROSOFT_GRAPH_API}/me/drive/recent?$select=id,name,size,lastModifiedDateTime,webUrl,file,folder&$top=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get recent files: ${error}`);
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Get shared files
   */
  async getSharedWithMe(accessToken: string): Promise<OneDriveItem[]> {
    const response = await fetch(
      `${MICROSOFT_GRAPH_API}/me/drive/sharedWithMe?$select=id,name,size,lastModifiedDateTime,webUrl,file,folder&$top=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get shared files: ${error}`);
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Get storage quota
   */
  async getStorageQuota(accessToken: string): Promise<{ used: number; total: number; remaining: number }> {
    const response = await fetch(
      `${MICROSOFT_GRAPH_API}/me/drive?$select=quota`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get quota: ${error}`);
    }

    const data = await response.json();
    const quota = data.quota || {};

    return {
      used: quota.used || 0,
      total: quota.total || 0,
      remaining: quota.remaining || 0,
    };
  }

  /**
   * Get user profile
   */
  async getUserProfile(accessToken: string): Promise<{ displayName: string; email: string }> {
    const response = await fetch(
      `${MICROSOFT_GRAPH_API}/me?$select=displayName,mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get profile: ${error}`);
    }

    const data = await response.json();

    return {
      displayName: data.displayName || '',
      email: data.mail || data.userPrincipalName || '',
    };
  }
}

export const oneDriveService = new OneDriveService();
export default oneDriveService;
