import { motion } from 'framer-motion';
import React from 'react';

interface ButtonProps extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onDrag' | 'onDragEnd' | 'onDragStart' | 'onAnimationStart'
> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    icon,
    className = '',
    ...props
}) => {
    const variants = {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        outline: 'btn-outline',
        ghost: 'btn-ghost',
        danger: 'btn-danger',
        glass: 'btn-glass',
    };

    const sizes = {
        sm: 'px-3.5 py-1.5 text-xs',
        md: 'px-5 py-2.5 text-sm',
        lg: 'px-7 py-3.5 text-base',
    };

    const widthClass = fullWidth ? 'w-full' : '';

    return (
        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={`${variants[variant]} ${sizes[size]} ${widthClass} ${className} btn-base shadow-sm hover:shadow-md active:shadow-inner`}
            {...(props as any)}
        >
            {icon && <span className="mr-2.5 flex items-center">{icon}</span>}
            <span className="relative z-10">{children}</span>
        </motion.button>
    );
};
