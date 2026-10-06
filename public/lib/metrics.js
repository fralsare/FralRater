// FralRater — core readability metrics engine. Pure functions, no DOM.
import { findJargon } from './jargon.js';

// ---------- basic tokenization ----------

export function splitSentences(text) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [clean];
  return parts.map((s) => s.trim()).filter(Boolean);
}

export function tokens(text) {
  return String(text).match(/[A-Za-z0-9'(’-]+/g) || [];
}

export function words(text) {
  return tokens(text).filter((w) => /^[a-zA-Z]/.test(w));
}

export function paragraphs(text) {
  return String(text)
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ---------- syllables ----------

export function countSyllables(raw) {
  let w = String(raw).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:e|es|ed)$/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

// ---------- stop words (for concept density) ----------

const STOP = new Set(
  ('a about above after again against all also am an and any are as at be because been ' +
    'before being below between both but by can could did do does doing down during each few ' +
    'for from further had has have having he her here hers herself him himself his how i if in ' +
    'into is it its itself just me more most my myself no nor not now of off on once only or ' +
    'other our ours ourselves out over own same she should so some such than that the their ' +
    'theirs them themselves then there these they this those through to too under until up very ' +
    'was we were what when where which while who whom why will with you your yours yourself ' +
    'yourselves s t don don\'t should could would may might must shall let us let\'s don\'t ' +
    'i\'m you\'re he\'s she\'s it\'s that\'s there\'s what\'s hello hi thanks thank please well ok okay'
  ).split(/\s+/)
);

// ---------- passive voice (heuristic) ----------

const BE_FORMS = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being']);

export function findPassive(sentence) {
  const t = tokens(sentence).map((x) => x.toLowerCase().replace(/[^a-z]/g, ''));
  const hits = [];
  for (let i = 0; i < t.length - 1; i++) {
    if (BE_FORMS.has(t[i]) && t[i + 1] && t[i + 1].length > 3 && /(ed|en)$/.test(t[i + 1])) {
      hits.push({ phrase: t[i] + ' ' + t[i + 1], index: i });
    }
  }
  return hits;
}

// ---------- document-level stats ----------

export function baseStats(text) {
  const sentences = splitSentences(text);
  const w = words(text);
  const n = w.length;
  const syl = w.reduce((a, x) => a + countSyllables(x), 0);
  const polysyl = w.filter((x) => countSyllables(x) >= 3).length;
  const avgS = sentences.length ? n / sentences.length : 0;
  const fkGrade = n ? 0.39 * avgS + 11.8 * (syl / n) - 15.59 : 0;
  const readingEase = n ? 206.835 - 1.015 * avgS - 84.6 * (syl / n) : 0;
  const fog = sentences.length && n ? 0.4 * (avgS + 100 * (polysyl / n)) : 0;
  const smog = n ? 1.04 * Math.sqrt(polysyl * (30 / n)) + 3.12 : 0;
  const jargon = findJargon(text);
  const jargonPer100 = n ? (jargon.length / n) * 100 : 0;
  const passiveCount = sentences.reduce((a, s) => a + findPassive(s).length, 0);
  const longSentences = sentences.filter((s) => words(s).length > 25).length;
  return {
    sentences,
    wordCount: n,
    sentenceCount: sentences.length,
    syllables: syl,
    polysyllables: polysyl,
    avgSentenceLength: avgS,
    fkGrade,
    readingEase,
    fog,
    smog,
    jargonCount: jargon.length,
    jargonPer100,
    passiveCount,
    longSentences,
  };
}

// ---------- sentence-level details (drives the difficulty curve) ----------

export function sentenceDetails(text) {
  return splitSentences(text).map((s) => {
    const ws = words(s);
    const n = ws.length;
    const syl = ws.reduce((a, x) => a + countSyllables(x), 0);
    const polysyl = ws.filter((x) => countSyllables(x) >= 3).length;
    const grade = n ? 0.39 * n + 11.8 * (syl / n) - 15.59 : 0;
    const jargonHits = findJargon(s);
    const passive = findPassive(s);
    let score = 0;
    score += Math.max(0, grade) * 2.1;
    score += jargonHits.length * 11;
    score += passive.length * 8;
    if (n > 25) score += (n - 25) * 1.3;
    score += polysyl * 0.4;
    return {
      sentence: s,
      words: n,
      grade,
      jargonHits,
      passive,
      polysyllables: polysyl,
      difficulty: Math.min(100, Math.round(score)),
    };
  });
}

// ---------- paragraph-level details (drives audience confidence) ----------

export function paragraphDetails(text) {
  return paragraphs(text).map((p) => {
    const s = sentenceDetails(p);
    const n = words(p).length;
    const syl = words(p).reduce((a, x) => a + countSyllables(x), 0);
    const grade = n ? 0.39 * (n / (s.length || 1)) + 11.8 * (syl / n) - 15.59 : 0;
    const jargon = s.reduce((a, x) => a + x.jargonHits.length, 0);
    return {
      text: p,
      words: n,
      grade,
      jargon,
      avgDifficulty: s.length ? Math.round(s.reduce((a, x) => a + x.difficulty, 0) / s.length) : 0,
    };
  });
}

// ---------- concept density (new content words per paragraph) ----------

export function conceptDensity(text) {
  const seen = new Set();
  return paragraphs(text).map((p) => {
    const ws = words(p);
    let fresh = 0;
    for (const w of ws) {
      const stem = w.toLowerCase().replace(/(ing|ed|es|s)$/, '');
      if (stem.length > 2 && !STOP.has(stem) && !STOP.has(w.toLowerCase()) && !seen.has(stem)) {
        seen.add(stem);
        fresh++;
      }
    }
    return { words: ws.length, freshWords: fresh, density: ws.length ? fresh / ws.length : 0 };
  });
}

// ---------- sentence rhythm ----------

export function rhythmStats(text) {
  const lens = splitSentences(text).map((s) => words(s).length).filter((n) => n > 0);
  if (lens.length < 2) return { flatness: 0, variance: 0, lengths: lens };
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lens.length;
  const std = Math.sqrt(variance);
  const cv = mean ? std / mean : 0; // coefficient of variation
  return { flatness: Math.round(Math.min(1, cv) * 100), variance, lengths: lens };
}

// ---------- actionability (readability for a purpose) ----------

const IMPERATIVE_VERBS = new Set(
  ('click enter submit save open add remove update install download run check select choose ' +
    'make use start stop call email contact reply sign fill complete send copy paste press type ' +
    'register create delete go look read try ask tell wait confirm verify schedule review ' +
    'book pay ship return schedule visit watch listen')
    .split(/\s+/)
);

export function hasImperative(sentence) {
  const t = tokens(sentence).map((x) => x.toLowerCase());
  if (t.includes('please')) return true;
  for (const w of IMPERATIVE_VERBS) {
    if (t.includes(w)) return true;
  }
  return false;
}

export function buriedLeadCheck(text) {
  const sentences = splitSentences(text);
  const first = sentences.slice(0, 2).join(' ');
  return {
    ctaInFirstTwoSentences: hasImperative(first),
    firstSentenceWords: sentences.length ? words(sentences[0]).length : 0,
    imperativeCount: sentences.filter(hasImperative).length,
    endsWithCallToAction: sentences.length ? hasImperative(sentences[sentences.length - 1]) : false,
  };
}

export function actionabilityScore(text, goal) {
  const c = buriedLeadCheck(text);
  const stats = baseStats(text);
  const checks = [];
  let score = 0;
  const add = (label, pass, weight) => {
    checks.push({ label, pass, weight });
    score += pass ? weight : 0;
  };
  add('A clear action is requested early (first 2 sentences)', c.ctaInFirstTwoSentences, 30);
  add('First sentence is short and scannable (<= 20 words)', c.firstSentenceWords <= 20, 20);
  add('Action language appears at all (imperatives)', c.imperativeCount > 0, 20);
  add('Ends with a next step or call to action', c.endsWithCallToAction, 15);
  add('Overall grade level is moderate (< 12)', stats.fkGrade < 12, 15);
  return { score: Math.round(score), checks, goal };
}

// ---------- accessibility score ----------

export function accessibilityScore(text) {
  const stats = baseStats(text);
  const paras = paragraphDetails(text);
  const capsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length;
  const exclamations = (text.match(/!/g) || []).length;
  const checks = [
    { label: 'Average sentence under 25 words', pass: stats.avgSentenceLength <= 25 },
    { label: 'No paragraph over 120 words', pass: paras.every((p) => p.words <= 120) },
    { label: 'Grade level under 10 (dyslexia-friendly band)', pass: stats.fkGrade < 10 },
    { label: 'Low jargon density (under 2 per 100 words)', pass: stats.jargonPer100 <= 2 },
    { label: 'Few ALL-CAPS words', pass: capsWords <= 2 },
    { label: 'Calm tone (few exclamation marks)', pass: exclamations <= 2 },
  ];
  const passed = checks.filter((c) => c.pass).length;
  return { score: Math.round((passed / checks.length) * 100), checks };
}
