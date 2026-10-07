// FralRater — UI wiring.
// DOM is built with createElement/textContent (no innerHTML for user text).
import {
  baseStats,
  sentenceDetails,
  rhythmStats,
  conceptDensity,
  actionabilityScore,
  accessibilityScore,
  buriedLeadCheck,
} from './lib/metrics.js';
import { AUDIENCES, audienceFit, paragraphConfidence } from './lib/audiences.js';
import { rewriteText, wordDiff } from './lib/rewriter.js';
import { difficultyCurveSVG, radarSVG, rhythmHeatHTML, zoneColor } from './lib/charts.js';

const $ = (id) => document.getElementById(id);

// ---------- safe DOM builder ----------

function el(tag, cls, text, children) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  if (children) for (const c of children) if (c) node.appendChild(c);
  return node;
}

function append(parent, ...nodes) {
  for (const n of nodes) if (n) parent.appendChild(n);
  return parent;
}

// Chart markup is generated from numeric values only (lib/charts.js embeds no user
// text), so parsing it with DOMParser and moving nodes is safe.
// NOTE: SVG is parsed as 'text/html', NOT 'image/svg+xml' — in Chromium, the latter
// yields an <svg> root with a null namespace (no namespace prefix / no xmlns on a
// bare <svg> fragment), so the browser would treat it as an unknown HTML element
// and render no graphics. The HTML parser's foreign-content handling assigns the
// proper SVG namespace, so the chart renders correctly.
function mountGenerated(host, markup, isSvg) {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  if (isSvg) {
    const svgEl = doc.body.querySelector('svg');
    if (svgEl) host.replaceChildren(svgEl);
  } else {
    host.replaceChildren(...doc.body.childNodes);
  }
}

function h2(text) {
  return el('h2', null, text);
}

function card(nodes) {
  return el('div', 'chart-card', null, nodes);
}

function metricCard(value, label, sub, color) {
  const v = el('div', 'value', value);
  if (color) v.style.color = color;
  const kids = [v, el('div', 'label', label)];
  if (sub) kids.push(el('div', 'sub', sub));
  return el('div', 'metric-card', null, kids);
}

function checklistUL(checks) {
  return el(
    'ul',
    'checklist',
    null,
    checks.map((c) => {
      const mark = el('span', 'mark', c.pass ? '✓' : '✗');
      mark.style.color = c.pass ? 'var(--good)' : 'var(--bad)';
      return append(el('li', null, null, [mark, document.createTextNode(c.label)]));
    })
  );
}

function chips(items) {
  const wrap = el('div');
  for (const it of items) {
    wrap.appendChild(el('span', 'chip', null, [document.createTextNode(`${it.term} → `), el('b', null, it.plain)]));
  }
  return wrap;
}

function scoreRing(score, label) {
  const big = el('span', 'big-score', String(score));
  big.style.color = scoreColor(score);
  return el('div', 'score-ring', null, [big, el('span', 'score-label', label)]);
}

function mutedLine(text) {
  return el('p', 'muted', text);
}

// ---------- tabs ----------

for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => {
    for (const b of document.querySelectorAll('.tab')) b.classList.remove('active');
    for (const p of document.querySelectorAll('.tabpane')) p.classList.remove('active');
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
  });
}

// ---------- shared helpers ----------

function gradeColor(g) {
  if (g < 8) return 'var(--good)';
  if (g < 12) return 'var(--warn)';
  return 'var(--bad)';
}

function scoreColor(s) {
  return zoneColor(100 - s);
}

function easeLabel(e) {
  if (e >= 80) return 'Very easy';
  if (e >= 60) return 'Easy';
  if (e >= 40) return 'Fairly hard';
  if (e >= 20) return 'Hard';
  return 'Very hard';
}

function sentenceSuggestions(d) {
  const out = [];
  if (d.words > 25) out.push(`Split it — ${d.words} words is a wall (aim for under 25).`);
  for (const h of d.jargonHits) out.push(`Swap "${h.term}" → "${h.plain}".`);
  if (d.passive.length) out.push(`Passive voice: "${d.passive[0].phrase}…" — name who did the doing.`);
  if (d.polysyllables >= 4) out.push(`${d.polysyllables} polysyllabic words — shorter words read faster.`);
  if (!out.length && d.difficulty < 35) out.push('Reads well for most people.');
  return out;
}

// ---------- ANALYZE ----------

$('analyzeBtn').addEventListener('click', () => {
  const text = $('text').value.trim();
  const out = $('analyze-results');
  out.textContent = '';
  if (!text) {
    out.appendChild(mutedLine('Add some text first.'));
    return;
  }
  const stats = baseStats(text);
  const details = sentenceDetails(text);
  const rhythm = rhythmStats(text);
  const density = conceptDensity(text);
  const action = actionabilityScore(text, 'get the reader to act');
  const access = accessibilityScore(text);
  const lead = buriedLeadCheck(text);
  const densityMax = density.length ? Math.max(...density.map((d) => d.density)) : 0;

  const cards = el('div', 'cards', null, [
    metricCard(stats.fkGrade.toFixed(1), 'Grade level', 'Flesch-Kincaid', gradeColor(stats.fkGrade)),
    metricCard(Math.max(0, Math.round(stats.readingEase)), 'Reading ease', easeLabel(stats.readingEase), scoreColor(Math.round(stats.readingEase))),
    metricCard(stats.fog.toFixed(1), 'Fog index', 'Gunning', gradeColor(stats.fog)),
    metricCard(stats.smog.toFixed(1), 'SMOG', 'college-level words', gradeColor(stats.smog)),
    metricCard(stats.jargonCount, 'Jargon words', `${stats.jargonPer100.toFixed(1)} per 100 words`, stats.jargonCount ? 'var(--warn)' : 'var(--good)'),
    metricCard(stats.passiveCount, 'Passive voice', 'heuristically detected', stats.passiveCount > 3 ? 'var(--warn)' : 'var(--good)'),
  ]);
  out.appendChild(h2('Overall score'));
  out.appendChild(cards);

  // Lost-Reader map (chart SVG is generated from numbers only — safe to inject as markup)
  const curveHost = el('div');
  mountGenerated(curveHost, difficultyCurveSVG(details), true);
  const curveCap = mutedLine('Each dot is one sentence. The wall your reader will hit is the spike — green = smooth, red = a wall.');
  curveCap.style.marginBottom = '0';
  out.appendChild(h2('Lost-Reader map'));
  out.appendChild(card([curveHost, curveCap]));

  // sentence flags table
  out.appendChild(h2('Sentence-by-sentence fixes'));
  const flagged = details
    .map((d, i) => ({ ...d, n: i + 1 }))
    .filter((d) => d.difficulty >= 30)
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, 12);
  if (flagged.length) {
    const table = el('table', 'flags');
    table.appendChild(
      append(
        el('tr', null, null, [el('th', null, '#'), el('th', null, 'Sentence'), el('th', null, 'Difficulty'), el('th', null, 'Problems & suggestions')])
      )
    );
    for (const d of flagged) {
      const diff = el('td', d.difficulty >= 65 ? 'flag-bad' : 'flag-warn', `${d.difficulty}/100`);
      const sugg = el('td', 'suggestion', null, sentenceSuggestions(d).map((s) => el('div', null, `• ${s}`)));
      table.appendChild(append(el('tr', null, null, [el('td', null, String(d.n)), el('td', null, d.sentence), diff, sugg])));
    }
    out.appendChild(table);
  } else {
    out.appendChild(el('p', 'flag-good', 'No hard sentences detected. Nice and readable!'));
  }

  // jargon
  out.appendChild(h2('Jargon found'));
  const allJargon = details.flatMap((d) => d.jargonHits);
  if (allJargon.length) out.appendChild(chips(allJargon));
  else out.appendChild(mutedLine('None detected.'));

  // rhythm
  const rhythmHost = el('div');
  mountGenerated(rhythmHost, rhythmHeatHTML(details), false);
  const rhythmCap = mutedLine(
    `Rhythm variety: ${rhythm.flatness}% — ` +
      (rhythm.flatness < 35 ? 'monotonous (similar sentence lengths tire readers)' : rhythm.flatness < 65 ? 'decent variation' : 'good, lively variation')
  );
  rhythmCap.style.marginBottom = '0';
  out.appendChild(h2('Rhythm & cadence'));
  out.appendChild(card([rhythmHost, rhythmCap]));

  // concept density
  out.appendChild(h2('Concept density'));
  if (density.length) {
    const dCards = el(
      'div',
      'cards',
      null,
      density.slice(0, 6).map((d, i) =>
        metricCard(
          `${Math.round(d.density * 100)}%`,
          `Paragraph ${i + 1}`,
          `${d.freshWords} new concepts / ${d.words} words`,
          d.density > densityMax * 0.99 && d.density > 0.35 ? 'var(--warn)' : 'var(--good)'
        )
      )
    );
    out.appendChild(dCards);
  } else {
    out.appendChild(mutedLine('Single paragraph.'));
  }

  // actionability
  out.appendChild(h2('Actionability (will the reader actually act?)'));
  out.appendChild(card([scoreRing(action.score, '/ 100 — is the next step clear and early?'), checklistUL(action.checks)]));

  // accessibility
  const accessNote = mutedLine(
    `Lead check: ${lead.ctaInFirstTwoSentences ? '✓ action requested early' : '✗ no action in first two sentences'} · first sentence ${lead.firstSentenceWords} words`
  );
  accessNote.style.marginBottom = '0';
  out.appendChild(h2('Accessibility (dyslexia-friendly band)'));
  out.appendChild(card([scoreRing(access.score, '/ 100'), checklistUL(access.checks), accessNote]));
});

// ---------- AUDIENCE ----------

const audSelect = $('audienceSelect');
for (const a of AUDIENCES) {
  const opt = document.createElement('option');
  opt.value = a.id;
  opt.textContent = a.label;
  audSelect.appendChild(opt);
}
audSelect.value = 'public';

$('audAnalyzeBtn').addEventListener('click', () => {
  const text = $('audText').value.trim();
  const out = $('audience-results');
  out.textContent = '';
  if (!text) {
    out.appendChild(mutedLine('Add some text first.'));
    return;
  }
  const aud = AUDIENCES.find((a) => a.id === audSelect.value);
  const fit = audienceFit(text, aud);
  const conf = paragraphConfidence(text, aud);
  const lost = conf.filter((c) => c.confidence < 70);

  const fitBody = el('div', null, null, [
    scoreRing(fit.score, 'comprehension confidence for this audience'),
    el('div', 'muted', aud.note),
  ]);
  fitBody.style.fontSize = '13px';
  if (fit.reasons.length) {
    fitBody.appendChild(el('ul', 'lost-list', null, fit.reasons.map((r) => el('li', null, `⚠ ${r}`))));
  } else {
    fitBody.appendChild(el('p', 'flag-good', '✓ This text fits this audience well.'));
  }
  out.appendChild(h2(`Fits "${aud.label}"?`));
  out.appendChild(card([fitBody]));

  out.appendChild(h2('Paragraph-by-paragraph confidence'));
  const rows = conf.map((c, i) => {
    const bar = el('div', 'conf-bar');
    bar.style.width = `${c.confidence}%`;
    bar.style.background = scoreColor(c.confidence);
    return el('div', 'conf-row', null, [
      el('span', 'conf-label', `Para ${i + 1} · ${c.words}w · gr ${c.grade.toFixed(0)}`),
      el('div', 'conf-bar-outer', null, [bar]),
    ]);
  });
  out.appendChild(card(rows));

  if (lost.length) {
    const list = el('ul', 'lost-list', null, lost.map((c) => {
      const idx = conf.indexOf(c) + 1;
      const snippet = c.text.length > 140 ? `${c.text.slice(0, 140)}…` : c.text;
      return el('li', null, `Paragraph ${idx}: "${snippet}" — confidence ${c.confidence}%`);
    }));
    out.appendChild(h2('Where this reader gets lost'));
    out.appendChild(list);
  }
});

// ---------- REWRITE ----------

function diffNodes(original, rewritten) {
  const ops = wordDiff(original, rewritten);
  const wrap = el('span');
  for (const op of ops) {
    if (op.type === 'same') wrap.appendChild(document.createTextNode(`${op.word} `));
    else if (op.type === 'del') wrap.appendChild(el('del', null, `${op.word} `));
    else wrap.appendChild(el('ins', null, `${op.word} `));
  }
  return wrap;
}

$('rwBtn').addEventListener('click', () => {
  const text = $('rwText').value.trim();
  const out = $('rewrite-results');
  out.textContent = '';
  if (!text) {
    out.appendChild(mutedLine('Add some text first.'));
    return;
  }
  const before = baseStats(text);
  const result = rewriteText(text);
  const after = baseStats(result.text);
  $('copyRwBtn').classList.remove('hidden');
  $('copyRwBtn').onclick = () => navigator.clipboard.writeText(result.text);

  out.appendChild(h2('Before → After'));
  out.appendChild(
    el('div', 'cards', null, [
      metricCard(before.fkGrade.toFixed(1), 'Grade before', '', gradeColor(before.fkGrade)),
      metricCard(after.fkGrade.toFixed(1), 'Grade after', 'Flesch-Kincaid', gradeColor(after.fkGrade)),
      metricCard(before.jargonCount, 'Jargon before', '', 'var(--warn)'),
      metricCard(after.jargonCount, 'Jargon after', '', after.jargonCount ? 'var(--warn)' : 'var(--good)'),
    ])
  );

  out.appendChild(h2('Sentence diff'));
  const changed = result.paragraphs.flatMap((p) => p.results).filter((r) => r.changes.length);
  if (changed.length) {
    for (const r of changed) {
      out.appendChild(
        el('div', 'diff-sent', null, [
          el('div', 'diff-old', null, [diffNodes(r.original, r.rewritten)]),
          el('div', 'changes', null, r.changes.map((c) => el('span', 'chip', c))),
        ])
      );
    }
  } else {
    out.appendChild(el('p', 'flag-good', 'No changes needed — this text is already plain.'));
  }

  out.appendChild(h2('Full rewritten text'));
  out.appendChild(card([el('pre', null, result.text)]));
  out.appendChild(mutedLine('Rule-based and offline — review every change before publishing.'));
});

// ---------- COMPARE ----------

function cmpMetrics(stats) {
  return [
    { label: 'Grade', value: stats.fkGrade, max: 16 },
    { label: 'Jargon/100w', value: stats.jargonPer100, max: 5 },
    { label: 'Long sent. %', value: (stats.longSentences / Math.max(1, stats.sentenceCount)) * 100, max: 100 },
    { label: 'Passive %', value: (stats.passiveCount / Math.max(1, stats.wordCount)) * 100, max: 10 },
    { label: 'Hard words %', value: (stats.polysyllables / Math.max(1, stats.wordCount)) * 100, max: 40 },
    { label: 'Avg sent len', value: stats.avgSentenceLength, max: 32 },
  ];
}

$('cmpBtn').addEventListener('click', () => {
  const a = $('cmpA').value.trim();
  const b = $('cmpB').value.trim();
  const out = $('compare-results');
  out.textContent = '';
  if (!a || !b) {
    out.appendChild(mutedLine('Fill in both versions.'));
    return;
  }
  const sA = baseStats(a);
  const sB = baseStats(b);
  const mA = cmpMetrics(sA);
  const mB = cmpMetrics(sB);

  const radarHost = el('div');
  mountGenerated(
    radarHost,
    radarSVG(
      mA.map((m) => m.label),
      [
        { name: 'A', color: '#818cf8', values: mA.map((m) => Math.min(1, m.value / m.max)) },
        { name: 'B', color: '#34d399', values: mB.map((m) => Math.min(1, m.value / m.max)) },
      ]
    ),
    true
  );
  out.appendChild(h2('Radar (smaller area = easier read)'));
  out.appendChild(card([radarHost]));

  out.appendChild(h2('Head to head'));
  const table = el('table', 'cmp-table');
  table.appendChild(append(el('tr', null, null, [el('th', null, 'Metric'), el('th', null, 'A'), el('th', null, 'B'), el('th', null, 'Simple wins')])));
  const easeA = Math.max(0, Math.round(sA.readingEase));
  const easeB = Math.max(0, Math.round(sB.readingEase));
  const allRows = [
    ...mA.map((m, i) => ({ label: m.label, a: m.value.toFixed(1), b: mB[i].value.toFixed(1), simple: mB[i].value < m.value ? 'B' : m.value < mB[i].value ? 'A' : '—' })),
    { label: 'Reading ease', a: String(easeA), b: String(easeB), simple: easeB < easeA ? 'A' : easeA < easeB ? 'B' : '—', invert: true },
  ];
  for (const r of allRows) {
    const aTd = el('td', r.simple === 'A' ? 'winner' : null, r.a);
    const bTd = el('td', r.simple === 'B' ? 'winner' : null, r.b);
    table.appendChild(append(el('tr', null, null, [el('td', null, r.label), aTd, bTd, el('td', null, r.simple)])));
  }
  const note = mutedLine('"Simple wins" = the version that is easier to read for that metric (higher is better for Reading ease).');
  note.style.marginBottom = '0';
  out.appendChild(card([table, note]));
});

// ---------- VOICE NOTE (speech-to-text) ----------

let recognition = null;
let listening = false;

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

$('micBtn').addEventListener('click', () => {
  const status = $('micStatus');
  const ta = $('text');
  if (!SR) {
    status.textContent = 'Speech recognition needs Chrome or Chromium (or Chromium-based Edge).'
    return;
  }
  if (listening) {
    if (recognition) recognition.stop();
    return;
  }
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  let finalChunk = '';

  recognition.onstart = () => {
    listening = true;
    status.textContent = '● Listening… (press the mic again to stop)';
    status.classList.add('listening');
  };
  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalChunk += `${t} `;
      else interim += t;
    }
    const base = ta.value.trim();
    ta.value = base ? `${base} ${finalChunk}${interim}` : `${finalChunk}${interim}`;
  };
  recognition.onerror = (e) => {
    status.textContent = `Mic error: ${e.error}`;
  };
  recognition.onend = () => {
    listening = false;
    status.classList.remove('listening');
    if (finalChunk.trim()) {
      const base = ta.value.replace(new RegExp(`${finalChunk.trim()}\\s*$`), '').trim();
      ta.value = base ? `${base} ${finalChunk.trim()}` : finalChunk.trim();
      status.textContent = 'Voice note saved to your text.';
    } else if (status.textContent.includes('Listening')) {
      status.textContent = 'Nothing captured.';
    }
  };
  recognition.start();
});

// ---------- sample & misc ----------

const SAMPLE =
  'Due to the fact that our stakeholders have requested a deep dive into the methodology, the quarterly report was completed by the analytics team in order to ascertain the ROI of the new orchestration platform. Furthermore, it should be noted that the latency of the microservices ecosystem was measured, and a substantial number of actionable insights were determined in the event that the throughput of the serialization pipeline could be optimized. Please do not hesitate to circle back with the thought leadership team to facilitate a holistic alignment regarding the go-to-market strategy, notwithstanding the fact that the deliverables were already approved by the best-in-class review process, and in accordance with the KPIs that were established prior to the launch of the scalable, robust, and idempotent infrastructure. When you have finished reading this report, submit your feedback. Kindly ensure that the value proposition is communicated with the competitive advantage that our pain point analysis revealed, and leverage the low-hanging fruit identified in the north star framework to move the needle on our disruption of the market paradigm.';

$('sampleBtn').addEventListener('click', () => {
$('text').value = SAMPLE;
$('audText').value = SAMPLE;
$('rwText').value = SAMPLE;
});

$('clearBtn').addEventListener('click', () => {
  for (const id of ['text', 'audText', 'rwText', 'cmpA', 'cmpB']) $(id).value = '';
  for (const id of ['analyze-results', 'audience-results', 'rewrite-results', 'compare-results']) $(id).textContent = '';
});
