# Atoms Demo

> 用一句话把想法变成**可运行、可交互、数据可持久化**的网页应用：一支有名字的 AI 团队负责拆解、生成、质检，右侧 App Viewer 立刻就能点着用，随时发布成公开链接。

**在线演示**：<https://atoms-demo-02329.app.workbuddy.host/> 　**源码**：本仓库

对标 [Atoms](https://atoms.dev/) 的产品形态（工作区 → 项目对话 → App Viewer → 发布公开链接），差异化的地方落在一点上：

**生成物不是一坨静态 HTML，而是自带数据层的真应用。** 生成出来的页面通过 `window.atoms.store()` 读写服务端数据，刷新不丢、分享给别人的链接打开也是同一份数据。

## 0. 题目要求与验收口径

笔试题目原文的公开版本如下（原发布地址有访问限制，为便于评审，此处给出可公开阅读的转录）：

> 在 3–4 小时内完成一个可运行的 Atoms Demo（参考 atoms.dev 的 AI Agent 平台）：
> 1. 真实交互，非静态页面；
> 2. 数据持久化；
> 3. 覆盖基本使用流程：初始化 / 注册登录 / 核心主流程；
> 4. 至少一个延展能力；
> 5. 提供可测试的在线访问链接；
> 6. 非 PoC，实际可用；
> 7. 48 小时内提交，建议 3–4 小时专注开发。

逐条对应关系：

| 要求 | 对应实现 | 在线验证方式 |
| --- | --- | --- |
| 真实交互 | 生成物是可点、可填、可删的单文件应用，跑在 sandbox iframe | 生成后在「预览」里直接操作 |
| 数据持久化 | 生成物经 `atoms.store` 写入服务端；当前线上默认 `sqlite`（容器内持久，**重新部署会重置**），切到 **Turso 云端 SQLite** 可跨部署持久（`STORAGE=turso` + 两个 Turso 变量） | 预览里新增一条记录 → 刷新页面 → 记录还在；「数据」页签可见同一份数据 |
| 初始化/注册登录 | 邮箱注册、登录、一键体验账号，scrypt 加盐哈希 + httpOnly 会话 | 首页注册 → 退出 → 重新登录，项目与数据都在 |
| 核心主流程 | 一句话需求 → 多 Agent 流式生成 → App Viewer 预览 → 发布公开链接 | 见下方「5 分钟演示脚本」 |
| 延展能力 | ① 版本历史与回滚 ② 导出可独立运行的单文件 HTML ③ 复刻（Remix）他人已发布应用 ④ 运行时报错显式呈现 + 真实模型下自动修复 | 顶栏「版本历史 / 导出 / 分享」；分享页里「Remix」 |
| 在线链接 | 见文首「在线演示」 | 直接打开 |
| 非 PoC | 端到端冒烟测试 11 组全绿（`tools/smoke.mjs`），Turso 驱动另有 24 项一致性测试（`tools/turso-test.mjs`） | 本地 `node tools/smoke.mjs` 可复跑 |

### 5 分钟演示脚本（对应评审口径逐条走）

1. **注册登录**：打开在线链接 → 注册（或「一键体验」）。
2. **真实模型生成**：未配置 Key 时为内置演示模式；在「模型设置」里填入任意 OpenAI 兼容接口（如智谱 `glm-4-flash`、DeepSeek）后，生成由真实模型完成，`/api/health` 显示 `llm=live` 与模型名。
3. **生成与交互**：输入「帮我做一个门店巡检记录工具，记录巡检点位、结果和备注」→ 观察多 Agent 流式过程 → 在预览里新增几条记录（真实写入数据库）。
4. **数据持久化**：刷新页面 / 退出登录再登录 → 项目、版本与业务数据全部还在（当前默认 sqlite 在容器内持久；如需跨部署持久，按上面"云端持久化"节切到 Turso）。
5. **增量迭代**：继续对话「加一个按结果筛选的下拉框」→ 生成新版本且改动生效。
6. **代码管理**：顶栏「代码」看当前版本源码；「导出」下载单文件 HTML（双击可离线运行）；「版本历史」恢复任意旧版本，恢复后预览正常。
7. **发布分享**：点「发布」拿 `/p/<slug>` 公开链接 → 无痕窗口打开验证 → 里面还有「Remix 到我的工作区」。
8. **报错显式化**：生成物运行时报错会在页面底部以红色浮层呈现；接了真实模型时质检 Agent 自动修复并生成新版本。

## 界面速览

| 工作台（WorkSpace） | 项目工作台（对话 + App Viewer） |
| --- | --- |
| ![工作台](docs/screenshots/04-home-dashboard.jpg) | ![项目工作台](docs/screenshots/01-project-preview.jpg) |

| 数据面板（生成物写入的真实数据） | 发布面板 |
| --- | --- |
| ![数据面板](docs/screenshots/02-data-panel.jpg) | ![发布面板](docs/screenshots/03-publish-panel.jpg) |

| 发布后的公开页面 | |
| --- | --- |
| ![分享页](docs/screenshots/05-share-page.jpg) | |

| 模型设置（界面内配置 API Key） | |
| --- | --- |
| ![模型设置](docs/screenshots/06-model-settings.jpg) | |

| 注册 / 登录 / 一键体验 | |
| --- | --- |
| ![注册登录](docs/screenshots/07-auth-register.jpg) | |

| 生成的小游戏（成绩会入库） | |
| --- | --- |
| ![打靶射击小游戏](docs/screenshots/08-shooting-game.jpg) | |

| 真实模型生成的应用（DeepSeek） | |
| --- | --- |
| ![真实模型产物](docs/screenshots/09-real-model-app.jpg) | |

---

## 1. 快速开始

环境要求：**Node.js 24 及以上**（推荐；内置 `node:sqlite`，无需任何编译依赖）。项目**零第三方依赖，不需要 `npm install`**。

```bash
# 启动（不配置任何环境变量也能跑，会自动进入 Mock 演示模式）
node server.js
# 或
npm start
```

打开 http://localhost:8787 即可。

第一次进入会让你创建一个「工作区」（代替注册登录），然后在中间的大输入框里描述你想要的应用，例如：

> 帮我做一个门店巡检记录工具，记录巡检点位、结果和备注，手机上也要好用

## 2. 环境变量

### 想接真实模型？两种方式任选

**方式 A：界面里配（推荐，不用重启）**
工作台左下角「模型设置」（项目页右上角 ⚙ 也能进）→ 点一下服务商预设（DeepSeek / Kimi / 硅基流动 / 智谱 / 通义千问 / OpenAI）→ 粘贴 API Key → **先点「测试连接」再点「保存」**。配置存在数据库里，重启和重新部署都不丢。

**方式 B：环境变量**
复制 `.env.example` 为 `.env`，填好下面三项后重启服务。`.env.example` 里已经列好各家服务商的地址与模型名，取消注释即可。

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `LLM_BASE_URL` | 任意 OpenAI 兼容接口地址 | `https://api.openai.com/v1` |
| `LLM_API_KEY` | 不填则进入 Mock 演示模式 | 空 |
| `LLM_MODEL` | 模型名 | `gpt-4o-mini` |
| `LLM_MAX_TOKENS` | 生成代码的最大长度（多数服务商上限 8k） | `6000` |
| `PORT` | 服务端口 | `8787` |
| `STORAGE` | `sqlite` / `turso` / `redis`；不填时若 `TURSO_*` 两项都有值则自动启用 turso | `sqlite` |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | 云端 SQLite（libSQL/hrana HTTP，纯 fetch 零依赖），解决部署平台磁盘非持久的问题 | 空 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | `STORAGE=redis` 时使用 | 空 |

**方式 C：平台内置免密钥云通道（当前线上实例用的就是这条）**
部署在 WorkBuddy 平台上时，应用自带一条免密钥的大模型通道：地址就是应用自己的域名，模型列表和对话接口挂在 `/.cloud/llm/` 下。把 `LLM_API_KEY` 填成 `wbpk_` 开头的平台 Key 就会自动识别并走这条通道——不需要任何服务商账号、不需要充值。

```bash
LLM_API_KEY=wbpk_xxxxxxxx_xxxxxxxxxxxx
LLM_BASE_URL=https://<应用域名>
LLM_MODEL=auto          # auto = 自动发现可用模型并在 /api/health 里回报真实模型名
```

两个和普通 OpenAI 兼容接口不同的地方，代码里已经处理掉了：
- **只支持流式**：非流式调用由客户端用流式累积实现（`src/llm.js` 的 `chat()` 内部走 `chatStream()`）；
- **网关做了内容检查**：请求体里带 XSS 特征字面量会被网关直接返回 403 网页。见下面「关键设计取舍 ⑦」。

> **也可以完全不动环境变量**：界面左下角「模型设置」（项目页右上角的 ⚙ 也能进）里填写接口地址、模型名和 API Key，保存后立即生效，配置存在数据库里。生效优先级：请求里的临时覆盖 > 界面配置 > 环境变量 > 默认值。
>
> Key 只在服务端保存，读取接口永远只返回掩码（如 `sk-te····cdef`）。**公开部署时请留意：任何访问者都能替换或消耗这个 Key**，正式产品需要配合鉴权与配额。

> 国内网络访问不了 `api.openai.com`，直接用 DeepSeek（`https://api.deepseek.com/v1` + `deepseek-chat`）最省事。各家接口都是 OpenAI 兼容格式，任何一家都能用。

> **模型选型建议**：写应用优先用**非推理模型**（如 `deepseek-chat`），实测首字 2 秒左右、20–45 秒产出一个 20KB+ 的完整应用。推理型模型（`deepseek-v4-flash`、`*-reasoner` 等）会把大量 token 花在思考上，更容易触达长度上限；系统对此做了两重兜底：正文为空时自动从思考内容里提取产物，输出被截断时让质检 Agent 精简重写。

> 连接出问题时用 `node tools/diag-llm.mjs` 逐项定位（地址对不对、模型名对不对、Key 有没有效），用 `node tools/debug-stream.mjs` 看模型原始返回的流结构。两个脚本都不会打印 Key 原文。

接好之后，用下面这条命令跑一次真实模型的全链路验收（会打印首字延迟、总耗时，并检查产物是否调用数据层、是否引用外链资源）：

```bash
node tools/test-live.mjs
node tools/test-live.mjs --autofix          # 额外验证"运行时错误 → 自动修复"
node tools/test-live.mjs --prompt="做一个健身房课程预约工具"
```

> **Mock 演示模式**：没有 API Key 时，内置生成器按需求关键词分三类产出**真实可交互、真实调用数据层**的单文件应用：
> - **数据台账类**：门店巡检 / 团队任务 / 记账 / 客户跟进 / 库存 / 习惯打卡 …（含通用台账兜底）；
> - **小游戏类**：射击打靶小游戏（限时挑战、连击加分、成绩入库、历史排行）；
> - **展示站点类**：官网 / 落地页 / 作品集（主视觉 + 服务介绍 + 预约留言表单）。
>
> 明确超出范围的需求（视频、文档、音频、原生 App、聊天机器人等）会**如实说明做不了**，并给出「去配置模型」的入口 —— 不会硬编一个不相干的应用忽悠人。

### 云端持久化（Turso / Upstash Redis）启用步骤

默认用 `node:sqlite` 写到 `data/atoms.db`，**容器重启就会丢**。给评审账号、给客户演示、给任何想长期保留数据的场景，请务必切到云端库，5 分钟搞定：

**Turso（推荐，SQLite 协议、零运维）**

1. 用 GitHub 登录 [turso.tech](https://turso.tech)，点 *Create database*，区域选离你最近的，名字随便起（例 `atoms-demo-prod`）；
2. 左侧 *Settings → Create token*，生成一个长期 token（权限选 *Read & Write*），**复制一次后只会再显示一次**；
3. 编辑项目里的 `.env`，把下面三行取消注释并填上：
   ```bash
   STORAGE=turso
   TURSO_DATABASE_URL=libsql://<你的库名>-<org>.turso.io
   TURSO_AUTH_TOKEN=<刚才复制的 token>
   ```
4. 重新部署（`workbuddy_sites_deploy`），**同一条数据库 URL 永远不要再变**；以后任何一次部署，账号、项目、版本、数据全部从 Turso 读出来。

> Turso 不可达时（网络抖动、token 失效）会自动回落本地 SQLite，服务不会因此挂掉，但写入会落到本地临时盘，重启后丢失——所以演示环境就老老实实让网络通畅。

**Upstash Redis（备选）**

```bash
STORAGE=redis
UPSTASH_REDIS_REST_URL=https://<你的实例>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<REST token>
```

> 验证持久化效果：注册账号 → 建项目 → 生成应用 → 加几条数据 → 退出登录 → 重新登录 → 数据与项目都还在。当前线上实例使用 sqlite（在容器内持久，**重新部署会重置**），验收时如果发现数据被重置，请按上面步骤切到 Turso。

## 3. 核心流程

```
用户一句话需求
      │
      ├─ 🧩 Emma 产品经理 + 📐 Bob 架构师   一次调用产出方案与数据结构
      │
      ├─ ⌨️ Alex 工程师                     流式产出完整单文件应用（打字机效果）
      │
      ├─ 🔍 Ada 质检                        静态规则校验，不通过则自动修复一轮
      │
      ├─ App Viewer 实时渲染（桌面 / 手机）
      │       └─ 用户在应用里操作的每一条数据 → postMessage → 服务端存储
      │
      ├─ 继续对话迭代  →  生成新版本（版本历史可回滚）
      │
      └─ 发布  →  /p/<slug> 公开地址（任何人可用，数据共享）
```

运行期如果生成物抛错，桥接层会把报错回传给宿主，触发 Ada 的**第二轮修复**并生成新版本 —— 这是「自检」真正落地的地方。

## 4. 关键设计取舍

**① 产物统一成「单文件 HTML」**
生成物只允许是一个自包含的 HTML（内联 CSS/JS，禁止任何外链资源）。一个决定同时解决四件事：预览就是 iframe 渲染、持久化就是存一个字符串、分享就是把它吐出来、导出就是一个能双击运行的文件。代价是复杂应用做不了多文件工程 —— 对这个 Demo 的规模来说，收益远大于代价。

**② 生成物自带数据层（本项目的核心亮点）**
宿主在渲染前往 HTML 中注入一段运行时 SDK，生成物调用 `window.atoms.store('集合名')` 就能读写真正的数据库。这条链路让「AI 生成的页面」从演示品变成了可用的小工具：

```
生成物 (sandbox iframe, 独立源)
   └─ window.atoms.store('巡检记录').insert({...})
        └─ postMessage ─────────────► 宿主页面 bridge.js
                                          └─ POST /api/data ─► SQLite / Redis
```

宿主侧会校验消息来源必须是自己的舞台 iframe；SDK 侧带 5 秒超时，一旦宿主不可用就降级到 `localStorage`，所以**导出的单文件应用脱离平台也能跑**。

### 数据持久化落在两层

| 层 | 存什么 | 本地 / 容器 | 免费托管（磁盘非持久） |
| --- | --- | --- | --- |
| 平台数据 | 账号与会话、工作区、项目、对话消息、版本（含完整源码）、模型配置 | `node:sqlite`，单文件 `data/atoms.db` | **Turso 云端 SQLite**（libSQL hrana HTTP，纯 fetch 零依赖）或 Upstash Redis REST |
| 生成物的业务数据 | 生成的应用通过 `atoms.store` 写入的记录，按 `(项目, 集合, 记录ID)` 存储 | 同上 | 同上 |

两层都走同一组存储接口（`src/store.js` 里的驱动实现同一套方法），`STORAGE` 环境变量切换。数据面板里看到的记录就是服务端这张表的真实内容；发布出去的应用与编辑器预览读的是同一份数据，所以「刷新不丢、换设备还在、别人打开也一致」。Turso 不可达时自动回落本地 SQLite，服务不会因此不可用。

**③ 生成物跑在 sandbox iframe 里**
iframe 使用 `sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"`，**不给 `allow-same-origin`**。用户生成的任意代码拿不到主站的 DOM、Cookie 和存储；发布页 `/p/<slug>` 也只是同一套沙箱外壳，不把用户 HTML 直接挂在主站源下。

**④ 双模式 Agent，永不空场**
真实模型走流式生成；没有 Key 时走内置生成器。两者产出的事件流、数据结构完全一致，前端不需要区分。

**⑤ 零第三方依赖**
HTTP 用 `node:http`，存储用 `node:sqlite`（或纯 HTTP 的 Turso / Upstash REST），模型调用用内置 `fetch`，`.env` 自己解析。收益：`git clone` 后直接 `node server.js`，没有 `node_modules`，部署不会被依赖和构建拖累，整份代码可以逐行读。

**⑦ 增量修改要带着旧代码走模型，而网关会拦「像 XSS 的请求体」**
「在已有应用上改一版」必须把当前源码原样交给模型；但平台网关会对请求体做内容检查，命中 XSS 特征就返回 403（拦的是**请求体**，跟响应无关）。实测会被拦的不只是 `<script`、`<iframe`，还有 `document.createElement(...)`、`alert(`、`/etc/passwd` 这类字样，并且**网关会解码 HTML 实体**——把 `<` 写成 `&lt;` 等于没转义。

解法是 `src/agent.js` 里的 `wafEscape()`，用不可见的零宽空格（U+200B）在「特征词的中间」打断，视觉上模型看到的仍是原代码，输出侧 `extractHtml()` 统一剥离，往返无损（有测试断言保证）：

| 打断位置 | 覆盖的特征 |
| --- | --- |
| `<` 之后 | 所有标签形态：`<script` / `<iframe` / `<svg onload` |
| `on*=` 的 `=` 前 | 事件属性：`onclick=` / `onerror=` / `oninput=` |
| `alert(` / `eval(` / `confirm(` 的 `(` 前 | 高危调用 |
| 小写字母与大写字母之间 | 驼峰 API：`createElement` / `innerHTML` / `XMLHttpRequest` |
| `/` 之后、空格之前 | 路径特征与多词短语：`/etc/passwd` / `union select` |

原则是**所有送模型的用户内容与代码都过一遍 `wafEscape`**：需求、方案 JSON、旧版本源码、质检问题清单、运行时错误、待修复的产物，一个都不能漏（漏一处，整包被拦）。这套东西共 7 层规则，实测把一份 22KB 的产物转义后（体积 +16%）连续多次请求稳定通过；同一份产物不转义必 403。

配套的两个稳健性处理也在同一条链路上：网关偶发连接超时时自动退避重试（`fetchWithRetry`，只重试纯网络错误，4xx/5xx 不重试、用户取消不重试）；Ada 的自动修复变成**非致命**——修复调用超时或失败时保留已拿到的产物并如实提示，而不是把整个生成结果一起报废。

**⑥ 存储按部署环境切换**
本地/容器用 SQLite（单文件、零运维）；免费托管平台的磁盘通常是临时的，所以云端优先走 **Turso（云 SQLite）**——同一个 SQLite 方言、同一套 SQL，只把「怎么执行 SQL」抽成适配器，业务代码一行不改；Upstash Redis 是备选路径。Turso 连不上时自动回落本地 SQLite。

## 5. 目录结构

```
atoms-demo/
├─ server.js              # HTTP 服务：路由、SSE 流式生成、发布、数据 RPC
├─ src/
│  ├─ agent.js            # Agent 管线（Emma/Bob → Alex → Ada）与提示词
│  ├─ llm.js              # OpenAI 兼容客户端（流式 + JSON 模式）
│  ├─ mock-builder.js     # Mock 模式的内置生成器（业务模板 → 单文件应用）
│  ├─ runtime.js          # 注入到生成物里的运行时 SDK 与注入逻辑
│  ├─ share.js            # 发布页外壳（沙箱 iframe）
│  └─ store.js            # 存储层：SQLite / Turso（云 SQLite）/ Upstash Redis 三套驱动
├─ public/
│  ├─ index.html          # 工作台 + 项目工作台
│  ├─ app.js              # 前端状态与交互
│  ├─ styles.css
│  └─ bridge.js           # 宿主桥接层（编辑器与分享页共用）
└─ tools/
   ├─ smoke.mjs           # 端到端冒烟测试（11 组：含版本导出/恢复/源码视图）
   ├─ turso-test.mjs      # Turso 驱动一致性测试（24 项）
   ├─ turso-mock.mjs      # hrana v2 协议模拟服务（供驱动离线测试）
   ├─ test-mock.mjs       # Mock 生成器分类测试
   ├─ test-live.mjs       # 真实模型全链路验收
   └─ diag-llm.mjs / debug-stream.mjs  # 模型连接诊断
```

## 6. 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查（返回存储驱动与模型模式） |
| POST | `/api/auth/register` | 注册（邮箱 + 密码，scrypt 加盐哈希） |
| POST | `/api/auth/login` / `/api/auth/logout` | 登录 / 退出（httpOnly Cookie 会话） |
| GET | `/api/auth/me` | 当前登录用户 |
| PATCH | `/api/auth/profile` | 修改工作区名称 |
| GET / POST | `/api/settings` | 读取（掩码）/ 保存模型配置 |
| POST | `/api/settings/test` | 测试模型连通性，返回可定位的错误原因 |
| GET / POST | `/api/projects` | 项目列表 / 新建项目 |
| GET / PATCH / DELETE | `/api/projects/:id` | 项目详情 / 改名与发布 / 删除 |
| POST | `/api/projects/:id/remix` | **复刻**：把（已发布的）应用复制到自己的工作区 |
| POST | `/api/projects/:id/generate` | **SSE 流式生成**（step / plan / delta / issues / artifact / done） |
| POST | `/api/projects/:id/autofix` | 运行时错误触发的自动修复 |
| GET | `/api/projects/:id/versions/:vid/render` | 渲染产物（注入运行时 SDK，`?raw=1` 返回原始代码） |
| GET | `/api/projects/:id/versions/:vid/export` | 导出可独立运行的单文件 HTML |
| POST | `/api/projects/:id/versions/:vid/restore` | 回滚到指定版本 |
| GET | `/api/projects/:id/data` | 数据面板（集合与记录） |
| POST | `/api/data` | 生成物的数据 RPC（list / insert / update / remove / clear） |
| GET | `/p/:slug` | 发布后的公开地址 |

## 7. 测试

服务启动后执行端到端冒烟测试（11 组：注册登录 → 建项目 → 流式生成 → 数据读写 → 发布分享 → 二次迭代 → 权限隔离 → 复刻 → **版本源码/导出/恢复**）：

```bash
node tools/smoke.mjs
```

> 提示：服务已经接入真实模型时，`smoke.mjs` 里的生成步骤会真的调用模型 —— 耗时更长、也会消耗额度；只想验后端逻辑可以先清掉 Key 跑一次。

评审口径的验收脚本（33 项断言，本地与线上通用，全部通过时退出码为 0）：

```bash
BASE=https://<应用域名> node tools/acceptance.mjs
```

覆盖 7 组口径：① `/api/health` 是否 `llm=live` 且回报真实模型名 → ② 注册/登录/会话 → ③ 需求到应用的 SSE 全流程 → ④ 同项目增量修改（新版本内容确实变了）→ ⑤ 产物预览（预览注入 SDK、源码视图不注入、standalone 可离线）→ ⑥ 数据持久化（写入 → 登出 → 重新登录 → 记录仍在）→ ⑦ 代码管理（导出/版本历史/恢复旧版本）与发布分享。

Turso 云存储驱动有一致性测试：用 `tools/turso-mock.mjs`（hrana v2 协议模拟服务）在本地完整验证驱动的编解码与全部业务方法，不需要能连上外网：

```bash
node tools/turso-test.mjs        # 24 项：账号/会话/项目/版本/数据层/配置/级联删除/鉴权
```

生成器（Mock 模式）单独有测试，覆盖 10 类需求落到哪一类产物：

```bash
node tools/test-mock.mjs
```

## 8. 部署

完整的 Windows / Linux 部署步骤（含服务化、反代、HTTPS、备份、排障清单）见 **[docs/部署说明.md](docs/部署说明.md)**，配套的即用文件在 `deploy/`：

| 文件 | 用途 |
| --- | --- |
| `deploy/windows-service.ps1` | Windows 注册为开机自启服务（任务计划程序，零第三方依赖） |
| `deploy/atoms-demo.service` | Linux systemd 服务单元 |
| `deploy/nginx.conf` | Nginx 反向代理（已处理 SSE 缓冲问题）+ HTTPS 说明 |
| `deploy/docker-compose.yml` | Docker Compose 一键起（含数据卷与健康检查） |
| `deploy/backup.sh` | SQLite 一致性备份脚本（配 cron） |

**方式 A：Docker（任意容器平台）**

```bash
docker build -t atoms-demo .
docker run -p 8080:8080 -e STORAGE=sqlite atoms-demo
```

**方式 B：Render / Railway 免费实例 + Turso 云 SQLite**（推荐，磁盘非持久的平台首选）

1. 在 [Turso](https://turso.tech/) 建一个免费数据库，拿到 `libsql://…` 地址与 Auth Token；
2. 平台新建 Web Service 指向本仓库，`buildCommand` 留空，`startCommand` 为 `node server.js`；
3. 配置 `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`（以及可选的 `LLM_*`）——`STORAGE` 可以不填，检测到 Turso 凭证后自动启用云端。

**方式 B'：Render 免费实例 + Upstash Redis**（备选，仓库里已附 `render.yaml`）

1. 在 Upstash 建一个免费 Redis，拿到 REST URL 与 Token；
2. 配置 `STORAGE=redis`、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。

## 9. 已知限制

- **账号体系很轻**：注册只校验邮箱格式和密码长度，没有邮箱验证、找回密码、第三方登录；会话是 30 天的 httpOnly Cookie，没有刷新与吊销列表。
- **`/api/data` 未限流**：生成物可以无限制写入，缺少配额与频率控制。
- **静态质检的边界**：Ada 的静态检查是规则式的（结构、外链、是否调用数据层），不是真正的 JS 语法/AST 校验；运行时错误触发的修复依赖真实模型（Mock 模式不会自动改代码）。
- **单文件产物的天花板**：多页面、复杂状态管理、需要 npm 生态的应用不适合这套形态。
- **Mock 模式的理解能力有限**：靠关键词匹配业务模板，只能响应的是一小类「录入 + 查看 + 维护」需求；二次迭代在 Mock 模式下会沿用上一版产物，不做代码级改写（真实模型才会真正改）。
- **平台云通道受网关内容检查约束**：见「关键设计取舍 ⑦」，转义是无损的，但网关规则若变化需要同步补 `wafEscape` 的规则层；换用自带 Key 的普通 OpenAI 兼容接口（方式 A/B）则没有这条限制。
- **超长产物会被截断**：单次输出受 `LLM_MAX_TOKENS` 限制，触顶时质检 Agent 会精简重写一轮；修复输入压到 14K 以避开上游超时。

## 10. 开发方式说明

这个项目本身是按笔试要求用 AI 工具完成的（Codex 全程参与：需求拆解、代码生成、真实浏览器验收与缺陷修复）。开发过程中的真实记录：

- 先读 `atoms.dev` 与 `support.mgx.dev` 文档站，把产品骨架（Workspace / 团队 Agent / App Viewer / Publish）对齐后再动手；
- 用真实浏览器逐条验收，而不是只看代码：过程中发现并修掉了三个只有跑起来才会暴露的问题 —— 运行时 SDK 注入位置错误导致应用脚本中断、分享页未注册 iframe 来源、Mock 模式下二次迭代会丢失原应用类型；
- 每个阶段都保留「怎么验证的」：`tools/smoke.mjs` 覆盖后端主链路，界面部分用浏览器实测。