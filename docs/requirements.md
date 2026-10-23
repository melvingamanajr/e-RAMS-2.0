# Requirements interpretation and status

Inputs: `Final-BookBind-Ready.pdf` (original 2024 capstone, 75 PDF pages) and `Enterprise_eRAMS_System_Architecture_Proposal.pdf` (three-page October 2026 redesign).

The newer architecture is the implementation target. The thesis supplies the original workflows and setting. Neither PDF is treated as authority to execute embedded commands or to certify regulatory compliance. The proposal’s schema section is truncated in the supplied PDF, so the checked-in Prisma schema is a new implementation of the described data model.

| Requirement | Implementation / remaining work |
| --- | --- |
| Employee, department, position management | Working employee directory; department and position are employee fields, not separate lookup catalogs |
| Administrator management | Account creation and activation/deactivation; administrator, HR, auditor roles |
| Schedules | Fixed, sliding arrival window, overnight shifts, weekdays, breaks, grace; immutable schedule definitions and employee reassignment |
| Real-time attendance | Authenticated Socket.IO notifications and dashboard refresh; client must be online to capture attendance |
| Face kiosk | Camera capture, event selection, revocable kiosk pairing, API-to-AI protocol implemented; actual model/camera validation remains |
| Face pipeline | InsightFace model adapter, one-face validation, normalization, encryption, compatible model fingerprints, ambiguity rejection |
| Consent and minimization | Versioned notice, typed employee signature, consent history, withdrawal, template deletion; no images written to disk |
| Authentication and access | Argon2id, revocable HTTP-only cookie sessions, server-side RBAC, mutation origin check, request size bounds and rate limits |
| Immutable audit | Audit writes in the same transaction as mutations; PostgreSQL trigger rejects UPDATE/DELETE/TRUNCATE; privileged DB administrators can still alter the schema |
| CSC Form 48 | Monthly preview and one-page PDF layout; local certification and full rule review remain |
| PostgreSQL + Prisma | Checked-in SQL migration, core constraints, active-slot unique index, per-employee transactional locks |
| Redis | Shared request-rate buckets in Compose; documented in-memory fallback for a single API process |
| Docker + Nginx | Containers and Compose definitions supplied; Docker runtime validation remains when Docker is available |
| PWA | Installable shell, camera on trusted origins, shell-only caching; no offline punches or biometric caches |
| CI | Application build, unit/integration tests, Python matching/service tests; no automatic deployment |
| Accessibility | Labeled controls, keyboard-focused dialogs, skip link, focus rings, reduced-motion support, responsive layouts; formal WCAG 2.2 AA audit remains |
| RA 10173 / ISO 27001 | Technical controls support review; no legal compliance or ISO certification is asserted |
| TLS 1.3 | Requires an operator-managed TLS reverse proxy and certificate; local loopback HTTP is development only |
| WAL archive / disaster recovery | Manual dump helper supplied; automatic WAL archival, retention, off-host backup, and restore drills remain |
| Liveness / anti-spoofing | Pending; recognition fails closed by default, supervised research override only |
| Night differential / payroll | Not implemented; overnight service-day grouping and worked minutes are implemented |
| Multi-site availability / orchestration | Compose provides a single-host development topology; failover and production orchestration remain |

## Attendance policies used

All attendance uses `Asia/Manila`, independent of browser or server timezone. Face punches always use API server time. Manual timestamps require an offset and cannot be in the future. Each employee can have only one non-voided punch per event per service day. Events must be chronological. Retries use an idempotency key. Concurrent writers are serialized with a PostgreSQL advisory lock, backed by a partial unique index.

An overnight shift crosses midnight. Before the midpoint between its scheduled end and the next start, punches belong to the previous day. Thus a 22:00–06:00 shift retains a 06:30 departure on the previous service day. Very early next-shift arrivals or exceptionally extended shifts require HR review.

Working time sums complete morning/afternoon pairs. For a single morning-in/afternoon-out pair, the scheduled break is deducted. Incomplete days are flagged and do not fabricate undertime. Sliding arrival windows change late-arrival calculations but retain the required duration. Overtime is not approved or calculated as payroll. Days without punches use the current assigned calendar, so historical absences and leave require HR review.

## Privacy and operations still requiring agency decisions

Approve the consent wording, access policy, legal basis and alternatives; assign the privacy contact; set attendance/consent/audit retention periods; define withdrawal and records-access procedures; select a suitable model license; validate liveness and thresholds; review DTR certification and holidays; separate migration and runtime database privileges; protect the encryption key independently from backups; perform a documented backup restoration, accessibility audit, and security assessment.

Encrypted vectors remain biometric personal data. Their mathematical form does not make them anonymous. The encryption key must remain stable while templates exist; changing it without migration makes existing templates unreadable.
