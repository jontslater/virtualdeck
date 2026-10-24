(function (global) {
  const lib = typeof require === 'function' ? require('../lib/alert-placeholders') : null;

  const api = lib || {
    replacePlaceholders: (text, userData) => text,
    buildUserDataFromTwitchEvent: () => ({}),
    buildChannelPointsUserData: () => ({}),
    resolveAlertSpeakText: () => '',
    isRavenTtsEnabled: () => false,
    PLACEHOLDER_NAMES: [],
  };

  global.vdAlertPlaceholders = api;
})(window);
