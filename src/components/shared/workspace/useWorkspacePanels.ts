import { useCallback, useState } from 'react';

import type { WorkspacePanelKey } from './types';

export function useWorkspacePanels(initial: WorkspacePanelKey = null) {
  const [activePanel, setActivePanel] = useState<WorkspacePanelKey>(initial);

  const togglePanel = useCallback((next: Exclude<WorkspacePanelKey, null>) => {
    setActivePanel((prev) => (prev === next ? null : next));
  }, []);

  const closePanels = useCallback(() => setActivePanel(null), []);

  return {
    activePanel,
    setActivePanel,
    togglePanel,
    closePanels,
  };
}

