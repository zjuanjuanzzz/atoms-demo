/**
 * 本地 hrana v2 协议模拟服务 —— 用来在「本机连不上真 Turso」的环境下验证 turso 驱动。
 *
 * 协议实现与 Turso 官方 /v2/pipeline 对齐：
 *   - Bearer 鉴权（错误 401）
 *   - execute → {sql, args}，args 是 hrana 值对象数组
 *   - 结果 {cols, rows, rowsAffected}；语句错误返回 {type:'error'}
 *   - close 请求返回 {type:'close', response:{}}
 * 引擎直接用 node:sqlite 内存库，保证 SQL 语义与线上一致。
 *
 * 用法: node _turso_mock.mjs [port]   (默认 9901)
 */
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.argv[2] || process.env.MOCK_PORT || 9901);
const TOKEN = process.env.MOCK_TOKEN || 'test-token';
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');

function decodeArg(v) {
  if (!v || v.type === 'null') return null;
  if (v.type === 'blob') return Buffer.from(v.value || '', 'base64');
  return v.value;
}

function encodeVal(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: v } : { type: 'float', value: v };
  if (Buffer.isBuffer(v)) return { type: 'blob', value: v.toString('base64') };
  return { type: 'text', value: String(v) };
}

function executeStmt(stmt) {
  const args = (stmt.args || []).map(decodeArg);
  const prepared = db.prepare(stmt.sql);
  let rows;
  let changes = 0;
  if (stmt.args && stmt.args.length) {
    if (/^\s*(select|pragma|explain)/i.test(stmt.sql)) {
      rows = prepared.all(...args);
    } else {
      const info = prepared.run(...args);
      changes = Number(info.changes || 0);
      rows = [];
    }
  } else if (/^\s*(select|pragma|explain)/i.test(stmt.sql)) {
    rows = prepared.all();
  } else {
    const info = prepared.run();
    changes = Number(info.changes || 0);
    rows = [];
  }
  const cols = rows.length ? Object.keys(rows[0]).map((name) => ({ name })) : [];
  return {
    cols,
    rows: rows.map((row) => Object.values(row).map(encodeVal)),
    rowsAffected: changes,
    lastInsertRowid: null,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/v2/pipeline')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end('{"error":"not found"}');
  }
  const auth = String(req.headers.authorization || '');
  if (auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { 'content-type': 'application/json' });
    return res.end('{"error":"unauthorized"}');
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    return res.end('{"error":"bad json"}');
  }
  const results = [];
  for (const request of body.requests || []) {
    if (request.type === 'execute') {
      try {
        results.push({ type: 'execute', response: { result: executeStmt(request.stmt || {}) } });
      } catch (err) {
        results.push({ type: 'error', error: { message: String(err.message || err) } });
        break; // hrana 语义：出错即中断后续请求
      }
    } else if (request.type === 'close') {
      results.push({ type: 'close', response: {} });
    }
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ results }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`turso-mock listening on http://127.0.0.1:${PORT} (token: ${TOKEN})`);
});