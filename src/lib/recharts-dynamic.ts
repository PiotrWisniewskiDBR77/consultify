/**
 * Dynamic recharts loader - prevents React 19 compatibility issues
 * by loading recharts only when needed, after React is fully initialized
 */

let rechartsCache: any = null;
let loadPromise: Promise<any> | null = null;

export async function loadRecharts() {
  if (rechartsCache) {
    return rechartsCache;
  }

  if (!loadPromise) {
    loadPromise = import('recharts')
      .then((module) => {
        rechartsCache = module;
        return module;
      })
      .catch((error) => {
        loadPromise = null; // Reset on error
        console.error('[recharts-dynamic] Failed to load recharts:', error);
        throw error;
      });
  }

  return loadPromise;
}

// Pre-load recharts after a short delay to ensure React is ready
if (typeof window !== 'undefined') {
  // Wait for React to be fully initialized
  setTimeout(() => {
    loadRecharts().catch(() => {
      // Silently fail - will retry when component needs it
    });
  }, 100);
}
