import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  return result.data;
}
export const id = z.string().uuid();
export const text = z.string().trim().min(1).max(120);
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(+new Date(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, 'Invalid calendar date');
export const employeeInput = z.object({ employeeNo: z.string().trim().min(1).max(32).regex(/^[\w-]+$/), firstName: text, lastName: text, department: text, position: text, shiftId: id, active: z.boolean().optional() }).strict();
export const shiftInput = z.object({
  name: text, kind: z.enum(['FIXED', 'SLIDING', 'NIGHT']),
  startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(0).max(1439),
  breakMinutes: z.number().int().min(0).max(240), graceMinutes: z.number().int().min(0).max(60),
  flexMinutes: z.number().int().min(0).max(240), workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
}).strict().superRefine((s, ctx) => {
  if (s.startMinute === s.endMinute || ((s.kind !== 'NIGHT') && s.startMinute >= s.endMinute) || (s.kind === 'NIGHT' && s.startMinute <= s.endMinute)) ctx.addIssue({ code: 'custom', message: 'Use a night shift for schedules crossing midnight' });
  if (s.breakMinutes >= (s.endMinute - s.startMinute + 1440) % 1440) ctx.addIssue({ code: 'custom', message: 'Break must be shorter than the shift' });
  if (new Set(s.workDays).size !== s.workDays.length) ctx.addIssue({ code: 'custom', message: 'Work days must be unique' });
});
export const imageInput = z.string().min(40).max(2_800_000).regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/);
