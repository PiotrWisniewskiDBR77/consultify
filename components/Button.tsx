import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
  // Base styles are now handled by the CSS classes (btn-base), but we keep className for overrides
  // We can leave this empty or add specific React-only resilience

  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    outline: "btn-outline",
    ghost: "btn-ghost",
    danger: "btn-danger",
    glass: "btn-glass"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs shadow-sm",
    md: "px-4 py-2 text-sm shadow-sm",
    lg: "px-6 py-3 text-base shadow-md"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};