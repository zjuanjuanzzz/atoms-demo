/**
 * 模型连接诊断。
 *
 * 用途：当「测试连接」失败时，用它把常见的几种原因分开定位 —— 地址错、模型名错、Key 无效、网络不通。
 * 说明：脚本通过服务端自己的接口发起请求，永远不会打印或回传 API Key 原文；
 *      除「当前配置」外，其它探测都只是临时覆盖参数，不会改动你已保存的配置。
 */
const BASE = process.env.BASE || 'http://localhost:8787';
let cookie = '';

const json = async (path, body) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body || {}),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

// 用一次性账号拿会话（模型配置是平台级的，与账号无关）
const email = `diag_${Math.random().toString(36).slice(2, 8)}@example.com`;
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234', name: '连接诊断' }),
});
cookie = (reg.headers.get('set-cookie') || '').split(';')[0];

const current = await (await fetch(`${BASE}/api/settings`, { headers: { cookie } })).json();
console.log('\n当前保存的配置：');
console.log(`  接口地址：${current.baseUrl}`);
console.log(`  模型名：  ${current.model}`);
console.log(`  API Key： ${current.hasKey ? `已配置（${current.maskedKey}，来源 ${current.source}）` : '未配置'}`);
if (!current.hasKey) {
  console.log('\n还没有配置 Key，先在界面里填好再跑这个诊断。\n');
} else {
  const probes = [
    { label: '① 当前保存的配置（原样）', body: {} },
    { label: '② 换成 deepseek-chat（非推理，适合写代码）', body: { model: 'deepseek-chat' } },
    { label: '③ 换成 deepseek-reasoner（推理）', body: { model: 'deepseek-reasoner' } },
    { label: '④ 换成 deepseek-v4-flash（你现在用的）', body: { model: 'deepseek-v4-flash' } },
  ];

  console.log('\n逐项探测（只做临时覆盖，不改动已保存的配置）：');
  for (const probe of probes) {
    const started = Date.now();
    const res = await json('/api/settings/test', probe.body);
    const ms = Date.now() - started;
    const ok = res.data.ok === true;
    console.log(`\n  ${ok ? '✓' : '✗'} ${probe.label}  (${ms}ms)`);
    if (res.data.baseUrl) console.log(`      实际请求地址：${res.data.baseUrl}`);
    if (res.data.error) console.log(`      ${res.data.error}`);
    if (ok) console.log(`      可用，模型返回：${res.data.reply}`);
  }
  console.log('\n结论：哪一行出现 ✓，就把那一行的地址与模型名填到「模型设置」里，点「测试连接」→「保存」。\n');
}
