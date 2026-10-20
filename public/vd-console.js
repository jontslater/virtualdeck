/**
 * Renderer console policy (must load before other app scripts).
 * Packaged builds: silence log/debug/info/warn unless localStorage VD_DEBUG=1.
 */
(function () {
  function verbose() {
    try {
      return localStorage.getItem('VD_DEBUG') === '1';
    } catch (e) {
      return false;
    }
  }
  if (window.__VD_IS_PACKAGED__ !== true || verbose()) return;
  const noop = function () {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  console.warn = noop;
})();
