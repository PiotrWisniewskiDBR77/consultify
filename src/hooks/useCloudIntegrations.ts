import { useCallback, useState } from 'react';

export type CloudFile = {
  id: string;
  name: string;
  mimeType?: string;
  providerId?: string;
  url?: string;
};

export const useCloudIntegrations = () => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const openFilePicker = useCallback((providerId: string) => {
    setActiveProvider(providerId);
    setIsPickerOpen(true);
  }, []);

  const closeFilePicker = useCallback(() => {
    setIsPickerOpen(false);
  }, []);

  const connectProvider = useCallback((_providerId: string) => {
    // Stub - no-op for now
  }, []);

  const selectFile = useCallback((_file: CloudFile) => {
    setIsPickerOpen(false);
  }, []);

  return {
    connectedProviderIds: [] as string[],
    openFilePicker,
    connectProvider,
    isPickerOpen,
    activeProvider,
    closeFilePicker,
    selectFile,
  };
};
