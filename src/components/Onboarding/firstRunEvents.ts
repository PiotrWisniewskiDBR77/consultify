/**
 * Tiny event bus to re-launch the first-run onboarding flow from anywhere
 * (e.g. the user profile menu) without threading state through the tree.
 *
 * The flow itself is mounted once near the app root (MainLayout) and listens
 * for this event.
 */
export const FIRST_RUN_RELAUNCH_EVENT = 'consultify:onboarding:relaunch';

export const requestFirstRunRelaunch = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FIRST_RUN_RELAUNCH_EVENT));
};

export const onFirstRunRelaunch = (handler: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(FIRST_RUN_RELAUNCH_EVENT, handler);
  return () => window.removeEventListener(FIRST_RUN_RELAUNCH_EVENT, handler);
};
