/**
 * Agent 管线。
 *
 * 对齐 Atoms「一支有名字的 AI 团队」的形态，这里把一次生成拆成三段可见的工作流：
 *
 *   Emma 产品经理 + Bob 架构师  →  一次调用产出「理解 + 方案 + 数据结构」
 *   Alex 工程师               →  流式产出完整的单文件应用
 *   Ada 质检                  →  静态规则校验，发现问题自动修复一轮
 *
 * 之后运行时如果还抛错，前端会把错误回传，触发 Ada 的第二轮修复
 * （见 repair 导出）—— 这是「自检修复」真正落地的地方，而不是只写在文案里。
 */

import { injectSdk, ensureViewport } from './runtime.js';
import { mockPlan, buildMockApp } from './mock-builder.js';

export const TEAM = [
  { id: 'emma', name: 'Emma', role: '产品经理', emoji: '🧩', desc: '把一句话需求拆成可实现的方案' },
  { id: 'bob', name: 'Bob', role: '架构师', emoji: '📐', desc: '确定数据结构与页面结构' },
  { id: 'alex', name: 'Alex', role: '工程师', emoji: '⌨️', desc: '写出可直接运行的单文件应用' },
  { id: 'ada', name: 'Ada', role: '质检', emoji: '🔍', desc: '静态检查与运行时报错自动修复' },
];

/* ------------------------------- 提示词 ------------------------------- */

const PLANNER_SYSTEM = `你是 Atoms Demo 的产品经理 Emma 与架构师 Bob。用户会用一句话描述想要的应用，你要把它变成可以直接开工的方案。

只输出一个 JSON 对象，不要 markdown 代码块、不要任何解释文字：
{
  "title": "应用名，不超过 14 个字，具体且有画面感",
  "summary": "一句话说明你打算怎么做，40 字以内",
  "features": ["3 到 5 个核心功能"],
  "dataModel": [{ "collection": "数据集合名", "fields": ["字段1", "字段2"] }],
  "sections": ["页面区块1", "页面区块2"],
  "implementation_notes": "给工程师的关键提示，30 字以内"
}

约束：
- 面向「录入 + 查看 + 维护」的小工具，字段控制在 3 到 5 个。
- 至少一个数据集合、至少 3 个字段。
- 全部使用简体中文。`;

const BUILDER_SYSTEM = `你是 Atoms Demo 的工程师 Alex。请把产品方案实现成一个可以直接运行的单文件网页应用。

【输出格式】
只输出一个完整的 HTML 文件，用 \`\`\`html 代码块包裹。代码块之外不要写任何解释。

【硬性要求】
1. 单文件自包含：CSS、JS 全部内联。
2. 严禁引用任何外部资源 —— 不允许 <script src>、<link href>、CDN、外链图片、外链字体、外部 API。图标请用 emoji 或内联 SVG。产物会在离线沙箱 iframe 里运行，任何外链都会导致白屏。
3. 界面语言用简体中文，现代、克制、留白充分，桌面与手机都要好看（用 media query 处理窄屏）。
4. 必须包含：顶部标题区、统计概览、新建表单、可搜索的记录列表、空状态。
5. 交互必须是真实的：表单能提交、列表能过滤、记录能删除、有 toast 提示与加载态。
6. 数据必须持久化，通过宿主注入的 window.atoms.store() 读写，不能只放在内存变量里。
7. 提供一个「填充示例数据」按钮，让第一次打开的人能立刻看到效果。
8. 关键逻辑加简短中文注释。

【数据 API】宿主已在页面里注入 window.atoms，直接使用，不要自己实现存储：
  var store = window.atoms.store('集合名');
  await store.list()             // 返回记录数组
  await store.insert({ ... })    // 新增，返回带 id / createdAt 的记录
  await store.update(id, patch)  // 更新
  await store.remove(id)         // 删除
  await store.clear()            // 清空
  window.atoms.toast('已保存')   // 轻提示
注意：所有方法都是异步的，必须 await 或 .then；不要使用 localStorage。`;

/* ------------------------------ 工具函数 ------------------------------ */

export function extractHtml(text) {
  const source = String(text || '');
  const fence = source.match(/```(?:html|HTML)?\s*([\s\S]*?)```/);
  let html = fence ? fence[1] : source;
  if (!/<html|<!doctype/i.test(html)) {
    const start = html.search(/<!doctype html|<html/i);
    if (start >= 0) html = html.slice(start);
  }
  const end = html.toLowerCase().lastIndexOf('</html>');
  if (end >= 0) html = html.slice(0, end + 7);
  return html.trim();
}

export function validateHtml(html) {
  const issues = [];
  const text = String(html || '');
  if (text.length < 600) issues.push('产物为空或长度严重不足，可能生成失败');
  if (!/<html[\s>]/i.test(text) || !/<\/html>/i.test(text)) issues.push('缺少完整的 <html> … </html> 结构（多半是输出被长度上限截断）');
  if (!/<script[\s>]/i.test(text)) issues.push('没有任何脚本逻辑，无法形成真实交互');
  if (!/atoms\.store/.test(text)) issues.push('没有调用 window.atoms.store()，数据无法持久化');
  if (/<script[^>]+src=/i.test(text)) issues.push('引用了外部脚本（<script src>），在离线沙箱里会加载失败');
  if (/<link[^>]+href=["']https?:/i.test(text)) issues.push('引用了外部样式（<link href>）');
  if (/<img[^>]+src=["']https?:/i.test(text)) issues.push('引用了外链图片');
  if (/@import\s+url\(/i.test(text)) issues.push('CSS 里引用了外部字体或样式');
  return issues;
}

function parsePlan(raw, prompt) {
  try {
    const jsonText = String(raw).replace(/```json|```/g, '').trim();
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    const parsed = JSON.parse(jsonText.slice(start, end + 1));
    return {
      title: String(parsed.title || '未命名应用').slice(0, 20),
      summary: String(parsed.summary || '').slice(0, 120),
      features: Array.isArray(parsed.features) ? parsed.features.slice(0, 6).map(String) : [],
      dataModel: Array.isArray(parsed.dataModel) ? parsed.dataModel.slice(0, 4) : [],
      sections: Array.isArray(parsed.sections) ? parsed.sections.slice(0, 6).map(String) : [],
      notes: String(parsed.implementation_notes || ''),
    };
  } catch {
    return {
      title: '未命名应用',
      summary: '模型未返回结构化方案，已按原始需求直接生成。',
      features: [],
      dataModel: [],
      sections: [],
      notes: String(prompt).slice(0, 60),
    };
  }
}

/* ------------------------------- 主流程 ------------------------------- */

/**
 * 跑完一次「需求 → 应用」的完整管线。
 * @param {object} deps { llm }
 * @param {object} input { prompt, currentHtml, history, emit, signal }
 * @returns {Promise<{plan, html, title, note, issues, repaired}>}
 */
export async function runPipeline({ llm, prompt, currentHtml = null, history = [], emit = () => {}, signal }) {
  const isRefine = Boolean(currentHtml);

  /* ---- 阶段一：Emma + Bob 产出方案 ---- */
  emit({ type: 'step', id: 'plan', agent: 'emma', status: 'running', label: '理解需求，拆解方案' });
  let plan;
  if (llm.mode === 'mock') {
    await tick(420);
    plan = mockPlan(prompt, {
      previousTitle: isRefine ? history?.title || null : null,
      previousHtml: isRefine ? currentHtml : null,
    });
  } else {
    const context = isRefine
      ? `用户要在已有应用「${history.title || '当前应用'}」上做一次修改。需求：${prompt}`
      : `用户需求：${prompt}`;
    const messages = [
      { role: 'system', content: PLANNER_SYSTEM },
      { role: 'user', content: context },
    ];
    let raw;
    try {
      raw = await llm.chat({ messages, temperature: 0.4, maxTokens: 900, jsonMode: true, signal });
    } catch {
      // 部分 OpenAI 兼容接口不支持 response_format，退一步用纯文本再试一次
      raw = await llm.chat({ messages, temperature: 0.4, maxTokens: 900, signal });
    }
    plan = parsePlan(raw, prompt);
  }

  // Mock 模式遇到明确超出能力范围的需求（视频、文档、原生 App…）时如实告知，
  // 不硬编一个不相干的应用出来
  if (plan.unsupported) {
    emit({ type: 'unsupported', message: plan.message });
    return { unsupported: true, message: plan.message };
  }

  emit({ type: 'plan', plan });
  emit({ type: 'step', id: 'plan', agent: 'emma', status: 'done', label: '方案已确定' });

  /* ---- 阶段二：Alex 流式产出代码 ---- */
  emit({ type: 'step', id: 'build', agent: 'alex', status: 'running', label: isRefine ? '按新需求重写应用' : '编写完整应用' });
  let rawCode = '';
  let thinkingFallback = false;
  let truncated = false;
  if (llm.mode === 'mock') {
    const html = buildMockApp(plan);
    // 分段吐出，让界面上的打字机效果和真实模型一致
    const chunk = 320;
    for (let i = 0; i < html.length; i += chunk) {
      rawCode += html.slice(i, i + chunk);
      emit({ type: 'delta', text: html.slice(i, i + chunk) });
      await tick(12);
    }
  } else {
    const userContent = isRefine
      ? [
          `产品方案：${JSON.stringify({ title: plan.title, features: plan.features, dataModel: plan.dataModel })}`,
          `用户这次的修改需求：${prompt}`,
          '下面是当前版本的应用源码，请在此基础上修改，并输出修改后的完整文件（不要只给 diff，也不要省略未改动的部分）：',
          '```html',
          currentHtml.slice(0, 40000),
          '```',
        ].join('\n')
      : [
          `用户需求：${prompt}`,
          `产品方案：${JSON.stringify({ title: plan.title, features: plan.features, dataModel: plan.dataModel, sections: plan.sections, notes: plan.notes })}`,
          '请按方案实现这个应用。',
        ].join('\n');
    const builderMessages = [
      { role: 'system', content: BUILDER_SYSTEM },
      { role: 'user', content: userContent },
    ];
    try {
      const streamed = await llm.chatStream({
        messages: builderMessages,
        temperature: 0.6,
        maxTokens: Number(process.env.LLM_MAX_TOKENS || 8000),
        signal,
        onDelta: (text) => emit({ type: 'delta', text }),
        onThinking: (text) => emit({ type: 'thinking', text }),
      });
      rawCode = streamed.text;
      thinkingFallback = streamed.thinkingFallback;
      truncated = streamed.truncated;
      if (thinkingFallback) emit({ type: 'notice', message: '该模型把正文写进了思考过程，已自动从中提取代码' });
      if (truncated) emit({ type: 'notice', message: '输出触达长度上限被截断，正在让质检 Agent 精简重写' });
    } catch (err) {
      // 接口不支持流式时退回一次性返回，把完整文本当作一次 delta 发出，前端逻辑不变
      if (signal?.aborted) throw err;
      rawCode = await llm.chat({
        messages: builderMessages,
        temperature: 0.6,
        maxTokens: Number(process.env.LLM_MAX_TOKENS || 8000),
        signal,
      });
      emit({ type: 'delta', text: rawCode });
    }
  }
  let html = extractHtml(rawCode);
  emit({ type: 'step', id: 'build', agent: 'alex', status: 'done', label: '应用已生成' });

  /* ---- 阶段三：Ada 静态自检 + 一轮自动修复 ---- */
  emit({ type: 'step', id: 'verify', agent: 'ada', status: 'running', label: '检查代码与数据层' });
  let issues = validateHtml(html);
  let repaired = false;
  if (issues.length) {
    emit({ type: 'issues', issues });
    if (llm.mode === 'mock') {
      // Mock 模板本身是合规的，走到这里说明是异常输入，兜底重生成一次
      html = buildMockApp(mockPlan(prompt, {
        previousTitle: isRefine ? history?.title || null : null,
        previousHtml: isRefine ? currentHtml : null,
      }));
      issues = validateHtml(html);
    } else {
      emit({ type: 'step', id: 'repair', agent: 'ada', status: 'running', label: '发现问题，自动修复中' });
      const fixed = await llm.chat({
        messages: [
          { role: 'system', content: BUILDER_SYSTEM },
          {
            role: 'user',
            content: [
              '下面这份产物没有通过质检，请修复后重新输出完整的 HTML 文件（只输出代码块）。',
              `问题清单：\n- ${issues.join('\n- ')}`,
              truncated ? '重要：上一次输出因为长度上限被截断。请精简实现（压缩样式、少写注释、砍掉非核心功能），确保这次能输出完整闭合的文件。' : '',
              '```html',
              html.slice(0, 40000),
              '```',
            ].filter(Boolean).join('\n'),
          },
        ],
        temperature: 0.3,
        maxTokens: Number(process.env.LLM_MAX_TOKENS || 8000),
        signal,
      });
      html = extractHtml(fixed);
      issues = validateHtml(html);
      repaired = true;
      emit({ type: 'step', id: 'repair', agent: 'ada', status: 'done', label: issues.length ? '修复后仍有告警' : '已自动修复' });
    }
  }
  emit({ type: 'step', id: 'verify', agent: 'ada', status: issues.length ? 'warn' : 'done', label: issues.length ? `仍有 ${issues.length} 项告警` : '质检通过' });

  const finalHtml = ensureViewport(html);
  return {
    plan,
    html: finalHtml,
    title: plan.title,
    note: thinkingFallback ? `${plan.summary}（模型把正文写在思考过程里，已自动提取）` : plan.summary,
    issues,
    repaired,
  };
}

/** 运行时错误触发的第二轮修复：把真实报错喂回给质检 Agent。 */
export async function repairFromRuntimeError({ llm, html, error, prompt }) {
  if (llm.mode === 'mock') return null;
  const fixed = await llm.chat({
    messages: [
      { role: 'system', content: BUILDER_SYSTEM },
      {
        role: 'user',
        content: [
          '这份应用在被真实打开时抛出了运行时错误，请定位并修复，输出修复后的完整 HTML 文件（只输出代码块）。',
          `原始需求：${prompt || '（未记录）'}`,
          `浏览器报错：${error}`,
          '```html',
          String(html).slice(0, 40000),
          '```',
        ].join('\n'),
      },
    ],
    temperature: 0.2,
    maxTokens: Number(process.env.LLM_MAX_TOKENS || 8000),
  });
  const next = extractHtml(fixed);
  return validateHtml(next).length ? null : ensureViewport(next);
}

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export { injectSdk };
