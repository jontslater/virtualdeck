/**
 * Compare semver-like version strings (major.minor.patch).
 * @returns {-1 | 0 | 1}
 */
function compareVersions(a, b) {
  const pa = String(a || '0.0.0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

module.exports = { compareVersions };