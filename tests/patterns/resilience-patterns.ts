/**
 * Resilience Testing Patterns
 *
 * Patterns for testing system robustness under failure conditions.
 */

export const ResiliencePatterns = {
  /**
   * Circuit Breaker pattern testing
   */
  circuitBreaker: {
    simulateFailure: (threshold: number) => {
      let count = 0;
      return () => {
        count++;
        if (count >= threshold) return 'open';
        return 'closed';
      };
    },

    testStateTransition: (service: any, failures: number) => {
      for (let i = 0; i < failures; i++) {
        try {
          service.execute();
        } catch (e) {}
      }
      return service.state; // 'open', 'closed', 'half-open'
    },
  },

  /**
   * Retry strategy validation
   */
  retryStrategy: {
    validateExponentialBackoff: (attempts: number, baseMs: number) => {
      const delays = [];
      for (let i = 0; i < attempts; i++) {
        delays.push(baseMs * Math.pow(2, i));
      }
      return delays;
    },

    simulateTransientFailure: (successAfter: number) => {
      let attempt = 0;
      return () => {
        attempt++;
        if (attempt < successAfter) throw new Error('Transient failure');
        return 'success';
      };
    },
  },

  /**
   * Timeout & Deadline handling
   */
  deadlines: {
    simulateLatency: (ms: number) => {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    testDeadline: async (fn: () => Promise<any>, timeoutMs: number) => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deadline exceeded')), timeoutMs)
      );
      return Promise.race([fn(), timeoutPromise]);
    },
  },
};
