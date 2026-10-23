import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { Db } from './db';
import { config } from './config';
import { decryptTemplate, encryptTemplate } from './crypto';
import type { Actor } from './auth';
const extraction = z.object({ embedding: z.array(z.number().finite()).length(512), model: z.string().min(1).max(120) });
@Injectable()
export class Biometrics {
  constructor(private readonly db: Db) {}
  async ai(path: string, payload?: unknown) {
    let response: Response;
    try { response = await fetch(`${config.AI_URL}${path}`, { method: payload ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Service-Key': config.AI_SERVICE_KEY }, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(20000) }); }
    catch { throw new ServiceUnavailableException('Face service is unavailable. Ask HR to record attendance manually.'); }
    if (!response.ok) {
      if (response.status === 422) throw new BadRequestException('Use a clear, well-lit image containing exactly one face.');
      if (response.status === 404) throw new NotFoundException('No confident match. Ask HR for assistance.');
      throw new ServiceUnavailableException('Face service is not ready. Check its model configuration.');
    }
    return response.json();
  }
  async status() {
    try { return await this.ai('/health'); } catch { return { ready: false, liveness: false }; }
  }
  async enroll(employeeId: string, image: string, signature: string, actor: Actor) {
    const employee = await this.db.employee.findUnique({ where: { id: employeeId } });
    if (!employee?.active) throw new NotFoundException('Active employee not found');
    const result = extraction.safeParse(await this.ai('/extract', { image }));
    if (!result.success) throw new ServiceUnavailableException('Face service returned an invalid embedding');
    const encryptedTemplate = encryptTemplate(result.data.embedding, config.BIOMETRIC_KEY, employeeId);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employeeId})::bigint)`;
      const current = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!current?.active) throw new NotFoundException('Active employee not found');
      await tx.biometric.deleteMany({ where: { employeeId } });
      await tx.consent.updateMany({ where: { employeeId, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
      const consent = await tx.consent.create({ data: { employeeId, signature, recordedBy: actor.id, policyVersion: 'biometric-v1' } });
      await tx.biometric.create({ data: { employeeId, consentId: consent.id, encryptedTemplate, model: result.data.model } });
      await tx.audit.create({ data: { actorId: actor.id, action: 'BIOMETRIC_ENROLLED', entityId: employeeId, metadata: { consentId: consent.id, policyVersion: consent.policyVersion, model: result.data.model } } });
      return { success: true, enrolledAt: consent.grantedAt };
    });
  }
  async withdraw(employeeId: string, actor: Actor) {
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employeeId})::bigint)`;
      await tx.biometric.deleteMany({ where: { employeeId } });
      await tx.consent.updateMany({ where: { employeeId, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
      await tx.audit.create({ data: { actorId: actor.id, action: 'BIOMETRIC_WITHDRAWN', entityId: employeeId, metadata: {} } });
      return { success: true };
    });
  }
  async identify(image: string): Promise<{ employeeId: string; confidence: number }> {
    const templates = await this.db.biometric.findMany({ where: { employee: { active: true }, consent: { withdrawnAt: null } } });
    if (!templates.length) throw new NotFoundException('No employees are enrolled. Ask HR for assistance.');
    const result = await this.ai('/recognize', { image, templates: templates.map(t => ({ employeeId: t.employeeId, embedding: decryptTemplate(t.encryptedTemplate, config.BIOMETRIC_KEY, t.employeeId), model: t.model })) });
    const parsed = z.object({ employeeId: z.string().uuid(), confidence: z.number().finite().min(-1).max(1) }).safeParse(result);
    if (!parsed.success || !templates.some(t => t.employeeId === parsed.data.employeeId)) throw new ServiceUnavailableException('Face service returned an invalid match');
    return parsed.data;
  }
}
