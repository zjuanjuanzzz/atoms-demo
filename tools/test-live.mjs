/**
 * 真实模型验收脚本。
 *
 * 用途：在配置好 API Key 之后，用真实模型跑一遍完整链路，并检查产物的质量底线
 * （必须调用数据层、不能引用外链资源、结构完整），同时输出耗时便于评估。
 *
 * 用法：
 *   node tools/test-live.mjs
 *   node tools/test-live.mjs --prompt="做一个健身房课程预约工具"   # 换一个需求
 *   node tools/test-live.mjs --autofix                            # 额外验证"运行时错误→自动修复"
 */
const BASE = process.env.BASE || 'http://localhost:8787';
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const PROMPT = args.prompt || '做一个团队待办看板，能按优先级排序、标记完成、看到逾期任务';

let cookie = '';
let failures = 0;
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

console.log('\n[0] 检查模型是否已经接入');
const health = await json('/api/health');
if (health.data.llm !== 'live') {
  console.log('  ✗ 当前仍是 Mock 模式，没有检测到可用的模型配置。');
  console.log('    请任选一种方式配置后重试：');
  console.log('      A. 在界面左下角「模型设置」里选择服务商、粘贴 API Key，点「测试连接」→「保存」');
  console.log('      B. 在项目根目录创建 .env，填入 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 后重启服务');
  process.exit(1);
}
check('模型已接入', true, `${health.data.model}（来源：${health.data.keySource === 'env' ? '环境变量' : '界面配置'}）`);

console.log('\n[1] 注册一个测试账号');
const email = `live_${Math.random().toString(36).slice(2, 8)}@example.com`;
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234', name: '真实模型验收' }),
});
cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
check('注册成功', reg.status === 200 && Boolean(cookie));

console.log('\n[2] 用真实模型生成一个应用');
console.log(`  需求：${PROMPT}`);
const created = await json('/api/projects', { method: 'POST', body: { title: '未命名项目' } });
const projectId = created.data.project.id;

const started = Date.now();
const res = await fetch(`${BASE}/api/projects/${projectId}/generate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ prompt: PROMPT, mode: 'create' }),
});
if (!res.ok) {
  check('SSE 建立成功', false, `HTTP ${res.status}`);
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let firstDeltaAt = 0;
let deltaCount = 0;
let codeLength = 0;
const steps = [];
let artifact = null;
let streamError = null;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split('\n\n');
  buffer = parts.pop() || '';
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data:')) continue;
    let evt;
    try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
    if (evt.type === 'step') steps.push(`${evt.id}:${evt.status}`);
    if (evt.type === 'delta') {
      if (!firstDeltaAt) firstDeltaAt = Date.now();
      deltaCount++;
      codeLength += evt.text.length;
    }
    if (evt.type === 'artifact') artifact = evt;
    if (evt.type === 'error') streamError = evt.message;
    if (evt.type === 'unsupported') streamError = evt.message;
  }
}
const totalMs = Date.now() - started;

check('流程没有报错', !streamError, streamError || '');
check('收到成品', Boolean(artifact?.version?.id), artifact?.version?.title);
check('方案里包含数据结构（规划 Agent 输出可用）', Boolean(artifact?.plan?.dataModel?.length));
console.log(`      首字延迟 ${firstDeltaAt ? Math.round((firstDeltaAt - started) / 100) / 10 : '-'}s · `
  + `总耗时 ${Math.round(totalMs / 100) / 10}s · 流式片段 ${deltaCount} 次 · 产出 ${Math.round(codeLength / 1024)}KB`);
console.log(`      工作流：${steps.join(' → ')}`);

if (artifact) {
  const html = artifact.version.html;
  console.log('\n[3] 检查产物的质量底线');
  check('调用了数据层 atoms.store', /atoms\.store/.test(html));
  check('没有外部脚本/样式/图片引用', !/<script[^>]+src=/i.test(html) && !/<link[^>]+href=["']https?:/i.test(html) && !/<img[^>]+src=["']https?:/i.test(html));
  check('结构完整（<html>…</html>）', /<html[\s>]/i.test(html) && /<\/html>/i.test(html));
  check('体积在合理区间', html.length > 3000 && html.length < 400000, `${Math.round(html.length / 1024)}KB`);
  if (artifact.issues?.length) {
    console.log(`      ⚠ 质检曾发现问题并自动修复：${artifact.issues.join('；')}`);
  } else {
    console.log('      ✓ 静态质检一次通过（无外链、含数据层调用）');
  }

  console.log('\n[4] 生成物的数据层是否真的可用');
  const collection = artifact.plan?.dataModel?.[0]?.collection || '记录';
  const inserted = await json('/api/data', {
    method: 'POST',
    body: { appId: projectId, collection, method: 'insert', payload: { doc: { 验收标记: '来自 test-live', 名称: '端到端验证' } } },
  });
  check(`向「${collection}」写入一条记录`, inserted.status === 200 && Boolean(inserted.data.result?.id));
  const listed = await json('/api/data', {
    method: 'POST',
    body: { appId: projectId, collection, method: 'list', payload: {} },
  });
  check('读回该记录', (listed.data.result || []).length >= 1);

  console.log('\n[5] 发布与分享');
  const slug = `live-${Math.random().toString(36).slice(2, 8)}`;
  const published = await json(`/api/projects/${projectId}`, { method: 'PATCH', body: { slug, published: true } });
  check('发布成功', published.status === 200 && published.data.project.published === true, `http://localhost:8787/p/${slug}`);
  const share = await fetch(`${BASE}/p/${slug}`);
  check('分享页可访问', share.status === 200);
}

if (args.autofix && artifact) {
  console.log('\n[6] 运行时错误 → 质检 Agent 自动修复');
  const fix = await json(`/api/projects/${projectId}/autofix`, {
    method: 'POST',
    body: { error: "Uncaught TypeError: Cannot read properties of undefined (reading 'length')" },
  });
  check('修复接口返回了新版本', fix.status === 200 && fix.data.fixed === true, fix.data.version?.note || '');
  const after = await json(`/api/projects/${projectId}`);
  check('版本数增加到 2', (after.data.versions || []).length >= 2);
}

console.log(`\n结果：${failures === 0 ? '全部通过' : failures + ' 项失败'}`);
console.log(`手工确认建议：打开 http://localhost:8787 的这个项目，在预览里点几下，确认交互与数据保存符合预期。\n`);
process.exit(failures === 0 ? 0 : 1);
