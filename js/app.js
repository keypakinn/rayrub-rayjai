// จุดเริ่มต้นของแอป
import * as S from './store.js';
import { UI, render, installEvents, afterRender, toast } from './ui.js';
import './v-entry.js';
import './v-summary.js';
import './v-list.js';
import './v-plans.js';
import { settingsAfterRender } from './v-settings.js';
import { maybeShowInstallGuide } from './v-install.js';

afterRender(settingsAfterRender);

async function start() {
  installEvents();
  try {
    await S.init();
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="empty">เปิดฐานข้อมูลในเครื่องไม่ได้<br>${String(e && e.message)}<br><br>ถ้าเปิดในโหมดส่วนตัวของ Safari ให้ปิดโหมดส่วนตัวก่อน</div>`;
    return;
  }
  render();
  maybeShowInstallGuide();
  registerSW();
  // กลับมาเปิดแอปวันใหม่: ลงรายการประจำที่ถึงกำหนด และอัปเดตวันที่ "วันนี้"
  let lastDay = new Date().toDateString();
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const d = new Date().toDateString();
    if (d !== lastDay) {
      lastDay = d;
      const n = await S.runRecurring();
      UI.entry = null; // เริ่มหน้าบันทึกใหม่ด้วยวันที่วันนี้
      render();
      if (n) toast(`ลงรายการประจำให้ ${n} รายการ`);
    }
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    UI.swReg = reg;
    const watch = (w) => {
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          UI.updateWorker = w;
          render();
          toast('มีเวอร์ชันใหม่', { label: 'อัปเดต', fn: () => w.postMessage('skipWaiting') }, 10000);
        }
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) { UI.updateWorker = reg.waiting; render(); }
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    // เช็กอัปเดตทุกครั้งที่กลับมาเปิดแอป
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !(UI.updateWorker || UI.applying)) return; // เปิดครั้งแรกไม่ต้องรีโหลด
    reloading = true; location.reload();
  });
}

start();
