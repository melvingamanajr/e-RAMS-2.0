import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, NotFoundException, Param, Patch, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { hash, verify, argon2id } from 'argon2';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { z } from 'zod';
import { Db } from './db';
import { Public, Roles, type AuthRequest } from './auth';
import { config } from './config';
import { Limits } from './limits';
import { Attendance } from './attendance';
import { Biometrics } from './biometrics';
import { Live } from './live';
import { date, employeeInput, id, imageInput, month, parse, shiftInput, text } from './validation';
import { KINDS, localDate } from './time';
import { tokenHash } from './crypto';
import { renderDtr } from './reports';
const safeEmployee = { shift: true, biometric: { select: { id: true, model: true, createdAt: true } } };

@Controller('api/auth')
export class AuthController {
  constructor(private readonly db: Db, private readonly jwt: JwtService, private readonly limits: Limits, private readonly live: Live) {}
  @Public() @Post('login') @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const input = parse(z.object({ email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).max(256) }).strict(), body);
    await this.limits.check(`login-ip:${req.ip}`, 20, 900);
    await this.limits.check(`login-user:${tokenHash(input.email)}`, 10, 900);
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    // Always perform Argon2 work, including for unknown emails.
    const valid = user ? await verify(user.passwordHash, input.password) : (await hash(input.password, { type: argon2id }), false);
    if (!user?.active || !valid) throw new UnauthorizedException('Email or password is incorrect');
    const session = await this.db.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 8 * 3600000) } });
    const token = await this.jwt.signAsync({ sub: user.id, sid: session.id }, { secret: config.JWT_SECRET, expiresIn: '8h' });
    res.cookie('erams_session', token, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 8 * 3600000 });
    await this.db.audit.create({ data: { actorId: user.id, action: 'LOGIN', entityId: user.id, metadata: {} } });
    return { id: user.id, name: user.name, role: user.role, email: user.email };
  }
  @Get('me') me(@Req() req: AuthRequest) { return { id: req.actor.id, name: req.actor.name, role: req.actor.role }; }
  @Post('logout') @HttpCode(200)
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) { await this.db.session.update({ where: { id: req.actor.sessionId! }, data: { revokedAt: new Date() } }); res.clearCookie('erams_session', { path: '/' }); this.live.disconnectUser(req.actor.id); return { success: true }; }
}

@Controller('api')
export class ManagementController {
  constructor(private readonly db: Db, private readonly bio: Biometrics, private readonly limits: Limits, private readonly live: Live) {}
  @Public() @Get('health') async health() { await this.db.$queryRaw`SELECT 1`; return { status: 'ok' }; }
  @Get('system') async system() { return { ai: await this.bio.status(), timezone: 'Asia/Manila', consentPolicy: 'biometric-v1' }; }
  @Get('employees') employees() { return this.db.employee.findMany({ include: safeEmployee, orderBy: [{ active: 'desc' }, { lastName: 'asc' }] }); }
  @Roles('ADMIN', 'HR') @Post('employees')
  async createEmployee(@Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(employeeInput, body);
    return this.db.$transaction(async tx => {
      const employee = await tx.employee.create({ data: input, include: safeEmployee });
      await tx.audit.create({ data: { actorId: req.actor.id, action: 'EMPLOYEE_CREATED', entityId: employee.id, metadata: { employeeNo: input.employeeNo } } });
      return employee;
    });
  }
  @Roles('ADMIN', 'HR') @Patch('employees/:id')
  async editEmployee(@Param('id') employeeId: string, @Body() body: unknown, @Req() req: AuthRequest) {
    parse(id, employeeId);
    const input = parse(employeeInput.partial(), body);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employeeId})::bigint)`;
      const employee = await tx.employee.update({ where: { id: employeeId }, data: input });
      if (input.active === false) {
        await tx.biometric.deleteMany({ where: { employeeId } });
        await tx.consent.updateMany({ where: { employeeId, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
      }
      await tx.audit.create({ data: { actorId: req.actor.id, action: 'EMPLOYEE_UPDATED', entityId: employeeId, metadata: { fields: Object.keys(input), biometricRemoved: input.active === false } } });
      return employee;
    });
  }
  @Roles('ADMIN', 'HR') @Post('employees/:id/enroll')
  async enroll(@Param('id') employeeId: string, @Body() body: unknown, @Req() req: AuthRequest) {
    parse(id, employeeId);
    await this.limits.check(`enroll:${req.actor.id}`, 10, 60);
    const input = parse(z.object({ image: imageInput, consent: z.literal(true), policyVersion: z.literal('biometric-v1'), signature: z.string().trim().min(3).max(120) }).strict(), body);
    return this.bio.enroll(employeeId, input.image, input.signature, req.actor);
  }
  @Roles('ADMIN', 'HR') @Delete('employees/:id/biometric')
  withdraw(@Param('id') employeeId: string, @Req() req: AuthRequest) { return this.bio.withdraw(parse(id, employeeId), req.actor); }
  @Get('shifts') shifts() { return this.db.shift.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { employees: true } } } }); }
  @Roles('ADMIN', 'HR') @Post('shifts')
  async shift(@Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(shiftInput, body);
    return this.db.$transaction(async tx => {
      const shift = await tx.shift.create({ data: input });
      await tx.audit.create({ data: { actorId: req.actor.id, action: 'SHIFT_CREATED', entityId: shift.id, metadata: { name: shift.name } } });
      return shift;
    });
  }
  @Roles('ADMIN') @Get('users') users() { return this.db.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true, createdAt: true }, orderBy: { name: 'asc' } }); }
  @Roles('ADMIN') @Post('users')
  async createUser(@Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ name: text, email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(12).max(128), role: z.enum(['ADMIN', 'HR', 'AUDITOR']) }).strict(), body);
    const passwordHash = await hash(input.password, { type: argon2id });
    return this.db.$transaction(async tx => {
      const user = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash, role: input.role }, select: { id: true, name: true, email: true, role: true } });
      await tx.audit.create({ data: { actorId: req.actor.id, action: 'USER_CREATED', entityId: user.id, metadata: { role: user.role } } });
      return user;
    });
  }
  @Roles('ADMIN') @Patch('users/:id')
  async updateUser(@Param('id') userId: string, @Body() body: unknown, @Req() req: AuthRequest) {
    parse(id, userId);
    const input = parse(z.object({ active: z.boolean() }).strict(), body);
    if (userId === req.actor.id) throw new BadRequestException('You cannot disable your own account');
    await this.db.$transaction(async tx => {
      await tx.user.update({ where: { id: userId }, data: input });
      await tx.audit.create({ data: { actorId: req.actor.id, action: 'USER_UPDATED', entityId: userId, metadata: input } });
    });
    if (!input.active) this.live.disconnectUser(userId);
    return { success: true };
  }
  @Roles('ADMIN') @Get('kiosks') kiosks() { return this.db.kiosk.findMany({ select: { id: true, name: true, active: true, createdAt: true } }); }
  @Roles('ADMIN') @Post('kiosks')
  async createKiosk(@Body() body: unknown, @Req() req: AuthRequest) {
    const { name } = parse(z.object({ name: text }).strict(), body);
    const token = randomBytes(32).toString('base64url');
    const kiosk = await this.db.$transaction(async tx => {
      const k = await tx.kiosk.create({ data: { name, tokenHash: tokenHash(token) }, select: { id: true, name: true } });
      await tx.audit.create({ data: { actorId: req.actor.id, action: 'KIOSK_CREATED', entityId: k.id, metadata: { name } } });
      return k;
    });
    return { ...kiosk, token };
  }
  @Roles('ADMIN') @Delete('kiosks/:id')
  async revokeKiosk(@Param('id') kioskId: string, @Req() req: AuthRequest) {
    parse(id, kioskId);
    await this.db.$transaction(async tx => {
      await tx.kiosk.update({ where: { id: kioskId }, data: { active: false } });
      await tx.audit.create({ data: { actorId: req.actor.id, action: 'KIOSK_REVOKED', entityId: kioskId, metadata: {} } });
    });
    return { success: true };
  }
  @Get('audit')
  async audit(@Query('cursor') cursor?: string) {
    if (cursor) parse(id, cursor);
    const rows = await this.db.audit.findMany({ take: 51, skip: cursor ? 1 : 0, cursor: cursor ? { id: cursor } : undefined, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return { rows: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null };
  }
}

@Controller('api')
export class AttendanceController {
  constructor(private readonly attendance: Attendance, private readonly bio: Biometrics, private readonly limits: Limits, private readonly db: Db) {}
  @Get('dashboard') dashboard() { return this.attendance.dashboard(); }
  @Get('attendance') list(@Query('date') value?: string) { return this.attendance.list(parse(date, value ?? localDate(new Date()))); }
  @Roles('ADMIN', 'HR') @Post('attendance/manual')
  manual(@Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ employeeId: id, kind: z.enum(KINDS), occurredAt: z.string().datetime({ offset: true }), reason: z.string().trim().min(5).max(500), key: id }).strict(), body);
    const occurredAt = new Date(input.occurredAt);
    if (+occurredAt > Date.now() + 60000) throw new BadRequestException('Attendance cannot be recorded in the future');
    return this.attendance.record({ ...input, occurredAt, source: 'MANUAL' }, req.actor);
  }
  @Roles('ADMIN', 'HR') @Post('attendance/:id/void')
  void(@Param('id') punchId: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ reason: z.string().trim().min(5).max(500) }).strict(), body);
    return this.attendance.void(parse(id, punchId), input.reason, req.actor);
  }
  @Roles('KIOSK') @Post('kiosk/punch')
  async punch(@Body() body: unknown, @Req() req: AuthRequest) {
    await this.limits.check(`kiosk:${req.actor.id}`, 30, 60);
    const input = parse(z.object({ image: imageInput, kind: z.enum(KINDS), key: id }).strict(), body);
    const match = await this.bio.identify(input.image);
    const punch = await this.attendance.record({ employeeId: match.employeeId, kind: input.kind, occurredAt: new Date(), key: input.key, source: 'FACE', confidence: match.confidence }, req.actor);
    const employee = await this.db.employee.findUniqueOrThrow({ where: { id: match.employeeId }, select: { firstName: true, lastName: true } });
    return { name: `${employee.firstName} ${employee.lastName}`, kind: punch.kind, occurredAt: punch.occurredAt };
  }
  @Get('reports/dtr')
  dtr(@Query('employeeId') employeeId: string, @Query('month') value: string, @Req() req: AuthRequest) { return this.attendance.dtr(parse(id, employeeId), parse(month, value), req.actor); }
  @Get('reports/dtr.pdf')
  async pdf(@Query('employeeId') employeeId: string, @Query('month') value: string, @Req() req: AuthRequest, @Res() res: Response) {
    const data = await this.attendance.dtr(parse(id, employeeId), parse(month, value), req.actor);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="DTR-${data.employee.employeeNo}-${data.month}.pdf"`);
    const doc = renderDtr(data); doc.pipe(res); doc.end();
  }
}
