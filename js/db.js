// เก็บข้อมูลทั้งหมดใน IndexedDB ของเครื่อง และโหลดขึ้นหน่วยความจำตอนเปิดแอป
// ข้อมูลส่วนตัวไม่มีวันส่งออกนอกเครื่อง ยกเว้นตอนผู้ใช้กดส่งออกไฟล์เอง

const DB_NAME = 'rr-app';
const DB_VERSION = 1;
export const STORES = ['tx', 'cats', 'channels', 'plans', 'recurring', 'favs', 'trips', 'kv'];

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadAll() {
  const db = await open();
  const out = {};
  await Promise.all(STORES.map((s) => new Promise((resolve, reject) => {
    const req = db.transaction(s).objectStore(s).getAll();
    req.onsuccess = () => { out[s] = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  })));
  return out;
}

// เขียนหลายรายการในหลาย store พร้อมกัน: ops = [{store, put: obj} | {store, del: id}]
export async function write(ops) {
  if (!ops.length) return;
  const db = await open();
  const stores = [...new Set(ops.map((o) => o.store))];
  const tx = db.transaction(stores, 'readwrite');
  for (const o of ops) {
    const st = tx.objectStore(o.store);
    if (o.put) st.put(o.put); else st.delete(o.del);
  }
  return done(tx);
}

export async function clearAll() {
  const db = await open();
  const tx = db.transaction(STORES, 'readwrite');
  for (const s of STORES) tx.objectStore(s).clear();
  return done(tx);
}
