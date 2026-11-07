// กราฟ SVG แบบเบา ๆ (ไม่พึ่งไลบรารี): เส้นสะสม, โดนัท, แท่ง
import { D } from './store.js';
import { esc } from './util.js';

export const W = 340;
const C = { line: '#262A32', muted: '#9AA0AA', text: '#F2F3F5', text2: '#C9CDD4', exp: '#FF8A4C', inc: '#5AA9FF', prev: '#5C626C', bg: '#17191E' };
const hidden = () => D.settings && D.settings.hideAmounts;

export function niceMax(v) {
  if (!(v > 0)) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
export function k(v) {
  if (hidden()) return '••';
  if (Math.abs(v) >= 1000) return (Math.round(v / 100) / 10).toString().replace(/\.0$/, '') + 'k';
  return String(Math.round(v));
}
function wrap(inner, h, label) {
  return `<svg class="chart" role="img" aria-label="${esc(label)}" viewBox="0 0 ${W} ${h}" width="100%" style="display:block;overflow:visible">${inner}</svg>`;
}
function axis(L, R, Y, max, h) {
  let g = '';
  for (const v of [0, max / 2, max]) {
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${C.line}"/>`;
    g += `<text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" fill="${C.muted}" font-size="10" text-anchor="end">${v === 0 ? '0' : k(v)}</text>`;
  }
  return g;
}

// ---------- เส้นสะสม ----------
// cur: ยอดสะสมรายวันของเดือนนี้ (ยาวเท่าจำนวนวันที่ผ่านไป), prev: ของเดือนก่อน (ทั้งเดือน)
export function cumulative({ cur, prev, days, target, forecast, curLabel, prevLabel }) {
  const h = 190; const L = 32; const R = 8; const T = 14; const B = 22;
  const pw = W - L - R; const ph = h - T - B;
  const max = niceMax(Math.max(1, ...cur, ...prev, target || 0, forecast || 0));
  const X = (d) => L + ((d - 1) / Math.max(1, days - 1)) * pw;
  const Y = (v) => T + ph - (v / max) * ph;
  let g = axis(L, R, Y, max, h);
  for (const d of [1, 8, 15, 22, 29]) if (d <= days) g += `<text x="${X(d).toFixed(1)}" y="${h - 6}" fill="${C.muted}" font-size="10" text-anchor="middle">${d}</text>`;
  if (target) {
    g += `<line x1="${X(1).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${X(days).toFixed(1)}" y2="${Y(target).toFixed(1)}" stroke="${C.text2}" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>`;
    g += `<text x="${(X(days) - 2).toFixed(1)}" y="${(Y(target) - 6).toFixed(1)}" fill="${C.text2}" font-size="10" text-anchor="end">เป้า ${k(target)}</text>`;
  }
  if (prev.length) {
    const px = (i) => L + (i / Math.max(1, prev.length - 1)) * pw; // ยืดเดือนก่อนให้เต็มแกน
    g += `<polyline points="${prev.map((v, i) => `${px(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${C.prev}" stroke-width="2" stroke-linejoin="round"/>`;
    g += `<text x="${(W - R).toFixed(1)}" y="${(Y(prev[prev.length - 1]) + (target && Math.abs(Y(prev[prev.length - 1]) - Y(target)) < 14 ? 14 : -6)).toFixed(1)}" fill="${C.muted}" font-size="10" text-anchor="end">${esc(prevLabel)} ${k(prev[prev.length - 1])}</text>`;
  }
  if (cur.length) {
    const last = cur.length;
    if (forecast && last < days) {
      g += `<line x1="${X(last).toFixed(1)}" y1="${Y(cur[last - 1]).toFixed(1)}" x2="${X(days).toFixed(1)}" y2="${Y(forecast).toFixed(1)}" stroke="${C.exp}" stroke-width="2" stroke-dasharray="2 4" opacity=".6"/>`;
      g += `<circle cx="${X(days).toFixed(1)}" cy="${Y(forecast).toFixed(1)}" r="3" fill="none" stroke="${C.exp}" stroke-width="1.5"/>`;
    }
    const pts = cur.map((v, i) => `${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    g += `<polygon points="${X(1).toFixed(1)},${Y(0).toFixed(1)} ${pts} ${X(last).toFixed(1)},${Y(0).toFixed(1)}" fill="${C.exp}" opacity=".12"/>`;
    g += `<polyline points="${pts}" fill="none" stroke="${C.exp}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += `<circle cx="${X(last).toFixed(1)}" cy="${Y(cur[last - 1]).toFixed(1)}" r="4.5" fill="${C.exp}" stroke="${C.bg}" stroke-width="2"/>`;
    const lx = X(last); const anchor = lx > W - 90 ? 'end' : 'start';
    g += `<text x="${(anchor === 'start' ? lx + 8 : lx - 8).toFixed(1)}" y="${(Y(cur[last - 1]) - 8).toFixed(1)}" fill="${C.text}" font-size="11" font-weight="600" text-anchor="${anchor}">${esc(curLabel)} ${k(cur[last - 1])}</text>`;
  }
  return wrap(g, h, 'ยอดใช้สะสมรายวัน');
}

// ---------- โดนัท ----------
// slices: [{id, label, value, color}], hl: id ที่เลือก, onTap: ชื่อ action
export function donut({ slices, centerTop, centerValue, hl = null, action = 'donutPick' }) {
  const h = 200; const cx = W / 2; const cy = h / 2; const r = 74; const w = 26;
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return wrap(`<text x="${cx}" y="${cy}" fill="${C.muted}" font-size="13" text-anchor="middle">ยังไม่มีรายจ่าย</text>`, h, 'ยังไม่มีข้อมูล');
  let a = -Math.PI / 2; let g = ''; let labels = '';
  for (const s of slices) {
    const frac = s.value / total;
    const a2 = a + frac * 2 * Math.PI;
    const gap = slices.length > 1 ? 0.012 : 0;
    const s0 = a + gap; const s1 = a2 - gap;
    const rr = r + (s.id === hl ? 5 : 0);
    const big = s1 - s0 > Math.PI ? 1 : 0;
    const op = hl === null || s.id === hl ? 1 : 0.35;
    const p = (ang) => `${(cx + rr * Math.cos(ang)).toFixed(2)},${(cy + rr * Math.sin(ang)).toFixed(2)}`;
    const d = frac >= 0.9999 ? `M${cx - rr},${cy} a${rr},${rr} 0 1 1 ${rr * 2},0 a${rr},${rr} 0 1 1 ${-rr * 2},0` : `M${p(s0)} A${rr},${rr} 0 ${big} 1 ${p(s1)}`;
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${w}" opacity="${op}"/>`;
    g += `<path d="${d}" fill="none" stroke="transparent" stroke-width="${w + 14}" data-a="${action}" data-id="${esc(s.id)}" style="cursor:pointer"><title>${esc(s.label)}</title></path>`;
    const mid = (a + a2) / 2;
    if (frac >= 0.08) {
      const lx = cx + (r + 30) * Math.cos(mid); const ly = cy + (r + 30) * Math.sin(mid);
      const anchor = Math.cos(mid) > 0.25 ? 'start' : Math.cos(mid) < -0.25 ? 'end' : 'middle';
      labels += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" fill="${C.text2}" font-size="11" text-anchor="${anchor}">${esc(s.label)} ${Math.round(frac * 100)}%</text>`;
    }
    a = a2;
  }
  g += labels;
  g += `<text x="${cx}" y="${cy - 6}" fill="${C.muted}" font-size="12" text-anchor="middle">${esc(centerTop)}</text>`;
  g += `<text x="${cx}" y="${cy + 16}" fill="${C.text}" font-size="21" font-weight="600" text-anchor="middle">${esc(centerValue)}</text>`;
  return wrap(g, h, 'สัดส่วนรายจ่ายตามหมวด แตะชิ้นเพื่อดูหมวด');
}

// ---------- แท่ง ----------
// bars: [{label, value, inc, forecast, key}], cur: index ที่เน้น, avg: เส้นค่าเฉลี่ย, action: แตะแท่ง
export function bars({ bars: list, cur = null, avg = null, action = null, h = 190, valueLabels = false }) {
  const L = 32; const R = 6; const T = 16; const B = 22;
  const pw = W - L - R; const ph = h - T - B;
  const max = niceMax(Math.max(1, ...list.map((b) => Math.max(b.value || 0, b.inc || 0, b.forecast || 0)), avg || 0));
  const Y = (v) => T + ph - (v / max) * ph;
  const slot = pw / list.length; const bw = Math.min(40, slot * 0.58);
  let g = axis(L, R, Y, max, h);
  if (avg) {
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(avg).toFixed(1)}" y2="${Y(avg).toFixed(1)}" stroke="${C.text2}" stroke-dasharray="4 4" opacity=".6"/>`;
    g += `<text x="${W - R}" y="${(Y(avg) - 5).toFixed(1)}" fill="${C.text2}" font-size="10" text-anchor="end">เฉลี่ย ${k(avg)}</text>`;
  }
  list.forEach((b, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    const on = cur === null || i === cur;
    if (b.forecast && b.forecast > (b.value || 0)) g += `<rect x="${x.toFixed(1)}" y="${Y(b.forecast).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(0) - Y(b.forecast)).toFixed(1)}" rx="4" fill="none" stroke="${C.exp}" stroke-dasharray="3 3" opacity=".7"/>`;
    if (b.value) g += `<rect x="${x.toFixed(1)}" y="${Y(b.value).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Y(0) - Y(b.value)).toFixed(1)}" rx="4" fill="${C.exp}" opacity="${on ? 1 : 0.55}"/>`;
    if (valueLabels && b.value) g += `<text x="${(x + bw / 2).toFixed(1)}" y="${(Y(b.value) - 6).toFixed(1)}" fill="${C.text2}" font-size="11" text-anchor="middle">${k(b.value)}</text>`;
    if (b.inc) g += `<circle cx="${(x + bw / 2).toFixed(1)}" cy="${Y(b.inc).toFixed(1)}" r="3.5" fill="${C.inc}" stroke="${C.bg}" stroke-width="1.5"/>`;
    g += `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 6}" fill="${i === cur ? C.text : C.muted}" font-size="10" font-weight="${i === cur ? 600 : 400}" text-anchor="middle">${esc(b.label)}</text>`;
    if (action) g += `<rect x="${(L + slot * i).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${h - T}" fill="transparent" data-a="${action}" data-v="${esc(b.key)}" style="cursor:pointer"><title>${esc(b.label)}</title></rect>`;
  });
  return wrap(g, h, 'กราฟแท่ง แตะเพื่อดูรายละเอียด');
}

export function legend(items) {
  return `<div class="legend">${items.map(([label, color, style]) => `<span><i style="border-top:2px ${style} ${color}"></i>${esc(label)}</span>`).join('')}</div>`;
}
