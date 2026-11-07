// ข้อมูลในหน่วยความจำ + กติกาทางธุรกิจ (บันทึก ผ่อน รายการประจำ ทริป)
import * as db from './db.js';
import { uid, today, monthOf, addMonths, clampDate, round2, thisMonth } from './util.js';

export const D = { tx: [], cats: [], channels: [], plans: [], recurring: [], favs: [], trips: [], settings: null };

const DEFAULT_EXPENSE = [
  ['อาหาร', '🍜'], ['เครื่องดื่ม', '☕'], ['ช้อปปิ้ง', '🛍️'], ['ลงทุน', '📈'], ['ครอบครัว', '👨‍👩‍👧'], ['ค่าบ้าน', '🏠'],
  ['ค่ารถ', '🚗'], ['บันเทิง', '🎬'], ['เดินทาง', '🚆'], ['ที่พัก', '🏨'], ['อื่นๆ', '📦'],
];
const DEFAULT_INCOME = [['เงินเดือน', '💼'], ['โบนัส', '🎁'], ['รายได้เสริม', '💰'], ['อื่นๆ', '📦']];
const DEFAULT_CHANNELS = ['โอน', 'เงินสด', 'บัตรเครดิต'];

function seedData() {
  const cats = [
    ...DEFAULT_EXPENSE.map(([name, emoji], i) => ({ id: uid('c'), type: 'expense', name, emoji, order: i, hidden: false, parentId: null })),
    ...DEFAULT_INCOME.map(([name, emoji], i) => ({ id: uid('c'), type: 'income', name, emoji, order: i, hidden: false, parentId: null })),
  ];
  const channels = DEFAULT_CHANNELS.map((name, i) => ({ id: uid('h'), name, order: i }));
  const settings = {
    id: 'settings', target: null, activeTripId: null, hideAmounts: false,
    defaultChannelId: channels[0].id, planChannelId: channels[2].id, seeded: true,
  };
  return { cats, channels, settings };
}

export async function init() {
  const all = await db.loadAll();
  let settings = all.kv.find((k) => k.id === 'settings');
  if (!settings) {
    const s = seedData();
    all.cats = s.cats; all.channels = s.channels; settings = s.settings;
    await db.write([
      ...s.cats.map((c) => ({ store: 'cats', put: c })),
      ...s.channels.map((c) => ({ store: 'channels', put: c })),
      { store: 'kv', put: settings },
    ]);
  }
  Object.assign(D, { tx: all.tx, cats: all.cats, channels: all.channels, plans: all.plans, recurring: all.recurring, favs: all.favs, trips: all.trips, settings });
  await runRecurring();
}

export async function resetAll() {
  await db.clearAll();
  Object.assign(D, { tx: [], cats: [], channels: [], plans: [], recurring: [], favs: [], trips: [], settings: null });
  await init();
}

// ---------- ค้นหา ----------
export const cat = (id) => D.cats.find((c) => c.id === id);
export const channel = (id) => D.channels.find((c) => c.id === id);
export const trip = (id) => D.trips.find((t) => t.id === id);
export const plan = (id) => D.plans.find((p) => p.id === id);

export function topCats(type, includeHidden = false) {
  return D.cats.filter((c) => c.type === type && !c.parentId && (includeHidden || !c.hidden)).sort((a, b) => a.order - b.order);
}
export function subCats(parentId, includeHidden = false) {
  return D.cats.filter((c) => c.parentId === parentId && (includeHidden || !c.hidden)).sort((a, b) => a.order - b.order);
}
export function sortedChannels() { return [...D.channels].sort((a, b) => a.order - b.order); }
export function sortedFavs() { return [...D.favs].sort((a, b) => a.order - b.order); }
export function activeTrip() { return D.settings.activeTripId ? trip(D.settings.activeTripId) : null; }

export async function saveSettings(patch) {
  Object.assign(D.settings, patch);
  await db.write([{ store: 'kv', put: D.settings }]);
}

// ---------- รายการ ----------
export function newTx(fields) {
  return {
    id: uid('t'), type: 'expense', amount: 0, catId: null, subId: null, channelId: null,
    date: today(), note: '', tripId: null, planId: null, planName: null, planSeq: null, recurId: null,
    createdAt: Date.now(), ...fields,
  };
}
export async function putTx(list) {
  const arr = Array.isArray(list) ? list : [list];
  for (const t of arr) {
    const i = D.tx.findIndex((x) => x.id === t.id);
    if (i >= 0) D.tx[i] = t; else D.tx.push(t);
  }
  await db.write(arr.map((t) => ({ store: 'tx', put: t })));
}
export async function deleteTx(ids) {
  const set = new Set(ids);
  D.tx = D.tx.filter((t) => !set.has(t.id));
  // ถอดงวดผ่อนออกจากตารางของรายการผ่อน เพื่อไม่ให้ลิงก์ค้าง (ตารางงวดยังอยู่ ใช้นับความคืบหน้า)
  const ops = ids.map((id) => ({ store: 'tx', del: id }));
  for (const p of D.plans) {
    let changed = false;
    for (const s of p.schedule) if (s.txId && set.has(s.txId)) { s.txId = null; changed = true; }
    if (changed) ops.push({ store: 'plans', put: p });
  }
  await db.write(ops);
}

// รายการซ้ำ: ยอด ประเภท หมวด เดียวกัน บันทึกภายใน 1 นาที
export function findRecentDuplicate(t) {
  const now = Date.now();
  return D.tx.find((x) => x.type === t.type && x.amount === t.amount && x.catId === t.catId && now - x.createdAt < 60000 && !x.planId && !x.recurId);
}

// ---------- หมวด ----------
export async function putCats(list) {
  const arr = Array.isArray(list) ? list : [list];
  for (const c of arr) { const i = D.cats.findIndex((x) => x.id === c.id); if (i >= 0) D.cats[i] = c; else D.cats.push(c); }
  await db.write(arr.map((c) => ({ store: 'cats', put: c })));
}
export function txCountForCat(catId) {
  return D.tx.filter((t) => t.catId === catId || t.subId === catId).length;
}
export async function deleteCat(catId, moveTo = null) {
  const c = cat(catId);
  const subs = D.cats.filter((x) => x.parentId === catId);
  const removeIds = new Set([catId, ...subs.map((s) => s.id)]);
  const changed = [];
  for (const t of D.tx) {
    if (c.parentId) { // ลบหมวดย่อย: รายการยังอยู่ในหมวดหลัก
      if (t.subId === catId) { t.subId = null; changed.push(t); }
    } else if (t.catId === catId) { t.catId = moveTo; t.subId = null; changed.push(t); }
  }
  const ops = changed.map((t) => ({ store: 'tx', put: t }));
  for (const f of D.favs) if (removeIds.has(f.catId) || removeIds.has(f.subId)) { if (f.subId === catId) f.subId = null; else { f.catId = moveTo; f.subId = null; } ops.push({ store: 'favs', put: f }); }
  for (const r of D.recurring) if (removeIds.has(r.catId) || removeIds.has(r.subId)) { if (r.subId === catId) r.subId = null; else { r.catId = moveTo; r.subId = null; } ops.push({ store: 'recurring', put: r }); }
  for (const p of D.plans) if (removeIds.has(p.catId) || removeIds.has(p.subId)) { if (p.subId === catId) p.subId = null; else { p.catId = moveTo; p.subId = null; } ops.push({ store: 'plans', put: p }); }
  D.cats = D.cats.filter((x) => !removeIds.has(x.id));
  for (const id of removeIds) ops.push({ store: 'cats', del: id });
  await db.write(ops);
}

// ---------- ช่องทาง ----------
export async function putChannels(list) {
  const arr = Array.isArray(list) ? list : [list];
  for (const c of arr) { const i = D.channels.findIndex((x) => x.id === c.id); if (i >= 0) D.channels[i] = c; else D.channels.push(c); }
  await db.write(arr.map((c) => ({ store: 'channels', put: c })));
}
export async function deleteChannel(id, moveTo) {
  const ops = [];
  for (const t of D.tx) if (t.channelId === id) { t.channelId = moveTo; ops.push({ store: 'tx', put: t }); }
  for (const s of ['favs', 'recurring', 'plans']) for (const x of D[s]) if (x.channelId === id) { x.channelId = moveTo; ops.push({ store: s, put: x }); }
  D.channels = D.channels.filter((c) => c.id !== id);
  ops.push({ store: 'channels', del: id });
  if (D.settings.defaultChannelId === id) D.settings.defaultChannelId = moveTo;
  if (D.settings.planChannelId === id) D.settings.planChannelId = moveTo;
  ops.push({ store: 'kv', put: D.settings });
  await db.write(ops);
}

// ---------- รายการโปรด ----------
export async function putFav(f) {
  const i = D.favs.findIndex((x) => x.id === f.id); if (i >= 0) D.favs[i] = f; else D.favs.push(f);
  await db.write([{ store: 'favs', put: f }]);
}
export async function deleteFav(id) { D.favs = D.favs.filter((f) => f.id !== id); await db.write([{ store: 'favs', del: id }]); }
export async function reorder(store, ids) {
  const ops = [];
  ids.forEach((id, i) => { const x = D[store].find((y) => y.id === id); if (x) { x.order = i; ops.push({ store, put: x }); } });
  await db.write(ops);
}

// ---------- ทริป ----------
export async function startTrip(name) {
  const t = { id: uid('p'), name, startedAt: Date.now(), endedAt: null };
  D.trips.push(t);
  D.settings.activeTripId = t.id;
  await db.write([{ store: 'trips', put: t }, { store: 'kv', put: D.settings }]);
  return t;
}
export async function endTrip() {
  const t = activeTrip();
  D.settings.activeTripId = null;
  const ops = [{ store: 'kv', put: D.settings }];
  if (t) { t.endedAt = Date.now(); ops.push({ store: 'trips', put: t }); }
  await db.write(ops);
  return t;
}
export async function renameTrip(id, name) { const t = trip(id); t.name = name; await db.write([{ store: 'trips', put: t }]); }
export async function deleteTrip(id) {
  const ops = [];
  for (const t of D.tx) if (t.tripId === id) { t.tripId = null; ops.push({ store: 'tx', put: t }); }
  D.trips = D.trips.filter((t) => t.id !== id);
  if (D.settings.activeTripId === id) { D.settings.activeTripId = null; ops.push({ store: 'kv', put: D.settings }); }
  ops.push({ store: 'trips', del: id });
  await db.write(ops);
}
export function tripNameTaken(name, exceptId = null) {
  const n = name.trim().toLowerCase();
  return D.trips.some((t) => t.id !== exceptId && t.name.trim().toLowerCase() === n);
}

// ---------- ผ่อน ----------
// สร้างตารางงวด: amounts แบ่งจากยอดรวม (เศษไปงวดสุดท้าย) หรือใช้ยอดต่องวดเท่ากันทุกงวด
export function buildSchedule({ mode, amount, count, firstDate }) {
  const day = Number(firstDate.slice(8, 10));
  const startYm = monthOf(firstDate);
  let amounts;
  if (mode === 'total') {
    const per = Math.floor((amount / count) * 100) / 100;
    amounts = Array(count).fill(per);
    amounts[count - 1] = round2(amount - per * (count - 1));
  } else amounts = Array(count).fill(round2(amount));
  return amounts.map((a, i) => ({ date: clampDate(addMonths(startYm, i), day), amount: a, txId: null }));
}

export async function createPlan({ name, mode, amount, count, firstDate, catId, subId, channelId }) {
  const p = {
    id: uid('i'), name, catId, subId, channelId, day: Number(firstDate.slice(8, 10)),
    schedule: buildSchedule({ mode, amount, count, firstDate }), closedAt: null, createdAt: Date.now(),
  };
  const txs = p.schedule.map((s, i) => {
    const t = newTx({ type: 'expense', amount: s.amount, catId, subId, channelId, date: s.date, note: `${name} (งวด ${i + 1}/${count})`, planId: p.id, planName: name, planSeq: `${i + 1}/${count}` });
    s.txId = t.id;
    return t;
  });
  D.plans.push(p);
  D.tx.push(...txs);
  await db.write([{ store: 'plans', put: p }, ...txs.map((t) => ({ store: 'tx', put: t }))]);
  return p;
}

export function planStats(p, ref = today()) {
  const total = p.schedule.length;
  const paid = p.schedule.filter((s) => s.date <= ref).length;
  const left = round2(p.schedule.filter((s) => s.date > ref).reduce((a, s) => a + s.amount, 0));
  const last = p.schedule[total - 1];
  const next = p.schedule.find((s) => s.date > ref);
  return { total, paid, left, endDate: last ? last.date : null, next, done: paid >= total };
}

// แก้งวดที่ยังไม่ถึงวัน (ยอด หมวด ช่องทาง ชื่อ)
export async function editPlanFuture(p, { name, amount, catId, subId, channelId }) {
  const ref = today();
  const ops = [];
  p.name = name; p.catId = catId; p.subId = subId; p.channelId = channelId;
  const n = p.schedule.length;
  p.schedule.forEach((s, i) => {
    if (s.date <= ref) return;
    if (amount != null) s.amount = round2(amount);
    const t = s.txId && D.tx.find((x) => x.id === s.txId);
    if (t) {
      Object.assign(t, { amount: s.amount, catId, subId, channelId, planName: name, note: `${name} (งวด ${i + 1}/${n})` });
      ops.push({ store: 'tx', put: t });
    }
  });
  ops.push({ store: 'plans', put: p });
  await db.write(ops);
}

// ปิดยอดก่อนกำหนด: ลบงวดที่ยังไม่ถึง แล้วลงรายการ "ปิดยอด" 1 รายการ
export async function closePlanEarly(p, payoffAmount, date = today()) {
  const future = p.schedule.filter((s) => s.date > date);
  const delIds = future.map((s) => s.txId).filter(Boolean);
  const paidCount = p.schedule.length - future.length;
  p.schedule = p.schedule.filter((s) => s.date <= date);
  const t = newTx({ type: 'expense', amount: round2(payoffAmount), catId: p.catId, subId: p.subId, channelId: p.channelId, date, note: `${p.name} (ปิดยอด)`, planId: p.id, planName: p.name, planSeq: 'ปิดยอด' });
  p.schedule.push({ date, amount: t.amount, txId: t.id, payoff: true });
  p.closedAt = Date.now();
  D.tx = D.tx.filter((x) => !delIds.includes(x.id));
  D.tx.push(t);
  await db.write([...delIds.map((id) => ({ store: 'tx', del: id })), { store: 'tx', put: t }, { store: 'plans', put: p }]);
  return paidCount;
}

export async function deletePlan(p) {
  const ids = D.tx.filter((t) => t.planId === p.id).map((t) => t.id);
  D.tx = D.tx.filter((t) => t.planId !== p.id);
  D.plans = D.plans.filter((x) => x.id !== p.id);
  await db.write([...ids.map((id) => ({ store: 'tx', del: id })), { store: 'plans', del: p.id }]);
}

// ---------- รายการประจำ ----------
export async function putRecurring(r) {
  const i = D.recurring.findIndex((x) => x.id === r.id); if (i >= 0) D.recurring[i] = r; else D.recurring.push(r);
  await db.write([{ store: 'recurring', put: r }]);
  await runRecurring();
}
export async function deleteRecurring(id) { D.recurring = D.recurring.filter((r) => r.id !== id); await db.write([{ store: 'recurring', del: id }]); }

// ลงรายการประจำที่ถึงกำหนดแล้วแต่ยังไม่ได้ลง (รวมเดือนที่ไม่ได้เปิดแอป)
export async function runRecurring() {
  const ref = today();
  const cur = thisMonth();
  const ops = [];
  for (const r of D.recurring) {
    if (!r.active) continue;
    let ym = r.startMonth;
    let guard = 0;
    let changed = false;
    while (ym <= cur && guard++ < 240) {
      const date = clampDate(ym, r.day);
      if (date <= ref && !r.generated.includes(ym)) {
        const t = newTx({ type: r.type, amount: r.amount, catId: r.catId, subId: r.subId, channelId: r.channelId, date, note: r.name, recurId: r.id });
        D.tx.push(t);
        r.generated.push(ym);
        ops.push({ store: 'tx', put: t });
        changed = true;
      }
      ym = addMonths(ym, 1);
    }
    if (changed) ops.push({ store: 'recurring', put: r });
  }
  if (ops.length) await db.write(ops);
  return ops.filter((o) => o.store === 'tx').length;
}
export function nextRecurringDate(r) {
  const ref = today();
  let ym = r.startMonth < thisMonth() ? thisMonth() : r.startMonth;
  for (let i = 0; i < 24; i++) {
    const d = clampDate(ym, r.day);
    if (!r.generated.includes(ym) && d >= ref) return d;
    ym = addMonths(ym, 1);
  }
  return null;
}

// ---------- นำเข้า / ล้าง ----------
export async function bulkImport({ tx, cats, channels, trips }) {
  D.tx.push(...tx); D.cats.push(...cats); D.channels.push(...channels); D.trips.push(...trips);
  await db.write([
    ...cats.map((c) => ({ store: 'cats', put: c })), ...channels.map((c) => ({ store: 'channels', put: c })),
    ...trips.map((t) => ({ store: 'trips', put: t })), ...tx.map((t) => ({ store: 'tx', put: t })),
  ]);
}
