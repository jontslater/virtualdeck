/**
 * Production console policy: silence log/debug/info/warn in packaged builds unless VD_DEBUG=1.
 */
const { app } = require('electron');

function isVerboseLogging() {
  const v = String(process.env.VD_DEBUG || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function installProductionConsole() {
  if (!app.isPackaged || isVerboseLogging()) return;
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  console.warn = noop;
}

function packagedArgvFlag() {
  return `--vd-packaged=${app.isPackaged ? '1' : '0'}`;
}

module.exports = {
  installProductionConsole,
  isVerboseLogging,
  packagedArgvFlag,
};
