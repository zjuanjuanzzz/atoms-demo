/**
 * Turso 驱动一致性测试：驱动 → 本地 hrana 模拟服务 → node:sqlite 内存库。
 * 覆盖 store 全部对外接口，验证 hrana 编解码、建表、CRUD 与业务方法。
 * 用法: node _turso_test.mjs
 */
import { spawn } from 'node:child_process';
import { createStore } from '../src/store.js';

const MOCK_PORT = 9902;
const TOKEN = 'test-token';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${detail}`); }
}

// 起模拟服务
const mock = spawn(process.execPath, ['tools/turso-mock.mjs', String(MOCK_PORT)], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  mock.stdout.on('data', (d) => { if (String(d).includes('listening')) resolve(); });
  mock.on('error', reject);
  setTimeout(resolve, 1500);
});

try {
  console.log('\n[1] 驱动初始化 + 建表');
  const store = await createStore({
    driver: 'turso',
    url: `http://127.0.0.1:${MOCK_PORT}`,
    token: TOKEN,
  });
  check('driver 名称为 turso', store.driver === 'turso');

  console.log('\n[2] 账号与会话');
  const user = await store.createUser({ email: 'test@example.com', name: '测试同学', passwordHash: 'hash', salt: 'salt', isGuest: false });
  check('createUser 返回完整字段', user && user.id && user.email === 'test@example.com' && user.workspaceId, JSON.stringify(user));
  const byEmail = await store.getUserByEmail('test@example.com');
  check('getUserByEmail 带密码字段', byEmail && byEmail.passwordHash === 'hash' && byEmail.salt === 'salt');
  const token = await store.createSession({ userId: user.id, ttlMs: 60000 });
  const sessionUser = await store.getSessionUser(token);
  check('会话反查用户', sessionUser && sessionUser.id === user.id);
  await store.deleteSession(token);
  check('删除会话后失效', (await store.getSessionUser(token)) === null);
  const renamed = await store.updateUserName(user.id, '新名字');
  check('改名', renamed && renamed.name === '新名字');

  console.log('\n[3] 项目与版本');
  const project = await store.createProject({ workspaceId: user.workspaceId, title: '测试项目', prompt: '做一个测试' });
  check('createProject', project && project.id && project.title === '测试项目');
  const list = await store.listProjects(user.workspaceId);
  check('listProjects', list.length === 1 && list[0].id === project.id);
  const bigHtml = '<!doctype html><html lang="zh-CN"><body>中文内容测试' + 'x'.repeat(20000) + '</body></html>';
  const v1 = await store.addVersion({ projectId: project.id, title: '第一版', note: '初始', prompt: 'p', html: bigHtml });
  check('addVersion 返回 html', v1 && v1.html === bigHtml && v1.id);
  const v2 = await store.addVersion({ projectId: project.id, title: '第二版', note: '迭代', prompt: 'p2', html: bigHtml.slice(0, 5000) });
  const versions = await store.listVersions(project.id);
  check('listVersions 倒序且 size 正确', versions.length === 2 && versions[0].id === v2.id && versions[0].size === 5000, JSON.stringify(versions.map((v) => v.size)));
  const gotV1 = await store.getVersionInProject(project.id, v1.id);
  check('getVersionInProject', gotV1 && gotV1.html === bigHtml);
  const latest = await store.getLatestVersion(project.id);
  check('getLatestVersion', latest && latest.id === v2.id);
  const restored = await store.updateProject(project.id, { currentVersionId: v1.id, published: true, slug: 'test-slug' });
  check('updateProject（恢复/发布/slug）', restored.currentVersionId === v1.id && restored.published === true && restored.slug === 'test-slug');
  const bySlug = await store.getProjectBySlug('test-slug');
  check('getProjectBySlug', bySlug && bySlug.id === project.id);
  await store.addMessage({ projectId: project.id, role: 'user', content: '你好', meta: { a: 1 } });
  const msgs = await store.listMessages(project.id);
  check('消息 meta JSON 往返', msgs.length === 1 && msgs[0].meta && msgs[0].meta.a === 1);

  console.log('\n[4] 生成物数据层');
  const rec = await store.dataInsert(project.id, '巡检记录', { point: '一楼生鲜区', result: '正常' });
  check('dataInsert 补 id/createdAt', rec.id && rec.createdAt);
  await store.dataInsert(project.id, '巡检记录', { point: '二楼', result: '异常' });
  await store.dataUpdate(project.id, '巡检记录', rec.id, { result: '待处理' });
  const rows = await store.dataList(project.id, '巡检记录');
  check('dataUpdate 后 dataList 读回', rows.length === 2 && rows.find((r) => r.id === rec.id).result === '待处理');
  const stats = await store.dataStats(project.id);
  check('dataStats 分组计数', stats.length === 1 && stats[0].collection === '巡检记录' && stats[0].count === 2, JSON.stringify(stats));
  await store.dataRemove(project.id, '巡检记录', rec.id);
  check('dataRemove', (await store.dataList(project.id, '巡检记录')).length === 1);
  await store.dataClear(project.id, '巡检记录');
  check('dataClear', (await store.dataList(project.id, '巡检记录')).length === 0);

  console.log('\n[5] 平台配置（LLM Key 等）');
  await store.saveConfig({ apiKey: 'sk-test-1234567890', model: 'glm-4-flash' });
  const cfg = await store.getConfig();
  check('配置读写往返', cfg.apiKey === 'sk-test-1234567890' && cfg.model === 'glm-4-flash');

  console.log('\n[6] 删除项目级联清理');
  await store.deleteProject(project.id);
  check('删除后项目不存在', (await store.getProject(project.id)) === null);
  check('版本被清理', (await store.listVersions(project.id)).length === 0);

  console.log('\n[7] 错误鉴权');
  let threw = false;
  try {
    await createStore({ driver: 'turso', url: `http://127.0.0.1:${MOCK_PORT}`, token: 'wrong-token' });
  } catch { threw = true; }
  check('错误 token 初始化抛错（供上层回退）', threw);

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
} finally {
  mock.kill();
}
process.exit(fail ? 1 : 0);