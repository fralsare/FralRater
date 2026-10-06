// FralRater — rule-based rewrite engine.
// Transforms text toward a target: split long sentences, swap jargon for plain
// words, cut filler, un-bury the lead, and (heuristically) flip passive to active.

import { replaceJargon } from './jargon.js';
import { splitSentences, words } from './metrics.js';

// Multi-word phrases first (before single-word swaps can break them up).
const PHRASE_SWAPS = [
  ['due to the fact that', 'because'],
  ['in the event that', 'if'],
  ['at this point in time', 'now'],
  ['a substantial number of', 'many'],
  ['for the purpose of', 'for'],
  ['in order to', 'to'],
  ['with regard to', 'about'],
  ['in proximity to', 'near'],
  ['please do not hesitate to', 'feel free to'],
  ['kindly ensure that', 'make sure'],
  ['in accordance with', 'according to'],
  ['it should be noted that', 'note that'],
  ['with respect to', 'about'],
  ['prior to', 'before'],
  ['subsequent to', 'after'],
];

const FILLER_WORDS = new Set(['very', 'really', 'quite', 'actually', 'basically', 'simply', 'truly', 'virtually']);

// Past participle -> {past, present3rd} for the passive->active flip.
const VERB_MAP = {
  written: { past: 'wrote', pres: 'writes' },
  sent: { past: 'sent', pres: 'sends' },
  made: { past: 'made', pres: 'makes' },
  done: { past: 'did', pres: 'does' },
  given: { past: 'gave', pres: 'gives' },
  shown: { past: 'showed', pres: 'shows' },
  seen: { past: 'saw', pres: 'sees' },
  taken: { past: 'took', pres: 'takes' },
  chosen: { past: 'chose', pres: 'chooses' },
  built: { past: 'built', pres: 'builds' },
  created: { past: 'created', pres: 'creates' },
  approved: { past: 'approved', pres: 'approves' },
  reviewed: { past: 'reviewed', pres: 'reviews' },
  required: { past: 'required', pres: 'requires' },
  provided: { past: 'provided', pres: 'provides' },
  determined: { past: 'determined', pres: 'determines' },
  designed: { past: 'designed', pres: 'designs' },
  completed: { past: 'completed', pres: 'completes' },
  updated: { past: 'updated', pres: 'updates' },
  deleted: { past: 'deleted', pres: 'deletes' },
  stored: { past: 'stored', pres: 'stores' },
  loaded: { past: 'loaded', pres: 'loads' },
  improved: { past: 'improved', pres: 'improves' },
  reduced: { past: 'reduced', pres: 'reduces' },
  increased: { past: 'increased', pres: 'increases' },
  tested: { past: 'tested', pres: 'tests' },
  verified: { past: 'verified', pres: 'verifies' },
  monitored: { past: 'monitored', pres: 'monitors' },
  generated: { past: 'generated', pres: 'generates' },
  processed: { past: 'processed', pres: 'processes' },
  collected: { past: 'collected', pres: 'collects' },
  analyzed: { past: 'analyzed', pres: 'analyzes' },
  analysed: { past: 'analysed', pres: 'analyses' },
  measured: { past: 'measured', pres: 'measures' },
  calculated: { past: 'calculated', pres: 'calculates' },
  kept: { past: 'kept', pres: 'keeps' },
  found: { past: 'found', pres: 'finds' },
  paid: { past: 'paid', pres: 'pays' },
  said: { past: 'said', pres: 'says' },
  run: { past: 'ran', pres: 'runs' },
  decided: { past: 'decided', pres: 'decides' },
  changed: { past: 'changed', pres: 'changes' },
  moved: { past: 'moved', pres: 'moves' },
  fixed: { past: 'fixed', pres: 'fixes' },
  called: { past: 'called', pres: 'calls' },
  emailed: { past: 'emailed', pres: 'emails' },
};

const IMPERATIVE_VERBS = new Set(
  ('click enter submit save open add remove update install download run check select choose ' +
    'make use start stop call email contact reply sign fill complete send copy paste press type ' +
    'register create delete go look read try ask tell wait confirm verify book pay ship return visit watch')
    .split(/\s+/)
);

function hasImperative(s) {
  const t = s.toLowerCase().match(/[a-z]+/g) || [];
  return t.some((w) => IMPERATIVE_VERBS.has(w));
}

// "X was written by Y" -> "Y wrote X". Only when the subject is short enough
// to be sensible and the verb is in our map.
function flipPassive(s) {
  const m = s.match(/^(.*?)(is|are|was|were)\s+([a-z]+)\s+by\s+([^.!?]+?)([.!?])?$/i); // 'by <agent>' is required to invert safely
  if (!m) return null;
  const v = VERB_MAP[m[3].toLowerCase()];
  if (!v) return null; // verb not in the safe list -> leave the sentence alone
  const subject = m[1].trim();
  const actorRaw = m[4] ? m[4].trim() : null;
  if (!actorRaw) return null; // no agent -> cannot invert safely
  // Only invert short, clean noun phrases — anything with a comma or a long
  // clause is too risky for a rule-based pass, so leave it for a human.
  if (subject.includes(',') || subject.split(/\s+/).length > 6) return null;
  if (actorRaw.includes(',') || actorRaw.split(/\s+/).length > 8) return null;
  // Keep the agent as a short noun phrase; preserve any trailing clause after it.
  const cut = actorRaw.search(/\s+(?:to|and|or|that|while|because|when|last|next|each|every|then|now|today|yesterday)\b/i);
  const actor = cut === -1 ? actorRaw : actorRaw.slice(0, cut);
  const rest = cut === -1 ? '' : actorRaw.slice(cut).trim();
  const verb = m[2].toLowerCase() === 'is' || m[2].toLowerCase() === 'are' ? v.pres : v.past;
  const obj = subject ? subject.toLowerCase() : 'it';
  const punct = m[5] || (s.endsWith('.') ? '.' : '');
  return `${actor[0].toUpperCase()}${actor.slice(1)} ${verb} ${obj}${rest ? ` ${rest}` : ''}${punct}`;
}

function splitLongSentence(s) {
  // Try ';' first, then ', and/or/but/which/so'
  let cut = s.search(/;\s/);
  let sep = ';';
  if (cut === -1) {
    const m = s.match(/, (and|but|or|which|so|that|while)\b/i);
    if (m && m.index > 10) {
      cut = m.index;
      sep = ',';
    }
  }
  if (cut === -1) return [s];
  const head = s.slice(0, cut).trim();
  let tail = s.slice(cut + (sep === ';' ? 1 : 1)).trim();
  if (sep === ',') tail = tail[0].toUpperCase() + tail.slice(1);
  if (!tail) return [s];
  return [head + '.', tail];
}

export function rewriteSentence(s) {
  const changes = [];
  let out = s.trim();

  // 1. multi-word phrases
  for (const [from, to] of PHRASE_SWAPS) {
    const re = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const had = re.test(out);
    out = out.replace(re, to);
    if (had) changes.push(`"${from}" -> "${to}"`);
  }

  // 2. jargon -> plain
  const j = replaceJargon(out);
  if (j.changes > 0) {
    out = j.text;
    changes.push(`replaced ${j.changes} jargon word(s) with plain language`);
  }

  // 3. filler words
  let fillerHits = 0;
  out = out.replace(/\b(very|really|quite|actually|basically|simply|truly|virtually)\s+/gi, () => {
    fillerHits++;
    return '';
  });
  if (fillerHits > 0) changes.push(`cut ${fillerHits} filler word(s)`);
  void FILLER_WORDS;

  // 4. un-bury the lead: "When X, do Y." -> "Do Y when X."
  const buried = out.match(/^(After|When|Once|If|Before)\s+([^,]+),\s*(.+)$/i);
  if (buried && hasImperative(buried[3])) {
    const lead = buried[3].trim().replace(/[.!?]+$/, '');
    const when = buried[1].toLowerCase() + ' ' + buried[2].trim().replace(/[.!?]+$/, '');
    out = `${lead[0].toUpperCase()}${lead.slice(1)} ${when}${out.endsWith('.') ? '.' : ''}`;
    changes.push('moved the action to the front');
  }

  // 5. passive -> active (only once per sentence, only if agent is present)
  const flipped = flipPassive(out);
  if (flipped && flipped !== out) {
    out = flipped;
    changes.push('flipped passive voice to active');
  }

  // 6. split long sentences (loop, max 2 splits)
  let guard = 0;
  while (words(out).length > 26 && guard < 2) {
    const parts = splitLongSentence(out);
    if (parts.length < 2) break;
    out = parts.join(' ');
    changes.push(`split a ${words(parts[0]).length + words(parts[1]).length}-word sentence into two`);
    guard++;
  }

  // swaps can lowercase the first word; restore sentence capitalization
  out = out.charAt(0).toUpperCase() + out.slice(1);

  return { original: s, rewritten: out, changes };
}

export function rewriteText(text) {
  const paras = String(text).split('\n').filter((p) => p.trim());
  const paraOuts = paras.map((p) => {
    const results = splitSentences(p).map(rewriteSentence);
    return { original: p, rewritten: results.map((r) => r.rewritten).join(' '), results };
  });
  const totalChanges = paraOuts.reduce((a, p) => a + p.results.reduce((b, r) => b + (r.changes.length > 0 ? 1 : 0), 0), 0);
  return { text: paraOuts.map((p) => p.rewritten).join('\n\n'), paragraphs: paraOuts, sentencesChanged: totalChanges };
}

// ---------- word-level diff for highlighting ----------

export function wordDiff(aText, bText) {
  const a = aText.split(/\s+/);
  const b = bText.split(/\s+/);
  const n = a.length;
  const m = b.length;
  // LCS table
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].toLowerCase() === b[j].toLowerCase() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].toLowerCase() === b[j].toLowerCase()) {
      ops.push({ type: 'same', word: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', word: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', word: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'del', word: a[i++] });
  while (j < m) ops.push({ type: 'add', word: b[j++] });
  return ops;
}
