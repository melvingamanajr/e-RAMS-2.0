import PDFDocument from 'pdfkit';
import { formatTime } from './time';
import type { Attendance } from './attendance';
export function renderDtr(data: Awaited<ReturnType<Attendance['dtr']>>) {
  const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: `DTR ${data.employee.employeeNo} ${data.month}`, Author: 'e-RAMS · LGU San Juan' } });
  doc.fontSize(9).text('Civil Service Form No. 48', 36, 30);
  doc.fontSize(17).text('DAILY TIME RECORD', 36, 50, { align: 'center' });
  doc.fontSize(10).text('LGU San Juan, Southern Leyte', 36, 74, { align: 'center' });
  doc.fontSize(12).text(`${data.employee.firstName} ${data.employee.lastName}`, 36, 100, { align: 'center' });
  doc.fontSize(9).text(`${data.employee.employeeNo} · ${data.employee.department}`, 36, 119, { align: 'center' });
  doc.text(`For the month of ${data.month}`, 36, 139);
  const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  doc.text(`Official hours: ${clock(data.shift.startMinute)}–${clock(data.shift.endMinute)}  |  Break: ${data.shift.breakMinutes} minutes`, 36, 155);
  const x = [36, 66, 150, 234, 318, 402, 475, 559];
  const headers = ['Day', 'AM Arrival', 'AM Departure', 'PM Arrival', 'PM Departure', 'UT hours', 'UT mins'];
  const rowHeight = 14;
  const top = 175;
  function row(y: number, cells: string[], header = false) {
    if (header) doc.rect(36, y, 523, rowHeight).fill('#e4eeeb');
    doc.fillColor('#172b28').fontSize(header ? 8 : 8.5);
    cells.forEach((cell, i) => doc.text(cell, x[i] + 3, y + 4, { width: x[i + 1] - x[i] - 6, align: 'center', lineBreak: false }));
    doc.strokeColor('#9aaca5').lineWidth(0.4).moveTo(36, y + rowHeight).lineTo(559, y + rowHeight).stroke();
    x.forEach(v => doc.moveTo(v, y).lineTo(v, y + rowHeight).stroke());
  }
  row(top, headers, true);
  data.rows.forEach((r, i) => row(top + (i + 1) * rowHeight, [r.date.slice(-2), formatTime(r.amIn), formatTime(r.amOut), formatTime(r.pmIn), formatTime(r.pmOut), r.undertimeMinutes == null ? '' : String(Math.floor(r.undertimeMinutes / 60)), r.undertimeMinutes == null ? '' : String(r.undertimeMinutes % 60)]));
  const y = top + (data.rows.length + 1) * rowHeight + 12;
  doc.fontSize(9).text(`Total undertime: ${Math.floor(data.totalUndertimeMinutes / 60)} hours ${data.totalUndertimeMinutes % 60} minutes`, 36, y);
  doc.fontSize(8).text('I certify on my honor that the above is a true and correct report of the hours of work performed, recorded daily at the time of arrival and departure.', 36, y + 22, { width: 523 });
  doc.text('____________________________________', 36, y + 55, { align: 'center' });
  doc.text('Employee signature', 36, y + 68, { align: 'center' });
  doc.text('Verified as to the prescribed office hours:', 36, y + 89);
  doc.text('____________________________________', 36, y + 110, { align: 'center' });
  doc.text('Authorized supervisor', 36, y + 123, { align: 'center' });
  doc.fontSize(7).fillColor('#64736e').text('Generated from attendance punches. Incomplete days require HR review. Form layout and local policies require agency approval.', 36, 782, { width: 523, lineBreak: false });
  return doc;
}
