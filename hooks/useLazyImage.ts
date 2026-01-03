/**
 * useLazyImage Hook - Image Loading Optimization
 * 
 * Provides intersection-based lazy loading with blur placeholder support.
 * Optimized for performance with IntersectionObserver.
 * 
 * @example
 * const { isLoaded, isInView, ref } = useLazyImage({
 *   threshold: 0.1,
 *   rootMargin: '100px',
 * });
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseLazyImageOptions {
  /** Intersection threshold (0-1) */
  threshold?: number;
  /** Root margin for early loading */
  rootMargin?: string;
  /** Enable/disable lazy loading */
  enabled?: boolean;
}

export interface UseLazyImageReturn {
  /** Ref to attach to the image container */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Whether the image is in the viewport */
  isInView: boolean;
  /** Whether the image has finished loading */
  isLoaded: boolean;
  /** Whether the image failed to load */
  hasError: boolean;
  /** Trigger load manually */
  load: () => void;
  /** Handle image load event */
  onLoad: () => void;
  /** Handle image error event */
  onError: () => void;
}

export function useLazyImage(options: UseLazyImageOptions = {}): UseLazyImageReturn {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    enabled = true,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(!enabled);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Manual load trigger
  const load = useCallback(() => {
    setIsInView(true);
  }, []);

  // Image load handler
  const onLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
  }, []);

  // Image error handler
  const onError = useCallback(() => {
    setHasError(true);
    setIsLoaded(false);
  }, []);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          // Disconnect after first intersection
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [enabled, threshold, rootMargin]);

  return {
    ref,
    isInView,
    isLoaded,
    hasError,
    load,
    onLoad,
    onError,
  };
}

/**
 * Check if WebP format is supported by the browser
 */
export function useWebPSupport(): boolean {
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const checkWebP = async () => {
      if (typeof window === 'undefined') return;

      // Check via canvas
      const canvas = document.createElement('canvas');
      if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
        setIsSupported(true);
        return;
      }

      // Fallback check with test image
      const webpData = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
      const img = new Image();
      
      img.onload = () => setIsSupported(img.width === 1);
      img.onerror = () => setIsSupported(false);
      img.src = webpData;
    };

    checkWebP();
  }, []);

  return isSupported;
}

/**
 * Preload images in advance
 */
export function useImagePreloader(urls: string[]) {
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    urls.forEach((url) => {
      if (loadedUrls.has(url) || failedUrls.has(url)) return;

      const img = new Image();
      img.onload = () => {
        setLoadedUrls((prev) => new Set([...prev, url]));
      };
      img.onerror = () => {
        setFailedUrls((prev) => new Set([...prev, url]));
      };
      img.src = url;
    });
  }, [urls, loadedUrls, failedUrls]);

  return {
    isAllLoaded: urls.every((url) => loadedUrls.has(url)),
    loadedUrls,
    failedUrls,
    progress: urls.length > 0 ? loadedUrls.size / urls.length : 1,
  };
}

export default useLazyImage;

