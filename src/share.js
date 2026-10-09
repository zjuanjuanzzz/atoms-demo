/**
 * 分享页 /p/:projectId
 *
 * 生成物本身是「用户提交的任意 HTML」，所以绝不可以直接挂在主站源下渲染，
 * 否则等于开了一个 XSS 后门。这里的做法是：分享页只做一个壳，把产物放进
 * sandbox iframe（不给 allow-same-origin）里跑，和编辑器里的预览完全一致。
 */

export function renderSharePage({ project, version, baseUrl }) {
  const title = escapeHtml(version.title || project.title || 'Atoms App');
  const renderUrl = `/api/projects/${project.id}/versions/${version.id}/render`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Atoms Demo</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { display: flex; flex-direction: column; background: #0f1115; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  header { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #171a21; color: #e7e9ee; border-bottom: 1px solid #23262f; flex: none; }
  header .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; }
  header h1 { font-size: 14px; font-weight: 600; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  header .tag { font-size: 12px; color: #8b93a7; }
  header a { color: #8b93a7; font-size: 12px; text-decoration: none; border: 1px solid #2c313c; padding: 4px 10px; border-radius: 999px; }
  header a:hover { color: #e7e9ee; border-color: #3a4150; }
  header a.remix { color: #c7cbff; border-color: #4f46e5; background: rgba(79, 70, 229, .18); }
  header a.remix:hover { color: #fff; background: rgba(79, 70, 229, .32); border-color: #6d68ea; }
  main { flex: 1; display: flex; padding: 14px; min-height: 0; }
  iframe { flex: 1; width: 100%; border: 0; border-radius: 14px; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,.35); }
  #host-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); background: #111827; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; opacity: 0; transition: opacity .2s; pointer-events: none; }
  #host-toast.show { opacity: 1; }
</style>
</head>
<body>
<header>
  <span class="dot"></span>
  <h1>${title}</h1>
  <span class="tag">由 Atoms Demo 生成 · 数据实时保存</span>
  <a class="remix" href="/?remix=${project.id}">复刻这个应用</a>
  <a href="/" target="_blank" rel="noreferrer">自己做一个 →</a>
</header>
<main>
  <iframe id="stage" src="${renderUrl}?v=${encodeURIComponent(version.id)}" sandbox="allow-scripts allow-forms allow-modals allow-popups" title="${title}"></iframe>
</main>
  <div id="host-toast"></div>
  <script src="/assets/bridge.js"></script>
  <script>
    // 先声明 appId，再把舞台 iframe 交给桥接层做来源校验
    window.__ATOMS_APP_ID__ = ${JSON.stringify(project.id)};
    window.__ATOMS_REGISTER_FRAME__(document.getElementById('stage'));
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
