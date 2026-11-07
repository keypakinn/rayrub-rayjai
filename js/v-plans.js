// หน้าผ่อน + รายการประจำ
import * as S from './store.js';
import { D } from './store.js';
import * as U from './util.js';
import { esc } from './util.js';
import { UI, on, onInput, onChange, registerView, registerSheet, render, renderSheet, openSheet, closeSheet, sheetHead, toast, ask, confirm, m, optionsHtml } from './ui.js';
import { catName, catOptions, subOptions, channelOptions } from './common.js';

registerView('plans', () => {
  const td = U.today();
  const cur = U.thisMonth();
  const plans = [...D.plans].sort((a, b) => a.createdAt - b.createdAt);
  const stats = plans.map((p) => ({ p, s: S.planStats(p, td) }));
  const active = stats.filter((x) => !x.s.done);
  const done = stats.filter((x) => x.s.done);
  const burden = D.plans.reduce((a, p) => a + p.schedule.filter((s) => s.date.slice(0, 7) === cur).reduce((x, s) => x + s.amount, 0), 0);
  const notices = active.filter(({ s }) => s.endDate && s.endDate.slice(0, 7) <= U.addMonths(cur, 1))
    .map(({ p, s }) => `${esc(p.name)} งวดสุดท้าย ${U.fmtMonth(s.endDate.slice(0, 7))} · ${U.fmtMonth(U.addMonths(s.endDate.slice(0, 7), 1))} ภาระลดลง ${m(p.schedule[p.schedule.length - 1].amount)}/เดือน`);
  const rec = [...D.recurring].sort((a, b) => (a.type === b.type ? a.day - b.day : a.type === 'income' ? -1 : 1));

  return `<div class="stack" style="gap:12px">
    <div class="row" style="min-height:44px"><h1 class="h1" style="flex:1">ผ่อน</h1>
      <button class="btn primary" style="height:40px;border-radius:20px;font-size:14px" data-a="newPlan">+ เพิ่มรายการผ่อน</button></div>
    <section class="card stack" style="gap:4px">
      <span class="small muted">ภาระผ่อนเดือนนี้</span>
      <span style="font-size:28px;font-weight:600">${m(burden)}</span>
      ${notices.map((n) => `<span class="small money-inc">${n}</span>`).join('')}
    </section>
    ${active.length ? active.map(({ p, s }) => `<button class="plan" data-a="openPlan" data-id="${p.id}">
      <span class="top"><span class="name">${esc(p.name)}</span><span style="font-weight:600">${m(s.next ? s.next.amount : p.schedule[0].amount)}<span class="small muted"> /งวด</span></span></span>
      <span class="small muted">${esc([catName(p.catId, ''), S.channel(p.channelId)?.name || '', `ทุกวันที่ ${p.day}`].filter(Boolean).join(' · '))}</span>
      <span class="bar" style="width:100%"><span style="width:${Math.round((s.paid / s.total) * 100)}%"></span></span>
      <span class="foot"><span>จ่ายแล้ว <b>${s.paid}/${s.total}</b></span><span class="muted">เหลือ ${m(s.left)} · จบ ${U.fmtMonth(s.endDate.slice(0, 7))}</span></span>
    </button>`).join('') : '<div class="empty" style="padding:16px">ยังไม่มีรายการผ่อน</div>'}
    ${done.length ? `<div class="section-title">ผ่อนครบแล้ว</div><div class="group">${done.map(({ p, s }) => `<button class="cell" data-a="openPlan" data-id="${p.id}"><span style="flex:1">${esc(p.name)}</span><span class="val">${s.total} งวด${p.closedAt ? ' · ปิดยอด' : ''}</span><span class="chev">›</span></button>`).join('')}</div>` : ''}

    <div class="row" style="padding-top:8px"><h2 class="h2" style="flex:1">รายการประจำ</h2><button class="link" data-a="newRecurring">+ เพิ่ม</button></div>
    ${rec.length ? `<div class="group">${rec.map((r) => {
      const next = r.active ? S.nextRecurringDate(r) : null;
      return `<button class="cell" data-a="openRecurring" data-id="${r.id}" style="${r.active ? '' : 'opacity:.55'}">
        <span style="flex:1;display:flex;flex-direction:column;min-width:0"><span>${esc(r.name)}</span>
          <span class="small muted">${esc([catName(r.catId, r.type === 'income' ? 'รายรับ' : 'รอจัดหมวด'), S.channel(r.channelId)?.name || '', `ทุกวันที่ ${r.day}`, r.active ? (next ? `ถัดไป ${U.fmtDate(next, false)}` : '') : 'หยุดอยู่'].filter(Boolean).join(' · '))}</span></span>
        <span style="font-weight:600" class="${r.type === 'income' ? 'money-inc' : ''}">${m(r.amount, r.type === 'income' ? '+' : '−')}</span></button>`;
    }).join('')}</div>` : '<div class="small muted" style="padding:0 2px">เช่น ค่าเน็ต ค่ามือถือ เงินเดือน แอปจะลงให้เองเมื่อถึงวัน (ตอนเปิดแอป)</div>'}
  </div>`;
});

// ---------- สร้างรายการผ่อน ----------
on('newPlan', () => openSheet('planForm', {
  name: '', note: '', mode: 'per', amountStr: '', count: 10, firstDate: U.today(), catId: null, subId: null,
  channelId: D.settings.planChannelId || D.settings.defaultChannelId,
}));

function planPreview(st) {
  const amount = parseFloat(st.amountStr);
  if (!(amount > 0) || !(st.count >= 1) || !st.firstDate) return '<div class="preview muted">กรอกยอดและจำนวนงวดเพื่อดูตัวอย่าง</div>';
  const sch = S.buildSchedule({ mode: st.mode, amount, count: st.count, firstDate: st.firstDate });
  const total = sch.reduce((a, s) => a + s.amount, 0);
  const rows = sch.length <= 5 ? sch.map((s, i) => [s, i]) : [[sch[0], 0], [sch[1], 1], [sch[2], 2], null, [sch[sch.length - 1], sch.length - 1]];
  return `<div class="preview"><b style="color:var(--text)">จะสร้างรายจ่าย ${sch.length} รายการ</b>
    ${rows.map((r) => (r ? `<div><span>${U.fmtDate(r[0].date)}</span><span>งวด ${r[1] + 1}/${sch.length}</span><span>${m(r[0].amount)}</span></div>` : '<div><span>…</span></div>')).join('')}
    <div style="border-top:1px solid var(--line);padding-top:6px;color:var(--text);font-weight:600"><span>รวม</span><span>${m(total)}</span></div>
    <span class="small muted">เดือนที่ไม่มีวันที่ตรงกัน จะลงวันสุดท้ายของเดือนนั้นแทน</span></div>`;
}
registerSheet('planForm', (st) => {
  const ok = st.name.trim() && parseFloat(st.amountStr) > 0 && st.count >= 1 && st.firstDate;
  return `<div class="sheet full">
    ${sheetHead('รายการผ่อนใหม่', { left: 'ยกเลิก', right: 'บันทึก', rightA: 'planSave', rightDisabled: !ok })}
    <div class="sheet-body">
      <div class="group">
        <label class="cell"><span class="lbl">ชื่อรายการ</span><input data-in="pf" data-f="name" value="${esc(st.name)}" placeholder="เช่น iPhone 17"></label>
        <label class="cell"><span class="lbl">โน้ต</span><input data-in="pf" data-f="note" value="${esc(st.note)}" placeholder="ไม่บังคับ เช่น ค่าผ่อนมือถือ"></label>
        <div class="cell"><div class="seg" style="flex:1;background:var(--bg)">
          <button data-a="pfMode" data-v="per" aria-pressed="${st.mode === 'per'}">ยอดต่องวด</button>
          <button data-a="pfMode" data-v="total" aria-pressed="${st.mode === 'total'}">ยอดรวม</button></div></div>
        <label class="cell"><span class="lbl">${st.mode === 'per' ? 'ยอดต่องวด' : 'ยอดรวม'} (บาท)</span><input data-in="pf" data-f="amountStr" inputmode="decimal" value="${esc(st.amountStr)}" placeholder="0" style="font-weight:600"></label>
        <div class="cell"><span class="lbl" style="flex:1">จำนวนงวด</span>
          <button class="icon-btn" data-a="pfCount" data-v="-1" aria-label="ลดจำนวนงวด" style="border-radius:10px;width:44px;height:36px">−</button>
          <input data-in="pf" data-f="count" inputmode="numeric" value="${st.count}" style="flex:none;width:48px;text-align:center;font-weight:600" aria-label="จำนวนงวด">
          <button class="icon-btn" data-a="pfCount" data-v="1" aria-label="เพิ่มจำนวนงวด" style="border-radius:10px;width:44px;height:36px">+</button></div>
        <label class="cell"><span class="lbl">วันที่งวดแรก</span><input type="date" data-ch="pfDate" value="${st.firstDate}"></label>
      </div>
      <div class="group">
        <label class="cell"><span class="lbl">หมวด</span><select data-ch="pfCat">${optionsHtml(catOptions('expense'), st.catId || '', { none: 'รอจัดหมวด' })}</select></label>
        ${st.catId && subOptions(st.catId).length ? `<label class="cell"><span class="lbl">หมวดย่อย</span><select data-ch="pfSub">${optionsHtml(subOptions(st.catId), st.subId || '', { none: 'ไม่ระบุ' })}</select></label>` : ''}
        <label class="cell"><span class="lbl">ช่องทาง</span><select data-ch="pfChannel">${optionsHtml(channelOptions(), st.channelId || '', { none: 'ไม่ระบุ' })}</select></label>
      </div>
      <div id="pf-preview">${planPreview(st)}</div>
    </div></div>`;
});
function pfRefresh() {
  const st = UI.sheet;
  const pv = document.getElementById('pf-preview'); if (pv) pv.innerHTML = planPreview(st);
  const ok = st.name.trim() && parseFloat(st.amountStr) > 0 && st.count >= 1 && st.firstDate;
  const b = document.querySelector('[data-a="planSave"]'); if (b) b.disabled = !ok;
}
onInput('pf', (el) => {
  const f = el.dataset.f;
  if (f === 'count') UI.sheet.count = Math.min(120, Math.max(0, parseInt(el.value, 10) || 0));
  else if (f === 'amountStr') UI.sheet.amountStr = el.value.replace(/,/g, '');
  else UI.sheet[f] = el.value;
  pfRefresh();
});
on('pfMode', (el) => { UI.sheet.mode = el.dataset.v; renderSheet(); });
on('pfCount', (el) => { UI.sheet.count = Math.min(120, Math.max(1, (UI.sheet.count || 0) + Number(el.dataset.v))); renderSheet(); });
onChange('pfDate', (el) => { if (el.value) { UI.sheet.firstDate = el.value; pfRefresh(); } });
onChange('pfCat', (el) => { UI.sheet.catId = el.value || null; UI.sheet.subId = null; renderSheet(); });
onChange('pfSub', (el) => { UI.sheet.subId = el.value || null; });
onChange('pfChannel', (el) => { UI.sheet.channelId = el.value || null; });
on('planSave', async () => {
  const st = UI.sheet;
  const amount = parseFloat(st.amountStr);
  if (!st.name.trim() || !(amount > 0) || !(st.count >= 1)) return;
  const p = await S.createPlan({ name: st.name.trim(), note: st.note.trim(), mode: st.mode, amount, count: st.count, firstDate: st.firstDate, catId: st.catId, subId: st.subId, channelId: st.channelId });
  toast(`สร้าง ${p.schedule.length} งวดแล้ว`);
  closeSheet();
});

// ---------- รายละเอียดรายการผ่อน ----------
on('openPlan', (el) => openSheet('planDetail', { id: el.dataset.id }));
registerSheet('planDetail', (st) => {
  const p = S.plan(st.id);
  if (!p) return '<div class="sheet">' + sheetHead('ไม่พบรายการ') + '</div>';
  const td = U.today();
  const s = S.planStats(p, td);
  return `<div class="sheet full">
    ${sheetHead(p.name)}
    <div class="sheet-body">
      <section class="card stack" style="gap:6px">
        <div class="row" style="justify-content:space-between"><span class="muted small">จ่ายแล้ว ${s.paid}/${s.total} งวด</span><span class="muted small">${esc([catName(p.catId, ''), S.channel(p.channelId)?.name || ''].filter(Boolean).join(' · '))}</span></div>
        <div class="bar"><span style="width:${Math.round((s.paid / s.total) * 100)}%"></span></div>
        <div class="row" style="justify-content:space-between"><span>เหลือ <b>${m(s.left)}</b></span><span class="muted">จบ ${U.fmtDate(s.endDate)}</span></div>
      </section>
      <div class="group">${p.schedule.map((x, i) => `<div class="cell" style="min-height:44px">
        <span style="width:58px" class="small muted">${x.payoff ? 'ปิดยอด' : `งวด ${i + 1}`}</span>
        <span style="flex:1">${U.fmtDate(x.date)}</span>
        <span style="font-weight:600">${m(x.amount)}</span>
        <span class="small ${x.date <= td ? 'money-inc' : 'muted'}" style="width:52px;text-align:right">${x.date <= td ? 'จ่ายแล้ว' : 'รอ'}</span></div>`).join('')}</div>
      ${!s.done ? `<button class="btn block" data-a="planEdit">แก้ไขงวดที่ยังไม่ถึง</button>
      <button class="btn block" data-a="planPayoff">ปิดยอดก่อนกำหนด</button>` : ''}
      <button class="btn block ghost" data-a="planDelete" style="color:var(--danger-text)">ลบรายการผ่อน</button>
    </div></div>`;
});
on('planEdit', () => {
  const p = S.plan(UI.sheet.id);
  const s = S.planStats(p);
  openSheet('planEdit', { id: p.id, name: p.name, note: p.note || '', amountStr: String(s.next ? s.next.amount : ''), catId: p.catId, subId: p.subId, channelId: p.channelId });
});
registerSheet('planEdit', (st) => `<div class="sheet full">
  ${sheetHead('แก้ไขงวดที่ยังไม่ถึง', { left: 'ยกเลิก', leftA: 'planEditBack', right: 'บันทึก', rightA: 'planEditSave' })}
  <div class="sheet-body">
    <p class="small muted">มีผลเฉพาะงวดที่ยังไม่ถึงวัน งวดที่ผ่านไปแล้วไม่เปลี่ยน</p>
    <div class="group">
      <label class="cell"><span class="lbl">ชื่อรายการ</span><input data-in="pe" data-f="name" value="${esc(st.name)}"></label>
      <label class="cell"><span class="lbl">โน้ต</span><input data-in="pe" data-f="note" value="${esc(st.note)}" placeholder="ไม่บังคับ"></label>
      <label class="cell"><span class="lbl">ยอดต่องวด (บาท)</span><input data-in="pe" data-f="amountStr" inputmode="decimal" value="${esc(st.amountStr)}" style="font-weight:600"></label>
      <label class="cell"><span class="lbl">หมวด</span><select data-ch="peCat">${optionsHtml(catOptions('expense', st.catId), st.catId || '', { none: 'รอจัดหมวด' })}</select></label>
      ${st.catId && subOptions(st.catId).length ? `<label class="cell"><span class="lbl">หมวดย่อย</span><select data-ch="peSub">${optionsHtml(subOptions(st.catId, st.subId), st.subId || '', { none: 'ไม่ระบุ' })}</select></label>` : ''}
      <label class="cell"><span class="lbl">ช่องทาง</span><select data-ch="peChannel">${optionsHtml(channelOptions(), st.channelId || '', { none: 'ไม่ระบุ' })}</select></label>
    </div></div></div>`);
onInput('pe', (el) => { UI.sheet[el.dataset.f] = el.value; });
onChange('peCat', (el) => { UI.sheet.catId = el.value || null; UI.sheet.subId = null; renderSheet(); });
onChange('peSub', (el) => { UI.sheet.subId = el.value || null; });
onChange('peChannel', (el) => { UI.sheet.channelId = el.value || null; });
on('planEditBack', () => openSheet('planDetail', { id: UI.sheet.id }));
on('planEditSave', async () => {
  const st = UI.sheet;
  const p = S.plan(st.id);
  const amount = parseFloat(String(st.amountStr).replace(/,/g, ''));
  if (!st.name.trim()) return;
  await S.editPlanFuture(p, { name: st.name.trim(), note: (st.note || '').trim(), amount: amount > 0 ? amount : null, catId: st.catId, subId: st.subId, channelId: st.channelId });
  toast('แก้ไขงวดที่เหลือแล้ว');
  openSheet('planDetail', { id: p.id });
});
on('planPayoff', async () => {
  const p = S.plan(UI.sheet.id);
  const s = S.planStats(p);
  const r = await ask({ title: 'ปิดยอดก่อนกำหนด', body: `ลบ ${s.total - s.paid} งวดที่ยังไม่ถึง แล้วลงรายการ "ปิดยอด" วันนี้ 1 รายการ\nกรอกยอดที่จ่ายจริง`, input: { value: String(s.left), inputmode: 'decimal' }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'ปิดยอด', value: true, kind: 'primary' }] });
  if (!r.value) return;
  const amt = parseFloat(String(r.input).replace(/,/g, ''));
  if (!(amt > 0)) { toast('ยอดไม่ถูกต้อง'); return; }
  await S.closePlanEarly(p, amt);
  toast(`ปิดยอด ${p.name} แล้ว`);
  renderSheet(); render();
});
on('planDelete', async () => {
  const p = S.plan(UI.sheet.id);
  const n = D.tx.filter((t) => t.planId === p.id).length;
  if (!(await confirm(`ลบ "${p.name}"?`, `ลบทุกงวด ${n} รายการ (รวมงวดที่จ่ายแล้ว)`, 'ลบ', true))) return;
  await S.deletePlan(p);
  toast('ลบรายการผ่อนแล้ว');
  closeSheet();
});

// ---------- รายการประจำ ----------
on('newRecurring', () => openSheet('recForm', { id: null, name: '', type: 'expense', amountStr: '', day: Number(U.today().slice(8, 10)), catId: null, subId: null, channelId: D.settings.defaultChannelId, startMonth: U.thisMonth(), active: true }));
on('openRecurring', (el) => {
  const r = D.recurring.find((x) => x.id === el.dataset.id);
  openSheet('recForm', { ...r, amountStr: String(r.amount) });
});
registerSheet('recForm', (st) => {
  const ok = st.name.trim() && parseFloat(st.amountStr) > 0;
  return `<div class="sheet full">
    ${sheetHead(st.id ? 'แก้ไขรายการประจำ' : 'รายการประจำใหม่', { left: 'ยกเลิก', right: 'บันทึก', rightA: 'recSave', rightDisabled: !ok })}
    <div class="sheet-body">
      <div class="seg type" role="group" aria-label="ประเภท">
        <button data-a="rfType" data-v="expense" aria-pressed="${st.type === 'expense'}">รายจ่าย</button>
        <button data-a="rfType" data-v="income" aria-pressed="${st.type === 'income'}">รายรับ</button></div>
      <div class="group">
        <label class="cell"><span class="lbl">ชื่อ</span><input data-in="rf" data-f="name" value="${esc(st.name)}" placeholder="เช่น ค่าเน็ตบ้าน"></label>
        <label class="cell"><span class="lbl">ยอด (บาท)</span><input data-in="rf" data-f="amountStr" inputmode="decimal" value="${esc(st.amountStr)}" style="font-weight:600"></label>
        <label class="cell"><span class="lbl">ทุกวันที่</span><select data-ch="rfDay">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${st.day === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
        <label class="cell"><span class="lbl">เริ่มเดือน</span><input type="month" data-ch="rfStart" value="${st.startMonth}"></label>
      </div>
      <div class="group">
        <label class="cell"><span class="lbl">หมวด</span><select data-ch="rfCat">${optionsHtml(catOptions(st.type, st.catId), st.catId || '', { none: 'รอจัดหมวด' })}</select></label>
        ${st.catId && subOptions(st.catId).length ? `<label class="cell"><span class="lbl">หมวดย่อย</span><select data-ch="rfSub">${optionsHtml(subOptions(st.catId, st.subId), st.subId || '', { none: 'ไม่ระบุ' })}</select></label>` : ''}
        <label class="cell"><span class="lbl">ช่องทาง</span><select data-ch="rfChannel">${optionsHtml(channelOptions(), st.channelId || '', { none: 'ไม่ระบุ' })}</select></label>
      </div>
      <p class="small muted">แอปจะลงรายการให้เมื่อถึงวัน (ตอนเปิดแอป) เดือนที่ไม่ได้เปิดแอปจะลงย้อนหลังให้ครบ ถ้าเดือนนั้นไม่มีวันที่ที่เลือก จะลงวันสุดท้ายของเดือน</p>
      ${st.id ? `<div class="group"><div class="cell"><span style="flex:1">เปิดใช้งาน</span><button class="switch" role="switch" aria-checked="${st.active}" data-a="rfActive" aria-label="เปิดใช้งาน"><span></span></button></div></div>
        <button class="btn block ghost" data-a="recDelete" style="color:var(--danger-text)">ลบรายการประจำ</button>
        <p class="small muted">ลบแล้ว รายการที่ลงไปแล้วยังอยู่</p>` : ''}
    </div></div>`;
});
onInput('rf', (el) => {
  UI.sheet[el.dataset.f] = el.dataset.f === 'amountStr' ? el.value.replace(/,/g, '') : el.value;
  const ok = UI.sheet.name.trim() && parseFloat(UI.sheet.amountStr) > 0;
  const b = document.querySelector('[data-a="recSave"]'); if (b) b.disabled = !ok;
});
on('rfType', (el) => { if (UI.sheet.type === el.dataset.v) return; UI.sheet.type = el.dataset.v; UI.sheet.catId = null; UI.sheet.subId = null; renderSheet(); });
onChange('rfDay', (el) => { UI.sheet.day = Number(el.value); });
onChange('rfStart', (el) => { if (el.value) UI.sheet.startMonth = el.value; });
onChange('rfCat', (el) => { UI.sheet.catId = el.value || null; UI.sheet.subId = null; renderSheet(); });
onChange('rfSub', (el) => { UI.sheet.subId = el.value || null; });
onChange('rfChannel', (el) => { UI.sheet.channelId = el.value || null; });
on('rfActive', () => { UI.sheet.active = !UI.sheet.active; renderSheet(); });
on('recSave', async () => {
  const st = UI.sheet;
  const amount = U.round2(parseFloat(st.amountStr));
  if (!st.name.trim() || !(amount > 0)) return;
  const old = st.id ? D.recurring.find((x) => x.id === st.id) : null;
  if (!old && st.startMonth <= U.thisMonth() && U.clampDate(st.startMonth, st.day) <= U.today()) {
    const months = U.monthDiff(st.startMonth, U.thisMonth()) + 1;
    const r0 = await ask({ title: 'ลงของที่ผ่านมาด้วยไหม?', body: `วันที่ ${st.day} ${months > 1 ? `ของ ${months} เดือนที่ผ่านมา` : 'ของเดือนนี้'}ผ่านมาแล้ว ถ้าคุณบันทึกเองไปแล้ว เลือก "เริ่มเดือนหน้า"`, buttons: [{ label: 'เริ่มเดือนหน้า', value: 'next' }, { label: 'ลงให้ด้วย', value: 'now', kind: 'primary' }] });
    if (!r0.value) return;
    if (r0.value === 'next') st.startMonth = U.addMonths(U.thisMonth(), 1);
  }
  const r = {
    id: st.id || U.uid('r'), name: st.name.trim(), type: st.type, amount, day: st.day, catId: st.catId, subId: st.subId,
    channelId: st.channelId, startMonth: st.startMonth, active: st.active, generated: old ? old.generated : [],
  };
  const before = D.tx.length;
  await S.putRecurring(r);
  const added = D.tx.length - before;
  toast(added ? `บันทึกแล้ว · ลงรายการที่ถึงกำหนดให้ ${added} รายการ` : 'บันทึกรายการประจำแล้ว');
  closeSheet();
});
on('recDelete', async () => {
  if (!(await confirm('ลบรายการประจำ?', 'รายการที่ลงไปแล้วยังอยู่ แอปจะหยุดลงให้ใหม่', 'ลบ', true))) return;
  await S.deleteRecurring(UI.sheet.id);
  toast('ลบรายการประจำแล้ว');
  closeSheet();
});
