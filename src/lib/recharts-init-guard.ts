/**
 * Recharts initialization guard
 * Prevents recharts from loading until React is fully initialized
 * This fixes React 19 compatibility issues
 */

// Store original import to prevent recharts from executing during module load
let rechartsReady = false;
let reactInitialized = false;

// Mark React as initialized after a short delay to ensure it's fully ready
if (typeof window !== 'undefined') {
  // Wait for React to be fully initialized
  if (document.readyState === 'complete') {
    setTimeout(() => {
      reactInitialized = true;
    }, 50);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => {
        reactInitialized = true;
      }, 50);
    });
  }
}

export function isRechartsReady(): boolean {
  return reactInitialized && rechartsReady;
}

export function markRechartsReady(): void {
  rechartsReady = true;
}

// Proxy to delay recharts module loading
export async function loadRechartsSafely() {
  // Wait for React to be initialized
  while (!reactInitialized) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Now load recharts
  const recharts = await import('recharts');
  markRechartsReady();
  return recharts;
}
