// แผ่นแนะนำการเพิ่มแอปลงหน้าจอโฮม (iPhone ไม่มีปุ่มติดตั้งอัตโนมัติ ต้องทำผ่านเมนูแชร์ของ Safari)
import { on, registerSheet, openSheet, closeSheet, sheetHead, svg } from './ui.js';
import { isStandalone } from './common.js';

const SEEN_KEY = 'rr-install-guide-seen';
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const I = {
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  add: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
  toggle: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="17" cy="12" r="3" fill="currentColor"/>',
  home: '<rect x="5" y="2" width="14" height="20" rx="3"/><rect x="8" y="6" width="3" height="3" rx="1"/><rect x="13" y="6" width="3" height="3" rx="1"/><rect x="8" y="11" width="3" height="3" rx="1"/>',
};

function step(n, icon, title, detail) {
  return `<div class="row" style="align-items:flex-start;gap:12px">
    <span style="flex:none;width:26px;height:26px;border-radius:13px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600">${n}</span>
    <span style="flex:none;width:44px;height:44px;border-radius:12px;background:#1B2433;color:var(--inc-text);display:flex;align-items:center;justify-content:center">${svg(icon, 24)}</span>
    <span style="flex:1;display:flex;flex-direction:column;gap:2px;padding-top:2px"><b style="font-weight:600">${title}</b>${detail ? `<span class="small muted">${detail}</span>` : ''}</span>
  </div>`;
}

registerSheet('install', () => `<div class="sheet">
  ${sheetHead('เพิ่มลงหน้าจอโฮม', { left: 'ไว้ทีหลัง' })}
  <div class="sheet-body" style="gap:16px">
    <p class="small muted">iPhone ไม่มีปุ่มติดตั้งอัตโนมัติ ต้องเพิ่มเองผ่าน Safari ทำครั้งเดียวต่อเครื่อง ใช้เวลาไม่ถึงนาที</p>
    ${step(1, I.more, 'แตะปุ่ม ••• ที่แถบด้านล่างของ Safari', 'ถ้าเห็นปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) อยู่แล้ว แตะปุ่มแชร์ได้เลย แล้วข้ามไปข้อ 3')}
    ${step(2, I.share, 'แตะ "แชร์"', '')}
    ${step(3, I.add, 'เลื่อนลง แล้วแตะ "เพิ่มไปยังหน้าจอโฮม"', 'ถ้าไม่เจอ ให้เลื่อนลงสุดแล้วแตะ "แก้ไขการทำงาน" เพื่อเพิ่มเมนูนี้')}
    ${step(4, I.toggle, 'เปิด "เปิดเป็นเว็บแอป" ไว้ แล้วแตะ "เพิ่ม"', 'บาง iOS ไม่มีสวิตช์นี้ แตะ "เพิ่ม" ได้เลย')}
    ${step(5, I.home, 'ต่อจากนี้เปิดแอปจากไอคอนบนหน้าจอโฮมเท่านั้น', 'ข้อมูลใน Safari กับในไอคอนแยกกัน และ Safari อาจลบข้อมูลเองถ้าไม่ได้เปิดนาน')}
    <div class="install-arrow" aria-hidden="true">
      <span class="small muted">ปุ่ม ••• / แชร์ อยู่แถบล่างของ Safari</span>
      ${svg('<path d="M12 4v15M6 13l6 6 6-6"/>', 32)}
    </div>
  </div>
</div>`);

on('installHelp', () => openSheet('install'));

// เปิดใน Safari ครั้งแรก (ยังไม่ได้เพิ่มลงหน้าจอโฮม) ให้แสดงแผ่นแนะนำเอง 1 ครั้ง
export function maybeShowInstallGuide() {
  if (isStandalone() || !isIOS()) return;
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* โหมดส่วนตัว */ }
  if (!seen) openSheet('install');
}
export { closeSheet };
