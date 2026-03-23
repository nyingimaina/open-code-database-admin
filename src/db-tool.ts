import mysql, { ResultSetHeader as MySqlResult } from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import mssql from 'mssql';
import Database from 'better-sqlite3';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { homedir, hostname } from 'os';
import { execSync } from 'child_process';
import { tool } from '@opencode-ai/plugin';

const CONFIG_PATH = `${homedir()}/.config/opencode/db-connections.json`;
const CONSENT_FILE = `${homedir()}/.config/opencode/.db-admin-consent.json`;

// ============ Types ============

interface DbConfig {
  [key: string]: {
    Server?: string;
    Host?: string;
    Database?: string;
    User?: string;
    "User Id"?: string;
    Password?: string;
    Type?: string;
  };
}

type ConsentScope = 'global' | 'project' | 'session' | 'operation';

interface UserIdentity {
  name: string;
  email: string;
  hostname: string;
}

interface ScopeConsent {
  agreed: boolean;
  agreedAt?: string;
  identity?: UserIdentity;
  scope: ConsentScope;
  projectPath?: string;
}

interface ConsentStore {
  global?: ScopeConsent;
  projects: Record<string, ScopeConsent>;
  sessionToken?: string;
  sessionConsent?: ScopeConsent;
  defaultScope: ConsentScope;
}

type DbType = 'mysql' | 'mariadb' | 'postgresql' | 'postgres' | 'sqlserver' | 'mssql' | 'sqlite';

interface ConnectionOptions {
  type: DbType;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  filename?: string;
}

interface ProjectConnection {
  name: string;
  connectionString: string;
  source: string;
  type: DbType;
}

// ============ Identity Discovery ============

function detectUserIdentity(): UserIdentity {
  let name = 'Unknown User';
  let email = 'unknown@unknown.com';
  
  try {
    // Try git config first
    const gitName = execSync('git config user.name', { encoding: 'utf-8', timeout: 3000 }).trim();
    const gitEmail = execSync('git config user.email', { encoding: 'utf-8', timeout: 3000 }).trim();
    if (gitName) name = gitName;
    if (gitEmail) email = gitEmail;
  } catch {
    // Git not configured, use defaults
  }
  
  return {
    name,
    email,
    hostname: hostname()
  };
}

function formatIdentity(identity: UserIdentity): string {
  return `${identity.name} <${identity.email}> (${identity.hostname})`;
}

// ============ Consent Management ============

const LIABILITY_TEXT = `
═══════════════════════════════════════════════════════════════
⚠️⚠️⚠️  IMPORTANT LEGAL DISCLAIMER & LIABILITY WAIVER  ⚠️⚠️⚠️
═══════════════════════════════════════════════════════════════

By executing any write operations (INSERT, UPDATE, DELETE, DROP,
TRUNCATE, ALTER, CREATE TABLE, GRANT, REVOKE, etc.) using this
plugin, you (the "User") acknowledge and agree to the following:

1. IRREVERSIBLE CONSEQUENCES
   - Data loss and corruption can be PERMANENT and IRREVERSIBLE
   - Database failures may occur
   - There is NO UNDO for write operations

2. FULL RESPONSIBILITY
   - YOU bear SOLE RESPONSIBILITY for ALL consequences
   - This includes data loss, corruption, system failures
   - All business risks are yours alone

3. NO LIABILITY TO AUTHOR
   - THE AUTHOR (Nyingi Maina) AND ALL CONTRIBUTORS are
     explicitly DISCLAIMED from ANY and ALL LIABILITY
   - No warranty, express or implied, is provided
   - Plugin is provided "AS IS"

4. YOUR INDEMNIFICATION OBLIGATION
   - You agree to INDEMNIFY and HOLD HARMLESS the author
   - This includes any claims, damages, losses, or expenses
   - arising from your use of this plugin

5. REQUIRED PRECAUTIONS
   - BACKUP your data BEFORE any write operation
   - Test queries in non-production environments first
   - Verify queries before execution

6. MONETIZATION NOTICE
   - This plugin is open source under MIT License
   - You MAY monetize this plugin or services around it
   - But author liability remains DISCLAIMED

═══════════════════════════════════════════════════════════════

USE OF THIS PLUGIN FOR WRITE OPERATIONS IS AT YOUR OWN RISK.

IF YOU DO NOT AGREE TO THESE TERMS, DO NOT GRANT CONSENT
AND DO NOT EXECUTE ANY WRITE OPERATIONS.
═══════════════════════════════════════════════════════════════
`;

function generateSessionToken(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function getConsentStore(): ConsentStore {
  try {
    if (!existsSync(CONSENT_FILE)) {
      return { projects: {}, defaultScope: 'session' };
    }
    const content = readFileSync(CONSENT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { projects: {}, defaultScope: 'session' };
  }
}

function saveConsentStore(store: ConsentStore): void {
  writeFileSync(CONSENT_FILE, JSON.stringify(store, null, 2));
}

function getSessionConsent(store: ConsentStore): ScopeConsent | null {
  if (!store.sessionToken) return null;
  
  // Session consent expires after 24 hours
  if (store.sessionConsent && store.sessionConsent.agreedAt) {
    const agreedAt = new Date(store.sessionConsent.agreedAt);
    const now = new Date();
    const hoursSince = (now.getTime() - agreedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 24) return null; // Expired
    return store.sessionConsent;
  }
  
  return null;
}

function checkWriteConsent(projectPath?: string): { 
  allowed: boolean; 
  message: string;
  scope?: ConsentScope;
  requiresGrant?: boolean;
} {
  const store = getConsentStore();
  
  // Check in order: session -> project -> global
  const sessionConsent = getSessionConsent(store);
  if (sessionConsent?.agreed) {
    return { allowed: true, message: '', scope: 'session' };
  }
  
  if (projectPath && store.projects[projectPath]?.agreed) {
    return { allowed: true, message: '', scope: 'project' };
  }
  
  if (store.global?.agreed) {
    return { allowed: true, message: '', scope: 'global' };
  }
  
  return {
    allowed: false,
    message: LIABILITY_TEXT,
    requiresGrant: true,
    scope: store.defaultScope
  };
}

function grantConsent(
  scope: ConsentScope, 
  projectPath?: string,
  identity?: UserIdentity
): { success: boolean; message: string } {
  const store = getConsentStore();
  const fullIdentity = identity || detectUserIdentity();
  
  const consent: ScopeConsent = {
    agreed: true,
    agreedAt: new Date().toISOString(),
    identity: fullIdentity,
    scope
  };
  
  switch (scope) {
    case 'global':
      store.global = consent;
      break;
    case 'project':
      if (!projectPath) {
        return { success: false, message: 'Project path required for project scope' };
      }
      consent.projectPath = projectPath;
      store.projects[projectPath] = consent;
      break;
    case 'session':
      consent.agreedAt = new Date().toISOString();
      store.sessionToken = generateSessionToken();
      store.sessionConsent = consent;
      break;
    case 'operation':
      // Operation scope is handled differently - requires consent per write
      store.defaultScope = 'operation';
      saveConsentStore(store);
      return { 
        success: true, 
        message: `Operation scope set. Each write will require explicit consent.` 
      };
  }
  
  saveConsentStore(store);
  
  return {
    success: true,
    message: `Consent granted for ${scope} scope. Identity: ${formatIdentity(fullIdentity)}`
  };
}

function revokeConsent(scope?: ConsentScope, projectPath?: string): void {
  const store = getConsentStore();
  
  if (!scope || scope === 'global') {
    store.global = undefined;
  }
  if (!scope && projectPath) {
    delete store.projects[projectPath];
  }
  if (!scope || scope === 'session') {
    store.sessionToken = undefined;
    store.sessionConsent = undefined;
  }
  
  saveConsentStore(store);
}

// ============ Config File Parsing ============

function parseConfig(): DbConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function getConnectionFromConfig(name: string): ConnectionOptions | null {
  const config = parseConfig();
  const conn = config[name];
  
  if (!conn) return null;
  
  const type = (conn.Type?.toLowerCase() || 'mysql') as DbType;
  
  return {
    type,
    host: conn.Server || conn.Host || 'localhost',
    user: conn["User Id"] || conn.User || 'root',
    password: conn.Password || '',
    database: conn.Database || ''
  };
}

// ============ URL Parsing ============

function detectDbType(url: string): DbType {
  if (url.startsWith('mysql://') || url.startsWith('mariadb://')) return 'mysql';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgresql';
  if (url.startsWith('mssql://') || url.startsWith('sqlserver://')) return 'sqlserver';
  if (url.startsWith('sqlite://') || url.startsWith('file:')) return 'sqlite';
  return 'mysql';
}

function parseMysqlUrl(url: string): ConnectionOptions {
  // mysql://user:pass@host:port/db
  const match = url.match(/mysql:\/\/([^:@]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (match) {
    return {
      type: url.startsWith('mariadb') ? 'mariadb' : 'mysql',
      host: match[3],
      port: parseInt(match[4]),
      user: match[1],
      password: match[2],
      database: match[5]
    };
  }
  // mysql://user:pass@host/db
  const match2 = url.match(/mysql:\/\/([^:@]+):([^@]+)@([^/]+)\/(.+)/);
  if (match2) {
    return {
      type: 'mysql',
      host: match2[3],
      user: match2[1],
      password: match2[2],
      database: match2[4]
    };
  }
  return { type: 'mysql' };
}

function parsePgUrl(url: string): ConnectionOptions {
  // postgresql://user:pass@host:port/db
  const match = url.match(/postgresql:\/\/([^:@]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (match) {
    return {
      type: 'postgresql',
      host: match[3],
      port: parseInt(match[4]),
      user: match[1],
      password: match[2],
      database: match[5]
    };
  }
  // postgres://user:pass@host/db
  const match2 = url.match(/postgres:\/\/([^:@]+):([^@]+)@([^/]+)\/(.+)/);
  if (match2) {
    return {
      type: 'postgresql',
      host: match2[3],
      user: match2[1],
      password: match2[2],
      database: match2[4]
    };
  }
  return { type: 'postgresql' };
}

function parseSqlServerUrl(url: string): ConnectionOptions {
  // mssql://user:pass@host:port/db
  const match = url.match(/mssql:\/\/([^:@]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (match) {
    return {
      type: 'sqlserver',
      host: match[3],
      port: parseInt(match[4]),
      user: match[1],
      password: match[2],
      database: match[5]
    };
  }
  // sqlserver://user:pass@host/db
  const match2 = url.match(/sqlserver:\/\/([^:@]+):([^@]+)@([^/]+)\/(.+)/);
  if (match2) {
    return {
      type: 'sqlserver',
      host: match2[3],
      user: match2[1],
      password: match2[2],
      database: match2[4]
    };
  }
  return { type: 'sqlserver' };
}

function parseSqliteUrl(url: string): ConnectionOptions {
  // sqlite://path/to/db.sqlite or file:path/to/db.sqlite
  let filename = url
    .replace(/^sqlite:\/\//, '')
    .replace(/^file:/, '');
  
  return {
    type: 'sqlite',
    filename
  };
}

function parseConnectionString(connStr: string): ConnectionOptions | null {
  const trimmed = connStr.trim().toLowerCase();
  
  if (trimmed.startsWith('mysql://') || trimmed.startsWith('mariadb://')) {
    return parseMysqlUrl(connStr);
  }
  if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) {
    return parsePgUrl(connStr);
  }
  if (trimmed.startsWith('mssql://') || trimmed.startsWith('sqlserver://')) {
    return parseSqlServerUrl(connStr);
  }
  if (trimmed.startsWith('sqlite://') || trimmed.startsWith('file:')) {
    return parseSqliteUrl(connStr);
  }
  
  // Try to detect from format
  if (trimmed.includes('server=') || trimmed.includes('data source=')) {
    // SQL Server format
    const opts: ConnectionOptions = { type: 'sqlserver' };
    const parts = connStr.split(';');
    for (const part of parts) {
      const [key, ...val] = part.split('=');
      const value = val.join('=').trim();
      const k = key.trim().toLowerCase();
      if (k === 'server' || k === 'data source') opts.host = value;
      if (k === 'port') opts.port = parseInt(value);
      if (k === 'database' || k === 'initial catalog') opts.database = value;
      if (k === 'user id' || k === 'uid' || k === 'user') opts.user = value;
      if (k === 'password' || k === 'pwd') opts.password = value;
    }
    return opts;
  }
  
  if (trimmed.includes('host=') || trimmed.includes('database=')) {
    // PostgreSQL format
    const opts: ConnectionOptions = { type: 'postgresql' };
    const parts = connStr.split(';');
    for (const part of parts) {
      const [key, ...val] = part.split('=');
      const value = val.join('=').trim();
      const k = key.trim().toLowerCase();
      if (k === 'host') opts.host = value;
      if (k === 'port') opts.port = parseInt(value);
      if (k === 'database') opts.database = value;
      if (k === 'user') opts.user = value;
      if (k === 'password') opts.password = value;
    }
    return opts;
  }
  
  if (trimmed.includes('server=') && !trimmed.includes('port')) {
    // MySQL format
    const opts: ConnectionOptions = { type: 'mysql' };
    const parts = connStr.split(';');
    for (const part of parts) {
      const [key, ...val] = part.split('=');
      const value = val.join('=').trim();
      const k = key.trim().toLowerCase();
      if (k === 'server' || k === 'host') opts.host = value;
      if (k === 'port') opts.port = parseInt(value);
      if (k === 'database') opts.database = value;
      if (k === 'user id' || k === 'user') opts.user = value;
      if (k === 'password') opts.password = value;
    }
    return opts;
  }
  
  return null;
}

// ============ Project Config Discovery ============

function findDotNetConnection(projectDir: string): ProjectConnection | null {
  const patterns = [
    `${projectDir}/appsettings.json`,
    `${projectDir}/appsettings.Development.json`,
    `${projectDir}/appsettings.Production.json`,
  ];
  
  for (const configPath of patterns) {
    if (!existsSync(configPath)) continue;
    
    try {
      const content = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      const paths = [
        config?.ConnectionStrings?.DefaultConnection,
        config?.ConnectionStrings?.Default,
        config?.ConnectionStrings?.Database,
      ];
      
      for (const connStr of paths) {
        if (typeof connStr !== 'string' || !connStr) continue;
        
        const type: DbType = connStr.includes('Microsoft.Data.SqlClient') || connStr.includes('Server=')
          ? 'sqlserver'
          : connStr.includes('Npgsql')
          ? 'postgresql'
          : 'mysql';
        
        return {
          name: `dotnet-${configPath.split('/').pop()?.replace('.json', '')}`,
          connectionString: connStr,
          source: configPath,
          type
        };
      }
    } catch {
      // Continue
    }
  }
  return null;
}

function findNodeConnection(projectDir: string): ProjectConnection | null {
  const patterns = [
    `${projectDir}/.env`,
    `${projectDir}/.env.local`,
    `${projectDir}/.env.development`,
  ];
  
  for (const envPath of patterns) {
    if (!existsSync(envPath)) continue;
    
    try {
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        const k = key.toUpperCase();
        
        if (k.includes('DATABASE_URL') || k.includes('MYSQL_') || k.includes('MARIADB_')) {
          return {
            name: `node-${key.toLowerCase()}`,
            connectionString: value,
            source: envPath,
            type: detectDbType(value)
          };
        }
      }
    } catch {
      // Continue
    }
  }
  return null;
}

function findPythonConnection(projectDir: string): ProjectConnection | null {
  const patterns = [`${projectDir}/.env`, `${projectDir}/settings.py`];
  
  for (const configPath of patterns) {
    if (!existsSync(configPath)) continue;
    
    try {
      const content = readFileSync(configPath, 'utf-8');
      
      // Look for DATABASE_URL
      const dbUrlMatch = content.match(/DATABASE_URL\s*=\s*['"]([^'"]+)['"]/);
      if (dbUrlMatch) {
        return {
          name: 'python-django',
          connectionString: dbUrlMatch[1],
          source: configPath,
          type: detectDbType(dbUrlMatch[1])
        };
      }
    } catch {
      // Continue
    }
  }
  return null;
}

function findJavaConnection(projectDir: string): ProjectConnection | null {
  const configPath = `${projectDir}/application.properties`;
  if (!existsSync(configPath)) return null;
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    
    // Spring Boot JDBC URL
    const springMatch = content.match(/spring\.datasource\.url\s*=\s*(.+)/);
    if (springMatch) {
      const url = springMatch[1].trim();
      const type: DbType = url.includes('sqlserver') || url.includes('SqlServer')
        ? 'sqlserver'
        : url.includes('postgresql') || url.includes('postgres')
        ? 'postgresql'
        : 'mysql';
      
      return {
        name: 'java-spring',
        connectionString: url,
        source: configPath,
        type
      };
    }
  } catch {
    // Continue
  }
  return null;
}

function discoverProjectConnections(projectDir: string): ProjectConnection[] {
  const connections: ProjectConnection[] = [];
  
  const dotnetConn = findDotNetConnection(projectDir);
  if (dotnetConn) connections.push(dotnetConn);
  
  const nodeConn = findNodeConnection(projectDir);
  if (nodeConn) connections.push(nodeConn);
  
  const pythonConn = findPythonConnection(projectDir);
  if (pythonConn) connections.push(pythonConn);
  
  const javaConn = findJavaConnection(projectDir);
  if (javaConn) connections.push(javaConn);
  
  return connections;
}

// ============ Database Execution ============

async function executeMySql(options: ConnectionOptions, query: string): Promise<any> {
  const conn = await mysql.createConnection({
    host: options.host,
    port: options.port,
    user: options.user,
    password: options.password,
    database: options.database
  });
  
  const trimmed = query.trim().toUpperCase();
  const isRead = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'WITH'].some(kw => trimmed.startsWith(kw));
  
  let result;
  if (isRead) {
    const [rows] = await conn.execute(query);
    result = { rows, count: Array.isArray(rows) ? rows.length : 0 };
  } else {
    const [info] = await conn.execute(query) as unknown as [MySqlResult];
    result = { affected: info?.affectedRows || 0, status: 'success' };
  }
  
  await conn.end();
  return result;
}

async function executePostgres(options: ConnectionOptions, query: string): Promise<any> {
  const client = new PgClient({
    host: options.host,
    port: options.port || 5432,
    user: options.user,
    password: options.password,
    database: options.database
  });
  
  await client.connect();
  
  const trimmed = query.trim().toUpperCase();
  const isRead = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'WITH'].some(kw => trimmed.startsWith(kw));
  
  let result;
  if (isRead) {
    const res = await client.query(query);
    result = { rows: res.rows, count: res.rowCount || res.rows.length };
  } else {
    const res = await client.query(query);
    result = { affected: res.rowCount || 0, status: 'success' };
  }
  
  await client.end();
  return result;
}

async function executeSqlServer(options: ConnectionOptions, query: string): Promise<any> {
  const config: mssql.config = {
    server: options.host || 'localhost',
    port: options.port || 1433,
    user: options.user,
    password: options.password,
    database: options.database,
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  };
  
  const pool = await mssql.connect(config);
  
  const trimmed = query.trim().toUpperCase();
  const isRead = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'WITH'].some(kw => trimmed.startsWith(kw));
  
  let result;
  if (isRead) {
    const recordset = await pool.query(query);
    result = { rows: recordset.recordset, count: recordset.recordset.length };
  } else {
    const info = await pool.query(query);
    result = { affected: info.rowsAffected[0] || 0, status: 'success' };
  }
  
  await pool.close();
  return result;
}

async function executeSqlite(options: ConnectionOptions, query: string): Promise<any> {
  const db = new Database(options.filename || ':memory:');
  
  const trimmed = query.trim().toUpperCase();
  const isRead = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'WITH'].some(kw => trimmed.startsWith(kw));
  
  let result;
  if (isRead) {
    const rows = db.prepare(query).all();
    result = { rows, count: rows.length };
  } else {
    const info = db.prepare(query).run();
    result = { affected: info.changes, status: 'success' };
  }
  
  db.close();
  return result;
}

// ============ Main Tool ============

export default tool({
  description: 'Execute SQL on MySQL, PostgreSQL, SQL Server, SQLite. Use db { "action": "consent" } for write permissions.',
  args: {
    query: tool.schema.string().optional().describe('SQL query to execute'),
    connection: tool.schema.string().optional().describe('Connection name, URL, "discover"'),
    projectDir: tool.schema.string().optional().describe('Project directory to scan'),
    action: tool.schema.string().optional().describe('Action: "consent" to manage permissions'),
    grant: tool.schema.boolean().optional().describe('Grant consent (true/false)'),
    scope: tool.schema.string().optional().describe('Consent scope: "global", "project", "session", "operation"'),
  },
  async execute({ query, connection, projectDir, action, grant, scope }: { 
    query?: string; 
    connection?: string; 
    projectDir?: string;
    action?: string;
    grant?: boolean;
    scope?: string;
  }) {
    const targetDir = projectDir || '.';
    
    // Handle consent action
    if (action === 'consent') {
      const store = getConsentStore();
      const identity = detectUserIdentity();
      
      // Show consent status
      if (grant === undefined) {
        const globalStatus = store.global?.agreed ? 'GRANTED' : 'NOT GRANTED';
        const sessionStatus = getSessionConsent(store)?.agreed ? 'GRANTED' : 'NOT GRANTED';
        
        return JSON.stringify({
          message: 'Write Consent Status',
          currentIdentity: identity,
          globalConsent: {
            status: globalStatus,
            agreedAt: store.global?.agreedAt,
            agreedBy: store.global?.identity ? formatIdentity(store.global.identity) : null
          },
          sessionConsent: {
            status: sessionStatus,
            expiresAt: store.sessionConsent?.agreedAt ? 
              new Date(new Date(store.sessionConsent.agreedAt).getTime() + 24*60*60*1000).toISOString() : null
          },
          defaultScope: store.defaultScope,
          scopes: {
            global: 'All projects, permanent',
            project: 'Specific project, permanent',
            session: 'Current session only, expires in 24h',
            operation: 'Confirm each write query'
          },
          howToGrant: 'db { "action": "consent", "grant": true, "scope": "global|project|session|operation" }',
          howToRevoke: 'db { "action": "consent", "grant": false, "scope": "global|project|session|operation" }',
          liabilityNotice: '⚠️ Granting consent means you accept ALL liability for write operations.'
        }, null, 2);
      }
      
      // Grant consent
      if (grant === true) {
        const consentScope = (scope as ConsentScope) || store.defaultScope;
        const result = grantConsent(consentScope, targetDir, identity);
        
        if (result.success) {
          return JSON.stringify({
            message: '✅ Consent Granted',
            status: 'GRANTED',
            scope: consentScope,
            project: consentScope === 'project' ? targetDir : null,
            identity: identity,
            agreedAt: new Date().toISOString(),
            warning: '⚠️ You accept ALL liability for write operations. Author cannot be held liable.',
            disclaimer: 'See: https://www.npmjs.com/package/database-admin'
          }, null, 2);
        } else {
          return JSON.stringify({ error: result.message });
        }
      }
      
      // Revoke consent
      if (grant === false) {
        revokeConsent(scope as ConsentScope, targetDir);
        return JSON.stringify({
          message: '❌ Consent Revoked',
          status: 'REVOKED',
          scope: scope || 'all',
          warning: 'Write operations are now BLOCKED'
        }, null, 2);
      }
    }
    
    // Handle discover mode
    if (connection === 'discover' || connection === 'list') {
      const discovered = discoverProjectConnections(targetDir);
      
      if (discovered.length === 0) {
        return JSON.stringify({
          message: 'No database connections found',
          supported: ['MySQL', 'MariaDB', 'PostgreSQL', 'SQL Server', 'SQLite'],
          projectDir: targetDir
        }, null, 2);
      }
      
      return JSON.stringify({
        message: `Found ${discovered.length} connection(s)`,
        connections: discovered.map(c => ({
          name: c.name,
          type: c.type,
          source: c.source,
          hint: `Use db { "query": "...", "connection": "${c.name}" }`
        }))
      }, null, 2);
    }
    
    // Validate query
    if (!query) {
      return JSON.stringify({
        error: 'Query is required',
        hint: 'Usage: db { "query": "SELECT * FROM users" }',
        discover: 'Use "connection": "discover" to find project connections',
        supported: ['MySQL', 'MariaDB', 'PostgreSQL', 'SQL Server', 'SQLite']
      });
    }
    
    try {
      let options: ConnectionOptions | null = null;
      let usedName = connection || 'default';
      
      // 1. Parse as URL
      if (connection && !connection.includes('=')) {
        const type = detectDbType(connection);
        if (type === 'mysql' || type === 'mariadb') options = parseMysqlUrl(connection);
        else if (type === 'postgresql' || type === 'postgres') options = parsePgUrl(connection);
        else if (type === 'sqlserver' || type === 'mssql') options = parseSqlServerUrl(connection);
        else if (type === 'sqlite') options = parseSqliteUrl(connection);
      }
      
      // 2. Try named connection from config
      if (!options && connection) {
        options = getConnectionFromConfig(connection);
      }
      
      // 3. Try parsing as raw connection string
      if (!options && connection) {
        options = parseConnectionString(connection);
      }
      
      // 4. Auto-discover from project
      if (!options && !connection) {
        const discovered = discoverProjectConnections(targetDir);
        if (discovered.length > 0) {
          const first = discovered[0];
          options = parseConnectionString(first.connectionString);
          usedName = first.name;
        }
      }
      
      // 5. Fall back to default
      if (!options) {
        options = getConnectionFromConfig('default');
        usedName = 'default';
      }
      
      if (!options) {
        return JSON.stringify({
          error: 'No connection found',
          hint: 'Add connection to ~/.config/opencode/db-connections.json or use database:// URL'
        });
      }
      
      // Check if this is a write query
      const trimmed = query.trim().toUpperCase();
      const isWriteQuery = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'EXECUTE', 'EXEC'].some(
        kw => trimmed.startsWith(kw)
      );
      
      // BLOCK write queries if consent not granted
      if (isWriteQuery) {
        const store = getConsentStore();
        const consent = checkWriteConsent(targetDir);
        
        if (!consent.allowed) {
          return JSON.stringify({
            error: 'WRITE CONSENT REQUIRED',
            blocked: true,
            reason: 'You must grant consent before executing write operations',
            currentScope: store.defaultScope,
            scopeOptions: ['global', 'project', 'session', 'operation'],
            howToGrant: 'db { "action": "consent", "grant": true, "scope": "session" }',
            liabilityNotice: consent.message
          }, null, 2);
        }
        
        // For operation scope, each write requires explicit consent
        if (consent.scope === 'operation') {
          return JSON.stringify({
            error: 'OPERATION-SCOPE: EXPLICIT CONSENT REQUIRED',
            blocked: true,
            query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
            reason: 'Each write operation requires explicit consent when using "operation" scope',
            queryPreview: query,
            howToProceed: 'db { "action": "consent", "grant": true, "scope": "operation" }',
            alternativeScopes: {
              session: 'db { "action": "consent", "grant": true, "scope": "session" } - for this session only',
              project: 'db { "action": "consent", "grant": true, "scope": "project" } - for this project',
              global: 'db { "action": "consent", "grant": true, "scope": "global" } - for all projects'
            }
          }, null, 2);
        }
      }
      
      // Execute based on type
      let result: any;
      switch (options.type) {
        case 'mysql':
        case 'mariadb':
          result = await executeMySql(options, query);
          break;
        case 'postgresql':
        case 'postgres':
          result = await executePostgres(options, query);
          break;
        case 'sqlserver':
        case 'mssql':
          result = await executeSqlServer(options, query);
          break;
        case 'sqlite':
          result = await executeSqlite(options, query);
          break;
        default:
          result = await executeMySql(options, query);
      }
      
      const response: any = {
        connection: usedName,
        type: options.type,
        ...result
      };
      
      // Add warning for write queries
      if (isWriteQuery) {
        response.warning = '⚠️ WRITE QUERY EXECUTED - Data may be modified. USE AT YOUR OWN RISK. Author cannot be held liable for data loss or corruption.';
        response.disclaimer = 'https://www.npmjs.com/package/database-admin';
      }
      
      return JSON.stringify(response, null, 2);
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({ error: message });
    }
  }
});
