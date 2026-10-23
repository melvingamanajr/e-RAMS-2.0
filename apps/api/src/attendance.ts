import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PunchKind, Prisma } from '@prisma/client';
import { Db } from './db';
import { Live } from './live';
import { KINDS, dailyRecord, localDate, monthDays, workDateFor } from './time';
import type { Actor } from './auth';
@Injectable()
export class Attendance {
  constructor(private readonly db: Db, private readonly live: Live) {}
  async record(input: { employeeId: string; kind: PunchKind; occurredAt: Date; key: string; source: string; confidence?: number; reason?: string }, actor: Actor) {
    const punch = await this.db.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id: input.employeeId }, include: { shift: true } });
      if (!employee?.active) throw new NotFoundException('Active employee not found');
      // Serialize per employee, covering simultaneous kiosk and HR requests.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employee.id})::bigint)`;
      const existing = await tx.punch.findUnique({ where: { idempotencyKey: input.key } });
      if (existing) {
        if (existing.employeeId !== input.employeeId || existing.kind !== input.kind || existing.recordedBy !== actor.id || existing.voidedAt) throw new ConflictException('Request key was already used');
        return existing;
      }
      if (input.source === 'FACE') {
        const template = await tx.biometric.findUnique({ where: { employeeId: employee.id }, include: { consent: true } });
        if (!template || template.consent.withdrawnAt) throw new ConflictException('Biometric enrollment has been withdrawn');
      }
      const workDate = workDateFor(input.occurredAt, employee.shift);
      const entries = await tx.punch.findMany({ where: { employeeId: employee.id, workDate, voidedAt: null }, orderBy: { occurredAt: 'asc' } });
      if (entries.some(e => e.kind === input.kind)) throw new ConflictException('This attendance slot already has a record. Void the incorrect record first.');
      const proposed = [...entries, { kind: input.kind, occurredAt: input.occurredAt }].sort((a, b) => +a.occurredAt - +b.occurredAt);
      for (let i = 1; i < proposed.length; i++) if (KINDS.indexOf(proposed[i - 1].kind) >= KINDS.indexOf(proposed[i].kind) || +proposed[i - 1].occurredAt === +proposed[i].occurredAt) throw new BadRequestException('Punch times must follow morning in, morning out, afternoon in, afternoon out');
      if (input.source === 'FACE' && entries.some(e => Math.abs(+e.occurredAt - +input.occurredAt) < 60_000)) throw new ConflictException('Please wait at least one minute before the next punch');
      const { kind, startMinute, endMinute, breakMinutes, graceMinutes, flexMinutes, workDays } = employee.shift;
      const result = await tx.punch.create({ data: { employeeId: input.employeeId, kind: input.kind, occurredAt: input.occurredAt, workDate, source: input.source, confidence: input.confidence, reason: input.reason, recordedBy: actor.id, idempotencyKey: input.key, shiftSnapshot: { kind, startMinute, endMinute, breakMinutes, graceMinutes, flexMinutes, workDays } } });
      await tx.audit.create({ data: { actorId: actor.id, action: 'ATTENDANCE_RECORDED', entityId: result.id, metadata: { employeeId: employee.id, kind: input.kind, source: input.source, reason: input.reason ?? null } } });
      return result;
    }, { timeout: 15000 });
    void this.live.changed();
    return punch;
  }
  async void(id: string, reason: string, actor: Actor) {
    return this.db.$transaction(async tx => {
      const punch = await tx.punch.findUnique({ where: { id } });
      if (!punch) throw new NotFoundException('Record not found');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${punch.employeeId})::bigint)`;
      const changed = await tx.punch.updateMany({ where: { id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: reason } });
      if (!changed.count) throw new ConflictException('Record is already void');
      await tx.audit.create({ data: { actorId: actor.id, action: 'ATTENDANCE_VOIDED', entityId: id, metadata: { reason } } });
      void this.live.changed();
      return { success: true };
    });
  }
  async list(date: string) {
    return this.db.punch.findMany({ where: { workDate: date }, include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true, department: true } } }, orderBy: { occurredAt: 'desc' } });
  }
  async dashboard() {
    const today = localDate(new Date());
    const employees = await this.db.employee.findMany({ where: { active: true }, include: { shift: true, punches: { where: { workDate: today, voidedAt: null } } } });
    const records = employees.map(e => dailyRecord(today, e.punches, e.shift));
    const present = records.filter(r => r.amIn || r.pmIn).length;
    return { date: today, total: employees.length, present, absent: records.filter(r => r.status === 'Absent').length, late: records.filter(r => r.lateMinutes > 0).length, rate: employees.length ? Math.round(present / employees.length * 100) : 0, feed: await this.list(today), departments: [...new Set(employees.map(e => e.department))].map(name => ({ name, total: employees.filter(e => e.department === name).length, present: employees.filter(e => e.department === name && e.punches.some(p => p.kind === 'AM_IN' || p.kind === 'PM_IN')).length })) };
  }
  async dtr(employeeId: string, month: string, actor: Actor) {
    const employee = await this.db.employee.findUnique({ where: { id: employeeId }, include: { shift: true, punches: { where: { workDate: { startsWith: month }, voidedAt: null }, orderBy: { occurredAt: 'asc' } } } });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.db.audit.create({ data: { actorId: actor.id, action: 'DTR_VIEWED', entityId: employee.id, metadata: { month } } });
    const today = localDate(new Date());
    const rows = monthDays(month).map(date => { const row = dailyRecord(date, employee.punches, employee.shift); return date > today ? { ...row, status: 'Upcoming' } : row; });
    return { employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, employeeNo: employee.employeeNo, department: employee.department, position: employee.position }, shift: employee.shift, month, rows, totalWorkedMinutes: rows.reduce((sum, r) => sum + r.workedMinutes, 0), totalUndertimeMinutes: rows.reduce((sum, r) => sum + (r.undertimeMinutes ?? 0), 0), totalLateMinutes: rows.reduce((sum, r) => sum + r.lateMinutes, 0) };
  }
}
