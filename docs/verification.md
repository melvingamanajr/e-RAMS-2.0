# Verification record

Verified locally on Windows with Node.js 22.20, PostgreSQL 18.4 for development/tests, Python 3.11.13 in an isolated tooling environment, and installed Chrome. The deployment Compose file targets PostgreSQL 16.

| Check | Result |
| --- | --- |
| Prisma schema/client generation | Passed |
| NestJS TypeScript production build | Passed |
| Vue typecheck and Vite production build | Passed |
| Node unit tests | 11 passed: attendance minutes, overnight shifts, sliding hours, rest days, leap months, voids, schedule snapshots, authenticated encryption, one-page 31-day PDF |
| PostgreSQL/API integration | Passed: authentication, origin enforcement, role restrictions, duplicates/idempotency, simultaneous punches, corrections, DTR/PDF, encrypted enrollment, withdrawal, kiosk revocation, audit trigger, logout revocation |
| Chrome workflow checks | Passed: sign-in, dashboard/live connection, employee dialog/submission, DTR preview/download, schedules, audit, administration, mobile navigation/overflow, kiosk pairing page |
| Python tests | 7 passed: distinctive/ambiguous/low-confidence matching, invalid vectors, service-key enforcement, missing model, recognition disabled by default |
| First-run local launcher | Passed: generated secrets, persistent UTF-8 database, migrations, seed, API/web readiness, browser sign-in, desktop/mobile render |
| Graceful shutdown | Passed after replacing forced Windows PostgreSQL termination with pg_ctl; no test or development listeners retained |

The API integration suite uses a deterministic private face-service protocol fixture. Python tests run without model weights. **Real model inference, camera accuracy, liveness, and anti-spoofing were not validated.** Docker, Redis, Nginx, TLS, backup restoration, and hosted production deployment were not run because Docker is unavailable here. No municipal records or real biometric captures were used in these checks. The actual development database starts with the administrator and regular schedule only.

Screenshots are in [screenshots](screenshots): `local-dashboard.png` and `mobile.png` show the first-run app; `dashboard.png` and `employees.png` show clearly named synthetic integration-test records.

This record is evidence of the listed development checks, not a security, legal, model-accuracy, CSC, or accessibility certification.
