/**
 * 存储层：对外暴露一组统一的异步接口，底层可切换驱动。
 *
 *   sqlite  —— 默认。用 Node 24 自带的 node:sqlite，零第三方依赖，本地/容器直接跑。
 *   turso   —— 云端 SQLite（libSQL，hrana v2 HTTP 协议）。纯 fetch，零依赖，
 *              用来解决免费托管平台「磁盘是临时的」问题：数据落在云数据库里，
 *              服务重启、重新部署、换机器都不丢。
 *   redis   —— Upstash REST。同为纯 HTTP 零依赖，作为另一条云持久化路径。
 *
 * sqlite 与 turso 同属 SQLite 方言，共用一套 SQL 与业务方法（createSqlStore），
 * 只差一个「怎么执行 SQL」的适配器。这里刻意没有引入 ORM：表结构只有 7 张，
 * 用 SQL 直写反而更清楚、更快。
 */

import { randomUUID } from 'node:crypto';

const now = () => Date.now();
export const newId = (prefix) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

/* -------------------------------------------------------------------------- */
/*                                  表结构                                     */
/* -------------------------------------------------------------------------- */

/** 建表语句按条拆开：sqlite 可以整段 exec，turso 需要逐条走 HTTP。 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT,
    salt          TEXT,
    is_guest      INTEGER NOT NULL DEFAULT 0,
    workspace_id  TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id                 TEXT PRIMARY KEY,
    workspace_id       TEXT NOT NULL,
    title              TEXT NOT NULL,
    prompt             TEXT,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL,
    current_version_id TEXT,
    published          INTEGER NOT NULL DEFAULT 0,
    slug               TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    meta       TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS versions (
    id         TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title      TEXT NOT NULL,
    note       TEXT,
    prompt     TEXT,
    html       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_data (
    app_id     TEXT NOT NULL,
    collection TEXT NOT NULL,
    doc_id     TEXT NOT NULL,
    doc        TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (app_id, collection, doc_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_projects_ws ON projects(workspace_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_pid ON messages(project_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_versions_pid ON versions(project_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_app_data ON app_data(app_id, collection, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug)`,
];

/** 轻量迁移：老库补列。失败（列已存在/索引已存在）直接忽略。 */
const MIGRATIONS = [
  'ALTER TABLE projects ADD COLUMN slug TEXT',
];

/* -------------------------------------------------------------------------- */
/*                          SQLite 适配器（node:sqlite）                        */
/* -------------------------------------------------------------------------- */

async function createSqliteAdapter({ file }) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = await import('node:sqlite'));
  } catch (err) {
    throw new Error(
      '无法加载 node:sqlite。请使用 Node 24+（内置即可用），'
      + 'Node 22.5–23 需要加 --experimental-sqlite 参数启动，'
      + '或者改用 STORAGE=turso / STORAGE=redis 走云存储。原始错误：' + err.message,
    );
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA.join(';\n') + ';');
  for (const sql of MIGRATIONS) {
    try { db.exec(sql); } catch { /* 已存在 */ }
  }

  return {
    driver: 'sqlite',
    one: (sql, ...args) => db.prepare(sql).get(...args) ?? null,
    many: (sql, ...args) => db.prepare(sql).all(...args),
    run: (sql, ...args) => db.prepare(sql).run(...args),
    async close() { db.close(); },
  };
}

/* -------------------------------------------------------------------------- */
/*                    Turso 适配器（libSQL hrana v2 HTTP，零依赖）               */
/* -------------------------------------------------------------------------- */

/** hrana v2 的值编码：JS 值 → {type, value} */
function hranaArg(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? 1 : 0 };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { type: 'integer', value: v } : { type: 'float', value: v };
  }
  if (Buffer.isBuffer(v)) return { type: 'blob', value: v.toString('base64') };
  return { type: 'text', value: String(v) };
}

/** hrana v2 的行值解码：{type, value} → JS 值 */
function hranaValue(v) {
  if (!v || v.type === 'null') return null;
  if (v.type === 'blob') return Buffer.from(v.value || '', 'base64');
  return v.value;
}

/**
 * libsql://… 与 https://… 指向同一个服务：HTTP 接口就是 libsql:// 的 https 形态，
 * 两种写法都接受，省得用户纠结该填哪种。
 */
function tursoEndpoint(url) {
  return String(url)
    .replace(/^libsql:\/\//, 'https://')
    .replace(/^wss?:\/\//, 'https://')
    .replace(/\/+$/, '');
}

async function createTursoAdapter({ url, token }) {
  const endpoint = tursoEndpoint(url);
  if (!/^https?:\/\//.test(endpoint)) throw new Error(`TURSO_DATABASE_URL 无法识别：${url}`);

  /**
   * 执行一批语句（hrana v2 pipeline）。
   * 网络抖动时重试一次；语句错误以 {type:'error'} 出现在 results 里，抛出可读信息。
   */
  async function pipeline(statements) {
    const body = JSON.stringify({
      requests: [...statements.map((stmt) => ({ type: 'execute', stmt })), { type: 'close' }],
    });
    let json;
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${endpoint}/v2/pipeline`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body,
          signal: AbortSignal.timeout(15000),
        });
        json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`turso HTTP ${res.status}：${String(json.error || res.statusText).slice(0, 200)}`);
        break;
      } catch (err) {
        lastErr = err;
        json = null;
        if (attempt === 0) continue; // 网络抖动重试一次
        throw new Error(`无法连接 Turso（${endpoint}）：${err.message}`);
      }
    }
    const results = (json && json.results) || [];
    const out = [];
    for (const r of results) {
      if (r.type === 'error') throw new Error(`turso：${r.error?.message || '语句执行失败'}`);
      if (r.type === 'execute') out.push(r.response?.result ?? null);
    }
    return out;
  }

  const execOne = async (sql, args = []) => (await pipeline([{ sql, args }]))[0];

  /** SELECT 结果 → [{列名: 值}]，与 node:sqlite 的行对象形态对齐 */
  function toRows(result) {
    if (!result) return [];
    const cols = (result.cols || []).map((c) => c.name);
    return (result.rows || []).map((row) => {
      const obj = {};
      cols.forEach((name, i) => { obj[name] = hranaValue(row[i]); });
      return obj;
    });
  }

  // 初始化：建表 + 轻量迁移。这里连不上会直接抛错，由调用方决定是否回退。
  for (const sql of SCHEMA) await execOne(sql);
  for (const sql of MIGRATIONS) {
    try { await execOne(sql); } catch { /* 已存在 */ }
  }

  return {
    driver: 'turso',
    async one(sql, ...args) {
      const [result] = await pipeline([{ sql, args: args.map(hranaArg) }]);
      return toRows(result)[0] ?? null;
    },
    async many(sql, ...args) {
      const [result] = await pipeline([{ sql, args: args.map(hranaArg) }]);
      return toRows(result);
    },
    async run(sql, ...args) {
      const [result] = await pipeline([{ sql, args: args.map(hranaArg) }]);
      return { changes: result?.rowsAffected ?? 0 };
    },
    async close() { /* HTTP 无连接需要关闭 */ },
  };
}

/* -------------------------------------------------------------------------- */
/*                共享业务方法（sqlite / turso 两个适配器通用）                  */
/* -------------------------------------------------------------------------- */

function createSqlStore(adapter) {
  const { one, many, run } = adapter;

  const mapProject = (r) =>
    r && {
      id: r.id,
      workspaceId: r.workspace_id,
      title: r.title,
      prompt: r.prompt,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      currentVersionId: r.current_version_id,
      published: !!r.published,
      slug: r.slug,
    };
  const mapVersion = (r) =>
    r && {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      note: r.note,
      prompt: r.prompt,
      html: r.html,
      createdAt: Number(r.created_at),
    };
  const mapUser = (r) =>
    r && {
      id: r.id,
      email: r.email,
      name: r.name,
      isGuest: !!r.is_guest,
      workspaceId: r.workspace_id,
      createdAt: Number(r.created_at),
    };

  return {
    driver: adapter.driver,
    /* ---- 账号与会话 ---- */
    async createUser({ email, name, passwordHash, salt, isGuest }) {
      const id = newId('user');
      const workspaceId = `ws_${id.replace('user_', '')}`;
      await run(
        'INSERT INTO users (id, email, name, password_hash, salt, is_guest, workspace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id, email, name, passwordHash ?? null, salt ?? null, isGuest ? 1 : 0, workspaceId, now(),
      );
      await run('INSERT OR IGNORE INTO workspaces (id, name, created_at) VALUES (?, ?, ?)', workspaceId, name, now());
      return mapUser(await one('SELECT * FROM users WHERE id = ?', id));
    },
    async getUserByEmail(email) {
      const row = await one('SELECT * FROM users WHERE email = ?', email);
      if (!row) return null;
      return { ...mapUser(row), passwordHash: row.password_hash, salt: row.salt };
    },
    async getUserById(id) {
      return mapUser(await one('SELECT * FROM users WHERE id = ?', id));
    },
    async updateUserName(id, name) {
      await run('UPDATE users SET name = ? WHERE id = ?', name, id);
      const user = mapUser(await one('SELECT * FROM users WHERE id = ?', id));
      if (user) await run('UPDATE workspaces SET name = ? WHERE id = ?', name, user.workspaceId);
      return user;
    },
    async createSession({ userId, ttlMs }) {
      const token = newId('sess') + newId('').replace('_', '');
      const t = now();
      await run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', token, userId, t, t + ttlMs);
      return token;
    },
    async getSessionUser(token) {
      if (!token) return null;
      const row = await one(
        'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?',
        token, now(),
      );
      return mapUser(row);
    },
    async deleteSession(token) {
      if (token) await run('DELETE FROM sessions WHERE token = ?', token);
      return true;
    },
    async ensureWorkspace({ id, name }) {
      const existing = await one('SELECT * FROM workspaces WHERE id = ?', id);
      if (existing) return { id: existing.id, name: existing.name };
      await run('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)', id, name, now());
      return { id, name };
    },
    async listProjects(workspaceId) {
      return (await many('SELECT * FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC', workspaceId)).map(mapProject);
    },
    async getProject(id) {
      return mapProject(await one('SELECT * FROM projects WHERE id = ?', id));
    },
    async createProject({ workspaceId, title, prompt }) {
      const t = now();
      const id = newId('proj');
      await run(
        'INSERT INTO projects (id, workspace_id, title, prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        id, workspaceId, title, prompt ?? null, t, t,
      );
      return mapProject(await one('SELECT * FROM projects WHERE id = ?', id));
    },
    async updateProject(id, patch) {
      const cur = await one('SELECT * FROM projects WHERE id = ?', id);
      if (!cur) return null;
      await run(
        'UPDATE projects SET title = ?, current_version_id = ?, published = ?, slug = ?, updated_at = ? WHERE id = ?',
        patch.title ?? cur.title,
        patch.currentVersionId ?? cur.current_version_id,
        patch.published === undefined ? cur.published : patch.published ? 1 : 0,
        patch.slug ?? cur.slug,
        now(),
        id,
      );
      return mapProject(await one('SELECT * FROM projects WHERE id = ?', id));
    },
    async getProjectBySlug(slug) {
      return mapProject(await one('SELECT * FROM projects WHERE slug = ? AND published = 1', slug));
    },
    async deleteProject(id) {
      await run('DELETE FROM messages WHERE project_id = ?', id);
      await run('DELETE FROM versions WHERE project_id = ?', id);
      await run('DELETE FROM app_data WHERE app_id = ?', id);
      await run('DELETE FROM projects WHERE id = ?', id);
      return true;
    },
    async addMessage({ projectId, role, content, meta }) {
      const id = newId('msg');
      await run(
        'INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        id, projectId, role, content, meta ? JSON.stringify(meta) : null, now(),
      );
      return { id, projectId, role, content, meta: meta ?? null, createdAt: now() };
    },
    async listMessages(projectId) {
      return (await many('SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC', projectId)).map((r) => ({
        id: r.id,
        projectId: r.project_id,
        role: r.role,
        content: r.content,
        meta: r.meta ? JSON.parse(r.meta) : null,
        createdAt: Number(r.created_at),
      }));
    },
    async addVersion({ projectId, title, note, prompt, html }) {
      const id = newId('ver');
      await run(
        'INSERT INTO versions (id, project_id, title, note, prompt, html, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id, projectId, title ?? '未命名应用', note ?? null, prompt ?? null, html, now(),
      );
      await run('UPDATE projects SET current_version_id = ?, updated_at = ? WHERE id = ?', id, now(), projectId);
      return mapVersion(await one('SELECT * FROM versions WHERE id = ?', id));
    },
    async listVersions(projectId) {
      return (await many(
        'SELECT id, project_id, title, note, prompt, created_at, LENGTH(html) AS size FROM versions WHERE project_id = ? ORDER BY created_at DESC',
        projectId,
      )).map((r) => ({
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        note: r.note,
        prompt: r.prompt,
        size: Number(r.size),
        createdAt: Number(r.created_at),
      }));
    },
    async getVersion(id) {
      return mapVersion(await one('SELECT * FROM versions WHERE id = ?', id));
    },
    async getVersionInProject(projectId, versionId) {
      return mapVersion(await one('SELECT * FROM versions WHERE id = ? AND project_id = ?', versionId, projectId));
    },
    async getLatestVersion(projectId) {
      return mapVersion(await one('SELECT * FROM versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1', projectId));
    },
    /* ---- 生成物自己写入的业务数据 ---- */
    async dataList(appId, collection, { limit = 500 } = {}) {
      return (await many(
        'SELECT doc FROM app_data WHERE app_id = ? AND collection = ? ORDER BY created_at DESC LIMIT ?',
        appId, collection, limit,
      )).map((r) => JSON.parse(r.doc));
    },
    async dataInsert(appId, collection, doc) {
      const record = { ...doc, id: doc?.id || newId('row'), createdAt: new Date().toISOString() };
      const t = now();
      await run(
        'INSERT OR REPLACE INTO app_data (app_id, collection, doc_id, doc, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        appId, collection, record.id, JSON.stringify(record), t, t,
      );
      return record;
    },
    async dataUpdate(appId, collection, id, patch) {
      const row = await one('SELECT doc FROM app_data WHERE app_id = ? AND collection = ? AND doc_id = ?', appId, collection, id);
      if (!row) return null;
      const record = { ...JSON.parse(row.doc), ...patch, id };
      await run(
        'UPDATE app_data SET doc = ?, updated_at = ? WHERE app_id = ? AND collection = ? AND doc_id = ?',
        JSON.stringify(record), now(), appId, collection, id,
      );
      return record;
    },
    async dataRemove(appId, collection, id) {
      await run('DELETE FROM app_data WHERE app_id = ? AND collection = ? AND doc_id = ?', appId, collection, id);
      return true;
    },
    async dataClear(appId, collection) {
      await run('DELETE FROM app_data WHERE app_id = ? AND collection = ?', appId, collection);
      return true;
    },
    async dataStats(appId) {
      return (await many(
        'SELECT collection, COUNT(*) AS n FROM app_data WHERE app_id = ? GROUP BY collection',
        appId,
      )).map((r) => ({ collection: r.collection, count: Number(r.n) }));
    },
    /* ---- 平台自身配置（模型接口、Key 等） ---- */
    async getConfig() {
      const out = {};
      for (const row of await many('SELECT key, value FROM settings')) {
        try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
      }
      return out;
    },
    async saveConfig(patch) {
      const t = now();
      for (const [key, value] of Object.entries(patch)) {
        await run(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) '
          + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          key, JSON.stringify(value), t,
        );
      }
      return this.getConfig();
    },
    async close() { await adapter.close(); },
  };
}

/* -------------------------------------------------------------------------- */
/*                          Upstash Redis (REST, 零依赖)                       */
/* -------------------------------------------------------------------------- */

function createRedisStore({ url, token }) {
  async function cmd(...args) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args.map((a) => (a === undefined ? null : a))),
    });
    if (!res.ok) throw new Error(`redis ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.error) throw new Error(`redis: ${json.error}`);
    return json.result;
  }
  const getJson = async (key) => {
    const raw = await cmd('GET', key);
    return raw ? JSON.parse(raw) : null;
  };
  const setJson = (key, value) => cmd('SET', key, JSON.stringify(value));
  const pKey = (id) => `atoms:proj:${id}`;
  const mKey = (id) => `atoms:msg:${id}`;
  const vKey = (projectId, versionId) => `atoms:ver:${projectId}:${versionId}`;

  return {
    driver: 'redis',
    /* ---- 账号与会话 ---- */
    async createUser({ email, name, passwordHash, salt, isGuest }) {
      const id = newId('user');
      const record = {
        id,
        email,
        name,
        passwordHash: passwordHash ?? null,
        salt: salt ?? null,
        isGuest: Boolean(isGuest),
        workspaceId: `ws_${id.replace('user_', '')}`,
        createdAt: now(),
      };
      await setJson(`atoms:user:${id}`, record);
      await cmd('SET', `atoms:email:${email}`, id);
      return record;
    },
    async getUserByEmail(email) {
      const id = await cmd('GET', `atoms:email:${email}`);
      return id ? getJson(`atoms:user:${id}`) : null;
    },
    async getUserById(id) {
      return getJson(`atoms:user:${id}`);
    },
    async updateUserName(id, name) {
      const user = await getJson(`atoms:user:${id}`);
      if (!user) return null;
      const next = { ...user, name };
      await setJson(`atoms:user:${id}`, next);
      return next;
    },
    async createSession({ userId, ttlMs }) {
      const token = `${newId('sess')}${Math.random().toString(36).slice(2, 10)}`;
      await setJson(`atoms:sess:${token}`, { userId, expiresAt: now() + ttlMs });
      return token;
    },
    async getSessionUser(token) {
      if (!token) return null;
      const session = await getJson(`atoms:sess:${token}`);
      if (!session || session.expiresAt < now()) return null;
      return getJson(`atoms:user:${session.userId}`);
    },
    async deleteSession(token) {
      if (token) await cmd('DEL', `atoms:sess:${token}`);
      return true;
    },
    async ensureWorkspace({ id, name }) {
      const key = `atoms:ws:${id}`;
      const existing = await getJson(key);
      if (existing) return existing;
      const record = { id, name, createdAt: now() };
      await setJson(key, record);
      return record;
    },
    async listProjects(workspaceId) {
      const ids = (await cmd('LRANGE', `atoms:wsp:${workspaceId}`, 0, -1)) || [];
      const rows = await Promise.all(ids.map((id) => getJson(pKey(id))));
      return rows.filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async getProject(id) { return getJson(pKey(id)); },
    async getProjectBySlug(slug) {
      const id = await cmd('GET', `atoms:slug:${slug}`);
      if (!id) return null;
      const proj = await getJson(pKey(id));
      return proj && proj.published ? proj : null;
    },
    async createProject({ workspaceId, title, prompt }) {
      const id = newId('proj');
      const record = {
        id, workspaceId, title, prompt: prompt ?? null,
        createdAt: now(), updatedAt: now(), currentVersionId: null, published: false,
      };
      await setJson(pKey(id), record);
      await cmd('LPUSH', `atoms:wsp:${workspaceId}`, id);
      return record;
    },
    async updateProject(id, patch) {
      const cur = await getJson(pKey(id));
      if (!cur) return null;
      const next = { ...cur, ...patch, updatedAt: now() };
      await setJson(pKey(id), next);
      // 维护 slug 索引，避免用 KEYS 做全库扫描
      if (cur.slug && (cur.slug !== next.slug || !next.published)) {
        await cmd('DEL', `atoms:slug:${cur.slug}`);
      }
      if (next.slug && next.published) {
        await cmd('SET', `atoms:slug:${next.slug}`, id);
      }
      return next;
    },
    async deleteProject(id) {
      const versionIds = (await cmd('LRANGE', `atoms:verlist:${id}`, 0, -1)) || [];
      const proj = await getJson(pKey(id));
      if (versionIds.length) await cmd('DEL', ...versionIds.map((v) => vKey(id, v)));
      await cmd('DEL', pKey(id), mKey(id), `atoms:verlist:${id}`);
      if (proj) await cmd('LREM', `atoms:wsp:${proj.workspaceId}`, 0, id);
      return true;
    },
    async addMessage({ projectId, role, content, meta }) {
      const record = { id: newId('msg'), projectId, role, content, meta: meta ?? null, createdAt: now() };
      await cmd('RPUSH', mKey(projectId), JSON.stringify(record));
      return record;
    },
    async listMessages(projectId) {
      const rows = (await cmd('LRANGE', mKey(projectId), 0, -1)) || [];
      return rows.map((r) => JSON.parse(r));
    },
    async addVersion({ projectId, title, note, prompt, html }) {
      const id = newId('ver');
      const meta = { id, projectId, title: title ?? '未命名应用', note: note ?? null, prompt: prompt ?? null, createdAt: now() };
      await cmd('SET', vKey(projectId, id), JSON.stringify({ ...meta, html }));
      await cmd('LPUSH', `atoms:verlist:${projectId}`, id);
      const proj = await getJson(pKey(projectId));
      if (proj) await setJson(pKey(projectId), { ...proj, currentVersionId: id, updatedAt: now() });
      return { ...meta, html };
    },
    async listVersions(projectId) {
      const ids = (await cmd('LRANGE', `atoms:verlist:${projectId}`, 0, -1)) || [];
      const rows = await Promise.all(ids.map((v) => getJson(vKey(projectId, v))));
      return rows.filter(Boolean).map(({ html, ...meta }) => ({ ...meta, size: (html || '').length }));
    },
    async getVersion(id) {
      // Redis 驱动下按 id 反查成本高，调用方应带 projectId
      return null;
    },
    async getVersionInProject(projectId, versionId) {
      return getJson(vKey(projectId, versionId));
    },
    async getLatestVersion(projectId) {
      const ids = (await cmd('LRANGE', `atoms:verlist:${projectId}`, 0, 0)) || [];
      if (!ids.length) return null;
      return getJson(vKey(projectId, ids[0]));
    },
    async dataList(appId, collection, { limit = 500 } = {}) {
      const flat = (await cmd('HGETALL', `atoms:data:${appId}:${collection}`)) || [];
      const out = [];
      for (let i = 0; i < flat.length; i += 2) {
        try { out.push(JSON.parse(flat[i + 1])); } catch { /* 忽略脏数据 */ }
      }
      return out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, limit);
    },
    async dataInsert(appId, collection, doc) {
      const record = { ...doc, id: doc?.id || newId('row'), createdAt: new Date().toISOString() };
      await cmd('HSET', `atoms:data:${appId}:${collection}`, record.id, JSON.stringify(record));
      return record;
    },
    async dataUpdate(appId, collection, id, patch) {
      const raw = await cmd('HGET', `atoms:data:${appId}:${collection}`, id);
      if (!raw) return null;
      const record = { ...JSON.parse(raw), ...patch, id };
      await cmd('HSET', `atoms:data:${appId}:${collection}`, id, JSON.stringify(record));
      return record;
    },
    async dataRemove(appId, collection, id) {
      await cmd('HDEL', `atoms:data:${appId}:${collection}`, id);
      return true;
    },
    async dataClear(appId, collection) {
      await cmd('DEL', `atoms:data:${appId}:${collection}`);
      return true;
    },
    async dataStats(appId) {
      // Redis 没有跨 hash 的计数命令，这里用一个索引集合维护集合名
      const names = (await cmd('SMEMBERS', `atoms:collections:${appId}`)) || [];
      const out = [];
      for (const collection of names) {
        const n = await cmd('HLEN', `atoms:data:${appId}:${collection}`);
        out.push({ collection, count: Number(n) || 0 });
      }
      return out;
    },
    async getConfig() {
      return (await getJson('atoms:settings')) || {};
    },
    async saveConfig(patch) {
      const next = { ...(await this.getConfig()), ...patch };
      await setJson('atoms:settings', next);
      return next;
    },
    async touchCollection(appId, collection) {
      await cmd('SADD', `atoms:collections:${appId}`, collection);
    },
    async close() {},
  };
}

/* -------------------------------------------------------------------------- */
/*                                  工厂                                      */
/* -------------------------------------------------------------------------- */

export async function createStore(config) {
  if (config.driver === 'redis') {
    if (!config.url || !config.token) {
      throw new Error('STORAGE=redis 需要同时提供 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN');
    }
    const store = createRedisStore({ url: config.url, token: config.token });
    // 包装一下：Redis 驱动维护「集合名索引」，用于数据统计面板
    const rawInsert = store.dataInsert.bind(store);
    store.dataInsert = async (appId, collection, doc) => {
      await store.touchCollection(appId, collection);
      return rawInsert(appId, collection, doc);
    };
    return store;
  }
  if (config.driver === 'turso') {
    if (!config.url || !config.token) {
      throw new Error('STORAGE=turso 需要同时提供 TURSO_DATABASE_URL 与 TURSO_AUTH_TOKEN');
    }
    return createSqlStore(await createTursoAdapter({ url: config.url, token: config.token }));
  }
  return createSqlStore(await createSqliteAdapter({ file: config.file }));
}