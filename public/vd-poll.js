/**
 * Adaptive polling for optional localhost services (renderer).
 */
(function (global) {
  function isLocalFetchError(err) {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed') ||
      (err.name === 'TypeError' && msg.includes('fetch'))
    );
  }

  function createAdaptivePoll(options) {
    const base = Math.max(500, options.baseIntervalMs || 5000);
    const max = Math.max(base, options.maxIntervalMs || 60000);
    let failures = 0;
    let timer = null;
    let stopped = true;

    function nextDelay(ok) {
      if (ok) {
        failures = 0;
        return base;
      }
      failures = Math.min(failures + 1, 8);
      return Math.min(max, base * Math.pow(2, failures));
    }

    function schedule(ms) {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, ms);
    }

    async function run() {
      if (stopped) return;
      if (!options.when()) {
        schedule(base);
        return;
      }
      let ok = false;
      try {
        ok = !!(await options.tick());
      } catch (err) {
        ok = false;
      }
      schedule(nextDelay(ok));
    }

    return {
      start() {
        stopped = false;
        schedule(0);
      },
      stop() {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = null;
      },
      poke() {
        failures = 0;
        if (!stopped) schedule(0);
      },
    };
  }

  function isElementActive(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('hidden')) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
    return el.offsetParent !== null || el === document.body;
  }

  global.vdPoll = {
    isLocalFetchError,
    createAdaptivePoll,
    isElementActive,
  };
})(window);
