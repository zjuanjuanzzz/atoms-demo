/**
 * 注入到「生成产物」里的运行时 SDK。
 *
 * 这是整个 Demo 里最关键的一个设计决策：
 * 生成出来的应用不是一坨死 HTML，而是自带一个数据层 —— 它可以通过
 * window.atoms.store('集合名') 读写真正的持久化数据。
 *
 * 传输方式有两种：
 *   1. host 模式：生成物跑在 sandbox iframe 里，通过 postMessage 把读写请求
 *      交给宿主页面，宿主再转发给服务端（SQLite / Redis）。因为 iframe 是
 *      独立源，生成物拿不到宿主的 DOM 和 Cookie。
 *   2. standalone 模式：导出的单文件 HTML 脱离平台也能用，自动降级到
 *      localStorage，保证「导出的东西是真能跑的」。
 *
 * 另外，SDK 会接管 window.onerror / unhandledrejection，把生成物的运行时
 * 报错回传给宿主 —— 这是「自检修复 Agent」的输入。
 */

export function buildRuntimeSdk({ appId, mode = 'host' }) {
  return `
(function () {
  if (window.atoms) return;
  var APP_ID = ${JSON.stringify(appId)};
  var MODE = ${JSON.stringify(mode)};
  var seq = 0;
  var pending = {};
  var ready = false;
  var downgraded = false;
  var localOnly = MODE !== 'host';

  function post(msg) {
    var payload = { __atoms: true, appId: APP_ID, type: msg.type, id: msg.id, method: msg.method, payload: msg.payload, message: msg.message };
    try { parent.postMessage(payload, '*'); } catch (e) {}
  }

  function rpc(method, payload) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject };
      post({ type: 'req', id: id, method: method, payload: payload });
      setTimeout(function () {
        if (pending[id]) { delete pending[id]; reject(new Error('atoms-host-timeout')); }
      }, 5000);
    });
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.__atoms !== true || d.appId !== APP_ID) return;
    if (d.type === 'ready') { ready = true; return; }
    if (d.type !== 'res') return;
    var p = pending[d.id];
    if (!p) return;
    delete pending[d.id];
    if (d.error) p.reject(new Error(d.error));
    else p.resolve(d.result);
  });

  // ---- 本地降级实现：导出的单文件、或宿主不可用时使用 ----
  function localKey(c) { return 'atoms:' + APP_ID + ':' + c; }
  function localAll(c) {
    try { return JSON.parse(localStorage.getItem(localKey(c)) || '[]'); } catch (e) { return []; }
  }
  function localWrite(c, arr) {
    try { localStorage.setItem(localKey(c), JSON.stringify(arr)); } catch (e) {}
  }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  function localStore(collection) {
    return {
      list: function () { return Promise.resolve(localAll(collection)); },
      insert: function (doc) {
        var arr = localAll(collection);
        var record = Object.assign({}, doc, { id: (doc && doc.id) || uid(), createdAt: new Date().toISOString() });
        arr.push(record);
        localWrite(collection, arr);
        return Promise.resolve(record);
      },
      update: function (id, patch) {
        var arr = localAll(collection);
        var idx = -1;
        for (var i = 0; i < arr.length; i++) if (arr[i].id === id) idx = i;
        if (idx < 0) return Promise.reject(new Error('not found'));
        arr[idx] = Object.assign({}, arr[idx], patch, { id: id });
        localWrite(collection, arr);
        return Promise.resolve(arr[idx]);
      },
      remove: function (id) {
        localWrite(collection, localAll(collection).filter(function (d) { return d.id !== id; }));
        return Promise.resolve(true);
      },
      clear: function () { localWrite(collection, []); return Promise.resolve(true); }
    };
  }

  function hostStore(collection) {
    function call(method, payload) {
      return rpc(method, Object.assign({ collection: collection }, payload || {}));
    }
    return {
      list: function (opts) {
        if (localOnly || downgraded) return localStore(collection).list();
        return call('list', opts).then(function (rows) {
          // 顺带镜像一份到本地，宿主掉线时依然可读
          localWrite(collection, rows || []);
          return rows || [];
        });
      },
      insert: function (doc) {
        if (localOnly || downgraded) return localStore(collection).insert(doc);
        return call('insert', { doc: doc });
      },
      update: function (id, patch) {
        if (localOnly || downgraded) return localStore(collection).update(id, patch);
        return call('update', { id: id, patch: patch });
      },
      remove: function (id) {
        if (localOnly || downgraded) return localStore(collection).remove(id);
        return call('remove', { id: id });
      },
      clear: function () {
        if (localOnly || downgraded) return localStore(collection).clear();
        return call('clear', {});
      }
    };
  }

  function makeStore(collection) {
    if (MODE !== 'host') return localStore(collection);
    var api = hostStore(collection);
    // 首次调用如果宿主没响应，自动降级到本地，保证应用永远可用
    return {
      list: function (o) { return api.list(o).catch(function () { downgraded = true; return localStore(collection).list(); }); },
      insert: function (d) { return api.insert(d).catch(function () { downgraded = true; return localStore(collection).insert(d); }); },
      update: function (i, p) { return api.update(i, p).catch(function () { downgraded = true; return localStore(collection).update(i, p); }); },
      remove: function (i) { return api.remove(i).catch(function () { downgraded = true; return localStore(collection).remove(i); }); },
      clear: function () { return api.clear().catch(function () { downgraded = true; return localStore(collection).clear(); }); }
    };
  }

  window.atoms = {
    appId: APP_ID,
    mode: MODE,
    store: makeStore,
    toast: function (text) { post({ type: 'toast', message: String(text == null ? '' : text) }); },
    confirm: function (text) { return Promise.resolve(window.confirm(text)); }
  };

  function reportError(message) {
    post({ type: 'error', message: String(message).slice(0, 500) });
  }
  window.addEventListener('error', function (e) {
    reportError(e && e.message ? e.message : 'unknown error');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    reportError((r && r.message) || r || 'unhandled rejection');
  });

  try { post({ type: 'hello' }); } catch (e) {}
})();
`.trim();
}

/**
 * 把 SDK 注入到生成产物的 HTML 里（幂等）。
 *
 * 必须注入到 <head> 里：生成物自己的 <script> 一定在 <body> 中，
 * 如果 SDK 放在 </body> 前，应用脚本会先执行并因为 window.atoms 未定义而中断 ——
 * 表现就是「页面渲染出来了，但数据一直加载中」。这是必须由真实浏览器验证才能发现的坑。
 */
export function injectSdk(html, { appId, mode }) {
  const sdk = `<script data-atoms-runtime>${buildRuntimeSdk({ appId, mode })}</script>`;
  if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, `${sdk}\n</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => `${sdk}\n${m}`);
  return `${sdk}\n${html}`;
}

/** 如果模型没输出 viewport，补一个，避免手机端显示像桌面缩放。 */
export function ensureViewport(html) {
  if (/name=["']viewport["']/i.test(html)) return html;
  return html.replace(/<head([^>]*)>/i, '<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1">');
}
