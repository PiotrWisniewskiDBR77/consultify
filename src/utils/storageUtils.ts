/**
 * LocalStorage Utility
 * Standard wrapper for safe storage access
 */

export const storage = {
    get: <T>(key: string, defaultValue: T | null = null): T | null => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading ${key} from localStorage:`, error);
            return defaultValue;
        }
    },

    set: (key: string, value: unknown): void => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`Error writing ${key} to localStorage:`, error);
        }
    },

    remove: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn(`Error removing ${key} from localStorage:`, error);
        }
    },

    clear: (): void => {
        try {
            localStorage.clear();
        } catch (error) {
            console.warn('Error clearing localStorage:', error);
        }
    },
};
