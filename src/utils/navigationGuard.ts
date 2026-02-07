/**
 * Navigation Guard Utility
 *
 * Runtime validation for navigation to catch issues before they cause problems.
 * Provides diagnostic information for debugging navigation issues.
 */

import { APP_VIEW_TO_ROUTE, ROUTES } from '../routes/routeConfig';
import { AppView } from '../types';

export interface NavigationValidationResult {
  valid: boolean;
  view: AppView;
  route: string | null;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a navigation request before execution
 * Returns detailed information about any issues found
 */
export function validateNavigation(view: AppView): NavigationValidationResult {
  const result: NavigationValidationResult = {
    valid: true,
    view,
    route: null,
    errors: [],
    warnings: [],
  };

  // Check if view exists in AppView enum
  if (!Object.values(AppView).includes(view)) {
    result.valid = false;
    result.errors.push(`Invalid AppView: "${view}" is not a valid AppView enum value`);
    return result;
  }

  // Check if view has a route mapping
  const route = APP_VIEW_TO_ROUTE[view];
  if (!route) {
    result.valid = false;
    result.errors.push(`Missing route mapping: No route defined for AppView.${view}`);
    return result;
  }

  result.route = route;

  // Check for deprecated or legacy views
  const deprecatedViews: AppView[] = [
    AppView.FULL_PILOT_EXECUTION,
    AppView.FREE_ASSESSMENT_CHAT,
    AppView.FULL_TRANSFORMATION_CHAT,
  ];

  if (deprecatedViews.includes(view)) {
    result.warnings.push(
      `Deprecated view: AppView.${view} is deprecated and may be removed in future versions`
    );
  }

  return result;
}

/**
 * Logs navigation diagnostics to console
 * Use this when debugging navigation issues
 */
export function logNavigationDiagnostics(view: AppView, source: string = 'unknown'): void {
  const validation = validateNavigation(view);

  console.group(`[NavigationGuard] Navigation from "${source}"`);
  console.log('Target view:', view);
  console.log('Resolved route:', validation.route);
  console.log('Valid:', validation.valid);

  if (validation.errors.length > 0) {
    console.error('Errors:', validation.errors);
  }

  if (validation.warnings.length > 0) {
    console.warn('Warnings:', validation.warnings);
  }

  console.groupEnd();
}

/**
 * Gets a safe route for navigation, falling back to dashboard if invalid
 */
export function getSafeRoute(view: AppView): string {
  const validation = validateNavigation(view);

  if (!validation.valid || !validation.route) {
    console.error(`[NavigationGuard] Invalid navigation to ${view}, redirecting to chat`);
    return ROUTES.AI_CHAT;
  }

  return validation.route;
}

/**
 * Checks if all menu items have valid navigation targets
 * Run this in development to catch configuration issues
 */
export function validateMenuConfig(
  menuItems: Array<{ id: string; viewId?: AppView; subItems?: Array<{ viewId?: AppView }> }>
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  function checkItem(item: { id: string; viewId?: AppView }) {
    if (item.viewId) {
      const validation = validateNavigation(item.viewId);
      if (!validation.valid) {
        issues.push(`Menu item "${item.id}": ${validation.errors.join(', ')}`);
      }
    }
  }

  menuItems.forEach((item) => {
    checkItem(item);
    if (item.subItems) {
      item.subItems.forEach((subItem) => checkItem(subItem as any));
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Development mode navigation monitor
 * Tracks navigation patterns and reports issues
 */
class NavigationMonitor {
  private navigationHistory: Array<{
    timestamp: Date;
    from: AppView | null;
    to: AppView;
    success: boolean;
    error?: string;
  }> = [];

  private maxHistorySize = 100;

  recordNavigation(from: AppView | null, to: AppView, success: boolean, error?: string): void {
    this.navigationHistory.push({
      timestamp: new Date(),
      from,
      to,
      success,
      error,
    });

    // Keep history bounded
    if (this.navigationHistory.length > this.maxHistorySize) {
      this.navigationHistory.shift();
    }

    // Log failures immediately
    if (!success) {
      console.error('[NavigationMonitor] Navigation failed:', {
        from,
        to,
        error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  getFailures(): typeof this.navigationHistory {
    return this.navigationHistory.filter((n) => !n.success);
  }

  getStats(): {
    total: number;
    successful: number;
    failed: number;
    failureRate: number;
    recentFailures: Array<{
      timestamp: Date;
      from: AppView | null;
      to: AppView;
      success: boolean;
      error?: string;
    }>;
  } {
    const total = this.navigationHistory.length;
    const failed = this.navigationHistory.filter((n) => !n.success).length;
    const successful = total - failed;

    return {
      total,
      successful,
      failed,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      recentFailures: this.getFailures().slice(-5),
    };
  }

  clearHistory(): void {
    this.navigationHistory = [];
  }
}

// Singleton instance for development monitoring
export const navigationMonitor = new NavigationMonitor();

// Expose to window for debugging in development
if (
  typeof window !== 'undefined' &&
  import.meta.env.DEV &&
  import.meta.env.VITE_NAV_DEBUG === 'true'
) {
  (window as any).__navigationMonitor = navigationMonitor;
  (window as any).__validateNavigation = validateNavigation;
  (window as any).__logNavigationDiagnostics = logNavigationDiagnostics;

  console.log('[NavigationGuard] Debug tools available:');
  console.log('  - window.__navigationMonitor.getStats()');
  console.log('  - window.__validateNavigation(AppView.XXX)');
  console.log('  - window.__logNavigationDiagnostics(AppView.XXX, "source")');
}
