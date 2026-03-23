# database-admin

A multi-database tool plugin for OpenCode that provides direct SQL access.

**Supported Databases:** MySQL, MariaDB, PostgreSQL, SQL Server, SQLite

---

## Write Protection

Before executing write operations, you must grant consent. This is a safety feature designed to protect your data by ensuring you consciously acknowledge each operation.

### How It Works

When you attempt a write operation (INSERT, UPDATE, DELETE, DROP, etc.) for the first time, you will be prompted to grant consent. This gives you a moment to verify the operation before it executes.

Your identity (name, email, hostname) is recorded with each consent grant for audit purposes.

### Grant Consent

```sql
db { "action": "consent", "grant": true }
```

### Consent Levels

Choose the level that matches your workflow:

- **Global:** Permanent across all projects
- **Project:** Permanent for a specific project
- **Session:** Valid for 24 hours
- **Operation:** Required for each write (most cautious)

```sql
-- Set consent level
db { "action": "consent", "grant": true, "scope": "session" }
```

### Check Consent Status

```sql
db { "action": "consent" }
```

### Revoke Consent

```sql
db { "action": "consent", "grant": false }
```

---

## Installation

```json
{
  "plugins": ["database-admin"]
}
```

---

## Configuration

### Connection Strings

Create `~/.config/opencode/db-connections.json`:

```json
{
  "default": {
    "Server": "localhost",
    "Database": "mydb",
    "User Id": "root",
    "Password": "secret"
  }
}
```

### Auto-Discovery

The plugin automatically discovers connections from:

- .NET: appsettings.json, appsettings.Development.json
- Node.js: .env, .env.local
- Python: .env, settings.py
- Java: application.properties

---

## Usage Examples

### Query databases

```sql
-- Auto-discover connection
db { "query": "SELECT * FROM users LIMIT 5" }

-- Specific connection
db { "query": "SELECT * FROM orders", "connection": "production" }

-- Direct URL
db { "query": "SELECT 1", "connection": "mysql://root:pass@localhost:3306/mydb" }
```

### Discover available connections

```sql
db { "connection": "discover" }
```

---

## Terms

This software is provided "AS IS" without warranty.

By granting consent for write operations, you acknowledge responsibility for verifying your queries before execution.

**Contact:** nyingimaina@gmail.com

**License:** MIT (see LICENSE) | [Commercial License](COMMERCIAL_LICENSE.md)
