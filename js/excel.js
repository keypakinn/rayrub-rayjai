// ส่งออกเป็น Excel (ตาราง Excel Table พร้อมทำ Pivot) / CSV และนำเข้ากลับ
import { D, cat, channel, trip, plan, newTx } from './store.js';
import { uid, ymd, round2 } from './util.js';

export const COLUMNS = ['รหัส', 'วันที่', 'ปี', 'เดือน', 'ประเภท', 'หมวด', 'หมวดย่อย', 'ช่องทาง', 'ยอด', 'ยอดสุทธิ', 'รายการผ่อน', 'งวด', 'ทริป', 'โน้ต'];

function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/exceljs.min.js';
    s.onload = () => resolve(window.ExcelJS);
    s.onerror = () => reject(new Error('โหลดตัวสร้างไฟล์ Excel ไม่ได้'));
    document.head.appendChild(s);
  });
}

export function txInRange(from, to) { // from/to = 'YYYY-MM' (รวมทั้งสองเดือน)
  return D.tx.filter((t) => { const m = t.date.slice(0, 7); return m >= from && m <= to; })
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
}

function rowOf(t) {
  const c = t.catId ? cat(t.catId) : null;
  const s = t.subId ? cat(t.subId) : null;
  const ch = t.channelId ? channel(t.channelId) : null;
  const tr = t.tripId ? trip(t.tripId) : null;
  const p = t.planId ? plan(t.planId) : null;
  const [y, m, d] = t.date.split('-').map(Number);
  return {
    id: t.id, date: new Date(Date.UTC(y, m - 1, d)), dateStr: t.date, year: y, month: t.date.slice(0, 7),
    type: t.type === 'income' ? 'รายรับ' : 'รายจ่าย', cat: c ? c.name : '', sub: s ? s.name : '',
    channel: ch ? ch.name : '', amount: t.amount, net: t.type === 'income' ? t.amount : -t.amount,
    plan: p ? p.name : (t.planName || ''), seq: t.planSeq || '', trip: tr ? tr.name : '', note: t.note || '',
  };
}

export function fileName(from, to, ext) {
  return from === to ? `รายรับรายจ่าย_${from}.${ext}` : `รายรับรายจ่าย_${from}_${to}.${ext}`;
}

export async function buildXlsx(list) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'รายรับ-รายจ่าย';
  wb.created = new Date();
  const ws = wb.addWorksheet('รายการ', { views: [{ state: 'frozen', ySplit: 1 }] });
  const rows = list.map(rowOf).map((r) => [r.id, r.date, r.year, r.month, r.type, r.cat, r.sub, r.channel, r.amount, r.net, r.plan, r.seq, r.trip, r.note]);
  ws.addTable({
    name: 'Transactions', ref: 'A1', headerRow: true, totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: COLUMNS.map((name) => ({ name, filterButton: true })),
    rows,
  });
  const widths = [16, 12, 7, 9, 9, 14, 14, 12, 12, 12, 16, 8, 16, 30];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.getColumn(2).numFmt = 'yyyy-mm-dd';
  ws.getColumn(9).numFmt = '#,##0.00';
  ws.getColumn(10).numFmt = '#,##0.00;-#,##0.00';
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function buildCsv(list) {
  const lines = [COLUMNS.join(',')];
  for (const r of list.map(rowOf)) lines.push([r.id, r.dateStr, r.year, r.month, r.type, r.cat, r.sub, r.channel, r.amount, r.net, r.plan, r.seq, r.trip, r.note].map(csvCell).join(','));
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

// ---------- นำเข้า ----------
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

function cellValue(v) {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((x) => x.text).join('');
    if ('result' in v) return cellValue(v.result);
    if (v.text) return v.text;
    return '';
  }
  return v;
}

async function readRows(file) {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 2));
  const isZip = head[0] === 0x50 && head[1] === 0x4B; // ไฟล์ .xlsx ขึ้นต้นด้วย "PK"
  if (!isZip) return parseCsv(new TextDecoder('utf-8').decode(buf));
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const out = [];
    for (let i = 1; i <= COLUMNS.length + 2; i++) out.push(cellValue(r.getCell(i).value));
    rows.push(out);
  });
  return rows;
}

function toDateStr(v) {
  if (v instanceof Date) return ymd(new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return ymd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // d/m/yyyy
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return null;
}

// อ่านไฟล์ แล้วคืนรายการที่จะเพิ่ม (ยังไม่บันทึก) + สถิติ
export async function prepareImport(file) {
  const rows = await readRows(file);
  if (!rows.length) throw new Error('ไฟล์ว่าง');
  const header = rows[0].map((h) => String(h).trim());
  const idx = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)]));
  if (idx['วันที่'] < 0 || idx['ยอด'] < 0) throw new Error('ไม่พบคอลัมน์ "วันที่" และ "ยอด" ไฟล์นี้อาจไม่ได้มาจากแอปนี้');
  const get = (r, c) => (idx[c] >= 0 ? r[idx[c]] : '');
  const existing = new Set(D.tx.map((t) => t.id));
  const newCats = []; const newChannels = []; const newTrips = []; const tx = [];
  let skipped = 0; let invalid = 0;
  const findCat = (type, name, parentId) => [...D.cats, ...newCats].find((c) => c.type === type && c.parentId === parentId && c.name === name);
  for (const r of rows.slice(1)) {
    const id = String(get(r, 'รหัส') || '').trim();
    if (id && existing.has(id)) { skipped++; continue; }
    const date = toDateStr(get(r, 'วันที่'));
    const amount = round2(Math.abs(parseFloat(String(get(r, 'ยอด')).replace(/,/g, ''))));
    if (!date || !Number.isFinite(amount) || amount <= 0) { invalid++; continue; }
    const type = String(get(r, 'ประเภท')).trim() === 'รายรับ' ? 'income' : 'expense';
    let catId = null; let subId = null; let channelId = null; let tripId = null;
    const cName = String(get(r, 'หมวด') || '').trim();
    if (cName) {
      let c = findCat(type, cName, null);
      if (!c) { c = { id: uid('c'), type, name: cName, emoji: '📦', order: 900 + newCats.length, hidden: false, parentId: null }; newCats.push(c); }
      catId = c.id;
      const sName = String(get(r, 'หมวดย่อย') || '').trim();
      if (sName) {
        let s = findCat(type, sName, c.id);
        if (!s) { s = { id: uid('c'), type, name: sName, emoji: '', order: 900 + newCats.length, hidden: false, parentId: c.id }; newCats.push(s); }
        subId = s.id;
      }
    }
    const chName = String(get(r, 'ช่องทาง') || '').trim();
    if (chName) {
      let ch = [...D.channels, ...newChannels].find((x) => x.name === chName);
      if (!ch) { ch = { id: uid('h'), name: chName, order: 900 + newChannels.length }; newChannels.push(ch); }
      channelId = ch.id;
    }
    const tName = String(get(r, 'ทริป') || '').trim();
    if (tName) {
      let tr = [...D.trips, ...newTrips].find((x) => x.name === tName);
      if (!tr) { tr = { id: uid('p'), name: tName, startedAt: Date.now(), endedAt: Date.now() }; newTrips.push(tr); }
      tripId = tr.id;
    }
    const t = newTx({
      id: id || uid('t'), type, amount, catId, subId, channelId, date, note: String(get(r, 'โน้ต') || ''),
      tripId, planName: String(get(r, 'รายการผ่อน') || '') || null, planSeq: String(get(r, 'งวด') || '') || null,
    });
    existing.add(t.id);
    tx.push(t);
  }
  return { tx, cats: newCats, channels: newChannels, trips: newTrips, skipped, invalid };
}
