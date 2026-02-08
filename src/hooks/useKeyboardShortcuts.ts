import { useCallback, useEffect, useState } from 'react';

interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'task_management' | 'ai' | 'general';
  defaultKey: string;
  currentKey: string;
  enabled: boolean;
}

interface ShortcutsConfig {
  enabled: boolean;
  preset: string;
  customMappings: Record<string, string>;
  disabledActions: string[];
}

interface UseKeyboardShortcutsOptions {
  onShortcutTriggered?: (shortcutId: string) => void;
}

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'navigate_dashboard',
    name: 'Go to Dashboard',
    description: 'Navigate to dashboard',
    category: 'navigation',
    defaultKey: 'g d',
    currentKey: 'g d',
    enabled: true,
  },
  {
    id: 'navigate_tasks',
    name: 'Go to Tasks',
    description: 'Navigate to tasks',
    category: 'navigation',
    defaultKey: 'g t',
    currentKey: 'g t',
    enabled: true,
  },
  {
    id: 'navigate_projects',
    name: 'Go to Projects',
    description: 'Navigate to projects',
    category: 'navigation',
    defaultKey: 'g p',
    currentKey: 'g p',
    enabled: true,
  },
  {
    id: 'new_task',
    name: 'New Task',
    description: 'Create a new task',
    category: 'task_management',
    defaultKey: 'n t',
    currentKey: 'n t',
    enabled: true,
  },
  {
    id: 'edit_task',
    name: 'Edit Task',
    description: 'Edit selected task',
    category: 'task_management',
    defaultKey: 'e',
    currentKey: 'e',
    enabled: true,
  },
  {
    id: 'complete_task',
    name: 'Complete Task',
    description: 'Complete selected task',
    category: 'task_management',
    defaultKey: 'x',
    currentKey: 'x',
    enabled: true,
  },
  {
    id: 'open_ai',
    name: 'Open AI Chat',
    description: 'Open AI assistant',
    category: 'ai',
    defaultKey: 'Ctrl+/',
    currentKey: 'Ctrl+/',
    enabled: true,
  },
  {
    id: 'search',
    name: 'Search',
    description: 'Open search',
    category: 'general',
    defaultKey: 'Ctrl+k',
    currentKey: 'Ctrl+k',
    enabled: true,
  },
  {
    id: 'help',
    name: 'Help',
    description: 'Show keyboard shortcuts help',
    category: 'general',
    defaultKey: '?',
    currentKey: '?',
    enabled: true,
  },
];

export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions = {}) => {
  const [allShortcuts, setAllShortcuts] = useState<ShortcutDefinition[]>(DEFAULT_SHORTCUTS);
  const [shortcuts, setShortcuts] = useState<ShortcutsConfig>({
    enabled: true,
    preset: 'default',
    customMappings: {},
    disabledActions: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setShortcuts((prev) => ({ ...prev, enabled }));
  }, []);

  const setPreset = useCallback((preset: string) => {
    setShortcuts((prev) => ({ ...prev, preset }));
  }, []);

  const setCustomShortcut = useCallback((shortcutId: string, key: string) => {
    setShortcuts((prev) => ({
      ...prev,
      customMappings: { ...prev.customMappings, [shortcutId]: key },
    }));
    setAllShortcuts((prev) =>
      prev.map((s) => (s.id === shortcutId ? { ...s, currentKey: key } : s))
    );
  }, []);

  const resetAll = useCallback(() => {
    setShortcuts({
      enabled: true,
      preset: 'default',
      customMappings: {},
      disabledActions: [],
    });
    setAllShortcuts(DEFAULT_SHORTCUTS);
  }, []);

  const getShortcutKey = useCallback(
    (shortcutId: string): string => {
      const shortcut = allShortcuts.find((s) => s.id === shortcutId);
      return shortcut?.currentKey ?? '';
    },
    [allShortcuts]
  );

  const isShortcutEnabled = useCallback(
    (shortcutId: string): boolean => {
      if (!shortcuts.enabled) return false;
      const shortcut = allShortcuts.find((s) => s.id === shortcutId);
      return shortcut?.enabled ?? false;
    },
    [shortcuts.enabled, allShortcuts]
  );

  // Handle keyboard events
  useEffect(() => {
    if (!shortcuts.enabled) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      const matched = allShortcuts.find((s) => {
        if (!s.enabled) return false;
        return s.currentKey === e.key;
      });
      if (matched && options.onShortcutTriggered) {
        options.onShortcutTriggered(matched.id);
      }
    };

    if (typeof window === 'undefined') return undefined;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts.enabled, allShortcuts, options]);

  return {
    allShortcuts,
    shortcuts,
    loading,
    setEnabled,
    setPreset,
    setCustomShortcut,
    resetAll,
    getShortcutKey,
    isShortcutEnabled,
  };
};

export default useKeyboardShortcuts;
