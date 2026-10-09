import { mockPlan, buildMockApp } from './src/mock-builder.js';
const prompts = [
  '做一个物流签收登记表，记录运单号、签收人和签收时间',
  '帮我做一个会员到店登记，记录会员姓名、手机号和到店时间',
  '做一个会议纪要工具，记录主题、参与人、结论和跟进事项',
  '随便做个东西',
];
let bad = 0;
for (const p of prompts) {
  const plan = mockPlan(p, {});
  const app = buildMockApp(plan);
  const t = plan._template;
  const ok = t.fields.every((f) => app.includes(f.label)) && t.sample.every((r) => Object.keys(r).length === t.fields.length);
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} | ${plan.title} | ${t.collection} | ${t.fields.map((f) => `${f.label}(${f.type})`).join(', ')} | html=${app.length}`);
}
process.exit(bad ? 1 : 0);