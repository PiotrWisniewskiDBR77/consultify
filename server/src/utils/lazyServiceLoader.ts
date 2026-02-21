import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '..');
const IN_FLIGHT_IMPORTS = new Set<string>();

// Debug: Log SRC_ROOT in development to verify it's correct
if (process.env.NODE_ENV !== 'production') {
  console.debug(`[LazyServiceLoader] SRC_ROOT: ${SRC_ROOT}, __dirname: ${__dirname}`);
}

export async function createLazyService<T = unknown>(servicePath: string): Promise<T> {
  // Try to find the file
  let absolutePath: string;
  if (servicePath.startsWith('./') || servicePath.startsWith('../')) {
    // Handle relative paths - resolve from services directory
    // IMPORTANT: Strip ALL ../ BEFORE path.resolve, otherwise path.resolve will
    // process them and go outside the services/ directory
    let cleanPath = servicePath;

    // Remove all leading ../ (these incorrectly go outside services/)
    // Must do this BEFORE path.resolve, not after
    while (cleanPath.startsWith('../')) {
      cleanPath = cleanPath.slice(3); // Remove '../'
    }

    // Remove leading ./ if present
    if (cleanPath.startsWith('./')) {
      cleanPath = cleanPath.slice(2);
    }

    // Remove any remaining ../ that might be in the middle (shouldn't happen, but be safe)
    cleanPath = cleanPath.replace(/\/\.\.\//g, '/').replace(/\/\.\.$/g, '');

    // Always resolve from services/ directory
    // Now cleanPath should be something like "ai/healthMonitor.js"
    absolutePath = path.resolve(SRC_ROOT, 'services', cleanPath);
  } else {
    // Absolute path from SRC_ROOT
    absolutePath = path.resolve(SRC_ROOT, servicePath);
  }

  // Verify path is correct and handle TS mapping
  const expectedServicesPath = path.resolve(SRC_ROOT, 'services');
  const normalizedAbsolutePath = path.normalize(absolutePath);

  // Double-check path is correct before TS mapping
  // If path doesn't start with expected services path, recalculate
  if (
    !normalizedAbsolutePath.startsWith(expectedServicesPath) &&
    !normalizedAbsolutePath.includes('node_modules')
  ) {
    // Path resolution went wrong - recalculate
    let cleanPath = servicePath;
    while (cleanPath.startsWith('../')) {
      cleanPath = cleanPath.slice(3);
    }
    if (cleanPath.startsWith('./')) {
      cleanPath = cleanPath.slice(2);
    }
    cleanPath = cleanPath.replace(/\/\.\.\//g, '/').replace(/\/\.\.$/g, '');
    absolutePath = path.resolve(SRC_ROOT, 'services', cleanPath);
  }

  // Handle TS mapping for dynamic imports
  if (absolutePath.endsWith('.js')) {
    const tsPath = absolutePath.slice(0, -3) + '.ts';
    if (fs.existsSync(tsPath)) {
      absolutePath = tsPath;
    } else if (absolutePath.endsWith('.legacy.js')) {
      const nonLegacyTsPath = absolutePath.slice(0, -10) + '.ts';
      if (fs.existsSync(nonLegacyTsPath)) {
        absolutePath = nonLegacyTsPath;
      }
    }
  } else if (!absolutePath.endsWith('.ts')) {
    const tsPath = absolutePath + '.ts';
    if (fs.existsSync(tsPath)) {
      absolutePath = tsPath;
    }
  }

  // Check if we are trying to load the same file that is currently executing
  // This prevents infinite recursion/hangs in wrappers
  if (absolutePath === fileURLToPath(import.meta.url)) {
    console.error(
      `[LazyServiceLoader] Circular load detected for: ${absolutePath} (from ${servicePath}).`
    );
    return createUnavailableProxy(servicePath, absolutePath) as T;
  }

  // Final verification: ensure path is correct before attempting import
  const finalNormalizedPath = path.normalize(absolutePath);

  // If the path doesn't start with expectedServicesPath, path resolution went wrong
  // This should not happen with our fix, but add safety check
  if (
    !finalNormalizedPath.startsWith(expectedServicesPath) &&
    !finalNormalizedPath.includes('node_modules')
  ) {
    console.warn(
      `[LazyServiceLoader] Path resolution issue detected: ${servicePath} resolved to ${finalNormalizedPath}, expected under ${expectedServicesPath}. SRC_ROOT=${SRC_ROOT}, __dirname=${__dirname}`
    );
    // Try one more time with absolute path from services/
    const fallbackPath = path.resolve(SRC_ROOT, 'services', servicePath.replace(/^(\.\.\/)+/, ''));
    if (fs.existsSync(fallbackPath) || fs.existsSync(fallbackPath.replace('.js', '.ts'))) {
      absolutePath = fallbackPath;
      console.log(`[LazyServiceLoader] Using fallback path: ${absolutePath}`);
    }
  }

  console.log(`[LazyServiceLoader] Loading: ${servicePath} -> ${absolutePath}`);
  try {
    if (IN_FLIGHT_IMPORTS.has(absolutePath)) {
      console.error(
        `[LazyServiceLoader] Re-entrant import detected (possible self-loading wrapper): ${absolutePath}`
      );
      return createUnavailableProxy(servicePath, absolutePath) as T;
    }
    IN_FLIGHT_IMPORTS.add(absolutePath);
    const module = await import(absolutePath);
    return (module.default || module) as T;
  } catch (error) {
    // One last try: if it's mfaService.js, try MFAService.ts
    if (absolutePath.endsWith('mfaService.ts')) {
      const capitalPath = absolutePath.replace('mfaService.ts', 'MFAService.ts');
      if (fs.existsSync(capitalPath) && capitalPath !== fileURLToPath(import.meta.url)) {
        try {
          const module = await import(capitalPath);
          return (module.default || module) as T;
        } catch (e) {
          /* ignore */
        }
      }
    }

    const err = error as Error & { code?: string };
    const isModuleNotFound =
      err.code === 'ERR_MODULE_NOT_FOUND' || err.message.includes('Cannot find module');
    console.error(`[LazyServiceLoader] Failed to load: ${absolutePath}`);
    console.error(`[LazyServiceLoader] Error:`, error);

    if (isModuleNotFound) {
      return createUnavailableProxy(servicePath, absolutePath) as T;
    }
    return createUnavailableProxy(servicePath, absolutePath, error) as T;
  } finally {
    IN_FLIGHT_IMPORTS.delete(absolutePath);
  }
}

function createUnavailableProxy<T>(servicePath: string, absolutePath?: string, cause?: unknown): T {
  // Fail loudly on usage, but avoid unhandled promise rejections at import-time.
  // This prevents "fake success" (e.g. returning []/null) while keeping optional modules non-fatal.
  const err = new Error(
    `[LazyServiceLoader] Service unavailable: ${servicePath}${absolutePath ? ` -> ${absolutePath}` : ''}`
  );
  (err as any).cause = cause;

  const target = {} as Record<string | symbol, any>;
  return new Proxy(target, {
    get(_target, prop) {
      if (prop === 'then') return undefined; // Don't look like a Promise.
      if (prop === '__unavailable__') return true;
      if (prop === '__error__') return err;
      if (typeof prop === 'string' || typeof prop === 'symbol') {
        return (..._args: any[]) => Promise.reject(err);
      }
      return undefined;
    },
  }) as T;
}

/**
 * Create a cached lazy service loader
 * This ensures the service is only loaded once and cached for subsequent calls
 */
export function createCachedLazyService<T = unknown>(servicePath: string): () => Promise<T> {
  let serviceCache: T | null = null;
  let servicePromise: Promise<T> | null = null;

  return async (): Promise<T> => {
    if (serviceCache) {
      return serviceCache;
    }
    if (!servicePromise) {
      servicePromise = createLazyService<T>(servicePath).then((service) => {
        serviceCache = service;
        return service;
      });
    }
    return servicePromise;
  };
}
