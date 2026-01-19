/**
 * Query Builder Tests
 * Tests for SQL-like query building
 *
 * @module tests/query/query-builder.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Query builder
const createQueryBuilder = () => {
  let state = {
    type: 'select',
    table: null,
    columns: ['*'],
    wheres: [],
    joins: [],
    orderBy: [],
    groupBy: [],
    having: [],
    limit: null,
    offset: null,
    params: [],
  };

  const builder = {
    select: (...columns) => {
      state.type = 'select';
      state.columns = columns.length ? columns : ['*'];
      return builder;
    },

    from: (table) => {
      state.table = table;
      return builder;
    },

    where: (column, operator, value) => {
      state.wheres.push({ column, operator, value, type: 'AND' });
      state.params.push(value);
      return builder;
    },

    orWhere: (column, operator, value) => {
      state.wheres.push({ column, operator, value, type: 'OR' });
      state.params.push(value);
      return builder;
    },

    whereIn: (column, values) => {
      state.wheres.push({ column, operator: 'IN', value: values, type: 'AND' });
      state.params.push(...values);
      return builder;
    },

    whereNull: (column) => {
      state.wheres.push({ column, operator: 'IS NULL', value: null, type: 'AND' });
      return builder;
    },

    whereNotNull: (column) => {
      state.wheres.push({ column, operator: 'IS NOT NULL', value: null, type: 'AND' });
      return builder;
    },

    whereBetween: (column, min, max) => {
      state.wheres.push({ column, operator: 'BETWEEN', value: [min, max], type: 'AND' });
      state.params.push(min, max);
      return builder;
    },

    join: (table, column1, operator, column2) => {
      state.joins.push({ type: 'INNER', table, column1, operator, column2 });
      return builder;
    },

    leftJoin: (table, column1, operator, column2) => {
      state.joins.push({ type: 'LEFT', table, column1, operator, column2 });
      return builder;
    },

    rightJoin: (table, column1, operator, column2) => {
      state.joins.push({ type: 'RIGHT', table, column1, operator, column2 });
      return builder;
    },

    orderBy: (column, direction = 'ASC') => {
      state.orderBy.push({ column, direction: direction.toUpperCase() });
      return builder;
    },

    groupBy: (...columns) => {
      state.groupBy.push(...columns);
      return builder;
    },

    having: (column, operator, value) => {
      state.having.push({ column, operator, value });
      state.params.push(value);
      return builder;
    },

    limit: (count) => {
      state.limit = count;
      return builder;
    },

    offset: (count) => {
      state.offset = count;
      return builder;
    },

    toSQL: () => {
      let sql = `SELECT ${state.columns.join(', ')} FROM ${state.table}`;

      // Joins
      for (const join of state.joins) {
        sql += ` ${join.type} JOIN ${join.table} ON ${join.column1} ${join.operator} ${join.column2}`;
      }

      // Wheres
      if (state.wheres.length > 0) {
        sql += ' WHERE ';
        sql += state.wheres
          .map((w, i) => {
            const prefix = i === 0 ? '' : ` ${w.type} `;
            if (w.operator === 'IN') {
              return `${prefix}${w.column} IN (${w.value.map(() => '?').join(', ')})`;
            }
            if (w.operator === 'BETWEEN') {
              return `${prefix}${w.column} BETWEEN ? AND ?`;
            }
            if (w.operator === 'IS NULL' || w.operator === 'IS NOT NULL') {
              return `${prefix}${w.column} ${w.operator}`;
            }
            return `${prefix}${w.column} ${w.operator} ?`;
          })
          .join('');
      }

      // Group by
      if (state.groupBy.length > 0) {
        sql += ` GROUP BY ${state.groupBy.join(', ')}`;
      }

      // Having
      if (state.having.length > 0) {
        sql += ' HAVING ';
        sql += state.having.map((h) => `${h.column} ${h.operator} ?`).join(' AND ');
      }

      // Order by
      if (state.orderBy.length > 0) {
        sql += ` ORDER BY ${state.orderBy.map((o) => `${o.column} ${o.direction}`).join(', ')}`;
      }

      // Limit/offset
      if (state.limit !== null) {
        sql += ` LIMIT ${state.limit}`;
      }
      if (state.offset !== null) {
        sql += ` OFFSET ${state.offset}`;
      }

      return sql;
    },

    getParams: () => [...state.params],

    reset: () => {
      state = {
        type: 'select',
        table: null,
        columns: ['*'],
        wheres: [],
        joins: [],
        orderBy: [],
        groupBy: [],
        having: [],
        limit: null,
        offset: null,
        params: [],
      };
      return builder;
    },
  };

  return builder;
};

// Insert builder
const createInsertBuilder = () => {
  let state = {
    table: null,
    values: [],
  };

  return {
    into: (table) => {
      state.table = table;
      return this;
    },

    values: (data) => {
      state.values.push(data);
      return this;
    },

    toSQL: () => {
      if (state.values.length === 0) return '';

      const columns = Object.keys(state.values[0]);
      const placeholders = state.values
        .map(() => `(${columns.map(() => '?').join(', ')})`)
        .join(', ');

      return `INSERT INTO ${state.table} (${columns.join(', ')}) VALUES ${placeholders}`;
    },

    getParams: () => {
      return state.values.flatMap((v) => Object.values(v));
    },
  };
};

// Update builder
const createUpdateBuilder = () => {
  let state = {
    table: null,
    sets: {},
    wheres: [],
    params: [],
  };

  return {
    table: (name) => {
      state.table = name;
      return this;
    },

    set: (column, value) => {
      state.sets[column] = value;
      return this;
    },

    where: (column, operator, value) => {
      state.wheres.push({ column, operator, value });
      return this;
    },

    toSQL: () => {
      const sets = Object.entries(state.sets)
        .map(([k]) => `${k} = ?`)
        .join(', ');
      let sql = `UPDATE ${state.table} SET ${sets}`;

      if (state.wheres.length > 0) {
        sql += ' WHERE ' + state.wheres.map((w) => `${w.column} ${w.operator} ?`).join(' AND ');
      }

      return sql;
    },

    getParams: () => {
      return [...Object.values(state.sets), ...state.wheres.map((w) => w.value)];
    },
  };
};

describe('Query Builder Tests', () => {
  let qb;

  beforeEach(() => {
    qb = createQueryBuilder();
  });

  it('should build simple select', () => {
    const sql = qb.select('id', 'name').from('users').toSQL();

    expect(sql).toBe('SELECT id, name FROM users');
  });

  it('should build with where', () => {
    const sql = qb.select().from('users').where('id', '=', 1).toSQL();

    expect(sql).toBe('SELECT * FROM users WHERE id = ?');
    expect(qb.getParams()).toEqual([1]);
  });

  it('should build with multiple wheres', () => {
    const sql = qb
      .select()
      .from('users')
      .where('status', '=', 'active')
      .where('age', '>', 18)
      .toSQL();

    expect(sql).toContain('status = ?');
    expect(sql).toContain('AND age > ?');
  });

  it('should build with join', () => {
    const sql = qb
      .select('users.*', 'orders.total')
      .from('users')
      .join('orders', 'users.id', '=', 'orders.user_id')
      .toSQL();

    expect(sql).toContain('INNER JOIN orders ON users.id = orders.user_id');
  });

  it('should build with order and limit', () => {
    const sql = qb.select().from('products').orderBy('price', 'DESC').limit(10).offset(20).toSQL();

    expect(sql).toContain('ORDER BY price DESC');
    expect(sql).toContain('LIMIT 10');
    expect(sql).toContain('OFFSET 20');
  });

  it('should build with whereIn', () => {
    const sql = qb.select().from('users').whereIn('id', [1, 2, 3]).toSQL();

    expect(sql).toContain('id IN (?, ?, ?)');
  });

  it('should build with group by and having', () => {
    const sql = qb
      .select('category', 'COUNT(*)')
      .from('products')
      .groupBy('category')
      .having('COUNT(*)', '>', 5)
      .toSQL();

    expect(sql).toContain('GROUP BY category');
    expect(sql).toContain('HAVING COUNT(*) > ?');
  });
});

describe('Insert Builder Tests', () => {
  it('should build insert', () => {
    const builder = createInsertBuilder();
    builder.into('users').values({ name: 'John', email: 'john@test.com' });

    expect(builder.toSQL()).toBe('INSERT INTO users (name, email) VALUES (?, ?)');
    expect(builder.getParams()).toEqual(['John', 'john@test.com']);
  });

  it('should build bulk insert', () => {
    const builder = createInsertBuilder();
    builder.into('users').values({ name: 'A' }).values({ name: 'B' });

    expect(builder.toSQL()).toContain('VALUES (?)');
  });
});

describe('Update Builder Tests', () => {
  it('should build update', () => {
    const builder = createUpdateBuilder();
    builder.table('users').set('name', 'Jane').set('updated_at', 'NOW()').where('id', '=', 1);

    expect(builder.toSQL()).toBe('UPDATE users SET name = ?, updated_at = ? WHERE id = ?');
    expect(builder.getParams()).toEqual(['Jane', 'NOW()', 1]);
  });
});
