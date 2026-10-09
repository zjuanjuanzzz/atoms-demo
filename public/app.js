/**
 * Atoms Demo 前端。
 *
 * 单向数据流：state → render。所有网络调用集中在 api 里。
 * 界面分两屏：工作台（Home）和项目工作台（对话 + App Viewer）。
 */

const $ = (id) => document.getElementById(id);

/* --------------------------------- 状态 --------------------------------- */

const state = {
  user: null,
  projects: [],
  project: null,
  messages: [],
  versions: [],
  dataStats: [],
  dataCollection: null,
  dataRows: [],
  tab: 'preview',
  device: 'desktop',
  currentVersionId: null,
  streaming: false,
  steps: [],
  plan: null,
  codeText: '',
  thinkingLength: 0,
  issues: [],
  autofixTried: new Set(),
  freshVersions: new Set(),
  health: null,
};

const TEAM = [
  { id: 'emma', name: 'Emma', role: '产品经理', emoji: '🧩', desc: '把一句话需求拆成可实现的方案' },
  { id: 'bob', name: 'Bob', role: '架构师', emoji: '📐', desc: '确定数据结构与页面结构' },
  { id: 'alex', name: 'Alex', role: '工程师', emoji: '⌨️', desc: '写出可直接运行的单文件应用' },
  { id: 'ada', name: 'Ada', role: '质检', emoji: '🔍', desc: '静态检查与运行时报错自动修复' },
];

/** 首页示例库：打字机与卡片墙共用同一份数据，避免两处文案对不上 */
const EXAMPLE_LIBRARY = [
  { icon: '🧭', tag: '门店', title: '门店巡检记录', desc: '记录巡检点位、结果和备注，手机上也能用', prompt: '帮我做一个门店巡检记录工具，记录巡检点位、结果和备注，手机上也要好用' },
  { icon: '🗂️', tag: '团队', title: '团队任务看板', desc: '按状态筛选任务、指派负责人、盯截止时间', prompt: '做一个团队任务看板，能按状态筛选、指派负责人，并且能看到截止日期' },
  { icon: '💰', tag: '个人', title: '个人记账本', desc: '记录每笔金额与分类，自动算当月支出', prompt: '做一个个人记账本，记录每笔金额和分类，能看当月总支出' },
  { icon: '🤝', tag: '销售', title: '客户跟进表', desc: '记录客户阶段与下次跟进时间', prompt: '做一个客户跟进表，记录客户所处的阶段和下次跟进时间，别漏掉线索' },
  { icon: '📦', tag: '仓储', title: '库存台账', desc: '低于安全库存时自动高亮提醒', prompt: '做一个库存台账，记录物料数量，低于安全库存时高亮提醒' },
  { icon: '✅', tag: '个人', title: '习惯打卡表', desc: '每天打卡，统计连续坚持的天数', prompt: '做一个习惯打卡表，每天打卡并统计连续坚持了多少天' },
  { icon: '🧾', tag: '团队', title: '报销申请台账', desc: '记录金额、事由与审批状态', prompt: '做一个报销申请台账，记录金额、事由和审批状态，方便随时查询' },
  { icon: '🛠️', tag: '运维', title: '设备维修工单', desc: '报修、派单、完成状态全流程跟踪', prompt: '做一个设备维修工单，从报修到派单再到完成都能跟踪状态' },
  { icon: '🎫', tag: '活动', title: '活动报名登记', desc: '收集报名信息，随时导出名单', prompt: '做一个活动报名登记工具，收集姓名电话和备注，能查看报名名单' },
  { icon: '🎓', tag: '教育', title: '班级成绩登记', desc: '录入分数，查看平均分与排名', prompt: '做一个班级成绩登记表，录入学生分数，能看平均分和排名' },
  { icon: '🏋️', tag: '健康', title: '健身训练日志', desc: '记录动作、组数、重量和次数', prompt: '做一个健身训练日志，记录每次的动作、组数、重量和次数' },
  { icon: '📚', tag: '学习', title: '读书笔记管理', desc: '记录书名、阅读进度和摘录', prompt: '做一个读书笔记管理工具，记录书名、阅读进度和精彩的句子摘录' },
  { icon: '🚚', tag: '仓储', title: '物流签收登记', desc: '记录运单号、签收人和到货时间', prompt: '做一个物流签收登记表，记录运单号、签收人和到货时间' },
  { icon: '📅', tag: '团队', title: '每周排班表', desc: '安排班次，查看每人本周工时', prompt: '做一个每周排班表，可以安排班次并查看每个人这周的工时' },
  { icon: '🩺', tag: '生活', title: '宠物健康记录', desc: '疫苗、驱虫和就诊记录一目了然', prompt: '做一个宠物健康记录，记录疫苗、驱虫和每次就诊的情况' },
  { icon: '🏠', tag: '生活', title: '房屋租客台账', desc: '记录租客、租金与到期日', prompt: '做一个房屋租客台账，记录租客信息、租金金额和租约到期日' },
  { icon: '💡', tag: '个人', title: '想法收集箱', desc: '随手记下点子，打上标签', prompt: '做一个想法收集箱，随手记录点子并给它们打标签' },
  { icon: '🍜', tag: '门店', title: '点单收款小工具', desc: '选菜、算总价、生成取餐号', prompt: '做一个餐饮点单小工具，可以选菜、自动算总价并生成取餐号' },
];

const EXAMPLES_PER_PAGE = 6;
let exampleOffset = 0;

/* --------------------------------- 请求 --------------------------------- */

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    showAuth();
    throw new Error(json.error || '请先登录');
  }
  if (!res.ok) throw new Error(json.error || `请求失败（${res.status}）`);
  return json;
}

/* --------------------------------- 工具 --------------------------------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - Number(ts);
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

function toast(message) {
  const box = $('host-toast');
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(box.__t);
  box.__t = setTimeout(() => box.classList.remove('show'), 2200);
}

function slugify(text) {
  const ascii = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return ascii.length >= 3 ? ascii.slice(0, 24) : `atom-app-${Math.random().toString(36).slice(2, 8)}`;
}

function openModal(html) {
  $('modal').innerHTML = html;
  $('modalBackdrop').hidden = false;
}

function closeModal() {
  $('modalBackdrop').hidden = true;
  $('modal').innerHTML = '';
}

$('modalBackdrop').addEventListener('click', (ev) => { if (ev.target === $('modalBackdrop')) closeModal(); });

/* ------------------------------ 初始化与工作台 ------------------------------ */

async function boot() {
  renderExamples();
  renderTeam();
  startTyper();
  bindAuth();
  window.__ATOMS_SET_ERROR_HANDLER__((message) => onRuntimeError(message));
  window.__ATOMS_ON_DATA_CHANGE__ = () => { if (state.tab === 'data') loadData(); };
  window.__ATOMS_REGISTER_FRAME__($('stage'));

  try {
    state.health = await api('/api/health');
    renderEnv();
  } catch {
    $('envText').textContent = '服务未连接';
  }

  let me = null;
  try {
    me = (await api('/api/auth/me')).user;
  } catch {
    me = null;
  }
  if (!me) return showAuth();
  await enterApp(me);
  return maybeHandleRemix();
}

/** 登录后进入工作台 */
async function enterApp(user) {
  state.user = user;
  $('auth').hidden = true;
  $('project').hidden = true;
  $('home').hidden = false;
  renderWorkspace();
  await loadProjects();
}

/**
 * 从分享页带 ?remix=<项目ID> 进来时，登录后自动复刻一份到自己工作区。
 * 未登录的访客会先看到注册/登录，登录完成后再继续这次复刻。
 */
async function maybeHandleRemix() {
  const remixId = new URLSearchParams(location.search).get('remix');
  if (!remixId) return false;
  history.replaceState({}, '', location.pathname);
  try {
    const { project } = await api(`/api/projects/${remixId}/remix`, { method: 'POST', body: {} });
    await loadProjects();
    await openProject(project.id);
    toast('已复刻到你的工作区，可以直接继续修改');
  } catch (err) {
    toast(`复刻失败：${err.message}`);
  }
  return true;
}

function showAuth() {
  state.user = null;
  state.project = null;
  $('auth').hidden = false;
  $('home').hidden = true;
  $('project').hidden = true;
  $('stage').src = 'about:blank';
  closeModal();
}

let authMode = 'register';

function bindAuth() {
  $('authTabs').addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (!tab) return;
    authMode = tab.dataset.mode;
    document.querySelectorAll('#authTabs .tab').forEach((b) => b.classList.toggle('active', b === tab));
    $('authNameWrap').hidden = authMode !== 'register';
    $('authSubmit').textContent = authMode === 'register' ? '创建账号并进入' : '登录';
  });

  $('authForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('authSubmit');
    btn.disabled = true;
    try {
      const email = $('authEmail').value.trim();
      const password = $('authPassword').value;
      const body = authMode === 'register'
        ? { email, password, name: $('authName').value.trim() }
        : { email, password };
      const { user } = await api(authMode === 'register' ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body });
      await enterApp(user);
      await maybeHandleRemix();
      toast(authMode === 'register' ? '账号已创建，开始你的第一个项目吧' : `欢迎回来，${user.name}`);
    } catch (err) {
      toast(err.message);
    }
    btn.disabled = false;
  });

  $('authGuest').addEventListener('click', async () => {
    try {
      const { user } = await api('/api/auth/guest', { method: 'POST', body: {} });
      await enterApp(user);
      await maybeHandleRemix();
      toast('已进入体验账号，项目与数据都保存在这个账号下');
    } catch (err) {
      toast(err.message);
    }
  });
}

function renderWorkspace() {
  if (!state.user) return;
  $('wsName').textContent = state.user.name;
  $('wsAvatar').textContent = state.user.name.slice(0, 1).toUpperCase();
}

function renderEnv() {
  const h = state.health;
  if (!h) return;
  const live = h.llm === 'live';
  const sourceLabel = h.keySource === 'env' ? '环境变量' : '界面配置';
  $('envDot').className = `dot ${live ? 'live' : 'mock'}`;
  $('envText').textContent = live ? `真实模型 · ${h.model}` : 'Mock 演示模式 · 点此配置';
  $('envText').title = live
    ? `已通过${sourceLabel}接入真实模型，生成结果由模型实时产出`
    : '还没有配置 API Key：当前使用内置生成器，点击即可配置真实模型';
}

/* ------------------------------ 模型设置 ------------------------------ */

/** 常见 OpenAI 兼容服务商预设：一键填好地址与模型名，省得手打出错 */
const PROVIDER_PRESETS = [
  { key: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', note: '国内可直连 · 性价比高' },
  { key: 'moonshot', label: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-latest', note: '国内可直连' },
  { key: 'siliconflow', label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', note: '模型选择多' },
  { key: 'glm', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus', note: '' },
  { key: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', note: '' },
  { key: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', note: '需要能访问 openai.com' },
];

async function openSettingsModal() {
  let s = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hasKey: false, maskedKey: '', source: 'none' };
  try { s = await api('/api/settings'); } catch { /* 服务异常时用默认值兜底 */ }
  openModal(`
    <h2>模型设置</h2>
    <p class="modal-sub">配置任意 OpenAI 兼容接口后，应用生成由真实模型完成；不配置则使用内置生成器（Mock 模式），主流程同样可以完整走通。</p>

    <label>快速选择服务商</label>
    <div class="preset-row">
      ${PROVIDER_PRESETS.map((p) => `<button type="button" class="preset" data-preset="${p.key}" title="${esc(p.note)}">${esc(p.label)}</button>`).join('')}
    </div>

    <label for="setBaseUrl">接口地址</label>
    <input type="text" id="setBaseUrl" value="${esc(s.baseUrl)}" placeholder="https://api.deepseek.com/v1">
    <p class="hint" style="margin:6px 0 0;line-height:1.7">要填 <b>API 接口地址</b>，不是服务商的控制台或官网地址。</p>

    <label for="setModel">模型名</label>
    <input type="text" id="setModel" value="${esc(s.model)}" placeholder="gpt-4o-mini">

    <label for="setApiKey">API Key${s.hasKey ? `（已配置：${esc(s.maskedKey)}）` : ''}</label>
    <input type="password" id="setApiKey" autocomplete="off" spellcheck="false" placeholder="${s.hasKey ? '留空表示不修改' : 'sk-... 粘贴到这里，只保存在服务端'}">

    <p class="hint" style="margin:10px 0 0;line-height:1.8">
      先点「测试连接」确认能通，再点「保存」。Key 只保存在服务端，读取接口只返回掩码，不会回传到浏览器。<br>
      公开部署时注意：任何注册用户都能替换或消耗这个 Key。
    </p>

    <div class="modal-actions">
      <button class="btn" id="setTest">测试连接</button>
      ${s.hasKey ? '<button class="btn" id="setClear">清除 Key</button>' : ''}
      <button class="btn primary" id="setSave">保存</button>
    </div>
  `);

  const payload = () => ({
    baseUrl: $('setBaseUrl').value.trim(),
    model: $('setModel').value.trim(),
    apiKey: $('setApiKey').value.trim(),
  });

  $('modal').querySelectorAll('[data-preset]').forEach((btn) => btn.addEventListener('click', () => {
    const preset = PROVIDER_PRESETS.find((p) => p.key === btn.dataset.preset);
    if (!preset) return;
    $('setBaseUrl').value = preset.baseUrl;
    $('setModel').value = preset.model;
    $('modal').querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b === btn));
    toast(`已填入 ${preset.label} 的地址与模型名，粘贴 Key 后点「测试连接」`);
  }));

  $('setTest').addEventListener('click', async () => {
    const btn = $('setTest');
    btn.disabled = true;
    btn.textContent = '测试中…';
    try {
      const sent = payload();
      const r = await api('/api/settings/test', { method: 'POST', body: sent });
      const corrected = r.baseUrl && r.baseUrl !== sent.baseUrl ? `（地址已自动更正为 ${r.baseUrl}）` : '';
      if (r.ok) toast(`连接成功：${r.model} 返回「${r.reply}」${corrected}`);
      else toast(`连接失败：${r.error}${corrected}`);
    } catch (err) {
      toast(err.message);
    }
    btn.disabled = false;
    btn.textContent = '测试连接';
  });

  $('setSave').addEventListener('click', async () => {
    try {
      const r = await api('/api/settings', { method: 'POST', body: payload() });
      state.health = await api('/api/health');
      renderEnv();
      closeModal();
      if (r.corrected) toast(`接口地址已自动更正为 ${r.baseUrl}`);
      else toast(r.llm === 'live' ? `已启用真实模型：${r.model}` : '已保存，当前仍是 Mock 演示模式');
    } catch (err) {
      toast(err.message);
    }
  });

  if ($('setClear')) {
    $('setClear').addEventListener('click', async () => {
      await api('/api/settings', { method: 'POST', body: { clearKey: true } });
      state.health = await api('/api/health');
      renderEnv();
      closeModal();
      toast('已清除 Key，回到 Mock 演示模式');
    });
  }
}

function renderTeam() {
  $('teamGrid').innerHTML = TEAM.map((a, i) => `
    <div class="agent-card" data-agent="${a.id}" style="--i:${i}">
      <div class="emoji">${a.emoji}</div>
      <div class="name">${a.name}</div>
      <div class="role">${a.role}</div>
      <div class="desc">${a.desc}</div>
    </div>
  `).join('');
}

function renderExamples() {
  const total = EXAMPLE_LIBRARY.length;
  const items = Array.from({ length: EXAMPLES_PER_PAGE }, (_, i) => EXAMPLE_LIBRARY[(exampleOffset + i) % total]);
  $('examples').innerHTML = items.map((e, i) => `
    <button type="button" class="example-card" style="--i:${i}" data-prompt="${esc(e.prompt)}">
      <div class="ec-top">
        <span class="ec-icon">${e.icon}</span>
        <span class="ec-title">${esc(e.title)}</span>
        <span class="ec-tag">${esc(e.tag)}</span>
      </div>
      <div class="ec-desc">${esc(e.desc)}</div>
    </button>
  `).join('');
}

/* ------------------------- 首页打字机占位效果 ------------------------- */

const typer = { index: 0, char: 0, deleting: false, timer: null };

/** 只有「输入框为空 + 未聚焦 + 不在工作台上」时才播放，避免打断真正的输入 */
function ghostVisible() {
  const box = $('homePrompt');
  return !box.value && document.activeElement !== box && !$('home').hidden;
}

function updateGhost() {
  $('promptGhost').classList.toggle('show', ghostVisible());
}

function renderGhost(text) {
  $('promptGhost').innerHTML = `${esc(text)}<span class="caret"></span>`;
}

function startTyper() {
  const loop = () => {
    if (!ghostVisible()) {
      $('promptGhost').classList.remove('show');
      typer.timer = setTimeout(loop, 300);
      return;
    }
    const full = EXAMPLE_LIBRARY[typer.index % EXAMPLE_LIBRARY.length].prompt;
    let delay = 52;
    if (!typer.deleting) {
      typer.char += 1;
      if (typer.char >= full.length) { typer.deleting = true; delay = 1500; }
    } else {
      typer.char -= 3;
      delay = 20;
      if (typer.char <= 0) { typer.char = 0; typer.deleting = false; typer.index += 1; delay = 300; }
    }
    $('promptGhost').classList.add('show');
    renderGhost(full.slice(0, typer.char));
    typer.timer = setTimeout(loop, delay);
  };
  typer.timer = setTimeout(loop, 700);
}

/* ------------------------------- 项目列表 ------------------------------- */

async function loadProjects() {
  const { projects } = await api('/api/projects');
  state.projects = projects;
  renderProjects();
}

function renderProjects() {
  const list = $('projectList');
  if (!state.projects.length) {
    list.innerHTML = '<div class="rail-empty">还没有项目，从右边开始吧</div>';
    $('recentSection').hidden = true;
    return;
  }
  list.innerHTML = state.projects.map((p) => `
    <button class="project-item ${state.project?.id === p.id ? 'active' : ''}" data-id="${p.id}">
      ${esc(p.title)}
      <span class="pi-meta">${p.published ? '已发布 · ' : ''}${timeAgo(p.updatedAt)}</span>
    </button>
  `).join('');
  list.querySelectorAll('.project-item').forEach((btn) => btn.addEventListener('click', () => openProject(btn.dataset.id)));

  $('recentSection').hidden = false;
  $('recentGrid').innerHTML = state.projects.slice(0, 6).map((p) => `
    <button class="recent-card" data-id="${p.id}">
      <div class="rc-title">${esc(p.title)}</div>
      <div class="rc-meta">${p.published ? '已发布 · ' : '草稿 · '}${timeAgo(p.updatedAt)}</div>
    </button>
  `).join('');
  $('recentGrid').querySelectorAll('.recent-card').forEach((btn) => btn.addEventListener('click', () => openProject(btn.dataset.id)));
}

/* ------------------------------- 打开项目 ------------------------------- */

async function openProject(id) {
  const data = await api(`/api/projects/${id}`);
  state.project = data.project;
  state.messages = data.messages;
  state.versions = data.versions;
  state.dataStats = data.dataStats;
  state.dataCollection = null;
  state.currentVersionId = data.project.currentVersionId || data.versions[0]?.id || null;
  state.steps = [];
  state.plan = null;
  state.codeText = '';
  state.thinkingLength = 0;
  state.issues = [];

  window.__ATOMS_APP_ID__ = state.project.id;

  $('home').hidden = true;
  $('project').hidden = false;
  $('projectTitle').value = state.project.title;
  renderPublishBadge();
  renderChat();
  renderProjects();
  setTab('preview');
  if (state.currentVersionId) renderPreview(state.currentVersionId);
  else $('viewerEmpty').hidden = false;
}

function backHome() {
  state.project = null;
  state.currentVersionId = null;
  $('project').hidden = true;
  $('home').hidden = false;
  $('stage').src = 'about:blank';
  renderProjects();
}

function renderPublishBadge() {
  const badge = $('publishBadge');
  if (state.project?.published) {
    badge.textContent = '已发布';
    badge.className = 'badge live';
  } else {
    badge.textContent = '草稿';
    badge.className = 'badge';
  }
}

/* --------------------------------- 对话 --------------------------------- */

function renderChat() {
  const inner = $('chatInner');
  const blocks = [];

  if (!state.messages.length && !state.streaming) {
    blocks.push(`
      <div class="msg">
        <div class="avatar">◈</div>
        <div class="bubble">
          <div class="who">Atoms</div>
          <div class="text">项目已创建。描述你想要的改动，Agent 会基于当前版本继续迭代；右侧可以切到「代码」「数据」查看实现与落库情况。</div>
        </div>
      </div>
    `);
  }

  for (const msg of state.messages) {
    if (msg.role === 'user') {
      blocks.push(`
        <div class="msg user">
          <div class="avatar">你</div>
          <div class="bubble"><div class="text">${esc(msg.content)}</div></div>
        </div>
      `);
    } else {
      const meta = msg.meta || {};
      blocks.push(`
        <div class="msg">
          <div class="avatar">◈</div>
          <div class="bubble">
            <div class="who">Atoms · ${meta.title ? esc(meta.title) : 'Agent 团队'}</div>
            <div class="text">${esc(msg.content)}</div>
            ${meta.plan ? planCard(meta.plan) : ''}
            ${meta.versionId ? versionCard(meta.versionId, meta) : ''}
            ${meta.needsModel ? '<div class="vc-actions"><button class="btn primary" data-open-settings>去配置模型 →</button></div>' : ''}
          </div>
        </div>
      `);
    }
  }

  if (state.streaming) blocks.push(processBlock());
  inner.innerHTML = blocks.join('');
  bindChatActions();
  scrollChat();
}

function planCard(plan) {
  const features = (plan.features || []).map((f) => `<li>${esc(f)}</li>`).join('');
  const collections = (plan.dataModel || [])
    .map((m) => `<code>${esc(m.collection)}</code> ${esc((m.fields || []).join(' / '))}`)
    .join('　');
  return `
    <div class="plan-card">
      <div class="pc-title">📋 方案：${esc(plan.title || '')}</div>
      <div class="pc-sum">${esc(plan.summary || '')}</div>
      ${features ? `<ul>${features}</ul>` : ''}
      ${collections ? `<div class="pc-sum" style="margin-top:8px">数据结构：${collections}</div>` : ''}
    </div>
  `;
}

function versionCard(versionId, meta) {
  const version = state.versions.find((v) => v.id === versionId);
  const isCurrent = state.currentVersionId === versionId;
  return `
    <div class="version-card">
      <div class="vc-head">
        <div class="vc-icon">◈</div>
        <div>
          <div class="vc-title">${esc(version?.title || meta.title || '应用')}${isCurrent ? ' · 当前版本' : ''}</div>
          <div class="vr-meta">${version ? `${Math.round((version.size || 0) / 1024)} KB` : ''}${meta.repaired ? ' · 质检已自动修复' : ''}${meta.autoFix ? ' · 运行时自动修复' : ''}</div>
        </div>
      </div>
      <div class="vc-actions">
        <button class="btn" data-preview="${versionId}">在预览中打开</button>
        <button class="btn" data-export="${versionId}">导出 HTML</button>
      </div>
    </div>
  `;
}

function processBlock() {
  const steps = state.steps.map((s) => {
    const icon = s.status === 'running'
      ? '<div class="spinner"></div>'
      : s.status === 'done' ? '<span style="color:var(--ok)">✓</span>' : '<span style="color:var(--warn)">!</span>';
    return `
      <div class="step ${s.status}">
        <div class="s-icon">${icon}</div>
        <div class="s-body">
          <div class="s-name"><b>${esc(s.agentLabel || '')}</b> ${esc(s.label || '')}</div>
        </div>
      </div>
    `;
  }).join('');
  const tail = state.codeText ? state.codeText.slice(-700) : '';
  const thinking = state.thinkingLength > 200
    ? '<div class="step running"><div class="s-icon"><div class="spinner"></div></div><div class="s-body"><div class="s-name">模型正在思考…</div><div class="s-label">已产生约 '
      + Math.round(state.thinkingLength / 1000) + 'k 字符思考内容。推理型模型会先思考再输出正文</div></div></div>'
    : '';
  const issues = state.issues.length
    ? `<div class="step warn"><div class="s-icon">!</div><div class="s-body"><div class="s-name">质检发现问题：${state.issues.map(esc).join('；')}</div></div></div>`
    : '';
  return `
    <div class="msg">
      <div class="avatar">◈</div>
      <div class="bubble">
        <div class="who">Working Process</div>
        <div class="process">
          <div class="p-head">AI 团队正在协作…</div>
          ${steps}
          ${thinking}
          ${issues}
        </div>
        ${state.plan ? planCard(state.plan) : ''}
        ${tail ? `<div class="stream-preview">${esc(tail)}</div>` : ''}
      </div>
    </div>
  `;
}

function scrollChat() {
  const box = $('chatScroll');
  box.scrollTop = box.scrollHeight;
}

function agentLabel(agentId) {
  const a = TEAM.find((t) => t.id === agentId);
  return a ? `${a.emoji} ${a.name}·${a.role}` : '◈ Atoms';
}

function bindChatActions() {
  $('chatInner').querySelectorAll('[data-preview]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTab('preview');
      renderPreview(btn.dataset.preview);
      toast('已切换到该版本预览');
    });
  });
  $('chatInner').querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', () => exportVersion(btn.dataset.export));
  });
  $('chatInner').querySelectorAll('[data-open-settings]').forEach((btn) => {
    btn.addEventListener('click', openSettingsModal);
  });
}

/* ------------------------------- 流式生成 ------------------------------- */

async function generate(prompt, mode) {
  if (state.streaming) return;
  state.streaming = true;
  state.steps = [];
  state.plan = null;
  state.codeText = '';
  state.issues = [];
  state.messages = [...state.messages, { id: `tmp_${Date.now()}`, role: 'user', content: prompt, meta: null }];
  renderChat();
  setBusy(true);

  try {
    const res = await fetch(`/api/projects/${state.project.id}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, mode }),
    });
    if (!res.ok || !res.body) throw new Error(`生成请求失败（${res.status}）`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let deltaSinceRender = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        let event;
        try { event = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (event.type === 'delta') {
          state.codeText += event.text;
          deltaSinceRender += event.text.length;
          // 高频事件节流，避免每个 token 都重排整个对话
          if (deltaSinceRender > 1200) { deltaSinceRender = 0; renderChat(); }
          continue;
        }
        handleStreamEvent(event);
      }
    }
  } catch (err) {
    toast(err.message);
  } finally {
    state.streaming = false;
    setBusy(false);
    try { await reloadProject(); } catch { /* 忽略刷新失败 */ }
    renderChat();
  }
}

function handleStreamEvent(event) {
  if (event.type === 'step') {
    const next = { ...event, agentLabel: agentLabel(event.agent) };
    const existing = state.steps.find((s) => s.id === event.id);
    if (existing) Object.assign(existing, next);
    else state.steps.push(next);
    renderChat();
    return;
  }
  if (event.type === 'plan') {
    state.plan = event.plan;
    renderChat();
    return;
  }
  if (event.type === 'issues') {
    state.issues = event.issues || [];
    renderChat();
    return;
  }
  if (event.type === 'thinking') {
    // 推理型模型会先思考很久，给个进度，避免看起来像卡住了
    state.thinkingLength += event.text.length;
    if (state.thinkingLength % 900 < event.text.length) renderChat();
    return;
  }
  if (event.type === 'notice') {
    toast(event.message);
    return;
  }
  if (event.type === 'artifact') {
    const v = event.version;
    state.versions = [v, ...state.versions.filter((x) => x.id !== v.id)];
    state.currentVersionId = v.id;
    state.freshVersions.add(v.id);
    state.dataStats = [];
    setTab('preview');
    renderPreview(v.id);
    toast(`《${v.title}》已生成，可以直接点着体验了`);
    return;
  }
  if (event.type === 'error') toast(event.message || '生成失败');
  if (event.type === 'unsupported') toast('这个需求超出了 Mock 模式的能力范围');
}

function setBusy(busy) {
  $('chatSend').disabled = busy;
  $('homeSend').disabled = busy;
  $('chatHint').textContent = busy ? 'AI 团队正在工作…' : 'Agent 会基于当前版本修改';
}

async function reloadProject() {
  const data = await api(`/api/projects/${state.project.id}`);
  state.project = data.project;
  state.messages = data.messages;
  state.versions = data.versions;
  state.dataStats = data.dataStats;
  state.currentVersionId = state.currentVersionId || state.project.currentVersionId;
  $('projectTitle').value = state.project.title;
  renderPublishBadge();
  // 重新拉一次列表：首次生成会把项目名改成应用名，侧边栏也要跟着更新
  await loadProjects();
}

/* --------------------------------- 预览 --------------------------------- */

async function renderPreview(versionId) {
  if (!versionId || !state.project) return;
  const url = `/api/projects/${state.project.id}/versions/${versionId}/render`;
  // 自愈：沙箱重启会重置临时磁盘上的数据。渲染前先探测一次，
  // 404 时重新拉详情——有版本就切到最新版，没有就明确告知用户重发需求。
  try {
    const probe = await fetch(url, { cache: 'no-store' });
    if (probe.status === 404) {
      const detail = await api(`/api/projects/${state.project.id}`);
      const versions = detail.versions || [];
      if (versions.length) {
        versionId = detail.project.currentVersionId || versions[0].id;
        toast('已切换到最新可用版本');
      } else {
        state.versions = [];
        state.currentVersionId = null;
        toast('服务刚重启、数据被重置了——把需求重新发送一次即可恢复');
        setTab('chat');
        return;
      }
    }
  } catch { /* 网络抖动直接交给 iframe 加载 */ }
  state.currentVersionId = versionId;
  $('viewerEmpty').hidden = true;
  $('stage').hidden = state.tab !== 'preview';
  $('stage').src = `${url}?t=${Date.now()}`;
  const index = state.versions.findIndex((v) => v.id === versionId);
  $('chromeChip').textContent = index >= 0 ? `第 ${state.versions.length - index} 版` : '已生成';
  renderChromeUrl();
}

function renderChromeUrl() {
  if (!state.project) return;
  const slug = state.project.slug;
  $('chromeUrl').textContent = state.project.published && slug
    ? `${location.host}/p/${slug}`
    : `atoms.local / ${state.project.id.slice(0, 14)}`;
}

/** 运行时错误 → 触发 Ada 的第二轮自动修复（每个新版本只尝试一次） */
async function onRuntimeError(message) {
  const versionId = state.currentVersionId;
  if (!versionId || !state.project) return;
  if (!state.freshVersions.has(versionId) || state.autofixTried.has(versionId)) return;
  if (state.health?.llm !== 'live') return;
  state.autofixTried.add(versionId);
  toast('质检 Agent 捕获到运行时错误，正在自动修复…');
  try {
    const res = await api(`/api/projects/${state.project.id}/autofix`, { method: 'POST', body: { error: message } });
    if (res.fixed) {
      await reloadProject();
      renderChat();
      renderPreview(res.version.id);
      toast('已自动修复并生成新版本');
    }
  } catch {
    /* 修复失败不打扰用户，控制台里已经保留了原始报错 */
  }
}

/* --------------------------- 预览 / 代码 / 数据 --------------------------- */

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('#viewTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('stage').hidden = tab !== 'preview' ? true : !state.currentVersionId;
  $('codeView').hidden = tab !== 'code';
  $('dataView').hidden = tab !== 'data';
  $('viewerEmpty').hidden = tab !== 'preview' || Boolean(state.currentVersionId);
  if (tab === 'code') loadCode();
  if (tab === 'data') loadData();
}

async function loadCode() {
  if (!state.currentVersionId) {
    $('codeView').textContent = '还没有生成任何版本。';
    return;
  }
  const res = await fetch(`/api/projects/${state.project.id}/versions/${state.currentVersionId}/render?raw=1`);
  $('codeView').textContent = await res.text();
}

async function loadData() {
  const query = state.dataCollection ? `?collection=${encodeURIComponent(state.dataCollection)}` : '';
  const data = await api(`/api/projects/${state.project.id}/data${query}`);
  state.dataStats = data.stats;
  state.dataCollection = data.collection;
  state.dataRows = data.rows;
  renderData();
}

function renderData() {
  const view = $('dataView');
  if (!state.dataStats.length) {
    view.innerHTML = `
      <div class="dv-empty">
        生成的应用还没有写入数据。<br>
        切到「预览」，在应用里新增一条记录，这里就会出现对应的集合与字段。
      </div>`;
    return;
  }
  const chips = state.dataStats.map((s) => `
    <button class="dv-chip ${s.collection === state.dataCollection ? 'active' : ''}" data-col="${esc(s.collection)}">
      ${esc(s.collection)} · ${s.count}
    </button>`).join('');
  const columns = state.dataRows.length ? Object.keys(state.dataRows[0]).filter((k) => k !== 'id') : [];
  const head = columns.map((c) => `<th>${esc(c)}</th>`).join('') + '<th></th>';
  const rows = state.dataRows.map((row) => `
    <tr>
      ${columns.map((c) => `<td>${esc(typeof row[c] === 'object' ? JSON.stringify(row[c]) : row[c])}</td>`).join('')}
      <td><button class="icon-btn" data-del-row="${esc(row.id)}" title="删除">✕</button></td>
    </tr>`).join('');
  view.innerHTML = `
    <div class="dv-head">
      <strong style="font-size:13px">数据集合</strong>
      <div class="dv-collections">${chips}</div>
      <div class="spacer"></div>
      <span class="hint">共 ${state.dataRows.length} 条 · 由生成的应用通过 atoms.store 写入</span>
    </div>
    ${state.dataRows.length
      ? `<table class="dv-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="dv-empty">这个集合当前没有数据。</div>'}
  `;
  view.querySelectorAll('.dv-chip').forEach((btn) => btn.addEventListener('click', async () => {
    state.dataCollection = btn.dataset.col;
    await loadData();
  }));
  view.querySelectorAll('[data-del-row]').forEach((btn) => btn.addEventListener('click', async () => {
    await api(`/api/projects/${state.project.id}/data/delete`, {
      method: 'POST',
      body: { collection: state.dataCollection, id: btn.dataset.delRow },
    });
    await loadData();
  }));
}

/* ------------------------------ 发布 / 分享 ------------------------------ */

function openPublishModal() {
  const project = state.project;
  const defaultSlug = project.slug || slugify(project.title);
  const link = project.published && project.slug ? `${location.origin}/p/${project.slug}` : '';
  openModal(`
    <h2>发布应用</h2>
    <p class="modal-sub">发布会给应用一个公开地址，任何人打开都能直接使用，写入的数据依然保存在服务端。</p>
    <label for="slugInput">网站地址</label>
    <div class="link-row">
      <span class="hint" style="white-space:nowrap">${location.host}/p/</span>
      <input type="text" id="slugInput" value="${esc(defaultSlug)}">
    </div>
    <label>发布前检查</label>
    <ul class="check-list">
      <li><span class="ck">✓</span> 已生成 ${state.versions.length} 个版本，可在 App Viewer 中交互体验</li>
      <li><span class="ck">✓</span> 数据层已接入：生成的应用读写服务端存储，刷新不丢</li>
      <li><span class="ck ${state.versions.length ? '' : 'warn'}">${state.versions.length ? '✓' : '!'}</span> 质检 Agent 已检查外部资源引用与数据持久化</li>
      <li><span class="ck">✓</span> 运行在隔离的 sandbox iframe 中，不会影响主站安全</li>
    </ul>
    ${link ? `<label>当前公开地址</label><div class="link-row"><input type="text" id="liveLink" value="${esc(link)}" readonly><button class="btn" id="copyLink">复制</button></div>` : ''}
    <div class="modal-actions">
      ${project.published ? '<button class="btn" id="unpublishBtn">下线</button>' : ''}
      <button class="btn primary" id="confirmPublish">${project.published ? '更新发布' : '立即发布'}</button>
    </div>
  `);
  if ($('copyLink')) {
    $('copyLink').addEventListener('click', async () => {
      await navigator.clipboard.writeText($('liveLink').value);
      toast('链接已复制');
    });
  }
  if ($('unpublishBtn')) {
    $('unpublishBtn').addEventListener('click', async () => {
      const { project: updated } = await api(`/api/projects/${state.project.id}`, { method: 'PATCH', body: { published: false } });
      state.project = updated;
      closeModal();
      renderPublishBadge();
      renderChromeUrl();
      renderProjects();
      toast('已下线，公开地址不再可访问');
    });
  }
  $('confirmPublish').addEventListener('click', async () => {
    try {
      const { project: updated } = await api(`/api/projects/${state.project.id}`, {
        method: 'PATCH',
        body: { slug: $('slugInput').value.trim().toLowerCase(), published: true },
      });
      state.project = updated;
      renderPublishBadge();
      renderChromeUrl();
      renderProjects();
      openPublishModal();
      toast('发布成功，公开链接已生效');
    } catch (err) {
      toast(err.message);
    }
  });
}

function openShareModal() {
  const project = state.project;
  if (!project.published || !project.slug) {
    openModal(`
      <h2>分享项目</h2>
      <p class="modal-sub">项目还是草稿。先发布一次就能拿到别人可以直接使用的公开链接；也可以把源码导出成单文件分享。</p>
      <div class="modal-actions">
        <button class="btn" id="goExport">导出源码</button>
        <button class="btn primary" id="goPublish">去发布</button>
      </div>
    `);
    $('goExport').addEventListener('click', () => { closeModal(); exportVersion(state.currentVersionId); });
    $('goPublish').addEventListener('click', () => { closeModal(); openPublishModal(); });
    return;
  }
  const link = `${location.origin}/p/${project.slug}`;
  openModal(`
    <h2>分享项目</h2>
    <p class="modal-sub">把链接发给任何人，他们会直接打开这个应用，而不是看到编辑器。</p>
    <label>公开访问地址</label>
    <div class="link-row">
      <input type="text" id="shareLink" value="${esc(link)}" readonly>
      <button class="btn" id="copyShare">复制</button>
    </div>
    <div class="modal-actions">
      <a class="btn" href="${esc(link)}" target="_blank" rel="noreferrer">打开看看</a>
      <button class="btn primary" id="shareDone">完成</button>
    </div>
  `);
  $('copyShare').addEventListener('click', async () => {
    await navigator.clipboard.writeText(link);
    toast('链接已复制');
  });
  $('shareDone').addEventListener('click', closeModal);
}

function exportVersion(versionId) {
  if (!versionId) { toast('还没有可导出的版本'); return; }
  window.location.href = `/api/projects/${state.project.id}/versions/${versionId}/export`;
  toast('正在下载单文件应用，双击即可运行');
}

/* ------------------------------- 版本历史 ------------------------------- */

function openHistoryModal() {
  const rows = state.versions.map((v) => `
    <div class="version-row ${v.id === state.currentVersionId ? 'current' : ''}">
      <div class="vr-main">
        <div class="vr-title">${esc(v.title)}${v.id === state.currentVersionId ? ' · 当前' : ''}</div>
        <div class="vr-meta">${new Date(v.createdAt).toLocaleString('zh-CN')} · ${Math.round((v.size || 0) / 1024)} KB</div>
      </div>
      <button class="btn" data-open="${v.id}">预览</button>
      ${v.id === state.currentVersionId ? '' : `<button class="btn" data-restore="${v.id}">恢复</button>`}
    </div>
  `).join('');
  openModal(`
    <h2>版本历史</h2>
    <p class="modal-sub">每次生成或修改都会留下一个版本，可以随时回退查看。</p>
    <div class="version-list">${rows || '<div class="dv-empty">还没有版本</div>'}</div>
    <div class="modal-actions"><button class="btn" id="historyClose">关闭</button></div>
  `);
  $('historyClose').addEventListener('click', closeModal);
  $('modal').querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', () => {
    closeModal();
    setTab('preview');
    renderPreview(btn.dataset.open);
  }));
  $('modal').querySelectorAll('[data-restore]').forEach((btn) => btn.addEventListener('click', async () => {
    await api(`/api/projects/${state.project.id}/versions/${btn.dataset.restore}/restore`, { method: 'POST' });
    await reloadProject();
    renderPreview(btn.dataset.restore);
    openHistoryModal();
    toast('已恢复到该版本');
  }));
}

/* -------------------------------- 事件绑定 -------------------------------- */

$('newProjectBtn').addEventListener('click', async () => {
  const { project } = await api('/api/projects', { method: 'POST', body: { title: '未命名项目' } });
  await loadProjects();
  await openProject(project.id);
  $('chatInput').focus();
});

$('examples').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.example-card');
  if (!btn) return;
  $('homePrompt').value = btn.dataset.prompt;
  $('homePrompt').focus();
  updateGhost();
});

$('shuffleExamples').addEventListener('click', () => {
  exampleOffset = (exampleOffset + EXAMPLES_PER_PAGE) % EXAMPLE_LIBRARY.length;
  renderExamples();
});

$('homePrompt').addEventListener('input', updateGhost);
$('homePrompt').addEventListener('focus', updateGhost);
$('homePrompt').addEventListener('blur', updateGhost);

$('homePrompt').addEventListener('keydown', (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
    ev.preventDefault();
    $('composerForm').requestSubmit();
  }
});

$('composerForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const prompt = $('homePrompt').value.trim();
  if (!prompt || state.streaming) return;
  const title = prompt.length > 14 ? `${prompt.slice(0, 14)}…` : prompt;
  const { project } = await api('/api/projects', { method: 'POST', body: { title, prompt } });
  await loadProjects();
  await openProject(project.id);
  $('homePrompt').value = '';
  await generate(prompt, 'create');
});

$('chatForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const prompt = $('chatInput').value.trim();
  if (!prompt || state.streaming) return;
  $('chatInput').value = '';
  await generate(prompt, state.currentVersionId ? 'refine' : 'create');
});

$('chatInput').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
    ev.preventDefault();
    $('chatForm').requestSubmit();
  }
});

$('backBtn').addEventListener('click', backHome);

$('projectTitle').addEventListener('change', async () => {
  const title = $('projectTitle').value.trim() || '未命名项目';
  const { project } = await api(`/api/projects/${state.project.id}`, { method: 'PATCH', body: { title } });
  state.project = project;
  renderProjects();
  toast('项目名已更新');
});

$('viewTabs').addEventListener('click', (ev) => {
  const tab = ev.target.closest('.tab');
  if (tab) setTab(tab.dataset.tab);
});

$('deviceToggle').addEventListener('click', (ev) => {
  const seg = ev.target.closest('.seg');
  if (!seg) return;
  state.device = seg.dataset.device;
  document.querySelectorAll('#deviceToggle .seg').forEach((b) => b.classList.toggle('active', b === seg));
  $('viewerBody').classList.toggle('mobile', state.device === 'mobile');
});

$('refreshBtn').addEventListener('click', () => {
  if (state.currentVersionId) renderPreview(state.currentVersionId);
});

$('historyBtn').addEventListener('click', openHistoryModal);
$('exportBtn').addEventListener('click', () => exportVersion(state.currentVersionId));
$('shareBtn').addEventListener('click', openShareModal);
$('publishBtn').addEventListener('click', openPublishModal);
$('envRow').addEventListener('click', openSettingsModal);
$('settingsBtn').addEventListener('click', openSettingsModal);

$('workspaceChip').addEventListener('click', () => {
  if (!state.user) return;
  openModal(`
    <h2>账号与工作区</h2>
    <p class="modal-sub">${esc(state.user.email)}${state.user.isGuest ? '（体验账号）' : ''}<br>
      项目与生成物的数据都归属这个工作区。</p>
    <label for="wsRename">工作区名称</label>
    <input type="text" id="wsRename" value="${esc(state.user.name)}">
    <div class="modal-actions">
      <button class="btn" id="logoutBtn">退出登录</button>
      <button class="btn" id="wsCancel">取消</button>
      <button class="btn primary" id="wsSave">保存</button>
    </div>
  `);
  $('wsCancel').addEventListener('click', closeModal);
  $('wsSave').addEventListener('click', async () => {
    const name = $('wsRename').value.trim();
    if (!name) { toast('名称不能为空'); return; }
    try {
      const { user } = await api('/api/auth/profile', { method: 'PATCH', body: { name } });
      state.user = { ...state.user, ...user };
      renderWorkspace();
      closeModal();
      toast('已保存');
    } catch (err) {
      toast(err.message);
    }
  });
  $('logoutBtn').addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', body: {} });
      state.projects = [];
      renderProjects();
      showAuth();
      toast('已退出登录');
    } catch (err) {
      toast(err.message);
    }
  });
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') closeModal();
});

boot();
