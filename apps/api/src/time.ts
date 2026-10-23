export const ZONE = 'Asia/Manila';
export const KINDS = ['AM_IN', 'AM_OUT', 'PM_IN', 'PM_OUT'] as const;
export function localDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function localMinute(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  const [hour, minute] = parts.split(':').map(Number);
  return hour * 60 + minute;
}
export function workDateFor(date: Date, shift: { kind: string; startMinute: number; endMinute: number }) {
  // A night shift ending this morning belongs to the prior service day.
  const nightCutoff = shift.endMinute + Math.floor((shift.startMinute - shift.endMinute) / 2);
  if (shift.kind === 'NIGHT' && localMinute(date) < nightCutoff) return localDate(new Date(date.getTime() - 86400000));
  return localDate(date);
}
export function formatTime(date: Date | string | null) {
  return date ? new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(date)) : '';
}
export function monthDays(month: string) {
  const [year, m] = month.split('-').map(Number);
  return Array.from({ length: new Date(Date.UTC(year, m, 0)).getUTCDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
type Entry = { kind: string; occurredAt: Date; workDate: string; voidedAt: Date | null; shiftSnapshot?: unknown };
type Schedule = { kind: string; startMinute: number; endMinute: number; graceMinutes: number; flexMinutes: number; breakMinutes: number; workDays: number[] };
export function dailyRecord(date: string, punches: Entry[], shift: Schedule) {
  const entries = punches.filter(p => p.workDate === date && !p.voidedAt).sort((a, b) => +a.occurredAt - +b.occurredAt);
  // Keep the schedule of the day's first valid punch when staff are reassigned.
  const snapshot = entries[0]?.shiftSnapshot as Schedule | undefined;
  if (snapshot?.workDays && typeof snapshot.startMinute === 'number') shift = snapshot;
  const get = (kind: string) => entries.find(p => p.kind === kind)?.occurredAt ?? null;
  const amIn = get('AM_IN'), amOut = get('AM_OUT'), pmIn = get('PM_IN'), pmOut = get('PM_OUT');
  const elapsed = (a: Date | null, b: Date | null) => a && b ? Math.max(0, Math.floor((+b - +a) / 60000)) : 0;
  let workedMinutes = elapsed(amIn, amOut) + elapsed(pmIn, pmOut);
  // Single in/out shifts deduct the configured break only when no split pair exists.
  if (amIn && pmOut && !amOut && !pmIn) workedMinutes = Math.max(0, elapsed(amIn, pmOut) - shift.breakMinutes);
  const isWorkDay = shift.workDays.includes(new Date(`${date}T12:00:00+08:00`).getUTCDay());
  const duration = (shift.endMinute - shift.startMinute + 1440) % 1440;
  const requiredMinutes = Math.max(0, duration - shift.breakMinutes);
  const arrival = amIn ? Math.floor((+amIn - +new Date(`${date}T00:00:00+08:00`)) / 60000) : null;
  const allowed = shift.startMinute + shift.graceMinutes + (shift.kind === 'SLIDING' ? shift.flexMinutes : 0);
  const lateMinutes = arrival === null ? 0 : Math.max(0, arrival - allowed);
  const complete = !!amIn && !!pmOut && ((!amOut && !pmIn) || (!!amOut && !!pmIn));
  const status = !entries.length ? (isWorkDay ? 'Absent' : 'Rest day') : !complete ? 'Incomplete' : lateMinutes ? 'Late' : 'Present';
  return { date, amIn, amOut, pmIn, pmOut, workedMinutes, lateMinutes, requiredMinutes, undertimeMinutes: complete ? Math.max(0, requiredMinutes - workedMinutes) : null, status };
}
