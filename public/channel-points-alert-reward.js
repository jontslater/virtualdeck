(function (global) {
  const lib = typeof require === 'function' ? require('../lib/channel-points-alert-reward') : null;
  global.vdChannelPointsAlert = lib || {
    alertMatchesChannelPointsRedemption: () => false,
  };
})(window);
