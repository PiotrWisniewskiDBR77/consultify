/**
 * Dashboard Builder Tests
 * Tests for dashboard and widget management
 *
 * @module tests/analytics/dashboard.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Widget types
const WIDGET_TYPES = ['chart', 'table', 'metric', 'map', 'list', 'text'];

// Widget factory
const createWidget = (type, config = {}) => ({
  id: crypto.randomUUID(),
  type,
  title: config.title || `${type} Widget`,
  position: config.position || { x: 0, y: 0 },
  size: config.size || { width: 4, height: 3 },
  dataSource: config.dataSource || null,
  options: config.options || {},
  createdAt: Date.now(),
});

// Dashboard builder
const createDashboardBuilder = () => {
  const dashboards = new Map();

  return {
    createDashboard: (id, metadata = {}) => {
      const dashboard = {
        id,
        title: metadata.title || 'Untitled Dashboard',
        widgets: [],
        layout: { columns: 12, rows: 'auto' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...metadata,
      };
      dashboards.set(id, dashboard);
      return dashboard;
    },

    getDashboard: (id) => dashboards.get(id) || null,

    deleteDashboard: (id) => dashboards.delete(id),

    addWidget: (dashboardId, widgetType, config = {}) => {
      const dashboard = dashboards.get(dashboardId);
      if (!dashboard) return null;

      const widget = createWidget(widgetType, config);
      dashboard.widgets.push(widget);
      dashboard.updatedAt = Date.now();
      return widget;
    },

    removeWidget: (dashboardId, widgetId) => {
      const dashboard = dashboards.get(dashboardId);
      if (!dashboard) return false;

      const index = dashboard.widgets.findIndex((w) => w.id === widgetId);
      if (index === -1) return false;

      dashboard.widgets.splice(index, 1);
      dashboard.updatedAt = Date.now();
      return true;
    },

    updateWidget: (dashboardId, widgetId, updates) => {
      const dashboard = dashboards.get(dashboardId);
      if (!dashboard) return null;

      const widget = dashboard.widgets.find((w) => w.id === widgetId);
      if (!widget) return null;

      Object.assign(widget, updates);
      dashboard.updatedAt = Date.now();
      return widget;
    },

    moveWidget: (dashboardId, widgetId, position) => {
      return this.updateWidget(dashboardId, widgetId, { position });
    },

    resizeWidget: (dashboardId, widgetId, size) => {
      return this.updateWidget(dashboardId, widgetId, { size });
    },

    getWidgets: (dashboardId) => {
      const dashboard = dashboards.get(dashboardId);
      return dashboard ? [...dashboard.widgets] : [];
    },

    duplicateWidget: (dashboardId, widgetId) => {
      const dashboard = dashboards.get(dashboardId);
      if (!dashboard) return null;

      const widget = dashboard.widgets.find((w) => w.id === widgetId);
      if (!widget) return null;

      const duplicate = {
        ...widget,
        id: crypto.randomUUID(),
        title: `${widget.title} (Copy)`,
        position: {
          x: widget.position.x + 1,
          y: widget.position.y + 1,
        },
      };
      dashboard.widgets.push(duplicate);
      return duplicate;
    },

    reorderWidgets: (dashboardId, widgetIds) => {
      const dashboard = dashboards.get(dashboardId);
      if (!dashboard) return false;

      const widgetMap = new Map(dashboard.widgets.map((w) => [w.id, w]));
      dashboard.widgets = widgetIds.map((id) => widgetMap.get(id)).filter(Boolean);
      return true;
    },

    exportDashboard: (dashboardId) => {
      const dashboard = dashboards.get(dashboardId);
      if (!dashboard) return null;
      return JSON.stringify(dashboard);
    },

    importDashboard: (json, newId = null) => {
      try {
        const data = JSON.parse(json);
        data.id = newId || crypto.randomUUID();
        data.createdAt = Date.now();
        data.updatedAt = Date.now();
        dashboards.set(data.id, data);
        return data;
      } catch {
        return null;
      }
    },

    listDashboards: () =>
      [...dashboards.values()].map((d) => ({
        id: d.id,
        title: d.title,
        widgetCount: d.widgets.length,
        updatedAt: d.updatedAt,
      })),
  };
};

// Data source manager
const createDataSourceManager = () => {
  const sources = new Map();
  const cache = new Map();

  return {
    register: (id, fetcher, options = {}) => {
      sources.set(id, {
        id,
        fetcher,
        refreshInterval: options.refreshInterval || 0,
        cacheTTL: options.cacheTTL || 60000,
      });
    },

    fetch: async (id, params = {}) => {
      const source = sources.get(id);
      if (!source) throw new Error(`Data source "${id}" not found`);

      const cacheKey = `${id}:${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < source.cacheTTL) {
        return cached.data;
      }

      const data = await source.fetcher(params);
      cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    },

    invalidate: (id) => {
      for (const key of cache.keys()) {
        if (key.startsWith(`${id}:`)) {
          cache.delete(key);
        }
      }
    },

    getSources: () => [...sources.keys()],
  };
};

// Filter builder
const createFilterBuilder = () => {
  const filters = [];

  const builder = {
    where: (field, operator, value) => {
      filters.push({ field, operator, value, type: 'where' });
      return builder;
    },

    and: (field, operator, value) => {
      filters.push({ field, operator, value, type: 'and' });
      return builder;
    },

    or: (field, operator, value) => {
      filters.push({ field, operator, value, type: 'or' });
      return builder;
    },

    between: (field, min, max) => {
      filters.push({ field, operator: 'between', value: [min, max], type: 'where' });
      return builder;
    },

    in: (field, values) => {
      filters.push({ field, operator: 'in', value: values, type: 'where' });
      return builder;
    },

    build: () => [...filters],

    apply: (data) => {
      return data.filter((item) => {
        return filters.every((f) => {
          const itemValue = item[f.field];
          switch (f.operator) {
            case 'eq':
              return itemValue === f.value;
            case 'neq':
              return itemValue !== f.value;
            case 'gt':
              return itemValue > f.value;
            case 'gte':
              return itemValue >= f.value;
            case 'lt':
              return itemValue < f.value;
            case 'lte':
              return itemValue <= f.value;
            case 'contains':
              return String(itemValue).includes(f.value);
            case 'between':
              return itemValue >= f.value[0] && itemValue <= f.value[1];
            case 'in':
              return f.value.includes(itemValue);
            default:
              return true;
          }
        });
      });
    },

    reset: () => {
      filters.length = 0;
      return builder;
    },
  };

  return builder;
};

describe('Dashboard Builder Tests', () => {
  let builder;

  beforeEach(() => {
    builder = createDashboardBuilder();
  });

  it('should create dashboard', () => {
    const dashboard = builder.createDashboard('dash-1', { title: 'My Dashboard' });

    expect(dashboard.id).toBe('dash-1');
    expect(dashboard.title).toBe('My Dashboard');
    expect(dashboard.widgets).toEqual([]);
  });

  it('should add widget', () => {
    builder.createDashboard('dash-1');
    const widget = builder.addWidget('dash-1', 'chart', {
      title: 'Sales Chart',
      position: { x: 0, y: 0 },
    });

    expect(widget.type).toBe('chart');
    expect(widget.title).toBe('Sales Chart');
  });

  it('should remove widget', () => {
    builder.createDashboard('dash-1');
    const widget = builder.addWidget('dash-1', 'metric');

    expect(builder.removeWidget('dash-1', widget.id)).toBe(true);
    expect(builder.getWidgets('dash-1')).toHaveLength(0);
  });

  it('should update widget', () => {
    builder.createDashboard('dash-1');
    const widget = builder.addWidget('dash-1', 'table');

    builder.updateWidget('dash-1', widget.id, { title: 'Updated Title' });

    const updated = builder.getWidgets('dash-1')[0];
    expect(updated.title).toBe('Updated Title');
  });

  it('should move widget', () => {
    builder.createDashboard('dash-1');
    const widget = builder.addWidget('dash-1', 'chart');

    builder.moveWidget('dash-1', widget.id, { x: 5, y: 3 });

    const moved = builder.getWidgets('dash-1')[0];
    expect(moved.position).toEqual({ x: 5, y: 3 });
  });

  it('should duplicate widget', () => {
    builder.createDashboard('dash-1');
    const widget = builder.addWidget('dash-1', 'metric', { title: 'Original' });

    builder.duplicateWidget('dash-1', widget.id);

    expect(builder.getWidgets('dash-1')).toHaveLength(2);
  });

  it('should export and import dashboard', () => {
    builder.createDashboard('dash-1', { title: 'Test' });
    builder.addWidget('dash-1', 'chart');

    const json = builder.exportDashboard('dash-1');
    const imported = builder.importDashboard(json, 'dash-2');

    expect(imported.title).toBe('Test');
    expect(imported.widgets).toHaveLength(1);
  });

  it('should list dashboards', () => {
    builder.createDashboard('dash-1', { title: 'First' });
    builder.createDashboard('dash-2', { title: 'Second' });

    const list = builder.listDashboards();
    expect(list).toHaveLength(2);
  });
});

describe('Data Source Manager Tests', () => {
  let manager;

  beforeEach(() => {
    manager = createDataSourceManager();
  });

  it('should register and fetch data', async () => {
    manager.register('users', async () => [{ id: 1, name: 'Alice' }]);

    const data = await manager.fetch('users');
    expect(data).toHaveLength(1);
  });

  it('should cache results', async () => {
    const fetcher = vi.fn(async () => [{ value: 42 }]);
    manager.register('cached', fetcher, { cacheTTL: 60000 });

    await manager.fetch('cached');
    await manager.fetch('cached');

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should invalidate cache', async () => {
    const fetcher = vi.fn(async () => ({ ts: Date.now() }));
    manager.register('data', fetcher);

    await manager.fetch('data');
    manager.invalidate('data');
    await manager.fetch('data');

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should pass params to fetcher', async () => {
    const fetcher = vi.fn(async (params) => params);
    manager.register('parameterized', fetcher);

    const result = await manager.fetch('parameterized', { filter: 'active' });

    expect(result.filter).toBe('active');
  });
});

describe('Filter Builder Tests', () => {
  const data = [
    { id: 1, name: 'Alice', age: 30, status: 'active' },
    { id: 2, name: 'Bob', age: 25, status: 'inactive' },
    { id: 3, name: 'Charlie', age: 35, status: 'active' },
    { id: 4, name: 'Diana', age: 28, status: 'active' },
  ];

  it('should filter with equals', () => {
    const filter = createFilterBuilder().where('status', 'eq', 'active');
    const result = filter.apply(data);

    expect(result).toHaveLength(3);
  });

  it('should filter with greater than', () => {
    const filter = createFilterBuilder().where('age', 'gt', 28);
    const result = filter.apply(data);

    expect(result).toHaveLength(2);
  });

  it('should filter with between', () => {
    const filter = createFilterBuilder().between('age', 26, 32);
    const result = filter.apply(data);

    expect(result).toHaveLength(2); // Alice (30), Diana (28)
  });

  it('should filter with in', () => {
    const filter = createFilterBuilder().in('name', ['Alice', 'Bob']);
    const result = filter.apply(data);

    expect(result).toHaveLength(2);
  });

  it('should chain filters', () => {
    const filter = createFilterBuilder().where('status', 'eq', 'active').and('age', 'gte', 30);
    const result = filter.apply(data);

    expect(result).toHaveLength(2); // Alice, Charlie
  });

  it('should build filter array', () => {
    const filter = createFilterBuilder().where('x', 'eq', 1).and('y', 'gt', 2);

    const built = filter.build();
    expect(built).toHaveLength(2);
  });
});
