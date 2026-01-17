/**
 * Recharts Proxy - Delays recharts loading until React is ready
 * This fixes React 19 compatibility issues by preventing recharts
 * from executing during module initialization
 */

// Wait for React to be fully initialized before loading recharts
let rechartsModule: any = null;
let loadPromise: Promise<any> | null = null;

function ensureReactReady(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      // Server-side, resolve immediately
      resolve();
      return;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // Give React a moment to fully initialize
      setTimeout(() => resolve(), 100);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => resolve(), 100);
      });
    }
  });
}

async function loadRecharts() {
  if (rechartsModule) {
    return rechartsModule;
  }

  if (!loadPromise) {
    loadPromise = ensureReactReady()
      .then(() => {
        // Now safely import recharts
        return import('recharts');
      })
      .then((module) => {
        rechartsModule = module;
        return module;
      })
      .catch((error) => {
        loadPromise = null; // Reset on error
        console.error('[recharts-proxy] Failed to load recharts:', error);
        throw error;
      });
  }

  return loadPromise;
}

// Export a proxy object that delays property access until recharts is loaded
const rechartsProxy = new Proxy(
  {} as any,
  {
    get(_target, prop) {
      // Return a function that loads recharts and then accesses the property
      return async (...args: any[]) => {
        const recharts = await loadRecharts();
        const value = (recharts as any)[prop];
        if (typeof value === 'function') {
          return value.bind(recharts);
        }
        return value;
      };
    },
  }
);

// For named exports, we need to provide getters that load recharts
export const Bar = (...args: any[]) => loadRecharts().then((m) => m.Bar(...args));
export const BarChart = (...args: any[]) => loadRecharts().then((m) => m.BarChart(...args));
export const Line = (...args: any[]) => loadRecharts().then((m) => m.Line(...args));
export const LineChart = (...args: any[]) => loadRecharts().then((m) => m.LineChart(...args));
export const Pie = (...args: any[]) => loadRecharts().then((m) => m.Pie(...args));
export const PieChart = (...args: any[]) => loadRecharts().then((m) => m.PieChart(...args));
export const ResponsiveContainer = (...args: any[]) => loadRecharts().then((m) => m.ResponsiveContainer(...args));
export const XAxis = (...args: any[]) => loadRecharts().then((m) => m.XAxis(...args));
export const YAxis = (...args: any[]) => loadRecharts().then((m) => m.YAxis(...args));
export const CartesianGrid = (...args: any[]) => loadRecharts().then((m) => m.CartesianGrid(...args));
export const Tooltip = (...args: any[]) => loadRecharts().then((m) => m.Tooltip(...args));
export const Legend = (...args: any[]) => loadRecharts().then((m) => m.Legend(...args));
export const Cell = (...args: any[]) => loadRecharts().then((m) => m.Cell(...args));
export const Area = (...args: any[]) => loadRecharts().then((m) => m.Area(...args));
export const AreaChart = (...args: any[]) => loadRecharts().then((m) => m.AreaChart(...args));
export const ComposedChart = (...args: any[]) => loadRecharts().then((m) => m.ComposedChart(...args));
export const Radar = (...args: any[]) => loadRecharts().then((m) => m.Radar(...args));
export const RadarChart = (...args: any[]) => loadRecharts().then((m) => m.RadarChart(...args));
export const ReferenceLine = (...args: any[]) => loadRecharts().then((m) => m.ReferenceLine(...args));
export const ReferenceArea = (...args: any[]) => loadRecharts().then((m) => m.ReferenceArea(...args));
export const ReferenceDot = (...args: any[]) => loadRecharts().then((m) => m.ReferenceDot(...args));

// Default export
export default rechartsProxy;
