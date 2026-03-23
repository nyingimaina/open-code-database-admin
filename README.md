# database-admin

Global multi-database tool plugin for OpenCode.

> By Nyingi Maina

---

## ⚠️ DISCLAIMER / LIABILITY WAIVER

**USE AT YOUR OWN RISK.**

This plugin executes SQL queries directly against your databases. **IRREVERSIBLE DATA LOSS OR CORRUPTION CAN OCCUR.**

By using this plugin, you acknowledge and agree that:

- **YOU ARE SOLELY RESPONSIBLE** for any data loss, corruption, or damage resulting from use of this plugin
- The author(s) and contributors **CANNOT BE HELD LIABLE** for any data loss, corruption, or damages
- **BACKUP YOUR DATA** before executing any write queries (INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER)
- Always verify queries before execution
- Test in development/staging environments first

**NO WARRANTIES** are provided. This plugin is provided "AS IS".

---

## ⚠️ WRITE CONSENT REQUIRED

**Before executing any write operations (INSERT, UPDATE, DELETE, DROP, etc.), you MUST explicitly grant consent.**

### Grant Consent

```sql
db { "action": "consent", "grant": true }
```

This will display the full liability waiver and enable write operations.

### Check Consent Status

```sql
db { "action": "consent" }
```

### Revoke Consent

```sql
db { "action": "consent", "grant": false }
```

### Why Consent?

Write operations can cause **IRREVERSIBLE DATA LOSS**. The consent mechanism ensures you understand and accept the risks before any writes are executed.

---

## Supported Databases

| Database | Status |
|----------|--------|
| MySQL | ✅ |
| MariaDB | ✅ |
| PostgreSQL | ✅ |
| SQL Server | ✅ |
| SQLite | ✅ |

## Features

- **Auto-Discovery** - Automatically finds connection strings from project configs
- **Multi-Database** - Works with MySQL, PostgreSQL, SQL Server, SQLite
- **Smart Parsing** - Handles various connection string formats
- **Universal** - Works globally across all projects

---

## Quick Start

### Step 1: Install Plugin

Add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugins": ["database-admin"]
}
```

### Step 2: (Optional) Configure Connections

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

### Step 3: Query

```sql
db { "query": "SELECT * FROM users LIMIT 5" }
```

---

## Auto-Discovery

The plugin automatically scans project directories for connection strings:

| Framework | Files Scanned |
|-----------|---------------|
| .NET / ASP.NET Core | `appsettings.json`, `appsettings.Development.json` |
| Node.js | `.env`, `.env.local`, `.env.development` |
| Python / Django / Flask | `.env`, `settings.py` |
| Java / Spring Boot | `application.properties` |

### Discover Available Connections

```sql
db { "connection": "discover" }
```

Returns a list of found connections with hints on how to use them.

---

## Manual Configuration

### MySQL / MariaDB

**File:** `~/.config/opencode/db-connections.json`

```json
{
  "myapp": {
    "Type": "mysql",
    "Server": "localhost",
    "Port": 3306,
    "Database": "mydb",
    "User Id": "root",
    "Password": "secret"
  }
}
```

**Alternative: Key=Value String**

```json
{
  "myapp": {
    "Server=localhost;Database=mydb;User Id=root;Password=secret"
  }
}
```

### PostgreSQL

```json
{
  "myapp": {
    "Type": "postgresql",
    "Host": "localhost",
    "Port": 5432,
    "Database": "mydb",
    "User": "postgres",
    "Password": "secret"
  }
}
```

**Key=Value Format:**

```json
{
  "myapp": {
    "host=localhost;port=5432;database=mydb;user=postgres;password=secret"
  }
}
```

### SQL Server

```json
{
  "myapp": {
    "Type": "sqlserver",
    "Server": "localhost",
    "Port": 1433,
    "Database": "mydb",
    "User Id": "sa",
    "Password": "secret"
  }
}
```

**Key=Value Format:**

```json
{
  "myapp": {
    "Server=localhost;Database=mydb;User Id=sa;Password=secret"
  }
}
```

### SQLite

```json
{
  "myapp": {
    "Type": "sqlite",
    "Database": "/path/to/database.sqlite"
  }
}
```

**Short Format:**

```json
{
  "myapp": {
    "file:///path/to/database.sqlite"
  }
}
```

---

## Usage Examples

### Basic Queries

```sql
-- Query with default connection
db { "query": "SELECT * FROM users LIMIT 5" }

-- Query with specific connection
db { "query": "SELECT * FROM orders", "connection": "myapp" }

-- Insert/Update/Delete
db { "query": "UPDATE items SET price = 99 WHERE id = 1" }
```

### Using URLs

```sql
-- MySQL URL
db { "query": "SELECT * FROM items", "connection": "mysql://root:pass@localhost:3306/mydb" }

-- PostgreSQL URL
db { "query": "SELECT * FROM users", "connection": "postgresql://postgres:pass@localhost:5432/mydb" }

-- SQL Server URL
db { "query": "SELECT * FROM products", "connection": "mssql://sa:pass@localhost:1433/mydb" }

-- SQLite URL
db { "query": "SELECT * FROM todos", "connection": "sqlite:///path/to/db.sqlite" }
```

### Project Directory

```sql
-- Scan specific project
db { "query": "SELECT 1", "projectDir": "/path/to/project" }
```

### Discover Connections

```sql
-- List all auto-discovered connections
db { "connection": "discover" }
```

---

## Connection Priority

1. Explicit `connection` parameter (URL or named)
2. Named connection from `db-connections.json`
3. Auto-discovered from project configs
4. `default` from `db-connections.json`

---

## Framework-Specific Setup

### .NET / ASP.NET Core

**appsettings.json:**

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=mydb;User Id=root;Password=secret"
  }
}
```

The plugin will automatically find this when you run queries in that project.

### Node.js (Next.js, Express, etc.)

**.env:**

```
DATABASE_URL=mysql://root:pass@localhost:3306/mydb
```

Or:

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=mydb
MYSQL_USER=root
MYSQL_PASSWORD=secret
```

### Python (Django, Flask)

**.env:**

```
DATABASE_URL=postgresql://postgres:pass@localhost:5432/mydb
```

**settings.py (Django):**

```python
DATABASE_URL = 'postgresql://postgres:pass@localhost:5432/mydb'
```

### Java / Spring Boot

**application.properties:**

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/mydb
spring.datasource.username=root
spring.datasource.password=secret
```

Or for PostgreSQL:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/mydb
```

---

## For Developers

```bash
# Install dependencies
bun install

# Build
bun run build

# Publish
npm publish --access public
```

---

## Author

Nyingi Maina

---

## License

This project is released under the **MIT License** for open source and personal use.

For **commercial use** within a business environment, a separate commercial license is required. See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for details.

### Commercial Use Includes

- Use within for-profit organizations
- Use in providing commercial services
- Use in SaaS or cloud offerings
- Teams of 6+ developers

Contact for commercial licensing: https://github.com/nyingimaina
