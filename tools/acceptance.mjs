/**
 * 验收脚本：按评审的 7 条口径跑一遍线上/本地实例。
 *
 *   node tools/acceptance.mjs                     # 默认打本地 127.0.0.1:8787
 *   BASE=https://xxx.app.workbuddy.host node tools/acceptance.mjs
 *
 * 只依赖内置 fetch，不需要任何第三方包。全部通过时退出码 0。
 */
const BASE = (process.env.BASE || 'http://127.0.0.1:8787').replace(/\/+$/, '');

let cookie = '';
let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  \u2713 ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed += 1; failures.push(name); console.log(`  \u2717 ${name}${detail ? ` — ${detail}` : ''}`); }
}

function section(title) { console.log(`\n[${title}]`); }

async function req(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(300000),
  });
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (setCookies.length) {
    const jar = new Map(cookie.split('; ').filter(Boolean).map((c) => [c.split('=')[0], c]));
    for (const c of setCookies) { const k = c.split('=')[0]; jar.set(k, c.split(';')[0]); }
    cookie = [...jar.values()].join('; ');
  }
  return res;
}
const json = async (res) => res.json().catch(() => ({}));

/** 读 SSE 流，返回事件数组 */
async function sse(path, payload) {
  const res = await req(path, { method: 'POST', body: payload, headers: { accept: 'text/event-stream' } });
  const text = await res.text();
  return text.split('\n').filter((l) => l.startsWith('data:')).map((l) => {
    try { return JSON.parse(l.slice(5).trim()); } catch { return null; }
  }).filter(Boolean);
}

const stamp = Date.now();
const email = `accept_${stamp}@test.local`;
const password = 'accept_123456';

/* ------------------------------ 1. 健康与真实模型 ------------------------------ */
section('1. 服务健康与真实模型');
const health = await json(await req('/api/health'));
check('GET /api/health 返回 ok', health.ok === true, JSON.stringify(health));
check('存储驱动已上报', Boolean(health.storage), `storage=${health.storage}`);
check('模型不是 Mock（llm=live）', health.llm === 'live', `llm=${health.llm}`);
check('上报了真实模型名', Boolean(health.model) && health.model !== 'mock-builder' && health.model !== 'auto', `model=${health.model}`);

/* --------------------------------- 2. 注册登录 --------------------------------- */
section('2. 注册 / 登录 / 会话');
const reg = await json(await req('/api/auth/register', { method: 'POST', body: { email, password, name: '验收员' } }));
check('注册成功', Boolean(reg.user?.id), reg.user?.email || JSON.stringify(reg).slice(0, 80));
check('注册后会话立即有效', cookie.includes('atoms_session'), 'HttpOnly Cookie 已下发');
const me = await json(await req('/api/auth/me'));
check('GET /api/auth/me 返回当前用户', me.user?.email === email, me.user?.email || '');

/* ------------------------------ 3. 生成（真实模型） ------------------------------ */
section('3. 需求 → 应用（SSE 全流程）');
const created = await json(await req('/api/projects', { method: 'POST', body: {} }));
const projectId = created.project?.id;
check('创建项目', Boolean(projectId), projectId || '');

const t0 = Date.now();
const genEvents = await sse(`/api/projects/${projectId}/generate`, { prompt: '做一个门店巡检速记应用，记录门店、检查项和结果' });
const kinds = [...new Set(genEvents.map((e) => e.type))];
const artifact = genEvents.find((e) => e.type === 'artifact');
const genErr = genEvents.find((e) => e.type === 'error');
const notice = genEvents.find((e) => e.type === 'notice');
check('SSE 事件流完整（step/plan/delta/artifact）',
  ['step', 'plan', 'delta', 'artifact'].every((k) => kinds.includes(k)), kinds.join(','));
check('产出可用的应用产物', Boolean(artifact?.version?.html) && artifact.version.html.length > 1500,
  `${artifact?.version?.html?.length || 0} 字符 / ${((Date.now() - t0) / 1000).toFixed(1)}s`);
check('生成过程无错误', !genErr, genErr?.message || '');
if (notice) console.log(`    · 过程提示：${notice.message}`);

const detail1 = await json(await req(`/api/projects/${projectId}`));
const v1 = detail1.project?.currentVersionId;
check('项目已按应用名自动命名', Boolean(detail1.project?.title) && detail1.project.title !== '未命名项目', detail1.project?.title || '');
check('版本已归档', detail1.versions?.length >= 1, `versions=${detail1.versions?.length}`);

/* ------------------------------- 4. 增量修改真实生效 ------------------------------- */
section('4. 同项目增量修改');
const beforeHtml = (await (await req(`/api/projects/${projectId}/versions/${v1}/render?raw=1`)).text());
const refineEvents = await sse(`/api/projects/${projectId}/generate`, { prompt: '在列表上方加一个按门店名搜索的输入框', mode: 'refine' });
const artifact2 = refineEvents.find((e) => e.type === 'artifact');
const refineErr = refineEvents.find((e) => e.type === 'error');
check('增量修改走通（无报错）', Boolean(artifact2) && !refineErr, refineErr?.message || '');
const detail2 = await json(await req(`/api/projects/${projectId}`));
const v2 = detail2.project?.currentVersionId;
const afterHtml = v2 && v2 !== v1 ? await (await req(`/api/projects/${projectId}/versions/${v2}/render?raw=1`)).text() : '';
if (health.llm === 'live') {
  check('产生了新版本且内容确实变了', Boolean(afterHtml) && afterHtml !== beforeHtml,
    `${beforeHtml.length} → ${afterHtml.length} 字符`);
} else {
  // 离线生成器是确定性模板，不做代码级改写——这一条只在真实模型模式下有判定意义
  console.log('  \u00b7 当前是 Mock 模式，离线生成器不做代码级改写，跳过「内容变化」断言');
}
check('版本历史累积（可回看）', (detail2.versions?.length || 0) >= 2, `versions=${detail2.versions?.length}`);

/* ------------------------------- 5. 产物预览 ------------------------------- */
section('5. 产物预览');
const renderRes = await req(`/api/projects/${projectId}/versions/${v2}/render`);
const rendered = await renderRes.text();
check('预览页可访问', renderRes.status === 200, `HTTP ${renderRes.status}`);
check('预览页注入了宿主数据层 SDK', /atomsBridge|__ATOMS|window\.atoms/.test(rendered), `${rendered.length} 字符`);
const rawRes = await req(`/api/projects/${projectId}/versions/${v2}/render?raw=1`);
const rawHtml = await rawRes.text();
check('源码视图是模型原始产物（未注入 SDK）', !/atomsBridge|__ATOMS/.test(rawHtml), `${rawHtml.length} 字符`);
check('源码是完整的单文件 HTML', /<html[\s>]/i.test(rawHtml) && /<\/html>/i.test(rawHtml) && /<script[\s>]/i.test(rawHtml));
const standalone = await (await req(`/api/projects/${projectId}/versions/${v2}/render?mode=standalone`)).text();
check('standalone 模式可离线运行（localStorage 降级）', /localStorage/.test(standalone));

/* ------------------------------- 6. 数据持久化 ------------------------------- */
section('6. 数据持久化（刷新 / 重登后仍在）');
const coll = 'inspections';
const ins = await json(await req('/api/data', { method: 'POST', body: { appId: projectId, collection: coll, method: 'insert', payload: { doc: { shop: `验收门店-${stamp}`, item: '消防通道', result: '合格' } } } }));
check('写入一条记录', Boolean(ins.result?.id), ins.result?.id || JSON.stringify(ins).slice(0, 80));

await req('/api/auth/logout', { method: 'POST' });
check('退出登录后会话失效', (await json(await req('/api/auth/me'))).user == null);
await json(await req('/api/auth/login', { method: 'POST', body: { email, password } }));
check('重新登录成功', (await json(await req('/api/auth/me'))).user?.email === email);

const listed = await json(await req('/api/data', { method: 'POST', body: { appId: projectId, collection: coll, method: 'list' } }));
const rows = listed.result || [];
check('重登后记录仍在', rows.some((r) => r.shop === `验收门店-${stamp}`), `${rows.length} 条`);
const detailAfter = await json(await req(`/api/projects/${projectId}`));
check('项目与版本仍在', detailAfter.project?.id === projectId && (detailAfter.versions?.length || 0) >= 2);

/* ------------------------------- 7. 代码管理与分享 ------------------------------- */
section('7. 代码管理 / 分享');
const exportRes = await req(`/api/projects/${projectId}/versions/${v1}/export`);
const exported = await exportRes.text();
check('导出单文件应用', exportRes.status === 200 && /<html[\s>]/i.test(exported), `${exported.length} 字符`);
check('导出走 attachment 下载', /attachment/.test(exportRes.headers.get('content-disposition') || ''),
  exportRes.headers.get('content-disposition') || '');

const restoreRes = await json(await req(`/api/projects/${projectId}/versions/${v1}/restore`, { method: 'POST' }));
check('恢复历史版本', restoreRes.ok === true, `currentVersionId → ${v1}`);
const detail3 = await json(await req(`/api/projects/${projectId}`));
check('恢复后当前版本确实指向旧版', detail3.project?.currentVersionId === v1);
check('恢复后的旧版本仍可预览', (await req(`/api/projects/${projectId}/versions/${v1}/render`)).status === 200);

const slug = `accept-${stamp}`;
await json(await req(`/api/projects/${projectId}`, { method: 'PATCH', body: { published: true, slug } }));
const shareRes = await req(`/p/${slug}`);
check('发布并生成公开分享页', shareRes.status === 200, `/p/${slug} (HTTP ${shareRes.status})`);
check('未发布的地址返回 404', (await req(`/p/definitely-not-exists-${stamp}`)).status === 404);

/* ----------------------------------- 汇总 ----------------------------------- */
console.log(`\n${'='.repeat(56)}`);
console.log(`目标：${BASE}`);
console.log(failed === 0 ? `结果：全部通过（${passed} 项）` : `结果：${failed} 项失败 / 共 ${passed + failed} 项`);
if (failed) console.log(`失败项：\n  - ${failures.join('\n  - ')}`);
console.log('='.repeat(56));
process.exit(failed === 0 ? 0 : 1);