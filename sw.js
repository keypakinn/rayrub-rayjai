// Service worker: เก็บไฟล์ของแอปไว้ในเครื่อง ใช้งานออฟไลน์ได้
// เปลี่ยน VERSION ทุกครั้งที่อัปเดตแอป เพื่อให้แอปแจ้ง "มีเวอร์ชันใหม่"
const VERSION = 'v1.3.1';
const CACHE = 'rr-' + VERSION;
const FILES = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/db.js', 'js/util.js', 'js/excel.js', 'js/ui.js', 'js/common.js',
  'js/v-entry.js', 'js/v-summary.js', 'js/v-list.js', 'js/v-plans.js', 'js/v-settings.js', 'js/v-install.js', 'js/charts.js',
  'vendor/exceljs.min.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rr-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'version' && e.source) e.source.postMessage({ version: VERSION });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    }),
  );
});
