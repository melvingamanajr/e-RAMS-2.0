# Deployment and operations

The supplied Compose topology is a single-host baseline. Docker is not installed in the implementation environment, so container builds, Nginx, Redis integration, and restore drills need runtime verification on the deployment host. Application checks use a real local PostgreSQL server and the built NestJS API.

## Docker deployment

1. Copy `.env.example` to `.env`. Set a strong hexadecimal `DATABASE_PASSWORD`, update the URL consistently, set a random `JWT_SECRET` and `AI_SERVICE_KEY` (at least 32 characters), set `BIOMETRIC_KEY` to exactly 64 hexadecimal characters, and choose the initial admin email/password. For example, `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` generates a value suitable for the encryption key. Never commit `.env`.
2. Set `LOCAL_DATABASE=false` and set `WEB_ORIGIN` to the exact external origin, including scheme and port. Internal database/Redis/AI service addresses are supplied by Compose.
3. Start services:

   ```powershell
   docker compose up -d --build
   docker compose exec api node scripts/database.mjs seed
   ```

4. Nginx binds `127.0.0.1:8080`. Place an operator-managed TLS reverse proxy in front of it for remote use, with TLS 1.3, an appropriate certificate, and the exact `WEB_ORIGIN`. Production session cookies have the Secure flag. Browser camera access requires a trusted origin (HTTPS or localhost). Do not expose the internal API, database, Redis, or AI service directly.
5. To enable the optional face container, supply appropriate models and run `docker compose --profile face up -d --build`. Review [face service setup](face-service.md) before testing recognition.

The migration service applies versioned SQL before API startup. The seed command creates an initial admin and regular shift but preserves existing admin credentials. It does not reset passwords on subsequent startups.

## Secrets and privileges

Keep `BIOMETRIC_KEY` stable and recoverable independently of the database. Existing templates cannot be recovered after key loss. A rotation procedure must decrypt/re-encrypt existing templates transactionally or remove them and re-enroll; simply changing the key is not rotation.

The Compose starter uses one database owner for convenience. Before operational deployment, use a separate privileged migration account and a limited runtime account: grant only the needed SELECT/INSERT/UPDATE/DELETE privileges, grant audit SELECT/INSERT only, and prohibit schema changes. The append-only audit trigger is a safeguard, not protection against a privileged database owner. Preserve external backups and system access logs.

Redis stores rate counters, not biometric templates. If Redis is unavailable the API falls back to in-memory limits for a single process. Multiple API replicas need healthy shared rate limiting, a Socket.IO Redis adapter, and database-backed operational monitoring before horizontal scaling.

## Backups

For the Compose PostgreSQL service:

```powershell
node scripts/backup.mjs
```

This streams a PostgreSQL custom-format dump directly into `data/backups` without PowerShell’s binary-redirection problems. It does not modify the database. Protect these files with filesystem access controls and backup encryption. Copy backups off-host through an approved operational process and keep the encryption key separately. A failed dump may leave a partial file; inspect the command status before accepting it.

Restore into a separate database using `pg_restore`, then verify row counts, administrator access, audit history, sample DTRs, and an authorized encrypted template. Do not practice restoration against the live attendance database. A scheduled dump/WAL archival policy, retention enforcement, off-host copies, monitoring, and tested recovery targets are still deployment work.

## Health and troubleshooting

- `/api/health` returns success only when the database is reachable. It is intentionally public and contains no personnel data.
- **Administration** reports whether face models are ready. An unavailable AI service leaves the HR/manual workflow usable.
- A 409 punch error means a slot or idempotency key already exists. Review the attendance page before correcting a record.
- PostgreSQL development runs on `127.0.0.1:55432`; integration tests use `55439`; the test API and frontend use `13000` and `15173`. Stop conflicting services instead of resetting a database.
- If Node dependencies or Prisma models change, run `npm ci` and `npm run db:generate`, then restart the app. Use migrations for schema changes; do not run `db push` on an operational database.
- The seed requires `ADMIN_EMAIL` and a password of at least 12 characters. The local launcher creates both automatically if `.env` is absent.

## Release limits

Do not represent this implementation as ISO-certified, NPC-approved, CSC-certified, accessibility-certified, or independently penetration-tested. The source proposal describes intended controls; it does not establish those certifications. Track the remaining work in [requirements and status](requirements.md).
