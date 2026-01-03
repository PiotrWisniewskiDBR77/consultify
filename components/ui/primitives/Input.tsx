/**
 * Input Component - Apple HIG Design System
 * 
 * A refined text input with focus states, validation, and accessibility.
 * Supports various input types and optional icons.
 * 
 * @example
 * <Input placeholder="Enter email" icon={<Mail />} />
 * <Input type="password" error="Password is required" />
 */

import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input size variant */
  size?: InputSize;
  /** Icon to display on the left */
  icon?: React.ReactNode;
  /** Icon to display on the right */
  iconRight?: React.ReactNode;
  /** Error message */
  error?: string;
  /** Success state */
  success?: boolean;
  /** Helper text */
  helperText?: string;
  /** Label text */
  label?: string;
  /** Full width */
  fullWidth?: boolean;
  /** Container className */
  containerClassName?: string;
}

const sizeStyles: Record<InputSize, { input: string; icon: number }> = {
  sm: { input: 'px-3 py-2 text-sm', icon: 14 },
  md: { input: 'px-4 py-3 text-sm', icon: 16 },
  lg: { input: 'px-4 py-3.5 text-base', icon: 18 },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      icon,
      iconRight,
      error,
      success,
      helperText,
      label,
      fullWidth = true,
      containerClassName = '',
      className = '',
      type = 'text',
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const { input: sizeClass, icon: iconSize } = sizeStyles[size];

    const hasError = Boolean(error);
    const hasSuccess = success && !hasError;

    const borderColor = hasError
      ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
      : hasSuccess
      ? 'border-success-500 focus:border-success-500 focus:ring-success-500/20'
      : 'border-transparent focus:border-primary-500 focus:ring-primary-500/20';

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${containerClassName}`}>
        {label && (
          <label className="block mb-2 text-sm font-medium text-navy-900 dark:text-white">
            {label}
          </label>
        )}
        <div className="relative">
          {/* Left icon */}
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
              {React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: iconSize })
                : icon}
            </div>
          )}

          <input
            ref={ref}
            type={inputType}
            disabled={disabled}
            className={`
              w-full
              bg-slate-50 dark:bg-navy-900
              text-navy-900 dark:text-white
              placeholder-slate-400 dark:placeholder-slate-500
              rounded-xl
              border
              ${borderColor}
              transition-all duration-150 ease-out
              outline-none
              focus:ring-2
              focus:bg-white dark:focus:bg-navy-900
              hover:bg-slate-100 dark:hover:bg-navy-800
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50
              ${sizeClass}
              ${icon ? 'pl-10' : ''}
              ${iconRight || isPassword || hasError || hasSuccess ? 'pr-10' : ''}
              ${className}
            `.trim().replace(/\s+/g, ' ')}
            {...props}
          />

          {/* Right icon area */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {/* Status icons */}
            {hasError && !isPassword && (
              <AlertCircle size={iconSize} className="text-danger-500" />
            )}
            {hasSuccess && !isPassword && (
              <CheckCircle size={iconSize} className="text-success-500" />
            )}

            {/* Password toggle */}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff size={iconSize} />
                ) : (
                  <Eye size={iconSize} />
                )}
              </button>
            )}

            {/* Custom right icon */}
            {iconRight && !isPassword && !hasError && !hasSuccess && (
              <span className="text-slate-400 dark:text-slate-500">
                {React.isValidElement(iconRight)
                  ? React.cloneElement(iconRight as React.ReactElement<{ size?: number }>, { size: iconSize })
                  : iconRight}
              </span>
            )}
          </div>
        </div>

        {/* Helper/Error text */}
        {(error || helperText) && (
          <p
            className={`mt-2 text-sm ${
              hasError ? 'text-danger-500' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;





