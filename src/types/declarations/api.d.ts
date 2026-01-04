/**
 * API Module Type Declarations
 * 
 * Type declarations for API services and utilities
 */

declare module '@/services/api' {
  import { Api } from '@/services/api';
  export { Api };
  export default Api;
}

declare module '@/services/apiUtils' {
  export const API_URL: string;
  export function getHeaders(contentType?: string): Record<string, string>;
  export function fetchWithRetry(url: string, options?: RequestInit, retries?: number): Promise<Response>;
  export function handleResponse<T>(response: Response, errorMessage?: string): Promise<T>;
  export function handleBlobResponse(response: Response, errorMessage?: string): Promise<Blob>;
}

declare module '@/services/modules/*';





