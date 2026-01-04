/**
 * OptimizedImage Component - Apple HIG Design System
 *
 * High-performance image component with lazy loading, blur placeholder,
 * and WebP fallback detection.
 *
 * @example
 * <OptimizedImage
 *   src="/images/hero.webp"
 *   fallbackSrc="/images/hero.png"
 *   alt="Hero image"
 *   aspectRatio="16/9"
 *   blur
 * />
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { useLazyImage, useWebPSupport } from '../../../hooks/useLazyImage';

export interface OptimizedImageProps {
    /** Primary image source */
    src: string;
    /** Fallback source if WebP is not supported or primary fails */
    fallbackSrc?: string;
    /** Alt text for accessibility */
    alt: string;
    /** CSS aspect ratio (e.g., "16/9", "1/1", "4/3") */
    aspectRatio?: string;
    /** Enable blur placeholder effect */
    blur?: boolean;
    /** Low-quality placeholder image (for blur-up effect) */
    placeholder?: string;
    /** Object fit style */
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    /** Object position */
    objectPosition?: string;
    /** Additional CSS classes */
    className?: string;
    /** Disable lazy loading (load immediately) */
    eager?: boolean;
    /** Border radius preset */
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    /** Show skeleton while loading */
    showSkeleton?: boolean;
    /** Loading priority (high = fetch immediately with high priority) */
    priority?: 'high' | 'low' | 'auto';
    /** On load callback */
    onLoad?: () => void;
    /** On error callback */
    onError?: () => void;
}

const roundedClasses: Record<string, string> = {
    none: 'rounded-none',
    sm: 'rounded-hig-sm',
    md: 'rounded-hig-md',
    lg: 'rounded-hig-lg',
    xl: 'rounded-hig-xl',
    '2xl': 'rounded-hig-2xl',
    full: 'rounded-full',
};

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    fallbackSrc,
    alt,
    aspectRatio,
    blur = true,
    placeholder,
    objectFit = 'cover',
    objectPosition = 'center',
    className = '',
    eager = false,
    rounded = 'lg',
    showSkeleton = true,
    priority = 'auto',
    onLoad: onLoadProp,
    onError: onErrorProp,
}) => {
    const [currentSrc, setCurrentSrc] = useState(src);
    const [hasTriedFallback, setHasTriedFallback] = useState(false);

    const supportsWebP = useWebPSupport();
    const { ref, isInView, isLoaded, hasError, onLoad, onError } = useLazyImage({
        enabled: !eager,
    });

    // Determine actual source based on WebP support
    const actualSrc = React.useMemo(() => {
        if (currentSrc.endsWith('.webp') && !supportsWebP && fallbackSrc) {
            return fallbackSrc;
        }
        return currentSrc;
    }, [currentSrc, supportsWebP, fallbackSrc]);

    const handleLoad = useCallback(() => {
        onLoad();
        onLoadProp?.();
    }, [onLoad, onLoadProp]);

    const handleError = useCallback(() => {
        // Try fallback if available and not already tried
        if (fallbackSrc && !hasTriedFallback) {
            setCurrentSrc(fallbackSrc);
            setHasTriedFallback(true);
        } else {
            onError();
            onErrorProp?.();
        }
    }, [fallbackSrc, hasTriedFallback, onError, onErrorProp]);

    const shouldShowImage = eager || isInView;
    const showPlaceholder = blur && placeholder && !isLoaded;
    const showSkeletonState = showSkeleton && !isLoaded && !hasError;

    return (
        <div
            ref={ref}
            className={`
        relative overflow-hidden bg-slate-100 dark:bg-navy-800
        ${roundedClasses[rounded]}
        ${className}
      `}
            style={aspectRatio ? { aspectRatio } : undefined}
        >
            {/* Skeleton Loader */}
            <AnimatePresence>
                {showSkeletonState && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 dark:from-navy-800 dark:via-navy-700 dark:to-navy-800"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div
                            className="absolute inset-0 animate-shimmer"
                            style={{
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                                backgroundSize: '200% 100%',
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Low-quality Placeholder (for blur-up effect) */}
            {showPlaceholder && (
                <img
                    src={placeholder}
                    alt=""
                    aria-hidden="true"
                    className={`
            absolute inset-0 w-full h-full
            object-${objectFit}
            filter blur-xl scale-110
            ${roundedClasses[rounded]}
          `}
                    style={{ objectPosition }}
                />
            )}

            {/* Main Image */}
            {shouldShowImage && !hasError && (
                <motion.img
                    src={actualSrc}
                    alt={alt}
                    loading={eager ? 'eager' : 'lazy'}
                    fetchPriority={priority}
                    onLoad={handleLoad}
                    onError={handleError}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isLoaded ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    className={`
            absolute inset-0 w-full h-full
            object-${objectFit}
            ${roundedClasses[rounded]}
          `}
                    style={{ objectPosition }}
                />
            )}

            {/* Error State */}
            <AnimatePresence>
                {hasError && (
                    <motion.div
                        className={`
              absolute inset-0 flex flex-col items-center justify-center
              bg-slate-100 dark:bg-navy-800 text-slate-400 dark:text-slate-500
              ${roundedClasses[rounded]}
            `}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <ImageOff size={32} className="mb-2" />
                        <span className="text-sm">Failed to load</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * Responsive Image with srcSet support
 */
export interface ResponsiveImageProps extends Omit<OptimizedImageProps, 'src' | 'fallbackSrc'> {
    /** Source set for responsive images */
    srcSet: {
        src: string;
        width: number;
    }[];
    /** Sizes attribute for responsive selection */
    sizes?: string;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({ srcSet, sizes = '100vw', alt, ...props }) => {
    // Generate srcSet string
    const srcSetString = srcSet.map(({ src, width }) => `${src} ${width}w`).join(', ');

    // Use smallest image as base src
    const baseSrc = srcSet.reduce((smallest, current) => (current.width < smallest.width ? current : smallest)).src;

    const { ref, isInView, isLoaded, hasError, onLoad, onError } = useLazyImage({
        enabled: !props.eager,
    });

    const shouldShowImage = props.eager || isInView;

    return (
        <div
            ref={ref}
            className={`
        relative overflow-hidden bg-slate-100 dark:bg-navy-800
        ${roundedClasses[props.rounded || 'lg']}
        ${props.className || ''}
      `}
            style={props.aspectRatio ? { aspectRatio: props.aspectRatio } : undefined}
        >
            {/* Skeleton */}
            <AnimatePresence>
                {props.showSkeleton !== false && !isLoaded && !hasError && (
                    <motion.div
                        className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-navy-700"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                )}
            </AnimatePresence>

            {/* Image */}
            {shouldShowImage && !hasError && (
                <motion.img
                    src={baseSrc}
                    srcSet={srcSetString}
                    sizes={sizes}
                    alt={alt}
                    loading={props.eager ? 'eager' : 'lazy'}
                    onLoad={onLoad}
                    onError={onError}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isLoaded ? 1 : 0 }}
                    className={`
            absolute inset-0 w-full h-full
            object-${props.objectFit || 'cover'}
            ${roundedClasses[props.rounded || 'lg']}
          `}
                    style={{ objectPosition: props.objectPosition || 'center' }}
                />
            )}

            {/* Error State */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <ImageOff size={24} />
                </div>
            )}
        </div>
    );
};

export default OptimizedImage;

