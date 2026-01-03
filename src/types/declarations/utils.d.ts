/**
 * Utility Type Declarations
 * 
 * Type declarations for utility functions and helpers
 */

declare module '@/utils/cn' {
  export type ClassValue = string | number | boolean | undefined | null | ClassValue[] | Record<string, boolean | undefined | null>;
  export function cn(...inputs: ClassValue[]): string;
  export default cn;
}

declare module '@/utils/*';




