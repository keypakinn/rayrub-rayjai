// หน้าบันทึก (หน้าแรกเมื่อเปิดแอป)
import * as S from './store.js';
import { D } from './store.js';
import * as U from './util.js';
import { esc } from './util.js';
import { UI, on, onInput, onChange, registerView, render, afterRender, toast, ask, confirm, m, svg, ICON, goTab, openSheet } from './ui.js';
import { catName, sumOf, channelOptions, isStandalone } from './common.js';

export function freshEntry(type = 'expense') {
  return {
    type, expr: '', catId: null, subId: null, channelId: D.settings.defaultChannelId || null,
    date: U.today(), note: '', noteFocus: false, catScroll: 0,
  };
}
UI.entry = null;
const E = () => UI.entry || (UI.entry = freshEntry());

// ---------- คำแนะนำจากโน้ตเก่า ----------
function suggestions(q, type) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const map = new Map();
  for (const t of D.tx) {
    if (t.type !== type || !t.note || t.planId || t.recurId) continue;
    const key = t.note.trim().toLowerCase();
    if (!key.includes(q)) continue;
    const cur = map.get(key);
    if (!cur) map.set(key, { note: t.note.trim(), count: 1, last: t });
    else { cur.count++; if (t.createdAt > cur.last.createdAt) cur.last = t; }
  }
  return [...map.values()]
    .sort((a, b) => (b.note.toLowerCase().startsWith(q) - a.note.toLowerCase().startsWith(q)) || b.count - a.count)
    .slice(0, 4);
}
function suggestHtml() {
  const e = E();
  if (!e.noteFocus) return '';
  const list = suggestions(e.note, e.type);
  if (!list.length) return '';
  return `<div class="suggest">${list.map((s, i) => {
    const meta = [s.last.catId ? catName(s.last.catId) : '', s.last.channelId && S.channel(s.last.channelId) ? S.channel(s.last.channelId).name : '', m(s.last.amount)].filter(Boolean).join(' · ');
    return `<button data-sug="${i}"><span>${esc(s.note)}</span><span class="meta">${esc(meta)}</span></button>`;
  }).join('')}</div>`;
}
function applySuggestion(i) {
  const e = E();
  const s = suggestions(e.note, e.type)[i];
  if (!s) return;
  const t = s.last;
  e.note = s.note;
  const c = t.catId && S.cat(t.catId);
  if (c && !c.hidden) { e.catId = c.id; const sub = t.subId && S.cat(t.subId); e.subId = sub && !sub.hidden ? sub.id : null; }
  if (t.channelId && S.channel(t.channelId)) e.channelId = t.channelId;
  if (!e.expr) e.expr = String(t.amount);
  e.noteFocus = false;
  document.activeElement?.blur?.();
  render();
}

// ---------- หน้าจอ ----------
registerView('entry', () => {
  const e = E();
  const amt = U.calcEval(e.expr);
  const td = U.today();
  const todayTx = D.tx.filter((t) => t.date === td);
  const monthTx = D.tx.filter((t) => t.date.slice(0, 7) === U.thisMonth() && t.date <= td);
  const pending = D.tx.filter((t) => !t.catId).length;
  const trip = S.activeTrip();
  const cats = S.topCats(e.type);
  const items = [...cats.map((c) => ({ c })), { add: true }];
  const pages = [];
  for (let i = 0; i < items.length; i += 8) pages.push(items.slice(i, i + 8));
  const subs = e.catId ? S.subCats(e.catId) : [];
  const favs = S.sortedFavs().filter((f) => f.type === e.type);
  const cname = e.catId ? catName(e.catId) : '';
  const dateLabel = e.date === td ? '' : e.date === U.yesterday() ? '' : U.fmtDate(e.date, false);
  const hidden = D.settings.hideAmounts;

  return `<div class="entry ${e.type}">
    ${!isStandalone() ? `<button class="chip info" data-a="installHelp" style="align-self:flex-start">ยังไม่ได้เพิ่มลงหน้าจอโฮม · วิธีเพิ่ม</button>` : ''}
    <div class="topstrip">
      <div class="sum">วันนี้ <b>${m(sumOf(todayTx, 'expense'))}</b> · เดือนนี้ <b>${m(sumOf(monthTx, 'expense'))}</b></div>
      ${pending ? `<button class="chip warn" data-a="goPending">รอจัดหมวด <b>${pending}</b></button>` : ''}
      <button class="icon-btn" data-a="toggleHide" aria-label="${hidden ? 'แสดงยอดเงิน' : 'ซ่อนยอดเงิน'}">${svg(hidden ? ICON.eyeOff : ICON.eye)}</button>
    </div>
    ${trip ? `<div class="trip-banner"><span style="flex:1">ทริป: <b>${esc(trip.name)}</b></span><button class="link" data-a="endTrip" style="padding:8px 10px">ปิดทริป</button></div>` : ''}
    <div class="seg type" role="group" aria-label="ประเภท">
      <button data-a="setType" data-v="expense" aria-pressed="${e.type === 'expense'}">รายจ่าย</button>
      <button data-a="setType" data-v="income" aria-pressed="${e.type === 'income'}">รายรับ</button>
    </div>
    <div class="amount" aria-live="polite">
      <div class="expr">${U.hasOp(e.expr) ? esc(U.prettyExpr(e.expr)) : ''}</div>
      <div class="val ${amt ? '' : 'zero'}"><small>฿</small>${amt ? U.num(amt) : '0'}</div>
    </div>
    <div class="note-box">
      <label class="note-field"><span class="sr">โน้ต</span>
        <input id="note" data-in="note" value="${esc(e.note)}" placeholder="โน้ต (ไม่บังคับ)" autocomplete="off" enterkeyhint="done">
        ${cname ? `<span class="hint">${esc(cname)}</span>` : ''}
      </label>
      <div id="suggest">${suggestHtml()}</div>
    </div>
    <div class="chips">
      <button class="chip" data-a="setDate" data-v="today" aria-pressed="${e.date === td}">วันนี้</button>
      <button class="chip" data-a="setDate" data-v="yesterday" aria-pressed="${e.date === U.yesterday()}">เมื่อวาน</button>
      <label class="chip has-select" aria-pressed="${!!dateLabel}">${dateLabel ? esc(dateLabel) : 'เลือกวัน'}
        <input type="date" data-ch="pickDate" value="${e.date}" max="2100-12-31" style="position:absolute;inset:0;opacity:0;font-size:16px" aria-label="เลือกวันที่"></label>
      <span class="spacer"></span>
      <label class="chip has-select">${esc(S.channel(e.channelId)?.name || 'ช่องทาง')} ${svg(ICON.down, 14)}
        <select data-ch="entryChannel" aria-label="ช่องทาง">${channelOptions().map((o) => `<option value="${o.value}" ${o.value === e.channelId ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
    </div>
    <div class="chips" aria-label="รายการโปรด">
      <span class="small muted" style="align-self:center">โปรด</span>
      ${favs.map((f) => `<button class="fav" data-a="useFav" data-id="${f.id}">${esc(f.note)} ${hidden ? '' : U.num(f.amount)}</button>`).join('')}
      <button class="fav add" data-a="addFav" aria-label="เพิ่มรายการโปรดจากที่กรอกอยู่">+</button>
    </div>
    <div>
      <div class="catpager" id="catpager">
        ${pages.map((p) => `<div class="catpage">${p.map((it) => it.add
          ? `<button class="catbtn add" data-a="newCat"><span class="e">+</span><span class="n">หมวดใหม่</span></button>`
          : `<button class="catbtn" data-a="pickCat" data-id="${it.c.id}" aria-pressed="${e.catId === it.c.id}"><span class="e">${esc(it.c.emoji || '•')}</span><span class="n">${esc(it.c.name)}</span></button>`).join('')}</div>`).join('')}
      </div>
      ${pages.length > 1 ? `<div class="dots" id="catdots" aria-hidden="true" style="margin-top:6px">${pages.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>` : ''}
    </div>
    ${subs.length ? `<div class="chips subrow" aria-label="หมวดย่อย">
      <button class="chip" data-a="pickSub" data-id="" aria-pressed="${!e.subId}">ไม่ระบุ</button>
      ${subs.map((s) => `<button class="chip" data-a="pickSub" data-id="${s.id}" aria-pressed="${e.subId === s.id}">${esc(s.name)}</button>`).join('')}
    </div>` : ''}
    <div class="keypad">
      <div class="ops">${[['⌫', 'ลบตัวอักษร'], ['÷', 'หาร'], ['×', 'คูณ'], ['−', 'ลบ'], ['+', 'บวก']].map(([k, l]) => `<button class="key" data-a="key" data-k="${k}" aria-label="${l}">${k}</button>`).join('')}</div>
      <div class="digits">${['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '00'].map((k) => `<button class="key" data-a="key" data-k="${k}" ${k === '.' ? 'aria-label="จุดทศนิยม"' : ''}>${k}</button>`).join('')}</div>
    </div>
    <button class="btn primary save ${e.type === 'income' ? 'income' : ''}" data-a="saveEntry" ${amt && amt > 0 ? '' : 'disabled'}>
      ${amt && amt > 0 ? `บันทึก ${m(amt)}${e.catId ? '' : ' · รอจัดหมวด'}` : 'กรอกยอดเงิน'}${trip && e.type === 'expense' ? ' · ' + esc(trip.name) : ''}
    </button>
  </div>`;
});

// ---------- หน้าหมวด: จำตำแหน่งที่ปัด + จุดบอกหน้า ----------
afterRender(() => {
  if (UI.tab !== 'entry') return;
  const pager = document.getElementById('catpager');
  if (!pager) return;
  pager.scrollLeft = E().catScroll || 0;
  const dots = document.getElementById('catdots');
  const upd = () => {
    E().catScroll = pager.scrollLeft;
    if (!dots) return;
    const pageW = pager.firstElementChild ? pager.firstElementChild.offsetWidth + 8 : pager.clientWidth;
    const i = Math.round(pager.scrollLeft / pageW);
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
  };
  pager.addEventListener('scroll', upd, { passive: true });
  upd();
});

// ---------- การกระทำ ----------
function rerenderKeepNote() { render(); }
on('key', (el) => { const e = E(); e.expr = U.calcInput(e.expr, el.dataset.k); render(); });
on('setType', (el) => { const e = E(); if (e.type === el.dataset.v) return; e.type = el.dataset.v; e.catId = null; e.subId = null; e.catScroll = 0; render(); });
on('pickCat', (el) => { const e = E(); e.catId = e.catId === el.dataset.id ? null : el.dataset.id; e.subId = null; render(); });
on('pickSub', (el) => { const e = E(); e.subId = el.dataset.id || null; render(); });
on('setDate', (el) => { const e = E(); e.date = el.dataset.v === 'today' ? U.today() : U.yesterday(); render(); });
onChange('pickDate', (el) => { if (el.value) { E().date = el.value; render(); } });
onChange('entryChannel', (el) => { E().channelId = el.value; render(); });
on('toggleHide', async () => { await S.saveSettings({ hideAmounts: !D.settings.hideAmounts }); render(); });
on('goPending', () => { UI.list = { ...UI.list, pending: true, q: '', catId: '', channelId: '', tripId: '', day: '' }; goTab('list'); });
on('installHelp', () => ask({
  title: 'เพิ่มลงหน้าจอโฮม',
  body: '1. เปิดหน้านี้ใน Safari\n2. แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น)\n3. เลือก "เพิ่มไปยังหน้าจอโฮม"\n4. ต่อจากนี้เปิดแอปจากไอคอนเท่านั้น\n\nข้อมูลใน Safari กับในไอคอนแยกกัน และ Safari อาจลบข้อมูลเองถ้าไม่ได้ใช้นาน',
  buttons: [{ label: 'เข้าใจแล้ว', value: true, kind: 'primary' }],
}));

onInput('note', (el) => {
  const e = E(); e.note = el.value; e.noteFocus = true;
  document.getElementById('suggest').innerHTML = suggestHtml();
});
document.addEventListener('focusin', (ev) => { if (ev.target.id === 'note') { E().noteFocus = true; document.getElementById('suggest').innerHTML = suggestHtml(); } });
document.addEventListener('focusout', (ev) => {
  if (ev.target.id === 'note') setTimeout(() => { E().noteFocus = false; const s = document.getElementById('suggest'); if (s) s.innerHTML = ''; }, 150);
});
document.addEventListener('pointerdown', (ev) => {
  const b = ev.target.closest('[data-sug]');
  if (b) { ev.preventDefault(); applySuggestion(Number(b.dataset.sug)); }
});
document.addEventListener('keydown', (ev) => { if (ev.target.id === 'note' && ev.key === 'Enter') ev.target.blur(); });

let persistAsked = false;
function requestPersist() { if (persistAsked) return; persistAsked = true; navigator.storage?.persist?.().catch(() => {}); }

export async function addTx(fields, { label } = {}) {
  const trip = S.activeTrip();
  const t = S.newTx({ ...fields, tripId: fields.type === 'expense' || fields.type === 'income' ? (trip ? trip.id : null) : null });
  const dup = S.findRecentDuplicate(t);
  if (dup) {
    const ok = await confirm('ซ้ำหรือเปล่า?', `เพิ่งบันทึก ${m(t.amount)} ${catName(t.catId, '(รอจัดหมวด)')} ไปเมื่อไม่ถึง 1 นาทีก่อน`, 'บันทึกซ้ำ');
    if (!ok) return null;
  }
  await S.putTx(t);
  requestPersist();
  toast(`บันทึกแล้ว ${m(t.amount)} · ${label || catName(t.catId)}`, { label: 'เลิกทำ', fn: async () => { await S.deleteTx([t.id]); toast('ยกเลิกรายการแล้ว'); render(); } });
  return t;
}

on('saveEntry', async () => {
  const e = E();
  const amount = U.calcEval(e.expr);
  if (!amount || amount <= 0) return;
  const t = await addTx({ type: e.type, amount, catId: e.catId, subId: e.subId, channelId: e.channelId, date: e.date, note: e.note.trim() });
  if (!t) return;
  UI.entry = freshEntry(e.type);
  render();
});

on('useFav', async (el) => {
  const f = D.favs.find((x) => x.id === el.dataset.id);
  if (!f) return;
  const e = E();
  const c = f.catId && S.cat(f.catId);
  const t = await addTx({ type: f.type, amount: f.amount, catId: c ? c.id : null, subId: f.subId && S.cat(f.subId) ? f.subId : null, channelId: f.channelId && S.channel(f.channelId) ? f.channelId : e.channelId, date: e.date, note: f.note }, { label: f.note });
  if (t) render();
});

on('addFav', async () => {
  const e = E();
  const amount = U.calcEval(e.expr);
  if (!amount || !e.catId) {
    await ask({ title: 'เพิ่มรายการโปรด', body: 'กรอกยอด เลือกหมวด (และพิมพ์โน้ต) ให้เรียบร้อยก่อน แล้วแตะ + อีกครั้ง\nจัดการรายการโปรดได้ที่ ตั้งค่า → รายการโปรด', buttons: [{ label: 'เข้าใจแล้ว', value: true, kind: 'primary' }] });
    return;
  }
  const r = await ask({ title: 'ตั้งชื่อรายการโปรด', input: { value: e.note.trim() || catName(e.catId), maxlength: 30 }, buttons: [{ label: 'ยกเลิก', value: false }, { label: 'เพิ่ม', value: true, kind: 'primary' }] });
  if (!r.value || !r.input.trim()) return;
  await S.putFav({ id: U.uid('f'), type: e.type, note: r.input.trim(), amount, catId: e.catId, subId: e.subId, channelId: e.channelId, order: D.favs.length });
  toast(`เพิ่ม "${r.input.trim()}" ในรายการโปรดแล้ว`);
  render();
});

on('newCat', () => openSheet('catEdit', { id: null, type: E().type, parentId: null, name: '', emoji: '', fromEntry: true }));

on('endTrip', async () => {
  const t = S.activeTrip();
  if (!t) return;
  if (!(await confirm('ปิดทริป?', `รายการที่บันทึกหลังจากนี้จะไม่ติดชื่อ "${t.name}"`, 'ปิดทริป'))) return;
  await S.endTrip();
  toast(`จบทริป ${t.name}`, { label: 'ดูสรุป', fn: () => { UI.summary = { ...UI.summary, mode: 'trip', tripId: t.id }; goTab('summary'); } });
  render();
});
