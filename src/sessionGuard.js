window.PVI_SESSION_GUARD = (() => {
  let active = false;
  let handler = null;
  let warned = false;
  function start(onViolation) {
    stop();
    active = true;
    handler = async (type, detail) => {
      if (!active) return;
      if (!warned) { warned = true; setTimeout(() => warned = false, 1500); }
      await onViolation(type, detail);
    };
    document.addEventListener('visibilitychange', visibilityListener);
    window.addEventListener('blur', blurListener);
    document.addEventListener('fullscreenchange', fullscreenListener);
    window.addEventListener('beforeunload', beforeUnloadListener);
  }
  function stop() {
    active = false;
    document.removeEventListener('visibilitychange', visibilityListener);
    window.removeEventListener('blur', blurListener);
    document.removeEventListener('fullscreenchange', fullscreenListener);
    window.removeEventListener('beforeunload', beforeUnloadListener);
  }
  function visibilityListener() { if (document.hidden && handler) handler('visibility_hidden', 'El estudiante cambió de pestaña o minimizó.'); }
  function blurListener() { if (handler) handler('window_blur', 'La ventana perdió el foco.'); }
  function fullscreenListener() { if (!document.fullscreenElement && handler) handler('fullscreen_exit', 'Salió de pantalla completa.'); }
  function beforeUnloadListener(e) { if (!active) return; e.preventDefault(); e.returnValue = ''; if (handler) handler('before_unload', 'Intentó cerrar o recargar.'); }
  async function requestFullscreen() { try { await document.documentElement.requestFullscreen(); } catch (_) {} }
  return { start, stop, requestFullscreen };
})();
