// FralRater — audience-targeted scoring presets.
// Each audience defines tolerances; the score measures fit, not raw difficulty.

import { baseStats, words, paragraphs } from './metrics.js';
import { findJargon } from './jargon.js';

export const AUDIENCES = [
  {
    id: 'kid8',
    label: '8-year-old kid',
    maxGrade: 5,
    maxJargonPer100: 0.2,
    maxSentLength: 15,
    note: 'Short words, short sentences, zero jargon. Grade 3-5.',
  },
  {
    id: 'teen',
    label: 'Teenager',
    maxGrade: 8,
    maxJargonPer100: 0.5,
    maxSentLength: 20,
    note: 'Conversational, concrete, no corporate speak.',
  },
  {
    id: 'public',
    label: 'General adult',
    maxGrade: 9,
    maxJargonPer100: 1,
    maxSentLength: 24,
    note: 'Plain English, like a good newspaper.',
  },
  {
    id: 'exec',
    label: 'Busy executive',
    maxGrade: 10,
    maxJargonPer100: 1.5,
    maxSentLength: 22,
    note: 'Scan-friendly. Bottom line first, no filler.',
  },
  {
    id: 'patient',
    label: 'Patient (health advice)',
    maxGrade: 6,
    maxJargonPer100: 0.4,
    maxSentLength: 18,
    note: 'Medicine must read like a caring friend explaining, not a textbook.',
  },
  {
    id: 'nonnative',
    label: 'Non-native English speaker',
    maxGrade: 6,
    maxJargonPer100: 0.4,
    maxSentLength: 16,
    note: 'Simple structure, no idioms, no buried verbs.',
  },
  {
    id: 'investor',
    label: 'Investor',
    maxGrade: 12,
    maxJargonPer100: 2,
    maxSentLength: 26,
    note: 'Comfortable with finance terms, wants numbers and confidence.',
  },
  {
    id: 'dev',
    label: 'Developer',
    maxGrade: 16,
    maxJargonPer100: 4,
    maxSentLength: 30,
    note: 'Technical vocabulary is fine; vagueness is not.',
  },
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Score (0-100) of how well a text fits an audience.
export function audienceFit(text, audience) {
  const stats = baseStats(text);
  const sentences = stats.sentences;
  const grade = stats.fkGrade;

  const jargonTotal = stats.jargonCount;
  const jargonPer100 = stats.jargonPer100;

  let score = 100;
  const reasons = [];

  const gradeOver = grade - audience.maxGrade;
  if (gradeOver > 0) {
    const pen = Math.min(40, gradeOver * 7);
    score -= pen;
    reasons.push(`Grade level ${grade.toFixed(1)} exceeds this audience's comfort (~${audience.maxGrade}).`);
  }

  const jargonOver = jargonPer100 - audience.maxJargonPer100;
  if (jargonOver > 0) {
    const pen = Math.min(30, jargonOver * 8);
    score -= pen;
    reasons.push(`${jargonTotal} jargon words found (audience tolerates ~${audience.maxJargonPer100}/100 words).`);
  }

  const longSents = sentences.filter((s) => words(s).length > audience.maxSentLength).length;
  if (longSents > 0) {
    const pen = Math.min(20, longSents * 4);
    score -= pen;
    reasons.push(`${longSents} sentence(s) longer than ${audience.maxSentLength} words.`);
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    grade,
    jargonTotal,
    jargonPer100,
    longSentences: longSents,
    reasons,
  };
}

// Per-paragraph comprehension confidence for an audience (drives the "Lost Reader" list).
export function paragraphConfidence(text, audience) {
  const paras = paragraphs(text);
  return paras.map((p) => {
    const fit = audienceFit(p, audience);
    const w = words(p).length;
    let conf = fit.score;
    if (w > 100) {
      conf -= 10; // wall of text
    }
    return { text: p, confidence: clamp(Math.round(conf), 0, 100), words: w, grade: fit.grade };
  });
}

// Convenience: find all jargon in a text (re-export for the UI).
export function jargonInText(text) {
  return findJargon(text);
}
