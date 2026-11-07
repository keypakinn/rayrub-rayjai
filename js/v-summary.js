// หน้าสรุป: รายเดือน หรือ รายทริป
import * as S from './store.js';
import { D } from './store.js';
import * as U from './util.js';
import { esc } from './util.js';
import { UI, on, registerView, render, m, svg, ICON, goTab, openSheet } from './ui.js';
import { catName, catColor, actualTx, sumOf, inMonth } from './common.js';

UI.summary = { mode: 'month', month: U.thisMonth(), open: null, tripId: null };

// รวมยอดตามหมวด (มีรายการก่อนหน้าไว้เทียบ)
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

function catRows(rows, list, type, listFilter) {
  if (!rows.length) return `<div class="empty">ยังไม่มี${type === 'income' ? 'รายรับ' : 'รายจ่าย'}</div>`;
  const s = UI.summary;
  return rows.map((r) => {
    const c = r.id ? S.cat(r.id) : null;
    const color = r.id ? catColor(c) : '#5C626C';
    const open = s.open === `${type}:${r.id}`;
    let delta = '';
    if (r.delta === 'new') delta = '<span class="delta muted">ใหม่</span>';
    else if (r.delta !== null) {
      const up = r.delta > 0;
      delta = r.delta === 0 ? '<span class="delta muted">เท่าเดิม</span>'
        : `<span class="delta" style="color:${(type === 'expense') === up ? '#FFB07A' : '#8CC4FF'}">${up ? '▲' : '▼'} ${Math.abs(r.delta)}%</span>`;
    }
    const subs = open ? subBreakdown(list.filter((t) => t.type === type), r.id) : [];
    return `<div class="catrow ${open ? 'open' : ''}">
      <button data-a="toggleCatRow" data-v="${type}:${r.id}" aria-expanded="${open}">
        <span class="line1"><span class="dot" style="background:${color}"></span><span class="nm">${esc(c ? `${c.emoji || ''} ${c.name}` : 'รอจัดหมวด')}</span>${delta}<span class="pct">${r.pct}%</span><span class="amt">${m(r.amt)}</span></span>
        <span class="bar"><span style="width:${r.pct}%;background:${color}"></span></span>
      </button>
      ${open ? `<div class="subs">
        ${subs.length > 1 || (subs[0] && subs[0].id) ? subs.map((x) => `<div><span>${esc(x.id ? catName(x.id, '-') : 'ไม่ระบุหมวดย่อย')}</span><span>${m(x.amt)} · ${x.pct}%</span></div>`).join('') : ''}
        <button class="link" style="align-self:flex-start;padding:6px 0" data-a="seeCatTx" data-cat="${r.id}" data-filter='${esc(JSON.stringify(listFilter))}'>ดูรายการหมวดนี้ →</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function monthView() {
  const s = UI.summary;
  const ym = s.month;
  const cur = U.thisMonth();
  const td = U.today();
  const isCur = ym === cur;
  const all = inMonth(ym);
  const list = isCur ? actualTx(all) : all;
  const inc = sumOf(list, 'income');
  const exp = sumOf(list, 'expense');
  const [y, mo] = ym.split('-').map(Number);
  const dim = U.daysInMonth(y, mo);
  const dayNow = Number(td.slice(8, 10));

  // เทียบช่วงเดียวกันของเดือนก่อน (ถ้าดูเดือนปัจจุบัน) หรือทั้งเดือน
  const prevYm = U.addMonths(ym, -1);
  let prevList = inMonth(prevYm);
  if (isCur) { const lim = U.clampDate(prevYm, dayNow); prevList = prevList.filter((t) => t.date <= lim); }

  // เป้า + คาดการณ์
  let targetHtml = '';
  const target = D.settings.target;
  let forecastHtml = '';
  if (isCur || ym > cur) {
    const futureSched = sumOf(all.filter((t) => t.date > td), 'expense');
    let recurPending = 0;
    for (const r of D.recurring) {
      if (!r.active || r.type !== 'expense' || r.startMonth > ym || r.generated.includes(ym)) continue;
      if (U.clampDate(ym, r.day) > td) recurPending += r.amount;
    }
    if (isCur) {
      const variable = list.filter((t) => t.type === 'expense' && !t.planId && !t.recurId).reduce((a, t) => a + t.amount, 0);
      const forecast = exp + (variable / dayNow) * (dim - dayNow) + futureSched + recurPending;
      forecastHtml = `<div style="height:1px;background:var(--line)"></div>
        <div class="row" style="align-items:baseline"><span class="small muted" style="flex:1">คาดการณ์สิ้นเดือน (รวมงวดผ่อนและรายการประจำที่รออยู่)</span><b style="font-size:16px;white-space:nowrap">≈ ${m(Math.round(forecast))}</b></div>`;
    } else if (futureSched + recurPending > 0) {
      forecastHtml = `<div class="small muted">มีงวดผ่อน/รายการประจำรออยู่ ${m(futureSched + recurPending)}</div>`;
    }
    if (isCur && futureSched > 0) forecastHtml += `<div class="small muted">รอตัดอีกในเดือนนี้ ${m(futureSched)} (งวดผ่อนที่ยังไม่ถึงวัน)</div>`;
  }
  if (target) {
    const used = Math.round((exp / target) * 100);
    const elapsed = isCur ? Math.round((dayNow / dim) * 100) : ym < cur ? 100 : 0;
    const warn = isCur && used > elapsed;
    targetHtml = `<div class="row" style="justify-content:space-between;align-items:baseline"><span class="h2">เป้าใช้จ่าย ${m(target)}</span><span class="small muted">ใช้ไป ${used}%${isCur ? ` · ผ่านเดือนไป ${elapsed}%` : ''}</span></div>
      <div class="target-bar"><span style="width:${Math.min(used, 100)}%;background:${used > 100 ? 'var(--danger)' : 'var(--exp)'}"></span>${isCur ? `<i style="left:${elapsed}%"></i>` : ''}</div>
      ${used > 100 ? `<div class="small" style="color:var(--danger-text)">เกินเป้าแล้ว ${m(exp - target)}</div>` : warn ? '<div class="small money-exp">ใช้เร็วกว่าเวลาที่ผ่านไป</div>' : isCur ? `<div class="small muted">เหลือใช้ได้อีก ${m(Math.max(0, target - exp))}</div>` : ''}`;
  }
  const card = targetHtml || forecastHtml ? `<section class="card stack">${targetHtml}${forecastHtml}</section>` : '';

  // ปฏิทิน
  const perDay = {};
  for (const t of list) if (t.type === 'expense') perDay[t.date] = (perDay[t.date] || 0) + t.amount;
  const max = Math.max(0, ...Object.values(perDay));
  const lead = new Date(y, mo - 1, 1).getDay();
  let cal = U.TH_WEEKDAYS.map((w) => `<div class="wd">${w}</div>`).join('') + '<div></div>'.repeat(lead);
  for (let d = 1; d <= dim; d++) {
    const ds = `${ym}-${String(d).padStart(2, '0')}`;
    const v = perDay[ds] || 0;
    const lv = !v ? '' : v / max > 2 / 3 ? 'l3' : v / max > 1 / 3 ? 'l2' : 'l1';
    cal += `<button class="${lv} ${ds === td ? 'today' : ''}" data-a="calDay" data-v="${ds}" aria-label="${U.fmtDate(ds)} ${v ? m(v) : 'ไม่มีรายจ่าย'}">${d}</button>`;
  }

  const lf = { month: ym };
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
    ${card}
    <section class="stack" style="gap:2px">
      <div class="row" style="justify-content:space-between;padding:6px 2px"><h2 class="h2">รายจ่ายตามหมวด</h2><span class="small muted">${isCur ? 'เทียบช่วงเดียวกันเดือนก่อน' : 'เทียบเดือนก่อน'}</span></div>
      ${catRows(breakdown(list, 'expense', prevList), list, 'expense', lf)}
    </section>
    ${inc ? `<section class="stack" style="gap:2px">
      <div class="row" style="padding:6px 2px"><h2 class="h2">รายรับตามหมวด</h2></div>
      ${catRows(breakdown(list, 'income'), list, 'income', lf)}
    </section>` : ''}
    <section class="stack" style="gap:8px">
      <div class="row" style="justify-content:space-between;padding:6px 2px 0"><h2 class="h2">ปฏิทินรายจ่าย</h2><span class="small muted">สีเข้ม = ใช้มาก · แตะวันเพื่อดูรายการ</span></div>
      <div class="cal">${cal}</div>
    </section>`;
}

function tripView() {
  const s = UI.summary;
  const trips = [...D.trips].sort((a, b) => b.startedAt - a.startedAt);
  if (!trips.length) return '<div class="empty">ยังไม่มีทริป<br>เปิดโหมดทริปได้ที่ ตั้งค่า → โหมดทริป</div>';
  if (!s.tripId || !S.trip(s.tripId)) s.tripId = trips[0].id;
  const tr = S.trip(s.tripId);
  const list = D.tx.filter((t) => t.tripId === tr.id);
  const exp = sumOf(list, 'expense');
  const dates = list.map((t) => t.date).sort();
  const days = dates.length ? Math.round((U.parseYmd(dates[dates.length - 1]) - U.parseYmd(dates[0])) / 86400000) + 1 : 0;
  return `
    <div class="chips">${trips.map((t) => `<button class="chip" data-a="pickTrip" data-id="${t.id}" aria-pressed="${t.id === tr.id}">${esc(t.name)}${t.id === D.settings.activeTripId ? ' •' : ''}</button>`).join('')}</div>
    <section class="card stack" style="gap:6px">
      <span class="small muted">${esc(tr.name)}${tr.id === D.settings.activeTripId ? ' · กำลังเที่ยว' : ''}</span>
      <span style="font-size:28px;font-weight:600">${m(exp)}</span>
      <span class="small muted">${dates.length ? `${U.fmtDate(dates[0])} – ${U.fmtDate(dates[dates.length - 1])} · ${days} วัน · ${list.length} รายการ · เฉลี่ยวันละ ${m(Math.round(exp / Math.max(days, 1)))}` : 'ยังไม่มีรายการ'}</span>
    </section>
    <section class="stack" style="gap:2px">
      <div class="row" style="padding:6px 2px"><h2 class="h2">รายจ่ายตามหมวด</h2></div>
      ${catRows(breakdown(list, 'expense'), list, 'expense', { tripId: tr.id })}
    </section>`;
}

registerView('summary', () => {
  const s = UI.summary;
  const hidden = D.settings.hideAmounts;
  return `<div class="stack" style="gap:14px">
    <div class="row">
      <div class="seg" role="group" aria-label="มุมมอง" style="flex:1">
        <button data-a="sumMode" data-v="month" aria-pressed="${s.mode === 'month'}">รายเดือน</button>
        <button data-a="sumMode" data-v="trip" aria-pressed="${s.mode === 'trip'}">ทริป</button>
      </div>
      <button class="icon-btn" data-a="toggleHide" aria-label="${hidden ? 'แสดงยอดเงิน' : 'ซ่อนยอดเงิน'}">${svg(hidden ? ICON.eyeOff : ICON.eye)}</button>
    </div>
    ${s.mode === 'trip' ? tripView() : monthView()}
  </div>`;
});

on('sumMode', (el) => { UI.summary.mode = el.dataset.v; UI.summary.open = null; render(); });
on('sumMonth', (el) => { UI.summary.month = U.addMonths(UI.summary.month, Number(el.dataset.v)); UI.summary.open = null; render(); });
on('toggleCatRow', (el) => { UI.summary.open = UI.summary.open === el.dataset.v ? null : el.dataset.v; render(); });
on('pickTrip', (el) => { UI.summary.tripId = el.dataset.id; UI.summary.open = null; render(); });
on('seeCatTx', (el) => {
  const f = JSON.parse(el.dataset.filter);
  const catId = el.dataset.cat;
  UI.list = { ...UI.list, q: '', day: '', channelId: '', pending: !catId, catId: catId || '', tripId: f.tripId || '', month: f.month || UI.list.month };
  goTab('list');
});
on('calDay', (el) => {
  UI.list = { ...UI.list, q: '', pending: false, catId: '', channelId: '', tripId: '', month: el.dataset.v.slice(0, 7), day: el.dataset.v };
  goTab('list');
});
export { openSheet };
