// FralRater — tiny SVG chart helpers, no dependencies.

const COLORS = {
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
  line: '#818cf8',
  grid: '#334155',
  text: '#94a3b8',
};

function zoneColor(score) {
  if (score < 35) return COLORS.good;
  if (score < 65) return COLORS.warn;
  return COLORS.bad;
}

// ---------- Lost-Reader difficulty curve ----------
// items: [{sentence, difficulty}]
export function difficultyCurveSVG(items) {
  const W = 860;
  const H = 230;
  const P = 34;
  if (!items.length) return '';
  const innerW = W - 2 * P;
  const innerH = H - 2 * P;
  const step = items.length > 1 ? innerW / (items.length - 1) : innerW;
  const pts = items.map((it, idx) => {
    const x = P + (items.length > 1 ? idx * step : innerW / 2);
    const y = P + innerH - (it.difficulty / 100) * innerH;
    return { x, y, d: it.difficulty, idx };
  });
  const linePath = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H - P} L ${pts[0].x} ${H - P} Z`;

  const yTicks = [0, 25, 50, 75, 100]
    .map((v) => {
      const y = P + innerH - (v / 100) * innerH;
      return `<line x1="${P}" y1="${y}" x2="${W - P}" y2="${y}" stroke="${COLORS.grid}" stroke-width="1" stroke-dasharray="3 4"/>
      <text x="${P - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="${COLORS.text}">${v}</text>`;
    })
    .join('');

  const dots = pts
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${zoneColor(p.d)}">
          <title>Sentence ${p.idx + 1}: difficulty ${p.d}</title>
        </circle>`
    )
    .join('');

  const zoneLabels = `<text x="${W - P}" y="${P - 10}" text-anchor="end" font-size="10" fill="${COLORS.text}">difficulty (0 = effortless, 100 = wall)</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Difficulty curve across sentences">
    ${yTicks}
    ${zoneLabels}
    <path d="${areaPath}" fill="${COLORS.line}" opacity="0.15"/>
    <path d="${linePath}" fill="none" stroke="${COLORS.line}" stroke-width="2.5" stroke-linejoin="round"/>
    ${dots}
    <text x="${P}" y="${H - 8}" font-size="10" fill="${COLORS.text}">sentence 1</text>
    <text x="${W - P}" y="${H - 8}" text-anchor="end" font-size="10" fill="${COLORS.text}">sentence ${items.length}</text>
  </svg>`;
}

// ---------- Radar chart for compare mode ----------
// labels: [..]; series: [{name, color, values:[0..1]}]
export function radarSVG(labels, series) {
  const W = 420;
  const H = 360;
  const cx = W / 2;
  const cy = H / 2 + 8;
  const R = 130;
  const n = labels.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];

  const rings = [0.25, 0.5, 0.75, 1]
    .map(
      (f) =>
        `<polygon points="${labels.map((_, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="${COLORS.grid}" stroke-width="1"/>`
    )
    .join('');

  const spokes = labels
    .map((_, i) => {
      const [x, y] = pt(i, R);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${COLORS.grid}" stroke-width="1"/>`;
    })
    .join('');

  const labelEls = labels
    .map((lab, i) => {
      const [x, y] = pt(i, R + 22);
      const anchor = Math.abs(x - cx) < 12 ? 'middle' : x > cx ? 'start' : 'end';
      return `<text x="${x}" y="${y + 4}" text-anchor="${anchor}" font-size="11" fill="${COLORS.text}">${lab}</text>`;
    })
    .join('');

  const polys = series
    .map(
      (s) =>
        `<polygon points="${s.values.map((v, i) => pt(i, R * Math.max(0.02, v)).join(',')).join(' ')}"
          fill="${s.color}" fill-opacity="0.18" stroke="${s.color}" stroke-width="2.5"/>`
    )
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto" role="img" aria-label="Comparison radar chart">
    ${rings}
    ${spokes}
    ${polys}
    ${labelEls}
  </svg>`;
}

// ---------- Sentence rhythm heatmap ----------
// items: [{sentence, words}]
export function rhythmHeatHTML(items) {
  if (!items.length) return '<p class="muted">No sentences.</p>';
  const blocks = items
    .map((it) => {
      const color = zoneColor(it.words > 28 ? 80 : it.words > 20 ? 50 : it.words <= 12 ? 10 : 35);
      const w = Math.min(100, 20 + it.words * 2.2);
      return `<div class="rhythm-row" title="${it.words} words">
        <div class="rhythm-bar" style="width:${w}%;background:${color}"></div>
        <span class="rhythm-label">${it.words}w</span>
      </div>`;
    })
    .join('');
  return `<div class="rhythm-heat">${blocks}
    <div class="rhythm-legend">
      <span><i style="background:${COLORS.good}"></i>short</span>
      <span><i style="background:${COLORS.warn}"></i>medium</span>
      <span><i style="background:${COLORS.bad}"></i>long / monotonous risk</span>
    </div>
  </div>`;
}

export { zoneColor };
