/**
 * 宿主桥接层。
 *
 * 生成物跑在 sandbox iframe 里（独立源，拿不到宿主 DOM 和 Cookie），
 * 它在页面里调用的 window.atoms.store() 会通过 postMessage 发到这里，
 * 再由这里转发给服务端。编辑器预览页和发布后的分享页共用这个文件，
 * 保证「预览时能用的交互，发布后一样能用」。
 */
(function () {
  // appId 采用惰性读取：主页会在打开项目后才设置它，分享页则是先加载脚本再赋值
  function getAppId() { return window.__ATOMS_APP_ID__ || null; }

  var allowedSources = [];
  function registerFrame(frame) {
    if (frame && frame.contentWindow) allowedSources.push(frame.contentWindow);
  }
  window.__ATOMS_REGISTER_FRAME__ = registerFrame;

  // 供页面注册的运行时错误回调（触发自动修复用）
  var errorHandler = null;
  window.__ATOMS_SET_ERROR_HANDLER__ = function (fn) { errorHandler = fn; };

  function toast(message) {
    var box = document.getElementById('host-toast');
    if (!box) return;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(box.__timer);
    box.__timer = setTimeout(function () { box.classList.remove('show'); }, 2000);
  }
  window.__ATOMS_TOAST__ = toast;

  function isTrusted(source) {
    if (!source) return false;
    for (var i = 0; i < allowedSources.length; i++) if (allowedSources[i] === source) return true;
    return false;
  }

  function reply(source, payload) {
    try { source.postMessage(Object.assign({ __atoms: true, appId: getAppId() }, payload), '*'); } catch (e) {}
  }

  window.addEventListener('message', async function (event) {
    var data = event.data;
    var appId = getAppId();
    if (!appId || !data || data.__atoms !== true || data.appId !== appId) return;
    if (!isTrusted(event.source)) return;

    if (data.type === 'hello') { reply(event.source, { type: 'ready' }); return; }
    if (data.type === 'toast') { toast(data.message); return; }
    if (data.type === 'error') {
      console.warn('[atoms-runtime]', data.message);
      if (errorHandler) errorHandler(data.message);
      return;
    }

    if (data.type === 'req') {
      try {
        var res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            appId: appId,
            collection: data.payload && data.payload.collection,
            method: data.method,
            payload: data.payload,
          }),
        });
        var json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || ('HTTP ' + res.status));
        reply(event.source, { type: 'res', id: data.id, result: json.result });
        if (typeof window.__ATOMS_ON_DATA_CHANGE__ === 'function') window.__ATOMS_ON_DATA_CHANGE__();
      } catch (err) {
        reply(event.source, { type: 'res', id: data.id, error: err.message || '数据操作失败' });
      }
    }
  });
})();
