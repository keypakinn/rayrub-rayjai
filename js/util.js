// ฟังก์ชันช่วยทั่วไป: วันที่ ตัวเลข เครื่องคิดเลข และการ escape ข้อความ

export const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const TH_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- วันที่ (เก็บเป็นสตริง YYYY-MM-DD ตามเวลาเครื่อง) ----------
const pad = (n) => String(n).padStart(2, '0');
export function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function today() { return ymd(new Date()); }
export function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); }
export function monthOf(dateStr) { return dateStr.slice(0, 7); }
export function thisMonth() { return today().slice(0, 7); }
export function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); } // m = 1..12
export function addMonths(ym, n) {
  let [y, m] = ym.split('-').map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
  return `${y}-${pad(m)}`;
}
// วันที่ของเดือน ym ที่วัน day ถ้าเดือนนั้นไม่มีวันนี้ ให้ใช้วันสุดท้าย
export function clampDate(ym, day) {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}
export function monthDiff(a, b) { // b - a ในหน่วยเดือน
  const [ya, ma] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}
export function fmtDate(s, withYear = true) {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${TH_MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
export function fmtMonth(ym, full = false) {
  const [y, m] = ym.split('-').map(Number);
  return `${(full ? TH_MONTHS_FULL : TH_MONTHS)[m - 1]} ${y}`;
}
export function fmtDayHeader(s) {
  const d = parseYmd(s);
  const label = `${TH_WEEKDAYS[d.getDay()]}. ${d.getDate()} ${TH_MONTHS[d.getMonth()]}`;
  if (s === today()) return 'วันนี้ · ' + label;
  if (s === yesterday()) return 'เมื่อวาน · ' + label;
  return label + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
}

// ---------- ตัวเลข ----------
export function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
export function num(n) {
  const r = round2(n);
  return r.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 });
}

// ---------- เครื่องคิดเลข ----------
export const OPS = ['+', '−', '×', '÷'];
export function calcInput(expr, key) {
  const last = expr.slice(-1);
  if (key === '⌫') return expr.slice(0, -1);
  if (OPS.includes(key)) {
    if (!expr) return expr;
    if (OPS.includes(last)) return expr.slice(0, -1) + key;
    if (last === '.') return expr.slice(0, -1) + key;
    return expr + key;
  }
  const cur = expr.split(/[+−×÷]/).pop();
  if (key === '.') {
    if (cur.includes('.')) return expr;
    return expr + (cur === '' ? '0.' : '.');
  }
  if (cur.includes('.') && cur.split('.')[1].length >= 2) return expr; // ทศนิยมไม่เกิน 2 ตำแหน่ง
  if (key === '00') {
    if (cur === '' || cur === '0') return expr;
    return expr + '00';
  }
  if (cur === '0') return expr.slice(0, -1) + key;
  if (cur.replace('.', '').length >= 9) return expr;
  return expr + key;
}
export function calcEval(expr) {
  if (!expr) return null;
  const tokens = expr.match(/\d+(?:\.\d*)?|[+−×÷]/g);
  if (!tokens) return null;
  while (tokens.length && OPS.includes(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length) return null;
  // คูณหารก่อน
  const stack = [parseFloat(tokens[0])];
  const ops = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]; const v = parseFloat(tokens[i + 1]);
    if (op === '×') stack[stack.length - 1] *= v;
    else if (op === '÷') stack[stack.length - 1] = v === 0 ? NaN : stack[stack.length - 1] / v;
    else { ops.push(op); stack.push(v); }
  }
  let r = stack[0];
  ops.forEach((op, i) => { r = op === '+' ? r + stack[i + 1] : r - stack[i + 1]; });
  return Number.isFinite(r) ? round2(r) : null;
}
export function hasOp(expr) { return /[+−×÷]/.test(expr.replace(/[+−×÷]$/, '')); }
export function prettyExpr(expr) { return expr.replace(/([+−×÷])/g, ' $1 '); }
