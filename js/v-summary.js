// หน้าสรุป: เดือน / ปี / ทริป — กราฟทีละ 1 อัน สลับด้วยปุ่มเล็กเหนือกราฟ
import * as S from './store.js';
import { D } from './store.js';
import * as U from './util.js';
import { esc } from './util.js';
import { UI, on, registerView, render, m, svg, ICON, goTab } from './ui.js';
import { catName, catColor, actualTx, sumOf, inMonth } from './common.js';
import * as CH from './charts.js';

UI.summary = { mode: 'month', month: U.thisMonth(), year: U.thisMonth().slice(0, 4), open: null, tripId: null };

const CHART = {
  month: [['cum', 'สะสม'], ['donut', 'สัดส่วน'], ['bars', '6 เดือน'], ['cal', 'ปฏิทิน']],
  year: [['bars', 'รายเดือน'], ['donut', 'สัดส่วน']],
  trip: [['donut', 'สัดส่วน'], ['days', 'รายวัน']],
};
function chartOf(mode) {
  const saved = D.settings.sumCharts && D.settings.sumCharts[mode];
  return CHART[mode].some(([k]) => k === saved) ? saved : CHART[mode][0][0];
}
function chips(mode) {
  const cur = chartOf(mode);
  return `<div class="chips" role="group" aria-label="เลือกกราฟ">${CHART[mode].map(([k, l]) => `<button class="chip sm" data-a="sumChart" data-v="${k}" aria-pressed="${k === cur}">${l}</button>`).join('')}</div>`;
}
function chartCard(mode, body, note) {
  return `<section class="chart-card" aria-label="กราฟ">${chips(mode)}${body}${note ? `<p class="chart-note">${note}</p>` : ''}</section>`;
}

// ---------- รวมยอด ----------
function breakdown(list, type, prevList = null) {
  const by = new Map();
  for (const t of list) if (t.type === type) by.set(t.catId || '', (by.get(t.catId || '') || 0) + t.amount);
  const prev = new Map();
  if (prevList) for (const t of prevList) if (t.type === type) prev.set(t.catId || '', (prev.get(t.catId || '') || 0) + t.amount);
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  return [...by.entries()].map(([id, amt]) => {
    const p = prev.get(id) || 0;
    let delta = null;
    if (prevList) delta = p === 0 ? 'new' : Math.round(((amt - p) / p) * 100);
    return { id, amt, pct: total ? Math.round((amt / total) * 100) : 0, delta };
  }).sort((a, b) => b.amt - a.amt);
}
function subBreakdown(list, catId) {
  const by = new Map();
  for (const t of list) if ((t.catId || '') === catId) by.set(t.subId || '', (by.get(t.subId || '') || 0) + t.amount);
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  return [...by.entries()].map(([id, amt]) => ({ id, amt, pct: total ? Math.round((amt / total) * 100) : 0 })).sort((a, b) => b.amt - a.amt);
}
const colorOf = (id) => (id ? catColor(S.cat(id)) : '#5C626C');
const labelOf = (id) => { const c = id && S.cat(id); return c ? c.name : 'รอจัดหมวด'; };

// ชิ้นโดนัท: หมวดที่น้อยกว่า 3% รวมเป็น "อื่นๆ"
function donutSlices(rows) {
  const total = rows.reduce((a, r) => a + r.amt, 0);
  const big = rows.filter((r) => r.amt / total >= 0.03);
  const small = rows.filter((r) => r.amt / total < 0.03);
  const out = big.map((r) => ({ id: r.id || 'pending', label: labelOf(r.id), value: r.amt, color: colorOf(r.id) }));
  if (small.length === 1) out.push({ id: small[0].id || 'pending', label: labelOf(small[0].id), value: small[0].amt, color: colorOf(small[0].id) });
  else if (small.length) out.push({ id: '_small', label: 'รวมหมวดเล็ก', value: small.reduce((a, r) => a + r.amt, 0), color: '#6E747E' });
  return out;
}

function catRows(rows, list, type, listFilter, { avgDiv = null } = {}) {
  if (!rows.length) return `<div class="empty">ยังไม่มี${type === 'income' ? 'รายรับ' : 'รายจ่าย'}</div>`;
  const s = UI.summary;
  return rows.map((r) => {
    const c = r.id ? S.cat(r.id) : null;
    const color = colorOf(r.id);
    const open = s.open === `${type}:${r.id}`;
    let right = '';
    if (avgDiv) right = `<span class="delta muted" style="width:auto">เฉลี่ย ${m(Math.round(r.amt / avgDiv))}/ด.</span>`;
    else if (r.delta === 'new') right = '<span class="delta muted">ใหม่</span>';
    else if (r.delta !== null && r.delta !== undefined) {
      const up = r.delta > 0;
      right = r.delta === 0 ? '<span class="delta muted">เท่าเดิม</span>'
        : `<span class="delta" style="color:${(type === 'expense') === up ? '#FFB07A' : '#8CC4FF'}">${up ? '▲' : '▼'} ${Math.abs(r.delta)}%</span>`;
    }
    const subs = open ? subBreakdown(list.filter((t) => t.type === type), r.id) : [];
    return `<div class="catrow ${open ? 'open' : ''}" ${open ? `style="box-shadow:inset 0 0 0 1px ${color}"` : ''}>
      <button data-a="toggleCatRow" data-v="${type}:${r.id}" aria-expanded="${open}">
        <span class="line1"><span class="dot" style="background:${color}"></span><span class="nm">${esc(c ? `${c.emoji || ''} ${c.name}` : 'รอจัดหมวด')}</span>${right}<span class="pct">${r.pct}%</span><span class="amt">${m(r.amt)}</span></span>
        <span class="bar"><span style="width:${r.pct}%;background:${color}"></span></span>
      </button>
      ${open ? `<div class="subs">
        ${subs.length > 1 || (subs[0] && subs[0].id) ? subs.map((x) => `<div><span>${esc(x.id ? catName(x.id, '-') : 'ไม่ระบุหมวดย่อย')}</span><span>${m(x.amt)} · ${x.pct}%</span></div>`).join('') : ''}
        <button class="link" style="align-self:flex-start;padding:6px 0" data-a="seeCatTx" data-cat="${r.id}" data-filter='${esc(JSON.stringify(listFilter))}'>ดูรายการหมวดนี้ →</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function cumSeries(list, ym, uptoDay) {
  const [y, mo] = ym.split('-').map(Number);
  const days = uptoDay || U.daysInMonth(y, mo);
  const per = Array(days).fill(0);
  for (const t of list) if (t.type === 'expense') { const d = Number(t.date.slice(8, 10)); if (d <= days) per[d - 1] += t.amount; }
  let s = 0; return per.map((v) => (s += v));
}

// อัตราใช้ต่อวันสำหรับคาดการณ์: ดู 28 วันล่าสุด ไม่นับงวดผ่อน/รายการประจำ/ทริป
// และตัดวันที่ใช้หนักผิดปกติ 10% บนออก (เช่น วันจ่ายค่าเช่า) เพื่อไม่ให้คาดการณ์พุ่งเกินจริง
function dailyRate(monthList, dayNow) {
  const td = U.today();
  const start = new Date(); start.setDate(start.getDate() - 27);
  const from = U.ymd(start);
  const first = D.tx.reduce((a, t) => (t.date < a ? t.date : a), td);
  const per = new Map();
  for (const t of D.tx) if (t.type === 'expense' && !t.planId && !t.recurId && !t.tripId && t.date >= from && t.date <= td) per.set(t.date, (per.get(t.date) || 0) + t.amount);
  const span = Math.min(28, Math.round((U.parseYmd(td) - U.parseYmd(first > from ? first : from)) / 86400000) + 1);
  if (span < 7) { // ข้อมูลยังน้อย ใช้ค่าเฉลี่ยของเดือนนี้แทน
    const v = monthList.filter((t) => t.type === 'expense' && !t.planId && !t.recurId).reduce((a, t) => a + t.amount, 0);
    return v / dayNow;
  }
  const vals = [];
  for (let i = 0; i < span; i++) { const d = new Date(); d.setDate(d.getDate() - i); vals.push(per.get(U.ymd(d)) || 0); }
  vals.sort((a, b) => a - b);
  const keep = vals.slice(0, vals.length - Math.ceil(vals.length * 0.1));
  return keep.reduce((a, v) => a + v, 0) / keep.length;
}

// ---------- มุมมองเดือน ----------
function monthView() {
  const s = UI.summary;
  const ym = s.month; const cur = U.thisMonth(); const td = U.today();
  const isCur = ym === cur;
  const all = inMonth(ym);
  const list = isCur ? actualTx(all) : all;
  const inc = sumOf(list, 'income'); const exp = sumOf(list, 'expense');
  const [y, mo] = ym.split('-').map(Number);
  const dim = U.daysInMonth(y, mo);
  const dayNow = isCur ? Number(td.slice(8, 10)) : dim;
  const prevYm = U.addMonths(ym, -1);
  const prevAll = inMonth(prevYm);
  let prevSame = prevAll;
  if (isCur) { const lim = U.clampDate(prevYm, dayNow); prevSame = prevAll.filter((t) => t.date <= lim); }
  const rows = breakdown(list, 'expense', prevSame);
  const target = D.settings.target;

  // คาดการณ์ (เฉพาะเดือนนี้)
  let forecast = null;
  if (isCur) {
    const futureSched = sumOf(all.filter((t) => t.date > td), 'expense');
    let recurPending = 0;
    for (const r of D.recurring) if (r.active && r.type === 'expense' && r.startMonth <= ym && !r.generated.includes(ym) && U.clampDate(ym, r.day) > td) recurPending += r.amount;
    forecast = Math.round(exp + dailyRate(list, dayNow) * (dim - dayNow) + futureSched + recurPending);
  }

  const kind = chartOf('month');
  let body = ''; let note = '';
  const mName = (x) => U.TH_MONTHS[Number(x.slice(5, 7)) - 1];
  if (kind === 'cum') {
    const curS = ym > cur ? [] : cumSeries(list, ym, dayNow);
    const prevS = cumSeries(prevAll, prevYm);
    body = CH.cumulative({ cur: curS, prev: prevS, days: dim, target, forecast, curLabel: isCur ? 'วันนี้' : mName(ym), prevLabel: mName(prevYm) })
      + CH.legend([[mName(ym), '#FF8A4C', 'solid'], [mName(prevYm), '#5C626C', 'solid'], ...(target ? [['ความเร็วตามเป้า', '#C9CDD4', 'dashed']] : []), ...(forecast ? [['คาดการณ์', '#FF8A4C', 'dotted']] : [])]);
    const prevAt = sumOf(prevSame, 'expense');
    const diff = exp - prevAt;
    const cmp = prevAt ? (diff >= 0 ? `ใช้มากกว่า${isCur ? 'ช่วงเดียวกัน' : ''}เดือนก่อน <b class="money-exp">${m(diff)}</b>` : `ใช้น้อยกว่า${isCur ? 'ช่วงเดียวกัน' : ''}เดือนก่อน <b class="money-inc">${m(-diff)}</b>`) : 'เดือนก่อนยังไม่มีข้อมูลให้เทียบ';
    const fc = forecast ? ` · ถ้าใช้แบบนี้ สิ้นเดือน ≈ ${m(forecast)}${target ? (forecast > target ? ` <b class="money-exp">เกินเป้า ${m(forecast - target)}</b>` : ` อยู่ในเป้า (เหลือ ${m(target - forecast)})`) : ''}` : (target && !isCur && ym < cur ? (exp > target ? ` · เกินเป้า ${m(exp - target)}` : ' · อยู่ในเป้า') : '');
    note = cmp + fc;
  } else if (kind === 'donut') {
    const hl = s.open && s.open.startsWith('expense:') ? (s.open.slice(8) || 'pending') : null;
    const hr = hl ? rows.find((r) => (r.id || 'pending') === hl) : null;
    body = CH.donut({ slices: donutSlices(rows), centerTop: hr ? labelOf(hr.id) : 'รายจ่ายรวม', centerValue: m(hr ? hr.amt : exp), hl });
    note = 'แตะชิ้นเพื่อดูหมวดนั้น · หมวดที่น้อยกว่า 3% รวมเป็น "รวมหมวดเล็ก"';
  } else if (kind === 'bars') {
    const months = Array.from({ length: 6 }, (_, i) => U.addMonths(ym, i - 5));
    const data = months.map((x) => {
      const l = x === cur ? actualTx(inMonth(x)) : inMonth(x);
      return { key: x, label: mName(x), value: sumOf(l, 'expense'), inc: sumOf(l, 'income'), forecast: x === cur ? forecast : null };
    });
    const past = data.slice(0, 5).filter((d) => d.value > 0);
    const avg = past.length ? past.reduce((a, d) => a + d.value, 0) / past.length : null;
    const maxM = [...data].sort((a, b) => b.value - a.value)[0];
    body = CH.bars({ bars: data, cur: 5, avg, action: 'sumGoMonth' }) + CH.legend([['รายจ่าย', '#FF8A4C', 'solid'], ['รายรับ (จุด)', '#5AA9FF', 'solid'], ...(avg ? [['เฉลี่ย', '#C9CDD4', 'dashed']] : [])]);
    note = (avg ? `เฉลี่ย ${past.length} เดือนก่อนหน้า ${m(Math.round(avg))}/เดือน` : 'ยังมีข้อมูลน้อย') + (maxM && maxM.value ? ` · ${maxM.label} ใช้มากที่สุด` : '') + ' · แตะแท่งเพื่อไปดูเดือนนั้น';
  } else {
    const perDay = {};
    for (const t of list) if (t.type === 'expense') perDay[t.date] = (perDay[t.date] || 0) + t.amount;
    const max = Math.max(0, ...Object.values(perDay));
    const lead = new Date(y, mo - 1, 1).getDay();
    let cal = U.TH_WEEKDAYS.map((w) => `<div class="wd">${w}</div>`).join('') + '<div></div>'.repeat(lead);
    for (let d = 1; d <= dim; d++) {
      const ds = `${ym}-${String(d).padStart(2, '0')}`; const v = perDay[ds] || 0;
      const lv = !v ? '' : v / max > 2 / 3 ? 'l3' : v / max > 1 / 3 ? 'l2' : 'l1';
      cal += `<button class="${lv} ${ds === td ? 'today' : ''}" data-a="calDay" data-v="${ds}" aria-label="${U.fmtDate(ds)} ${v ? m(v) : 'ไม่มีรายจ่าย'}">${d}</button>`;
    }
    body = `<div class="cal">${cal}</div>`;
    const top = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0];
    note = top ? `วันที่ ${Number(top[0].slice(8, 10))} ใช้มากที่สุด ${m(top[1])} · แตะวันเพื่อดูรายการ` : 'ยังไม่มีรายจ่ายในเดือนนี้';
  }

  return `
    <div class="month-nav">
      <button class="icon-btn plain" data-a="sumMonth" data-v="-1" aria-label="เดือนก่อน">${svg(ICON.left)}</button>
      <h1>${U.fmtMonth(ym, true)}</h1>
      <button class="icon-btn plain" data-a="sumMonth" data-v="1" aria-label="เดือนถัดไป">${svg(ICON.right)}</button>
    </div>
    <div class="kpis">
      <div class="kpi"><span class="small muted">รายรับ</span><span class="v money-inc">${m(inc)}</span></div>
      <div class="kpi"><span class="small muted">รายจ่าย</span><span class="v money-exp">${m(exp)}</span></div>
      <div class="kpi"><span class="small muted">คงเหลือ</span><span class="v">${m(inc - exp, inc - exp < 0 ? '−' : '')}</span></div>
    </div>
    ${chartCard('month', body, note)}
    <section class="stack" style="gap:2px">
      <div class="row" style="justify-content:space-between;padding:6px 2px"><h2 class="h2">รายจ่ายตามหมวด</h2><span class="small muted">${isCur ? 'เทียบช่วงเดียวกันเดือนก่อน' : 'เทียบเดือนก่อน'}</span></div>
      ${catRows(rows, list, 'expense', { month: ym })}
    </section>
    ${inc ? `<section class="stack" style="gap:2px"><div class="row" style="padding:6px 2px"><h2 class="h2">รายรับตามหมวด</h2></div>${catRows(breakdown(list, 'income'), list, 'income', { month: ym })}</section>` : ''}`;
}

// ---------- มุมมองปี ----------
function yearView() {
  const s = UI.summary;
  const yr = s.year; const cur = U.thisMonth(); const td = U.today();
  const months = Array.from({ length: 12 }, (_, i) => `${yr}-${String(i + 1).padStart(2, '0')}`);
  const listAll = D.tx.filter((t) => t.date.slice(0, 4) === yr && t.date <= td);
  const data = months.map((x) => { const l = listAll.filter((t) => t.date.slice(0, 7) === x); return { key: x, label: U.TH_MONTHS[Number(x.slice(5)) - 1], value: sumOf(l, 'expense'), inc: sumOf(l, 'income') }; });
  const inc = sumOf(listAll, 'income'); const exp = sumOf(listAll, 'expense');
  const full = data.filter((d) => d.key < cur && (d.value || d.inc));
  const avg = full.length ? full.reduce((a, d) => a + d.value, 0) / full.length : null;
  const maxM = [...data].sort((a, b) => b.value - a.value)[0];
  const monthsCount = yr === cur.slice(0, 4) ? Number(cur.slice(5)) : 12;
  const rows = breakdown(listAll, 'expense');
  const kind = chartOf('year');
  let body; let note;
  if (kind === 'bars') {
    const ci = yr === cur.slice(0, 4) ? Number(cur.slice(5)) - 1 : null;
    body = CH.bars({ bars: data, cur: ci, avg, action: 'sumGoMonth', h: 200 }) + CH.legend([['รายจ่าย', '#FF8A4C', 'solid'], ['รายรับ (จุด)', '#5AA9FF', 'solid'], ...(avg ? [['เฉลี่ย', '#C9CDD4', 'dashed']] : [])]);
    note = `รายรับรวม ${m(inc)} · รายจ่ายรวม ${m(exp)}${yr === cur.slice(0, 4) ? ` (ถึง ${U.fmtDate(td, false)})` : ''} · แตะแท่งเพื่อไปดูเดือนนั้น`;
  } else {
    const hl = s.open && s.open.startsWith('expense:') ? (s.open.slice(8) || 'pending') : null;
    const hr = hl ? rows.find((r) => (r.id || 'pending') === hl) : null;
    body = CH.donut({ slices: donutSlices(rows), centerTop: hr ? labelOf(hr.id) : `ทั้งปี ${yr}`, centerValue: m(hr ? hr.amt : exp), hl });
    note = 'แตะชิ้นเพื่อดูหมวดนั้น';
  }
  return `
    <div class="month-nav">
      <button class="icon-btn plain" data-a="sumYear" data-v="-1" aria-label="ปีก่อน">${svg(ICON.left)}</button>
      <h1>ปี ${yr}</h1>
      <button class="icon-btn plain" data-a="sumYear" data-v="1" aria-label="ปีถัดไป">${svg(ICON.right)}</button>
    </div>
    <div class="kpis">
      <div class="kpi"><span class="small muted">ใช้เฉลี่ย/เดือน</span><span class="v money-exp">${avg ? m(Math.round(avg)) : '–'}</span></div>
      <div class="kpi"><span class="small muted">ใช้มากสุด</span><span class="v">${maxM && maxM.value ? `${esc(U.TH_MONTHS[Number(maxM.key.slice(5)) - 1])} ${CH.k(maxM.value)}` : '–'}</span></div>
      <div class="kpi"><span class="small muted">เก็บได้</span><span class="v ${inc - exp >= 0 ? 'money-inc' : 'money-exp'}">${m(inc - exp, inc - exp < 0 ? '−' : '')}</span></div>
    </div>
    ${chartCard('year', body, note)}
    <section class="stack" style="gap:2px">
      <div class="row" style="justify-content:space-between;padding:6px 2px"><h2 class="h2">รายจ่ายทั้งปีตามหมวด</h2><span class="small muted">${monthsCount} เดือน</span></div>
      ${catRows(rows, listAll, 'expense', { year: yr }, { avgDiv: monthsCount })}
    </section>`;
}

// ---------- มุมมองทริป ----------
function tripView() {
  const s = UI.summary;
  const trips = [...D.trips].sort((a, b) => b.startedAt - a.startedAt);
  if (!trips.length) return '<div class="empty">ยังไม่มีทริป<br>เปิดโหมดทริปได้ที่ ตั้งค่า → โหมดทริป</div>';
  if (!s.tripId || !S.trip(s.tripId)) s.tripId = trips[0].id;
  const tr = S.trip(s.tripId);
  const list = D.tx.filter((t) => t.tripId === tr.id);
  const exp = sumOf(list, 'expense');
  const dates = [...new Set(list.map((t) => t.date))].sort();
  const days = dates.length ? Math.round((U.parseYmd(dates[dates.length - 1]) - U.parseYmd(dates[0])) / 86400000) + 1 : 0;
  const rows = breakdown(list, 'expense');
  const kind = chartOf('trip');
  let body; let note;
  if (kind === 'donut') {
    const hl = s.open && s.open.startsWith('expense:') ? (s.open.slice(8) || 'pending') : null;
    const hr = hl ? rows.find((r) => (r.id || 'pending') === hl) : null;
    body = CH.donut({ slices: donutSlices(rows), centerTop: hr ? labelOf(hr.id) : 'ทั้งทริป', centerValue: m(hr ? hr.amt : exp), hl });
    note = rows[0] ? `${labelOf(rows[0].id)} มากที่สุด ${rows[0].pct}% ของทริป · แตะชิ้นเพื่อดูหมวดนั้น` : '';
  } else {
    const allDays = [];
    if (dates.length) for (let d = U.parseYmd(dates[0]); d <= U.parseYmd(dates[dates.length - 1]); d.setDate(d.getDate() + 1)) allDays.push(U.ymd(d));
    const shown = allDays.slice(-14);
    const data = shown.map((ds) => ({ key: ds, label: `${Number(ds.slice(8))}`, value: sumOf(list.filter((t) => t.date === ds), 'expense') }));
    body = CH.bars({ bars: data, action: 'tripDay', h: 170, valueLabels: data.length <= 7 });
    const top = [...data].sort((a, b) => b.value - a.value)[0];
    note = top && top.value ? `${U.fmtDate(top.key, false)} ใช้มากที่สุด ${m(top.value)} · แตะแท่งเพื่อดูรายการของวันนั้น` : 'ยังไม่มีรายการ';
    if (allDays.length > 14) note += ` · แสดง 14 วันล่าสุด`;
  }
  return `
    <div class="chips">${trips.map((t) => `<button class="chip" data-a="pickTrip" data-id="${t.id}" aria-pressed="${t.id === tr.id}">${esc(t.name)}${t.id === D.settings.activeTripId ? ' •' : ''}</button>`).join('')}</div>
    <section class="card stack" style="gap:4px">
      <span class="small muted">${esc(tr.name)}${tr.id === D.settings.activeTripId ? ' · กำลังเที่ยว' : ''}</span>
      <span style="font-size:28px;font-weight:600">${m(exp)}</span>
      <span class="small muted">${dates.length ? `${U.fmtDate(dates[0])} – ${U.fmtDate(dates[dates.length - 1])} · ${days} วัน · ${list.length} รายการ · เฉลี่ยวันละ ${m(Math.round(exp / Math.max(days, 1)))}` : 'ยังไม่มีรายการ'}</span>
    </section>
    ${list.length ? chartCard('trip', body, note) : ''}
    <section class="stack" style="gap:2px">
      <div class="row" style="padding:6px 2px"><h2 class="h2">รายจ่ายตามหมวด</h2></div>
      ${catRows(rows, list, 'expense', { tripId: tr.id })}
    </section>`;
}

registerView('summary', () => {
  const s = UI.summary;
  const hidden = D.settings.hideAmounts;
  return `<div class="stack" style="gap:14px">
    <div class="row">
      <div class="seg" role="group" aria-label="มุมมอง" style="flex:1">
        <button data-a="sumMode" data-v="month" aria-pressed="${s.mode === 'month'}">เดือน</button>
        <button data-a="sumMode" data-v="year" aria-pressed="${s.mode === 'year'}">ปี</button>
        <button data-a="sumMode" data-v="trip" aria-pressed="${s.mode === 'trip'}">ทริป</button>
      </div>
      <button class="icon-btn" data-a="toggleHide" aria-label="${hidden ? 'แสดงยอดเงิน' : 'ซ่อนยอดเงิน'}">${svg(hidden ? ICON.eyeOff : ICON.eye)}</button>
    </div>
    ${s.mode === 'trip' ? tripView() : s.mode === 'year' ? yearView() : monthView()}
  </div>`;
});

on('sumMode', (el) => { UI.summary.mode = el.dataset.v; UI.summary.open = null; render(); });
on('sumMonth', (el) => { UI.summary.month = U.addMonths(UI.summary.month, Number(el.dataset.v)); UI.summary.open = null; render(); });
on('sumYear', (el) => { UI.summary.year = String(Number(UI.summary.year) + Number(el.dataset.v)); UI.summary.open = null; render(); });
on('sumChart', async (el) => {
  const mode = UI.summary.mode;
  await S.saveSettings({ sumCharts: { ...(D.settings.sumCharts || {}), [mode]: el.dataset.v } });
  render();
});
on('sumGoMonth', (el) => { Object.assign(UI.summary, { mode: 'month', month: el.dataset.v, open: null }); document.getElementById('view').scrollTop = 0; render(); });
on('donutPick', (el) => {
  const id = el.dataset.id;
  if (id === '_small') return;
  const key = `expense:${id === 'pending' ? '' : id}`;
  UI.summary.open = UI.summary.open === key ? null : key;
  render();
});
on('toggleCatRow', (el) => { UI.summary.open = UI.summary.open === el.dataset.v ? null : el.dataset.v; render(); });
on('pickTrip', (el) => { UI.summary.tripId = el.dataset.id; UI.summary.open = null; render(); });
on('seeCatTx', (el) => {
  const f = JSON.parse(el.dataset.filter);
  const catId = el.dataset.cat;
  const base = { ...UI.list, q: '', day: '', channelId: '', pending: !catId, catId: catId || '', tripId: f.tripId || '', year: f.year || '' };
  if (f.month) base.month = f.month;
  UI.list = base;
  goTab('list');
});
on('calDay', (el) => {
  UI.list = { ...UI.list, q: '', pending: false, catId: '', channelId: '', tripId: '', year: '', month: el.dataset.v.slice(0, 7), day: el.dataset.v };
  goTab('list');
});
on('tripDay', (el) => {
  UI.list = { ...UI.list, q: '', pending: false, catId: '', channelId: '', year: '', tripId: UI.summary.tripId, month: el.dataset.v.slice(0, 7), day: el.dataset.v };
  goTab('list');
});
