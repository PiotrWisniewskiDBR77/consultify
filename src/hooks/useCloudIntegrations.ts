import { useCallback, useState } from 'react';

import { Api } from '../services/api';

export type CloudProviderId = 'google-drive' | 'onedrive' | 'dropbox';

export type CloudFile = {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  isFolder?: boolean;
  modifiedAt?: string;
  thumbnailUrl?: string;
  providerId?: CloudProviderId;
  url?: string;
};

export const useCloudIntegrations = () => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<CloudProviderId | null>(null);

  const openFilePicker = useCallback((providerId: CloudProviderId) => {
    setActiveProvider(providerId);
    setIsPickerOpen(true);
  }, []);

  const closeFilePicker = useCallback(() => {
    setIsPickerOpen(false);
  }, []);

  const connectProvider = useCallback((_providerId: CloudProviderId) => {
    // Stub - no-op for now
  }, []);

  const selectFile = useCallback(
    async (file: CloudFile, providerId?: CloudProviderId): Promise<File | null> => {
      if (!providerId) return null;
      try {
        const blob = await Api.downloadCloudFile(providerId, file.id);
        const type = file.mimeType || blob.type || 'application/octet-stream';
        return new File([blob], file.name, { type });
      } catch (error) {
        console.error('[CloudIntegrations] Failed to download file:', error);
        return null;
      } finally {
        setIsPickerOpen(false);
      }
    },
    []
  );

  return {
    connectedProviderIds: [] as CloudProviderId[],
    openFilePicker,
    connectProvider,
    isPickerOpen,
    activeProvider,
    closeFilePicker,
    selectFile,
  };
};
