import { useCallback, useState } from 'react';

import type { WorkspaceSelection } from './types';

export function useWorkspaceSelection(initial: WorkspaceSelection = { kind: 'none' }) {
  const [selection, setSelection] = useState<WorkspaceSelection>(initial);
  const clearSelection = useCallback(() => setSelection({ kind: 'none' }), []);
  return { selection, setSelection, clearSelection };
}

