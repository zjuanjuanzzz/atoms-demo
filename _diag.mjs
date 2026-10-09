// 线上诊断：注册 → 建项目 → 流式生成 → 渲染，逐步打印关键 ID 与状态
const BASE = 'https://atoms-demo-02329.app.workbuddy.host';
let cookie = '';
const log = (...a) => console.log(...a);

const email = `diag_${Math.random().toString(36).slice(2, 8)}@example.com`;
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'diag1234', name: '诊断' }),
});
cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
log('[1] register:', reg.status, 'cookie?', Boolean(cookie));

const created = await fetch(`${BASE}/api/projects`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ title: '未命名项目' }),
}).then((r) => r.json());
const projectId = created.project?.id;
log('[2] project:', created.project ? 'ok' : JSON.stringify(created), projectId, 'len=', projectId?.length);

const gen = await fetch(`${BASE}/api/projects/${projectId}/generate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ prompt: '帮我做一个门店巡检记录工具，记录巡检点位、结果和备注', mode: 'create' }),
});
log('[3] generate status:', gen.status, gen.headers.get('content-type'));

const reader = gen.body.getReader();
const dec = new TextDecoder();
let buf = '', events = [];
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const parts = buf.split('\n\n');
  buf = parts.pop() || '';
  for (const p of parts) {
    const line = p.trim();
    if (line.startsWith('data:')) { try { events.push(JSON.parse(line.slice(5))); } catch {} }
  }
}
const artifact = events.find((e) => e.type === 'artifact');
const errs = events.filter((e) => e.type === 'error');
log('[4] events:', events.map((e) => e.type).join(','));
if (errs.length) log('    error events:', JSON.stringify(errs).slice(0, 300));
if (artifact) {
  const v = artifact.version;
  log('    version.id=', v.id, 'len=', v.id.length, 'projectId=', v.projectId, 'title=', v.title);
  const render = await fetch(`${BASE}/api/projects/${projectId}/versions/${v.id}/render`, { headers: { cookie } });
  const text = await render.text();
  log('[5] render:', render.status, 'runtime?', text.includes('data-atoms-runtime'), 'head:', text.slice(0, 120).replace(/\n/g, ' '));
  const detail = await fetch(`${BASE}/api/projects/${projectId}`, { headers: { cookie } }).then((r) => r.json());
  log('[6] detail versions:', (detail.versions || []).map((x) => x.id).join(','), 'current=', detail.project?.currentVersionId);
  const again = await fetch(`${BASE}/api/projects/${projectId}/versions/${v.id}/render`, { headers: { cookie } });
  log('[7] render again:', again.status);
} else {
  log('!! 没有 artifact 事件');
}