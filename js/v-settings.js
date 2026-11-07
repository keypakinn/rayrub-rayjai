// หน้าตั้งค่า + แผ่นจัดการหมวด/ช่องทาง/โปรด/ทริป + ส่งออก/นำเข้า/ล้างประวัติ
import * as S from './store.js';
import { D } from './store.js';
import * as U from './util.js';
import { esc } from './util.js';
import { UI, on, onInput, onChange, registerView, registerSheet, render, renderSheet, openSheet, closeSheet, sheetHead, toast, ask, confirm, m, svg, ICON, goTab, optionsHtml } from './ui.js';
import { catName, isStandalone } from './common.js';
import * as X from './excel.js';

export const APP_VERSION = '1.2.0';

registerView('settings', () => {
  const st = D.settings;
  const trip = S.activeTrip();
  const nExp = S.topCats('expense', true).length; const nInc = S.topCats('income', true).length;
  return `<div class="stack" style="gap:12px">
    <h1 class="h1" style="min-height:44px;display:flex;align-items:center">ตั้งค่า</h1>
    ${UI.updateWorker ? `<button class="cell" data-a="applyUpdate" style="border:1px solid #23406A;border-radius:14px;background:var(--inc-soft);color:var(--inc-text)"><span style="flex:1">มีเวอร์ชันใหม่ แตะเพื่ออัปเดต · ข้อมูลเดิมไม่หาย</span><span>›</span></button>` : ''}
    ${!isStandalone() ? `<button class="cell" data-a="installHelp" style="border-radius:14px;background:var(--exp-soft);color:var(--exp-text)"><span style="flex:1">ยังไม่ได้เพิ่มลงหน้าจอโฮม · ข้อมูลอาจถูก Safari ลบ</span><span>›</span></button>` : ''}
    <div class="section-title">การบันทึก</div>
    <div class="group">
      <button class="cell" data-a="openCats"><span style="flex:1">หมวดหมู่</span><span class="val">รายจ่าย ${nExp} · รายรับ ${nInc}</span><span class="chev">›</span></button>
      <button class="cell" data-a="openChannels"><span style="flex:1">ช่องทางจ่าย</span><span class="val">${esc(S.sortedChannels().map((c) => c.name).join(' · '))}</span><span class="chev">›</span></button>
      <button class="cell" data-a="openFavs"><span style="flex:1">รายการโปรด</span><span class="val">${D.favs.length} รายการ</span><span class="chev">›</span></button>
      <button class="cell" data-a="setTarget"><span style="flex:1">เป้าใช้จ่ายต่อเดือน</span><span class="val">${st.target ? m(st.target) : 'ไม่ตั้ง'}</span><span class="chev">›</span></button>
      <div class="cell" style="min-height:60px"><span style="flex:1;display:flex;flex-direction:column"><span>โหมดทริป</span>
        <span class="small muted">${trip ? `กำลังเที่ยว: ${esc(trip.name)}` : 'ทุกรายการที่บันทึกจะติดชื่อทริปจนกว่าจะปิด'}</span></span>
        <button class="switch" role="switch" aria-checked="${!!trip}" data-a="toggleTrip" aria-label="โหมดทริป"><span></span></button></div>
      ${D.trips.length ? `<button class="cell" data-a="openTrips"><span style="flex:1">ทริปทั้งหมด</span><span class="val">${D.trips.length} ทริป</span><span class="chev">›</span></button>` : ''}
    </div>
    <div class="section-title">ข้อมูล</div>
    <div class="group">
      <button class="cell" data-a="openExport"><span style="flex:1">ส่งออก</span><span class="val">Excel · CSV</span><span class="chev">›</span></button>
      <button class="cell" data-a="openImport"><span style="flex:1">นำเข้าจากไฟล์</span><span class="chev">›</span></button>
      <button class="cell" data-a="openClear"><span style="flex:1">ล้างประวัติ</span><span class="val">เลือกช่วงที่จะลบ</span><span class="chev">›</span></button>
    </div>
    <div class="group"><button class="cell danger" data-a="resetAll">รีเซ็ตแอปทั้งหมด</button></div>
    <p class="small muted" style="text-align:center" id="storage-info">ข้อมูลเก็บในเครื่องนี้เท่านั้น · ${D.tx.length.toLocaleString()} รายการ · เวอร์ชัน ${APP_VERSION}</p>
  </div>`;
});

// แสดงพื้นที่ที่ใช้และสถานะเก็บถาวร
async function storageInfo() {
  const el = document.getElementById('storage-info');
  if (!el || !navigator.storage?.estimate) return;
  const est = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const mb = (est.usage || 0) / 1048576;
  el.textContent = `ข้อมูลเก็บในเครื่องนี้เท่านั้น · ${D.tx.length.toLocaleString()} รายการ · ใช้พื้นที่ราว ${mb < 0.1 ? '<0.1' : mb.toFixed(1)} MB${persisted ? ' · เก็บถาวร' : ''} · เวอร์ชัน ${APP_VERSION}`;
}
on('openSettingsInfo', storageInfo);
export function settingsAfterRender() { if (UI.tab === 'settings') storageInfo(); }

on('applyUpdate', () => { if (UI.updateWorker) UI.updateWorker.postMessage('skipWaiting'); });

on('setTarget', async () => {
  const r = await ask({ title: 'เป้าใช้จ่ายต่อเดือน', body: 'เว้นว่างเพื่อไม่ตั้งเป้า', input: { value: D.settings.target ? String(D.settings.target) : '', inputmode: 'decimal', placeholder: 'เช่น 25000' }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'บันทึก', value: true, kind: 'primary' }] });
  if (!r.value) return;
  const v = parseFloat(String(r.input).replace(/,/g, ''));
  await S.saveSettings({ target: v > 0 ? U.round2(v) : null });
  render();
});

// ---------- โหมดทริป ----------
async function askTripName(initial, exceptId = null) {
  let name = initial;
  for (;;) {
    const r = await ask({ title: exceptId ? 'แก้ชื่อทริป' : 'ชื่อทริป', body: 'ใส่ปีหรือเดือนด้วย จะได้ไม่ซ้ำกับทริปเก่า', input: { value: name, maxlength: 40 }, buttons: [{ label: 'ยกเลิก', value: false }, { label: exceptId ? 'บันทึก' : 'เริ่มทริป', value: true, kind: 'primary' }] });
    if (!r.value) return null;
    name = r.input.trim();
    if (!name) continue;
    if (S.tripNameTaken(name, exceptId)) {
      await ask({ title: 'ชื่อนี้มีแล้ว', body: `มีทริป "${name}" อยู่แล้ว ถ้าใช้ชื่อซ้ำ ยอดใน Excel จะรวมเป็นทริปเดียว ลองเติมปีหรือเดือน`, buttons: [{ label: 'แก้ชื่อ', value: true, kind: 'primary' }] });
      continue;
    }
    return name;
  }
}
on('toggleTrip', async () => {
  const t = S.activeTrip();
  if (t) {
    if (!(await confirm('ปิดทริป?', `รายการที่บันทึกหลังจากนี้จะไม่ติดชื่อ "${t.name}"`, 'ปิดทริป'))) return;
    await S.endTrip();
    toast(`จบทริป ${t.name}`, { label: 'ดูสรุป', fn: () => { UI.summary = { ...UI.summary, mode: 'trip', tripId: t.id }; goTab('summary'); } });
  } else {
    const name = await askTripName(`ทริป ${U.fmtMonth(U.thisMonth())}`);
    if (!name) return;
    await S.startTrip(name);
    toast(`เริ่มทริป ${name} · รายการใหม่จะติดชื่อทริปนี้`);
  }
  render();
});
on('openTrips', () => openSheet('trips'));
registerSheet('trips', () => {
  const trips = [...D.trips].sort((a, b) => b.startedAt - a.startedAt);
  return `<div class="sheet full">${sheetHead('ทริปทั้งหมด')}
    <div class="sheet-body">
      <div class="group">${trips.map((t) => {
        const list = D.tx.filter((x) => x.tripId === t.id);
        const exp = list.filter((x) => x.type === 'expense').reduce((a, x) => a + x.amount, 0);
        return `<button class="cell" data-a="tripMenu" data-id="${t.id}"><span style="flex:1;display:flex;flex-direction:column"><span>${esc(t.name)}${t.id === D.settings.activeTripId ? ' <span class="tag info">กำลังเที่ยว</span>' : ''}</span><span class="small muted">${list.length} รายการ</span></span><span class="val">${m(exp)}</span><span class="chev">›</span></button>`;
      }).join('')}</div>
      <p class="small muted">แก้ชื่อทริปแล้ว ทุกรายการในทริปจะเปลี่ยนชื่อตาม และไฟล์ที่ส่งออกหลังจากนั้นจะใช้ชื่อใหม่</p>
    </div></div>`;
});
on('tripMenu', async (el) => {
  const t = S.trip(el.dataset.id);
  const r = await ask({ title: t.name, vertical: true, buttons: [{ label: 'ดูสรุปทริป', value: 'sum', kind: 'primary' }, { label: 'แก้ชื่อ', value: 'rename' }, { label: 'ลบทริป', value: 'del', kind: 'danger' }, { label: 'ยกเลิก', value: false }] });
  if (r.value === 'sum') { UI.sheet = null; UI.summary = { ...UI.summary, mode: 'trip', tripId: t.id }; goTab('summary'); return; }
  if (r.value === 'rename') { const n = await askTripName(t.name, t.id); if (n) { await S.renameTrip(t.id, n); toast('แก้ชื่อทริปแล้ว'); } }
  if (r.value === 'del') {
    if (await confirm(`ลบทริป "${t.name}"?`, 'รายการยังอยู่ครบ แต่จะไม่ติดชื่อทริปนี้แล้ว', 'ลบทริป', true)) { await S.deleteTrip(t.id); toast('ลบทริปแล้ว'); }
  }
  if (!D.trips.length) { closeSheet(); return; }
  renderSheet(); render();
});

// ---------- ลากเรียงลำดับ ----------
let drag = null;
document.addEventListener('pointerdown', (ev) => {
  const h = ev.target.closest('[data-drag]');
  if (!h) return;
  const item = h.closest('[data-item]');
  const list = item.parentElement;
  ev.preventDefault();
  h.setPointerCapture(ev.pointerId);
  drag = { item, list, store: list.dataset.store };
  item.classList.add('dragging');
});
document.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const { item, list } = drag;
  const rows = [...list.querySelectorAll(':scope > [data-item]')].filter((x) => x !== item);
  let target = null;
  for (const s of rows) { const r = s.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { target = s; break; } }
  if (target) { if (item.nextElementSibling !== target) list.insertBefore(item, target); }
  else { const last = rows[rows.length - 1]; if (last && last.nextElementSibling !== item) last.after(item); }
});
document.addEventListener('pointerup', async () => {
  if (!drag) return;
  const { item, list, store } = drag;
  item.classList.remove('dragging');
  drag = null;
  const ids = [...list.querySelectorAll(':scope > [data-item]')].map((x) => x.dataset.item);
  await S.reorder(store, ids);
  renderSheet();
});
document.addEventListener('pointercancel', () => { if (drag) { drag.item.classList.remove('dragging'); drag = null; renderSheet(); } });

// ---------- หมวดหมู่ ----------
on('openCats', () => openSheet('cats', { type: 'expense' }));
registerSheet('cats', (st) => {
  const list = S.topCats(st.type, true);
  return `<div class="sheet full">${sheetHead('หมวดหมู่', { right: '+ เพิ่ม', rightA: 'catAdd' })}
    <div class="sheet-body">
      <div class="seg" role="group" aria-label="ประเภทหมวด">
        <button data-a="catsType" data-v="expense" aria-pressed="${st.type === 'expense'}">รายจ่าย · ${S.topCats('expense', true).length}</button>
        <button data-a="catsType" data-v="income" aria-pressed="${st.type === 'income'}">รายรับ · ${S.topCats('income', true).length}</button></div>
      <p class="small muted">ลากที่ ⋮⋮ เพื่อเรียงลำดับ ลำดับนี้คือลำดับปุ่มในหน้าบันทึก (8 หมวดแรกอยู่หน้าแรก) · แตะเพื่อแก้ชื่อ ไอคอน หรือหมวดย่อย</p>
      <div class="group" data-store="cats">${list.map((c) => {
        const subs = S.subCats(c.id, true).length;
        return `<div class="row" data-item="${c.id}" style="gap:0;padding-right:8px;${c.hidden ? 'opacity:.55' : ''}">
          <button class="drag-handle" data-drag aria-label="ลากเพื่อย้าย ${esc(c.name)}">${svg(ICON.grip, 16)}</button>
          <button class="cell" style="padding-left:0" data-a="catOpen" data-id="${c.id}"><span class="emoji">${esc(c.emoji || '•')}</span><span style="flex:1">${esc(c.name)}</span>
            <span class="val">${c.hidden ? 'ซ่อนอยู่' : subs ? `${subs} หมวดย่อย` : ''}</span><span class="chev">›</span></button></div>`;
      }).join('')}</div>
      <p class="small muted">ลบหมวดที่มีรายการอยู่ แอปจะให้เลือก: ย้ายรายการไปหมวดอื่น หรือซ่อนหมวดไว้</p>
    </div></div>`;
});
on('catsType', (el) => { UI.sheet.type = el.dataset.v; renderSheet(); });
on('catAdd', () => openSheet('catEdit', { id: null, type: UI.sheet.type, parentId: null, name: '', emoji: '', back: 'cats' }));
on('catOpen', (el) => { const c = S.cat(el.dataset.id); openSheet('catEdit', { id: c.id, type: c.type, parentId: null, name: c.name, emoji: c.emoji || '', back: 'cats' }); });

registerSheet('catEdit', (st) => {
  const c = st.id ? S.cat(st.id) : null;
  const subs = c ? S.subCats(c.id, true) : [];
  return `<div class="sheet full">${sheetHead(c ? 'แก้ไขหมวด' : `หมวด${st.type === 'income' ? 'รายรับ' : 'รายจ่าย'}ใหม่`, { left: 'ยกเลิก', leftA: 'catEditBack', right: 'บันทึก', rightA: 'catSave', rightDisabled: !st.name.trim() })}
    <div class="sheet-body">
      <div class="row" style="gap:12px;align-items:flex-end">
        <label class="field" style="flex:none"><span>ไอคอน</span><input class="emoji-input" data-in="ce" data-f="emoji" value="${esc(st.emoji)}" placeholder="🙂" maxlength="8" aria-label="อีโมจิ"></label>
        <label class="field" style="flex:1"><span>ชื่อหมวด</span><input data-in="ce" data-f="name" value="${esc(st.name)}" maxlength="24" placeholder="เช่น ค่าเลี้ยงหมา"></label>
      </div>
      <p class="small muted">แตะช่องไอคอนแล้วสลับเป็นแป้นอีโมจิของ iPhone</p>
      ${c ? `<div class="section-title">หมวดย่อย (ไม่บังคับ)</div>
        <div class="group" data-store="cats">${subs.map((s) => `<div class="row" data-item="${s.id}" style="gap:0;padding-right:8px">
          <button class="drag-handle" data-drag aria-label="ลากเพื่อย้าย ${esc(s.name)}">${svg(ICON.grip, 16)}</button>
          <button class="cell" style="padding-left:0" data-a="subMenu" data-id="${s.id}"><span style="flex:1">${esc(s.name)}</span><span class="chev">›</span></button></div>`).join('')}
          <button class="cell" data-a="subAdd" style="color:var(--inc-text)">+ เพิ่มหมวดย่อย</button></div>
        <div class="group"><div class="cell"><span style="flex:1;display:flex;flex-direction:column"><span>ซ่อนหมวดนี้</span><span class="small muted">ไม่แสดงในหน้าบันทึก รายการเก่ายังอยู่</span></span>
          <button class="switch" role="switch" aria-checked="${!!c.hidden}" data-a="catHide" aria-label="ซ่อนหมวด"><span></span></button></div></div>
        <button class="btn block ghost" data-a="catDelete" style="color:var(--danger-text)">ลบหมวด</button>` : ''}
    </div></div>`;
});
onInput('ce', (el) => {
  UI.sheet[el.dataset.f] = el.value;
  const b = document.querySelector('[data-a="catSave"]'); if (b) b.disabled = !UI.sheet.name.trim();
});
function catBack() {
  const st = UI.sheet;
  if (st.back === 'cats') openSheet('cats', { type: st.type }); else closeSheet();
}
on('catEditBack', catBack);
on('catSave', async () => {
  const st = UI.sheet;
  const name = st.name.trim();
  if (!name) return;
  const dup = D.cats.find((x) => x.type === st.type && !x.parentId && x.id !== st.id && x.name === name);
  if (dup) { await ask({ title: 'ชื่อซ้ำ', body: `มีหมวด "${name}" อยู่แล้ว`, buttons: [{ label: 'ตกลง', value: true, kind: 'primary' }] }); return; }
  const emoji = [...(st.emoji || '').trim()].slice(0, 2).join('') || '•';
  let c;
  if (st.id) { c = S.cat(st.id); c.name = name; c.emoji = emoji; }
  else c = { id: U.uid('c'), type: st.type, name, emoji, order: S.topCats(st.type, true).length, hidden: false, parentId: null };
  await S.putCats(c);
  if (st.fromEntry && UI.entry) { UI.entry.catId = c.id; UI.entry.subId = null; }
  toast(st.id ? 'บันทึกหมวดแล้ว' : `เพิ่มหมวด ${name} แล้ว`);
  if (st.fromEntry) { closeSheet(); return; }
  if (!st.id) { openSheet('catEdit', { ...st, id: c.id }); render(); return; }
  catBack();
  render();
});
on('catHide', async () => { const c = S.cat(UI.sheet.id); c.hidden = !c.hidden; await S.putCats(c); renderSheet(); });
on('subAdd', async () => {
  const r = await ask({ title: 'หมวดย่อยใหม่', input: { value: '', maxlength: 24, placeholder: 'เช่น ข้าว, ขนม' }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'เพิ่ม', value: true, kind: 'primary' }] });
  const name = r.value && r.input.trim();
  if (!name) return;
  const parent = S.cat(UI.sheet.id);
  if (S.subCats(parent.id, true).some((s) => s.name === name)) { toast('มีหมวดย่อยชื่อนี้แล้ว'); return; }
  await S.putCats({ id: U.uid('c'), type: parent.type, name, emoji: '', order: S.subCats(parent.id, true).length, hidden: false, parentId: parent.id });
  renderSheet();
});
on('subMenu', async (el) => {
  const s = S.cat(el.dataset.id);
  const r = await ask({ title: s.name, vertical: true, buttons: [{ label: 'แก้ชื่อ', value: 'rename', kind: 'primary' }, { label: 'ลบหมวดย่อย', value: 'del', kind: 'danger' }, { label: 'ยกเลิก', value: false }] });
  if (r.value === 'rename') {
    const r2 = await ask({ title: 'แก้ชื่อหมวดย่อย', input: { value: s.name, maxlength: 24 }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'บันทึก', value: true, kind: 'primary' }] });
    if (r2.value && r2.input.trim()) { s.name = r2.input.trim(); await S.putCats(s); }
  } else if (r.value === 'del') {
    const n = S.txCountForCat(s.id);
    if (await confirm(`ลบ "${s.name}"?`, n ? `${n} รายการจะยังอยู่ในหมวด "${catName(s.parentId)}" แต่ไม่มีหมวดย่อย` : 'ยังไม่มีรายการในหมวดย่อยนี้', 'ลบ', true)) await S.deleteCat(s.id);
  }
  renderSheet();
});
on('catDelete', async () => {
  const c = S.cat(UI.sheet.id);
  const n = S.txCountForCat(c.id);
  if (!n) {
    if (!(await confirm(`ลบหมวด "${c.name}"?`, 'ยังไม่มีรายการในหมวดนี้', 'ลบ', true))) return;
    await S.deleteCat(c.id);
  } else {
    const r = await ask({ title: `หมวด "${c.name}" มี ${n} รายการ`, body: 'เลือกวิธีจัดการรายการเหล่านี้', vertical: true, buttons: [{ label: 'ย้ายรายการไปหมวดอื่น แล้วลบ', value: 'move', kind: 'primary' }, { label: 'ซ่อนหมวดแทน (ไม่ลบ)', value: 'hide' }, { label: 'ยกเลิก', value: false }] });
    if (r.value === 'hide') { c.hidden = true; await S.putCats(c); toast('ซ่อนหมวดแล้ว'); renderSheet(); return; }
    if (r.value !== 'move') return;
    const others = S.topCats(c.type, true).filter((x) => x.id !== c.id);
    const r2 = await ask({ title: 'ย้ายไปหมวด', select: { options: [...others.map((x) => ({ value: x.id, label: `${x.emoji || ''} ${x.name}` })), { value: '', label: 'รอจัดหมวด' }], value: others[0]?.id || '' }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'ย้ายแล้วลบ', value: true, kind: 'danger' }] });
    if (!r2.value) return;
    await S.deleteCat(c.id, r2.select || null);
  }
  toast('ลบหมวดแล้ว');
  if (UI.entry && UI.entry.catId === c.id) UI.entry.catId = null;
  catBack();
  render();
});

// ---------- ช่องทาง ----------
on('openChannels', () => openSheet('channels'));
registerSheet('channels', () => {
  const list = S.sortedChannels();
  return `<div class="sheet full">${sheetHead('ช่องทางจ่าย', { right: '+ เพิ่ม', rightA: 'chAdd' })}
    <div class="sheet-body">
      <div class="group" data-store="channels">${list.map((c) => `<div class="row" data-item="${c.id}" style="gap:0;padding-right:8px">
        <button class="drag-handle" data-drag aria-label="ลากเพื่อย้าย ${esc(c.name)}">${svg(ICON.grip, 16)}</button>
        <button class="cell" style="padding-left:0" data-a="chMenu" data-id="${c.id}"><span style="flex:1">${esc(c.name)}</span><span class="chev">›</span></button></div>`).join('')}</div>
      <div class="section-title">ค่าเริ่มต้น</div>
      <div class="group">
        <label class="cell"><span class="lbl">หน้าบันทึก</span><select data-ch="defCh" data-k="defaultChannelId">${optionsHtml(list.map((c) => ({ value: c.id, label: c.name })), D.settings.defaultChannelId)}</select></label>
        <label class="cell"><span class="lbl">หน้าผ่อน</span><select data-ch="defCh" data-k="planChannelId">${optionsHtml(list.map((c) => ({ value: c.id, label: c.name })), D.settings.planChannelId)}</select></label>
      </div>
    </div></div>`;
});
onChange('defCh', async (el) => { await S.saveSettings({ [el.dataset.k]: el.value }); if (el.dataset.k === 'defaultChannelId' && UI.entry) UI.entry.channelId = el.value; });
on('chAdd', async () => {
  const r = await ask({ title: 'ช่องทางใหม่', input: { value: '', maxlength: 20, placeholder: 'เช่น TrueMoney' }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'เพิ่ม', value: true, kind: 'primary' }] });
  const name = r.value && r.input.trim();
  if (!name) return;
  await S.putChannels({ id: U.uid('h'), name, order: D.channels.length });
  renderSheet();
});
on('chMenu', async (el) => {
  const c = S.channel(el.dataset.id);
  const r = await ask({ title: c.name, vertical: true, buttons: [{ label: 'แก้ชื่อ', value: 'rename', kind: 'primary' }, { label: 'ลบ', value: 'del', kind: 'danger' }, { label: 'ยกเลิก', value: false }] });
  if (r.value === 'rename') {
    const r2 = await ask({ title: 'แก้ชื่อช่องทาง', input: { value: c.name, maxlength: 20 }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'บันทึก', value: true, kind: 'primary' }] });
    if (r2.value && r2.input.trim()) { c.name = r2.input.trim(); await S.putChannels(c); }
  } else if (r.value === 'del') {
    if (D.channels.length <= 1) { toast('ต้องมีอย่างน้อย 1 ช่องทาง'); return; }
    const others = S.sortedChannels().filter((x) => x.id !== c.id);
    const n = D.tx.filter((t) => t.channelId === c.id).length;
    const r2 = await ask({ title: `ลบ "${c.name}"?`, body: n ? `${n} รายการใช้ช่องทางนี้ ย้ายไปช่องทาง:` : 'ยังไม่มีรายการที่ใช้ช่องทางนี้', select: n ? { options: others.map((x) => ({ value: x.id, label: x.name })), value: others[0].id } : null, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'ลบ', value: true, kind: 'danger' }] });
    if (!r2.value) return;
    await S.deleteChannel(c.id, r2.select || others[0].id);
    if (UI.entry && UI.entry.channelId === c.id) UI.entry.channelId = D.settings.defaultChannelId;
  }
  renderSheet();
});

// ---------- รายการโปรด ----------
on('openFavs', () => openSheet('favs'));
registerSheet('favs', () => {
  const list = S.sortedFavs();
  return `<div class="sheet full">${sheetHead('รายการโปรด')}
    <div class="sheet-body">
      <p class="small muted">เพิ่มจากหน้าบันทึก: กรอกยอด เลือกหมวด แล้วแตะ + ในแถว "โปรด" · แตะรายการโปรดที่หน้าบันทึกเพื่อบันทึกทันที</p>
      ${list.length ? `<div class="group" data-store="favs">${list.map((f) => `<div class="row" data-item="${f.id}" style="gap:0;padding-right:8px">
        <button class="drag-handle" data-drag aria-label="ลากเพื่อย้าย ${esc(f.note)}">${svg(ICON.grip, 16)}</button>
        <button class="cell" style="padding-left:0" data-a="favMenu" data-id="${f.id}"><span style="flex:1;display:flex;flex-direction:column"><span>${esc(f.note)}</span><span class="small muted">${f.type === 'income' ? 'รายรับ · ' : ''}${esc(catName(f.catId))}</span></span><span class="val">${m(f.amount)}</span><span class="chev">›</span></button></div>`).join('')}</div>` : '<div class="empty">ยังไม่มีรายการโปรด</div>'}
    </div></div>`;
});
on('favMenu', async (el) => {
  const f = D.favs.find((x) => x.id === el.dataset.id);
  const r = await ask({ title: f.note, vertical: true, buttons: [{ label: 'แก้ชื่อ', value: 'name', kind: 'primary' }, { label: 'แก้ยอด', value: 'amount' }, { label: 'ลบ', value: 'del', kind: 'danger' }, { label: 'ยกเลิก', value: false }] });
  if (r.value === 'name') { const r2 = await ask({ title: 'ชื่อรายการโปรด', input: { value: f.note, maxlength: 30 }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'บันทึก', value: true, kind: 'primary' }] }); if (r2.value && r2.input.trim()) { f.note = r2.input.trim(); await S.putFav(f); } }
  if (r.value === 'amount') { const r2 = await ask({ title: 'ยอด (บาท)', input: { value: String(f.amount), inputmode: 'decimal' }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'บันทึก', value: true, kind: 'primary' }] }); const v = parseFloat(String(r2.input || '').replace(/,/g, '')); if (r2.value && v > 0) { f.amount = U.round2(v); await S.putFav(f); } }
  if (r.value === 'del' && await confirm(`ลบ "${f.note}"?`, '', 'ลบ', true)) await S.deleteFav(f.id);
  renderSheet();
});

// ---------- ส่งออก ----------
function firstMonth() { return D.tx.length ? D.tx.reduce((a, t) => (t.date < a ? t.date : a), '9999').slice(0, 7) : U.thisMonth(); }
function lastMonth() { return D.tx.length ? D.tx.reduce((a, t) => (t.date > a ? t.date : a), '0000').slice(0, 7) : U.thisMonth(); }
export function openExport(from, to) {
  openSheet('export', { from: from || `${U.thisMonth().slice(0, 4)}-01`, to: to || U.thisMonth(), fmt: 'xlsx', file: null, busy: false, back: null });
}
on('openExport', () => openExport());
registerSheet('export', (st) => {
  const list = X.txInRange(st.from, st.to);
  const y = U.thisMonth().slice(0, 4);
  const q = st.from === U.thisMonth() && st.to === U.thisMonth() ? 'm' : st.from === `${y}-01` && st.to === U.thisMonth() ? 'y' : st.from === firstMonth() && st.to === lastMonth() ? 'a' : '';
  const future = list.filter((t) => t.date > U.today()).length;
  const name = X.fileName(st.from, st.to, st.fmt);
  return `<div class="sheet full">${sheetHead('ส่งออก', st.back ? { left: 'กลับ', leftA: 'exportBack' } : {})}
    <div class="sheet-body">
      <div class="section-title">ช่วงเดือน</div>
      <div class="chips">
        <button class="chip" data-a="exQuick" data-v="m" aria-pressed="${q === 'm'}">เดือนนี้</button>
        <button class="chip" data-a="exQuick" data-v="y" aria-pressed="${q === 'y'}">ปีนี้</button>
        <button class="chip" data-a="exQuick" data-v="a" aria-pressed="${q === 'a'}">ทั้งหมด (รวมงวดล่วงหน้า)</button>
      </div>
      <div class="row">
        <label class="field" style="flex:1"><span>ตั้งแต่</span><input type="month" data-ch="exFrom" value="${st.from}"></label>
        <span class="muted" style="padding-top:22px">→</span>
        <label class="field" style="flex:1"><span>ถึง</span><input type="month" data-ch="exTo" value="${st.to}"></label>
      </div>
      <div class="section-title">รูปแบบไฟล์</div>
      <div class="seg" role="group" aria-label="รูปแบบไฟล์">
        <button data-a="exFmt" data-v="xlsx" aria-pressed="${st.fmt === 'xlsx'}">Excel (.xlsx)</button>
        <button data-a="exFmt" data-v="csv" aria-pressed="${st.fmt === 'csv'}">CSV</button></div>
      <section class="card stack" style="gap:6px">
        <div class="row" style="justify-content:space-between;align-items:baseline"><span style="font-size:22px;font-weight:600">${list.length.toLocaleString()} <span class="small muted">รายการ</span></span><span class="small muted">${st.from === st.to ? U.fmtMonth(st.from) : `${U.fmtMonth(st.from)} – ${U.fmtMonth(st.to)}`}</span></div>
        <div class="small" style="word-break:break-all;color:var(--text2)">${esc(name)}</div>
        <div class="small muted">ชีต "รายการ" · 1 แถวต่อ 1 รายการ · ${st.fmt === 'xlsx' ? 'เป็น Excel Table พร้อมทำ Pivot' : 'เปิดใน Excel ได้ ภาษาไทยไม่เพี้ยน'}${future ? ` · มีงวดล่วงหน้า ${future} รายการ` : ''}</div>
      </section>
      ${st.file ? `<button class="btn primary block" data-a="exShare">${svg(ICON.share)} แชร์ไฟล์ (LINE / แอปอื่น)</button>
        <p class="small muted" style="text-align:center">หน้าแชร์ของ iPhone จะเปิดขึ้น แตะ LINE แล้วเลือกแชท</p>
        <button class="link" data-a="exReset" style="align-self:center">สร้างไฟล์ใหม่</button>`
      : `<button class="btn primary block" data-a="exBuild" ${list.length && !st.busy ? '' : 'disabled'}>${st.busy ? 'กำลังสร้างไฟล์…' : list.length ? 'สร้างไฟล์' : 'ไม่มีรายการในช่วงนี้'}</button>`}
    </div></div>`;
});
on('exQuick', (el) => {
  const st = UI.sheet; const y = U.thisMonth().slice(0, 4);
  if (el.dataset.v === 'm') { st.from = U.thisMonth(); st.to = U.thisMonth(); }
  if (el.dataset.v === 'y') { st.from = `${y}-01`; st.to = U.thisMonth(); }
  if (el.dataset.v === 'a') { st.from = firstMonth(); st.to = lastMonth(); }
  st.file = null; renderSheet();
});
onChange('exFrom', (el) => { const st = UI.sheet; if (!el.value) return; st.from = el.value; if (st.to < st.from) st.to = st.from; st.file = null; renderSheet(); });
onChange('exTo', (el) => { const st = UI.sheet; if (!el.value) return; st.to = el.value; if (st.from > st.to) st.from = st.to; st.file = null; renderSheet(); });
on('exFmt', (el) => { UI.sheet.fmt = el.dataset.v; UI.sheet.file = null; renderSheet(); });
on('exReset', () => { UI.sheet.file = null; renderSheet(); });
on('exportBack', () => openSheet(UI.sheet.back.kind, UI.sheet.back.state));
on('exBuild', async () => {
  const st = UI.sheet;
  st.busy = true; renderSheet();
  try {
    const list = X.txInRange(st.from, st.to);
    const blob = st.fmt === 'xlsx' ? await X.buildXlsx(list) : X.buildCsv(list);
    st.file = new File([blob], X.fileName(st.from, st.to, st.fmt), { type: blob.type });
  } catch (e) {
    toast('สร้างไฟล์ไม่สำเร็จ: ' + e.message);
  }
  st.busy = false;
  if (UI.sheet === st) renderSheet();
});
on('exShare', async () => {
  const f = UI.sheet.file;
  if (!f) return;
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: f.name }); toast('ส่งไฟล์แล้ว'); } catch (e) { if (e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ: ' + e.message); }
    return;
  }
  const url = URL.createObjectURL(f);
  const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('ดาวน์โหลดไฟล์แล้ว');
});

// ---------- นำเข้า ----------
on('openImport', () => openSheet('import', { prep: null, busy: false, error: '' }));
registerSheet('import', (st) => `<div class="sheet full">${sheetHead('นำเข้าจากไฟล์')}
  <div class="sheet-body">
    <p class="small muted">ใช้ไฟล์ .xlsx หรือ .csv ที่เคยส่งออกจากแอปนี้ เพื่อกู้ข้อมูลหรือย้ายเครื่อง ถ้าไฟล์อยู่ใน LINE ให้กดบันทึกลงแอปไฟล์ก่อน รายการที่รหัสซ้ำกับที่มีอยู่จะถูกข้าม</p>
    <label class="btn block ghost" style="position:relative">${st.busy ? 'กำลังอ่านไฟล์…' : 'เลือกไฟล์ .xlsx / .csv'}
      <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-ch="importFile" style="position:absolute;inset:0;opacity:0"></label>
    ${st.error ? `<p class="small" style="color:var(--danger-text)">${esc(st.error)}</p>` : ''}
    ${st.prep ? `<section class="card stack" style="gap:6px">
      <b>${esc(st.prep.fileName)}</b>
      <span>รายการใหม่ <b>${st.prep.tx.length.toLocaleString()}</b></span>
      <span class="small muted">ข้ามรายการที่มีอยู่แล้ว ${st.prep.skipped} · แถวที่อ่านไม่ได้ ${st.prep.invalid}</span>
      ${st.prep.cats.length || st.prep.channels.length || st.prep.trips.length ? `<span class="small muted">จะเพิ่มหมวด ${st.prep.cats.length} · ช่องทาง ${st.prep.channels.length} · ทริป ${st.prep.trips.length}</span>` : ''}
    </section>
    <button class="btn primary block" data-a="importGo" ${st.prep.tx.length ? '' : 'disabled'}>นำเข้า ${st.prep.tx.length.toLocaleString()} รายการ</button>` : ''}
  </div></div>`);
onChange('importFile', async (el) => {
  const f = el.files && el.files[0];
  if (!f) return;
  const st = UI.sheet;
  st.busy = true; st.error = ''; st.prep = null; renderSheet();
  try { st.prep = { ...(await X.prepareImport(f)), fileName: f.name }; } catch (e) { st.error = 'อ่านไฟล์ไม่ได้: ' + e.message; }
  st.busy = false; renderSheet();
});
on('importGo', async () => {
  const p = UI.sheet.prep;
  await S.bulkImport(p);
  toast(`นำเข้า ${p.tx.length.toLocaleString()} รายการแล้ว`);
  closeSheet();
});

// ---------- ล้างประวัติ ----------
on('openClear', () => openSheet('clear', { mode: '6m', from: firstMonth(), to: U.addMonths(U.thisMonth(), -1) }));
function clearRange(st) {
  if (st.mode === 'all') return { list: [...D.tx], label: 'ทุกรายการ' };
  if (st.mode === 'range') return { list: D.tx.filter((t) => t.date.slice(0, 7) >= st.from && t.date.slice(0, 7) <= st.to), label: `${U.fmtMonth(st.from)} – ${U.fmtMonth(st.to)}` };
  const months = { '6m': 6, '1y': 12, '2y': 24 }[st.mode];
  const d = new Date(); d.setMonth(d.getMonth() - months);
  const cutoff = U.ymd(d);
  return { list: D.tx.filter((t) => t.date < cutoff), label: `ก่อน ${U.fmtDate(cutoff)}` };
}
registerSheet('clear', (st) => {
  const { list, label } = clearRange(st);
  const dates = list.map((t) => t.date).sort();
  return `<div class="sheet full">${sheetHead('ล้างประวัติ')}
    <div class="sheet-body">
      <p class="small muted">ข้อมูลแบบนี้ใช้พื้นที่น้อยมาก (หลายปียังไม่กี่ MB) ลบเมื่อจำเป็นเท่านั้น การ์ดผ่อน หมวด และการตั้งค่าจะไม่ถูกลบ</p>
      <div class="chips" style="flex-wrap:wrap">
        ${[['6m', 'เก่ากว่า 6 เดือน'], ['1y', 'เก่ากว่า 1 ปี'], ['2y', 'เก่ากว่า 2 ปี'], ['range', 'เลือกช่วงเอง'], ['all', 'ทั้งหมด']].map(([k, l]) => `<button class="chip" data-a="clrMode" data-v="${k}" aria-pressed="${st.mode === k}">${l}</button>`).join('')}
      </div>
      ${st.mode === 'range' ? `<div class="row">
        <label class="field" style="flex:1"><span>ตั้งแต่</span><input type="month" data-ch="clrFrom" value="${st.from}"></label>
        <span class="muted" style="padding-top:22px">→</span>
        <label class="field" style="flex:1"><span>ถึง</span><input type="month" data-ch="clrTo" value="${st.to}"></label></div>` : ''}
      <section class="card stack" style="gap:4px">
        <span style="font-size:22px;font-weight:600">${list.length.toLocaleString()} <span class="small muted">รายการจะถูกลบ</span></span>
        <span class="small muted">${esc(label)}${dates.length ? ` · ${U.fmtDate(dates[0])} ถึง ${U.fmtDate(dates[dates.length - 1])}` : ''}</span>
      </section>
      <button class="btn block" data-a="clrExport" ${list.length ? '' : 'disabled'}>${svg(ICON.share)} ส่งออกช่วงนี้เก็บไว้ก่อน</button>
      <button class="btn danger block" data-a="clrGo" ${list.length ? '' : 'disabled'}>ลบ ${list.length.toLocaleString()} รายการ</button>
    </div></div>`;
});
on('clrMode', (el) => { UI.sheet.mode = el.dataset.v; renderSheet(); });
onChange('clrFrom', (el) => { if (el.value) { UI.sheet.from = el.value; if (UI.sheet.to < el.value) UI.sheet.to = el.value; renderSheet(); } });
onChange('clrTo', (el) => { if (el.value) { UI.sheet.to = el.value; if (UI.sheet.from > el.value) UI.sheet.from = el.value; renderSheet(); } });
on('clrExport', () => {
  const st = { ...UI.sheet };
  const dates = clearRange(st).list.map((t) => t.date).sort();
  openSheet('export', { from: dates[0].slice(0, 7), to: dates[dates.length - 1].slice(0, 7), fmt: 'xlsx', file: null, busy: false, back: { kind: 'clear', state: st } });
});
on('clrGo', async () => {
  const { list, label } = clearRange(UI.sheet);
  if (!(await confirm(`ลบ ${list.length.toLocaleString()} รายการ?`, `${label}\nลบแล้วกู้คืนได้จากไฟล์ที่ส่งออกไว้เท่านั้น`, 'ลบเลย', true))) return;
  await S.deleteTx(list.map((t) => t.id));
  toast(`ลบ ${list.length.toLocaleString()} รายการแล้ว`);
  closeSheet();
});

// ---------- รีเซ็ต ----------
on('resetAll', async () => {
  if (!(await confirm('รีเซ็ตแอปทั้งหมด?', 'ลบทุกรายการ หมวด ช่องทาง ผ่อน รายการประจำ ทริป และการตั้งค่า แล้วกลับเป็นค่าเริ่มต้น', 'ต่อไป', true))) return;
  const r = await ask({ title: 'ยืนยันอีกครั้ง', body: 'พิมพ์คำว่า ลบ เพื่อยืนยัน', input: { value: '' }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'รีเซ็ต', value: true, kind: 'danger' }] });
  if (!r.value || r.input.trim() !== 'ลบ') { if (r.value) toast('ยังไม่ได้รีเซ็ต: คำยืนยันไม่ตรง'); return; }
  await S.resetAll();
  UI.entry = null;
  toast('รีเซ็ตแล้ว');
  goTab('entry');
});
