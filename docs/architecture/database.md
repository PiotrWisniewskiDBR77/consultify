# Database Architecture

## Overview

Consultify supports two database backends:
- **SQLite** - Default for development and testing
- **PostgreSQL** - Production database

Both implementations provide an identical interface, allowing seamless switching between databases.

## Architecture

```
server/
├── database.js                    # Main wrapper - selects implementation
├── database.sqlite.active.js      # SQLite implementation (active)
├── database.sqlite.js             # Legacy SQLite (deprecated)
├── database.postgres.js           # PostgreSQL implementation
└── config/
    └── database.config.js         # Configuration
```

## Database Selection

The database type is determined by:
1. `DB_TYPE` environment variable (explicit: `sqlite` or `postgres`)
2. `DATABASE_URL` environment variable (auto-detect: starts with `postgres://` or `postgresql://`)
3. Default fallback: SQLite

See `server/config/database.config.js` for details.

## Common Interface

Both implementations expose the same interface:

### Methods

- `run(sql, params, callback)` - Execute a query that doesn't return rows (INSERT, UPDATE, DELETE)
- `get(sql, params, callback)` - Execute a query and return the first row
- `all(sql, params, callback)` - Execute a query and return all rows
- `serialize(callback)` - Serialize database operations (SQLite only, no-op for PostgreSQL)
- `prepare(sql)` - Prepare a statement for repeated execution
- `close()` - Close the database connection

### Callback Signature

All query methods use the SQLite callback pattern:
```javascript
callback(err, result)
```

- `err` - Error object or null
- `result` - Query result (row for `get`, array for `all`, undefined for `run`)

### Example Usage

```javascript
const db = require('./database');

// Get single row
db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('User:', user);
});

// Get all rows
db.all('SELECT * FROM tasks WHERE project_id = ?', [projectId], (err, tasks) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('Tasks:', tasks);
});

// Execute query
db.run('INSERT INTO users (id, email) VALUES (?, ?)', [userId, email], function(err) {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('Inserted:', this.changes, 'rows');
});
```

## SQLite Implementation

**File:** `server/database.sqlite.active.js`

- Uses `sqlite3` package
- Supports in-memory database for testing (`:memory:`)
- Implements full schema initialization
- Includes seed data for development

### Features

- Transaction support via `serialize()`
- Prepared statements
- Full-text search support
- JSON functions

## PostgreSQL Implementation

**File:** `server/database.postgres.js`

- Uses `pg` (node-postgres) package
- Connection pooling via `pg.Pool`
- Automatic SQL query adaptation (SQLite → PostgreSQL)

### Query Adaptation

The PostgreSQL implementation automatically adapts SQLite queries:

- `?` placeholders → `$1, $2, ...` (PostgreSQL parameterized queries)
- `datetime('now')` → `NOW()`
- `datetime('now', '-N days')` → `NOW() - INTERVAL 'N days'`
- SQLite-specific functions are converted to PostgreSQL equivalents

### Features

- Connection pooling (configurable pool size)
- SSL support for production
- Automatic query adaptation
- JSONB support for complex data

## Migration Strategy

### SQLite → PostgreSQL

1. Export data from SQLite:
   ```bash
   sqlite3 consultify.db .dump > dump.sql
   ```

2. Adapt SQL dump for PostgreSQL (UUIDs, JSONB, etc.)

3. Import into PostgreSQL:
   ```bash
   psql $DATABASE_URL < dump.sql
   ```

4. Set `DB_TYPE=postgres` or `DATABASE_URL=postgres://...`

See `server/scripts/migrate-to-postgres.js` for automated migration script.

## Testing

Both implementations are tested with the same test suite. Tests automatically use SQLite in-memory database when `NODE_ENV=test`.

## Configuration

Database configuration is managed in `server/config/database.config.js`:

- `DB_TYPE` - Explicit database type (`sqlite` or `postgres`)
- `DATABASE_URL` - Connection string (for PostgreSQL)
- `SQLITE_PATH` - Path to SQLite database file
- `DB_POOL_SIZE` - PostgreSQL connection pool size

## Best Practices

1. **Always use parameterized queries** - Prevents SQL injection
2. **Handle errors** - Always check `err` in callbacks
3. **Use transactions** - For multiple related operations (SQLite: `serialize()`, PostgreSQL: `BEGIN/COMMIT`)
4. **Close connections** - Call `db.close()` when shutting down
5. **Test both implementations** - Ensure compatibility

## Troubleshooting

### SQLite Issues

- **Database locked**: Ensure proper use of `serialize()` for transactions
- **File permissions**: Check write permissions for database file

### PostgreSQL Issues

- **Connection errors**: Verify `DATABASE_URL` and network access
- **SSL errors**: Configure `DB_SSL` environment variable
- **Query errors**: Check query adaptation logs for SQLite-specific syntax

## Future Improvements

- [ ] Add TypeScript types for database interface
- [ ] Implement connection retry logic
- [ ] Add query logging/monitoring
- [ ] Support for database migrations framework
- [ ] Add read replicas support (PostgreSQL)




