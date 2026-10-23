import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDtr } from '../src/reports';
import { monthDays, dailyRecord } from '../src/time';
test('31-day DTR fits on a single A4 page and emits a valid PDF', async () => {
  const shift = { id: 'schedule', name: 'Regular', kind: 'FIXED' as const, startMinute: 480, endMinute: 1020, breakMinutes: 60, graceMinutes: 0, flexMinutes: 0, workDays: [1, 2, 3, 4, 5] };
  const doc = renderDtr({ month: '2026-10', employee: { id: 'employee', firstName: 'Sample', lastName: 'Employee', employeeNo: 'SJ-0001', department: 'Treasury', position: 'Clerk' }, shift, rows: monthDays('2026-10').map(day => dailyRecord(day, [], shift)), totalLateMinutes: 0, totalWorkedMinutes: 0, totalUndertimeMinutes: 0 });
  let extraPages = 0; const chunks: Buffer[] = [];
  doc.on('pageAdded', () => extraPages++);
  doc.on('data', chunk => chunks.push(chunk));
  await new Promise<void>(done => { doc.on('end', done); doc.end(); });
  const pdf = Buffer.concat(chunks);
  assert.equal(extraPages, 0); assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length, 1);
});
