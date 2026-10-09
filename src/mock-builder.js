/**
 * Mock 生成器。
 *
 * 为什么要有它：这个 Demo 一定会被评委点开，而评委不会给我配 API Key。
 * 所以必须有一条「不依赖任何外部服务也能产出真实可交互应用」的兜底路径。
 *
 * 它不是写死的静态页面：根据用户描述里的关键词，选择业务模板、字段定义、
 * 主色和示例数据，最终拼出一个真实调用 window.atoms.store() 的单文件应用 ——
 * 也就是评委在 Mock 模式下依然能体验到「生成 → 交互 → 数据落库 → 刷新还在」。
 */

const TEMPLATES = [
  {
    match: ['巡检', '检查', '点检', '打卡', '巡查'],
    title: '门店巡检记录',
    subtitle: '记录每次巡检结果，数据实时保存到云端',
    collection: '巡检记录',
    icon: '🧭',
    accent: '#2563eb',
    fields: [
      { key: 'point', label: '巡检点位', type: 'text', placeholder: '如：一楼生鲜区', required: true },
      { key: 'result', label: '巡检结果', type: 'select', options: ['正常', '待处理', '异常'] },
      { key: 'owner', label: '巡检人', type: 'text', placeholder: '你的名字' },
      { key: 'note', label: '备注', type: 'textarea', placeholder: '发现的问题与处理方式' },
    ],
    statusKey: 'result',
    statusTone: { 正常: 'ok', 待处理: 'warn', 异常: 'bad' },
    sample: [
      { point: '一楼生鲜区', result: '正常', owner: '张伟', note: '温度 3.5℃，符合标准' },
      { point: '二楼消防通道', result: '待处理', owner: '李娜', note: '纸箱堆放，已通知门店整理' },
      { point: '后仓冷库', result: '异常', owner: '张伟', note: '制冷异响，已报修' },
    ],
  },
  {
    match: ['任务', '待办', 'to do', 'todo', '看板', '清单', '工单'],
    title: '团队任务看板',
    subtitle: '把待办拆到人，进度一眼看清',
    collection: '任务',
    icon: '🗂️',
    accent: '#7c3aed',
    fields: [
      { key: 'name', label: '任务标题', type: 'text', placeholder: '要做什么', required: true },
      { key: 'owner', label: '负责人', type: 'text', placeholder: '谁来做' },
      { key: 'status', label: '状态', type: 'select', options: ['待开始', '进行中', '已完成'] },
      { key: 'due', label: '截止日期', type: 'date' },
    ],
    statusKey: 'status',
    statusTone: { 待开始: 'warn', 进行中: 'info', 已完成: 'ok' },
    sample: [
      { name: '完成 10 月运营复盘', owner: '陈晨', status: '进行中', due: '2026-10-15' },
      { name: '上线新版首页', owner: '王浩', status: '待开始', due: '2026-10-20' },
      { name: '整理客户反馈', owner: '李娜', status: '已完成', due: '2026-10-08' },
    ],
  },
  {
    match: ['记账', '账本', '费用', '报销', '预算', '花销', '支出'],
    title: '个人记账本',
    subtitle: '随手记一笔，月底自动汇总',
    collection: '账目',
    icon: '💰',
    accent: '#059669',
    fields: [
      { key: 'name', label: '事项', type: 'text', placeholder: '如：午餐', required: true },
      { key: 'amount', label: '金额（元）', type: 'number', placeholder: '0.00' },
      { key: 'category', label: '分类', type: 'select', options: ['餐饮', '交通', '购物', '住房', '其他'] },
      { key: 'date', label: '日期', type: 'date' },
    ],
    statusKey: 'category',
    statusTone: {},
    amountKey: 'amount',
    sample: [
      { name: '午餐', amount: 32, category: '餐饮', date: '2026-10-09' },
      { name: '地铁', amount: 6, category: '交通', date: '2026-10-09' },
      { name: '咖啡', amount: 28, category: '餐饮', date: '2026-10-08' },
    ],
  },
  {
    match: ['客户', '线索', 'crm', '跟进', '销售', '商机'],
    title: '客户跟进表',
    subtitle: '每条线索都有下一步，别让机会冷掉',
    collection: '客户',
    icon: '🤝',
    accent: '#ea580c',
    fields: [
      { key: 'name', label: '客户名称', type: 'text', placeholder: '公司或联系人', required: true },
      { key: 'contact', label: '联系方式', type: 'text', placeholder: '电话 / 微信' },
      { key: 'stage', label: '阶段', type: 'select', options: ['初次接触', '方案沟通', '报价中', '已签约'] },
      { key: 'next', label: '下次跟进', type: 'date' },
      { key: 'note', label: '备注', type: 'textarea', placeholder: '客户关心的问题' },
    ],
    statusKey: 'stage',
    statusTone: { 初次接触: 'info', 方案沟通: 'info', 报价中: 'warn', 已签约: 'ok' },
    sample: [
      { name: '星海科技', contact: '刘经理', stage: '方案沟通', next: '2026-10-12', note: '关心数据迁移方案' },
      { name: '云图设计', contact: '赵总监', stage: '报价中', next: '2026-10-11', note: '等待预算审批' },
    ],
  },
  {
    match: ['库存', '物料', '设备', '资产', '仓库', '备件'],
    title: '库存台账',
    subtitle: '出入库留痕，库存一目了然',
    collection: '库存',
    icon: '📦',
    accent: '#0891b2',
    fields: [
      { key: 'name', label: '物料名称', type: 'text', placeholder: '如：A4 打印纸', required: true },
      { key: 'qty', label: '数量', type: 'number', placeholder: '0' },
      { key: 'status', label: '状态', type: 'select', options: ['充足', '偏低', '缺货'] },
      { key: 'owner', label: '经办人', type: 'text', placeholder: '谁登记的' },
    ],
    statusKey: 'status',
    statusTone: { 充足: 'ok', 偏低: 'warn', 缺货: 'bad' },
    amountKey: 'qty',
    sample: [
      { name: 'A4 打印纸', qty: 24, status: '充足', owner: '王浩' },
      { name: '标签纸', qty: 3, status: '偏低', owner: '李娜' },
      { name: '封箱胶带', qty: 0, status: '缺货', owner: '李娜' },
    ],
  },
];

const FALLBACK = {
  title: '通用数据台账',
  subtitle: '记录、查看、维护你的业务数据',
  collection: '记录',
  icon: '📋',
  accent: '#4f46e5',
  fields: [
    { key: 'name', label: '名称', type: 'text', placeholder: '这条记录叫什么', required: true },
    { key: 'status', label: '状态', type: 'select', options: ['进行中', '已完成', '已归档'] },
    { key: 'owner', label: '负责人', type: 'text', placeholder: '谁负责' },
    { key: 'note', label: '备注', type: 'textarea', placeholder: '补充说明' },
  ],
  statusKey: 'status',
  statusTone: { 进行中: 'info', 已完成: 'ok', 已归档: 'warn' },
  sample: [
    { name: '示例记录 A', status: '进行中', owner: '张伟', note: '可直接改成你自己的字段' },
    { name: '示例记录 B', status: '已完成', owner: '李娜', note: '数据保存在服务端，刷新不丢' },
  ],
};

/* -------------------------------------------------------------------------- */
/*                            游戏类模板（非数据应用）                          */
/* -------------------------------------------------------------------------- */

const GAME = {
  kind: 'game',
  match: ['射击', '打靶', '打枪', '小游戏', '游戏', '闯关', '打怪', '消除', '弹幕', '扫雷'],
  title: '打靶射击小游戏',
  subtitle: '点击靶心得分，30 秒挑战你的最高分',
  collection: '游戏成绩',
  icon: '🎯',
  accent: '#ef4444',
};

const GAME_2048 = {
  kind: 'game2048',
  match: ['2048'],
  title: '2048 数字合成',
  subtitle: '滑动合并相同数字，一路冲到 2048',
  collection: '2048成绩',
  icon: '🔢',
  accent: '#f59e0b',
};

const GAME_SNAKE = {
  kind: 'gamesnake',
  match: ['贪吃蛇', 'snake', '蛇'],
  title: '贪吃蛇',
  subtitle: '方向键控制小蛇吃豆，越长越快，别撞墙',
  collection: '贪吃蛇成绩',
  icon: '🐍',
  accent: '#16a34a',
};

/* -------------------------------------------------------------------------- */
/*                            展示型站点模板                                    */
/* -------------------------------------------------------------------------- */

const LANDING_PRESETS = [
  {
    match: ['咖啡', '茶馆', '甜品', '烘焙'],
    name: '拾光咖啡', tagline: '一杯手冲，一段慢下来的时间', icon: '☕', accent: '#9a6b3f',
    services: [
      { t: '手冲单品', d: '每周更换三支豆子，现场冲煮' },
      { t: '自烘焙甜点', d: '当日现做，限量供应' },
      { t: '安静的空间', d: '插座与 Wi-Fi 齐备，适合久坐' },
    ],
  },
  {
    match: ['餐厅', '饭店', '美食', '火锅', '烧烤', '外卖'],
    name: '灶边小馆', tagline: '家常味道，现点现做', icon: '🍜', accent: '#c2410c',
    services: [
      { t: '招牌菜', d: '主厨每日限定，售完即止' },
      { t: '包厢预订', d: '支持 6-12 人聚餐' },
      { t: '外卖配送', d: '三公里内半小时达' },
    ],
  },
  {
    match: ['健身', '瑜伽', '私教', '游泳', '运动'],
    name: '向上健身工作室', tagline: '一对一，把动作练对', icon: '🏋️', accent: '#0f766e',
    services: [
      { t: '体测评估', d: '首次到店免费，输出训练建议' },
      { t: '私教课程', d: '按次或按期，随时可约' },
      { t: '团课', d: '瑜伽、普拉提、搏击操' },
    ],
  },
  {
    match: ['摄影', '写真', '工作室', '设计', '画室'],
    name: '光影摄影工作室', tagline: '把当下的样子留下来', icon: '📷', accent: '#7c3aed',
    services: [
      { t: '人像写真', d: '含妆造与场地，当天出片' },
      { t: '商业拍摄', d: '产品、空间、活动跟拍' },
      { t: '证件照', d: '一小时取件，可修图' },
    ],
  },
  {
    match: ['花店', '花艺', '鲜花'],
    name: '一束花艺', tagline: '每周一束，送到手上', icon: '💐', accent: '#db2777',
    services: [
      { t: '周花订阅', d: '按周配送，随时可停' },
      { t: '定制花束', d: '按场合与预算搭配' },
      { t: '婚礼与活动', d: '现场布置与花艺装置' },
    ],
  },
  {
    match: ['民宿', '酒店', '旅拍', '露营'],
    name: '山间民宿', tagline: '推开窗就是山', icon: '🏡', accent: '#15803d',
    services: [
      { t: '整栋包院', d: '适合 6-10 人的朋友出游' },
      { t: '露台早餐', d: '本地食材，看着山吃' },
      { t: '周边路线', d: '徒步、采摘、看星星' },
    ],
  },
  {
    match: ['宠物', '猫', '狗', '宠物医院', '宠物店'],
    name: '毛孩子宠物生活馆', tagline: '洗澡、美容、寄养一站搞定', icon: '🐾', accent: '#0891b2',
    services: [
      { t: '洗护美容', d: '按毛量计价，可视操作' },
      { t: '寄养', d: '独立空间，每日视频反馈' },
      { t: '上门喂养', d: '节假日照常服务' },
    ],
  },
];

const LANDING_FALLBACK = {
  match: [],
  name: '你的品牌主页', tagline: '把想说的话，讲给愿意听的人', icon: '✨', accent: '#4f46e5',
  services: [
    { t: '核心服务一', d: '一句话说明它能解决什么问题' },
    { t: '核心服务二', d: '用结果说话，而不是形容词' },
    { t: '核心服务三', d: '告诉访客下一步该做什么' },
  ],
};

const LANDING = {
  kind: 'landing',
  match: ['官网', '网站', '主页', '落地页', '博客', '作品集', '介绍页', '展示页', '个人主页', '电商', '商城', '品牌页'],
  collection: '预约留言',
};

/* -------------------------------------------------------------------------- */
/*                    明确超出 Mock 能力范围的需求（诚实告知）                    */
/* -------------------------------------------------------------------------- */

const OUT_OF_SCOPE = [
  { re: /视频|影片|动画片|短视频|mv/i, label: '视频类产物' },
  { re: /ppt|幻灯片|演示文稿|文档|报告|论文|文章|简历|方案书/i, label: '文档 / 幻灯片类产物' },
  { re: /音乐|音频|播客|配音/i, label: '音频类产物' },
  { re: /聊天机器人|客服机器人|智能问答|ai 助手|对话机器人/i, label: 'AI 对话机器人' },
  { re: /地图|导航路线/i, label: '地图类应用' },
  { re: /\bios\b|\bandroid\b|安卓|原生应用|原生 app|移动应用|app store|上架/i, label: '原生移动应用' },
];

function pickTemplate(prompt) {
  const text = String(prompt || '').toLowerCase();
  for (const tpl of TEMPLATES) {
    if (tpl.match.some((k) => text.includes(k.toLowerCase()))) return tpl;
  }
  return FALLBACK;
}

/* ---- 兜底增强：从「记录运单号、签收人和签收时间」这类描述里提取自定义字段 ---- */

const FIELD_TYPE_RULES = [
  { re: /时间|日期|日$/, type: 'date' },
  { re: /数量|金额|价格|单价|重量|费用|个$|件$|次$/, type: 'number' },
  { re: /备注|说明|描述|意见/, type: 'textarea' },
];

function extractFields(prompt) {
  const m = String(prompt || '').match(/(?:记录|登记|包含|字段为?|需要|含有)([^。；;！!？?]{2,80})/);
  if (!m) return null;
  const parts = m[1]
    .split(/[、，,和与/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 10);
  if (parts.length < 2 || parts.length > 6) return null;
  return parts.map((label, i) => {
    const rule = FIELD_TYPE_RULES.find((r) => r.re.test(label));
    return { key: `f${i}`, label, type: rule ? rule.type : 'text', placeholder: `填写${label}`, required: i === 0 };
  });
}

function extractAppName(prompt) {
  // 先剥掉「帮我做一个」这类动词前缀，再取「××登记表 / ××看板」等应用名
  const cleaned = String(prompt || '').replace(/^\s*(?:帮我|请|给我)?(?:做一个|做个|创建一个|创建|搭一个|搭|写一个|写)/, '');
  const m = cleaned.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,10}(?:登记表|台账|看板|记录表|管理系统|管理|登记|清单|本|表))/);
  return m ? m[1] : null;
}

/** 按提取出的字段生成两条示例数据，key 与字段对齐，「填充示例数据」才能直接用 */
function makeSample(fields) {
  const row = (n) => Object.fromEntries(fields.map((f) => [
    f.key,
    f.type === 'date' ? '2026-10-09'
      : f.type === 'number' ? String((n + 1) * 3)
        : f.type === 'textarea' ? '示例内容，可删除'
          : `示例${f.label}${n ? '二' : '一'}`,
  ]));
  return [row(0), row(1)];
}

/**
 * Mock 模式下产出的「方案」，结构与真实模型返回的 plan 完全一致。
 *
 * previousTitle 用于「二次修改」：必须沿用上一版的应用类型，
 * 否则用户说「加一个筛选框」会得到一个完全不同的应用。
 */
export function mockPlan(prompt, { previousTitle = null, previousHtml = null } = {}) {
  const text = String(prompt || '');

  // ① 明确超出能力范围的需求：诚实说做不了，不要硬编一个不相干的应用出来
  const outOfScope = OUT_OF_SCOPE.find((o) => o.re.test(text));
  if (outOfScope) {
    return {
      unsupported: true,
      message: `当前是 Mock 演示模式（没有配置模型 API Key），我只能生成网页应用，还做不了${outOfScope.label}。`
        + '配置一个模型 Key 之后，这里就会交给真实模型来完成。',
    };
  }

  // ② 游戏类需求：走专用模板，产出真正能玩的小游戏（2048 / 贪吃蛇 / 打靶）
  const is2048 = /2048/.test(text);
  const isSnake = /贪吃蛇|snake/i.test(text);
  if (is2048 || isSnake || GAME.match.some((k) => text.includes(k))) {
    const kind = is2048 ? '2048' : isSnake ? 'snake' : 'shoot';
    const tpl = is2048 ? GAME_2048 : isSnake ? GAME_SNAKE : GAME;
    const gameSummaries = {
      '2048': '识别到 2048 游戏需求，将生成完整可玩的 2048：方向键或滑动合并数字，得分与历史成绩自动保存。',
      snake: '识别到贪吃蛇游戏需求，将生成完整可玩的贪吃蛇：方向键控制、吃豆成长、逐渐加速，成绩自动保存。',
      shoot: '识别到这是一个交互游戏需求，将生成一个可直接上手玩的打靶小游戏，成绩会保存下来。',
    };
    const gameFeatures = {
      '2048': ['方向键 / WASD / 触屏滑动', '合并计分与最高分记录', '达成 2048 可继续挑战', '历史成绩保存'],
      snake: ['方向键 / WASD / 触屏滑动', '吃豆成长、越吃越快', '撞墙或咬到自己结束', '历史成绩保存'],
      shoot: ['30 秒限时挑战', '连击加分', '最高分记录', '历史成绩列表'],
    };
    return {
      title: tpl.title,
      summary: gameSummaries[kind],
      features: gameFeatures[kind],
      dataModel: [{ collection: tpl.collection, fields: ['得分', '达成时间'] }],
      sections: ['计分板', '游戏区域', '历史成绩'],
      _template: tpl,
      _game: kind,
      _dark: false,
      _filter: false,
    };
  }

  // ③ 展示型站点：官网 / 落地页 / 作品集
  if (LANDING.match.some((k) => text.includes(k))) {
    const preset = LANDING_PRESETS.find((p) => p.match.some((k) => text.includes(k))) || LANDING_FALLBACK;
    return {
      title: `${preset.name}`,
      summary: '识别到这是一个展示型站点需求，将生成单页官网：主视觉、服务介绍、预约留言表单。',
      features: ['主视觉与导航', '服务/产品介绍', '预约留言（写入数据库）', '移动端适配'],
      dataModel: [{ collection: LANDING.collection, fields: ['姓名', '联系方式', '留言'] }],
      sections: ['顶部导航', '主视觉', '服务介绍', '预约留言'],
      _template: { ...LANDING, ...preset, title: preset.name, subtitle: preset.tagline },
      _landing: true,
      _dark: false,
      _filter: false,
    };
  }

  // ④ 数据管理类：沿用台账范式
  const tpl = (previousTitle && TEMPLATES.find((t) => t.title === previousTitle))
    || (previousTitle === FALLBACK.title && FALLBACK)
    || pickTemplate(prompt);
  const isGeneric = tpl === FALLBACK && !previousTitle;
  // 兜底增强：即使没命中业务模板，也把「记录 A、B 和 C」里的字段提取出来，
  // 表单、列表、示例数据都按用户自己的字段生成，而不是固定骨架
  const customFields = isGeneric ? extractFields(prompt) : null;
  const customName = isGeneric ? extractAppName(prompt) : null;
  const effTpl = customFields
    ? {
        ...tpl,
        title: customName || tpl.title,
        collection: (customName || '记录').replace(/(登记表|记录表|管理系统|看板|台账|登记|清单|表)$/, '') || '记录',
        fields: customFields,
        statusKey: (customFields.find((f) => f.type === 'select') || {}).key || null,
        statusTone: null,
        sample: makeSample(customFields),
      }
    : tpl;
  // Mock 模式下没有「应用状态」这个概念，用上一版产物反推已有特性，
  // 保证连续迭代时已经开启的深色主题、筛选器不会莫名其妙消失。
  const html = previousHtml || '';
  const dark = /深色|暗色|夜间|dark/i.test(text) || /--bg: #12141a/.test(html);
  const filter = /筛选|过滤|下拉/i.test(text) || /id="filter"/.test(html);
  return {
    title: effTpl.title,
    summary: previousTitle
      ? `在原应用基础上按你的要求调整：${String(prompt).slice(0, 40)}`
      : isGeneric && customFields
        ? `已从你的描述里提取 ${customFields.length} 个字段（${customFields.map((f) => f.label).join(' / ')}），按台账范式生成对应的数据应用。`
        : isGeneric
          ? '没有从描述里识别到具体的业务类型，先按通用台账生成一个可用的骨架，你可以直接说「把字段改成 A / B / C」来调整。'
          : '识别到这是一个「录入 + 查看 + 维护」型的数据应用，按台账范式生成：顶部概览、快速录入、可搜索列表。',
    features: ['快速录入表单', '实时统计概览', '关键词搜索', '一键填充示例数据', '删除与清空'],
    dataModel: [{ collection: effTpl.collection, fields: effTpl.fields.map((f) => f.label) }],
    sections: ['统计概览', '新建记录', '记录列表'],
    _template: effTpl,
    _dark: dark,
    _filter: filter,
  };
}

function fieldHtml(field) {
  const label = `<label for="f_${field.key}">${field.label}</label>`;
  const attrs = `${field.required ? ' required' : ''}`;
  if (field.type === 'select') {
    const opts = (field.options || []).map((o) => `<option value="${o}">${o}</option>`).join('');
    return `<div class="field">${label}<select id="f_${field.key}"${attrs}>${opts}</select></div>`;
  }
  if (field.type === 'textarea') {
    return `<div class="field">${label}<textarea id="f_${field.key}" rows="3" placeholder="${field.placeholder || ''}"></textarea></div>`;
  }
  return `<div class="field">${label}<input id="f_${field.key}" type="${field.type}" placeholder="${field.placeholder || ''}"${attrs}></div>`;
}

/** 按方案类型分发到对应的产物构建器 */
export function buildMockApp(plan) {
  if (plan._game === '2048') return build2048(plan);
  if (plan._game === 'snake') return buildSnake(plan);
  if (plan._game) return buildGame(plan);
  if (plan._landing) return buildLanding(plan);
  return buildLedger(plan);
}

/**
 * 数据台账应用。
 * 注意：内部业务脚本刻意只用字符串拼接、不用模板字符串，
 * 避免和外层模板字面量互相转义。
 */
function buildLedger(plan) {
  const tpl = plan._template || FALLBACK;
  const fields = tpl.fields;
  const sampleJson = JSON.stringify(tpl.sample);
  const fieldScript = fields.map((f) => `'${f.key}'`).join(', ');
  const statusKey = tpl.statusKey || null;
  const toneMap = JSON.stringify(tpl.statusTone || {});
  const palette = plan._dark
    ? { ink: '#e8eaf0', ink2: '#9aa3b2', line: '#2b303b', bg: '#12141a', card: '#191c23', cardHover: '#1f232c', tagBg: '#242936' }
    : { ink: '#101828', ink2: '#475467', line: '#e4e7ec', bg: '#f7f8fa', card: '#ffffff', cardHover: '#fbfbfc', tagBg: '#f2f4f7' };
  const statusOptions = (fields.find((f) => f.key === (tpl.statusKey || '')) || {}).options || [];
  const showFilter = Boolean(plan._filter && statusKey && statusOptions.length);
  const filterHtml = showFilter
    ? `<select id="filter"><option value="">全部${fields.find((f) => f.key === statusKey).label}</option>${statusOptions.map((o) => `<option value="${o}">${o}</option>`).join('')}</select>`
    : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tpl.title}</title>
<style>
  :root {
    --accent: ${tpl.accent};
    --accent-soft: ${tpl.accent}14;
    --ink: ${palette.ink};
    --ink-2: ${palette.ink2};
    --line: ${palette.line};
    --bg: ${palette.bg};
    --card: ${palette.card};
    --card-hover: ${palette.cardHover};
    --tag-bg: ${palette.tagBg};
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 60px; }
  header.top { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .logo { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; background: var(--accent-soft); }
  header.top h1 { font-size: 21px; margin: 0 0 4px; letter-spacing: -0.01em; }
  header.top p { margin: 0; color: var(--ink-2); font-size: 13px; }
  .spacer { flex: 1; }
  .btn { border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 9px 14px; border-radius: 10px; font-size: 13px; cursor: pointer; transition: .15s; }
  .btn:hover { background: var(--card-hover); }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  .btn.primary:hover { filter: brightness(1.06); }
  .btn.ghost-danger:hover { border-color: #fda29b; color: #b42318; background: #fffbfa; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 24px 0 18px; }
  .stat { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
  .stat .k { font-size: 12px; color: var(--ink-2); margin-bottom: 8px; }
  .stat .v { font-size: 24px; font-weight: 650; letter-spacing: -0.02em; }
  .grid { display: grid; grid-template-columns: 340px 1fr; gap: 18px; align-items: start; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
  .card h2 { font-size: 15px; margin: 0 0 16px; }
  .field { margin-bottom: 13px; }
  .field label { display: block; font-size: 12.5px; color: var(--ink-2); margin-bottom: 6px; }
  .field input, .field select, .field textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; font-family: inherit; background: var(--card); color: var(--ink); outline: none; transition: .15s; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .field textarea { resize: vertical; }
  .list-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .list-head h2 { margin: 0; flex: none; }
  .list-head input { flex: 1; padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 13px; outline: none; background: var(--card); color: var(--ink); }
  .list-head input:focus { border-color: var(--accent); }
  .list-head select { padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; font-size: 13px; background: var(--card); color: var(--ink); outline: none; }
  ul.rows { list-style: none; margin: 0; padding: 0; }
  ul.rows li { display: flex; align-items: flex-start; gap: 12px; padding: 14px 4px; border-top: 1px solid var(--line); }
  ul.rows li:first-child { border-top: 0; }
  .row-main { flex: 1; min-width: 0; }
  .row-title { font-size: 14.5px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .row-meta { font-size: 12.5px; color: var(--ink-2); margin-top: 5px; display: flex; gap: 10px; flex-wrap: wrap; }
  .tag { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; background: var(--tag-bg); color: var(--ink-2); }
  .tag.ok { background: #ecfdf3; color: #027a48; }
  .tag.warn { background: #fffaeb; color: #b54708; }
  .tag.bad { background: #fef3f2; color: #b42318; }
  .tag.info { background: #eff8ff; color: #175cd3; }
  .icon-btn { border: 0; background: transparent; color: #98a2b3; cursor: pointer; font-size: 13px; padding: 4px 6px; border-radius: 6px; }
  .icon-btn:hover { background: var(--tag-bg); color: #ff6b6b; }
  .empty { text-align: center; padding: 42px 12px; color: var(--ink-2); font-size: 13.5px; }
  .empty .big { font-size: 30px; display: block; margin-bottom: 10px; }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 20px); background: #101828; color: #fff; padding: 10px 18px; border-radius: 10px; font-size: 13px; opacity: 0; transition: .22s; pointer-events: none; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  .loading { color: var(--ink-2); font-size: 13px; padding: 30px 0; text-align: center; }
  @media (max-width: 860px) {
    .grid { grid-template-columns: 1fr; }
    .stats { grid-template-columns: 1fr 1fr; }
    .wrap { padding: 20px 14px 50px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="logo">${tpl.icon}</div>
    <div>
      <h1>${tpl.title}</h1>
      <p>${tpl.subtitle}</p>
    </div>
    <div class="spacer"></div>
    <button class="btn" id="seedBtn">填充示例数据</button>
    <button class="btn ghost-danger" id="clearBtn">清空全部</button>
  </header>

  <section class="stats">
    <div class="stat"><div class="k">总记录</div><div class="v" id="statTotal">–</div></div>
    <div class="stat"><div class="k">今日新增</div><div class="v" id="statToday">–</div></div>
    <div class="stat"><div class="k">最近更新</div><div class="v" id="statLatest" style="font-size:15px;font-weight:600">–</div></div>
  </section>

  <div class="grid">
    <form class="card" id="form">
      <h2>＋ 新建记录</h2>
      ${fields.map(fieldHtml).join('\n      ')}
      <button class="btn primary" type="submit" style="width:100%;margin-top:6px">保存记录</button>
    </form>

    <section class="card">
      <div class="list-head">
        <h2>全部记录</h2>
        <input id="search" placeholder="搜索关键词…">
        ${filterHtml}
      </div>
      <div id="listArea"><div class="loading">正在加载数据…</div></div>
    </section>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
(function () {
  var FIELDS = [${fieldScript}];
  var STATUS_KEY = ${JSON.stringify(statusKey)};
  var TONES = ${toneMap};
  var SAMPLE = ${sampleJson};
  var COLLECTION = ${JSON.stringify(tpl.collection)};
  var store = window.atoms.store(COLLECTION);
  var rows = [];
  var keyword = '';
  var filterValue = '';

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var box = $('toast');
    box.textContent = msg;
    box.classList.add('show');
    setTimeout(function () { box.classList.remove('show'); }, 1800);
  }

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function statusOf(row) {
    if (!STATUS_KEY) return null;
    var v = row[STATUS_KEY];
    if (v == null || v === '') return null;
    return { text: v, tone: TONES[v] || 'info' };
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return '';
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return Math.floor(diff / 86400000) + ' 天前';
  }

  function renderStats() {
    $('statTotal').textContent = rows.length;
    var today = new Date().toDateString();
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].createdAt && new Date(rows[i].createdAt).toDateString() === today) n++;
    }
    $('statToday').textContent = n;
    var latest = rows[0];
    $('statLatest').textContent = latest ? timeAgo(latest.createdAt) + ' · ' + esc(String(latest[FIELDS[0]] || '')) : '暂无';
  }

  function render() {
    var area = $('listArea');
    var list = rows.filter(function (row) {
      if (filterValue && STATUS_KEY && String(row[STATUS_KEY] || '') !== filterValue) return false;
      if (!keyword) return true;
      return FIELDS.some(function (k) { return String(row[k] || '').toLowerCase().indexOf(keyword) >= 0; });
    });
    if (!list.length) {
      area.innerHTML = '<div class="empty"><span class="big">' + (rows.length ? '🔍' : '📭') + '</span>' +
        (rows.length ? '没有匹配的记录，换个关键词试试' : '还没有记录，先在左侧新建一条，或点上方「填充示例数据」') + '</div>';
      renderStats();
      return;
    }
    var html = '<ul class="rows">';
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      var st = statusOf(row);
      html += '<li><div class="row-main"><div class="row-title">' + esc(row[FIELDS[0]]) +
        (st ? ' <span class="tag ' + st.tone + '">' + esc(st.text) + '</span>' : '') + '</div><div class="row-meta">';
      for (var j = 1; j < FIELDS.length; j++) {
        var v = row[FIELDS[j]];
        if (v !== undefined && v !== null && v !== '') html += '<span>' + esc(v) + '</span>';
      }
      html += '<span style="color:#98a2b3">' + timeAgo(row.createdAt) + '</span></div></div>' +
        '<button class="icon-btn" data-del="' + esc(row.id) + '" title="删除">删除</button></li>';
    }
    html += '</ul>';
    area.innerHTML = html;
    renderStats();
  }

  function readForm() {
    var doc = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var el = $('f_' + FIELDS[i]);
      doc[FIELDS[i]] = el ? el.value.trim() : '';
    }
    return doc;
  }

  function resetForm() {
    for (var i = 0; i < FIELDS.length; i++) {
      var el = $('f_' + FIELDS[i]);
      if (el) el.value = '';
    }
  }

  async function load() {
    try {
      rows = (await store.list()) || [];
    } catch (err) {
      rows = [];
      toast('数据加载失败：' + err.message);
    }
    render();
  }

  $('form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var doc = readForm();
    if (!doc[FIELDS[0]]) { toast('请先填写「' + FIELDS[0] + '」'); return; }
    try {
      var saved = await store.insert(doc);
      rows.unshift(saved);
      resetForm();
      render();
      toast('已保存，数据已写入云端');
    } catch (err) {
      toast('保存失败：' + err.message);
    }
  });

  $('listArea').addEventListener('click', async function (ev) {
    var id = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-del');
    if (!id) return;
    if (!confirm('确定删除这条记录？')) return;
    await store.remove(id);
    rows = rows.filter(function (r) { return r.id !== id; });
    render();
    toast('已删除');
  });

  $('search').addEventListener('input', function (ev) {
    keyword = ev.target.value.trim().toLowerCase();
    render();
  });

  var filterEl = $('filter');
  if (filterEl) {
    filterEl.addEventListener('change', function (ev) {
      filterValue = ev.target.value;
      render();
    });
  }

  $('seedBtn').addEventListener('click', async function () {
    for (var i = 0; i < SAMPLE.length; i++) {
      var saved = await store.insert(SAMPLE[i]);
      rows.unshift(saved);
    }
    render();
    toast('已填充 ' + SAMPLE.length + ' 条示例数据');
  });

  $('clearBtn').addEventListener('click', async function () {
    if (!confirm('确定清空全部记录？')) return;
    await store.clear();
    rows = [];
    render();
    toast('已清空');
  });

  load();
})();
</script>
</body>
</html>`;
}

/* ------------------------------ 打靶射击小游戏 ------------------------------ */

function buildGame(plan) {
  const tpl = plan._template || GAME;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tpl.title}</title>
<style>
  :root { --accent: ${tpl.accent}; --accent-soft: ${tpl.accent}18; --ink: #0f172a; --ink-2: #5b6576; --line: #e6e9ee; --bg: #f7f8fa; --card: #ffffff; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 26px 18px 50px; }
  header.top { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .logo { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; background: var(--accent-soft); }
  header.top h1 { font-size: 21px; margin: 0 0 4px; }
  header.top p { margin: 0; color: var(--ink-2); font-size: 13px; }
  .spacer { flex: 1; }
  .btn { border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 10px 16px; border-radius: 10px; font-size: 13.5px; cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0 14px; }
  .stat { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 13px 16px; }
  .stat .k { font-size: 12px; color: var(--ink-2); margin-bottom: 6px; }
  .stat .v { font-size: 24px; font-weight: 680; letter-spacing: -.02em; }
  .stat.hot .v { color: var(--accent); }
  .stage { position: relative; height: 400px; border-radius: 18px; overflow: hidden; background: var(--card); border: 1px solid var(--line); cursor: crosshair; }
  .stage .hint { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; color: var(--ink-2); font-size: 14px; text-align: center; }
  .stage .hint .big { font-size: 34px; }
  .target { position: absolute; border-radius: 50%; background: radial-gradient(circle at 50% 50%, #fff 0 18%, var(--accent) 19% 34%, #fff 35% 50%, var(--accent) 51% 66%, #fff 67% 100%); box-shadow: 0 6px 18px rgba(239,68,68,.28), inset 0 0 0 1px rgba(0,0,0,.06); cursor: crosshair; animation: lifespan 1.35s linear forwards; will-change: transform, opacity; }
  @keyframes lifespan { 0% { transform: scale(.7); opacity: 0; } 12% { transform: scale(1); opacity: 1; } 75% { transform: scale(1); opacity: 1; } 100% { transform: scale(.55); opacity: 0; } }
  .pop { position: absolute; font-size: 15px; font-weight: 700; color: var(--accent); pointer-events: none; animation: floatUp .7s ease-out forwards; }
  @keyframes floatUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-34px); opacity: 0; } }
  .over { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center; font-size: 15px; color: var(--ink-2); }
  .over b { font-size: 32px; color: var(--accent); }
  .board { margin-top: 18px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; }
  .board h2 { font-size: 14.5px; margin: 0 0 12px; }
  ul.rows { list-style: none; margin: 0; padding: 0; }
  ul.rows li { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-top: 1px solid var(--line); font-size: 13px; }
  ul.rows li:first-child { border-top: 0; }
  ul.rows li .sc { font-weight: 680; color: var(--accent); min-width: 54px; }
  ul.rows li .meta { color: var(--ink-2); font-size: 12.5px; }
  .empty { color: var(--ink-2); font-size: 13px; padding: 14px 0; }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 16px); background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 10px; font-size: 13px; opacity: 0; transition: .22s; pointer-events: none; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 640px) { .stage { height: 320px; } .stats { grid-template-columns: 1fr 1fr; } .wrap { padding: 18px 12px 40px; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="logo">${tpl.icon}</div>
    <div>
      <h1>${tpl.title}</h1>
      <p>${tpl.subtitle}</p>
    </div>
    <div class="spacer"></div>
    <button class="btn primary" id="startBtn">开始游戏</button>
  </header>

  <section class="stats">
    <div class="stat hot"><div class="k">当前得分</div><div class="v" id="score">0</div></div>
    <div class="stat"><div class="k">剩余时间</div><div class="v" id="time">30s</div></div>
    <div class="stat"><div class="k">历史最高</div><div class="v" id="best">–</div></div>
  </section>

  <div class="stage" id="stage">
    <div class="hint"><span class="big">${tpl.icon}</span><span>点「开始游戏」，靶子会随机出现</span></div>
  </div>

  <section class="board">
    <h2>历史成绩</h2>
    <div id="history"><div class="empty">还没有成绩，先打一局吧</div></div>
  </section>
</div>
<div class="toast" id="toast"></div>

<script>
(function () {
  var DURATION = 30;
  var store = window.atoms.store(${JSON.stringify(tpl.collection)});
  var stage = document.getElementById('stage');
  var running = false;
  var score = 0;
  var hits = 0;
  var combo = 0;
  var timeLeft = DURATION;
  var tickId = null;
  var rows = [];

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var box = $('toast');
    box.textContent = msg;
    box.classList.add('show');
    setTimeout(function () { box.classList.remove('show'); }, 1800);
  }
  function refreshHud() {
    $('score').textContent = score;
    $('time').textContent = Math.max(0, Math.ceil(timeLeft)) + 's';
  }

  function spawn() {
    if (!running) return;
    var size = 44 + Math.round(Math.random() * 30);
    var maxX = Math.max(0, stage.clientWidth - size);
    var maxY = Math.max(0, stage.clientHeight - size);
    var el = document.createElement('div');
    el.className = 'target';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = Math.round(Math.random() * maxX) + 'px';
    el.style.top = Math.round(Math.random() * maxY) + 'px';
    // 动画结束＝靶子超时，连击清零
    el.addEventListener('animationend', function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      combo = 0;
      spawn();
    });
    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (!running) return;
      var gain = 10 + combo * 2;
      score += gain;
      hits += 1;
      combo += 1;
      floatText(el, '+' + gain);
      if (el.parentNode) el.parentNode.removeChild(el);
      refreshHud();
      spawn();
    });
    stage.appendChild(el);
  }

  function floatText(el, text) {
    var tip = document.createElement('div');
    tip.className = 'pop';
    tip.textContent = text;
    tip.style.left = (parseInt(el.style.left, 10) + 14) + 'px';
    tip.style.top = parseInt(el.style.top, 10) + 'px';
    stage.appendChild(tip);
    setTimeout(function () { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 700);
  }

  function start() {
    if (running) return;
    running = true;
    score = 0; hits = 0; combo = 0; timeLeft = DURATION;
    stage.innerHTML = '';
    refreshHud();
    spawn();
    tickId = setInterval(function () {
      timeLeft -= 0.1;
      refreshHud();
      if (timeLeft <= 0) finish();
    }, 100);
  }

  async function finish() {
    running = false;
    clearInterval(tickId);
    stage.innerHTML = '<div class="over">时间到！本次得分 <b>' + score + '</b><span>点「开始游戏」再来一局</span></div>';
    try {
      // 成绩写入服务端，刷新或换设备打开都还在
      await store.insert({ score: score, hits: hits, duration: DURATION, playedAt: new Date().toISOString() });
    } catch (err) {
      toast('成绩保存失败：' + err.message);
    }
    await loadHistory();
    toast('本局成绩 ' + score + ' 分，已保存');
  }

  async function loadHistory() {
    try {
      rows = (await store.list()) || [];
    } catch (err) {
      rows = [];
    }
    var best = 0;
    for (var i = 0; i < rows.length; i++) best = Math.max(best, Number(rows[i].score) || 0);
    $('best').textContent = rows.length ? best : '–';
    if (!rows.length) {
      $('history').innerHTML = '<div class="empty">还没有成绩，先打一局吧</div>';
      return;
    }
    var html = '<ul class="rows">';
    for (var j = 0; j < Math.min(rows.length, 6); j++) {
      var row = rows[j];
      html += '<li><span class="sc">' + (Number(row.score) || 0) + ' 分</span>' +
        '<span class="meta">命中 ' + (Number(row.hits) || 0) + ' 次 · ' +
        new Date(row.createdAt || row.playedAt).toLocaleString('zh-CN') + '</span></li>';
    }
    html += '</ul>';
    $('history').innerHTML = html;
  }

  $('startBtn').addEventListener('click', start);
  // 点空白处＝脱靶，连击清零
  stage.addEventListener('click', function () { combo = 0; });
  document.addEventListener('keydown', function (ev) {
    if (ev.code === 'Space') {
      ev.preventDefault();
      var t = stage.querySelector('.target');
      if (t) t.click();
    }
  });

  loadHistory();
})();
</script>
</body>
</html>`;
}

/* ------------------------------ 2048 数字合成 ------------------------------ */

function build2048(plan) {
  const tpl = plan._template || GAME_2048;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tpl.title}</title>
<style>
  :root { --accent: ${tpl.accent}; --accent-soft: ${tpl.accent}18; --ink: #0f172a; --ink-2: #5b6576; --line: #e6e9ee; --bg: #f7f8fa; --card: #ffffff; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 540px; margin: 0 auto; padding: 26px 18px 50px; }
  header.top { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .logo { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; background: var(--accent-soft); }
  header.top h1 { font-size: 21px; margin: 0 0 4px; }
  header.top p { margin: 0; color: var(--ink-2); font-size: 13px; }
  .spacer { flex: 1; }
  .btn { border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 10px 16px; border-radius: 10px; font-size: 13.5px; cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0 14px; }
  .stat { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 13px 16px; }
  .stat .k { font-size: 12px; color: var(--ink-2); margin-bottom: 6px; }
  .stat .v { font-size: 24px; font-weight: 680; letter-spacing: -.02em; }
  .stat.hot .v { color: var(--accent); }
  .board2048 { position: relative; background: #bbada0; border-radius: 16px; padding: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; touch-action: none; user-select: none; }
  .cell { aspect-ratio: 1; border-radius: 10px; background: rgba(238,228,218,.35); display: grid; place-items: center; font-size: 36px; font-weight: 800; color: #776e65; }
  .cell.v2 { background: #eee4da; }
  .cell.v4 { background: #ede0c8; }
  .cell.v8 { background: #f2b179; color: #f9f6f2; }
  .cell.v16 { background: #f59563; color: #f9f6f2; }
  .cell.v32 { background: #f67c5f; color: #f9f6f2; }
  .cell.v64 { background: #f65e3b; color: #f9f6f2; }
  .cell.v128 { background: #edcf72; color: #f9f6f2; }
  .cell.v256 { background: #edcc61; color: #f9f6f2; }
  .cell.v512 { background: #edc850; color: #f9f6f2; }
  .cell.v1024 { background: #edc53f; color: #f9f6f2; }
  .cell.v2048 { background: #edc22e; color: #f9f6f2; box-shadow: 0 0 24px rgba(237,194,46,.6); }
  .cell.big { background: #3c3a32; color: #f9f6f2; }
  .overlay { position: absolute; inset: 0; border-radius: 16px; background: rgba(238,228,218,.78); display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; font-size: 15px; color: #776e65; backdrop-filter: blur(2px); }
  .overlay b { font-size: 30px; color: #8f7a66; }
  .board { margin-top: 18px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; }
  .board h2 { font-size: 14.5px; margin: 0 0 12px; }
  ul.rows { list-style: none; margin: 0; padding: 0; }
  ul.rows li { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-top: 1px solid var(--line); font-size: 13px; }
  ul.rows li:first-child { border-top: 0; }
  ul.rows li .sc { font-weight: 680; color: var(--accent); min-width: 54px; }
  ul.rows li .meta { color: var(--ink-2); font-size: 12.5px; }
  .empty { color: var(--ink-2); font-size: 13px; padding: 14px 0; }
  .tips { color: var(--ink-2); font-size: 12.5px; margin-top: 10px; text-align: center; }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 16px); background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 10px; font-size: 13px; opacity: 0; transition: .22s; pointer-events: none; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 480px) { .cell { font-size: 26px; } .stat .v { font-size: 20px; } .wrap { padding: 18px 12px 40px; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="logo">${tpl.icon}</div>
    <div>
      <h1>${tpl.title}</h1>
      <p>${tpl.subtitle}</p>
    </div>
    <div class="spacer"></div>
    <button class="btn primary" id="newBtn">新开一局</button>
  </header>

  <section class="stats">
    <div class="stat hot"><div class="k">当前得分</div><div class="v" id="score">0</div></div>
    <div class="stat"><div class="k">最大数字</div><div class="v" id="maxTile">–</div></div>
    <div class="stat"><div class="k">历史最高</div><div class="v" id="best">–</div></div>
  </section>

  <div class="board2048" id="board"></div>
  <p class="tips">方向键 / WASD / 触屏滑动都可以操作</p>

  <section class="board">
    <h2>历史成绩</h2>
    <div id="history"><div class="empty">还没有成绩，先玩一局吧</div></div>
  </section>
</div>
<div class="toast" id="toast"></div>

<script>
(function () {
  var SIZE = 4;
  var store = window.atoms.store(${JSON.stringify(tpl.collection)});
  var board, score, over, won, maxTile;
  var cells = [];

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var box = $('toast');
    box.textContent = msg;
    box.classList.add('show');
    setTimeout(function () { box.classList.remove('show'); }, 1800);
  }

  function buildCells() {
    var el = $('board');
    el.innerHTML = '';
    cells = [];
    for (var i = 0; i < SIZE * SIZE; i++) {
      var c = document.createElement('div');
      c.className = 'cell';
      el.appendChild(c);
      cells.push(c);
    }
  }

  function init() {
    board = [];
    for (var r = 0; r < SIZE; r++) {
      board.push([0, 0, 0, 0]);
    }
    score = 0; over = false; won = false; maxTile = 0;
    addTile(); addTile();
    render();
  }

  function addTile() {
    var empty = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (!board[r][c]) empty.push([r, c]);
      }
    }
    if (!empty.length) return;
    var spot = empty[Math.floor(Math.random() * empty.length)];
    board[spot[0]][spot[1]] = Math.random() < 0.9 ? 2 : 4;
  }

  function slideLine(line) {
    var arr = [];
    for (var i = 0; i < line.length; i++) {
      if (line[i]) arr.push(line[i]);
    }
    var out = [];
    var j = 0;
    while (j < arr.length) {
      if (j + 1 < arr.length && arr[j] === arr[j + 1]) {
        var merged = arr[j] * 2;
        out.push(merged);
        score += merged;
        if (merged > maxTile) maxTile = merged;
        if (merged >= 2048 && !won) { won = true; toast('达成 2048！可以继续冲击更高数字'); }
        j += 2;
      } else {
        out.push(arr[j]);
        if (arr[j] > maxTile) maxTile = arr[j];
        j += 1;
      }
    }
    while (out.length < SIZE) out.push(0);
    return out;
  }

  function move(dir) {
    if (over) return;
    var moved = false;
    for (var i = 0; i < SIZE; i++) {
      var line = [];
      for (var j = 0; j < SIZE; j++) {
        if (dir === 'left') line.push(board[i][j]);
        else if (dir === 'right') line.push(board[i][SIZE - 1 - j]);
        else if (dir === 'up') line.push(board[j][i]);
        else line.push(board[SIZE - 1 - j][i]);
      }
      var merged = slideLine(line);
      for (var k = 0; k < SIZE; k++) {
        var r, c;
        if (dir === 'left') { r = i; c = k; }
        else if (dir === 'right') { r = i; c = SIZE - 1 - k; }
        else if (dir === 'up') { r = k; c = i; }
        else { r = SIZE - 1 - k; c = i; }
        if (board[r][c] !== merged[k]) moved = true;
        board[r][c] = merged[k];
      }
    }
    if (moved) {
      addTile();
      render();
      if (isOver()) endGame();
    }
  }

  function isOver() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (!board[r][c]) return false;
        if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return false;
        if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return false;
      }
    }
    return true;
  }

  function render() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = board[r][c];
        var el = cells[r * SIZE + c];
        el.textContent = v || '';
        var cls = 'cell' + (v ? ' v' + (v <= 2048 ? v : '') : '');
        if (v > 2048) cls += ' big';
        el.className = cls;
        el.style.fontSize = v >= 1024 ? '24px' : v >= 128 ? '30px' : '';
      }
    }
    $('score').textContent = score;
    $('maxTile').textContent = maxTile || '–';
  }

  function showOverlay(text) {
    var el = document.createElement('div');
    el.className = 'overlay';
    el.innerHTML = '<b>' + score + ' 分</b><span>' + text + '</span>';
    $('board').appendChild(el);
  }

  async function endGame() {
    over = true;
    showOverlay('没有可合并的数字了 · 点「新开一局」再来');
    try {
      // 成绩写入服务端，刷新或换设备打开都还在
      await store.insert({ score: score, maxTile: maxTile, playedAt: new Date().toISOString() });
    } catch (err) {
      toast('成绩保存失败：' + err.message);
    }
    await loadHistory();
    toast('本局 ' + score + ' 分，已保存');
  }

  async function loadHistory() {
    var rows = [];
    try { rows = (await store.list()) || []; } catch (err) { rows = []; }
    var best = 0;
    for (var i = 0; i < rows.length; i++) best = Math.max(best, Number(rows[i].score) || 0);
    $('best').textContent = rows.length ? best : '–';
    if (!rows.length) {
      $('history').innerHTML = '<div class="empty">还没有成绩，先玩一局吧</div>';
      return;
    }
    var html = '<ul class="rows">';
    for (var j = 0; j < Math.min(rows.length, 6); j++) {
      var row = rows[j];
      html += '<li><span class="sc">' + (Number(row.score) || 0) + ' 分</span>' +
        '<span class="meta">最大数字 ' + (row.maxTile || '–') + ' · ' +
        new Date(row.createdAt || row.playedAt).toLocaleString('zh-CN') + '</span></li>';
    }
    html += '</ul>';
    $('history').innerHTML = html;
  }

  var KEY_DIR = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down'
  };
  document.addEventListener('keydown', function (ev) {
    var dir = KEY_DIR[ev.key];
    if (dir) { ev.preventDefault(); move(dir); }
  });

  // 触屏滑动
  var sx = 0, sy = 0;
  var boardEl = $('board');
  boardEl.addEventListener('touchstart', function (ev) {
    sx = ev.touches[0].clientX; sy = ev.touches[0].clientY;
  }, { passive: true });
  boardEl.addEventListener('touchend', function (ev) {
    var dx = ev.changedTouches[0].clientX - sx;
    var dy = ev.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  $('newBtn').addEventListener('click', function () {
    buildCells();
    init();
  });

  buildCells();
  init();
  loadHistory();
})();
</script>
</body>
</html>`;
}

/* -------------------------------- 贪吃蛇 -------------------------------- */

function buildSnake(plan) {
  const tpl = plan._template || GAME_SNAKE;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tpl.title}</title>
<style>
  :root { --accent: ${tpl.accent}; --accent-soft: ${tpl.accent}18; --ink: #0f172a; --ink-2: #5b6576; --line: #e6e9ee; --bg: #f7f8fa; --card: #ffffff; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 26px 18px 50px; }
  header.top { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .logo { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; background: var(--accent-soft); }
  header.top h1 { font-size: 21px; margin: 0 0 4px; }
  header.top p { margin: 0; color: var(--ink-2); font-size: 13px; }
  .spacer { flex: 1; }
  .btn { border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 10px 16px; border-radius: 10px; font-size: 13.5px; cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0 14px; }
  .stat { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 13px 16px; }
  .stat .k { font-size: 12px; color: var(--ink-2); margin-bottom: 6px; }
  .stat .v { font-size: 24px; font-weight: 680; letter-spacing: -.02em; }
  .stat.hot .v { color: var(--accent); }
  .stage { position: relative; border-radius: 18px; overflow: hidden; background: #101f14; border: 1px solid var(--line); }
  .stage canvas { display: block; width: 100%; height: auto; }
  .overlay { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; font-size: 14.5px; color: #d7f5df; text-align: center; background: rgba(8,20,12,.6); backdrop-filter: blur(2px); }
  .overlay .big { font-size: 36px; }
  .overlay b { font-size: 30px; color: #7ef29a; }
  .board { margin-top: 18px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; }
  .board h2 { font-size: 14.5px; margin: 0 0 12px; }
  ul.rows { list-style: none; margin: 0; padding: 0; }
  ul.rows li { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-top: 1px solid var(--line); font-size: 13px; }
  ul.rows li:first-child { border-top: 0; }
  ul.rows li .sc { font-weight: 680; color: var(--accent); min-width: 54px; }
  ul.rows li .meta { color: var(--ink-2); font-size: 12.5px; }
  .empty { color: var(--ink-2); font-size: 13px; padding: 14px 0; }
  .tips { color: var(--ink-2); font-size: 12.5px; margin-top: 10px; text-align: center; }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 16px); background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 10px; font-size: 13px; opacity: 0; transition: .22s; pointer-events: none; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 480px) { .stat .v { font-size: 20px; } .wrap { padding: 18px 12px 40px; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="logo">${tpl.icon}</div>
    <div>
      <h1>${tpl.title}</h1>
      <p>${tpl.subtitle}</p>
    </div>
    <div class="spacer"></div>
    <button class="btn primary" id="startBtn">开始游戏</button>
  </header>

  <section class="stats">
    <div class="stat hot"><div class="k">当前得分</div><div class="v" id="score">0</div></div>
    <div class="stat"><div class="k">蛇身长度</div><div class="v" id="len">3</div></div>
    <div class="stat"><div class="k">历史最高</div><div class="v" id="best">–</div></div>
  </section>

  <div class="stage" id="stage">
    <canvas id="cv" width="480" height="480"></canvas>
    <div class="overlay" id="overlay"><span class="big">${tpl.icon}</span><span>点「开始游戏」或按空格键出发</span></div>
  </div>
  <p class="tips">方向键 / WASD 控制 · 触屏滑动转向</p>

  <section class="board">
    <h2>历史成绩</h2>
    <div id="history"><div class="empty">还没有成绩，先玩一局吧</div></div>
  </section>
</div>
<div class="toast" id="toast"></div>

<script>
(function () {
  var COLS = 24, ROWS = 24, CELL = 20;
  var store = window.atoms.store(${JSON.stringify(tpl.collection)});
  var canvas = document.getElementById('cv');
  var ctx = canvas.getContext('2d');
  var snake, dir, pending, food, score, timer, running, speed;
  var overlay = document.getElementById('overlay');

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var box = $('toast');
    box.textContent = msg;
    box.classList.add('show');
    setTimeout(function () { box.classList.remove('show'); }, 1800);
  }
  function hideOverlay() { overlay.style.display = 'none'; }
  function showOverlay(html) { overlay.innerHTML = html; overlay.style.display = 'flex'; }

  function onSnake(p) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === p.x && snake[i].y === p.y) return true;
    }
    return false;
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (onSnake(food));
  }

  function refreshHud() {
    $('score').textContent = score;
    $('len').textContent = snake ? snake.length : 3;
  }

  function start() {
    snake = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
    dir = { x: 1, y: 0 };
    pending = null;
    score = 0;
    speed = 150;
    running = true;
    placeFood();
    hideOverlay();
    refreshHud();
    clearInterval(timer);
    timer = setInterval(tick, speed);
    draw();
  }

  function setSpeed(ms) {
    clearInterval(timer);
    timer = setInterval(tick, ms);
  }

  function tick() {
    if (pending) { dir = pending; pending = null; }
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    // 撞墙
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
    // 咬到自己（尾巴这一步会让出位置，所以只查到倒数第二节）
    for (var i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) return gameOver();
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      placeFood();
      // 越吃越快
      if (speed > 70) { speed -= 3; setSpeed(speed); }
      toast('+10');
    } else {
      snake.pop();
    }
    refreshHud();
    draw();
  }

  function draw() {
    // 背景网格
    ctx.fillStyle = '#101f14';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.strokeStyle = 'rgba(126,242,154,.06)';
    ctx.lineWidth = 1;
    for (var g = 1; g < COLS; g++) {
      ctx.beginPath(); ctx.moveTo(g * CELL, 0); ctx.lineTo(g * CELL, ROWS * CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g * CELL); ctx.lineTo(COLS * CELL, g * CELL); ctx.stroke();
    }
    // 食物
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * CELL, (food.y + 0.5) * CELL, CELL * 0.34, 0, Math.PI * 2);
    ctx.fill();
    // 蛇身（头亮尾暗）
    for (var i = snake.length - 1; i >= 0; i--) {
      var p = snake[i];
      var t = snake.length === 1 ? 0 : i / (snake.length - 1);
      ctx.fillStyle = i === 0 ? '#7ef29a' : 'rgba(34,197,94,' + (0.9 - t * 0.45).toFixed(2) + ')';
      roundRect(p.x * CELL + 1.5, p.y * CELL + 1.5, CELL - 3, CELL - 3, 5);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function gameOver() {
    running = false;
    clearInterval(timer);
    showOverlay('<b>' + score + ' 分</b><span>长度 ' + snake.length + ' · 点「开始游戏」或按空格再来</span>');
    finish();
  }

  async function finish() {
    try {
      // 成绩写入服务端，刷新或换设备打开都还在
      await store.insert({ score: score, length: snake.length, playedAt: new Date().toISOString() });
    } catch (err) {
      toast('成绩保存失败：' + err.message);
    }
    await loadHistory();
    toast('本局 ' + score + ' 分，已保存');
  }

  async function loadHistory() {
    var rows = [];
    try { rows = (await store.list()) || []; } catch (err) { rows = []; }
    var best = 0;
    for (var i = 0; i < rows.length; i++) best = Math.max(best, Number(rows[i].score) || 0);
    $('best').textContent = rows.length ? best : '–';
    if (!rows.length) {
      $('history').innerHTML = '<div class="empty">还没有成绩，先玩一局吧</div>';
      return;
    }
    var html = '<ul class="rows">';
    for (var j = 0; j < Math.min(rows.length, 6); j++) {
      var row = rows[j];
      html += '<li><span class="sc">' + (Number(row.score) || 0) + ' 分</span>' +
        '<span class="meta">长度 ' + (row.length || '–') + ' · ' +
        new Date(row.createdAt || row.playedAt).toLocaleString('zh-CN') + '</span></li>';
    }
    html += '</ul>';
    $('history').innerHTML = html;
  }

  var KEY_DIR = {
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    a: { x: -1, y: 0 }, d: { x: 1, y: 0 }, w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
    A: { x: -1, y: 0 }, D: { x: 1, y: 0 }, W: { x: 0, y: -1 }, S: { x: 0, y: 1 }
  };
  document.addEventListener('keydown', function (ev) {
    if (ev.code === 'Space') {
      ev.preventDefault();
      if (!running) start();
      return;
    }
    var nd = KEY_DIR[ev.key];
    if (!nd) return;
    ev.preventDefault();
    // 不能直接掉头
    if (dir && nd.x === -dir.x && nd.y === -dir.y) return;
    pending = nd;
  });

  // 触屏滑动转向
  var sx = 0, sy = 0;
  var stageEl = document.getElementById('stage');
  stageEl.addEventListener('touchstart', function (ev) {
    sx = ev.touches[0].clientX; sy = ev.touches[0].clientY;
  }, { passive: true });
  stageEl.addEventListener('touchend', function (ev) {
    var dx = ev.changedTouches[0].clientX - sx;
    var dy = ev.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    var nd;
    if (Math.abs(dx) > Math.abs(dy)) nd = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    else nd = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    if (dir && nd.x === -dir.x && nd.y === -dir.y) return;
    pending = nd;
  }, { passive: true });

  $('startBtn').addEventListener('click', start);
  loadHistory();
})();
</script>
</body>
</html>`;
}

/* ------------------------------ 展示型站点 ------------------------------ */

function buildLanding(plan) {
  const tpl = plan._template || { ...LANDING, ...LANDING_FALLBACK };
  const services = (tpl.services || []).map((s) => `
      <div class="card">
        <h3>${s.t}</h3>
        <p>${s.d}</p>
      </div>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tpl.name}</title>
<style>
  :root { --accent: ${tpl.accent}; --accent-soft: ${tpl.accent}14; --ink: #0f172a; --ink-2: #5b6576; --line: #e6e9ee; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: #fff; color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1000px; margin: 0 auto; padding: 0 20px; }
  nav { display: flex; align-items: center; gap: 10px; padding: 16px 0; }
  nav .logo { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--accent-soft); font-size: 17px; }
  nav b { font-size: 15px; }
  nav .links { margin-left: auto; display: flex; align-items: center; gap: 18px; }
  nav .links a { color: var(--ink-2); text-decoration: none; font-size: 13.5px; }
  nav .links a:hover { color: var(--accent); }
  nav .links a.cta { background: var(--accent); color: #fff; padding: 8px 16px; border-radius: 999px; font-weight: 600; }
  .hero { padding: 56px 0 48px; }
  .hero .badge { display: inline-block; font-size: 12px; color: var(--accent); background: var(--accent-soft); padding: 5px 12px; border-radius: 999px; margin-bottom: 18px; }
  .hero h1 { font-size: 40px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 16px; max-width: 620px; }
  .hero p { font-size: 15.5px; color: var(--ink-2); line-height: 1.8; max-width: 520px; margin: 0 0 26px; }
  .hero .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .btn { display: inline-block; border: 1px solid var(--line); background: #fff; color: var(--ink); padding: 11px 20px; border-radius: 11px; font-size: 14px; text-decoration: none; cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  section { padding: 40px 0; border-top: 1px solid var(--line); }
  section h2 { font-size: 20px; margin: 0 0 22px; letter-spacing: -.01em; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .card { border: 1px solid var(--line); border-radius: 14px; padding: 20px; }
  .card h3 { font-size: 15px; margin: 0 0 8px; }
  .card p { font-size: 13.5px; color: var(--ink-2); line-height: 1.7; margin: 0; }
  .book { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; align-items: start; }
  form { border: 1px solid var(--line); border-radius: 14px; padding: 20px; }
  label { display: block; font-size: 12.5px; color: var(--ink-2); margin: 12px 0 6px; }
  input, textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; color: var(--ink); }
  input:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  textarea { resize: vertical; }
  form button { width: 100%; margin-top: 16px; }
  .feed { font-size: 13px; color: var(--ink-2); }
  .feed ul { list-style: none; margin: 12px 0 0; padding: 0; }
  .feed li { border: 1px solid var(--line); border-radius: 11px; padding: 11px 13px; margin-bottom: 8px; }
  .feed li b { color: var(--ink); font-size: 13.5px; }
  footer { border-top: 1px solid var(--line); padding: 24px 0 40px; color: var(--ink-2); font-size: 12.5px; }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 16px); background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 10px; font-size: 13px; opacity: 0; transition: .22s; pointer-events: none; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 820px) {
    .hero h1 { font-size: 28px; }
    .cards, .book { grid-template-columns: 1fr; }
    nav .links a:not(.cta) { display: none; }
  }
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <span class="logo">${tpl.icon}</span>
    <b>${tpl.name}</b>
    <div class="links">
      <a href="#services">服务</a>
      <a href="#book">预约</a>
      <a class="cta" href="#book">立即预约</a>
    </div>
  </nav>

  <header class="hero">
    <span class="badge">欢迎来到 ${tpl.name}</span>
    <h1>${tpl.tagline}</h1>
    <p>我们相信好的体验来自细节。这里可以了解我们能提供的服务，也可以直接留下联系方式，我们会尽快与你联系。</p>
    <div class="actions">
      <a class="btn primary" href="#book">预约体验</a>
      <a class="btn" href="#services">看看服务</a>
    </div>
  </header>

  <section id="services">
    <h2>我们提供什么</h2>
    <div class="cards">${services}
    </div>
  </section>

  <section id="book">
    <h2>预约与留言</h2>
    <div class="book">
      <form id="bookForm">
        <label for="f_name">称呼</label>
        <input id="f_name" placeholder="怎么称呼你">
        <label for="f_contact">联系方式</label>
        <input id="f_contact" placeholder="手机号或微信">
        <label for="f_note">想咨询什么</label>
        <textarea id="f_note" rows="3" placeholder="例如：想预约周末两个人的位置"></textarea>
        <button class="btn primary" type="submit">提交预约</button>
      </form>
      <div class="feed">
        <b>最近的留言</b>
        <div id="feedList"><ul><li>还没有留言，成为第一个吧</li></ul></div>
      </div>
    </div>
  </section>

  <footer>© ${new Date().getFullYear()} ${tpl.name} · 本页面由 Atoms Demo 生成</footer>
</div>
<div class="toast" id="toast"></div>

<script>
(function () {
  var store = window.atoms.store(${JSON.stringify(tpl.collection || '预约留言')});
  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var box = $('toast');
    box.textContent = msg;
    box.classList.add('show');
    setTimeout(function () { box.classList.remove('show'); }, 1800);
  }
  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  async function loadFeed() {
    var rows = [];
    try { rows = (await store.list()) || []; } catch (err) { rows = []; }
    if (!rows.length) {
      $('feedList').innerHTML = '<ul><li>还没有留言，成为第一个吧</li></ul>';
      return;
    }
    var html = '<div style="margin:6px 0 0">已有 ' + rows.length + ' 条留言</div><ul>';
    for (var i = 0; i < Math.min(rows.length, 5); i++) {
      html += '<li><b>' + esc(rows[i].name || '访客') + '</b> · ' + esc(rows[i].contact || '') +
        '<div style="margin-top:4px">' + esc(rows[i].note || '') + '</div></li>';
    }
    html += '</ul>';
    $('feedList').innerHTML = html;
  }
  $('bookForm').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var name = $('f_name').value.trim();
    var contact = $('f_contact').value.trim();
    var note = $('f_note').value.trim();
    if (!name || !contact) { toast('请填写称呼和联系方式'); return; }
    try {
      // 留言写入服务端，刷新后依然在列表里
      await store.insert({ name: name, contact: contact, note: note });
      $('f_name').value = ''; $('f_contact').value = ''; $('f_note').value = '';
      await loadFeed();
      toast('已提交，我们会尽快联系你');
    } catch (err) {
      toast('提交失败：' + err.message);
    }
  });
  loadFeed();
})();
</script>
</body>
</html>`;
}

export { FALLBACK as MOCK_FALLBACK_TEMPLATE };
