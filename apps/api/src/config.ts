import { config as load } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
load({ path: resolve(process.cwd(), '../../.env'), quiet: true } as any);
load({ path: resolve(process.cwd(), '.env'), quiet: true } as any);
const schema = z.object({
  DATABASE_URL: z.string().min(1), JWT_SECRET: z.string().min(32),
  BIOMETRIC_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  AI_SERVICE_KEY: z.string().min(32), AI_URL: z.string().url().default('http://127.0.0.1:8000'),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  PORT: z.coerce.number().default(3000), NODE_ENV: z.string().default('development'),
  REDIS_URL: z.string().optional(),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});
export const config = schema.parse(process.env);
