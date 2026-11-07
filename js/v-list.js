// หน้ารายการ: ค้นหา กรอง ปัดลบ กดค้าง เลือกหลายรายการ และแผ่นแก้ไขรายการ
import * as S from './store.js';
import { D } from './store.js';
import * as U from './util.js';
import { esc } from './util.js';
import { UI, on, onInput, onChange, registerView, registerSheet, render, renderSheet, afterRender, openSheet, closeSheet, sheetHead, toast, ask, confirm, m, svg, ICON, optionsHtml, suppressNextClick, updateLock } from './ui.js';
import { catName, catColor, txMeta, txTitle, tripName, catOptions, subOptions, channelOptions } from './common.js';

UI.list = { month: U.thisMonth(), year: '', q: '', pending: false, catId: '', channelId: '', tripId: '', day: '', selecting: false, sel: new Set(), swiped: null };

function filtered() {
  const L = UI.list;
  const q = L.q.trim().toLowerCase();
  const allMonths = !!q || !!L.tripId || L.pending || !!L.year;
  return D.tx.filter((t) => {
    if (L.year && t.date.slice(0, 4) !== L.year) return false;
    if (!allMonths && t.date.slice(0, 7) !== L.month) return false;
    if (L.day && t.date !== L.day) return false;
    if (L.pending && t.catId) return false;
    if (L.catId && t.catId !== L.catId) return false;
    if (L.channelId && t.channelId !== L.channelId) return false;
    if (L.tripId && t.tripId !== L.tripId) return false;
    if (q) {
      const hay = [txTitle(t), catName(t.catId, ''), t.subId ? catName(t.subId, '') : '', S.channel(t.channelId)?.name || '', tripName(t.tripId), String(t.amount)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}

function rowHtml(t) {
  const L = UI.list;
  const td = U.today();
  const c = t.catId && S.cat(t.catId);
  const sel = L.sel.has(t.id);
  const swiped = L.swiped === t.id;
  const tags = [];
  if (!t.catId) tags.push('<span class="tag warn">รอจัดหมวด</span>');
  if (t.planSeq) tags.push(`<span class="tag info">${t.planSeq === 'ปิดยอด' ? 'ปิดยอด' : 'งวด ' + esc(t.planSeq)}</span>`);
  if (t.recurId) tags.push('<span class="tag grey">ประจำ</span>');
  if (t.tripId && tripName(t.tripId)) tags.push(`<span class="tag info">${esc(tripName(t.tripId))}</span>`);
  if (t.date > td) tags.push('<span class="tag grey">ล่วงหน้า</span>');
  return `<div class="txrow ${t.date > td ? 'future' : ''}" data-row="${t.id}">
    ${swiped ? `<button class="del" data-a="swipeDelete" data-id="${t.id}">ลบ</button>` : ''}
    <button class="main" data-a="${L.selecting ? 'toggleSel' : 'openTx'}" data-id="${t.id}" style="transform:translateX(${swiped ? '-84px' : '0'})">
      ${L.selecting ? `<span class="check ${sel ? 'on' : ''}">${sel ? svg(ICON.check, 14) : ''}</span>` : ''}
      <span class="emoji" style="${c ? '' : 'background:#2A2016'}">${esc(c ? (c.emoji || '•') : '?')}</span>
      <span class="info">
        <span class="nt" style="${t.note || t.planSeq ? '' : 'color:var(--muted)'}">${esc(txTitle(t))}</span>
        <span class="mt">${tags.join('')}<span>${esc(txMeta(t) || (S.channel(t.channelId)?.name || ''))}</span></span>
      </span>
      <span class="am ${t.type === 'income' ? 'money-inc' : ''}">${m(t.amount, t.type === 'income' ? '+' : '−')}</span>
    </button>
  </div>`;
}

function resultsHtml() {
  const L = UI.list;
  const list = filtered();
  if (!list.length) return `<div class="empty">${L.q ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการ'}</div>`;
  const exp = list.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const inc = list.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  let html = `<div class="result-bar"><span>${list.length} รายการ</span><span>รายจ่าย ${m(exp)}${inc ? ` · รายรับ ${m(inc)}` : ''}</span></div>`;
  let cur = null;
  const shown = list.slice(0, L.limit || 300);
  for (const t of shown) {
    if (t.date !== cur) {
      cur = t.date;
      const day = list.filter((x) => x.date === cur);
      const net = day.reduce((a, x) => a + (x.type === 'income' ? x.amount : -x.amount), 0);
      html += `<div class="day-head"><h2>${esc(U.fmtDayHeader(cur))}</h2><span class="muted">${m(net, net < 0 ? '−' : '+')}</span></div>`;
    }
    html += rowHtml(t);
  }
  if (list.length > shown.length) html += `<button class="btn ghost block" style="margin-top:12px" data-a="moreRows">แสดงเพิ่ม (${list.length - shown.length})</button>`;
  return html;
}

registerView('list', () => {
  const L = UI.list;
  const pending = D.tx.filter((t) => !t.catId).length;
  const allMonths = !!L.q.trim() || !!L.tripId || L.pending || !!L.year;
  const noFilter = !L.pending && !L.catId && !L.channelId && !L.tripId && !L.day && !L.year;
  const catOpts = [...catOptions('expense'), ...catOptions('income')];
  return `<div class="stack" style="gap:10px;padding-bottom:${L.selecting ? '80px' : '0'}">
    <div class="row" style="min-height:44px">
      ${L.selecting
        ? `<h1 class="h1" style="flex:1">เลือกแล้ว ${L.sel.size}</h1><button class="link" data-a="selAll">เลือกทั้งหมด</button><button class="link" data-a="selDone" style="color:var(--exp);font-weight:600">เสร็จ</button>`
        : `<h1 class="h1" style="flex:1">รายการ</h1><button class="link" data-a="selStart">เลือกหลายรายการ</button>`}
    </div>
    ${allMonths ? `<div class="small muted">${L.year ? `ทั้งปี ${esc(L.year)}` : 'ค้นหาทุกเดือน'}</div>` : `<div class="month-nav" style="min-height:36px">
      <button class="icon-btn plain" data-a="listMonth" data-v="-1" aria-label="เดือนก่อน">${svg(ICON.left)}</button>
      <h1 style="font-size:16px">${U.fmtMonth(L.month, true)}</h1>
      <button class="icon-btn plain" data-a="listMonth" data-v="1" aria-label="เดือนถัดไป">${svg(ICON.right)}</button></div>`}
    <label class="search">${svg(ICON.search, 18)}<span class="sr">ค้นหา</span>
      <input data-in="listQ" value="${esc(L.q)}" placeholder="ค้นหา เช่น grab, กาแฟ, 120" type="search" autocomplete="off" enterkeyhint="search">
    </label>
    <div class="chips">
      <button class="chip" data-a="listClear" aria-pressed="${noFilter}">ทั้งหมด</button>
      ${pending || L.pending ? `<button class="chip warn" data-a="listPending" aria-pressed="${L.pending}">รอจัดหมวด <b>${pending}</b></button>` : ''}
      ${L.year ? `<button class="chip" aria-pressed="true" data-a="listYearClear">ปี ${esc(L.year)} ✕</button>` : ''}
      ${L.day ? `<button class="chip" aria-pressed="true" data-a="listDayClear">${esc(U.fmtDate(L.day, false))} ✕</button>` : ''}
      <label class="chip has-select" aria-pressed="${!!L.catId}">${L.catId ? esc(catName(L.catId)) : 'หมวด'} ${svg(ICON.down, 14)}
        <select data-ch="listCat" aria-label="กรองหมวด">${optionsHtml(catOpts, L.catId, { none: 'ทุกหมวด' })}</select></label>
      <label class="chip has-select" aria-pressed="${!!L.channelId}">${L.channelId ? esc(S.channel(L.channelId)?.name || '') : 'ช่องทาง'} ${svg(ICON.down, 14)}
        <select data-ch="listChannel" aria-label="กรองช่องทาง">${optionsHtml(channelOptions(), L.channelId, { none: 'ทุกช่องทาง' })}</select></label>
      ${D.trips.length ? `<label class="chip has-select" aria-pressed="${!!L.tripId}">${L.tripId ? esc(tripName(L.tripId)) : 'ทริป'} ${svg(ICON.down, 14)}
        <select data-ch="listTrip" aria-label="กรองทริป">${optionsHtml(D.trips.map((t) => ({ value: t.id, label: t.name })), L.tripId, { none: 'ทุกทริป' })}</select></label>` : ''}
    </div>
    <div id="list-results">${resultsHtml()}</div>
  </div>
  ${L.selecting ? `<div class="select-bar">
    <label class="btn" ${L.sel.size ? '' : 'aria-disabled="true"'}>ย้ายหมวด<select data-ch="bulkCat" ${L.sel.size ? '' : 'disabled'} aria-label="ย้ายไปหมวด"><option value="">เลือกหมวด…</option>
      <optgroup label="รายจ่าย">${optionsHtml(catOptions('expense'), '')}</optgroup><optgroup label="รายรับ">${optionsHtml(catOptions('income'), '')}</optgroup></select></label>
    <label class="btn" ${L.sel.size ? '' : 'aria-disabled="true"'}>ช่องทาง<select data-ch="bulkChannel" ${L.sel.size ? '' : 'disabled'} aria-label="เปลี่ยนช่องทาง"><option value="">เลือกช่องทาง…</option>${optionsHtml(channelOptions(), '')}</select></label>
    <button class="btn danger" data-a="bulkDelete" ${L.sel.size ? '' : 'disabled'}>ลบ</button>
  </div>` : ''}`;
});

// ---------- ค้นหา/กรอง ----------
onInput('listQ', (el) => { UI.list.q = el.value; UI.list.limit = 300; document.getElementById('list-results').innerHTML = resultsHtml(); updateLock(); });
on('listMonth', (el) => { UI.list.month = U.addMonths(UI.list.month, Number(el.dataset.v)); UI.list.day = ''; render(); });
on('listClear', () => { Object.assign(UI.list, { pending: false, catId: '', channelId: '', tripId: '', day: '', year: '' }); render(); });
on('listYearClear', () => { UI.list.year = ''; render(); });
on('listPending', () => { UI.list.pending = !UI.list.pending; render(); });
on('listDayClear', () => { UI.list.day = ''; render(); });
on('moreRows', () => { UI.list.limit = (UI.list.limit || 300) + 300; render(); });
onChange('listCat', (el) => { UI.list.catId = el.value; UI.list.pending = false; render(); });
onChange('listChannel', (el) => { UI.list.channelId = el.value; render(); });
onChange('listTrip', (el) => { UI.list.tripId = el.value; render(); });

// ---------- เลือกหลายรายการ ----------
on('selStart', () => { UI.list.selecting = true; UI.list.sel = new Set(); UI.list.swiped = null; render(); });
on('selDone', () => { UI.list.selecting = false; UI.list.sel = new Set(); render(); });
on('selAll', () => { const ids = filtered().map((t) => t.id); const L = UI.list; L.sel = L.sel.size === ids.length ? new Set() : new Set(ids); render(); });
on('toggleSel', (el) => { const s = UI.list.sel; const id = el.dataset.id; if (s.has(id)) s.delete(id); else s.add(id); render(); });
onChange('bulkCat', async (el) => {
  const c = S.cat(el.value); if (!c) return;
  const list = D.tx.filter((t) => UI.list.sel.has(t.id));
  const ok = list.filter((t) => t.type === c.type);
  const skip = list.length - ok.length;
  if (!(await confirm('ย้ายหมวด', `ย้าย ${ok.length} รายการไปหมวด "${c.name}"${skip ? `\n(ข้าม ${skip} รายการที่เป็น${c.type === 'expense' ? 'รายรับ' : 'รายจ่าย'})` : ''}`, 'ย้าย'))) { render(); return; }
  ok.forEach((t) => { t.catId = c.id; t.subId = null; });
  await S.putTx(ok);
  UI.list.selecting = false; UI.list.sel = new Set();
  toast(`ย้าย ${ok.length} รายการแล้ว`); render();
});
onChange('bulkChannel', async (el) => {
  const ch = S.channel(el.value); if (!ch) return;
  const list = D.tx.filter((t) => UI.list.sel.has(t.id));
  list.forEach((t) => { t.channelId = ch.id; });
  await S.putTx(list);
  UI.list.selecting = false; UI.list.sel = new Set();
  toast(`เปลี่ยนช่องทาง ${list.length} รายการแล้ว`); render();
});
on('bulkDelete', async () => {
  const ids = [...UI.list.sel];
  if (!(await confirm(`ลบ ${ids.length} รายการ?`, 'ลบแล้วกู้คืนไม่ได้ ยกเว้นนำเข้าจากไฟล์ที่เคยส่งออกไว้', 'ลบ', true))) return;
  await S.deleteTx(ids);
  UI.list.selecting = false; UI.list.sel = new Set();
  toast(`ลบ ${ids.length} รายการแล้ว`); render();
});

// ---------- ลบ (ต้องยืนยันก่อนทุกครั้ง) ----------
export async function deleteWithConfirm(t) {
  const ok = await confirm('ลบรายการนี้?', `${txTitle(t)} · ${m(t.amount)} · ${U.fmtDate(t.date)}${t.planId ? '\n(งวดนี้จะหายจากรายการ แต่การ์ดผ่อนยังนับงวดตามตาราง)' : ''}`, 'ลบ', true);
  if (!ok) return false;
  const copy = { ...t };
  await S.deleteTx([t.id]);
  toast('ลบรายการแล้ว', { label: 'เลิกทำ', fn: async () => { await S.putTx(copy); toast('กู้คืนรายการแล้ว'); render(); } });
  return true;
}
on('swipeDelete', async (el) => {
  const t = D.tx.find((x) => x.id === el.dataset.id);
  UI.list.swiped = null;
  if (t) await deleteWithConfirm(t);
  render();
});

// ---------- ปัดซ้าย + กดค้าง ----------
async function duplicateToday(t) {
  const trip = S.activeTrip();
  const n = S.newTx({ type: t.type, amount: t.amount, catId: t.catId, subId: t.subId, channelId: t.channelId, note: t.planSeq ? txTitle(t) : t.note, date: U.today(), tripId: trip ? trip.id : null });
  await S.putTx(n);
  toast(`ลงซ้ำวันนี้แล้ว ${m(n.amount)}`, { label: 'เลิกทำ', fn: async () => { await S.deleteTx([n.id]); render(); } });
  render();
}
async function rowActions(t) {
  const r = await ask({ title: txTitle(t), body: `${m(t.amount)} · ${U.fmtDate(t.date)}`, vertical: true, buttons: [
    { label: 'ลงซ้ำวันนี้', value: 'dup', kind: 'primary' }, { label: 'แก้ไข', value: 'edit' }, { label: 'ลบ', value: 'del', kind: 'danger' }, { label: 'ยกเลิก', value: false },
  ] });
  if (r.value === 'dup') await duplicateToday(t);
  else if (r.value === 'edit') openTxSheet(t);
  else if (r.value === 'del') { await deleteWithConfirm(t); render(); }
}

let touch = null;
document.addEventListener('touchstart', (ev) => {
  const main = ev.target.closest('.txrow .main');
  if (!main || UI.list.selecting) { touch = null; return; }
  const id = main.dataset.id;
  const p = ev.touches[0];
  touch = { id, main, x: p.clientX, y: p.clientY, dx: 0, mode: null, timer: null };
  touch.timer = setTimeout(() => {
    if (!touch || touch.mode) return;
    touch.mode = 'long';
    suppressNextClick();
    navigator.vibrate?.(10);
    const t = D.tx.find((x) => x.id === id);
    if (t) rowActions(t);
  }, 520);
}, { passive: true });
document.addEventListener('touchmove', (ev) => {
  if (!touch) return;
  const p = ev.touches[0];
  const dx = p.clientX - touch.x; const dy = p.clientY - touch.y;
  if (!touch.mode && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    clearTimeout(touch.timer);
    touch.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll';
  }
  if (touch.mode === 'swipe') {
    const base = UI.list.swiped === touch.id ? -84 : 0;
    touch.dx = Math.min(0, Math.max(-110, base + dx));
    touch.main.style.transition = 'none';
    touch.main.style.transform = `translateX(${touch.dx}px)`;
  }
}, { passive: true });
document.addEventListener('touchend', () => {
  if (!touch) return;
  clearTimeout(touch.timer);
  if (touch.mode === 'swipe') {
    suppressNextClick();
    UI.list.swiped = touch.dx < -50 ? touch.id : null;
    render();
  }
  touch = null;
});

on('openTx', (el) => {
  if (UI.list.swiped) { UI.list.swiped = null; render(); return; }
  const t = D.tx.find((x) => x.id === el.dataset.id);
  if (t) openTxSheet(t);
});

// ---------- แผ่นแก้ไขรายการ ----------
export function openTxSheet(t) { openSheet('txEdit', { t: { ...t }, amountStr: String(t.amount) }); }

registerSheet('txEdit', (st) => {
  const t = st.t;
  const p = t.planId && S.plan(t.planId);
  const amt = parseFloat(st.amountStr);
  return `<div class="sheet full">
    ${sheetHead('แก้ไขรายการ', { left: 'ยกเลิก', right: 'บันทึก', rightA: 'txSave', rightDisabled: !(amt > 0) })}
    <div class="sheet-body">
      ${t.planSeq ? `<div class="chip info" style="align-self:flex-start">${p ? esc(p.name) : esc(t.planName || '')} · ${t.planSeq === 'ปิดยอด' ? 'ปิดยอด' : 'งวด ' + esc(t.planSeq)}</div>` : ''}
      ${t.recurId ? '<div class="chip" style="align-self:flex-start">ลงอัตโนมัติจากรายการประจำ</div>' : ''}
      <div class="seg type" role="group" aria-label="ประเภท">
        <button data-a="txType" data-v="expense" aria-pressed="${t.type === 'expense'}">รายจ่าย</button>
        <button data-a="txType" data-v="income" aria-pressed="${t.type === 'income'}">รายรับ</button>
      </div>
      <div class="group">
        <label class="cell"><span class="lbl">ยอด (บาท)</span><input data-in="txAmount" inputmode="decimal" value="${esc(st.amountStr)}" style="font-weight:600"></label>
        <label class="cell"><span class="lbl">หมวด</span><select data-ch="txCat">${optionsHtml(catOptions(t.type, t.catId), t.catId || '', { none: 'รอจัดหมวด' })}</select></label>
        ${t.catId && subOptions(t.catId).length ? `<label class="cell"><span class="lbl">หมวดย่อย</span><select data-ch="txSub">${optionsHtml(subOptions(t.catId, t.subId), t.subId || '', { none: 'ไม่ระบุ' })}</select></label>` : ''}
        <label class="cell"><span class="lbl">ช่องทาง</span><select data-ch="txChannel">${optionsHtml(channelOptions(), t.channelId || '', { none: 'ไม่ระบุ' })}</select></label>
        <label class="cell"><span class="lbl">วันที่</span><input type="date" data-ch="txDate" value="${t.date}"></label>
        <label class="cell"><span class="lbl">โน้ต</span><input data-in="txNote" value="${esc(t.note)}" placeholder="ไม่บังคับ"></label>
        <label class="cell"><span class="lbl">ทริป</span><select data-ch="txTrip">${optionsHtml(D.trips.map((x) => ({ value: x.id, label: x.name })), t.tripId || '', { none: 'ไม่อยู่ในทริป' })}</select></label>
      </div>
      <button class="btn block" data-a="txDup">ลงซ้ำวันนี้</button>
      <button class="btn block ghost" data-a="txDelete" style="color:var(--danger-text)">ลบรายการนี้</button>
    </div>
  </div>`;
});
on('txType', (el) => { const st = UI.sheet; if (st.t.type === el.dataset.v) return; st.t.type = el.dataset.v; st.t.catId = null; st.t.subId = null; renderSheet(); });
onInput('txAmount', (el) => {
  UI.sheet.amountStr = el.value.replace(/,/g, '');
  const ok = parseFloat(UI.sheet.amountStr) > 0;
  const b = document.querySelector('[data-a="txSave"]'); if (b) b.disabled = !ok;
});
onInput('txNote', (el) => { UI.sheet.t.note = el.value; });
onChange('txCat', (el) => { UI.sheet.t.catId = el.value || null; UI.sheet.t.subId = null; renderSheet(); });
onChange('txSub', (el) => { UI.sheet.t.subId = el.value || null; });
onChange('txChannel', (el) => { UI.sheet.t.channelId = el.value || null; });
onChange('txDate', (el) => { if (el.value) UI.sheet.t.date = el.value; });
onChange('txTrip', (el) => { UI.sheet.t.tripId = el.value || null; });
on('txSave', async () => {
  const st = UI.sheet;
  const amt = U.round2(parseFloat(st.amountStr));
  if (!(amt > 0)) return;
  st.t.amount = amt; st.t.note = st.t.note.trim();
  await S.putTx(st.t);
  toast('บันทึกการแก้ไขแล้ว');
  closeSheet();
});
on('txDup', async () => { const t = UI.sheet.t; UI.sheet = null; renderSheet(); await duplicateToday(t); });
on('txDelete', async () => {
  const t = D.tx.find((x) => x.id === UI.sheet.t.id);
  if (t && await deleteWithConfirm(t)) closeSheet();
});
afterRender(() => {});
