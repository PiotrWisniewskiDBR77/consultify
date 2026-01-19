/**
 * useCloudIntegrations
 *
 * Hook for managing cloud storage integrations (Google Drive, OneDrive, Dropbox)
 * Provides state and actions for connecting/disconnecting cloud providers
 * and selecting files from connected cloud storage.
 *
 * @version 2.0.0
 */

import { useCallback, useEffect, useState } from 'react';

import { Api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

export interface CloudProvider {
  id: 'google-drive' | 'onedrive' | 'dropbox';
  name: string;
  connected: boolean;
  connectedAt?: Date;
  email?: string; // Connected account email
}

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isFolder: boolean;
  provider?: CloudProvider['id'];
  path?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  modifiedAt?: string;
}

interface CloudIntegrationsState {
  providers: CloudProvider[];
  isLoading: boolean;
  error: string | null;
  isPickerOpen: boolean;
  activeProvider: CloudProvider['id'] | null;
}

export const useCloudIntegrations = () => {
  const { setCurrentView } = useAppStore();

  const [state, setState] = useState<CloudIntegrationsState>({
    providers: [
      { id: 'google-drive', name: 'Google Drive', connected: false },
      { id: 'onedrive', name: 'OneDrive', connected: false },
      { id: 'dropbox', name: 'Dropbox', connected: false },
    ],
    isLoading: false,
    error: null,
    isPickerOpen: false,
    activeProvider: null,
  });

  // Load connected providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const response = await Api.getCloudProviders();
        setState((s) => ({ ...s, providers: response.providers, isLoading: false }));
      } catch (error: any) {
        setState((s) => ({
          ...s,
          error: error?.message || 'Failed to load cloud integrations',
          isLoading: false,
        }));
      }
    };
    loadProviders();
  }, []);

  // Get list of connected provider IDs (for AddFilesMenu)
  const connectedProviderIds = state.providers.filter((p) => p.connected).map((p) => p.id);

  // Connect to a cloud provider
  const connectProvider = useCallback(
    async (providerId: CloudProvider['id']) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        // Navigate to integrations settings
        setCurrentView(AppView.SETTINGS_INTEGRATIONS);
        console.log(`[CloudIntegrations] Redirecting to settings to connect ${providerId}`);
        setState((s) => ({ ...s, isLoading: false }));
      } catch (error: any) {
        setState((s) => ({
          ...s,
          error: error?.message || 'Failed to connect provider',
          isLoading: false,
        }));
      }
    },
    [setCurrentView]
  );

  // Disconnect from a cloud provider
  const disconnectProvider = useCallback(async (providerId: CloudProvider['id']) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await Api.disconnectCloudProvider(providerId);
      setState((s) => ({
        ...s,
        providers: s.providers.map((p) =>
          p.id === providerId ? { ...p, connected: false, email: undefined } : p
        ),
        isLoading: false,
      }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        error: error?.message || 'Failed to disconnect provider',
        isLoading: false,
      }));
    }
  }, []);

  // Open file picker for a provider
  const openFilePicker = useCallback(
    (providerId: CloudProvider['id']) => {
      const provider = state.providers.find((p) => p.id === providerId);

      if (!provider?.connected) {
        // Not connected - redirect to settings
        connectProvider(providerId);
        return;
      }

      // Open picker modal
      setState((s) => ({
        ...s,
        isPickerOpen: true,
        activeProvider: providerId,
      }));

      console.log(`[CloudIntegrations] Opening file picker for ${providerId}`);
    },
    [state.providers, connectProvider]
  );

  // Close file picker
  const closeFilePicker = useCallback(() => {
    setState((s) => ({
      ...s,
      isPickerOpen: false,
      activeProvider: null,
    }));
  }, []);

  // List files from a provider
  const listFiles = useCallback(
    async (providerId: CloudProvider['id'], folderId?: string): Promise<CloudFile[]> => {
      try {
        const response = await Api.listCloudFiles(providerId, folderId);
        return response.files;
      } catch (error: any) {
        console.error('[CloudIntegrations] Failed to list files:', error);
        setState((s) => ({ ...s, error: error?.message || 'Failed to list files' }));
        return [];
      }
    },
    []
  );

  // Select a file from cloud storage
  const selectFile = useCallback(
    async (file: CloudFile, providerId: CloudProvider['id']): Promise<File | null> => {
      try {
        // Download the file
        const blob = await Api.downloadCloudFile(providerId, file.id);

        // Create File object
        return new File([blob], file.name, { type: file.mimeType });
      } catch (error: any) {
        console.error('[CloudIntegrations] Failed to download file:', error);
        setState((s) => ({
          ...s,
          error: error?.message || 'Failed to download file',
        }));
        return null;
      }
    },
    []
  );

  // Refresh providers list
  const refreshProviders = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const response = await Api.getCloudProviders();
      setState((s) => ({ ...s, providers: response.providers, isLoading: false }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        error: error?.message || 'Failed to refresh providers',
        isLoading: false,
      }));
    }
  }, []);

  return {
    // State
    providers: state.providers,
    connectedProviderIds,
    isLoading: state.isLoading,
    error: state.error,
    isPickerOpen: state.isPickerOpen,
    activeProvider: state.activeProvider,

    // Actions
    connectProvider,
    disconnectProvider,
    openFilePicker,
    closeFilePicker,
    listFiles,
    selectFile,
    refreshProviders,
  };
};

export default useCloudIntegrations;
