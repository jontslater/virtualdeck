/**
 * Feature gates for optional localhost service polling (updated by UI + Raven setup).
 */
(function (global) {
  global.vdServiceGates = {
    raven: {
      licensed: false,
      configured: false,
      running: false,
      aiPanelVisible: false,
      dashboardVisible: false,
    },
    analytics: { tabVisible: false },
    trivia: { overlayVisible: false, sessionActive: false },
  };

  async function refreshRavenGate() {
    const g = global.vdServiceGates.raven;
    try {
      if (global.electronAPI && global.electronAPI.licenseGetStatus) {
        const lic = await global.electronAPI.licenseGetStatus();
        g.licensed = !!(lic && lic.aiAssistant);
      }
      if (g.licensed && global.electronAPI && global.electronAPI.ravenGetSetupStatus) {
        const setup = await global.electronAPI.ravenGetSetupStatus();
        g.configured = !!(setup && setup.configured);
      } else {
        g.configured = false;
      }
      if (global.electronAPI && global.electronAPI.ravenIsRunning) {
        const run = await global.electronAPI.ravenIsRunning();
        g.running = !!(run && run.running);
      }
    } catch (err) {
      // keep previous values
    }
    const dash = document.getElementById('ai-dashboard-controls');
    const panel = document.getElementById('ai-management-panel');
    const poll = global.vdPoll;
    g.dashboardVisible = poll && poll.isElementActive ? poll.isElementActive(dash) : false;
    g.aiPanelVisible = poll && poll.isElementActive ? poll.isElementActive(panel) : false;
  }

  function shouldPollRavenController() {
    const g = global.vdServiceGates.raven;
    if (g.aiPanelVisible) return true;
    return g.licensed && g.configured && (g.running || g.dashboardVisible);
  }

  function shouldPollRavenBridge() {
    const g = global.vdServiceGates.raven;
    if (g.dashboardVisible || g.aiPanelVisible) return true;
    return g.licensed && g.configured && g.running;
  }

  global.vdServiceGates.refreshRavenGate = refreshRavenGate;
  global.vdServiceGates.shouldPollRavenController = shouldPollRavenController;
  global.vdServiceGates.shouldPollRavenBridge = shouldPollRavenBridge;

  document.addEventListener('DOMContentLoaded', () => {
    refreshRavenGate().catch(() => {});
    setInterval(() => refreshRavenGate().catch(() => {}), 15000);
  });
})(window);
