// 端到端冒烟测试：覆盖 注册/登录 → 建项目 → 流式生成 → 数据读写 → 发布 → 分享页 → 二次迭代 → 权限隔离。
const BASE = process.env.BASE || 'http://localhost:8787';
let failures = 0;
let cookie = '';

function check(name, ok, extra = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}

const json = async (path, options = {}) => {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

/** 从响应头里取出会话 Cookie，后续请求带上它 */
function captureCookie(res) {
  const raw = res.headers.get('set-cookie') || '';
  const first = raw.split(';')[0];
  if (first.includes('atoms_session=')) cookie = first;
  return first;
}

console.log('\n[1] 健康检查');
const health = await json('/api/health');
check('GET /api/health', health.status === 200 && health.data.ok, `storage=${health.data.storage} llm=${health.data.llm}`);

console.log('\n[2] 注册 / 登录 / 会话');
const unauth = await json('/api/projects');
check('未登录访问项目列表返回 401', unauth.status === 401);

const email = `smoke_${Math.random().toString(36).slice(2, 8)}@example.com`;
const registerRes = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234', name: '冒烟测试工作区' }),
});
const registered = await registerRes.json();
captureCookie(registerRes);
check('注册成功并下发会话 Cookie', registerRes.status === 200 && Boolean(cookie), registered.user?.workspaceId);
check('返回结构里不含密码字段', !JSON.stringify(registered).includes('passwordHash') && !JSON.stringify(registered).includes('demo1234'));

const dup = await json('/api/auth/register', { method: 'POST', body: { email, password: 'demo1234', name: 'x' } });
check('重复邮箱注册返回 409', dup.status === 409);
const badLogin = await json('/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });
check('错误密码登录返回 401', badLogin.status === 401);
const me = await json('/api/auth/me');
check('会话有效时返回当前用户', me.data.user?.email === email, me.data.user?.name);

console.log('\n[3] 项目创建');

const created = await json('/api/projects', { method: 'POST', body: { title: '未命名项目' } });
const projectId = created.data.project?.id;
check('POST /api/projects', created.status === 200 && Boolean(projectId), projectId);

console.log('\n[4] 流式生成（SSE）');
const res = await fetch(`${BASE}/api/projects/${projectId}/generate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify({ prompt: '帮我做一个门店巡检记录工具，记录巡检点位、结果和备注', mode: 'create' }),
});
check('SSE 响应头', res.headers.get('content-type')?.includes('text/event-stream'));

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
const events = [];
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split('\n\n');
  buffer = parts.pop() || '';
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data:')) continue;
    try { events.push(JSON.parse(line.slice(5).trim())); } catch { /* 忽略 */ }
  }
}
const kinds = [...new Set(events.map((e) => e.type))];
check('收到 step / plan / delta 事件', kinds.includes('step') && kinds.includes('plan') && kinds.includes('delta'), kinds.join(','));
const artifact = events.find((e) => e.type === 'artifact');
check('收到 artifact 事件', Boolean(artifact?.version?.id), artifact?.version?.title);
check('生成物包含数据层调用', /atoms\.store/.test(artifact?.version?.html || ''));
check('生成物没有外部资源引用', !/<script[^>]+src=/i.test(artifact?.version?.html || ''));

console.log('\n[5] 项目详情与预览渲染');
const detail = await json(`/api/projects/${projectId}`, {});
check('项目已自动命名', detail.data.project?.title && detail.data.project.title !== '未命名项目', detail.data.project?.title);
check('消息已归档', (detail.data.messages || []).length >= 2, `${detail.data.messages?.length} 条`);
check('版本已归档', (detail.data.versions || []).length === 1);

const render = await fetch(`${BASE}/api/projects/${projectId}/versions/${artifact.version.id}/render`, { headers: { cookie } });
const rendered = await render.text();
check('渲染页注入运行时 SDK', rendered.includes('data-atoms-runtime'), `${Math.round(rendered.length / 1024)} KB`);

console.log('\n[6] 生成物的数据读写（模拟应用内操作）');
const insert = await json('/api/data', {
  method: 'POST',
  body: { appId: projectId, collection: '巡检记录', method: 'insert', payload: { doc: { point: '一楼生鲜区', result: '正常' } } },
});
check('insert 成功', insert.status === 200 && Boolean(insert.data.result?.id), insert.data.result?.id);
const list = await json('/api/data', {
  method: 'POST',
  body: { appId: projectId, collection: '巡检记录', method: 'list', payload: {} },
});
check('list 读回数据', (list.data.result || []).length === 1);
const stats = await json(`/api/projects/${projectId}/data`, {});
check('数据面板统计', stats.data.stats?.[0]?.collection === '巡检记录' && stats.data.stats[0].count === 1);

console.log('\n[7] 发布与分享页');
const slug = `smoke-${Math.random().toString(36).slice(2, 8)}`;
const published = await json(`/api/projects/${projectId}`, { method: 'PATCH', body: { slug, published: true } });
check('发布成功', published.status === 200 && published.data.project.published === true, slug);
const share = await fetch(`${BASE}/p/${slug}`);
const shareHtml = await share.text();
check('分享页可访问', share.status === 200 && shareHtml.includes('sandbox='), `${Math.round(shareHtml.length / 1024)} KB`);
const badShare = await fetch(`${BASE}/p/not-exists-here`);
check('未发布的 slug 返回 404', badShare.status === 404);

console.log('\n[8] 二次迭代（refine）');
const refine = await fetch(`${BASE}/api/projects/${projectId}/generate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify({ prompt: '加一个按结果筛选的下拉框', mode: 'refine' }),
});
const refineText = await refine.text();
check('refine 完成并产出新版本', refineText.includes('"type":"artifact"'));
const after = await json(`/api/projects/${projectId}`, {});
check('版本数增加到 2', after.data.versions.length === 2);

console.log('\n[9] 权限隔离与退出登录');
const otherRes = await fetch(`${BASE}/api/auth/guest`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});
const otherCookie = (otherRes.headers.get('set-cookie') || '').split(';')[0];
const forbidden = await fetch(`${BASE}/api/projects/${projectId}`, { headers: { cookie: otherCookie } });
check('访问他人项目返回 403', forbidden.status === 403);
const otherList = await (await fetch(`${BASE}/api/projects`, { headers: { cookie: otherCookie } })).json();
check('他人工作区看不到该项目', (otherList.projects || []).length === 0);

const anonShare = await fetch(`${BASE}/p/${slug}`);
check('未登录也能打开公开分享页', anonShare.status === 200);
const anonRender = await fetch(`${BASE}/api/projects/${projectId}/versions/${after.data.project.currentVersionId}/render`);
const anonRenderHtml = await anonRender.text();
check('匿名访客能加载分享页里的应用', anonRender.status === 200 && anonRenderHtml.includes('data-atoms-runtime'));
const anonUnpublished = await fetch(`${BASE}/api/projects/${otherList.projects?.[0]?.id || 'proj_0000000000000000'}/versions/ver_0000000000000000/render`);
check('不存在的资源仍被拒绝', anonUnpublished.status === 404 || anonUnpublished.status === 401);
const anonData = await json('/api/data', {
  method: 'POST',
  headers: { cookie: 'unused=1' },
  body: { appId: projectId, collection: '巡检记录', method: 'list', payload: {} },
});
check('分享出去的应用可匿名读写自己的数据', anonData.status === 200 && Array.isArray(anonData.data.result));

const logout = await json('/api/auth/logout', { method: 'POST', body: {} });
check('退出登录', logout.status === 200);

console.log('\n[10] 复刻（Remix）');
const remixRes = await fetch(`${BASE}/api/projects/${projectId}/remix`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: otherCookie },
  body: '{}',
});
const remixed = await remixRes.json();
check('其他登录用户可复刻已发布应用', remixRes.status === 200 && Boolean(remixed.project?.id), remixed.project?.title);
const remixDetail = await fetch(`${BASE}/api/projects/${remixed.project.id}`, { headers: { cookie: otherCookie } }).then((r) => r.json());
check('复刻件带有应用源码', (remixDetail.versions || []).length === 1 && remixDetail.project.title.includes('副本'));
check('复刻件的数据是空的（数据不跟着复制）', (await fetch(`${BASE}/api/projects/${remixed.project.id}/data`, { headers: { cookie: otherCookie } }).then((r) => r.json())).stats.length === 0);
const anonRemix = await fetch(`${BASE}/api/projects/${projectId}/remix`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});
check('未登录复刻返回 401（登录后会自动继续）', anonRemix.status === 401);

cookie = '';
const afterLogout = await json('/api/projects');
check('退出后访问项目返回 401', afterLogout.status === 401);

console.log(`\n结果：${failures === 0 ? '全部通过' : failures + ' 项失败'}\n`);
process.exit(failures === 0 ? 0 : 1);
