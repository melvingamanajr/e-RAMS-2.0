import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT } from './process.mjs';
const sql = execFileSync(process.execPath, [resolve(ROOT, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { cwd: resolve(ROOT, 'apps/api'), env: { ...process.env, DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:5432/unused' }, encoding: 'utf8' });
await mkdir('apps/api/prisma/migrations/202610230001_initial', { recursive: true });
await writeFile('apps/api/prisma/migrations/202610230001_initial/migration.sql', sql + `
-- Preserve history in the application database. Privileged DB owners can still
-- alter triggers; independent backups and least-privilege roles are required.
CREATE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON "Audit"
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
CREATE UNIQUE INDEX punch_active_slot ON "Punch" ("employeeId", "workDate", "kind") WHERE "voidedAt" IS NULL;
ALTER TABLE "Shift" ADD CONSTRAINT shift_minutes_valid CHECK ("startMinute" BETWEEN 0 AND 1439 AND "endMinute" BETWEEN 0 AND 1439 AND "startMinute" <> "endMinute" AND "breakMinutes" >= 0 AND "graceMinutes" >= 0 AND "flexMinutes" >= 0);
`);
