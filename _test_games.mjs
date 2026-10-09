import { mockPlan, buildMockApp } from './src/mock-builder.js';

const cases = [
  { prompt: '做一个2048游戏', expectKind: '2048', markers: ['board2048', 'slideLine', '2048 数字合成'] },
  { prompt: '帮我做一个贪吃蛇小游戏', expectKind: 'snake', markers: ['贪吃蛇', 'getContext', 'placeFood'] },
  { prompt: '做一个射击小游戏', expectKind: 'shoot', markers: ['打靶射击小游戏', 'spawn'] },
  { prompt: '做一个任务看板', expectKind: null, markers: ['团队任务看板'] },
  { prompt: '做一个物流签收登记表，记录运单号、签收人和签收时间', expectKind: null, markers: ['物流签收登记表', '运单号'] },
];

let fail = 0;
for (const c of cases) {
  const plan = mockPlan(c.prompt, {});
  const kindOk = plan._game === undefined ? c.expectKind === null : plan._game === c.expectKind;
  const app = buildMockApp(plan);
  const markerOk = c.markers.every((m) => app.includes(m));
  const status = kindOk && markerOk ? 'PASS' : 'FAIL';
  if (status === 'FAIL') fail++;
  console.log(`[${status}] ${c.prompt}`);
  console.log(`   kind=${plan._game ?? 'data'} | title=${plan.title} | html=${app.length} bytes | markers=${markerOk}`);
}
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);