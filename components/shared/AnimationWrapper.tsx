import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface AnimationWrapperProps extends HTMLMotionProps<'div'> {
    children: React.ReactNode;
    variant?: 'fade' | 'slideUp' | 'scale';
    delay?: number;
}

export const AnimationWrapper: React.FC<AnimationWrapperProps> = ({
    children,
    variant = 'slideUp',
    delay = 0,
    className = '',
    ...props
}) => {
    const variants = {
        fade: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
        },
        slideUp: {
            initial: { opacity: 0, y: 15 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -15 },
        },
        scale: {
            initial: { opacity: 0, scale: 0.98 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.98 },
        },
    };

    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={variants[variant]}
            transition={{
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for "premium" feel
                delay,
            }}
            className={`w-full h-full ${className}`}
            {...props}
        >
            {children}
        </motion.div>
    );
};
