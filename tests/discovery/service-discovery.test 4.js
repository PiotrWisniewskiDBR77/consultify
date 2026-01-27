/**
 * Service Discovery and Registry Tests
 * Tests for microservice discovery patterns
 *
 * @module tests/discovery/service-discovery.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Service registry
const createServiceRegistry = () => {
  const services = new Map();
  const listeners = [];

  const emit = (event, data) => {
    listeners.forEach((fn) => fn(event, data));
  };

  return {
    register: (name, instance) => {
      if (!services.has(name)) {
        services.set(name, []);
      }

      const registration = {
        id: crypto.randomUUID(),
        name,
        host: instance.host,
        port: instance.port,
        metadata: instance.metadata || {},
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      services.get(name).push(registration);
      emit('register', registration);

      return registration;
    },

    deregister: (serviceId) => {
      for (const [name, instances] of services) {
        const index = instances.findIndex((i) => i.id === serviceId);
        if (index !== -1) {
          const removed = instances.splice(index, 1)[0];
          emit('deregister', removed);
          return true;
        }
      }
      return false;
    },

    heartbeat: (serviceId) => {
      for (const instances of services.values()) {
        const instance = instances.find((i) => i.id === serviceId);
        if (instance) {
          instance.lastHeartbeat = Date.now();
          instance.health = 'healthy';
          return true;
        }
      }
      return false;
    },

    getInstances: (name) => {
      return (services.get(name) || []).filter((i) => i.health === 'healthy');
    },

    getAllServices: () => {
      return [...services.keys()];
    },

    getServiceCount: (name) => {
      return (services.get(name) || []).length;
    },

    markUnhealthy: (serviceId) => {
      for (const instances of services.values()) {
        const instance = instances.find((i) => i.id === serviceId);
        if (instance) {
          instance.health = 'unhealthy';
          emit('unhealthy', instance);
          return true;
        }
      }
      return false;
    },

    onEvent: (handler) => {
      listeners.push(handler);
      return () => {
        const idx = listeners.indexOf(handler);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    cleanup: (maxAge = 60000) => {
      const now = Date.now();
      let removed = 0;

      for (const instances of services.values()) {
        for (let i = instances.length - 1; i >= 0; i--) {
          if (now - instances[i].lastHeartbeat > maxAge) {
            instances.splice(i, 1);
            removed++;
          }
        }
      }

      return removed;
    },
  };
};

// Load balancer
const createLoadBalancer = (registry) => {
  const counters = new Map();

  return {
    roundRobin: (serviceName) => {
      const instances = registry.getInstances(serviceName);
      if (instances.length === 0) return null;

      const counter = counters.get(serviceName) || 0;
      const instance = instances[counter % instances.length];
      counters.set(serviceName, counter + 1);

      return instance;
    },

    random: (serviceName) => {
      const instances = registry.getInstances(serviceName);
      if (instances.length === 0) return null;

      return instances[Math.floor(Math.random() * instances.length)];
    },

    leastConnections: (serviceName, connectionCounts) => {
      const instances = registry.getInstances(serviceName);
      if (instances.length === 0) return null;

      return instances.reduce((min, instance) => {
        const count = connectionCounts.get(instance.id) || 0;
        const minCount = connectionCounts.get(min.id) || 0;
        return count < minCount ? instance : min;
      });
    },

    weighted: (serviceName, getWeight) => {
      const instances = registry.getInstances(serviceName);
      if (instances.length === 0) return null;

      const totalWeight = instances.reduce((sum, i) => sum + (getWeight(i) || 1), 0);
      let random = Math.random() * totalWeight;

      for (const instance of instances) {
        random -= getWeight(instance) || 1;
        if (random <= 0) return instance;
      }

      return instances[0];
    },
  };
};

// Health checker
const createHealthChecker = (registry) => {
  const checks = new Map();
  let interval = null;

  return {
    addCheck: (serviceId, checker) => {
      checks.set(serviceId, checker);
    },

    removeCheck: (serviceId) => {
      checks.delete(serviceId);
    },

    runCheck: async (serviceId) => {
      const checker = checks.get(serviceId);
      if (!checker) return null;

      try {
        const healthy = await checker();
        if (!healthy) {
          registry.markUnhealthy(serviceId);
        }
        return healthy;
      } catch {
        registry.markUnhealthy(serviceId);
        return false;
      }
    },

    startPeriodicChecks: (intervalMs = 10000) => {
      interval = setInterval(async () => {
        for (const serviceId of checks.keys()) {
          await this.runCheck(serviceId);
        }
      }, intervalMs);
    },

    stopPeriodicChecks: () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
};

// Service client
const createServiceClient = (registry, loadBalancer) => {
  return {
    call: async (serviceName, path, options = {}) => {
      const instance = loadBalancer.roundRobin(serviceName);
      if (!instance) {
        throw new Error(`No instances available for: ${serviceName}`);
      }

      const url = `http://${instance.host}:${instance.port}${path}`;

      // Mock HTTP call
      return {
        url,
        instance: instance.id,
        data: { mock: true },
      };
    },

    callWithRetry: async (serviceName, path, options = {}) => {
      const maxRetries = options.retries || 3;
      let lastError;

      for (let i = 0; i < maxRetries; i++) {
        try {
          return await this.call(serviceName, path, options);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    },

    broadcast: async (serviceName, path, options = {}) => {
      const instances = registry.getInstances(serviceName);

      return Promise.all(
        instances.map((instance) => {
          const url = `http://${instance.host}:${instance.port}${path}`;
          return { url, instance: instance.id };
        })
      );
    },
  };
};

describe('Service Registry Tests', () => {
  let registry;

  beforeEach(() => {
    registry = createServiceRegistry();
  });

  it('should register service', () => {
    const instance = registry.register('api', { host: 'localhost', port: 3000 });

    expect(instance.id).toBeTruthy();
    expect(instance.name).toBe('api');
  });

  it('should get instances', () => {
    registry.register('api', { host: 'localhost', port: 3000 });
    registry.register('api', { host: 'localhost', port: 3001 });

    const instances = registry.getInstances('api');

    expect(instances).toHaveLength(2);
  });

  it('should deregister service', () => {
    const instance = registry.register('api', { host: 'localhost', port: 3000 });
    registry.deregister(instance.id);

    expect(registry.getInstances('api')).toHaveLength(0);
  });

  it('should handle heartbeat', () => {
    const instance = registry.register('api', { host: 'localhost', port: 3000 });
    registry.heartbeat(instance.id);

    expect(instance.lastHeartbeat).toBeTruthy();
  });

  it('should mark unhealthy', () => {
    const instance = registry.register('api', { host: 'localhost', port: 3000 });
    registry.markUnhealthy(instance.id);

    expect(registry.getInstances('api')).toHaveLength(0); // Filtered out
  });

  it('should emit events', () => {
    const handler = vi.fn();
    registry.onEvent(handler);

    registry.register('api', { host: 'localhost', port: 3000 });

    expect(handler).toHaveBeenCalledWith('register', expect.anything());
  });
});

describe('Load Balancer Tests', () => {
  let registry;
  let lb;

  beforeEach(() => {
    registry = createServiceRegistry();
    lb = createLoadBalancer(registry);

    registry.register('api', { host: 'localhost', port: 3000 });
    registry.register('api', { host: 'localhost', port: 3001 });
    registry.register('api', { host: 'localhost', port: 3002 });
  });

  it('should round robin', () => {
    const first = lb.roundRobin('api');
    const second = lb.roundRobin('api');
    const third = lb.roundRobin('api');
    const fourth = lb.roundRobin('api');

    expect(first.port).not.toBe(second.port);
    expect(first.port).toBe(fourth.port); // Loops back
  });

  it('should random', () => {
    const instance = lb.random('api');

    expect(instance).toBeTruthy();
    expect([3000, 3001, 3002]).toContain(instance.port);
  });

  it('should handle no instances', () => {
    const instance = lb.roundRobin('unknown');

    expect(instance).toBeNull();
  });
});

describe('Service Client Tests', () => {
  let registry;
  let lb;
  let client;

  beforeEach(() => {
    registry = createServiceRegistry();
    lb = createLoadBalancer(registry);
    client = createServiceClient(registry, lb);

    registry.register('api', { host: 'localhost', port: 3000 });
  });

  it('should call service', async () => {
    const response = await client.call('api', '/users');

    expect(response.url).toContain('localhost:3000');
  });

  it('should broadcast to all instances', async () => {
    registry.register('api', { host: 'localhost', port: 3001 });

    const responses = await client.broadcast('api', '/notify');

    expect(responses).toHaveLength(2);
  });

  it('should throw for unknown service', async () => {
    await expect(client.call('unknown', '/test')).rejects.toThrow();
  });
});
