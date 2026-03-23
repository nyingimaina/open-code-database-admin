# database-admin - Announcement Copy

## Hacker News

**Title:** database-admin: SQL access for OpenCode with configurable write consent

**Body:**

I have released database-admin, an OpenCode plugin that provides SQL query access to MySQL, PostgreSQL, SQL Server, and SQLite databases.

**Capabilities:**

- Query support for MySQL, MariaDB, PostgreSQL, SQL Server, and SQLite
- Automatic discovery of connection strings from project configuration files
- Configurable write consent system with multiple trust levels
- Read queries work immediately; write operations require explicit consent

**Consent System:**

Write operations (INSERT, UPDATE, DELETE, DROP, ALTER, etc.) require explicit consent. Four levels are available:

- Global: Permanent across all projects
- Project: Permanent for a specific project
- Session: Valid for 24 hours
- Operation: Required for each individual write

The consent mechanism records user identity, timestamp, and scope, providing an auditable record.

**Installation:**

```json
{
  "plugins": ["database-admin"]
}
```

Repository: https://github.com/nyingimaina/open-code-database-admin
npm: https://www.npmjs.com/package/database-admin

License: MIT with commercial options available.

---

## Reddit - r/opencode

**Title:** database-admin - SQL tool for OpenCode with consent-based write protection

**Body:**

I have published database-admin, an OpenCode plugin for database queries.

**Supported databases:** MySQL, MariaDB, PostgreSQL, SQL Server, SQLite

**Features:**

- Connection string discovery from project configuration
- Consent-based write protection (global, project, session, or per-operation)
- MIT license with commercial licensing options

**Consent example:**

```
db { "query": "SELECT * FROM users" }           -- works immediately
db { "query": "UPDATE users SET..." }           -- blocked until consent
db { "action": "consent", "grant": true }
```

Repository: https://github.com/nyingimaina/open-code-database-admin
npm: https://www.npmjs.com/package/database-admin

---

## Key Points

1. What it does: SQL access from OpenCode to common database systems
2. Safety: Write operations require explicit consent with identity tracking
3. Licensing: MIT open source; commercial licenses available
