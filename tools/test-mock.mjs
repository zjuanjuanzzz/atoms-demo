/**
 * Mock 生成器测试：确认各类需求都能落到正确的产物形态，且产物通过质检规则。
 * 这里直接调用生成器，不走 HTTP，跑得很快。
 */
import { mockPlan, buildMockApp } from '../src/mock-builder.js';
import { validateHtml } from '../src/agent.js';

const CASES = [
  { prompt: '做一个射击游戏', expect: 'game' },
  { prompt: '帮我做一个打靶小游戏，能记录最高分', expect: 'game' },
  { prompt: '做一个咖啡店官网', expect: 'landing' },
  { prompt: '帮我做一个摄影工作室的作品集主页', expect: 'landing' },
  { prompt: '做一个门店巡检记录工具', expect: 'ledger' },
  { prompt: '团队任务看板，能按状态筛选', expect: 'ledger' },
  { prompt: '一个完全没听过的需求：「火星殖民地的氧气配额」', expect: 'ledger' },
  { prompt: '帮我拍一个公司宣传视频', expect: 'unsupported' },
  { prompt: '写一份季度经营分析报告', expect: 'unsupported' },
  { prompt: '做一个 iOS 原生 App', expect: 'unsupported' },
];

let failures = 0;
for (const item of CASES) {
  const plan = mockPlan(item.prompt);
  const kind = plan.unsupported ? 'unsupported' : plan._game ? 'game' : plan._landing ? 'landing' : 'ledger';
  const okKind = kind === item.expect;
  let extra = '';
  if (!plan.unsupported) {
    const html = buildMockApp(plan);
    const issues = validateHtml(html);
    const okHtml = issues.length === 0;
    if (!okHtml) failures++;
    extra = `${plan.title} · ${Math.round(html.length / 1024)}KB${okHtml ? ' · 质检通过' : ' · 质检失败: ' + issues.join('；')}`;
  } else {
    extra = plan.message.slice(0, 34) + '…';
  }
  if (!okKind) failures++;
  console.log(`${okKind ? '  ✓' : '  ✗'} ${item.prompt} → ${kind}${okKind ? '' : `（期望 ${item.expect}）`}\n      ${extra}`);
}

console.log(`\n结果：${failures === 0 ? '全部通过' : failures + ' 项失败'}\n`);
process.exit(failures === 0 ? 0 : 1);
