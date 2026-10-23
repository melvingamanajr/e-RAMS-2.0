# e-RAMS 2.0

A local implementation of the **Real-Time Attendance Monitoring System for LGU San Juan, Southern Leyte**, based on the supplied thesis and October 2026 architecture proposal.

Vue 3 / Vite / Tailwind / PrimeVue · NestJS · PostgreSQL / Prisma · Redis · FastAPI / InsightFace

## Run locally

Install Node.js 22.13 or newer, then run these commands from this folder:

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. On first startup the launcher creates `.env` with a randomly generated administrator password. Read `ADMIN_EMAIL` and `ADMIN_PASSWORD` there to sign in. There is no shared default password.

The launcher starts an isolated local PostgreSQL instance, applies the checked-in migrations, creates a regular office schedule, seeds the administrator, builds the API, and starts the web interface. Database files persist in `data/postgres`. Stop with **Ctrl+C**. The frontend reloads automatically; restart the command after API changes. If you supply an external database, set `LOCAL_DATABASE=false` in `.env`.

**Face recognition needs additional setup.** The local app works immediately for employee administration, manual attendance, schedules, reporting, and auditing. Camera enrollment and recognition need the Python service and suitable model files; see [face service setup](docs/face-service.md). No test faces or pretend recognition results are used in the application.

## First workflow

1. Open **Employees → Add employee** and assign the regular office schedule.
2. Record approved attendance under **Attendance → Manual entry**. Times are entered in Philippine Standard Time.
3. Use the four events: morning in, morning out, afternoon in, afternoon out. A single morning in / afternoon out pair also works, deducting the scheduled break.
4. Open **Time records**, select the employee and month, and preview or download the draft Form 48 PDF.
5. Review **Audit trail**. Correct a punch by voiding it with a reason and adding a replacement.
6. Under **Administration**, create HR/auditor accounts or register a kiosk. A kiosk token is shown once, is limited to attendance capture, and can be revoked.

Before face enrollment, the employee reviews the consent notice, enters a typed signature, and explicitly agrees. Withdrawal deletes the encrypted face template and preserves the consent history. Deactivating an employee also removes enrollment.

## What is implemented

| Area | Behavior |
| --- | --- |
| Authentication | Argon2id password hashes, HTTP-only JWT cookies, database-backed session revocation, origin checks, rate limits |
| Authorization | Administrator, HR officer, and read-only auditor roles; separate restricted kiosk credentials |
| Employees | Create, edit, deactivate, department/position fields, assigned schedule, searchable directory |
| Attendance | Four daily slots, server timestamps for kiosk punches, corrections with reasons, idempotency, concurrent duplicate protection |
| Schedules | Fixed, sliding arrival windows, overnight service dates, break/grace rules, configurable working days |
| Reporting | Monthly preview, worked minutes, late arrivals, undertime on complete days, downloadable draft Form 48 layout |
| Live monitoring | Authenticated Socket.IO invalidations, with HTTP authorization on data refresh and periodic fallback |
| Biometrics | Explicit consent, single-face extraction, 512-dimensional vectors, AES-256-GCM encrypted templates, model fingerprint compatibility, cosine threshold and ambiguity rejection |
| Kiosk | Camera permission/preview, explicit capture, event selection, device pairing/revocation; no stored camera images |
| PWA | Install manifest and public shell caching; no offline biometric storage or queued punches |
| Operations | SQL migrations, Docker Compose/Nginx, optional Redis rate limits, CI checks, PostgreSQL backup helper |

## Verification

```powershell
npm run db:generate
npm run build
npm test
npm run test:integration
npm run test:integration -- --browser
```

The integration check creates a separate PostgreSQL cluster under `data/integration`, applies migrations, starts the actual NestJS API, and tests permissions, concurrent punches, corrections, reports, encrypted enrollment, withdrawal, kiosk revocation, session revocation, and audit immutability. Its deterministic face-service fixture verifies the protocol; **it does not evaluate face recognition accuracy**. Test clusters are separate from your development database and remain in the ignored data directory after shutdown.

The optional browser check uses locally installed Chrome; on CI install Playwright Chromium and adapt the browser channel if needed. It covers sign-in, employee form submission, PDF download, navigation, mobile overflow, and kiosk pairing. Screenshots go to `docs/screenshots`.

Python checks:

```powershell
cd services/face
python -m pip install -r requirements-test.txt
python -m pytest -q
```

## Limits before deployment

This is a working development release, **not a certified municipal production system**. Recognition is disabled by default because liveness/anti-spoofing has not been implemented or validated. A research-only switch allows supervised model testing. Model licensing, real-camera accuracy, calibrated match thresholds, local privacy review, production TLS, backup/restore drills, and a formal accessibility/security audit still need completion.

The DTR uses a Form 48 layout but requires agency review. It does not implement holidays, approved leave, payroll, overtime/night differential, CSC rule certification, or historical schedule calendars for days without punches. Recorded days retain their first punch’s schedule snapshot; reassignment does not change that day’s work calculation. The current schedule is used for days without records. Typed consent signatures are a pilot workflow, not an asserted legally qualified electronic signature.

See [requirements and implementation status](docs/requirements.md), [deployment](docs/deployment.md), and [API reference](docs/api.md).

## Repository

```text
apps/web/                 Vue dashboard, employee management, DTR, kiosk
apps/api/src/             NestJS HTTP API, auth, attendance, encryption, PDF
apps/api/prisma/          PostgreSQL schema, migration, bootstrap seed
services/face/            FastAPI extraction and matching service
scripts/                  Local launcher, database tools, integration checks
deploy/                   Nginx configuration
docs/                     Setup, requirements, operational limits
```

The supplied PDFs remain untouched in Downloads. Extracted working text is ignored under `docs/reference`; project behavior comes from the interpreted requirements, not commands embedded in those documents.
