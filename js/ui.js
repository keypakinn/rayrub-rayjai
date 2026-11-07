// โครงกลางของหน้าจอ: สถานะ UI, การวาดใหม่, ปุ่มกด, แผ่นล่าง, กล่องถาม และข้อความแจ้ง
import { D } from './store.js';
import { esc, num, thisMonth } from './util.js';

export const UI = {
  tab: 'entry',
  sheet: null, // { kind, ...state }
  updateWorker: null,
  views: {}, sheets: {},
};

// ---------- ทะเบียนการกระทำ ----------
const actions = {}; const inputs = {}; const changes = {};
export function on(name, fn) { actions[name] = fn; }
export function onInput(name, fn) { inputs[name] = fn; }
export function onChange(name, fn) { changes[name] = fn; }
export function registerView(name, fn) { UI.views[name] = fn; }
export function registerSheet(kind, fn) { UI.sheets[kind] = fn; }

// ---------- การวาด ----------
const afterHooks = [];
export function afterRender(fn) { afterHooks.push(fn); }
export function render() {
  const view = document.getElementById('view');
  view.innerHTML = UI.views[UI.tab]();
  document.getElementById('tabs').innerHTML = tabsHtml();
  renderSheet();
  for (const h of afterHooks) h();
  updateLock();
}
// เนื้อหาพอดีจอ → ล็อกไม่ให้เลื่อน (กันหน้าจอเด้งจนกดอะไรไม่ได้)
export function updateLock() {
  const v = document.getElementById('view');
  if (!v) return;
  v.classList.remove('lock');
  if (v.scrollHeight <= v.clientHeight + 1) v.classList.add('lock');
}
window.addEventListener('resize', () => updateLock());
export function renderSheet() {
  const root = document.getElementById('sheet-root');
  if (!UI.sheet) { root.innerHTML = ''; delete root.dataset.kind; return; }
  const prevBody = root.querySelector('.sheet-body');
  const keep = prevBody && root.dataset.kind === UI.sheet.kind ? prevBody.scrollTop : 0;
  const fresh = root.dataset.kind !== UI.sheet.kind || !root.firstElementChild;
  root.dataset.kind = UI.sheet.kind;
  root.innerHTML = `<div class="backdrop ${fresh ? '' : 'no-anim'}" data-a="sheetBackdrop">${UI.sheets[UI.sheet.kind](UI.sheet)}</div>`;
  const body = root.querySelector('.sheet-body');
  if (body && keep) body.scrollTop = keep;
}
export function openSheet(kind, state = {}) { UI.sheet = { kind, ...state }; renderSheet(); }
export function closeSheet() { UI.sheet = null; renderSheet(); render(); }

export function sheetHead(title, { left = 'ปิด', leftA = 'closeSheet', right = '', rightA = '', rightDisabled = false } = {}) {
  return `<div class="sheet-head">
    <button class="link" data-a="${leftA}">${esc(left)}</button>
    <h2>${esc(title)}</h2>
    ${right ? `<button class="link r" data-a="${rightA}" ${rightDisabled ? 'disabled' : ''}>${esc(right)}</button>` : '<span style="min-width:72px"></span>'}
  </div>`;
}

const TABS = [
  ['entry', 'บันทึก', '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'],
  ['summary', 'สรุป', '<path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/>'],
  ['list', 'รายการ', '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>'],
  ['plans', 'ผ่อน', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ['settings', 'ตั้งค่า', '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'],
];
function tabsHtml() {
  return TABS.map(([k, label, path]) => `<button data-a="tab" data-v="${k}" ${UI.tab === k ? 'aria-current="page"' : ''}>
    ${svg(path, 24)}<span>${label}</span>${k === 'settings' && UI.updateWorker ? '<span class="sr">มีเวอร์ชันใหม่</span>' : ''}</button>`).join('');
}
export function goTab(t) { UI.tab = t; document.getElementById('view').scrollTop = 0; render(); }

export function svg(path, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
export const ICON = {
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  grip: '<path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" stroke-width="3"/>',
  check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};

// ---------- เงิน ----------
export function m(n, sign = '') {
  if (D.settings && D.settings.hideAmounts) return '••••';
  return `${sign}฿${num(Math.abs(n))}`;
}

// ---------- กล่องถาม (คืนค่า Promise) ----------
// opts: { title, body, buttons: [{label, value, kind}], input: {type, value, placeholder, inputmode}, select: {options:[{value,label}], value}, vertical }
export function ask(opts) {
  return new Promise((resolve) => {
    const root = document.getElementById('dialog-root');
    const btns = opts.buttons || [{ label: 'ยกเลิก', value: false }, { label: 'ตกลง', value: true, kind: 'primary' }];
    root.innerHTML = `<div class="dialog-wrap" data-dlg="bg"><div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
      <h2>${esc(opts.title)}</h2>
      ${opts.body ? `<p>${esc(opts.body)}</p>` : ''}
      ${opts.input ? `<input id="dlg-input" type="${opts.input.type || 'text'}" value="${esc(opts.input.value ?? '')}" placeholder="${esc(opts.input.placeholder || '')}" ${opts.input.inputmode ? `inputmode="${opts.input.inputmode}"` : ''} ${opts.input.maxlength ? `maxlength="${opts.input.maxlength}"` : ''}>` : ''}
      ${opts.select ? `<select id="dlg-select">${opts.select.options.map((o) => `<option value="${esc(o.value)}" ${o.value === opts.select.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>` : ''}
      <div class="btns ${opts.vertical || btns.length > 2 ? 'vertical' : ''}">
        ${btns.map((b, i) => `<button class="btn ${b.kind || ''}" data-dlg="${i}">${esc(b.label)}</button>`).join('')}
      </div></div></div>`;
    const inp = root.querySelector('#dlg-input');
    if (inp) setTimeout(() => { inp.focus(); inp.select?.(); }, 50);
    root.onclick = (ev) => {
      const el = ev.target.closest('[data-dlg]');
      if (!el) return;
      if (el.dataset.dlg === 'bg' && ev.target !== el) return;
      const i = el.dataset.dlg === 'bg' ? -1 : Number(el.dataset.dlg);
      const value = i < 0 ? false : btns[i].value;
      const input = inp ? inp.value : undefined;
      const sel = root.querySelector('#dlg-select');
      root.innerHTML = ''; root.onclick = null;
      resolve({ value, input, select: sel ? sel.value : undefined });
    };
  });
}
export async function confirm(title, body, okLabel = 'ตกลง', danger = false) {
  const r = await ask({ title, body, buttons: [{ label: 'ยกเลิก', value: false }, { label: okLabel, value: true, kind: danger ? 'danger' : 'primary' }] });
  return r.value === true;
}

// ---------- ข้อความแจ้ง ----------
// แถบแจ้งเตือนลอยเหนือเมนูด้านล่าง: แตะหรือปัดลงเพื่อปิด, หายเองใน 2.5 วิ (มีปุ่มเลิกทำ 4 วิ)
let toastTimer = null;
function hideToast() {
  const root = document.getElementById('toast-root');
  const el = root.querySelector('.toast');
  clearTimeout(toastTimer);
  if (!el) return;
  el.classList.add('gone');
  setTimeout(() => { if (root.contains(el)) root.innerHTML = ''; }, 160);
}
export function toast(msg, action = null, ms = null) {
  const root = document.getElementById('toast-root');
  clearTimeout(toastTimer);
  root.innerHTML = `<div class="toast-wrap"><div class="toast" role="status"><span>${esc(msg)}</span>${action ? `<button data-toast="1">${esc(action.label)}</button>` : ''}</div></div>`;
  const el = root.querySelector('.toast');
  el.onclick = async (ev) => {
    if (ev.target.closest('[data-toast]')) { root.innerHTML = ''; clearTimeout(toastTimer); await action.fn(); return; }
    hideToast();
  };
  let y0 = null;
  el.addEventListener('touchstart', (ev) => { y0 = ev.touches[0].clientY; el.style.transition = 'none'; }, { passive: true });
  el.addEventListener('touchmove', (ev) => { if (y0 === null) return; const dy = Math.max(0, ev.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; el.style.opacity = String(Math.max(0.2, 1 - dy / 80)); }, { passive: true });
  el.addEventListener('touchend', (ev) => {
    if (y0 === null) return;
    const dy = ev.changedTouches[0].clientY - y0; y0 = null; el.style.transition = '';
    if (dy > 30) { el.style.transform = ''; el.style.opacity = ''; hideToast(); } else { el.style.transform = ''; el.style.opacity = ''; }
  });
  toastTimer = setTimeout(hideToast, ms || (action ? 4000 : 2500));
}

// ---------- ตัวจัดการเหตุการณ์ส่วนกลาง ----------
let suppressClickUntil = 0;
export function suppressNextClick() { suppressClickUntil = Date.now() + 350; }
export function installEvents() {
  document.addEventListener('click', async (ev) => {
    if (Date.now() < suppressClickUntil) { ev.preventDefault(); ev.stopPropagation(); return; }
    const el = ev.target.closest('[data-a]');
    if (!el) return;
    const name = el.dataset.a;
    if (name === 'sheetBackdrop') { if (ev.target === el) closeSheet(); return; }
    if (name === 'closeSheet') { closeSheet(); return; }
    if (name === 'tab') { goTab(el.dataset.v); return; }
    const fn = actions[name];
    if (fn) { ev.preventDefault(); await fn(el, ev); }
  }, true);
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-in]');
    if (el && inputs[el.dataset.in]) inputs[el.dataset.in](el, ev);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-ch]');
    if (el && changes[el.dataset.ch]) changes[el.dataset.ch](el, ev);
  });
}

// ตัวเลือก <option> สำหรับหมวด/ช่องทาง
export function optionsHtml(list, value, { none = null } = {}) {
  return (none !== null ? `<option value="" ${!value ? 'selected' : ''}>${esc(none)}</option>` : '') +
    list.map((o) => `<option value="${esc(o.value)}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
}
export function monthNow() { return thisMonth(); }
