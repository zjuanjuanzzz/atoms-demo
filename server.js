/**
 * Atoms Demo 服务端。
 *
 * 零第三方依赖：HTTP 用 node:http，存储用 node:sqlite（或 Upstash REST），
 * 模型调用用内置 fetch。目标是「clone 下来 node server.js 就能跑」。
 */

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createStore } from './src/store.js';
import { createLLM, normalizeBaseUrl } from './src/llm.js';
import { runPipeline, repairFromRuntimeError } from './src/agent.js';
import { injectSdk } from './src/runtime.js';
import { renderSharePage } from './src/share.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

/* --------------------------------- 环境 --------------------------------- */

function loadEnvFile() {
  const file = path.join(__dirname, '.env');
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

// 不引入 dotenv：自己解析 .env，保持零依赖
loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
mkdirSync(DATA_DIR, { recursive: true });

const store = await createStore({
  driver: process.env.STORAGE === 'redis' ? 'redis' : 'sqlite',
  file: path.join(DATA_DIR, 'atoms.db'),
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** 环境变量里的模型配置，作为「界面没配」时的兜底 */
const ENV_LLM = {
  apiKey: (process.env.LLM_API_KEY || '').trim(),
  baseUrl: (process.env.LLM_BASE_URL || '').trim(),
  model: (process.env.LLM_MODEL || '').trim(),
};

/**
 * 解析当前生效的模型配置，优先级：请求里的临时覆盖 > 界面中保存的配置 > 环境变量 > 默认值。
 *
 * API Key 只保留在服务端：读取接口永远只返回掩码，任何情况下都不回传原文。
 */
async function resolveLLM(override = null) {
  const saved = await store.getConfig();
  const pick = (key) => (override && override[key]) || saved[key] || ENV_LLM[key] || '';
  const apiKey = String(pick('apiKey')).trim();
  const llm = createLLM({
    apiKey,
    baseUrl: pick('baseUrl') || undefined,
    model: pick('model') || undefined,
  });
  const source = !apiKey ? 'none' : (saved.apiKey ? 'ui' : (ENV_LLM.apiKey ? 'env' : 'none'));
  return { llm, source, apiKey };
}

/** 只回显首尾，避免 Key 泄露到浏览器 */
function maskKey(key) {
  if (!key) return '';
  if (key.length <= 10) return `${key.slice(0, 2)}****`;
  return `${key.slice(0, 5)}····${key.slice(-4)}`;
}

/* ------------------------------- HTTP 工具 ------------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', ...extra });
  res.end(text);
}

async function readBody(req, limit = 4_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('请求体过大');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); } catch { return {}; }
}

/* ------------------------------ 账号与会话 ------------------------------ */

const SESSION_COOKIE = 'atoms_session';
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 天

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function sessionCookie(token, req, maxAgeSeconds) {
  const secure = String(req.headers['x-forwarded-proto'] || '').includes('https');
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

/** 用户密码用 scrypt 加盐哈希，数据库里不存明文 */
function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const user = await store.getSessionUser(token);
  return user ? { ...user, sessionToken: token } : null;
}

async function startSession(res, req, userId) {
  const token = await store.createSession({ userId, ttlMs: SESSION_TTL_MS });
  return { token, header: sessionCookie(token, req, Math.floor(SESSION_TTL_MS / 1000)) };
}

/** 对外返回的用户结构：永远不带密码字段 */
function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest, workspaceId: user.workspaceId };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function serveStatic(res, urlPath) {
  const safe = path.normalize(urlPath).replace(/^([/\\])+/, '');
  const target = path.join(PUBLIC_DIR, safe);
  if (!target.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'forbidden');
  try {
    const body = await readFile(target);
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    sendText(res, 404, 'not found');
  }
}

/* -------------------------------- 路由表 -------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method || 'GET';
  const user = await currentUser(req);
  const workspace = user ? user.workspaceId : null;
  const needLogin = () => sendJson(res, 401, { error: '请先登录' });

  try {
    /* ---- 静态资源 ---- */
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      return serveStatic(res, 'index.html');
    }
    if (method === 'GET' && pathname.startsWith('/assets/')) {
      return serveStatic(res, pathname.slice('/assets/'.length));
    }
    if (method === 'GET' && pathname === '/favicon.ico') {
      return sendText(res, 204, '');
    }

    /* ---- 健康检查 ---- */
    if (method === 'GET' && pathname === '/api/health') {
      const { llm, source } = await resolveLLM();
      return sendJson(res, 200, {
        ok: true,
        storage: store.driver,
        llm: llm.mode,
        model: llm.model,
        keySource: source,
      });
    }

    /* ---- 注册 / 登录 / 退出 / 个人资料 ---- */
    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim().slice(0, 30) || email.split('@')[0];
      if (!EMAIL_RE.test(email)) return sendJson(res, 400, { error: '请输入正确的邮箱地址' });
      if (password.length < 6) return sendJson(res, 400, { error: '密码至少 6 位' });
      if (await store.getUserByEmail(email)) {
        return sendJson(res, 409, { error: '这个邮箱已经注册过了，直接登录即可' });
      }
      const { salt, hash } = hashPassword(password);
      const created = await store.createUser({ email, name, passwordHash: hash, salt, isGuest: false });
      const session = await startSession(res, req, created.id);
      return sendJson(res, 200, { user: publicUser(created) }, { 'set-cookie': session.header });
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const found = await store.getUserByEmail(email);
      if (!found || !verifyPassword(String(body.password || ''), found.salt, found.passwordHash)) {
        return sendJson(res, 401, { error: '邮箱或密码不正确' });
      }
      const session = await startSession(res, req, found.id);
      return sendJson(res, 200, { user: publicUser(found) }, { 'set-cookie': session.header });
    }

    if (method === 'POST' && pathname === '/api/auth/guest') {
      // 一键体验：自动建一个游客账号，避免评审被注册表单挡在门外
      const email = `guest_${randomBytes(4).toString('hex')}@guest.local`;
      const { salt, hash } = hashPassword(randomBytes(8).toString('hex'));
      const created = await store.createUser({ email, name: '体验用户', passwordHash: hash, salt, isGuest: true });
      const session = await startSession(res, req, created.id);
      return sendJson(res, 200, { user: publicUser(created) }, { 'set-cookie': session.header });
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      if (user) await store.deleteSession(user.sessionToken);
      return sendJson(res, 200, { ok: true }, { 'set-cookie': sessionCookie('', req, 0) });
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      return sendJson(res, 200, { user: user ? publicUser(user) : null });
    }

    if (method === 'PATCH' && pathname === '/api/auth/profile') {
      if (!user) return needLogin();
      const body = await readBody(req);
      const name = String(body.name || '').trim().slice(0, 30);
      if (!name) return sendJson(res, 400, { error: '名称不能为空' });
      const updated = await store.updateUserName(user.id, name);
      return sendJson(res, 200, { user: publicUser(updated) });
    }

    /* ---- 模型配置（界面内配置 API Key，需登录） ---- */
    if (method === 'GET' && pathname === '/api/settings') {
      if (!user) return needLogin();
      const saved = await store.getConfig();
      const { apiKey, source } = await resolveLLM();
      return sendJson(res, 200, {
        baseUrl: normalizeBaseUrl(saved.baseUrl || ENV_LLM.baseUrl) || 'https://api.openai.com/v1',
        model: saved.model || ENV_LLM.model || 'gpt-4o-mini',
        hasKey: Boolean(apiKey),
        maskedKey: maskKey(apiKey),
        source,
        envKeyPresent: Boolean(ENV_LLM.apiKey),
      });
    }

    if (method === 'POST' && pathname === '/api/settings') {
      if (!user) return needLogin();
      const body = await readBody(req);
      const patch = {};
      if (body.clearKey) patch.apiKey = '';
      else if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim();
      if (typeof body.baseUrl === 'string') patch.baseUrl = normalizeBaseUrl(body.baseUrl);
      if (typeof body.model === 'string') patch.model = body.model.trim();
      await store.saveConfig(patch);
      const { llm, source } = await resolveLLM();
      return sendJson(res, 200, {
        ok: true,
        llm: llm.mode,
        model: llm.model,
        source,
        baseUrl: patch.baseUrl ?? '',
        corrected: typeof body.baseUrl === 'string' && patch.baseUrl !== body.baseUrl.trim(),
      });
    }

    if (method === 'POST' && pathname === '/api/settings/test') {
      if (!user) return needLogin();
      const body = await readBody(req);
      const { llm } = await resolveLLM({
        apiKey: typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : null,
        baseUrl: typeof body.baseUrl === 'string' && body.baseUrl.trim() ? body.baseUrl.trim() : null,
        model: typeof body.model === 'string' && body.model.trim() ? body.model.trim() : null,
      });
      if (llm.mode === 'mock') return sendJson(res, 200, { ok: false, error: '还没有填写 API Key' });
      try {
        const reply = await llm.chat({
          messages: [{ role: 'user', content: '只回复两个字：可用' }],
          maxTokens: 16,
          signal: AbortSignal.timeout(25000),
        });
        return sendJson(res, 200, {
          ok: true,
          model: llm.model,
          baseUrl: llm.baseUrl,
          reply: String(reply).trim().slice(0, 60),
        });
      } catch (err) {
        return sendJson(res, 200, {
          ok: false,
          baseUrl: llm.baseUrl,
          error: String(err.message || err).slice(0, 300),
        });
      }
    }

    /* ---- 项目列表 / 新建（项目归属当前登录用户的工作区） ---- */
    if (method === 'GET' && pathname === '/api/projects') {
      if (!user) return needLogin();
      return sendJson(res, 200, { projects: await store.listProjects(workspace) });
    }
    if (method === 'POST' && pathname === '/api/projects') {
      if (!user) return needLogin();
      const body = await readBody(req);
      const project = await store.createProject({
        workspaceId: workspace,
        title: String(body.title || '未命名项目').slice(0, 40),
        prompt: body.prompt ? String(body.prompt).slice(0, 2000) : null,
      });
      return sendJson(res, 200, { project });
    }

    /* ---- 分享页 ---- */
    const shareMatch = pathname.match(/^\/p\/([a-z0-9-]{3,40})$/);
    if (method === 'GET' && shareMatch) {
      const project = await store.getProjectBySlug(shareMatch[1]);
      if (!project) return sendText(res, 404, '这个地址还没有发布，或者已被下线。');
      const version = project.currentVersionId
        ? await store.getVersionInProject(project.id, project.currentVersionId)
        : await store.getLatestVersion(project.id);
      if (!version) return sendText(res, 404, '项目还没有可用的版本。');
      return sendText(res, 200, renderSharePage({ project, version }), 'text/html; charset=utf-8');
    }

    /* ---- 生成物的数据 RPC（宿主转发，生成物自己不接触数据库） ---- */
    if (method === 'POST' && pathname === '/api/data') {
      const body = await readBody(req, 1_000_000);
      const appId = String(body.appId || '');
      const collection = String(body.collection || '').slice(0, 60);
      if (!appId || !collection) return sendJson(res, 400, { error: 'appId 与 collection 必填' });
      const payload = body.payload || {};
      try {
        let result;
        if (body.method === 'list') result = await store.dataList(appId, collection, { limit: 500 });
        else if (body.method === 'insert') result = await store.dataInsert(appId, collection, payload.doc || {});
        else if (body.method === 'update') result = await store.dataUpdate(appId, collection, payload.id, payload.patch || {});
        else if (body.method === 'remove') result = await store.dataRemove(appId, collection, payload.id);
        else if (body.method === 'clear') result = await store.dataClear(appId, collection);
        else return sendJson(res, 400, { error: `未知方法 ${body.method}` });
        return sendJson(res, 200, { result });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    /* ---- 单个项目 ---- */
    const projectMatch = pathname.match(/^\/api\/projects\/(proj_[a-z0-9]+)(\/.*)?$/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const rest = projectMatch[2] || '';
      const project = await store.getProject(projectId);
      if (!project) return sendJson(res, 404, { error: '项目不存在' });
      const ownsProject = Boolean(user) && project.workspaceId === workspace;
      // 预览渲染是唯一允许匿名访问的项目接口：发布后的分享页内部就是靠它加载应用的
      const isPublicRender = method === 'GET' && /^\/versions\/[a-z0-9_]+\/render$/.test(rest);
      const isRemix = method === 'POST' && rest === '/remix';
      // 已发布的应用：任何人都能打开（分享页），登录用户还能复刻成自己的项目
      const visitorAllowed = project.published && (isPublicRender || (isRemix && Boolean(user)));
      if (!ownsProject && !visitorAllowed) {
        return user
          ? sendJson(res, 403, { error: '没有权限访问该项目' })
          : needLogin();
      }

      /* ---- 复刻：把应用连数据模型一起复制到自己的工作区 ---- */
      if (isRemix) {
        const source = project.currentVersionId
          ? await store.getVersionInProject(projectId, project.currentVersionId)
          : await store.getLatestVersion(projectId);
        if (!source) return sendJson(res, 400, { error: '这个项目还没有可复刻的版本' });
        const copy = await store.createProject({
          workspaceId: workspace,
          title: `${project.title}（副本）`.slice(0, 40),
          prompt: source.prompt,
        });
        await store.addVersion({
          projectId: copy.id,
          title: source.title,
          note: `复刻自「${project.title}」`,
          prompt: source.prompt,
          html: source.html,
        });
        await store.addMessage({
          projectId: copy.id,
          role: 'assistant',
          content: `已复刻「${project.title}」的应用与数据结构，你可以直接继续修改，数据从零开始。`,
          meta: { title: source.title },
        });
        return sendJson(res, 200, { project: await store.getProject(copy.id) });
      }

      if (method === 'GET' && rest === '') {
        const [messages, versions, dataStats] = await Promise.all([
          store.listMessages(projectId),
          store.listVersions(projectId),
          store.dataStats(projectId),
        ]);
        return sendJson(res, 200, { project, messages, versions, dataStats });
      }

      if (method === 'PATCH' && rest === '') {
        const body = await readBody(req);
        const patch = {};
        if (body.title !== undefined) patch.title = String(body.title).slice(0, 40);
        if (body.slug !== undefined) {
          const slug = String(body.slug).trim().toLowerCase();
          if (!/^[a-z0-9-]{3,40}$/.test(slug)) return sendJson(res, 400, { error: '地址只能包含小写字母、数字和短横线，长度 3-40' });
          const taken = await store.getProjectBySlug(slug);
          if (taken && taken.id !== projectId) return sendJson(res, 409, { error: '这个地址已经被占用了' });
          patch.slug = slug;
        }
        if (body.published !== undefined) patch.published = Boolean(body.published);
        const updated = await store.updateProject(projectId, patch);
        return sendJson(res, 200, { project: updated });
      }

      if (method === 'DELETE' && rest === '') {
        await store.deleteProject(projectId);
        return sendJson(res, 200, { ok: true });
      }

      /* ---- 核心：SSE 流式生成 ---- */
      if (method === 'POST' && rest === '/generate') {
        const body = await readBody(req);
        const prompt = String(body.prompt || '').trim().slice(0, 2000);
        if (!prompt) return sendJson(res, 400, { error: '请输入需求' });
        const mode = body.mode === 'refine' ? 'refine' : 'create';

        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        const send = (obj) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* 连接已断开 */ } };

        const controller = new AbortController();
        req.on('close', () => controller.abort());

        const previous = mode === 'refine' && project.currentVersionId
          ? await store.getVersionInProject(projectId, project.currentVersionId)
          : null;
        const { llm } = await resolveLLM();

        await store.addMessage({ projectId, role: 'user', content: prompt });
        send({ type: 'started', projectId, prompt });

        try {
          const result = await runPipeline({
            llm,
            prompt,
            currentHtml: previous?.html || null,
            history: { title: previous?.title || project.title },
            emit: (event) => send(event),
            signal: controller.signal,
          });

          if (result.unsupported) {
            await store.addMessage({
              projectId,
              role: 'assistant',
              content: result.message,
              meta: { needsModel: true },
            });
            send({ type: 'done' });
            return undefined;
          }

          const version = await store.addVersion({
            projectId,
            title: result.title,
            note: result.note,
            prompt,
            html: result.html,
          });

          // 首次生成时，把项目名同步成应用自己的名称（比原始提示词更像一个产品）
          if (!previous && result.title) {
            await store.updateProject(projectId, { title: result.title });
          }

          await store.addMessage({
            projectId,
            role: 'assistant',
            content: mode === 'refine'
              ? `已完成修改：${result.note || result.title}`
              : `已完成《${result.title}》。${result.note || ''}`,
            meta: {
              versionId: version.id,
              title: result.title,
              plan: result.plan,
              issues: result.issues,
              repaired: result.repaired,
            },
          });

          send({ type: 'artifact', version, plan: result.plan, issues: result.issues, repaired: result.repaired });
          send({ type: 'done', versionId: version.id });
        } catch (err) {
          send({ type: 'error', message: err.message || '生成失败' });
        } finally {
          res.end();
        }
        return undefined;
      }

      /* ---- 运行时错误触发的自动修复 ---- */
      if (method === 'POST' && rest === '/autofix') {
        const body = await readBody(req);
        const { llm } = await resolveLLM();
        const version = project.currentVersionId
          ? await store.getVersionInProject(projectId, project.currentVersionId)
          : await store.getLatestVersion(projectId);
        if (!version) return sendJson(res, 400, { error: '没有可修复的版本' });
        const html = await repairFromRuntimeError({
          llm,
          html: version.html,
          error: String(body.error || '').slice(0, 500),
          prompt: version.prompt,
        });
        if (!html) return sendJson(res, 200, { fixed: false });
        const next = await store.addVersion({
          projectId,
          title: version.title,
          note: '运行时自检发现报错，已自动修复',
          prompt: version.prompt,
          html,
        });
        await store.addMessage({
          projectId,
          role: 'assistant',
          content: `质检 Agent Ada 捕获到运行时错误（${String(body.error || '').slice(0, 80)}），已自动修复并生成新版本。`,
          meta: { versionId: next.id, title: version.title, autoFix: true },
        });
        return sendJson(res, 200, { fixed: true, version: next });
      }

      /* ---- 版本：渲染 / 导出 / 回滚 ---- */
      const versionMatch = rest.match(/^\/versions\/(ver_[a-z0-9]+)(\/(render|export|restore))?$/);
      if (versionMatch) {
        const versionId = versionMatch[1];
        const action = versionMatch[2] || '';
        const version = await store.getVersionInProject(projectId, versionId);
        if (!version) {
          // iframe 里渲染 JSON 很难看：给出明确指引，通常是服务重启后数据被重置
          return sendText(res, 404, [
            '<!doctype html><html lang="zh-CN"><meta charset="utf-8">',
            '<body style="margin:0;font-family:system-ui,sans-serif;background:#fafafa;color:#3f3f46;height:100vh;display:grid;place-items:center">',
            '<div style="text-align:center;padding:24px">',
            '<div style="font-size:40px">\u{1F9CA}</div>',
            '<p style="margin:10px 0 4px;font-weight:600;font-size:16px">这个版本不存在了</p>',
            '<p style="margin:0;font-size:13px;color:#71717a">服务重启后演示数据会被重置——回到编辑器重新发送一次需求，十几秒就能重新生成</p>',
            '</div></body></html>',
          ].join('\n'), 'text/html; charset=utf-8');
        }

        if (method === 'GET' && action === '/render') {
          // ?raw=1 用于「代码」页签：给出模型原始产物，不带注入的运行时 SDK
          if (url.searchParams.get('raw')) {
            return sendText(res, 200, version.html, 'text/html; charset=utf-8', { 'cache-control': 'no-store' });
          }
          // ?mode=standalone 用来预览「导出后的单文件应用」：断开宿主，走 localStorage 降级
          const mode = url.searchParams.get('mode') === 'standalone' ? 'standalone' : 'host';
          const html = injectSdk(version.html, { appId: projectId, mode });
          return sendText(res, 200, html, 'text/html; charset=utf-8', { 'cache-control': 'no-store' });
        }
        if (method === 'GET' && action === '/export') {
          const html = injectSdk(version.html, { appId: projectId, mode: 'standalone' });
          return sendText(res, 200, html, 'text/html; charset=utf-8', {
            'content-disposition': `attachment; filename="${encodeURIComponent(version.title || 'atoms-app')}.html"`,
          });
        }
        if (method === 'POST' && action === '/restore') {
          await store.updateProject(projectId, { currentVersionId: versionId });
          return sendJson(res, 200, { ok: true, version });
        }
      }

      /* ---- 数据面板 ---- */
      if (method === 'GET' && rest === '/data') {
        const stats = await store.dataStats(projectId);
        const collection = url.searchParams.get('collection') || stats[0]?.collection;
        const rows = collection ? await store.dataList(projectId, collection, { limit: 200 }) : [];
        return sendJson(res, 200, { stats, collection, rows });
      }
      if (method === 'POST' && rest === '/data/delete') {
        const body = await readBody(req);
        await store.dataRemove(projectId, String(body.collection || ''), String(body.id || ''));
        return sendJson(res, 200, { ok: true });
      }
    }

    return sendJson(res, 404, { error: `未找到 ${method} ${pathname}` });
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) return sendJson(res, 500, { error: err.message || '服务器内部错误' });
    try { res.end(); } catch { /* 忽略 */ }
    return undefined;
  }
});

const startup = await resolveLLM();

server.listen(PORT, '0.0.0.0', () => {
  const mode = startup.llm.mode === 'live'
    ? `真实模型（${startup.llm.model}，来源：${startup.source === 'env' ? '环境变量' : '界面配置'}）`
    : 'Mock 演示模式（可在界面右上角「模型设置」里配置 API Key）';
  console.log('Atoms Demo 已启动');
  console.log(`  地址：http://localhost:${PORT}`);
  console.log(`  存储：${store.driver}`);
  console.log(`  模型：${mode}`);
});
