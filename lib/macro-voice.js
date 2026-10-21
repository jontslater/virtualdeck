/**
 * Deterministic voice -> saved-macro matching.
 *
 * Raven sends the host's (wake-word-stripped) utterance; we match it against each enabled
 * macro's trigger phrase (and an explicit "run the <name> macro" form) BEFORE any LLM is involved,
 * so a voice trigger always runs the saved macro exactly like its hotkey does.
 */

const NEGATIONS = new Set(['dont', 'not', 'do not', 'never', 'cancel', 'stop', 'without', 'no']);
const RUN_VERBS = new Set(['run', 'start', 'do', 'execute', 'trigger', 'fire', 'launch', 'play']);

function normalizeUtterance(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\b(\w+)'re\b/g, '$1 are')
    .replace(/\blet's\b/g, 'let us')
    .replace(/\b(\w+)'m\b/g, '$1 am')
    .replace(/\b(\w+)'ll\b/g, '$1 will')
    .replace(/\bcan't\b/g, 'can not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\b(\w+)n't\b/g, '$1 not')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function words(text) {
  const n = normalizeUtterance(text);
  return n ? n.split(' ') : [];
}

const FILLERS = new Set(['the', 'a', 'an', 'my', 'our', 'this', 'that', 'up', 'please', 'now', 'uh', 'um', 'to']);

const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
};

/** Digits, number words, and the "two" homophones Whisper often writes ("to", "too"). */
function numberKey(w) {
  if (NUMBER_WORDS[w]) return NUMBER_WORDS[w];
  if (w === 'too' || w === 'to') return '2';
  if (/^\d+$/.test(w)) return String(parseInt(w, 10));
  return '';
}

/** switch/switched/switching — only the -ed/-ing tail, so "live" does not match "lived". */
function stemVerb(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  return w;
}

function sameWord(a, b) {
  if (a === b) return true;
  const na = numberKey(a);
  const nb = numberKey(b);
  if (na && nb && na === nb) return true;
  const sa = stemVerb(a);
  const sb = stemVerb(b);
  return sa === b || sb === a || sa === sb;
}

/**
 * Index where `needle` starts in `hay` as whole words, allowing filler words ("the", "my", "to", ...)
 * between needle words (so "switch to scene two" matches "switch scene two"), or -1.
 * Words also match across Whisper variants: "switched"/"switch", "two"/"to"/"2", "one"/"1".
 */
function findWordSeq(hay, needle) {
  if (!needle.length) return -1;
  for (let i = 0; i < hay.length; i++) {
    if (!sameWord(hay[i], needle[0])) continue;
    let h = i + 1;
    let j = 1;
    while (j < needle.length && h < hay.length) {
      if (sameWord(hay[h], needle[j])) { j++; h++; } else if (FILLERS.has(hay[h]) && !sameWord(hay[h], needle[j])) { h++; } else break;
    }
    if (j === needle.length) return i;
  }
  return -1;
}

function negatedBefore(hay, idx) {
  for (let k = Math.max(0, idx - 2); k < idx; k++) {
    if (NEGATIONS.has(hay[k])) return true;
  }
  return false;
}

/**
 * @param {Array<{id:string,name?:string,enabled?:boolean,triggers?:{phrase?:string|null}}>} macros
 * @param {string} utterance
 * @param {{wakeNames?: string[]}} [opts] wake names stripped from the start of phrase and utterance
 * @returns {{ matched: boolean, macro?: object, matchedOn?: 'phrase'|'name', phrase?: string, ambiguous?: string[], reason?: string }}
 */
function stripLeadingWake(ws, wakeSet) {
  let i = 0;
  while (i < ws.length && (wakeSet.has(ws[i]) || (i > 0 && (ws[i] === 'hey' || ws[i] === 'ok')))) i++;
  if (i === 0 && ws.length > 1 && (ws[0] === 'hey' || ws[0] === 'ok') && wakeSet.has(ws[1])) i = 2;
  return i > 0 && i < ws.length ? ws.slice(i) : ws;
}

function matchMacroByUtterance(macros, utterance, opts = {}) {
  const wakeSet = new Set((opts.wakeNames || []).map((w) => normalizeUtterance(w)).filter(Boolean));
  const hay = stripLeadingWake(words(utterance), wakeSet);
  if (!hay.length) return { matched: false, reason: 'empty utterance' };
  const hits = [];
  for (const m of macros || []) {
    if (!m || m.enabled === false) continue;
    const phrase = m.triggers && m.triggers.phrase;
    const pw = stripLeadingWake(words(phrase), wakeSet);
    if (pw.length) {
      const idx = findWordSeq(hay, pw);
      if (idx >= 0 && !negatedBefore(hay, idx)) {
        hits.push({ macro: m, matchedOn: 'phrase', phrase, score: 100 + pw.length });
        continue;
      }
    }
    // Explicit name form: "<verb> ... <name> macro" or "<name> macro"
    const nw = words(m.name);
    if (nw.length) {
      const idx = findWordSeq(hay, nw);
      if (idx >= 0 && !negatedBefore(hay, idx)) {
        const after = hay[idx + nw.length];
        const verbBefore = hay.slice(Math.max(0, idx - 3), idx).some((w) => RUN_VERBS.has(w));
        if (after === 'macro' || (verbBefore && idx + nw.length === hay.length)) {
          hits.push({ macro: m, matchedOn: 'name', phrase: m.name, score: nw.length });
        }
      }
    }
  }
  if (!hits.length) return { matched: false, reason: 'no macro trigger phrase in utterance' };
  hits.sort((a, b) => b.score - a.score);
  const best = hits[0];
  const tied = hits.filter((h) => h.score === best.score && h.macro.id !== best.macro.id);
  if (tied.length) {
    return {
      matched: false,
      reason: 'ambiguous',
      ambiguous: [best, ...tied].map((h) => h.macro.name || h.macro.id),
    };
  }
  return { matched: true, macro: best.macro, matchedOn: best.matchedOn, phrase: best.phrase };
}

/** One sentence Raven can speak about a macro run result. */
function summarizeMacroRun(result) {
  const name = (result && result.macro) || 'The macro';
  const steps = Array.isArray(result && result.steps) ? result.steps : [];
  const total = typeof result.totalSteps === 'number' ? result.totalSteps : steps.length;
  if (result && result.success) {
    return `${name} finished: ${steps.length} of ${total} step${total === 1 ? '' : 's'} OK.`;
  }
  const failed = steps.find((s) => !s.success);
  if (failed) {
    const skipped = Math.max(0, total - steps.length);
    return `${name} failed at step ${failed.step} (${failed.description || failed.tool}): ${failed.error || 'step failed'}.`
      + (skipped ? ` ${skipped} later step${skipped === 1 ? ' was' : 's were'} skipped.` : '');
  }
  return `${name} failed: ${(result && result.error) || 'unknown error'}.`;
}

module.exports = { normalizeUtterance, matchMacroByUtterance, summarizeMacroRun };
