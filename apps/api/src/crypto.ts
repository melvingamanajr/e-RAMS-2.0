import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
export function encryptTemplate(vector: number[], hexKey: string, employeeId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  cipher.setAAD(Buffer.from(employeeId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(vector)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decryptTemplate(value: string, hexKey: string, employeeId: string): number[] {
  const data = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(employeeId));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
