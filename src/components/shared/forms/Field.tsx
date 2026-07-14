/**
 * Field / FieldLabel / FieldError — canonical form-field wrappers.
 *
 * Provides consistent vertical spacing and label/error styling for the
 * shared form primitives. Use as:
 *
 *   <Field>
 *     <FieldLabel required>Due date</FieldLabel>
 *     <DatePicker … />
 *     <FieldError>{error}</FieldError>
 *   </Field>
 */

import React from 'react';

import { cn } from '@/utils/cn';

export interface FieldProps {
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ children, className }) => (
  <div className={cn('flex flex-col gap-2', className)}>{children}</div>
);

export interface FieldLabelProps {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}

export const FieldLabel: React.FC<FieldLabelProps> = ({
  children,
  required,
  htmlFor,
  className,
}) => (
  <label
    htmlFor={htmlFor}
    className={cn('block text-sm font-medium text-slate-700 dark:text-slate-300', className)}
  >
    {children}
    {required ? <span className="ml-0.5 text-danger-500">*</span> : null}
  </label>
);

export interface FieldErrorProps {
  children?: React.ReactNode;
  className?: string;
}

export const FieldError: React.FC<FieldErrorProps> = ({ children, className }) => {
  if (!children) return null;
  return (
    <p className={cn('text-xs text-danger-500 dark:text-danger-400', className)}>{children}</p>
  );
};

export default Field;
