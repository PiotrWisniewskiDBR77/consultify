export type FunnelEventName =
  | 'auth_login_success'
  | 'demo_session_started'
  | 'trial_org_setup_completed'
  | 'billing_payment_method_added'
  | 'ai_access_blocked'
  | 'upgrade_cta_clicked'
  | 'upgrade_viewed'
  | 'plan_selected'
  | 'checkout_started'
  | 'checkout_completed'
  | 'checkout_failed'
  | 'subscription_cancelled'
  | 'oauth_login_started'
  | 'oauth_login_succeeded'
  | 'oauth_login_failed'
  | 'oauth_linked'
  | 'oauth_unlinked'
  | 'linkedin_connect_cta_shown'
  | 'linkedin_connect_cta_clicked'
  | 'linkedin_connect_cta_dismissed';

export function trackFunnelEvent(eventName: FunnelEventName, data: Record<string, unknown> = {}) {
  try {
    // Persist last events for debugging/support
    const existing = JSON.parse(sessionStorage.getItem('funnel_events') || '[]');
    existing.push({ eventName, data, timestamp: Date.now() });
    sessionStorage.setItem('funnel_events', JSON.stringify(existing.slice(-100)));
  } catch {
    // ignore
  }

  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, data);
    }
  } catch {
    // ignore
  }

  try {
    if (typeof window !== 'undefined' && (window as any).journeyAnalytics) {
      (window as any).journeyAnalytics.trackMilestone?.(eventName, data);
    }
  } catch {
    // ignore
  }
}
