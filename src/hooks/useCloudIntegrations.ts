import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

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
  const [connectedProviderIds, setConnectedProviderIds] = useState<CloudProviderId[]>([]);
  const [isImplemented, setIsImplemented] = useState(false);

  const refreshProviders = useCallback(async () => {
    try {
      const result = await Api.getCloudProviders();
      const providers = Array.isArray((result as any)?.providers) ? (result as any).providers : [];
      const connected = providers
        .filter((p: any) => p.connected)
        .map((p: any) => p.id as CloudProviderId);
      setConnectedProviderIds(connected);
      setIsImplemented(true);
    } catch {
      setConnectedProviderIds([]);
      setIsImplemented(false);
    }
  }, []);

  const openFilePicker = useCallback((providerId: CloudProviderId) => {
    setActiveProvider(providerId);
    setIsPickerOpen(true);
  }, []);

  const closeFilePicker = useCallback(() => {
    setIsPickerOpen(false);
  }, []);

  const connectProvider = useCallback(
    async (_providerId: CloudProviderId) => {
      await refreshProviders();
      toast('Cloud connection is managed in Integrations settings. In-chat OAuth is not available here.', {
        icon: 'ℹ️',
      });
    },
    [refreshProviders]
  );

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

  useEffect(() => {
    void refreshProviders();
  }, [refreshProviders]);

  return {
    connectedProviderIds,
    openFilePicker,
    connectProvider,
    isPickerOpen,
    activeProvider,
    closeFilePicker,
    selectFile,
    isImplemented,
  };
};
