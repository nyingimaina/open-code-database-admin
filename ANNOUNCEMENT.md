# database-admin - Professional Announcement Copy

## Hacker News

**Title:** database-admin: A multi-database tool for OpenCode with enterprise-grade write consent

**Body:**

I've released database-admin, an OpenCode plugin that provides direct SQL access to MySQL, PostgreSQL, SQL Server, and SQLite from within OpenCode.

**Key Features:**

- Auto-discovers connection strings from project configs (appsettings.json, .env, application.properties, etc.)
- Supports MySQL, MariaDB, PostgreSQL, SQL Server, SQLite
- Configurable write consent system with multiple scopes (global, project, session, operation)
- Enterprise-grade liability framework with identity tracking
- Read queries are unrestricted; write operations require explicit consent

**Write Consent System:**

Before any write operation, users must explicitly grant consent at a scope of their choosing:
- Global: Permanent, applies to all projects
- Project: Permanent, applies to specific project
- Session: Expires after 24 hours
- Operation: Requires explicit consent per query

The consent system records user identity (name, email, hostname) and timestamp, creating an auditable trail.

**Installation:**

```json
{
  "plugins": ["database-admin"]
}
```

npm: https://www.npmjs.com/package/database-admin
GitHub: https://github.com/nyingimaina/database-admin

Licensed under MIT with commercial licensing available for enterprise use.

---

## Reddit - r/opencode

**Title:** Released database-admin: Multi-database tool for OpenCode with configurable write consent

**Body:**

I've published database-admin, an OpenCode plugin for direct SQL access.

**Supported Databases:**
MySQL, MariaDB, PostgreSQL, SQL Server, SQLite

**Highlights:**
- Auto-discovers connections from .env, appsettings.json, application.properties
- Multi-scope write consent (global/project/session/operation)
- Identity tracking on consent grants
- MIT license with commercial options available

**Consent Flow:**
```
db { "query": "SELECT * FROM users" }  # Works immediately
db { "query": "UPDATE users SET..." }  # Blocked until consent granted
db { "action": "consent", "grant": true, "scope": "session" }
```

npm: https://www.npmjs.com/package/database-admin
GitHub: https://github.com/nyingimaina/database-admin

---

## Key Messages (for any platform)

1. **What it does:** Direct SQL access from OpenCode to MySQL, PostgreSQL, SQL Server, SQLite
2. **Differentiation:** Auto-discovery of connections + configurable consent scopes
3. **Safety:** Write operations require explicit consent; identity is tracked
4. **License:** MIT open source; commercial licensing available

**Do NOT use:**
- Emojis
- "Game changer"
- "Revolutionary"
- "Best ever"
- Sales language
- Exclamation points
- Caps lock
