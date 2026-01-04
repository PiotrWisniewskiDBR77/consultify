/**
 * Auth API Module
 * Enterprise SaaS Architecture - Authentication & Authorization
 */

import { User } from '../../types';
import { tokenService } from '../tokenService';
import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

// Re-export existing AuthService for backwards compatibility
// The AuthService already exists and is well-structured
export { AuthService as AuthApi } from '../modules/AuthService';
