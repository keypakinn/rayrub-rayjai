// ตัวช่วยที่หลายหน้าใช้ร่วมกัน
import { D, cat, channel, trip, plan, topCats, subCats, sortedChannels, planAutoNote } from './store.js';
import { esc, today, thisMonth } from './util.js';

export const CAT_COLORS = ['#FF8A4C', '#C8925A', '#E36FA8', '#4CC38A', '#F2C14E', '#5AA9FF', '#8E9BFF', '#B37DFF', '#3CC6D0', '#7FB069', '#9AA0AA', '#F07167', '#56CFE1', '#E9C46A'];
export function catColor(c) {
  if (!c) return '#3A3F48';
  const list = topCats(c.type, true);
  const i = list.findIndex((x) => x.id === (c.parentId || c.id));
  return c.type === 'income' ? ['#5AA9FF', '#8CC4FF', '#56CFE1', '#4CC38A'][Math.max(0, i) % 4] : CAT_COLORS[Math.max(0, i) % CAT_COLORS.length];
}
export function catName(id, fallback = 'รอจัดหมวด') { const c = id && cat(id); return c ? c.name : fallback; }
export function catEmoji(id) { const c = id && cat(id); return c ? (c.emoji || '•') : '•'; }

// ข้อความรอง: หมวด · หมวดย่อย · ช่องทาง
export function txMeta(t) {
  const parts = [];
  if (t.catId) parts.push(catName(t.catId));
  if (t.subId && cat(t.subId)) parts.push(cat(t.subId).name);
  if (t.channelId && channel(t.channelId)) parts.push(channel(t.channelId).name);
  return parts.join(' · ');
}
export function txTitle(t) {
  if (t.planSeq) {
    const p = t.planId ? plan(t.planId) : null;
    const auto = planAutoNote(p ? p.name : (t.planName || ''), t.planSeq);
    return t.note ? `${t.note} - ${auto}` : auto;
  }
  return t.note || (t.catId ? catName(t.catId) : 'ไม่มีโน้ต');
}
export function tripName(id) { const t = id && trip(id); return t ? t.name : ''; }

export function catOptions(type, includeHiddenId = null) {
  return topCats(type, true).filter((c) => !c.hidden || c.id === includeHiddenId).map((c) => ({ value: c.id, label: `${c.emoji || ''} ${c.name}`.trim() }));
}
export function subOptions(catId, includeHiddenId = null) {
  return catId ? subCats(catId, true).filter((c) => !c.hidden || c.id === includeHiddenId).map((c) => ({ value: c.id, label: c.name })) : [];
}
export function channelOptions() { return sortedChannels().map((c) => ({ value: c.id, label: c.name })); }

// ยอดจริงที่เกิดแล้ว (ไม่รวมงวดล่วงหน้าที่วันยังมาไม่ถึง)
export function actualTx(list) { const t = today(); return list.filter((x) => x.date <= t); }
export function sumOf(list, type) { return list.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0); }
export function inMonth(ym) { return D.tx.filter((t) => t.date.slice(0, 7) === ym); }
export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
export function monthIsCurrent(ym) { return ym === thisMonth(); }
export function escAttr(s) { return esc(s); }
