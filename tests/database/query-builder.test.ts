/**
 * Database Query Builder Tests
 * Tests for database query builder utilities
 * 
 * @module tests/database/query-builder.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Query builder implementation
const createQueryBuilder = () => {
    let query = {
        type: 'SELECT' as 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
        table: '',
        columns: ['*'] as string[],
        wheres: [] as Array<{ column: string; operator: string; value: any }>,
        orderBy: [] as Array<{ column: string; direction: 'ASC' | 'DESC' }>,
        limit: null as number | null,
        offset: null as number | null,
        joins: [] as Array<{ type: string; table: string; on: string }>,
        groupBy: [] as string[],
        having: [] as string[],
    };

    const builder = {
        select: (columns: string[] = ['*']) => {
            query.type = 'SELECT';
            query.columns = columns;
            return builder;
        },
        from: (table: string) => {
            query.table = table;
            return builder;
        },
        insert: (table: string) => {
            query.type = 'INSERT';
            query.table = table;
            return builder;
        },
        update: (table: string) => {
            query.type = 'UPDATE';
            query.table = table;
            return builder;
        },
        delete: () => {
            query.type = 'DELETE';
            return builder;
        },
        where: (column: string, operator: string, value: any) => {
            query.wheres.push({ column, operator, value });
            return builder;
        },
        whereEqual: (column: string, value: any) => {
            return builder.where(column, '=', value);
        },
        whereLike: (column: string, pattern: string) => {
            return builder.where(column, 'LIKE', pattern);
        },
        whereIn: (column: string, values: any[]) => {
            return builder.where(column, 'IN', values);
        },
        orderBy: (column: string, direction: 'ASC' | 'DESC' = 'ASC') => {
            query.orderBy.push({ column, direction });
            return builder;
        },
        limit: (limit: number) => {
            query.limit = limit;
            return builder;
        },
        offset: (offset: number) => {
            query.offset = offset;
            return builder;
        },
        join: (table: string, on: string) => {
            query.joins.push({ type: 'INNER', table, on });
            return builder;
        },
        leftJoin: (table: string, on: string) => {
            query.joins.push({ type: 'LEFT', table, on });
            return builder;
        },
        groupBy: (column: string) => {
            query.groupBy.push(column);
            return builder;
        },
        having: (condition: string) => {
            query.having.push(condition);
            return builder;
        },
        build: () => {
            const parts: string[] = [];

            if (query.type === 'SELECT') {
                parts.push(`SELECT ${query.columns.join(', ')}`);
                parts.push(`FROM ${query.table}`);
            } else if (query.type === 'DELETE') {
                parts.push(`DELETE FROM ${query.table}`);
            }

            // Joins
            query.joins.forEach(j => {
                parts.push(`${j.type} JOIN ${j.table} ON ${j.on}`);
            });

            // Where
            if (query.wheres.length > 0) {
                const whereClauses = query.wheres.map(w => {
                    if (w.operator === 'IN') {
                        return `${w.column} IN (${w.value.map(() => '?').join(', ')})`;
                    }
                    return `${w.column} ${w.operator} ?`;
                });
                parts.push(`WHERE ${whereClauses.join(' AND ')}`);
            }

            // Group by
            if (query.groupBy.length > 0) {
                parts.push(`GROUP BY ${query.groupBy.join(', ')}`);
            }

            // Having
            if (query.having.length > 0) {
                parts.push(`HAVING ${query.having.join(' AND ')}`);
            }

            // Order by
            if (query.orderBy.length > 0) {
                const orderClauses = query.orderBy.map(o => `${o.column} ${o.direction}`);
                parts.push(`ORDER BY ${orderClauses.join(', ')}`);
            }

            // Limit/Offset
            if (query.limit !== null) {
                parts.push(`LIMIT ${query.limit}`);
            }
            if (query.offset !== null) {
                parts.push(`OFFSET ${query.offset}`);
            }

            return parts.join(' ');
        },
        getParams: () => {
            const params: any[] = [];
            query.wheres.forEach(w => {
                if (w.operator === 'IN') {
                    params.push(...w.value);
                } else {
                    params.push(w.value);
                }
            });
            return params;
        },
        reset: () => {
            query = {
                type: 'SELECT',
                table: '',
                columns: ['*'],
                wheres: [],
                orderBy: [],
                limit: null,
                offset: null,
                joins: [],
                groupBy: [],
                having: [],
            };
            return builder;
        },
    };

    return builder;
};

describe('Query Builder Tests', () => {
    let qb: ReturnType<typeof createQueryBuilder>;

    beforeEach(() => {
        qb = createQueryBuilder();
    });

    // ═══════════════════════════════════════════════════════════════════
    // SELECT QUERIES
    // ═══════════════════════════════════════════════════════════════════

    describe('SELECT Queries', () => {
        it('should build simple select', () => {
            const sql = qb.select().from('users').build();
            expect(sql).toBe('SELECT * FROM users');
        });

        it('should select specific columns', () => {
            const sql = qb.select(['id', 'name', 'email']).from('users').build();
            expect(sql).toBe('SELECT id, name, email FROM users');
        });

        it('should add where clause', () => {
            const sql = qb.select().from('users').whereEqual('id', 1).build();
            expect(sql).toBe('SELECT * FROM users WHERE id = ?');
            expect(qb.getParams()).toEqual([1]);
        });

        it('should add multiple where clauses', () => {
            const sql = qb
                .select()
                .from('users')
                .whereEqual('status', 'active')
                .whereEqual('role', 'admin')
                .build();
            expect(sql).toBe('SELECT * FROM users WHERE status = ? AND role = ?');
            expect(qb.getParams()).toEqual(['active', 'admin']);
        });

        it('should add LIKE clause', () => {
            const sql = qb.select().from('users').whereLike('name', '%john%').build();
            expect(sql).toBe('SELECT * FROM users WHERE name LIKE ?');
        });

        it('should add IN clause', () => {
            const sql = qb.select().from('users').whereIn('id', [1, 2, 3]).build();
            expect(sql).toBe('SELECT * FROM users WHERE id IN (?, ?, ?)');
            expect(qb.getParams()).toEqual([1, 2, 3]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ORDER BY
    // ═══════════════════════════════════════════════════════════════════

    describe('Order By', () => {
        it('should add order by ASC', () => {
            const sql = qb.select().from('users').orderBy('name', 'ASC').build();
            expect(sql).toBe('SELECT * FROM users ORDER BY name ASC');
        });

        it('should add order by DESC', () => {
            const sql = qb.select().from('users').orderBy('created_at', 'DESC').build();
            expect(sql).toBe('SELECT * FROM users ORDER BY created_at DESC');
        });

        it('should add multiple order by', () => {
            const sql = qb
                .select()
                .from('users')
                .orderBy('name', 'ASC')
                .orderBy('created_at', 'DESC')
                .build();
            expect(sql).toBe('SELECT * FROM users ORDER BY name ASC, created_at DESC');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LIMIT & OFFSET
    // ═══════════════════════════════════════════════════════════════════

    describe('Limit & Offset', () => {
        it('should add limit', () => {
            const sql = qb.select().from('users').limit(10).build();
            expect(sql).toBe('SELECT * FROM users LIMIT 10');
        });

        it('should add offset', () => {
            const sql = qb.select().from('users').limit(10).offset(20).build();
            expect(sql).toBe('SELECT * FROM users LIMIT 10 OFFSET 20');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // JOINS
    // ═══════════════════════════════════════════════════════════════════

    describe('Joins', () => {
        it('should add inner join', () => {
            const sql = qb
                .select()
                .from('users')
                .join('orders', 'users.id = orders.user_id')
                .build();
            expect(sql).toBe('SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id');
        });

        it('should add left join', () => {
            const sql = qb
                .select()
                .from('users')
                .leftJoin('profiles', 'users.id = profiles.user_id')
                .build();
            expect(sql).toBe('SELECT * FROM users LEFT JOIN profiles ON users.id = profiles.user_id');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GROUP BY & HAVING
    // ═══════════════════════════════════════════════════════════════════

    describe('Group By & Having', () => {
        it('should add group by', () => {
            const sql = qb.select(['status', 'COUNT(*)']).from('users').groupBy('status').build();
            expect(sql).toBe('SELECT status, COUNT(*) FROM users GROUP BY status');
        });

        it('should add having', () => {
            const sql = qb
                .select(['status', 'COUNT(*)'])
                .from('users')
                .groupBy('status')
                .having('COUNT(*) > 5')
                .build();
            expect(sql).toBe('SELECT status, COUNT(*) FROM users GROUP BY status HAVING COUNT(*) > 5');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DELETE QUERIES
    // ═══════════════════════════════════════════════════════════════════

    describe('DELETE Queries', () => {
        it('should build delete query', () => {
            const sql = qb.delete().from('users').whereEqual('id', 1).build();
            expect(sql).toBe('DELETE FROM users WHERE id = ?');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RESET
    // ═══════════════════════════════════════════════════════════════════

    describe('Reset', () => {
        it('should reset builder state', () => {
            qb.select(['id']).from('users').whereEqual('id', 1).limit(10);
            qb.reset();

            const sql = qb.select().from('posts').build();
            expect(sql).toBe('SELECT * FROM posts');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // COMPLEX QUERIES
    // ═══════════════════════════════════════════════════════════════════

    describe('Complex Queries', () => {
        it('should build complex query', () => {
            const sql = qb
                .select(['users.id', 'users.name', 'COUNT(orders.id) as order_count'])
                .from('users')
                .leftJoin('orders', 'users.id = orders.user_id')
                .whereEqual('users.status', 'active')
                .groupBy('users.id')
                .having('COUNT(orders.id) > 0')
                .orderBy('order_count', 'DESC')
                .limit(10)
                .build();

            expect(sql).toContain('SELECT users.id, users.name, COUNT(orders.id) as order_count');
            expect(sql).toContain('FROM users');
            expect(sql).toContain('LEFT JOIN orders ON users.id = orders.user_id');
            expect(sql).toContain('WHERE users.status = ?');
            expect(sql).toContain('GROUP BY users.id');
            expect(sql).toContain('HAVING COUNT(orders.id) > 0');
            expect(sql).toContain('ORDER BY order_count DESC');
            expect(sql).toContain('LIMIT 10');
        });
    });
});
