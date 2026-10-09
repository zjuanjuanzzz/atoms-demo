/**
 * 原始流式探针：直接读服务端已保存的模型配置，打印返回的 SSE 结构。
 * 用途：当模型"能连上但产不出内容"时，看清它的 delta 到底长什么样。
 * 安全：只打印响应的结构，不会打印 API Key。
 */
import { createStore } from '../src/store.js';

const store = await createStore({ driver: 'sqlite', file: 'data/atoms.db' });
const cfg = await store.getConfig();
const baseUrl = (cfg.baseUrl || '').replace(/\/+$/, '');
const key = cfg.apiKey;
const model = cfg.model;

if (!key) {
  console.log('没有已保存的 Key');
  process.exit(1);
}
console.log(`地址：${baseUrl}\n模型：${model}\nKey：已读取（${key.slice(0, 5)}····${key.slice(-4)}，不打印完整值）\n`);

const payload = {
  model,
  messages: [
    { role: 'system', content: '你是一个工程师，只输出代码块。' },
    { role: 'user', content: '写一个 5 行的 HTML 片段，包含一个 h1 标题「你好」和一个按钮。' },
  ],
  stream: true,
  max_tokens: 800,
};

const res = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify(payload),
});
console.log('HTTP', res.status, res.headers.get('content-type'));
if (!res.ok) {
  console.log((await res.text()).slice(0, 600));
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
const keysSeen = new Map();
const samples = [];
let index = 0;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split('\n');
  buffer = parts.pop() ?? '';
  for (const rawLine of parts) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;
    const body = line.slice(5).trim();
    if (!body || body === '[DONE]') continue;
    index++;
    let json;
    try { json = JSON.parse(body); } catch { continue; }
    const delta = json.choices?.[0]?.delta || {};
    for (const k of Object.keys(delta)) keysSeen.set(k, (keysSeen.get(k) || 0) + 1);
    if (index <= 3 || index % 25 === 0) {
      samples.push(`#${index} delta keys=${JSON.stringify(Object.keys(delta))} ` +
        `content=${JSON.stringify((delta.content || '').slice(0, 60))} ` +
        `reasoning=${JSON.stringify((delta.reasoning_content || '').slice(0, 60))} ` +
        `finish=${json.choices?.[0]?.finish_reason ?? ''}`);
    }
  }
}

console.log(`\n共收到 ${index} 个数据片段。delta 里出现过的字段与次数：`);
for (const [k, n] of keysSeen) console.log(`  ${k}: ${n}`);
console.log('\n片段样本：');
for (const s of samples) console.log('  ' + s);
